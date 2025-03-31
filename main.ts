/* Checks and balances */
const canvas = document.querySelector("canvas");

if (!canvas) {
  throw new Error("Could not find a canvas element.");
}
const context = canvas.getContext("webgpu");

if (!navigator.gpu) {
  throw new Error("Browser does not support WebGPU.");
}

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
  throw new Error("The GPU isn't being detected, or it is not supported.");
}
const device = await adapter.requestDevice();
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
  device,
  format: canvasFormat,
});

/* Data to Buffer */
const triangle = new Float32Array([-0.2, -0.2, 0, 0.2, 0.2, -0.2]);
const vertexBuffer = device.createBuffer({
  size: triangle.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  label: "Vertex Buffer",
});
device.queue.writeBuffer(vertexBuffer, /*offset*/ 0, triangle);

const vertexShader = device.createShaderModule({
  code: /*wgsl*/ `
  @vertex
  fn main(@location(0) coord: vec2f)->@builtin(position) vec4f{
     return vec4f(coord*5,0,1);
    }
  `,
  label: "Vertex Shader",
});
const fragmentShader = device.createShaderModule({
  code: /*wgsl*/ `
  @fragment
  fn main() -> @location(0) vec4f{
    // loc(0) is attachment 0
    return vec4f(1,0,0,1);
  }
`,
  label: "Fragment Shader",
});

const vertexBufferLayout: GPUVertexBufferLayout = {
  arrayStride: Float32Array.BYTES_PER_ELEMENT * 2,
  attributes: [
    {
      format: "float32x2",
      offset: 0 /*offset*/,
      shaderLocation: 0 /*shader location*/,
    },
  ],
};
const pipeline = device.createRenderPipeline({
  layout: "auto",
  vertex: {
    module: vertexShader,
    buffers: [vertexBufferLayout],
    entryPoint: "main",
  },
  fragment: {
    entryPoint: "main",
    module: fragmentShader,
    targets: [{ format: canvasFormat }],
  },
});
function render() {
  const commander = device.createCommandEncoder({ label: "cmd encoder" });

  const setUp = commander.beginRenderPass({
    // config surface
    label: "Color Attachments",
    colorAttachments: [
      {
        loadOp: "clear",
        storeOp: "store",
        view: context.getCurrentTexture().createView(),
        clearValue: [0.1, 0.5, 0.6, 1],
      },
    ],
  });

  // configure the rest: data, transformations, draw,..
  setUp.setVertexBuffer(/* shaderlocation */ 0, vertexBuffer);
  setUp.setPipeline(pipeline);
  setUp.draw(triangle.length / 2, 1);
  setUp.end();
  device.queue.submit([commander.finish()]);
}

render();

export {};

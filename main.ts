const canvas = document.querySelector("canvas");

if (!canvas) {
  throw new Error("No HTML Canvas Element found in page.");
}

if (!navigator.gpu) {
  throw new Error("WebGPU not supported on this browser.");
}

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
  throw new Error("No appropriate GPUAdapter found.");
}

const device = await adapter.requestDevice();
device.lost.then((info) => {
  console.error("Device Lost: ", info);
});

/* Configure the Canvas */
const context = canvas.getContext("webgpu"); // where the drawing is rendered.
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
if (!context) {
  throw new Error("`context` is `null`");
}
context.configure({
  device,
  format: canvasFormat,
});

/* Put data in Device */
const twoTrianglesCoords = [
  [0.8, -0.8],
  [-0.8, -0.8],
  [0.8, 0.8],

  [-0.8, 0.8],
  [-0.8, -0.8],
  [0.8, 0.8],
];

const vertices = new Float32Array(twoTrianglesCoords.flat());
const vertexBuffer = device.createBuffer({
  label: "Cell Vertices",
  size: vertices.byteLength, // 12 * 32 / 8 = 48
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(vertexBuffer, /*bufferOffset=*/ 0, vertices);

// records commands to be issued to GPU
const encoder = device.createCommandEncoder();

const renderPass = encoder.beginRenderPass({
  colorAttachments: [
    {
      // first attachment, receives the pixel output
      view: context.getCurrentTexture().createView(),
      loadOp: "clear",
      storeOp: "store",
      clearValue: [0.1, 0.9, 0, 0.1], // alpha doesn't work
    },
  ],
});

const vertexBufferLayout: GPUVertexBufferLayout = {
  // i.e 8 bytes per read
  arrayStride: Float32Array.BYTES_PER_ELEMENT * 2,
  attributes: [
    {
      // the kind of byte and number
      format: "float32x2",
      offset: 0,
      shaderLocation: 0, // Position (in vertex shader below)
    },
  ],
};
const vertexShaderModule = device.createShaderModule({
  label: "Vertex Shader",
  code: /* wgsl */ `
    @vertex 
    fn vertexMain(@location(0) pos: vec2f)->@builtin(position) vec4f {
      /* - runs for each vertex
         - location(0) is the shader location (a unique ID 0-15)
         - return the position/coord in clip space 
      */
      if pos.y > 0 {
        return vec4f(pos.x + 0.1, pos.y/2,0,1); 
      } else {
        return vec4f(pos.x - 0.1, pos.y/2,0,1);
      }
    }
    `,
});
const fragmentShaderModule = device.createShaderModule({
  label: "Fragment Shader",
  code: /*wgsl*/ `
    @fragment
    fn fragmentMain() -> @location(0) vec4f {
      /* 
       invoked for every pixel
       location(0) is the colorAttachment position (index in array)
       returns the same color for each pixel.
       */
      return vec4f(1, 0, 0, 1); // (Red, Green, Blue, Alpha)
    }
  `,
});

const cellPipeline = device.createRenderPipeline({
  label: "Cell Pipeline",
  layout: "auto",
  vertex: {
    module: vertexShaderModule,
    entryPoint: "vertexMain",
    buffers: [vertexBufferLayout], // you can have many
  },
  fragment: {
    module: fragmentShaderModule,
    entryPoint: "fragmentMain",
    targets: [
      {
        format: canvasFormat,
      },
    ],
  },
});

renderPass.setPipeline(cellPipeline);
// `0` below matches the index of the vertex.buffers
renderPass.setVertexBuffer(0, vertexBuffer);
// could be other vertex buffers with other indices..
renderPass.draw(vertices.length / 2); // 6 vertices

renderPass.end();
device.queue.submit([encoder.finish()]);

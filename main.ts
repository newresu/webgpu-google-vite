const canvas = document.querySelector("canvas");
const body = document.querySelector("body");
if (body) {
  body.style.backgroundColor = "black";
}

// browser support
if (!navigator.gpu) {
  throw new Error("WebGPU not supported on this browser.");
}

// hardware support
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
  throw new Error("No appropriate GPUAdapter found.");
}

// get a gpu
const device = await adapter.requestDevice();

// link device and memory with canvas
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("`canvas` is not a canvas.");
}
const context = canvas.getContext("webgpu");
const texture = navigator.gpu.getPreferredCanvasFormat();
if (!context) {
  throw new Error("Context undefined.");
}
context.configure({
  device: device,
  format: texture,
});
// repeats data, Index Buffers is more advanced
const xyArray = [
  [0.8, -0.8], // right, bottom
  // these repeat
  [-0.8, -0.8], // left, bottom
  [0.8, 0.8], // right, top

  [-0.8, 0.8], // left, top
  // repetition
  [-0.8, -0.8],
  [0.8, 0.8],
];
const vertices = new Float32Array(xyArray.flat());

// allocate the GPU space
const vertexBuffer = device.createBuffer({
  label: "Cell Vertices",
  size: vertices.byteLength, // 12 * 32 / 8 = 48
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});

// copy the vertices to the memory
device.queue.writeBuffer(vertexBuffer, /*bufferOffset=*/ 0, vertices);

// we need to describe the organization / layout of the _bytes_.
const vertexBufferLayout: GPUVertexBufferLayout = {
  // i.e 8 bytes per read
  arrayStride: Float32Array.BYTES_PER_ELEMENT * 2,
  attributes: [
    {
      // the kind of byte and number; GPUVertexFormat type
      format: "float32x2",
      offset: 0,
      shaderLocation: 0, // Position, see vertex shader
    },
  ],
};

// records GPU commands.
const encoder = device.createCommandEncoder();

const cPass = encoder.beginRenderPass({
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

const vertexShaderModule = device.createShaderModule({
  label: "Vertex Shader",
  code: /* wgsl */ `
    @vertex 
    fn vertexMain(@location(0) pos: vec2f)->@builtin(position) vec4f {
      /* - runs for each vertex
         - location(0) is the shader location
         - return the coord in clip space 
      */
      return vec4f(pos,0,1); 
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
       location(0) is the colorAttachment position.
       returns the same color for each pixel.
       */
      return vec4f(1, 0, 0, 1); // (Red, Green, Blue, Alpha)
    }
  `,
});

// Run the shader
const cellPipeline = device.createRenderPipeline({
  label: "Cell Pipeline",
  layout: "auto",
  vertex: {
    module: vertexShaderModule,
    entryPoint: "vertexMain",
    buffers: [vertexBufferLayout],
  },
  fragment: {
    module: fragmentShaderModule,
    entryPoint: "fragmentMain",
    targets: [
      {
        format: texture,
      },
    ],
  },
});

cPass.setPipeline(cellPipeline);
// `0` below matches the vertex.buffer
cPass.setVertexBuffer(0, vertexBuffer);
cPass.draw(vertices.length / 2); // 6 vertices

cPass.end();
device.queue.submit([encoder.finish()]);

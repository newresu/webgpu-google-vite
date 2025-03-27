import { twoTrianglesCoords } from "./triangleCoords.ts";
import { getDevice, getCanvasGPUContext } from "./utils.ts";

const GRID_SIZE = 4;

/* Get canvas and device */
const canvas = document.querySelector("canvas");
const device = await getDevice(navigator);

/* Configure the Canvas Context */
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
const context = getCanvasGPUContext(canvas);
context.configure({
  device,
  format: canvasFormat,
});

/* Vertices: Allocate Space and Write in */
const vertices = new Float32Array(twoTrianglesCoords.flat());
const vertexBuffer = device.createBuffer({
  label: "Cell Vertices",
  size: vertices.byteLength, // 12 * 32 / 8 = 48
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(vertexBuffer, /*bufferOffset=*/ 0, vertices);

/* Uniform: Same. */
const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
const uniformBuffer = device.createBuffer({
  label: "Grid Uniforms",
  size: uniformArray.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(uniformBuffer, /*offset*/ 0, uniformArray);

/* Start the commands */
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

/* Shaders */
const vertexShaderModule = device.createShaderModule({
  label: "Vertex Shader",
  code: /* wgsl */ `
    @group(0) @binding(0) var<uniform> grid: vec2f;
    @vertex 
    fn vertexMain(@location(0) pos: vec2f)->@builtin(position) vec4f {
      /* 
       Runs for each vertex
       location(0) is the shader location
       return coord in clip space 
       */
      return vec4f(pos/grid,0,1);
    }
    `,
});
const fragmentShaderModule = device.createShaderModule({
  label: "Fragment Shader",
  code: /*wgsl*/ `
    @fragment
    fn fragmentMain() -> @location(0) vec4f {
      /* 
       Invoked for every pixel
       location(0) is the colorAttachment position.
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
    buffers: [vertexBufferLayout], // device doesn't know layout yet.
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

const bindGroup = device.createBindGroup({
  label: "Cell renderer bind group",
  layout: cellPipeline.getBindGroupLayout(0), // @group
  entries: [
    {
      binding: 0, //@binding
      resource: { buffer: uniformBuffer },
    },
  ],
});

renderPass.setPipeline(cellPipeline);

// `0` as in VertexBufferLayout.offset
renderPass.setVertexBuffer(0, vertexBuffer);

renderPass.setBindGroup(0, bindGroup); // New

renderPass.draw(vertices.length / 2); // 6 vertices

renderPass.end();
device.queue.submit([encoder.finish()]);

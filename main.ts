import { twoTrianglesCoords } from "./triangleCoords.ts";
import { getDevice, getCanvasGPUContext } from "./init.ts";
import { getUniformBuffer, getVertexBuffer } from "./getBuffers.ts";

const GRID_SIZE = 32;

/* Get canvas and device */
const canvas = document.querySelector("canvas");
const device = await getDevice(navigator);

/* Configure the Canvas Context */
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
const context = getCanvasGPUContext(canvas); //ctx.getContext('webgpu')
context.configure({
  device,
  format: canvasFormat,
});

/* Vertices: Allocate Space and Write in */
const vertices = new Float32Array(twoTrianglesCoords.flat());
const vertexBuffer = getVertexBuffer(device, vertices);
device.queue.writeBuffer(vertexBuffer, /*bufferOffset=*/ 0, vertices);

/* Uniform: Same. */
const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
const uniformBuffer = getUniformBuffer(device, uniformArray);
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
      clearValue: [0.1, 0.9, 0, 0.5],
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
    struct VertexInput {
        @location(0) pos: vec2f, 
        @builtin(instance_index) instance: u32
    }
    struct VertexOutput {
      @builtin(position) pos: vec4f,
      @location(0) cell: vec2f, 
    }
    @group(0) @binding(0) var<uniform> grid: vec2f;
    @vertex 
    fn vertexMain(input:VertexInput)-> VertexOutput{
      /* 
       Runs for each vertex
       location(0) is the shader location
       return coord in clip space 
       */
      let i = f32(input.instance);
      let cell = vec2f(i % grid.x, floor(i / grid.x));
      let cellOffset = cell / grid * 2; // Compute the offset to cell
      let shifted = (input.pos + 1) / grid - 1 + cellOffset; // Add it here!
      var output: VertexOutput;
      output.pos = vec4f(shifted, 0, 1);
      output.cell = cell/grid;
      return output;
    }
    `,
});
const fragmentShaderModule = device.createShaderModule({
  label: "Fragment Shader",
  code: /*wgsl*/ `
    @fragment
    fn fragmentMain(@location(0) cell:vec2f) -> @location(0) vec4f {
      /* 
       Invoked for every pixel
       location(0) is the colorAttachment position.
       returns the same color for each pixel.
       */
      let c = cell;
      return vec4f(c, 1-c.x, 1); // (Red, Green, Blue, Alpha)
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

renderPass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE); // 6 vertices

renderPass.end();
device.queue.submit([encoder.finish()]);

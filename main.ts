import { twoTrianglesCoords } from "./triangleCoords.ts";
import { getDevice, getCanvasGPUContext } from "./utils.ts";

const GRID_SIZE = 16;

/* Get canvas and device */
const canvas = document.querySelector("canvas");
const device = await getDevice(navigator);
device.lost.then((info) => {
  console.error("Device Lost: ", info);
});

/* Configure the Canvas Context */
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
const context = getCanvasGPUContext(canvas);
context.configure({
  device,
  format: canvasFormat,
});

/* Shaders */
const vertexShaderModule = device.createShaderModule({
  label: "Vertex Shader",
  code: /* wgsl */ `
    @group(0) @binding(0) var<uniform> grid: vec2f;
    @vertex 
    // location is simply the unique identified shaderLocation
    // because we could have many.
    fn vertexMain(@location(0) pos: vec2f, @builtin(instance_index) instance: u32)->@builtin(position) vec4f {
      /* 
       Runs for each vertex (6 times in total)
       location(0) is the shader location
       return coord in clip space 
       */
      let i = f32(instance);
      let cell = vec2f(i % grid.x, floor(i / grid.x));
      let length_c = 2. / grid;// grid_length / n_cells
      let displacement = cell * length_c ; // Compute the distance to cell
      let lowerLeft =  (pos + 0.8) / grid - 1; // move to lower left corner
      let offset = 0.2/grid; // 0.4/(2*grid), grid_margin/n_margins
      let gridPos = lowerLeft + displacement + offset;// think visually
      return vec4f(gridPos,0,1);
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

/* BUFFERS: Allocate Space and Write in */
const vertices = new Float32Array(twoTrianglesCoords.flat());
const vertexBuffer = device.createBuffer({
  label: "Cell Vertices",
  size: vertices.byteLength, // 12 * 32 / 8 = 48
  // COPY_DST is because they will copy the data from a GPU Buffer.
  // Vertices may be copied to a "mappedAtCreation" GPUBuffer.
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(vertexBuffer, /*bufferOffset=*/ 0, vertices);

/* Uniform: Same. */
const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
// Pass JS values to Shader
// They are read only.
const uniformBuffer = device.createBuffer({
  label: "Grid Uniforms",
  size: uniformArray.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(uniformBuffer, /*offset*/ 0, uniformArray);

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

// this can be commented out if you use cellPipeline.layout='auto'
const bindGroupLayout = device.createBindGroupLayout({
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: "uniform" },
    },
  ],
});

const cellPipeline = device.createRenderPipeline({
  label: "Cell Pipeline",
  layout: device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout], // or use "auto"
  }),
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

/// connect buffer with shader (stored in pipeline)
const bindGroup = device.createBindGroup({
  label: "Cell renderer bind group",
  layout: cellPipeline.getBindGroupLayout(0), // index in the bindGroupLayout.entry
  entries: [
    {
      binding: 0, //@binding
      resource: { buffer: uniformBuffer },
    },
  ],
});

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

renderPass.setPipeline(cellPipeline);

// 0 is the `vertex.buffers` entry index, also the @group
renderPass.setVertexBuffer(0, vertexBuffer);
renderPass.setBindGroup(0, bindGroup); // same here

// 6 vertices, GRID_SIZE*GRID_SIZE instances.
renderPass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE);

renderPass.end();
device.queue.submit([encoder.finish()]);

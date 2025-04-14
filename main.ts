import vertexShader from "./vertex.wgsl?raw";
import fragmentShader from "./fragment.wgsl?raw";
import computeShader from "./compute.wgsl?raw";
import { twoTrianglesCoords } from "./triangleCoords.ts";
import { getDevice, getCanvasGPUContext } from "./init.ts";
import {
  getCellStateBuffer,
  getUniformBuffer,
  getVertexBuffer,
} from "./getBuffers.ts";

const GRID_SIZE = 64;
const UPDATE_INTERVAL = 100; // ms
let step = 0;

/* canvas and device */
const canvas = document.querySelector("canvas");
const device = await getDevice(navigator);
device.lost.then((info) => {
  console.error("DEVICE LOST: ", info);
});

/* Configure Canvas GPU Context */
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
const context = getCanvasGPUContext(canvas); //ctx.getContext('webgpu')
context.configure({
  device,
  format: canvasFormat,
});

/** ## Pipeline(ShaderModules, VertexLayout, BindLayout) */

/* SHADERS */
const vertexShaderModule = device.createShaderModule({
  label: "Vertex Shader",
  code: vertexShader,
});
const fragmentShaderModule = device.createShaderModule({
  label: "Fragment Shader",
  code: fragmentShader,
});

/* Define the Layouts of all data */
const vertexBufferLayout: GPUVertexBufferLayout = {
  // (x, y) = (f32, f32) = 8 bytes per read
  arrayStride: Float32Array.BYTES_PER_ELEMENT * 2,
  attributes: [
    {
      // kind x number
      format: "float32x2",
      offset: 0,
      shaderLocation: 0, // Position (in vertex shader below)
    },
  ],
};
// can be removed when `layout: "auto"` in pipeline.
const bindGroupLayout = device.createBindGroupLayout({
  label: "Bind Group Layout",
  entries: [
    {
      binding: 0,
      visibility:
        GPUShaderStage.FRAGMENT |
        GPUShaderStage.VERTEX |
        GPUShaderStage.COMPUTE,
      buffer: { type: "uniform" },
    },
    {
      binding: 1,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
      // critical: read-only, because Vertex Shaders are not
      // allowed to use read_write storage buffers.
      buffer: { type: "read-only-storage" },
    },
    {
      binding: 2,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type: "storage" },
    },
  ],
});
const pipelineLayout = device.createPipelineLayout({
  bindGroupLayouts: [bindGroupLayout], // I think this index is the "group"
  label: "Pipeline Layout",
});
const cellPipeline = device.createRenderPipeline({
  label: "Cell Pipeline",
  // layout: "auto" also works.
  layout: pipelineLayout,
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
        // for the first texture/attachment
        format: canvasFormat,
      },
    ],
  },
});

/** ## Create and Write Buffers */

const vertices = new Float32Array(twoTrianglesCoords);
const vertexBuffer = getVertexBuffer(device, vertices);
device.queue.writeBuffer(vertexBuffer, 0, vertices);

const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
const uniformBuffer = getUniformBuffer(device, uniformArray);
device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE);
const cellStateBuffers = [
  getCellStateBuffer(device, cellStateArray, "Cell State A"),
  getCellStateBuffer(device, cellStateArray, "Cell State B"),
];
for (let i = 0; i < cellStateArray.length; ++i) {
  cellStateArray[i] = Math.random() > 0.6 ? 1 : 0;
}
device.queue.writeBuffer(cellStateBuffers[0], 0, cellStateArray);

const bindGroups = [
  device.createBindGroup({
    label: "Cell renderer bind group A",
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0, //@binding
        resource: { buffer: uniformBuffer },
      },
      {
        binding: 1, //@binding
        resource: { buffer: cellStateBuffers[0] },
      },
      {
        binding: 2, //@binding
        resource: { buffer: cellStateBuffers[1] },
      },
    ],
  }),
  device.createBindGroup({
    label: "Cell renderer bind group B",
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0, //@binding
        resource: { buffer: uniformBuffer },
      },
      {
        binding: 1, //@binding
        resource: { buffer: cellStateBuffers[1] },
      },
      {
        binding: 2, //@binding
        resource: { buffer: cellStateBuffers[0] },
      },
    ],
  }),
];
// Create a compute pipeline that updates the game state.
const simulationPipeline = device.createComputePipeline({
  label: "Simulation pipeline",
  layout: pipelineLayout,
  compute: {
    module: device.createShaderModule({
      label: "Compute Shader",
      code: computeShader,
    }),
    entryPoint: "main",
  },
});

// function uses all globals above.
function render() {
  /* ## Start the commands */
  const encoder = device.createCommandEncoder({ label: "cmd encoder" });
  const renderPass = encoder.beginRenderPass({
    colorAttachments: [
      {
        // first attachment, receives the pixel output
        view: context.getCurrentTexture().createView(),
        loadOp: "clear",
        storeOp: "store",
        clearValue: [0.1, 0.1, 0.1, 0.5],
      },
    ],
  });
  renderPass.setPipeline(cellPipeline);
  // `0` as in VertexBufferLayout.offset
  renderPass.setVertexBuffer(0, vertexBuffer);
  // must match @group **and** the pipeline.layout index.
  renderPass.setBindGroup(0, bindGroups[step % 2]);
  renderPass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE); // 6 vertices
  renderPass.end();

  const computePass = encoder.beginComputePass();
  computePass.setPipeline(simulationPipeline);
  computePass.setBindGroup(0, bindGroups[step % 2]);
  const workgroupCount = Math.ceil(GRID_SIZE / 8);
  computePass.dispatchWorkgroups(workgroupCount, workgroupCount);

  computePass.end();
  device.queue.submit([encoder.finish()]);
  step++;
}

setInterval(render, UPDATE_INTERVAL);

import vertexShader from "./vertex.wgsl?raw";
import fragmentShader from "./fragment.wgsl?raw";
import { twoTrianglesCoords } from "./triangleCoords.ts";
import { getDevice, getCanvasGPUContext } from "./init.ts";
import {
  getCellStateBuffer,
  getUniformBuffer,
  getVertexBuffer,
} from "./getBuffers.ts";

const GRID_SIZE = 8;
const UPDATE_INTERVAL = 1000; // ms
let step = 0;

/* Get canvas and device (if available otherwise throws.) */
const canvas = document.querySelector("canvas");
const device = await getDevice(navigator);

/* Get the canvas WebGPU-context and configure it */
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
const context = getCanvasGPUContext(canvas); //ctx.getContext('webgpu')
context.configure({
  device,
  format: canvasFormat,
});

/* Vertices: Allocate Space and Write in */
const vertices = new Float32Array(twoTrianglesCoords);
const vertexBuffer = getVertexBuffer(device, vertices);
device.queue.writeBuffer(vertexBuffer, 0, vertices);

/* Uniform: Same. */
const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
const uniformBuffer = getUniformBuffer(device, uniformArray);
device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

/* Uniform: Same. */
const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE);
const cellStateBuffer = [
  getCellStateBuffer(device, cellStateArray, "Cell State A"),
  getCellStateBuffer(device, cellStateArray, "Cell State B"),
];
for (let i = 0; i < cellStateArray.length; i += 3) {
  cellStateArray[i] = 1;
}
device.queue.writeBuffer(cellStateBuffer[0], 0, cellStateArray);
for (let i = 0; i < cellStateArray.length; i++) {
  cellStateArray[i] = i % 2;
}
device.queue.writeBuffer(cellStateBuffer[1], 0, cellStateArray);

/** Define the layout of data in the buffer */
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

/* Shaders */
const vertexShaderModule = device.createShaderModule({
  label: "Vertex Shader",
  code: vertexShader,
});
const fragmentShaderModule = device.createShaderModule({
  label: "Fragment Shader",
  code: fragmentShader,
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

const bindGroups = [
  device.createBindGroup({
    label: "Cell renderer bind group A",
    layout: cellPipeline.getBindGroupLayout(0), // @group
    entries: [
      {
        binding: 0, //@binding
        resource: { buffer: uniformBuffer },
      },
      {
        binding: 1, //@binding
        resource: { buffer: cellStateBuffer[0] },
      },
    ],
  }),
  device.createBindGroup({
    label: "Cell renderer bind group B",
    layout: cellPipeline.getBindGroupLayout(0), // @group
    entries: [
      {
        binding: 0, //@binding
        resource: { buffer: uniformBuffer },
      },
      {
        binding: 1, //@binding
        resource: { buffer: cellStateBuffer[1] },
      },
    ],
  }),
];

/* Start the commands */
function updateGrid() {
  step++;
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
  renderPass.setPipeline(cellPipeline);

  // `0` as in VertexBufferLayout.offset
  renderPass.setVertexBuffer(0, vertexBuffer);

  renderPass.setBindGroup(0, bindGroups[step % 2]);

  renderPass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE); // 6 vertices

  renderPass.end();
  device.queue.submit([encoder.finish()]);
}

setInterval(updateGrid, UPDATE_INTERVAL);

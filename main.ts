import { twoTrianglesCoords } from "./triangleCoords.ts";
import { getDevice, getCanvasGPUContext } from "./init.ts";
import { getUniformBuffer, getVertexBuffer } from "./getBuffers.ts";
import fragmentShader from "./fragment.wgsl?raw";
import vertexShader from "./vertex.wgsl?raw";

const GRID_SIZE = 32;

/* Get canvas and device */
const canvas = document.querySelector("canvas");
const device = await getDevice(navigator);
device.lost.then((info) => {
  console.error("DEVICE LOST: ", info);
});

/* Configure the Canvas Context */
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
const context = getCanvasGPUContext(canvas); //ctx.getContext('webgpu')
context.configure({
  device,
  format: canvasFormat,
});

/* Shaders */
const vertexShaderModule = device.createShaderModule({
  label: "Vertex Shader",
  code: vertexShader,
});
const fragmentShaderModule = device.createShaderModule({
  label: "Fragment Shader",
  code: fragmentShader,
});
/* Vertices: Allocate Space and Write in */
const vertices = new Float32Array(twoTrianglesCoords.flat());
const vertexBuffer = getVertexBuffer(device, vertices);
device.queue.writeBuffer(vertexBuffer, /*bufferOffset=*/ 0, vertices);

/* Uniform: Same. */
const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
const uniformBuffer = getUniformBuffer(device, uniformArray);
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

// in this case we used `layout:"auto"` in pipeline
// so we create the bindGroup afterwards and get it
// from pipeline.
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
renderPass.setPipeline(cellPipeline);

// `0` as in VertexBufferLayout.offset
renderPass.setVertexBuffer(0, vertexBuffer);

renderPass.setBindGroup(0, bindGroup); // New

renderPass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE); // 6 vertices

renderPass.end();
device.queue.submit([encoder.finish()]);

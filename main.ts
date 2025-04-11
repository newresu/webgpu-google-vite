import { getDevice, getCanvasGPUContext } from "./init.ts";

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

/* SHADERS */
const computeShaderModule = device.createShaderModule({
  label: "Compute Shader",
  code: /* wgsl */ `
  struct MyStruct{
    a: f32,
    b: vec3f
  }
  @group(0) @binding(0) var<storage, read_write> store: array<MyStruct>;
  @compute @workgroup_size(1) 
  fn main(@builtin(global_invocation_id) id: vec3u){
    if (id.x >= arrayLength(&store)){
      return;
    }
    var item:MyStruct;
    item.a = 100.;
    item.b=vec3f(id);
    store[id.x] = item;
    return;
  }
  `,
});

/* LAYOUTS */
const bindGroupLayout = device.createBindGroupLayout({
  label: "Bind Group Layout",
  entries: [
    // bvb
    {
      binding: 0,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type: "storage" },
    },
  ],
});

const cellPipeline = device.createComputePipeline({
  label: "Cell Pipeline",
  // layout: "auto" also works.
  layout: device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout], // index(0) matches @group(0)
    label: "Pipeline Layout",
  }),
  compute: {
    module: computeShaderModule,
    entryPoint: "main",
  },
});

/** ## Create and Write Buffers */

const item = new Float32Array(4);
const computeBuffer = device.createBuffer({
  size: item.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
});

const stagingBuffer = device.createBuffer({
  size: item.byteLength,
  usage: GPUBufferUsage.COPY_DST,
  mappedAtCreation: true,
});

const bindGroups = [
  device.createBindGroup({
    label: "Cell renderer bind group A",
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0, //@binding
        resource: { buffer: computeBuffer },
      },
    ],
  }),
];

// function uses all globals above.
function compute() {
  /* ## Start the commands */
  const encoder = device.createCommandEncoder({ label: "cmd encoder" });

  const cPass = encoder.beginComputePass({
    label: "Compute Pass",
  });
  cPass.setPipeline(cellPipeline);
  cPass.setBindGroup(0, bindGroups[0]);
  cPass.dispatchWorkgroups(1);
  cPass.end();
  encoder.copyBufferToBuffer(computeBuffer, stagingBuffer);
  device.queue.submit([encoder.finish()]);
  const mapped = stagingBuffer.getMappedRange();
  console.log(new Float32Array(mapped));
  stagingBuffer.unmap();
}

compute();

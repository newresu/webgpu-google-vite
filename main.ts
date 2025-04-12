import { getDevice } from "./init.ts";

/* device */
const device = await getDevice(navigator);
device.lost.then((info) => {
  console.error("DEVICE LOST: ", info);
});

/* shaders */
const computeShaderModule = device.createShaderModule({
  label: "Compute Shader",
  code: /* wgsl */ `
  // writes 0-3, 4-15, 16-27.
  // adds 4 empty (28-31) to align with 'b'.
  struct MyStruct{
    a: f32,
    b: vec3f
  }
  //writes 0-11, writes 12-15, repeats without empty space!
  // struct MyStruct{
  //   b: vec3f,
  //   a: f32
  // }
  @group(0) @binding(0) var<storage, read_write> store: array<MyStruct>;
  @compute @workgroup_size(1) 
  fn main(@builtin(global_invocation_id) id: vec3u){
    if (id.x >= arrayLength(&store)){
      return;
    }
    var item:MyStruct;
    item.a = 100.;
    item.b=vec3f(id+1);
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

const item = new Float32Array(18);
const computeBuffer = device.createBuffer({
  size: item.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
});

const stagingBuffer = device.createBuffer({
  size: item.byteLength,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
});

const bindGroup = device.createBindGroup({
  label: "Storage Binding",
  layout: bindGroupLayout,
  entries: [
    {
      binding: 0, //@binding
      resource: { buffer: computeBuffer },
    },
  ],
});

// function uses all globals above.
async function compute() {
  /* ## Start the commands */
  const encoder = device.createCommandEncoder({ label: "cmd encoder" });
  const cPass = encoder.beginComputePass({
    label: "Compute Pass",
  });
  cPass.setPipeline(cellPipeline);
  cPass.setBindGroup(0, bindGroup);
  cPass.dispatchWorkgroups(2);
  cPass.end();
  encoder.copyBufferToBuffer(computeBuffer, stagingBuffer, computeBuffer.size);
  device.queue.submit([encoder.finish()]);
  await stagingBuffer.mapAsync(GPUMapMode.READ, 0);
  const range = stagingBuffer.getMappedRange();
  console.log(new Float32Array(range));
  stagingBuffer.unmap();
}

compute()
  .then(() => console.log("done"))
  .catch((e) => console.error(e));

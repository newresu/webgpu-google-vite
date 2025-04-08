const NUM_ELS = 12;
const BUFFER_SIZE = NUM_ELS * Float32Array.BYTES_PER_ELEMENT;
if (!navigator.gpu) {
  throw new Error("Browser does not support WebGPU.");
}

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
  throw new Error("The GPU isn't being detected, or it is not supported.");
}
const device = await adapter.requestDevice();
device.lost.then((info) => {
  console.error(info);
  throw new Error("Lost GPU Device.");
});

const module = device.createShaderModule({
  label: "Compute Shader",
  code: /* wgsl */ `
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;
      @compute @workgroup_size(8) fn main(
        @builtin(global_invocation_id) gid: vec3u,
        @builtin(local_invocation_id) lid: vec3u
      ) {
        if(gid.x >= arrayLength(&data)){
          // it executes extra times.
          // if dispatchWorkGroups is a large number like 100.
          data[0] += 1;
          return;
        }
        data[gid.x] = f32(gid.x) * 100. + f32(lid.x);
      }
    `,
});

// This is the Shader's I/O GPUBuffer.
const workBuffer = device.createBuffer({
  size: BUFFER_SIZE,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  label: "Work Buffer",
});
// This is the GPUBuffer that the CPU can access (after mapping.)
const resultBuffer = device.createBuffer({
  size: BUFFER_SIZE,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  label: "Staging Buffer",
});

// or avoid this and use "auto" in `pipeline.layout`
// In general, this accompanies `createBindGroup`
const bindGroupLayout = device.createBindGroupLayout({
  entries: [
    {
      binding: 0,
      buffer: { type: "storage" },
      visibility: GPUShaderStage.COMPUTE,
    },
  ],
  label: "Bind Group Layout",
});
const pipeline = device.createComputePipeline({
  label: "pipeline",
  layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
  compute: {
    module,
    entryPoint: "main",
  },
});

const binding = device.createBindGroup({
  entries: [
    {
      binding: 0, // binding 0 in shader
      resource: { buffer: workBuffer },
    },
  ],
  layout: pipeline.getBindGroupLayout(0), // entry's index
  label: "Work Buffer Binding",
});

async function run() {
  const encoder = device.createCommandEncoder({
    label: "Encoder",
  });
  const computePass = encoder.beginComputePass({
    label: "Compute Pass",
  });

  computePass.setPipeline(pipeline);
  computePass.setBindGroup(0, binding);
  computePass.dispatchWorkgroups(Math.ceil(BUFFER_SIZE / 8));
  computePass.end();
  // copy to CPU accessible memory (after mapping)
  encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size);
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);

  // Read the results
  await resultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(resultBuffer.getMappedRange());
  console.log(result);

  resultBuffer.unmap();
}
run();
export {};

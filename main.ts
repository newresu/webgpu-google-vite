if (!navigator.gpu) {
  throw new Error("Browser does not support WebGPU.");
}

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
  throw new Error("The GPU isn't being detected, or it is not supported.");
}
const device = await adapter.requestDevice();

const module = device.createShaderModule({
  label: "doubling compute module",
  code: /* wgsl */ `
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;
 
      @compute @workgroup_size(1) fn computeSomething(
        @builtin(global_invocation_id) id: vec3u
      ) {
        let i = id.x;
        data[i] = data[i] * 2.0 + 5;
      }
    `,
});

const input = new Float32Array(2 ** 15).map((x, i) => i);
const input2 = new Float32Array(2 ** 15).map((x, i) => i);
const s = performance.now();
for (let i = 0; i < input.length; i++) {
  input2[i] = input2[i] * 2 + 5;
}
const e = performance.now();

const workBuffer = device.createBuffer({
  size: input.byteLength,
  usage:
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  label: "Work Buffer",
});
device.queue.writeBuffer(workBuffer, 0, input);
const resultBuffer = device.createBuffer({
  size: input.byteLength,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
});

const pipeline = device.createComputePipeline({
  label: "doubling compute pipeline",
  layout: "auto",
  compute: {
    module,
    entryPoint: "computeSomething",
  },
});

const binding = device.createBindGroup({
  entries: [
    {
      binding: 0, // binding 0 in shader
      resource: { buffer: workBuffer },
    },
  ],
  layout: pipeline.getBindGroupLayout(0), // to group 0 in shader
  label: "Work Buffer Binding",
});

async function mulGPU() {
  const encoder = device.createCommandEncoder({
    label: "doubling encoder",
  });
  const computePass = encoder.beginComputePass({
    label: "doubling compute pass",
  });

  computePass.setPipeline(pipeline);
  computePass.setBindGroup(0, binding);
  computePass.dispatchWorkgroups(input.length); // run 3 times
  computePass.end();

  encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size);
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);

  // Read the results
  await resultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(resultBuffer.getMappedRange());
  console.log(result);

  resultBuffer.unmap();
}
const s2 = performance.now();
mulGPU();
const e2 = performance.now();
console.log("CPU / GPU (time_ms):", (e - s) / (e2 - s2));

export {};

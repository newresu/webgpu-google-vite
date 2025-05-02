import matMul from "./matMul.wgsl?raw";
import { getBuffersAndMatrix } from "./getBuffersAndMatrix";
import { unmapBuffers } from "./unmapBuffers";
import { MatrixDimensions } from "./types";
import { initDevice } from "./initDevice";

/* Initialisation (quits for dev lost for now)*/
const device = await initDevice();

// !!!!!!! change the dimensions here !!!!!!
const matrixDimensions: MatrixDimensions = {
  A: [1024, 1024],
  B: [1024, 1024],
};

if (matrixDimensions.A[1] != matrixDimensions.B[0]) {
  throw new Error("Dimensions do not match.");
}
const [A, bufferShapeA, bufferA] = getBuffersAndMatrix(
  device,
  matrixDimensions.A,
  "A"
);
const [B, bufferShapeB, bufferB] = getBuffersAndMatrix(
  device,
  matrixDimensions.B,
  "B"
);

unmapBuffers([bufferA, bufferB, bufferShapeA, bufferShapeB]);

const outSize = A.rows * B.columns;
// can not map at creation bc needs copy first! (GPU access)
const stagingBuffer = device.createBuffer({
  size: outSize * Float32Array.BYTES_PER_ELEMENT,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  label: "Staging Buffer",
});

const bufferOut = device.createBuffer({
  size: outSize * Float32Array.BYTES_PER_ELEMENT,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  label: "Result Matrix",
});

// or avoid this and use "auto" in `pipeline.layout`
// In general, this accompanies `createBindGroup`
const bindGroupLayout = device.createBindGroupLayout({
  entries: [
    {
      binding: 0,
      buffer: { type: "read-only-storage" },
      visibility: GPUShaderStage.COMPUTE,
    },
    {
      binding: 1,
      buffer: { type: "read-only-storage" },
      visibility: GPUShaderStage.COMPUTE,
    },
    {
      binding: 2,
      buffer: { type: "storage" },
      visibility: GPUShaderStage.COMPUTE,
    },
    {
      binding: 3,
      buffer: { type: "uniform" },
      visibility: GPUShaderStage.COMPUTE,
    },
    {
      binding: 4,
      buffer: { type: "uniform" },
      visibility: GPUShaderStage.COMPUTE,
    },
  ],
  label: "Bind Group Layout",
});
const module = device.createShaderModule({
  label: "Compute Shader",
  code: matMul,
});

const pipeline = device.createComputePipeline({
  label: "pipeline",
  layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
  compute: {
    module,
    entryPoint: "matMul",
  },
});

const binding = device.createBindGroup({
  entries: [
    {
      binding: 0, // binding 0 in shader
      resource: { buffer: bufferA },
    },
    {
      binding: 1, // binding 0 in shader
      resource: { buffer: bufferB },
    },
    {
      binding: 2, // binding 0 in shader
      resource: { buffer: bufferOut },
    },
    {
      binding: 3, // binding 0 in shader
      resource: { buffer: bufferShapeA },
    },
    {
      binding: 4, // binding 0 in shader
      resource: { buffer: bufferShapeB },
    },
  ],
  layout: pipeline.getBindGroupLayout(0), // entry's index
  label: "Bindings",
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
  computePass.dispatchWorkgroups(Math.ceil((A.rows * B.columns) / 8));
  computePass.end();
  // copy to CPU accessible memory (after mapping)
  encoder.copyBufferToBuffer(bufferOut, 0, stagingBuffer, 0, bufferOut.size);
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);

  // Read the results

  let s = performance.now();
  await stagingBuffer.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(stagingBuffer.getMappedRange());
  let e = performance.now();
  let results: Record<string, number | [number, number]> = { gpuTimeMs: e - s };
  s = performance.now();
  A.mmul(B).to1DArray();
  e = performance.now();
  results.cpuTimeMs = e - s;
  results.matrixADimensions = matrixDimensions.A;
  results.matrixBDimensions = matrixDimensions.B;
  console.table(results);
  stagingBuffer.unmap();
}
run();
export {};

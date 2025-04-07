import { randomBetween } from "./randomBetween";

const NUM_BALLS = 10;
const NUM_BALL_ELEMENTS = 6 * NUM_BALLS;
const BUFFER_SIZE = NUM_BALL_ELEMENTS * Float32Array.BYTES_PER_ELEMENT;

/** Set-Up Section: Canvas and Checks. */
const canvas = document.querySelector("canvas");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("`canvas` isn't an HTMLCanvasElement.");
}
if (!navigator.gpu) {
  throw new Error("Browser does not support WebGPU.");
}

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
  throw new Error("The GPU isn't being detected, or it is not supported.");
}
const device = await adapter.requestDevice();
device.lost.then((info) => {
  console.log("Logical device was lost.");
  console.error(info);
});
const ctx = canvas.getContext("webgpu");
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
ctx.configure({
  device,
  format: canvasFormat,
});

/** Conceptual Section: 1. Shader, 2. BindGroup Layouts, 3. Compute Pipeline */
const module = device.createShaderModule({
  label: "Compute Shader Module",
  code: /* wgsl */ `
  
      struct Ball{//in order. but there is padding added.
        radius:f32,
        position:vec2f,
        velocity:vec2f,
      }
      /* Below, two Binds are declared, and need be
         created outside the shader.

         'input': is the buffer we wrote-in with JS data. 
         It's a read-only GPUBuffer.

         'output': is the internal buffer that it writes to.
         it needs read to copy it to a staging buffer.

         We define a @compute shader.

         'workgroup_size': number of work items.
         any skipped param is 1. So (64)=(64,1,1)
      */
      @group(0) @binding(0) var<storage,read> input: array<Ball>;
      @group(0) @binding(1) var<storage,read_write> output: array<Ball>;
      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) global_id: vec3u, @builtin(local_invocation_id) local_id: vec3u) {
        const TIME_STEP:f32 = 1/60.;
        var o:Ball = output[global_id.x]; 
        o.radius = 999.;
        o.velocity=vec2f(local_id.xy);
        o.position =
        input[global_id.x].position +
        input[global_id.x].velocity * TIME_STEP;
        output[global_id.x] = o;
  }
    `,
});

const bindGroupLayout = device.createBindGroupLayout({
  label: "Bind Group Layout",
  entries: [
    //bind groups in the shader.
    {
      // input is read-only storage.
      binding: 0,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type: "read-only-storage",
      },
    },
    {
      // output is read-write storage.
      binding: 1,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type: "storage" },
    },
  ],
});

const pipeline = device.createComputePipeline({
  label: "Compute Pipeline",
  layout: device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  }),
  compute: {
    module,
    entryPoint: "main",
  },
});

/* Create all GPUBuffers. Write data to input.*/
let inputBalls = new Float32Array(NUM_BALL_ELEMENTS);
for (let i = 0; i < inputBalls.length; i += 6) {
  inputBalls[i + 0] = randomBetween(2, 10); // radius
  inputBalls[i + 1] = 0; // padding
  inputBalls[i + 2] = randomBetween(0, ctx.canvas.width); // position.x
  inputBalls[i + 3] = randomBetween(0, ctx.canvas.height); // position.y
  inputBalls[i + 4] = randomBetween(-100, 100); // velocity.x
  inputBalls[i + 5] = randomBetween(-100, 100); // velocity.y
}

const inputBuffer = device.createBuffer({
  size: BUFFER_SIZE,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  label: "Input Buffer",
});
// Allows to skip staging buffer for the input.
device.queue.writeBuffer(inputBuffer, 0, inputBalls.buffer);

// This one is for the output.
const stagingBuffer = device.createBuffer({
  size: BUFFER_SIZE,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  label: "Staging Buffer",
});

const outputBuffer = device.createBuffer({
  label: "Internal Buffer",
  size: BUFFER_SIZE,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
});

const computeBindGroup = device.createBindGroup({
  label: "Compute Bind Group",
  layout: bindGroupLayout,
  entries: [
    {
      binding: 0,
      resource: { buffer: inputBuffer },
    },
    {
      binding: 1,
      resource: { buffer: outputBuffer },
    },
  ],
});

/** Encode the commands */
const encoder = device.createCommandEncoder({
  label: "Command Encoder",
});
const computePass = encoder.beginComputePass({
  label: "Compute Pass",
});
computePass.setPipeline(pipeline); // Pipeline is conceptual, takes the bind-group layout and the compute shader
computePass.setBindGroup(0, computeBindGroup); // group 0
computePass.dispatchWorkgroups(Math.ceil(BUFFER_SIZE / (4 * 64)));
computePass.end();

// copies data to staging buffer!
encoder.copyBufferToBuffer;
encoder.copyBufferToBuffer(
  outputBuffer, // the place shader writes to
  0,
  stagingBuffer, // intermediary
  0,
  BUFFER_SIZE
);
const commands = encoder.finish();
device.queue.submit([commands]);

// make staging buffer data available to JS
await stagingBuffer.mapAsync(GPUMapMode.READ, 0, BUFFER_SIZE);
if (stagingBuffer.mapState === "mapped") {
  const copyArrayBuffer = stagingBuffer.getMappedRange(0, BUFFER_SIZE);
  // copy it
  const data = copyArrayBuffer.slice();
  // release the GPU memory.
  stagingBuffer.unmap(); // AB is detached.
  console.log(new Float32Array(data));
} else {
  console.error("mapAsync did not map the staging buffer.");
}

export {};

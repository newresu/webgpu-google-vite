// we need a canvas to write out results.
const canvas = document.querySelector("canvas");
if (!canvas) {
  throw new Error("No Canvas HTML Element found in page.");
}

if (!navigator.gpu) {
  throw new Error("WebGPU not supported on this browser.");
}

// Get GPU
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
  throw new Error("No appropriate GPUAdapter found.");
}
// get logical device
const device = await adapter.requestDevice();
device.lost.then((info) => console.error("Device Lost: ", info));

// link device and canvas
const context = canvas.getContext("webgpu");
const texture = navigator.gpu.getPreferredCanvasFormat();
if (!context) {
  throw new Error("Context is `null`.");
}
context.configure({
  device: device,
  format: texture,
});

const encoder = device.createCommandEncoder();

// there are compute and render passes.
// but we want to render.
const cPass = encoder.beginRenderPass({
  colorAttachments: [
    {
      view: context.getCurrentTexture().createView(),
      loadOp: "clear",
      storeOp: "store",
      clearValue: [0.1, 0, 0.7, 0.1], // alpha doesn't work?
    },
  ],
});
cPass.end();
device.queue.submit([encoder.finish()]);
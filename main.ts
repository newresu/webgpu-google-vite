const canvas = document.querySelector("canvas");
const body = document.querySelector("body");
if (body) {
  body.style.backgroundColor = "yellow";
}
if (!navigator.gpu) {
  // browser support
  throw new Error("WebGPU not supported on this browser.");
}
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
  // hardware support
  throw new Error("No appropriate GPUAdapter found.");
}
// get an actual gpu
const device = await adapter.requestDevice();

// link device and memory with canvas
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas undefined");
}
const context = canvas.getContext("webgpu");
const texture = navigator.gpu.getPreferredCanvasFormat();
if (!context) {
  throw new Error("Context undefined.");
}
context.configure({
  device: device,
  format: texture,
});
const encoder = device.createCommandEncoder();

const cPass = encoder.beginRenderPass({
  colorAttachments: [
    {
      view: context.getCurrentTexture().createView(),
      loadOp: "clear",
      storeOp: "store",
      clearValue: [0.1, 0, 0.7, 0.1], // alpha doesn't work
    },
  ],
});
cPass.end();
device.queue.submit([encoder.finish()]);

// const info = document.getElementById("info");
// function createAppendElement(
//   newElementTag: string,
//   appendTo: HTMLElement,
//   msg: string
// ) {
//   const newElement = document.createElement(newElementTag);
//   appendTo.appendChild(newElement);
//   newElement.innerText = msg;
// }

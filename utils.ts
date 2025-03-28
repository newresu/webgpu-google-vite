
export function getCanvasGPUContext(canvas: HTMLCanvasElement | null) {
  if (!canvas) {
    throw new Error("`canvas` is `null`");
  }
  const context = canvas.getContext("webgpu");
  if (!context) {
    throw new Error("`context` is `null`");
  }
  return context; // where the drawing is rendered.
}
function checkNavigatorGPUSupport(navigator: Navigator) {
  if (!navigator.gpu) {
    throw new Error("WebGPU not supported on this browser.");
  }
}
export async function getDevice(navigator: Navigator) {
  const adapter = await navigator.gpu.requestAdapter();
  checkNavigatorGPUSupport(navigator);
  if (!adapter) {
    throw new Error("No appropriate GPUAdapter found.");
  }
  return await adapter.requestDevice();
}

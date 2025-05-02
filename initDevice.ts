export async function initDevice(){
if (!navigator.gpu) {
  throw new Error("Browser does not support WebGPU.");
}

const adapter = await navigator.gpu.requestAdapter({
  powerPreference: "low-power",
});
if (!adapter) {
  throw new Error(
    "The GPU isn't being detected, or it isn't supported by WebGPU."
  );
}
// if passes, we have a WebGPU-capable GPU.
const device = await adapter.requestDevice(); //request defaults.
device.lost.then((info)=>{
  const msg = "Device was lost"
  console.error(msg, " ", info)
  throw new Error(msg+".")
})

return device
}
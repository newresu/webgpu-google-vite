export function getUniformBuffer(device: GPUDevice, array: Float32Array) {
  return device.createBuffer({
    label: "Grid Uniforms",
    size: array.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

export function getVertexBuffer(device: GPUDevice, array: Float32Array) {
  return device.createBuffer({
    label: "Cell Vertices",
    size: array.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
}

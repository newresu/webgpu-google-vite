import { MatrixDimensions, MatrixShape } from "./types";
import { getMatrixSizeInBytes } from "./getMatrixSizeInBytes";
import { Matrix } from "ml-matrix";
export function getBuffersAndMatrix(
  device: GPUDevice,
  shape: MatrixShape,
  label: string
):[Matrix, GPUBuffer, GPUBuffer] {
  const A = Matrix.rand(...shape);
  const bufferShapeA = device.createBuffer({
    size: Float32Array.BYTES_PER_ELEMENT * 2,
    usage: GPUBufferUsage.UNIFORM,
    mappedAtCreation: true,
    label: `Dimension-Buffer Matrix ${label}`,
  });
  new Uint32Array(bufferShapeA.getMappedRange()).set(shape);
  const bufferA = device.createBuffer({
    size: getMatrixSizeInBytes(A),
    usage: GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
    label: `Buffer Matrix ${label}`,
  });
  new Float32Array(bufferA.getMappedRange()).set(A.to1DArray());
  return [A, bufferShapeA, bufferA];
}

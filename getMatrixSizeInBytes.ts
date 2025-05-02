import {Matrix} from "ml-matrix"

export function getMatrixSizeInBytes(matrix: Matrix) {
  const { rows, columns } = matrix;
  return rows * columns * Float32Array.BYTES_PER_ELEMENT;
}
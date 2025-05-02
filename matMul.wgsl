// install vscode WGSL extension for syntax highlight
@group(0) @binding(0) var<storage, read> matrixA: array<f32>;
@group(0) @binding(1) var<storage, read> matrixB: array<f32>;
@group(0) @binding(2) var<storage, read_write> matrixOut: array<f32>;
@group(0) @binding(3) var<uniform> shapeA: vec2u;
@group(0) @binding(4) var<uniform> shapeB: vec2u;
// 8 work items are seen at a time
@compute @workgroup_size(16) fn matMul(
  @builtin(global_invocation_id) gid: vec3u
) {
  // Each shader should get a C_ij
  // If instead I use A_ij I think the parallelism 
  // Makes for errors. But C_ij is independent.

  let nColsB = shapeB[1];// ==nColsC
  let nRowsA = shapeA[0];// ==nRowsC

  if(gid.x >= shapeA[0]*shapeB[1]){
    return;
  }

  let nColsA = shapeA[1];// ==nRowsB
  let idxRowC = u32(floor(f32(gid.x)/f32(nColsB))); // i
  let idxColC = gid.x % nColsB;// j
  let offsetA = idxRowC*nColsA;// offset to row start
  let offsetB = idxColC;// offset to column start
  
  var acc:f32=0;
  for (var i:u32=0; i<shapeA[1];i++){
      acc+=matrixA[offsetA+i]*matrixB[offsetB+i*nColsB];
    }
  matrixOut[gid.x] = acc;
}
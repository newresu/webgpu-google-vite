struct VertexInput {
  @location(0) pos: vec2f,
  @builtin(instance_index) instance: u32
}

struct VertexOutput {
  @location(0) cell: vec2f,
  /* builtin(position) marks `pos` as clip-space */

  @builtin(position) pos: vec4f,
}

@group(0) @binding(0)
var<uniform> grid: vec2f;
@group(0) @binding(1)
var<storage> cellState: array<u32>;
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  /* 
    Runs for each vertex
    location(0) is the shader location
    return coord in clip space 
  */

  let i = f32(input.instance);
  // input.instance acts as ID.
  let on_off_light = f32(cellState[input.instance]);
  // models a cell movement
  let cell = vec2f(i % grid.x, floor(i / grid.x));
  let cellOffset = cell / grid * 2;
  // Compute the offset to cell
  let gridPos = (input.pos * on_off_light + 1) / grid - 1 + cellOffset;
  var output: VertexOutput;
  output.pos = vec4f(gridPos, 0, 1);
  output.cell = cell / grid;
  return output;
}
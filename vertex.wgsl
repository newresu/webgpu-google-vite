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
  let on_off_light = f32(cellState[input.instance]);

  let cell = vec2f(i % grid.x, floor(i / grid.x));

  let length_c = 2 / grid;
  // length per cell
  let displacement = cell * length_c;

  let lowerLeft = (input.pos * on_off_light + 0.8) / grid - 1;
  let offset = 0.4 / (2 * grid);
  // offset for a cell

  let gridPos = lowerLeft + displacement + offset;

  var output: VertexOutput;
  output.pos = vec4f(gridPos, 0, 1);
  output.cell = cell / grid;

  return output;
}
struct VertexInput {
    @location(0) pos: vec2f, 
    @builtin(instance_index) instance: u32
}
struct VertexOutput {
  @builtin(position) pos: vec4f,
  // this location must match fragment input.
  @location(0) cell: vec2f, 
}
@group(0) @binding(0) var<uniform> grid: vec2f;
@vertex 
fn vertexMain(input:VertexInput)-> VertexOutput{
  /* 
    Runs for each vertex
    location(0) is the shader location
    return coord in clip space 
    */
  let i = f32(input.instance);
  let cell = vec2f(i % grid.x, floor(i / grid.x));
  let cellOffset = cell / grid * 2; // Compute the offset to cell
  let shifted = (input.pos + 1) / grid - 1 + cellOffset; // Add it here!
  var output: VertexOutput;
  output.pos = vec4f(shifted, 0, 1);
  output.cell = cell/grid;
  return output;
}
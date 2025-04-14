struct FragOut {
  @location(0) att1: vec4f,
  @location(1) att2: vec4f
}

@group(0) @binding(0)
var<uniform> grid: vec2f;
@fragment
fn fragmentMain(@location(0) cell: vec2f) -> FragOut {
  /* 
    Invoked for every pixel
    location(0) for input is the location(0) output of vertex shader.
    location(0) for output is the colorAttachment position (1st render target.)
    returns the same color for each pixel.
    */

  let c = cell / grid;
  var f_out: FragOut;
  f_out.att1 = vec4f(c, 1 - c.x, 1);
  f_out.att2 = vec4f(1 - c.x, c, 1);
  return f_out;
  // (Red, Green, Blue, Alpha)
}
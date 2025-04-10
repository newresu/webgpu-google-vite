@group(0) @binding(0) var<uniform> grid: vec2f;
@fragment
fn fragmentMain(@location(0) cell: vec2f) -> @location(0) vec4f {
  /* 
    Invoked for every pixel
    location(0) for input is the location(0) output of vertex shader.
    location(0) for output is the colorAttachment position (1st render target.)
    returns the same color for each pixel.
    */

  let c = cell/grid;

  return vec4f(c, 1 - c.x, 1);
  // (Red, Green, Blue, Alpha)
}
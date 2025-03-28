@fragment
fn fragmentMain(@location(0) cell:vec2f) -> @location(0) vec4f {
  /* 
    Invoked for every pixel
    location(0) is the colorAttachment position.
    returns the same color for each pixel.
    */
  let c = cell;
  return vec4f(c, 1-c.x, 1); // (Red, Green, Blue, Alpha)
}
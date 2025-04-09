struct FragInput {
  //location(0) in the input is the vertex output location.
  @location(0) cell: vec2f
}

struct FragOut {
  // location(0) in the output is the colorAttachment position.
  @location(0) out: vec4f
}

@fragment
fn fragmentMain(input: FragInput) -> FragOut {
  /* 
    Invoked for every pixel
    returns the same color for each pixel.
  */

  let c = input.cell;
  var output: FragOut;
  output.out = vec4f(c, 1 - c.x, 1);
  return output;
  // (Red, Green, Blue, Alpha)
}
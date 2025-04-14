@group(0) @binding(0)
var<uniform> grid: vec2f;
@group(0) @binding(1)
var<storage, read> cellStateIn: array<u32>;
@group(0) @binding(2)
var<storage, read_write> cellStateOut: array<u32>;

fn isUnsafeIndex(cell: vec3u) -> bool {
  let grid_u = vec2u(grid);
  if (cell.x >= grid_u.x || cell.y >= grid_u.y) {
    return true;
  }
  return false;
}

fn cellIndex(cell: vec2u) -> u32 {
  return cell.y * u32(grid.x) + cell.x;
}

fn cellActive(x: u32, y: u32) -> u32 {
  return cellStateIn[cellIndex(vec2(x, y))];
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) cell: vec3u) {

  let grid_u = vec2u(grid);
  if (isUnsafeIndex(cell)) {
    return;
  }

  var activeNeighbors: u32 = 0;
  if (cell.x != 0) {
    // test left
    activeNeighbors += cellActive(cell.x - 1, cell.y);
    if (cell.y != 0) {
      // test bottom-left
      activeNeighbors += cellActive(cell.x - 1, cell.y - 1);
    }
    if (cell.y != (grid_u.x - 1)) {
      // bottom-right
      activeNeighbors += cellActive(cell.x - 1, cell.y + 1);
    }
  }
  if (cell.x != (grid_u.x - 1)) {
    activeNeighbors += cellActive(cell.x + 1, cell.y);
    if (cell.y != 0) {
      activeNeighbors += cellActive(cell.x + 1, cell.y - 1);
    }
    if (cell.y != (grid_u.y - 1)) {
      activeNeighbors += cellActive(cell.x + 1, cell.y + 1);
    }
  }
  // by now it remains top and bottom (2 cells)
  if (cell.y != 0) {
    // adds left side
    activeNeighbors += cellActive(cell.x, cell.y - 1);
  }
  if (cell.y != (grid_u.y - 1)) {
    activeNeighbors += cellActive(cell.x, cell.y + 1);
  }

  let i = cellIndex(cell.xy);

  // Conway's game of life rules:
  switch activeNeighbors {
    case 2u : {
      // Active cells with 2 neighbors stay active.
      cellStateOut[i] = cellStateIn[i];
    }
    case 3u : {
      // Cell with 3 neighbors become or stay active.
      cellStateOut[i] = 1;
    }
    default : {
      // Cells with < 2 or > 3 neighbors become inactive.
      cellStateOut[i] = 0;
    }
  }
}
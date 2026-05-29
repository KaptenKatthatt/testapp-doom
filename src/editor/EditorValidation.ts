import { CellData, GRID_W, GRID_H, ENTITY_TYPES, PICKUP_TYPES } from './EditorTypes';

function getCell(grid: CellData[][], x: number, z: number): CellData {
  if (x < 0 || x >= GRID_W || z < 0 || z >= GRID_H) return { type: 'wall' };
  return grid[z]![x]!;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  reachableCells: Set<string> | null;
}

export function runValidation(grid: CellData[][], playerPos: [number, number] | null): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!playerPos) {
    errors.push('❌ No player start position — place one with 👤 tool');
  }

  let enemyCount = 0;
  for (let z = 0; z < GRID_H; z++) {
    for (let x = 0; x < GRID_W; x++) {
      const t = getCell(grid, x, z).type;
      if ((ENTITY_TYPES as readonly string[]).includes(t)) enemyCount++;
    }
  }
  if (enemyCount === 0) errors.push('❌ No enemies placed');

  let visited: Set<string> = new Set();
  if (playerPos) {
    visited = new Set<string>();
    const queue: [number, number][] = [[playerPos[0], playerPos[1]]];
    visited.add(`${playerPos[0]},${playerPos[1]}`);

    while (queue.length > 0) {
      const [cx, cz] = queue.shift()!;
      for (const dir of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const dx = dir[0]!;
        const dz = dir[1]!;
        const nx = cx + dx;
        const nz = cz + dz;
        const key = `${nx},${nz}`;
        if (visited.has(key)) continue;
        if (nx < 0 || nx >= GRID_W || nz < 0 || nz >= GRID_H) continue;
        const cell = getCell(grid, nx, nz);
        if (cell.type === 'wall') continue;
        visited.add(key);
        queue.push([nx, nz]);
      }
    }

    for (let z = 0; z < GRID_H; z++) {
      for (let x = 0; x < GRID_W; x++) {
        const t = getCell(grid, x, z).type;
        if ((ENTITY_TYPES as readonly string[]).includes(t)) {
          if (!visited.has(`${x},${z}`)) {
            errors.push(`❌ ${t} at (${x},${z}) is NOT reachable from player start`);
          }
        }
        if ((PICKUP_TYPES as readonly string[]).includes(t)) {
          if (!visited.has(`${x},${z}`)) {
            errors.push(`❌ ${t} pickup at (${x},${z}) is NOT reachable from player start`);
          }
        }
      }
    }

    for (let z = 0; z < GRID_H; z++) {
      for (let x = 0; x < GRID_W; x++) {
        if (getCell(grid, x, z).type === 'door' && !visited.has(`${x},${z}`)) {
          warnings.push(`⚠️ Door at (${x},${z}) is not reachable`);
        }
      }
    }

    let unreachableEmpty = 0;
    for (let z = 0; z < GRID_H; z++) {
      for (let x = 0; x < GRID_W; x++) {
        const t = getCell(grid, x, z).type;
        if (t === 'empty' && !visited.has(`${x},${z}`)) unreachableEmpty++;
      }
    }
    if (unreachableEmpty > 5) {
      warnings.push(`⚠️ ${unreachableEmpty} empty cells are unreachable (possible sealed rooms)`);
    }
  }

  for (let z = 1; z < GRID_H - 1; z++) {
    for (let x = 1; x < GRID_W - 1; x++) {
      const t = getCell(grid, x, z).type;
      if (t === 'wall' || t === 'empty') continue;

      if (getCell(grid, x - 1, z).type === 'wall' && getCell(grid, x + 1, z).type === 'wall') {
        if (getCell(grid, x, z - 1).type !== 'wall' && getCell(grid, x, z + 1).type !== 'wall') {
          warnings.push(`⚠️ ${t} at (${x},${z}) is in a 1-wide passage (E-W walls)`);
        }
      }
      if (getCell(grid, x, z - 1).type === 'wall' && getCell(grid, x, z + 1).type === 'wall') {
        if (getCell(grid, x - 1, z).type !== 'wall' && getCell(grid, x + 1, z).type !== 'wall') {
          warnings.push(`⚠️ ${t} at (${x},${z}) is in a 1-wide passage (N-S walls)`);
        }
      }
    }
  }

  for (let z = 1; z < GRID_H - 1; z++) {
    for (let x = 1; x < GRID_W - 1; x++) {
      if (getCell(grid, x, z).type !== 'door') continue;
      const openN = getCell(grid, x, z - 1).type !== 'wall';
      const openS = getCell(grid, x, z + 1).type !== 'wall';
      const openE = getCell(grid, x + 1, z).type !== 'wall';
      const openW = getCell(grid, x - 1, z).type !== 'wall';
      const passableSides = [openN, openS, openE, openW].filter(Boolean).length;
      if (passableSides < 2) {
        errors.push(`❌ Door at (${x},${z}) has only ${passableSides} open sides (needs 2+)`);
      } else if (!((openN && openS) || (openE && openW))) {
        warnings.push(`⚠️ Door at (${x},${z}) open sides aren't opposite`);
      }
    }
  }

  for (let z = 0; z < GRID_H; z++) {
    for (let x = 0; x < GRID_W; x++) {
      const t = getCell(grid, x, z).type;
      if (!(ENTITY_TYPES as readonly string[]).includes(t)) continue;
      let wallCount = 0;
      if (getCell(grid, x, z - 1).type === 'wall') wallCount++;
      if (getCell(grid, x, z + 1).type === 'wall') wallCount++;
      if (getCell(grid, x - 1, z).type === 'wall') wallCount++;
      if (getCell(grid, x + 1, z).type === 'wall') wallCount++;
      if (wallCount >= 3) errors.push(`❌ ${t} at (${x},${z}) surrounded by ${wallCount} walls — stuck!`);
    }
  }

  return {
    errors,
    warnings,
    reachableCells: playerPos && visited ? visited : null
  };
}

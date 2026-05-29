import type { CellData, CellType} from './EditorTypes';
import { GRID_W, GRID_H } from './EditorTypes';
import { makeGrid } from './Editor';
import { E1M1_GRID } from '@/game/levels/E1M1Grid';

export interface PresetMap {
  name: string;
  description: string;
  grid: CellData[][];
  playerPos: [number, number];
}

function setCellType(g: CellData[][], z: number, x: number, type: CellType): void {
  const row = g[z];
  const cell = row?.[x];
  if (cell) cell.type = type;
}

function borderGrid(): CellData[][] {
  const g = makeGrid();
  for (let x = 0; x < GRID_W; x++) {
    setCellType(g, 0, x, 'wall');
    setCellType(g, GRID_H - 1, x, 'wall');
  }
  for (let z = 0; z < GRID_H; z++) {
    setCellType(g, z, 0, 'wall');
    setCellType(g, z, GRID_W - 1, 'wall');
  }
  return g;
}

function fillRect(g: CellData[][], x1: number, z1: number, x2: number, z2: number, t: CellType): void {
  for (let z = z1; z <= z2; z++) for (let x = x1; x <= x2; x++) {
    if (x >= 0 && x < GRID_W && z >= 0 && z < GRID_H) setCellType(g, z, x, t);
  }
}

function hWall(g: CellData[][], z: number, x1: number, x2: number): void {
  for (let x = x1; x <= x2; x++) if (x >= 0 && x < GRID_W) setCellType(g, z, x, 'wall');
}
function vWall(g: CellData[][], x: number, z1: number, z2: number): void {
  for (let z = z1; z <= z2; z++) if (z >= 0 && z < GRID_H) setCellType(g, z, x, 'wall');
}

export const PRESETS: PresetMap[] = [
  // E1M1 — The original Entryway map, now editable!
  {
    name: 'E1M1 Entryway',
    description: 'The original default map',
    grid: (() => {
      const raw = E1M1_GRID as CellType[][];
      return raw.map(row => row.map((t: CellType) => ({ type: t })));
    })(),
    playerPos: [2, 3],
  },
  // 2. TIGHT — narrow corridors, small rooms
  {
    name: 'Tight',
    description: 'Narrow corridors and small rooms',
    grid: (() => {
      const g = borderGrid();
      // Use only horizontal walls to divide rows — doors go in the wall line
      // Each horizontal wall spans most of the width with a 2-wide door gap
      hWall(g, 8, 1, 5); hWall(g, 8, 8, 22); hWall(g, 8, 25, 48);
      setCellType(g, 8, 6, 'door'); setCellType(g, 8, 7, 'door');
      setCellType(g, 8, 23, 'door'); setCellType(g, 8, 24, 'door');

      hWall(g, 16, 1, 18); hWall(g, 16, 21, 35); hWall(g, 16, 38, 48);
      setCellType(g, 16, 19, 'door'); setCellType(g, 16, 20, 'door');
      setCellType(g, 16, 36, 'door'); setCellType(g, 16, 37, 'door');

      hWall(g, 24, 1, 10); hWall(g, 24, 13, 28); hWall(g, 24, 31, 48);
      setCellType(g, 24, 11, 'door'); setCellType(g, 24, 12, 'door');
      setCellType(g, 24, 29, 'door'); setCellType(g, 24, 30, 'door');

      hWall(g, 32, 1, 22); hWall(g, 32, 25, 40); hWall(g, 32, 43, 48);
      setCellType(g, 32, 23, 'door'); setCellType(g, 32, 24, 'door');
      setCellType(g, 32, 41, 'door'); setCellType(g, 32, 42, 'door');

      hWall(g, 40, 1, 8); hWall(g, 40, 11, 30); hWall(g, 40, 33, 48);
      setCellType(g, 40, 9, 'door'); setCellType(g, 40, 10, 'door');
      setCellType(g, 40, 31, 'door'); setCellType(g, 40, 32, 'door');

      // No vertical walls — horizontal walls alone create tight corridor feel

      // Player
      setCellType(g, 4, 4, 'player');
      // Enemies in open areas
      setCellType(g, 4, 25, 'imp');
      setCellType(g, 12, 7, 'demon');
      setCellType(g, 12, 42, 'imp');
      setCellType(g, 20, 20, 'zombieman');
      setCellType(g, 28, 40, 'imp');
      setCellType(g, 36, 15, 'imp');
      setCellType(g, 44, 25, 'imp');
      // Pickups
      setCellType(g, 4, 40, 'health');
      setCellType(g, 12, 25, 'ammo');
      setCellType(g, 20, 45, 'health');
      setCellType(g, 36, 45, 'shotgun');
      setCellType(g, 44, 10, 'ammo');
      return g;
    })(),
    playerPos: [4, 4],
  },
  // 2. OPEN — large arena with pillars
  {
    name: 'Open',
    description: 'Large open arena with scattered pillars',
    grid: (() => {
      const g = borderGrid();
      // Pillars scattered around
      const pillars: Array<[number, number]> = [
        [8, 8], [8, 16], [8, 24], [8, 32], [8, 40],
        [16, 8], [16, 16], [16, 32], [16, 40],
        [24, 8], [24, 24], [24, 40],
        [32, 8], [32, 16], [32, 32], [32, 40],
        [40, 8], [40, 16], [40, 24], [40, 32], [40, 40],
      ];
      for (const [px, pz] of pillars) {
        fillRect(g, px, pz, px + 1, pz + 1, 'wall');
      }
      // A few small walls for cover
      hWall(g, 20, 12, 16); hWall(g, 28, 33, 38);
      vWall(g, 20, 35, 39); vWall(g, 28, 10, 14);
      // Player
      setCellType(g, 24, 24, 'player');
      // Enemies spread around
      setCellType(g, 10, 10, 'imp'); setCellType(g, 10, 40, 'imp');
      setCellType(g, 40, 10, 'demon'); setCellType(g, 40, 40, 'imp');
      setCellType(g, 20, 42, 'zombieman'); setCellType(g, 30, 8, 'imp');
      setCellType(g, 12, 30, 'demon'); setCellType(g, 35, 35, 'imp');
      // Pickups
      setCellType(g, 24, 10, 'health'); setCellType(g, 24, 40, 'ammo');
      setCellType(g, 10, 24, 'shotgun'); setCellType(g, 40, 24, 'health');
      return g;
    })(),
    playerPos: [24, 24],
  },
  // 3. MAZE — winding corridors
  {
    name: 'Maze',
    description: 'Classic maze with winding corridors',
    grid: (() => {
      const g = borderGrid();
      // Only vertical walls (no horizontal walls) to avoid intersection issues
      // Each vWall has gaps for 2-wide doors, alternating left/right to create maze paths
      // Walls are spaced to leave 4-wide corridors between them

      // Column 10 — gap on LEFT side (rows 1-3)
      vWall(g, 10, 4, 48);
      setCellType(g, 1, 10, 'door'); setCellType(g, 2, 10, 'door'); setCellType(g, 3, 10, 'empty');

      // Column 20 — gap on RIGHT side (rows 46-48)
      vWall(g, 20, 1, 45);
      setCellType(g, 46, 20, 'door'); setCellType(g, 47, 20, 'door'); setCellType(g, 48, 20, 'empty');

      // Column 30 — gap on LEFT side (rows 1-3)
      vWall(g, 30, 4, 48);
      setCellType(g, 1, 30, 'door'); setCellType(g, 2, 30, 'door'); setCellType(g, 3, 30, 'empty');

      // Column 40 — gap on RIGHT side (rows 46-48)
      vWall(g, 40, 1, 45);
      setCellType(g, 46, 40, 'door'); setCellType(g, 47, 40, 'door'); setCellType(g, 48, 40, 'empty');

      // Horizontal stub walls for dead-end feel (NOT crossing vertical walls)
      // In section between col 1-9
      hWall(g, 15, 2, 8);
      hWall(g, 35, 2, 8);
      // In section between col 11-19
      hWall(g, 25, 12, 18);
      hWall(g, 45, 12, 18);
      // In section between col 21-29
      hWall(g, 15, 22, 28);
      hWall(g, 35, 22, 28);
      // In section between col 31-39
      hWall(g, 25, 32, 38);
      hWall(g, 45, 32, 38);
      // In section between col 41-48
      hWall(g, 15, 42, 47);
      hWall(g, 35, 42, 47);

      // Player in top-left
      setCellType(g, 5, 5, 'player');
      // Enemies in open corridors
      setCellType(g, 10, 15, 'imp');
      setCellType(g, 20, 25, 'demon');
      setCellType(g, 30, 35, 'zombieman');
      setCellType(g, 40, 15, 'imp');
      setCellType(g, 45, 45, 'imp');
      setCellType(g, 10, 45, 'imp');
      // Pickups in corridors
      setCellType(g, 20, 5, 'health');
      setCellType(g, 30, 15, 'ammo');
      setCellType(g, 40, 25, 'shotgun');
      setCellType(g, 20, 45, 'health');
      return g;
    })(),
    playerPos: [5, 5],
  },
  // 4. ARENA — central arena with surrounding corridors
  {
    name: 'Arena',
    description: 'Central arena with surrounding corridors',
    grid: (() => {
      const g = borderGrid();
      // Central arena — single-thick wall rectangle with 4 door openings
      hWall(g, 15, 15, 22); hWall(g, 15, 28, 35);
      hWall(g, 35, 15, 22); hWall(g, 35, 28, 35);
      vWall(g, 15, 15, 34); vWall(g, 35, 15, 34);
      // Doors on each side (2-wide each, opposite open sides)
      setCellType(g, 15, 23, 'door'); setCellType(g, 15, 24, 'door'); // N entrance
      setCellType(g, 15, 25, 'door'); setCellType(g, 15, 26, 'door'); // N entrance wide
      setCellType(g, 35, 23, 'door'); setCellType(g, 35, 24, 'door'); // S entrance
      setCellType(g, 35, 25, 'door'); setCellType(g, 35, 26, 'door'); // S entrance wide
      setCellType(g, 23, 15, 'door'); setCellType(g, 24, 15, 'door'); // W entrance
      setCellType(g, 25, 15, 'door'); setCellType(g, 26, 15, 'door'); // W entrance wide
      setCellType(g, 23, 35, 'door'); setCellType(g, 24, 35, 'door'); // E entrance
      setCellType(g, 25, 35, 'door'); setCellType(g, 26, 35, 'door'); // E entrance wide
      // Pillars inside arena (not blocking doors)
      fillRect(g, 20, 20, 21, 21, 'wall');
      fillRect(g, 29, 20, 30, 21, 'wall');
      fillRect(g, 20, 29, 21, 30, 'wall');
      fillRect(g, 29, 29, 30, 30, 'wall');
      // Player in south corridor
      setCellType(g, 42, 25, 'player');
      // Enemies — inside arena and in corridors
      setCellType(g, 25, 25, 'demon'); // arena center
      setCellType(g, 18, 20, 'imp'); // arena NW
      setCellType(g, 32, 30, 'imp'); // arena SE
      setCellType(g, 10, 25, 'zombieman'); // N corridor
      setCellType(g, 42, 10, 'imp'); // SW corridor
      setCellType(g, 8, 40, 'imp'); // NE corner area
      // Pickups
      setCellType(g, 25, 24, 'shotgun'); // arena
      setCellType(g, 42, 40, 'health'); // SE corridor
      setCellType(g, 5, 40, 'ammo'); // NE area
      setCellType(g, 42, 8, 'health'); // SW area
      return g;
    })(),
    playerPos: [25, 42],
  },
  // 5. FORTRESS — room-based with connected chambers
  {
    name: 'Fortress',
    description: 'Connected chambers with a central keep',
    grid: (() => {
      const g = borderGrid();
      // Central keep — hollow rectangle
      hWall(g, 20, 20, 30); hWall(g, 30, 20, 30);
      vWall(g, 20, 20, 30); vWall(g, 30, 20, 30);
      // Keep doors (2-wide each, opposite open sides)
      setCellType(g, 20, 24, 'door'); setCellType(g, 20, 25, 'door'); // N door
      setCellType(g, 30, 24, 'door'); setCellType(g, 30, 25, 'door'); // S door
      setCellType(g, 24, 20, 'door'); setCellType(g, 25, 20, 'door'); // W door
      setCellType(g, 24, 30, 'door'); setCellType(g, 25, 30, 'door'); // E door

      // NW room walls (x2-16, z2-16)
      hWall(g, 16, 2, 16); vWall(g, 16, 2, 16);
      // NE room walls (x33-47, z2-16)
      hWall(g, 16, 33, 47); vWall(g, 33, 2, 16);
      // SW room walls (x2-16, z33-47)
      hWall(g, 33, 2, 16); vWall(g, 16, 33, 47);
      // SE room walls (x33-47, z33-47)
      hWall(g, 33, 33, 47); vWall(g, 33, 33, 47);

      // Room doors to corridors (2-wide each)
      // NW room S door
      setCellType(g, 16, 9, 'door'); setCellType(g, 16, 10, 'door');
      // NW room E door
      setCellType(g, 8, 16, 'door'); setCellType(g, 9, 16, 'door');
      // NE room S door
      setCellType(g, 16, 40, 'door'); setCellType(g, 16, 41, 'door');
      // NE room W door
      setCellType(g, 8, 33, 'door'); setCellType(g, 9, 33, 'door');
      // SW room N door
      setCellType(g, 33, 9, 'door'); setCellType(g, 33, 10, 'door');
      // SW room E door
      setCellType(g, 40, 16, 'door'); setCellType(g, 41, 16, 'door');
      // SE room N door
      setCellType(g, 33, 40, 'door'); setCellType(g, 33, 41, 'door');
      // SE room W door
      setCellType(g, 40, 33, 'door'); setCellType(g, 41, 33, 'door');

      // Player in SW room
      setCellType(g, 40, 8, 'player');
      // Enemies in open rooms (not in corridors, not near walls)
      setCellType(g, 8, 8, 'imp');     // NW room
      setCellType(g, 8, 40, 'demon');  // NE room
      setCellType(g, 40, 40, 'imp');   // SE room
      setCellType(g, 25, 25, 'demon'); // Keep center
      setCellType(g, 8, 25, 'zombieman'); // N corridor
      setCellType(g, 25, 8, 'imp');   // W corridor
      setCellType(g, 40, 25, 'imp');  // S corridor area
      // Pickups in open rooms
      setCellType(g, 25, 24, 'shotgun'); // Keep
      setCellType(g, 40, 40, 'ammo');  // SE room (moved from entity overlap)
      setCellType(g, 8, 40, 'health'); // NE room (moved from entity overlap)
      setCellType(g, 40, 8, 'ammo');   // SW room (moved from player overlap — put nearby)
      setCellType(g, 8, 9, 'health');  // NW room
      return g;
    })(),
    playerPos: [8, 40],
  },
];

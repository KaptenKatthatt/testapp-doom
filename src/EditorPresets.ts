import { CellData, CellType, GRID_W, GRID_H } from './EditorTypes';
import { makeGrid } from './Editor';

export interface PresetMap {
  name: string;
  description: string;
  grid: CellData[][];
  playerPos: [number, number];
}

function borderGrid(): CellData[][] {
  const g = makeGrid();
  for (let x = 0; x < GRID_W; x++) { g[0]![x]!.type = 'wall'; g[GRID_H - 1]![x]!.type = 'wall'; }
  for (let z = 0; z < GRID_H; z++) { g[z]![0]!.type = 'wall'; g[z]![GRID_W - 1]!.type = 'wall'; }
  return g;
}

function fillRect(g: CellData[][], x1: number, z1: number, x2: number, z2: number, t: CellType) {
  for (let z = z1; z <= z2; z++) for (let x = x1; x <= x2; x++) {
    if (x >= 0 && x < GRID_W && z >= 0 && z < GRID_H) g[z]![x]!.type = t;
  }
}

function hWall(g: CellData[][], z: number, x1: number, x2: number) {
  for (let x = x1; x <= x2; x++) if (x >= 0 && x < GRID_W) g[z]![x]!.type = 'wall';
}
function vWall(g: CellData[][], x: number, z1: number, z2: number) {
  for (let z = z1; z <= z2; z++) if (z >= 0 && z < GRID_H) g[z]![x]!.type = 'wall';
}

export const PRESETS: PresetMap[] = [
  // 1. TIGHT — narrow corridors, small rooms
  {
    name: 'Tight',
    description: 'Narrow corridors and small rooms',
    grid: (() => {
      const g = borderGrid();
      // Use only horizontal walls to divide rows — doors go in the wall line
      // Each horizontal wall spans most of the width with a 2-wide door gap
      hWall(g, 8, 1, 5); hWall(g, 8, 8, 22); hWall(g, 8, 25, 48);
      g[8]![6]!.type = 'door'; g[8]![7]!.type = 'door';
      g[8]![23]!.type = 'door'; g[8]![24]!.type = 'door';

      hWall(g, 16, 1, 18); hWall(g, 16, 21, 35); hWall(g, 16, 38, 48);
      g[16]![19]!.type = 'door'; g[16]![20]!.type = 'door';
      g[16]![36]!.type = 'door'; g[16]![37]!.type = 'door';

      hWall(g, 24, 1, 10); hWall(g, 24, 13, 28); hWall(g, 24, 31, 48);
      g[24]![11]!.type = 'door'; g[24]![12]!.type = 'door';
      g[24]![29]!.type = 'door'; g[24]![30]!.type = 'door';

      hWall(g, 32, 1, 22); hWall(g, 32, 25, 40); hWall(g, 32, 43, 48);
      g[32]![23]!.type = 'door'; g[32]![24]!.type = 'door';
      g[32]![41]!.type = 'door'; g[32]![42]!.type = 'door';

      hWall(g, 40, 1, 8); hWall(g, 40, 11, 30); hWall(g, 40, 33, 48);
      g[40]![9]!.type = 'door'; g[40]![10]!.type = 'door';
      g[40]![31]!.type = 'door'; g[40]![32]!.type = 'door';

      // No vertical walls — horizontal walls alone create tight corridor feel

      // Player
      g[4]![4]!.type = 'player';
      // Enemies in open areas
      g[4]![25]!.type = 'imp';
      g[12]![7]!.type = 'demon';
      g[12]![42]!.type = 'imp';
      g[20]![20]!.type = 'zombieman';
      g[28]![40]!.type = 'imp';
      g[36]![15]!.type = 'imp';
      g[44]![25]!.type = 'imp';
      // Pickups
      g[4]![40]!.type = 'health';
      g[12]![25]!.type = 'ammo';
      g[20]![45]!.type = 'health';
      g[36]![45]!.type = 'shotgun';
      g[44]![10]!.type = 'ammo';
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
      const pillars: [number, number][] = [
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
      g[24]![24]!.type = 'player';
      // Enemies spread around
      g[10]![10]!.type = 'imp'; g[10]![40]!.type = 'imp';
      g[40]![10]!.type = 'demon'; g[40]![40]!.type = 'imp';
      g[20]![42]!.type = 'zombieman'; g[30]![8]!.type = 'imp';
      g[12]![30]!.type = 'demon'; g[35]![35]!.type = 'imp';
      // Pickups
      g[24]![10]!.type = 'health'; g[24]![40]!.type = 'ammo';
      g[10]![24]!.type = 'shotgun'; g[40]![24]!.type = 'health';
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
      g[1]![10]!.type = 'door'; g[2]![10]!.type = 'door'; g[3]![10]!.type = 'empty';

      // Column 20 — gap on RIGHT side (rows 46-48)
      vWall(g, 20, 1, 45);
      g[46]![20]!.type = 'door'; g[47]![20]!.type = 'door'; g[48]![20]!.type = 'empty';

      // Column 30 — gap on LEFT side (rows 1-3)
      vWall(g, 30, 4, 48);
      g[1]![30]!.type = 'door'; g[2]![30]!.type = 'door'; g[3]![30]!.type = 'empty';

      // Column 40 — gap on RIGHT side (rows 46-48)
      vWall(g, 40, 1, 45);
      g[46]![40]!.type = 'door'; g[47]![40]!.type = 'door'; g[48]![40]!.type = 'empty';

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
      g[5]![5]!.type = 'player';
      // Enemies in open corridors
      g[10]![15]!.type = 'imp';
      g[20]![25]!.type = 'demon';
      g[30]![35]!.type = 'zombieman';
      g[40]![15]!.type = 'imp';
      g[45]![45]!.type = 'imp';
      g[10]![45]!.type = 'imp';
      // Pickups in corridors
      g[20]![5]!.type = 'health';
      g[30]![15]!.type = 'ammo';
      g[40]![25]!.type = 'shotgun';
      g[20]![45]!.type = 'health';
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
      g[15]![23]!.type = 'door'; g[15]![24]!.type = 'door'; // N entrance
      g[15]![25]!.type = 'door'; g[15]![26]!.type = 'door'; // N entrance wide
      g[35]![23]!.type = 'door'; g[35]![24]!.type = 'door'; // S entrance
      g[35]![25]!.type = 'door'; g[35]![26]!.type = 'door'; // S entrance wide
      g[23]![15]!.type = 'door'; g[24]![15]!.type = 'door'; // W entrance
      g[25]![15]!.type = 'door'; g[26]![15]!.type = 'door'; // W entrance wide
      g[23]![35]!.type = 'door'; g[24]![35]!.type = 'door'; // E entrance
      g[25]![35]!.type = 'door'; g[26]![35]!.type = 'door'; // E entrance wide
      // Pillars inside arena (not blocking doors)
      fillRect(g, 20, 20, 21, 21, 'wall');
      fillRect(g, 29, 20, 30, 21, 'wall');
      fillRect(g, 20, 29, 21, 30, 'wall');
      fillRect(g, 29, 29, 30, 30, 'wall');
      // Player in south corridor
      g[42]![25]!.type = 'player';
      // Enemies — inside arena and in corridors
      g[25]![25]!.type = 'demon'; // arena center
      g[18]![20]!.type = 'imp'; // arena NW
      g[32]![30]!.type = 'imp'; // arena SE
      g[10]![25]!.type = 'zombieman'; // N corridor
      g[42]![10]!.type = 'imp'; // SW corridor
      g[8]![40]!.type = 'imp'; // NE corner area
      // Pickups
      g[25]![24]!.type = 'shotgun'; // arena
      g[42]![40]!.type = 'health'; // SE corridor
      g[5]![40]!.type = 'ammo'; // NE area
      g[42]![8]!.type = 'health'; // SW area
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
      g[20]![24]!.type = 'door'; g[20]![25]!.type = 'door'; // N door
      g[30]![24]!.type = 'door'; g[30]![25]!.type = 'door'; // S door
      g[24]![20]!.type = 'door'; g[25]![20]!.type = 'door'; // W door
      g[24]![30]!.type = 'door'; g[25]![30]!.type = 'door'; // E door

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
      g[16]![9]!.type = 'door'; g[16]![10]!.type = 'door';
      // NW room E door
      g[8]![16]!.type = 'door'; g[9]![16]!.type = 'door';
      // NE room S door
      g[16]![40]!.type = 'door'; g[16]![41]!.type = 'door';
      // NE room W door
      g[8]![33]!.type = 'door'; g[9]![33]!.type = 'door';
      // SW room N door
      g[33]![9]!.type = 'door'; g[33]![10]!.type = 'door';
      // SW room E door
      g[40]![16]!.type = 'door'; g[41]![16]!.type = 'door';
      // SE room N door
      g[33]![40]!.type = 'door'; g[33]![41]!.type = 'door';
      // SE room W door
      g[40]![33]!.type = 'door'; g[41]![33]!.type = 'door';

      // Player in SW room
      g[40]![8]!.type = 'player';
      // Enemies in open rooms (not in corridors, not near walls)
      g[8]![8]!.type = 'imp';     // NW room
      g[8]![40]!.type = 'demon';  // NE room
      g[40]![40]!.type = 'imp';   // SE room
      g[25]![25]!.type = 'demon'; // Keep center
      g[8]![25]!.type = 'zombieman'; // N corridor
      g[25]![8]!.type = 'imp';   // W corridor
      g[40]![25]!.type = 'imp';  // S corridor area
      // Pickups in open rooms
      g[25]![24]!.type = 'shotgun'; // Keep
      g[40]![40]!.type = 'ammo';  // SE room (moved from entity overlap)
      g[8]![40]!.type = 'health'; // NE room (moved from entity overlap)
      g[40]![8]!.type = 'ammo';   // SW room (moved from player overlap — put nearby)
      g[8]![9]!.type = 'health';  // NW room
      return g;
    })(),
    playerPos: [8, 40],
  },
];

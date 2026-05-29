import type { CellData, CellType, TrackStyle } from './EditorTypes';
import { GRID_W, GRID_H } from './EditorTypes';
import { makeGrid } from './Editor';
import { E1M1_GRID } from '@/game/levels/E1M1Grid';

export interface PresetMap {
  id: string; // 'e1m1', 'tight', 'open', 'maze', 'arena', 'fortress'
  name: string;
  description: string;
  grid: CellData[][];
  playerPos: [number, number];
  musicTrack?: TrackStyle | undefined;
  version?: number | undefined;
  updatedAt?: number | undefined;
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

export const FALLBACK_PRESETS: PresetMap[] = [
  // E1M1 — The original Entryway map
  {
    id: 'e1m1',
    name: 'E1M1 Entryway',
    description: 'The original default map',
    grid: (() => {
      const raw = E1M1_GRID as CellType[][];
      return raw.map(row => row.map((t: CellType) => ({ type: t })));
    })(),
    playerPos: [2, 3],
    musicTrack: 'classic',
  },
  // 2. TIGHT — narrow corridors, small rooms
  {
    id: 'tight',
    name: 'Tight',
    description: 'Narrow corridors and small rooms',
    grid: (() => {
      const g = borderGrid();
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

      setCellType(g, 4, 4, 'player');
      setCellType(g, 4, 25, 'imp');
      setCellType(g, 12, 7, 'demon');
      setCellType(g, 12, 42, 'imp');
      setCellType(g, 20, 20, 'zombieman');
      setCellType(g, 28, 40, 'imp');
      setCellType(g, 36, 15, 'imp');
      setCellType(g, 44, 25, 'imp');
      setCellType(g, 4, 40, 'health');
      setCellType(g, 12, 25, 'ammo');
      setCellType(g, 20, 45, 'health');
      setCellType(g, 36, 45, 'shotgun');
      setCellType(g, 44, 10, 'ammo');
      return g;
    })(),
    playerPos: [4, 4],
    musicTrack: 'inferno',
  },
  // 3. OPEN — large arena with pillars
  {
    id: 'open',
    name: 'Open',
    description: 'Large open arena with scattered pillars',
    grid: (() => {
      const g = borderGrid();
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
      hWall(g, 20, 12, 16); hWall(g, 28, 33, 38);
      vWall(g, 20, 35, 39); vWall(g, 28, 10, 14);
      setCellType(g, 24, 24, 'player');
      setCellType(g, 10, 10, 'imp'); setCellType(g, 10, 40, 'imp');
      setCellType(g, 40, 10, 'demon'); setCellType(g, 40, 40, 'imp');
      setCellType(g, 20, 42, 'zombieman'); setCellType(g, 30, 8, 'imp');
      setCellType(g, 12, 30, 'demon'); setCellType(g, 35, 35, 'imp');
      setCellType(g, 24, 10, 'health'); setCellType(g, 24, 40, 'ammo');
      setCellType(g, 10, 24, 'shotgun'); setCellType(g, 40, 24, 'health');
      return g;
    })(),
    playerPos: [24, 24],
    musicTrack: 'rampage',
  },
  // 4. MAZE — winding corridors
  {
    id: 'maze',
    name: 'Maze',
    description: 'Classic maze with winding corridors',
    grid: (() => {
      const g = borderGrid();
      vWall(g, 10, 4, 48);
      setCellType(g, 1, 10, 'door'); setCellType(g, 2, 10, 'door'); setCellType(g, 3, 10, 'empty');

      vWall(g, 20, 1, 45);
      setCellType(g, 46, 20, 'door'); setCellType(g, 47, 20, 'door'); setCellType(g, 48, 20, 'empty');

      vWall(g, 30, 4, 48);
      setCellType(g, 1, 30, 'door'); setCellType(g, 2, 30, 'door'); setCellType(g, 3, 30, 'empty');

      vWall(g, 40, 1, 45);
      setCellType(g, 46, 40, 'door'); setCellType(g, 47, 40, 'door'); setCellType(g, 48, 40, 'empty');

      hWall(g, 15, 2, 8);
      hWall(g, 35, 2, 8);
      hWall(g, 25, 12, 18);
      hWall(g, 45, 12, 18);
      hWall(g, 15, 22, 28);
      hWall(g, 35, 22, 28);
      hWall(g, 25, 32, 38);
      hWall(g, 45, 32, 38);
      hWall(g, 15, 42, 47);
      hWall(g, 35, 42, 47);

      setCellType(g, 5, 5, 'player');
      setCellType(g, 10, 15, 'imp');
      setCellType(g, 20, 25, 'demon');
      setCellType(g, 30, 35, 'zombieman');
      setCellType(g, 40, 15, 'imp');
      setCellType(g, 45, 45, 'imp');
      setCellType(g, 10, 45, 'imp');
      setCellType(g, 20, 5, 'health');
      setCellType(g, 30, 15, 'ammo');
      setCellType(g, 40, 25, 'shotgun');
      setCellType(g, 20, 45, 'health');
      return g;
    })(),
    playerPos: [5, 5],
    musicTrack: 'eerie',
  },
  // 5. ARENA — central arena with surrounding corridors
  {
    id: 'arena',
    name: 'Arena',
    description: 'Central arena with surrounding corridors',
    grid: (() => {
      const g = borderGrid();
      hWall(g, 15, 15, 22); hWall(g, 15, 28, 35);
      hWall(g, 35, 15, 22); hWall(g, 35, 28, 35);
      vWall(g, 15, 15, 34); vWall(g, 35, 15, 34);
      setCellType(g, 15, 23, 'door'); setCellType(g, 15, 24, 'door');
      setCellType(g, 15, 25, 'door'); setCellType(g, 15, 26, 'door');
      setCellType(g, 35, 23, 'door'); setCellType(g, 35, 24, 'door');
      setCellType(g, 35, 25, 'door'); setCellType(g, 35, 26, 'door');
      setCellType(g, 23, 15, 'door'); setCellType(g, 24, 15, 'door');
      setCellType(g, 25, 15, 'door'); setCellType(g, 26, 15, 'door');
      setCellType(g, 23, 35, 'door'); setCellType(g, 24, 35, 'door');
      setCellType(g, 25, 35, 'door'); setCellType(g, 26, 35, 'door');
      fillRect(g, 20, 20, 21, 21, 'wall');
      fillRect(g, 29, 20, 30, 21, 'wall');
      fillRect(g, 20, 29, 21, 30, 'wall');
      fillRect(g, 29, 29, 30, 30, 'wall');
      setCellType(g, 42, 25, 'player');
      setCellType(g, 25, 25, 'demon');
      setCellType(g, 18, 20, 'imp');
      setCellType(g, 32, 30, 'imp');
      setCellType(g, 10, 25, 'zombieman');
      setCellType(g, 42, 10, 'imp');
      setCellType(g, 8, 40, 'imp');
      setCellType(g, 25, 24, 'shotgun');
      setCellType(g, 42, 40, 'health');
      setCellType(g, 5, 40, 'ammo');
      setCellType(g, 42, 8, 'health');
      return g;
    })(),
    playerPos: [25, 42],
    musicTrack: 'darkness',
  },
  // 6. FORTRESS — room-based with connected chambers
  {
    id: 'fortress',
    name: 'Fortress',
    description: 'Connected chambers with a central keep',
    grid: (() => {
      const g = borderGrid();
      hWall(g, 20, 20, 30); hWall(g, 30, 20, 30);
      vWall(g, 20, 20, 30); vWall(g, 30, 20, 30);
      setCellType(g, 20, 24, 'door'); setCellType(g, 20, 25, 'door');
      setCellType(g, 30, 24, 'door'); setCellType(g, 30, 25, 'door');
      setCellType(g, 24, 20, 'door'); setCellType(g, 25, 20, 'door');
      setCellType(g, 24, 30, 'door'); setCellType(g, 25, 30, 'door');

      hWall(g, 16, 2, 16); vWall(g, 16, 2, 16);
      hWall(g, 16, 33, 47); vWall(g, 33, 2, 16);
      hWall(g, 33, 2, 16); vWall(g, 16, 33, 47);
      hWall(g, 33, 33, 47); vWall(g, 33, 33, 47);

      setCellType(g, 16, 9, 'door'); setCellType(g, 16, 10, 'door');
      setCellType(g, 8, 16, 'door'); setCellType(g, 9, 16, 'door');
      setCellType(g, 16, 40, 'door'); setCellType(g, 16, 41, 'door');
      setCellType(g, 8, 33, 'door'); setCellType(g, 9, 33, 'door');
      setCellType(g, 33, 9, 'door'); setCellType(g, 33, 10, 'door');
      setCellType(g, 40, 16, 'door'); setCellType(g, 41, 16, 'door');
      setCellType(g, 33, 40, 'door'); setCellType(g, 33, 41, 'door');
      setCellType(g, 40, 33, 'door'); setCellType(g, 41, 33, 'door');

      setCellType(g, 40, 8, 'player');
      setCellType(g, 8, 8, 'imp');
      setCellType(g, 8, 40, 'demon');
      setCellType(g, 40, 40, 'imp');
      setCellType(g, 25, 25, 'demon');
      setCellType(g, 8, 25, 'zombieman');
      setCellType(g, 25, 8, 'imp');
      setCellType(g, 40, 25, 'imp');
      setCellType(g, 25, 24, 'shotgun');
      setCellType(g, 40, 40, 'ammo');
      setCellType(g, 8, 40, 'health');
      setCellType(g, 40, 8, 'ammo');
      setCellType(g, 8, 9, 'health');
      return g;
    })(),
    playerPos: [8, 40],
    musicTrack: 'doom',
  },
];

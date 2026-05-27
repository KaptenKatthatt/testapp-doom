import { useState, useRef, useCallback, useEffect } from 'react';

type CellType = 'empty' | 'wall' | 'door' | 'player' | 'imp' | 'demon' | 'zombieman' | 'health' | 'ammo' | 'shotgun';
type DrawMode = 'paint' | 'line' | 'rect';

interface CellData {
  type: CellType;
}

const CELL_SIZE = 20;
const GRID_W = 50;
const GRID_H = 50;

const CELL_COLORS: Record<CellType, string> = {
  empty: '#1a1a1a',
  wall: '#8B7355',
  door: '#CC0000',
  player: '#00FF00',
  imp: '#FF8800',
  demon: '#FF0000',
  zombieman: '#88FF00',
  health: '#0044FF',
  ammo: '#FFAA00',
  shotgun: '#00AAFF',
};

const CELL_LABELS: Record<CellType, string> = {
  empty: '🧹 Erase',
  wall: '🧱 Wall',
  door: '🚪 Door',
  player: '👤 Player',
  imp: '👹 Imp',
  demon: '💀 Demon',
  zombieman: '🧟 Zombie',
  health: '💊 Health',
  ammo: '🔫 Ammo',
  shotgun: '🔫 Shotgun',
};

const ENTITY_TYPES = ['imp', 'demon', 'zombieman'] as const;
const PICKUP_TYPES = ['health', 'ammo', 'shotgun'] as const;

function makeGrid(): CellData[][] {
  return Array.from({ length: GRID_H }, () =>
    Array.from({ length: GRID_W }, (): CellData => ({ type: 'empty' }))
  );
}

function getCell(grid: CellData[][], x: number, z: number): CellData {
  if (x < 0 || x >= GRID_W || z < 0 || z >= GRID_H) return { type: 'wall' };
  return grid[z]![x]!;
}

function cloneGrid(grid: CellData[][]): CellData[][] {
  return grid.map(row => row.map(c => ({ ...c })));
}

// Bresenham's line algorithm
function bresenhamLine(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const points: [number, number][] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let cx = x0, cy = y0;
  while (true) {
    points.push([cx, cy]);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
  return points;
}

// --- PRESET MAPS ---
interface PresetMap {
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

const PRESETS: PresetMap[] = [
  // 1. TIGHT — narrow corridors, small rooms
  {
    name: 'Tight',
    description: 'Narrow corridors and small rooms',
    grid: (() => {
      const g = borderGrid();
      // Outer walls done by borderGrid
      // Room dividers
      hWall(g, 10, 1, 15); hWall(g, 10, 18, 24); hWall(g, 10, 27, 48);
      hWall(g, 20, 1, 8); hWall(g, 20, 11, 22); hWall(g, 20, 25, 35); hWall(g, 20, 38, 48);
      hWall(g, 30, 1, 12); hWall(g, 30, 15, 28); hWall(g, 30, 31, 42); hWall(g, 30, 45, 48);
      hWall(g, 40, 1, 18); hWall(g, 40, 21, 35); hWall(g, 40, 38, 48);
      vWall(g, 15, 1, 10); vWall(g, 25, 10, 20); vWall(g, 35, 1, 10); vWall(g, 35, 20, 30);
      vWall(g, 12, 20, 30); vWall(g, 22, 30, 40); vWall(g, 38, 10, 20); vWall(g, 42, 30, 40);
      // Doors (openings)
      g[10]![16]!.type = 'door'; g[10]![17]!.type = 'door';
      g[20]![9]!.type = 'door'; g[20]![10]!.type = 'door';
      g[20]![23]!.type = 'door'; g[20]![24]!.type = 'door';
      g[20]![36]!.type = 'door'; g[20]![37]!.type = 'door';
      g[30]![13]!.type = 'door'; g[30]![14]!.type = 'door';
      g[30]![29]!.type = 'door'; g[30]![30]!.type = 'empty';
      g[30]![43]!.type = 'door'; g[30]![44]!.type = 'door';
      g[40]![19]!.type = 'door'; g[40]![20]!.type = 'door';
      g[40]![36]!.type = 'door'; g[40]![37]!.type = 'door';
      // Player
      g[3]![3]!.type = 'player';
      // Enemies
      g[5]![20]!.type = 'imp'; g[15]![30]!.type = 'demon'; g[25]![8]!.type = 'imp';
      g[35]![40]!.type = 'imp'; g[15]![42]!.type = 'zombieman'; g[45]![20]!.type = 'imp';
      // Pickups
      g[5]![10]!.type = 'health'; g[15]![5]!.type = 'ammo'; g[25]![40]!.type = 'health';
      g[35]![20]!.type = 'shotgun'; g[45]![45]!.type = 'ammo';
      return g;
    })(),
    playerPos: [3, 3],
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
      // Generate maze-like walls using a simple pattern
      // Vertical walls with gaps
      for (let col = 5; col < GRID_W - 2; col += 5) {
        const topOrBottom = (col / 5) % 2 === 0;
        if (topOrBottom) {
          vWall(g, col, 1, GRID_H - 5);
          // Gap at bottom
          g[GRID_H - 3]![col]!.type = 'empty';
          g[GRID_H - 2]![col]!.type = 'empty';
          g[GRID_H - 4]![col]!.type = 'empty';
        } else {
          vWall(g, col, 4, GRID_H - 2);
          // Gap at top
          g[1]![col]!.type = 'empty';
          g[2]![col]!.type = g[2]![col]!.type === 'wall' ? 'wall' : 'empty';
          g[3]![col]!.type = 'empty';
        }
      }
      // Horizontal walls with gaps
      for (let row = 5; row < GRID_H - 2; row += 5) {
        const leftOrRight = (row / 5) % 2 === 0;
        if (leftOrRight) {
          hWall(g, row, 1, GRID_W - 5);
          // Gap on right
          g[row]![GRID_W - 3]!.type = 'empty';
          g[row]![GRID_W - 2]!.type = 'empty';
          g[row]![GRID_W - 4]!.type = 'empty';
        } else {
          hWall(g, row, 4, GRID_W - 2);
          // Gap on left
          g[row]![1]!.type = 'empty';
          g[row]![2]!.type = 'empty';
          g[row]![3]!.type = 'empty';
        }
      }
      // Make sure corridors are 2-wide (erase every other wall for 2-wide corridors)
      // Re-approach: clear a proper maze with 2-wide paths
      // Reset and do it properly
      // Actually let's just use a simpler approach: border + internal walls with 2-wide gaps
      // Clear and start over with a proper maze
      // Reset grid
      for (let z = 0; z < GRID_H; z++) for (let x = 0; x < GRID_W; x++) g[z]![x]!.type = 'empty';
      // Outer walls (2 thick)
      for (let x = 0; x < GRID_W; x++) { g[0]![x]!.type = 'wall'; g[1]![x]!.type = 'wall'; g[GRID_H-1]![x]!.type = 'wall'; g[GRID_H-2]![x]!.type = 'wall'; }
      for (let z = 0; z < GRID_H; z++) { g[z]![0]!.type = 'wall'; g[z]![1]!.type = 'wall'; g[z]![GRID_W-1]!.type = 'wall'; g[z]![GRID_W-2]!.type = 'wall'; }
      // Internal maze walls (horizontal and vertical barriers with 2-wide passages)
      hWall(g, 10, 2, 14); hWall(g, 11, 2, 14);
      hWall(g, 10, 20, 35); hWall(g, 11, 20, 35);
      hWall(g, 20, 8, 22); hWall(g, 21, 8, 22);
      hWall(g, 20, 30, 47); hWall(g, 21, 30, 47);
      hWall(g, 30, 2, 15); hWall(g, 31, 2, 15);
      hWall(g, 30, 25, 40); hWall(g, 31, 25, 40);
      hWall(g, 40, 10, 28); hWall(g, 41, 10, 28);
      hWall(g, 40, 35, 47); hWall(g, 41, 35, 47);

      vWall(g, 15, 2, 10); vWall(g, 16, 2, 10);
      vWall(g, 25, 11, 20); vWall(g, 26, 11, 20);
      vWall(g, 38, 2, 10); vWall(g, 39, 2, 10);
      vWall(g, 8, 21, 30); vWall(g, 9, 21, 30);
      vWall(g, 35, 21, 31); vWall(g, 36, 21, 31);
      vWall(g, 15, 31, 40); vWall(g, 16, 31, 40);
      vWall(g, 42, 11, 20); vWall(g, 43, 11, 20);
      vWall(g, 30, 31, 41); vWall(g, 31, 31, 41);
      // Doors as openings
      g[10]![15]!.type = 'door'; g[11]![15]!.type = 'empty';
      g[10]![18]!.type = 'door'; g[11]![18]!.type = 'empty';
      g[20]![23]!.type = 'door'; g[21]![23]!.type = 'empty';
      g[20]![28]!.type = 'door'; g[21]![28]!.type = 'empty';
      g[30]![16]!.type = 'door'; g[31]![16]!.type = 'empty';
      g[30]![23]!.type = 'door'; g[31]![23]!.type = 'empty';
      g[40]![29]!.type = 'door'; g[41]![29]!.type = 'empty';
      g[40]![33]!.type = 'door'; g[41]![33]!.type = 'empty';
      // Player
      g[4]![4]!.type = 'player';
      // Enemies
      g[6]![20]!.type = 'imp'; g[16]![30]!.type = 'demon';
      g[26]![12]!.type = 'imp'; g[36]![42]!.type = 'zombieman';
      g[15]![8]!.type = 'imp'; g[25]![44]!.type = 'imp';
      // Pickups
      g[4]![30]!.type = 'health'; g[16]![20]!.type = 'ammo';
      g[36]![10]!.type = 'shotgun'; g[45]![45]!.type = 'health';
      return g;
    })(),
    playerPos: [4, 4],
  },
  // 4. ARENA — central arena with surrounding corridors
  {
    name: 'Arena',
    description: 'Central arena with surrounding corridors',
    grid: (() => {
      const g = borderGrid();
      // Central arena walls (leaving 4-wide openings on each side)
      hWall(g, 12, 12, 21); hWall(g, 12, 28, 37);
      hWall(g, 37, 12, 21); hWall(g, 37, 28, 37);
      vWall(g, 12, 12, 20); vWall(g, 12, 30, 37);
      vWall(g, 37, 12, 21); vWall(g, 37, 29, 37);
      // Corner pillars
      fillRect(g, 12, 12, 14, 14, 'wall');
      fillRect(g, 35, 12, 37, 14, 'wall');
      fillRect(g, 12, 35, 14, 37, 'wall');
      fillRect(g, 35, 35, 37, 37, 'wall');
      // Alcoves in corners
      fillRect(g, 4, 4, 6, 6, 'wall');
      fillRect(g, 43, 4, 45, 6, 'wall');
      fillRect(g, 4, 43, 6, 45, 'wall');
      fillRect(g, 43, 43, 45, 45, 'wall');
      // Doors on arena entrances
      g[12]![22]!.type = 'door'; g[12]![23]!.type = 'door'; g[12]![24]!.type = 'door'; g[12]![25]!.type = 'door'; g[12]![26]!.type = 'door'; g[12]![27]!.type = 'door';
      g[37]![22]!.type = 'door'; g[37]![23]!.type = 'door'; g[37]![24]!.type = 'door'; g[37]![25]!.type = 'door'; g[37]![26]!.type = 'door'; g[37]![27]!.type = 'door';
      // Actually doors should be 2-wide max. Let me redo: just open the gaps
      for (let x = 22; x <= 27; x++) { g[12]![x]!.type = 'empty'; g[37]![x]!.type = 'empty'; }
      for (let z = 22; z <= 27; z++) { g[z]![12]!.type = 'empty'; g[z]![37]!.type = 'empty'; }
      // Add doors (2-wide each)
      g[12]![23]!.type = 'door'; g[12]![24]!.type = 'door';
      g[37]![23]!.type = 'door'; g[37]![24]!.type = 'door';
      g[23]![12]!.type = 'door'; g[24]![12]!.type = 'door';
      g[23]![37]!.type = 'door'; g[24]![37]!.type = 'door';
      // Player in south corridor
      g[44]![25]!.type = 'player';
      // Enemies in arena center and corridors
      g[24]![24]!.type = 'demon'; g[20]![20]!.type = 'imp';
      g[28]![28]!.type = 'imp'; g[20]![30]!.type = 'imp';
      g[30]![20]!.type = 'zombieman'; g[5]![25]!.type = 'imp';
      g[44]![10]!.type = 'imp'; g[10]![40]!.type = 'zombieman';
      // Pickups
      g[24]![25]!.type = 'shotgun'; g[44]![40]!.type = 'health';
      g[5]![40]!.type = 'ammo'; g[44]![5]!.type = 'health';
      return g;
    })(),
    playerPos: [25, 44],
  },
  // 5. FORTRESS — room-based with connected chambers
  {
    name: 'Fortress',
    description: 'Connected chambers with a central keep',
    grid: (() => {
      const g = borderGrid();
      // Central keep
      fillRect(g, 20, 20, 30, 30, 'wall');
      // Hollow out interior
      fillRect(g, 21, 21, 29, 29, 'empty');
      // Keep doors
      g[20]![24]!.type = 'door'; g[20]![25]!.type = 'door'; g[20]![26]!.type = 'empty';
      g[30]![24]!.type = 'door'; g[30]![25]!.type = 'door'; g[30]![26]!.type = 'empty';
      g[24]![20]!.type = 'door'; g[25]![20]!.type = 'door'; g[26]![20]!.type = 'empty';
      g[24]![30]!.type = 'door'; g[25]![30]!.type = 'door'; g[26]![30]!.type = 'empty';

      // NW room
      fillRect(g, 2, 2, 16, 16, 'empty');
      fillRect(g, 2, 2, 2, 2, 'wall'); fillRect(g, 2, 2, 16, 2, 'wall'); // already border
      hWall(g, 16, 2, 16); vWall(g, 16, 2, 16);
      g[16]![10]!.type = 'door'; g[16]![11]!.type = 'door';

      // NE room
      fillRect(g, 34, 2, 47, 16, 'empty');
      hWall(g, 16, 34, 47); vWall(g, 34, 2, 16);
      g[16]![38]!.type = 'door'; g[16]![39]!.type = 'door';

      // SW room
      fillRect(g, 2, 34, 16, 47, 'empty');
      hWall(g, 34, 2, 16); vWall(g, 16, 34, 47);
      g[34]![10]!.type = 'door'; g[34]![11]!.type = 'door';

      // SE room
      fillRect(g, 34, 34, 47, 47, 'empty');
      hWall(g, 34, 34, 47); vWall(g, 34, 34, 47);
      g[34]![38]!.type = 'door'; g[34]![39]!.type = 'door';

      // Corridors connecting rooms to center
      // N corridor
      hWall(g, 18, 2, 19); hWall(g, 18, 31, 47);
      // S corridor
      hWall(g, 31, 2, 19); hWall(g, 31, 31, 47);
      // W corridor
      vWall(g, 18, 2, 19); vWall(g, 18, 31, 47);
      // E corridor
      vWall(g, 31, 2, 19); vWall(g, 31, 31, 47);
      // Clear corridor interiors (3-wide passages)
      fillRect(g, 21, 17, 29, 19, 'empty');
      fillRect(g, 21, 31, 29, 33, 'empty');
      fillRect(g, 17, 21, 19, 29, 'empty');
      fillRect(g, 31, 21, 33, 29, 'empty');

      // Player in SW room
      g[42]![8]!.type = 'player';

      // Enemies
      g[10]![25]!.type = 'imp'; g[10]![40]!.type = 'demon';
      g[40]![40]!.type = 'imp'; g[25]![10]!.type = 'zombieman';
      g[25]![25]!.type = 'demon'; g[42]![40]!.type = 'imp';
      g[10]![8]!.type = 'imp'; g[40]![8]!.type = 'zombieman';

      // Pickups
      g[25]![25]!.type = 'shotgun'; g[42]![40]!.type = 'ammo';
      g[8]![40]!.type = 'health'; g[42]![8]!.type = 'health';
      g[8]![10]!.type = 'ammo';

      return g;
    })(),
    playerPos: [8, 42],
  },
];

// LocalStorage helpers
const AUTOSAVE_KEY = 'doom-editor-autosave';
const MAP_PREFIX = 'doom-map-';

interface SavedMap {
  name: string;
  grid: CellType[][];
  playerPos: [number, number] | null;
  timestamp: number;
}

function saveMapToStorage(name: string, grid: CellData[][], playerPos: [number, number] | null) {
  const data: SavedMap = {
    name,
    grid: grid.map(row => row.map(c => c.type)),
    playerPos,
    timestamp: Date.now(),
  };
  localStorage.setItem(MAP_PREFIX + name, JSON.stringify(data));
}

function loadMapFromStorage(name: string): { grid: CellData[][], playerPos: [number, number] | null } | null {
  const raw = localStorage.getItem(MAP_PREFIX + name);
  if (!raw) return null;
  try {
    const data: SavedMap = JSON.parse(raw);
    return {
      grid: data.grid.map(row => row.map((t: CellType) => ({ type: t }))),
      playerPos: data.playerPos,
    };
  } catch {
    return null;
  }
}

function listSavedMaps(): Array<{ name: string; timestamp: number }> {
  const maps: Array<{ name: string; timestamp: number }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(MAP_PREFIX)) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const data = JSON.parse(raw) as SavedMap;
          maps.push({ name: data.name, timestamp: data.timestamp });
        }
      } catch { /* skip */ }
    }
  }
  maps.sort((a, b) => b.timestamp - a.timestamp);
  return maps;
}

function deleteMapFromStorage(name: string) {
  localStorage.removeItem(MAP_PREFIX + name);
}

function autosave(grid: CellData[][], playerPos: [number, number] | null) {
  const data: SavedMap = {
    name: '__autosache__',
    grid: grid.map(row => row.map(c => c.type)),
    playerPos,
    timestamp: Date.now(),
  };
  localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
}

function loadAutosave(): { grid: CellData[][], playerPos: [number, number] | null } | null {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    const data: SavedMap = JSON.parse(raw);
    if (data.name !== '__autosache__') return null;
    return {
      grid: data.grid.map(row => row.map((t: CellType) => ({ type: t }))),
      playerPos: data.playerPos,
    };
  } catch {
    return null;
  }
}

export default function Editor() {
  const [grid, setGrid] = useState<CellData[][]>(makeGrid);
  const [tool, setTool] = useState<CellType>('wall');
  const [drawMode, setDrawMode] = useState<DrawMode>('paint');
  const [isDragging, setIsDragging] = useState(false);
  const [lineStart, setLineStart] = useState<[number, number] | null>(null);
  const [rectStart, setRectStart] = useState<[number, number] | null>(null);
  const [previewCells, setPreviewCells] = useState<[number, number][]>([]);
  const [showExport, setShowExport] = useState(false);
  const [reachableCells, setReachableCells] = useState<Set<string> | null>(null);
  const [exportCode, setExportCode] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedMaps, setSavedMaps] = useState<Array<{ name: string; timestamp: number }>>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerPos, setPlayerPos] = useState<[number, number] | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave on changes (debounced)
  const scheduleAutosave = useCallback((g: CellData[][], pp: [number, number] | null) => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosave(g, pp);
    }, 1000);
  }, []);

  // Check for autosave on mount
  useEffect(() => {
    const autoData = loadAutosave();
    if (autoData) {
      const hasContent = autoData.grid.some(row => row.some(c => c.type !== 'empty'));
      if (hasContent) {
        if (confirm('Restore autosaved work?')) {
          setGrid(autoData.grid);
          setPlayerPos(autoData.playerPos);
        }
      }
    }
  }, []);

  // Update grid + autosave helper
  const updateGrid = useCallback((newGrid: CellData[][], newPlayerPos?: [number, number] | null) => {
    setGrid(newGrid);
    if (newPlayerPos !== undefined) {
      setPlayerPos(newPlayerPos);
      scheduleAutosave(newGrid, newPlayerPos);
    } else {
      scheduleAutosave(newGrid, playerPos);
    }
    setReachableCells(null);
  }, [playerPos, scheduleAutosave]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let z = 0; z < GRID_H; z++) {
      const row = grid[z];
      if (!row) continue;
      for (let x = 0; x < GRID_W; x++) {
        const cell = row[x];
        if (!cell) continue;
        ctx.fillStyle = CELL_COLORS[cell.type];
        ctx.fillRect(x * CELL_SIZE, z * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
        // Show reachable overlay
        if (reachableCells && !reachableCells.has(`${x},${z}`) && cell.type !== 'wall') {
          ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
          ctx.fillRect(x * CELL_SIZE, z * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
        }
      }
    }

    // Draw preview cells (line/rect)
    if (previewCells.length > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (const [px, pz] of previewCells) {
        ctx.fillRect(px * CELL_SIZE, pz * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
      }
    }

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= GRID_W; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL_SIZE, 0);
      ctx.lineTo(x * CELL_SIZE, GRID_H * CELL_SIZE);
      ctx.stroke();
    }
    for (let z = 0; z <= GRID_H; z++) {
      ctx.beginPath();
      ctx.moveTo(0, z * CELL_SIZE);
      ctx.lineTo(GRID_W * CELL_SIZE, z * CELL_SIZE);
      ctx.stroke();
    }
  }, [grid, reachableCells, previewCells]);

  useEffect(() => { draw(); }, [draw]);

  const paintCells = useCallback((cells: [number, number][], cellType: CellType) => {
    setGrid(prev => {
      const next = cloneGrid(prev);
      for (const [x, z] of cells) {
        if (x < 0 || x >= GRID_W || z < 0 || z >= GRID_H) continue;
        if (cellType === 'player') {
          // Remove existing player
          for (let rz = 0; rz < GRID_H; rz++) {
            for (let rx = 0; rx < GRID_W; rx++) {
              if (next[rz]?.[rx]?.type === 'player') {
                next[rz]![rx]!.type = 'empty';
              }
            }
          }
          setPlayerPos([x, z]);
        }
        const cell = next[z]?.[x];
        if (cell) cell.type = cellType;
      }
      scheduleAutosave(next, cellType === 'player' ? [cells[0]![0], cells[0]![1]] : playerPos);
      return next;
    });
    setReachableCells(null);
  }, [playerPos, scheduleAutosave]);

  const paintCell = useCallback((x: number, z: number) => {
    paintCells([[x, z]], tool);
  }, [tool, paintCells]);

  const getGridPos = (e: React.MouseEvent | React.TouchEvent): [number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0]!.clientX;
      clientY = e.touches[0]!.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const gx = Math.floor((clientX - rect.left) * scaleX / CELL_SIZE);
    const gz = Math.floor((clientY - rect.top) * scaleY / CELL_SIZE);
    if (gx < 0 || gx >= GRID_W || gz < 0 || gz >= GRID_H) return null;
    return [gx, gz];
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getGridPos(e);
    if (!pos) return;

    if (drawMode === 'paint') {
      setIsDragging(true);
      paintCell(pos[0], pos[1]);
    } else if (drawMode === 'line') {
      setLineStart(pos);
      setPreviewCells([[pos[0], pos[1]]]);
    } else if (drawMode === 'rect') {
      setRectStart(pos);
      setPreviewCells([[pos[0], pos[1]]]);
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (drawMode === 'paint' && isDragging) {
      e.preventDefault();
      const pos = getGridPos(e);
      if (pos) paintCell(pos[0], pos[1]);
      return;
    }
    if (drawMode === 'line' && lineStart) {
      const pos = getGridPos(e);
      if (pos) {
        const cells = bresenhamLine(lineStart[0], lineStart[1], pos[0], pos[1]);
        setPreviewCells(cells);
      }
    } else if (drawMode === 'rect' && rectStart) {
      const pos = getGridPos(e);
      if (pos) {
        const cells: [number, number][] = [];
        const x1 = Math.min(rectStart[0], pos[0]);
        const x2 = Math.max(rectStart[0], pos[0]);
        const z1 = Math.min(rectStart[1], pos[1]);
        const z2 = Math.max(rectStart[1], pos[1]);
        for (let z = z1; z <= z2; z++) {
          for (let x = x1; x <= x2; x++) {
            cells.push([x, z]);
          }
        }
        setPreviewCells(cells);
      }
    }
  };

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (drawMode === 'paint') {
      setIsDragging(false);
      return;
    }

    const pos = e.type === 'mouseleave' ? null : getGridPos(e as React.MouseEvent | React.TouchEvent);

    if (drawMode === 'line' && lineStart) {
      const end = pos || lineStart;
      const cells = bresenhamLine(lineStart[0], lineStart[1], end[0], end[1]);
      paintCells(cells, tool);
      setLineStart(null);
      setPreviewCells([]);
    } else if (drawMode === 'rect' && rectStart) {
      const end = pos || rectStart;
      const cells: [number, number][] = [];
      const x1 = Math.min(rectStart[0], end[0]);
      const x2 = Math.max(rectStart[0], end[0]);
      const z1 = Math.min(rectStart[1], end[1]);
      const z2 = Math.max(rectStart[1], end[1]);
      for (let z = z1; z <= z2; z++) {
        for (let x = x1; x <= x2; x++) {
          cells.push([x, z]);
        }
      }
      paintCells(cells, tool);
      setRectStart(null);
      setPreviewCells([]);
    }
  };

  const exportLevel = () => {
    const visited = new Set<string>();
    const walls: Array<{ x: number; z: number; w: number; d: number; color: string }> = [];

    for (let z = 0; z < GRID_H; z++) {
      for (let x = 0; x < GRID_W; x++) {
        const key = `${x},${z}`;
        if (visited.has(key)) continue;
        const cell = getCell(grid, x, z);
        if (cell.type !== 'wall' && cell.type !== 'door') continue;

        let maxX = x;
        while (maxX + 1 < GRID_W && getCell(grid, maxX + 1, z).type === cell.type) maxX++;

        let maxZ = z;
        let canExtend = true;
        while (canExtend && maxZ + 1 < GRID_H) {
          for (let cx = x; cx <= maxX; cx++) {
            if (getCell(grid, cx, maxZ + 1).type !== cell.type) {
              canExtend = false;
              break;
            }
          }
          if (canExtend) maxZ++;
        }

        const w = maxX - x + 1;
        const d = maxZ - z + 1;
        const color = cell.type === 'door' ? '0xcc0000' : '0x8b7355';
        walls.push({ x, z, w, d, color });

        for (let vz = z; vz <= maxZ; vz++) {
          for (let vx = x; vx <= maxX; vx++) {
            visited.add(`${vx},${vz}`);
          }
        }
      }
    }

    const enemies: Array<{ id: number; x: number; z: number; type: string }> = [];
    const pickups: Array<{ id: number; x: number; z: number; type: string }> = [];
    let enemyId = 0;
    let pickupId = 1;

    for (let z = 0; z < GRID_H; z++) {
      for (let x = 0; x < GRID_W; x++) {
        const cell = getCell(grid, x, z);
        if ((ENTITY_TYPES as readonly string[]).includes(cell.type)) {
          enemies.push({ id: enemyId++, x, z, type: cell.type });
        } else if ((PICKUP_TYPES as readonly string[]).includes(cell.type)) {
          pickups.push({ id: pickupId++, x, z, type: cell.type });
        }
      }
    }

    // Build JSON level data for direct play
    const levelData = {
      walls: walls.map(w => ({ x: w.x, z: w.z, w: w.w, d: w.d, isDoor: walls.find(w2 => w2.x === w.x && w2.z === w.z && w2.color === '0xcc0000') ? true : false, color: w.color })),
      enemies: enemies.map(e => ({ id: e.id, x: e.x, z: e.z, type: e.type })),
      pickups: pickups.map(p => ({ id: p.id, x: p.x, z: p.z, type: p.type })),
      playerStart: playerPos ? [playerPos[0], playerPos[1]] : [2, 2],
    };

    let code = `// Generated by Doom Level Editor\n`;
    code += `// JSON level data (copy to save as custom map):\n`;
    code += `const LEVEL_DATA = ${JSON.stringify(levelData, null, 2)};\n\n`;

    code += `const WALL_DATA = [\n`;
    for (const w of walls) {
      code += `  { x: ${w.x}, y: 2, z: ${w.z}, w: ${w.w}, h: 4, d: ${w.d}, color: ${w.color} },\n`;
    }
    code += `];\n\n`;

    code += `// Enemies\n`;
    for (const e of enemies) {
      const hp = e.type === 'imp' ? 45 : e.type === 'demon' ? 80 : 35;
      code += `{ id: ${e.id}, position: [${e.x}, 0, ${e.z}], type: "${e.type}", health: ${hp}, maxHealth: ${hp}, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [${e.x}, 0, ${e.z}] as [number, number, number], hasAlerted: false },\n`;
    }
    code += `\n`;

    code += `// Pickups\n`;
    for (const p of pickups) {
      code += `{ id: ${p.id}, position: [${p.x}, 0.3, ${p.z}], type: "${p.type}", active: true },\n`;
    }
    code += `\n`;

    if (playerPos) {
      code += `// Player start\n`;
      code += `position: new THREE.Vector3(${playerPos[0]}, 1.7, ${playerPos[1]}),\n`;
    }

    setExportCode(code);
    setShowExport(true);
  };

  const clearGrid = () => {
    if (confirm('Clear the entire map?')) {
      updateGrid(makeGrid(), null);
    }
  };

  const loadPreset = (preset: PresetMap) => {
    updateGrid(cloneGrid(preset.grid), preset.playerPos);
  };

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) return;
    saveMapToStorage(name, grid, playerPos);
    setShowSaveDialog(false);
    setSaveName('');
  };

  const handleLoad = () => {
    setSavedMaps(listSavedMaps());
    setShowLoadDialog(true);
  };

  const handleLoadMap = (name: string) => {
    const data = loadMapFromStorage(name);
    if (data) {
      updateGrid(data.grid, data.playerPos);
      setShowLoadDialog(false);
    }
  };

  const handleDeleteMap = (name: string) => {
    if (confirm(`Delete map "${name}"?`)) {
      deleteMapFromStorage(name);
      setSavedMaps(listSavedMaps());
    }
  };

  const handlePlayMap = () => {
    // Save current map and level data so the game can load it
    saveMapToStorage('__playing__', grid, playerPos);
    const levelData = gridToLevelData(grid, playerPos);
    localStorage.setItem('doom-leveldata-__playing__', JSON.stringify(levelData));
    window.location.hash = '';
    window.location.reload();
  };

  const validate = () => {
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

    const all = [...errors, ...warnings];
    if (all.length === 0) {
      alert('✅ Level looks good! All checks passed:\n• Player start exists\n• All enemies/pickups reachable\n• No stuck enemies\n• No 1-wide passages with entities\n• All doors have open access');
    } else {
      alert(errors.length > 0
        ? `Found ${errors.length} error(s) and ${warnings.length} warning(s):\n\n${all.join('\n')}`
        : `${warnings.length} warning(s):\n\n${warnings.join('\n')}`);
    }

    if (playerPos && visited) {
      setReachableCells(visited);
    }
  };

  const drawModeLabels: Record<DrawMode, string> = { paint: '🖌️ Paint', line: '📏 Line', rect: '⬜ Rect' };

  return (
    <div style={{ background: '#111', color: '#fff', fontFamily: 'monospace', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 10 }}>
      <h1 style={{ color: '#c00', margin: '8px 0' }}>🏴‍☠️ DOOM LEVEL EDITOR</h1>

      {/* Draw mode selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {(Object.keys(drawModeLabels) as DrawMode[]).map(m => (
          <button key={m} onClick={() => { setDrawMode(m); setLineStart(null); setRectStart(null); setPreviewCells([]); }} style={{
            background: drawMode === m ? '#c00' : '#333',
            border: drawMode === m ? '2px solid #fff' : '1px solid #555',
            color: drawMode === m ? '#fff' : '#ccc',
            padding: '6px 14px', cursor: 'pointer', fontSize: 13, borderRadius: 3, fontFamily: 'monospace',
          }}>
            {drawModeLabels[m]}
          </button>
        ))}
      </div>

      {/* Cell type selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8, maxWidth: 600, justifyContent: 'center' }}>
        {(Object.keys(CELL_LABELS) as CellType[]).map(t => (
          <button key={t} onClick={() => setTool(t)} style={{
            background: tool === t ? CELL_COLORS[t] : '#333',
            border: tool === t ? '2px solid #fff' : '1px solid #555',
            color: tool === t ? '#000' : '#ccc',
            padding: '4px 8px', cursor: 'pointer', fontSize: 11, borderRadius: 3, touchAction: 'none',
          }}>
            {CELL_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Preset selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: '#888', lineHeight: '24px' }}>Presets:</span>
        {PRESETS.map(p => (
          <button key={p.name} onClick={() => { if (confirm(`Load "${p.name}" preset? This will replace current map.`)) loadPreset(p); }}
            title={p.description}
            style={{ background: '#222', border: '1px solid #555', color: '#ccc', padding: '2px 8px', cursor: 'pointer', fontSize: 11, borderRadius: 3, fontFamily: 'monospace' }}>
            {p.name}
          </button>
        ))}
      </div>

      <canvas ref={canvasRef} width={GRID_W * CELL_SIZE} height={GRID_H * CELL_SIZE}
        onMouseDown={handlePointerDown} onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}
        style={{ border: '2px solid #c00', cursor: drawMode === 'paint' ? 'crosshair' : drawMode === 'line' ? 'crosshair' : 'cell', touchAction: 'none', maxWidth: '95vw', maxHeight: '55vh' }}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={validate} style={btnStyle}>✅ Validate</button>
        <button onClick={() => setReachableCells(null)} style={btnStyle}>🔄 Clear overlay</button>
        <button onClick={handleSave} style={btnStyle}>💾 Save</button>
        <button onClick={handleLoad} style={btnStyle}>📂 Load</button>
        <button onClick={exportLevel} style={btnStyle}>📋 Export</button>
        <button onClick={clearGrid} style={btnStyle}>🗑️ Clear</button>
        <button onClick={handlePlayMap} style={{ ...btnStyle, background: '#050', border: '1px solid #0a0' }}>🎮 Play This Map</button>
      </div>

      <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
        Mode: <span style={{ color: '#ff0' }}>{drawModeLabels[drawMode]}</span> | Tool: <span style={{ color: CELL_COLORS[tool] }}>{CELL_LABELS[tool]}</span> | Grid: {GRID_W}×{GRID_H}
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <div style={overlayStyle}>
          <div style={dialogStyle}>
            <h3 style={{ color: '#c00', marginTop: 0 }}>💾 Save Map</h3>
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Map name..."
              style={{ background: '#111', color: '#fff', border: '1px solid #555', padding: '8px', fontFamily: 'monospace', fontSize: 14, width: '100%', boxSizing: 'border-box' }}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              autoFocus
            />
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={handleSave} style={btnStyle}>💾 Save</button>
              <button onClick={() => { setShowSaveDialog(false); setSaveName(''); }} style={btnStyle}>❌ Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Load dialog */}
      {showLoadDialog && (
        <div style={overlayStyle}>
          <div style={dialogStyle}>
            <h3 style={{ color: '#c00', marginTop: 0 }}>📂 Load Map</h3>
            {savedMaps.length === 0 ? (
              <p style={{ color: '#888' }}>No saved maps yet.</p>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {savedMaps.map(m => (
                  <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #333' }}>
                    <button onClick={() => handleLoadMap(m.name)} style={{ ...btnStyle, background: '#222', border: '1px solid #0a0', color: '#0f0' }}>
                      📂 {m.name}
                    </button>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: '#666' }}>{new Date(m.timestamp).toLocaleDateString()}</span>
                      <button onClick={() => handleDeleteMap(m.name)} style={{ ...btnStyle, background: '#300', border: '1px solid #600', color: '#f44', padding: '2px 6px', fontSize: 11 }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <button onClick={() => setShowLoadDialog(false)} style={btnStyle}>❌ Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Export dialog */}
      {showExport && (
        <div style={overlayStyle}>
          <div style={dialogStyle}>
            <h3 style={{ color: '#c00', marginTop: 0 }}>📋 Level Code</h3>
            <textarea readOnly value={exportCode}
              style={{ width: '100%', minWidth: 400, height: 300, background: '#111', color: '#0f0', border: '1px solid #333', fontFamily: 'monospace', fontSize: 12, padding: 8 }}
              onClick={e => (e.target as HTMLTextAreaElement).select()}
            />
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={() => { navigator.clipboard.writeText(exportCode); alert('Copied!'); }} style={btnStyle}>📋 Copy</button>
              <button onClick={() => setShowExport(false)} style={btnStyle}>❌ Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 };
const dialogStyle: React.CSSProperties = { background: '#1a1a1a', border: '2px solid #c00', borderRadius: 6, padding: 16, maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto', minWidth: 300 };
const btnStyle: React.CSSProperties = { background: '#333', border: '1px solid #c00', color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 13, borderRadius: 4, fontFamily: 'monospace' };

// Export grid-to-level-data converter for use by the game
export function gridToLevelData(grid: CellData[][], playerPos: [number, number] | null) {
  const visited = new Set<string>();
  const walls: Array<{ x: number; z: number; w: number; d: number; isDoor: boolean }> = [];

  for (let z = 0; z < GRID_H; z++) {
    for (let x = 0; x < GRID_W; x++) {
      const key = `${x},${z}`;
      if (visited.has(key)) continue;
      const cell = getCell(grid, x, z);
      if (cell.type !== 'wall' && cell.type !== 'door') continue;

      let maxX = x;
      while (maxX + 1 < GRID_W && getCell(grid, maxX + 1, z).type === cell.type) maxX++;

      let maxZ = z;
      let canExtend = true;
      while (canExtend && maxZ + 1 < GRID_H) {
        for (let cx = x; cx <= maxX; cx++) {
          if (getCell(grid, cx, maxZ + 1).type !== cell.type) {
            canExtend = false;
            break;
          }
        }
        if (canExtend) maxZ++;
      }

      const w = maxX - x + 1;
      const d = maxZ - z + 1;
      walls.push({ x, z, w, d, isDoor: cell.type === 'door' });

      for (let vz = z; vz <= maxZ; vz++) {
        for (let vx = x; vx <= maxX; vx++) {
          visited.add(`${vx},${vz}`);
        }
      }
    }
  }

  const enemies: Array<{ id: number; x: number; z: number; type: string }> = [];
  const pickups: Array<{ id: number; x: number; z: number; type: string }> = [];
  let enemyId = 0;
  let pickupId = 1;

  for (let z = 0; z < GRID_H; z++) {
    for (let x = 0; x < GRID_W; x++) {
      const cell = getCell(grid, x, z);
      if ((ENTITY_TYPES as readonly string[]).includes(cell.type)) {
        enemies.push({ id: enemyId++, x, z, type: cell.type });
      } else if ((PICKUP_TYPES as readonly string[]).includes(cell.type)) {
        pickups.push({ id: pickupId++, x, z, type: cell.type });
      }
    }
  }

  return {
    walls,
    enemies,
    pickups,
    playerStart: playerPos ? [playerPos[0], playerPos[1]] as [number, number] : [2, 2] as [number, number],
  };
}
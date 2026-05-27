import { useState, useRef, useCallback, useEffect } from 'react';

type CellType = 'empty' | 'wall' | 'door' | 'player' | 'imp' | 'demon' | 'zombieman' | 'health' | 'ammo' | 'shotgun';
type DrawMode = 'paint' | 'line' | 'rect' | 'hollowRect';

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
  const grid = Array.from({ length: GRID_H }, (_, z) =>
    Array.from({ length: GRID_W }, (_, x): CellData => 
      (z === 0 || z === GRID_H - 1 || x === 0 || x === GRID_W - 1) ? { type: 'wall' } : { type: 'empty' }
    )
  );
  return grid;
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
  const [undoStack, setUndoStack] = useState<CellData[][][]>([]);
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
  const [saveValidation, setSaveValidation] = useState<{ errors: string[]; warnings: string[] } | null>(null);
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
    pushUndo();
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

  const pushUndo = useCallback(() => {
    setGrid(current => {
      setUndoStack(stack => [...stack.slice(-49), cloneGrid(current)]);
      return current;
    });
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack(stack => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1]!;
      setGrid(prev);
      return stack.slice(0, -1);
    });
  }, []);

  // Undo keyboard shortcut (Ctrl+Z)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo]);


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
    // Clamp to grid edges so dragging outside canvas still works
    const cx = Math.max(0, Math.min(GRID_W - 1, gx));
    const cz = Math.max(0, Math.min(GRID_H - 1, gz));
    return [cx, cz];
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getGridPos(e);
    if (!pos) return;

    if (drawMode === 'paint') {
      pushUndo();
      setIsDragging(true);
      paintCell(pos[0], pos[1]);
    } else if (drawMode === 'line') {
      pushUndo();
      setLineStart(pos);
      setPreviewCells([[pos[0], pos[1]]]);
    } else if (drawMode === 'rect' || drawMode === 'hollowRect') {
      pushUndo();
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
    } else if ((drawMode === 'rect' || drawMode === 'hollowRect') && rectStart) {
      const pos = getGridPos(e);
      if (pos) {
        const cells: [number, number][] = [];
        const x1 = Math.min(rectStart[0], pos[0]);
        const x2 = Math.max(rectStart[0], pos[0]);
        const z1 = Math.min(rectStart[1], pos[1]);
        const z2 = Math.max(rectStart[1], pos[1]);
        if (drawMode === 'hollowRect') {
          // Only border cells
          for (let z = z1; z <= z2; z++) {
            for (let x = x1; x <= x2; x++) {
              if (z === z1 || z === z2 || x === x1 || x === x2) cells.push([x, z]);
            }
          }
        } else {
          for (let z = z1; z <= z2; z++) {
            for (let x = x1; x <= x2; x++) {
              cells.push([x, z]);
            }
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

    // Don't finalize on mouseLeave — just keep the preview so user can come back
    if (e.type === 'mouseleave') return;
    const pos = getGridPos(e as React.MouseEvent | React.TouchEvent);

    if (drawMode === 'line' && lineStart) {
      const end = pos || lineStart;
      const cells = bresenhamLine(lineStart[0], lineStart[1], end[0], end[1]);
      paintCells(cells, tool);
      setLineStart(null);
      setPreviewCells([]);
    } else if ((drawMode === 'rect' || drawMode === 'hollowRect') && rectStart) {
      const end = pos || rectStart;
      const cells: [number, number][] = [];
      const x1 = Math.min(rectStart[0], end[0]);
      const x2 = Math.max(rectStart[0], end[0]);
      const z1 = Math.min(rectStart[1], end[1]);
      const z2 = Math.max(rectStart[1], end[1]);
      if (drawMode === 'hollowRect') {
        for (let z = z1; z <= z2; z++) {
          for (let x = x1; x <= x2; x++) {
            if (z === z1 || z === z2 || x === x1 || x === x2) cells.push([x, z]);
          }
        }
      } else {
        for (let z = z1; z <= z2; z++) {
          for (let x = x1; x <= x2; x++) {
            cells.push([x, z]);
          }
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
    const ld = gridToLevelData(grid, playerPos);
    localStorage.setItem('doom-leveldata-__playing__', JSON.stringify(ld));
    // Also save grid data for the editor to restore
    saveMapToStorage('__playing__', grid, playerPos);
    // Navigate to game — use hash without reload so React picks it up
    window.location.hash = '';
  };

  const runValidation = (): { errors: string[]; warnings: string[] } => {
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

    if (playerPos && visited) {
      setReachableCells(visited);
    }
    return { errors, warnings };
  };

  const validate = () => {
    const result = runValidation();
    const all = [...result.errors, ...result.warnings];
    if (all.length === 0) {
      alert('✅ Level looks good! All checks passed:\n• Player start exists\n• All enemies/pickups reachable\n• No stuck enemies\n• No 1-wide passages with entities\n• All doors have open access');
    } else {
      alert(result.errors.length > 0
        ? `Found ${result.errors.length} error(s) and ${result.warnings.length} warning(s):\n\n${all.join('\n')}`
        : `${result.warnings.length} warning(s):\n\n${all.join('\n')}`);
    }
  };

  const drawModeLabels: Record<DrawMode, string> = { paint: '🖌️ Paint', line: '📏 Line', rect: '⬜ Rect', hollowRect: '🔲 Hollow' };

  return (
    <div style={{ background: '#111', color: '#fff', fontFamily: 'monospace', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative', width: '100%', justifyContent: 'center' }}><h1 style={{ color: '#c00', margin: '8px 0' }}>🏴‍☠️ DOOM LEVEL EDITOR</h1>
        <button onClick={() => { window.location.hash = String(); }} style={{ position: "absolute", top: 4, right: 0, color: "#c00", fontSize: 20, background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }} title="Exit to menu">✕</button>
      </div>

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
        <button onClick={handleUndo} disabled={undoStack.length === 0} style={{ ...btnStyle, opacity: undoStack.length === 0 ? 0.3 : 1 }}>↩️ Undo</button>
        <button onClick={validate} style={btnStyle}>✅ Validate</button>
        <button onClick={() => setReachableCells(null)} style={btnStyle}>🔄 Clear overlay</button>
        <button onClick={() => {
          const result = runValidation();
          setSaveValidation(result);
          if (result.errors.length === 0) {
            setSavedMaps(listSavedMaps());
            setShowSaveDialog(true);
          } else {
            setShowSaveDialog(true); // show dialog with errors
          }
        }} style={btnStyle}>💾 Save</button>
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
            {saveValidation && saveValidation.errors.length === 0 ? (
              <h3 style={{ color: '#0f0', marginTop: 0 }}>✅ Map Validated!</h3>
            ) : (
              <h3 style={{ color: '#f00', marginTop: 0 }}>⚠️ Validation Issues</h3>
            )}
            {saveValidation && saveValidation.errors.length > 0 && (
              <div style={{ maxHeight: 120, overflowY: 'auto', fontSize: 12, color: '#f88', marginBottom: 8 }}>
                {saveValidation.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            {saveValidation && saveValidation.warnings.length > 0 && (
              <div style={{ maxHeight: 80, overflowY: 'auto', fontSize: 12, color: '#ff0', marginBottom: 8 }}>
                {saveValidation.warnings.map((w, i) => <div key={i}>{w}</div>)}
              </div>
            )}
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
              <button onClick={() => { setShowSaveDialog(false); setSaveName(''); setSaveValidation(null); }} style={btnStyle}>❌ Cancel</button>
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
const btnStyle: React.CSSProperties = { background: '#444', border: '1px solid #c00', color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 13, borderRadius: 4, fontFamily: 'monospace' };

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
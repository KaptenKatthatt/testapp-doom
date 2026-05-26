import { useState, useRef, useCallback, useEffect } from 'react';

type CellType = 'empty' | 'wall' | 'door' | 'player' | 'imp' | 'demon' | 'zombieman' | 'health' | 'ammo' | 'shotgun';

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
  if (x < 0 || x >= GRID_W || z < 0 || z >= GRID_H) return { type: 'empty' };
  return grid[z]![x]!;
}

export default function Editor() {
  const [grid, setGrid] = useState<CellData[][]>(makeGrid);
  const [tool, setTool] = useState<CellType>('wall');
  const [isDragging, setIsDragging] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportCode, setExportCode] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerPos, setPlayerPos] = useState<[number, number] | null>(null);

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
  }, [grid]);

  useEffect(() => { draw(); }, [draw]);

  const paintCell = useCallback((x: number, z: number) => {
    if (x < 0 || x >= GRID_W || z < 0 || z >= GRID_H) return;
    setGrid(prev => {
      const next = prev.map(row => row.map(c => ({ ...c })));
      if (tool === 'player') {
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
      if (cell) cell.type = tool;
      return next;
    });
  }, [tool]);

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
    const x = Math.floor((clientX - rect.left) * scaleX / CELL_SIZE);
    const z = Math.floor((clientY - rect.top) * scaleY / CELL_SIZE);
    if (x < 0 || x >= GRID_W || z < 0 || z >= GRID_H) return null;
    return [x, z];
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const pos = getGridPos(e);
    if (pos) paintCell(pos[0], pos[1]);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const pos = getGridPos(e);
    if (pos) paintCell(pos[0], pos[1]);
  };

  const handlePointerUp = () => { setIsDragging(false); };

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

    let code = `// Generated by Doom Level Editor\n`;
    code += `const WALL_DATA = [\n`;
    for (const w of walls) {
      code += `  { x: ${w.x}, y: 2, z: ${w.z}, w: ${w.w}, h: 4, d: ${w.d}, color: ${w.color} },\n`;
    }
    code += `];\n\n`;

    code += `// Enemies (copy to Game.tsx INITIAL_ENEMIES)\n`;
    for (const e of enemies) {
      const hp = e.type === 'imp' ? 45 : e.type === 'demon' ? 80 : 35;
      code += `{ id: ${e.id}, position: [${e.x}, 0, ${e.z}], type: "${e.type}", health: ${hp}, maxHealth: ${hp}, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [${e.x}, 0, ${e.z}] as [number, number, number], hasAlerted: false },\n`;
    }
    code += `\n`;

    code += `// Pickups (copy to Game.tsx INITIAL_PICKUPS)\n`;
    for (const p of pickups) {
      code += `{ id: ${p.id}, position: [${p.x}, 0.3, ${p.z}], type: "${p.type}", active: true },\n`;
    }
    code += `\n`;

    if (playerPos) {
      code += `// Player start (copy to Game.tsx camera position)\n`;
      code += `position: new THREE.Vector3(${playerPos[0]}, 1.7, ${playerPos[1]}),\n`;
    }

    setExportCode(code);
    setShowExport(true);
  };

  const clearGrid = () => { setGrid(makeGrid()); setPlayerPos(null); };

  const validate = () => {
    const errors: string[] = [];
    if (!playerPos) errors.push('❌ No player start position');

    let hasEnemy = false;
    for (let z = 0; z < GRID_H && !hasEnemy; z++) {
      for (let x = 0; x < GRID_W && !hasEnemy; x++) {
        if ((ENTITY_TYPES as readonly string[]).includes(getCell(grid, x, z).type)) hasEnemy = true;
      }
    }
    if (!hasEnemy) errors.push('❌ No enemies placed');

    for (let z = 0; z < GRID_H; z++) {
      for (let x = 0; x < GRID_W; x++) {
        const t = getCell(grid, x, z).type;
        if ((ENTITY_TYPES as readonly string[]).includes(t)) {
          let wc = 0;
          if (getCell(grid, x, z-1).type === 'wall') wc++;
          if (getCell(grid, x, z+1).type === 'wall') wc++;
          if (getCell(grid, x-1, z).type === 'wall') wc++;
          if (getCell(grid, x+1, z).type === 'wall') wc++;
          if (wc >= 3) errors.push(`⚠️ ${t} at (${x},${z}) may be stuck in walls`);
        }
      }
    }

    alert(errors.length === 0 ? '✅ Level looks good!' : errors.join('\n'));
  };

  return (
    <div style={{ background: '#111', color: '#fff', fontFamily: 'monospace', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 10 }}>
      <h1 style={{ color: '#c00', margin: '8px 0' }}>🏴‍☠️ DOOM LEVEL EDITOR</h1>

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

      <canvas ref={canvasRef} width={GRID_W * CELL_SIZE} height={GRID_H * CELL_SIZE}
        onMouseDown={handlePointerDown} onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}
        style={{ border: '2px solid #c00', cursor: 'crosshair', touchAction: 'none', maxWidth: '95vw', maxHeight: '60vh' }}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={validate} style={btnStyle}>✅ Validate</button>
        <button onClick={exportLevel} style={btnStyle}>📋 Export</button>
        <button onClick={clearGrid} style={btnStyle}>🗑️ Clear</button>
        <a href="/" style={{ ...btnStyle, textDecoration: 'none' }}>🎮 Play</a>
      </div>

      <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
        Tool: <span style={{ color: CELL_COLORS[tool] }}>{CELL_LABELS[tool]}</span> | Grid: {GRID_W}×{GRID_H}
      </div>

      {showExport && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#1a1a1a', border: '2px solid #c00', borderRadius: 6, padding: 16, maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto' }}>
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

const btnStyle: React.CSSProperties = { background: '#333', border: '1px solid #c00', color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 13, borderRadius: 4, fontFamily: 'monospace' };
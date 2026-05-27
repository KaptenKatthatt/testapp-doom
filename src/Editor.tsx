import { useState, useRef, useCallback, useEffect } from 'react';
import { PRESETS, PresetMap } from './EditorPresets';
import {
  CellType,
  DrawMode,
  CellData,
  CELL_SIZE,
  GRID_W,
  GRID_H,
  CELL_COLORS,
  CELL_LABELS,
  TRACK_OPTIONS,
  TrackStyle as TrackStyleType,
} from './EditorTypes';
import {
  saveMapToStorage,
  loadMapFromStorage,
  listSavedMaps,
  deleteMapFromStorage,
  autosave,
  loadAutosave,
} from './StorageHelpers';
import { MusicEngine } from './MusicEngine';
import { MenuSynth } from './MenuSynth';
import { runValidation } from './EditorValidation';
import { gridToLevelData, buildExportCode } from './EditorExport';
import { SaveModal, LoadModal, ExportModal } from './EditorModals';

export { gridToLevelData }; // Re-export for compatibility
export type { CellType, DrawMode, CellData }; // Re-export for any external files

export function makeGrid(): CellData[][] {
  const grid = Array.from({ length: GRID_H }, (_, z) =>
    Array.from({ length: GRID_W }, (_, x): CellData => 
      (z === 0 || z === GRID_H - 1 || x === 0 || x === GRID_W - 1) ? { type: 'wall' } : { type: 'empty' }
    )
  );
  return grid;
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
  const [musicTrack, setMusicTrack] = useState<TrackStyleType>('inferno');
  const [musicPlaying, setMusicPlaying] = useState(false);
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

  // Check for autosave on mount — restore silently if available
  useEffect(() => {
    const autoData = loadAutosave();
    if (autoData) {
      const hasContent = autoData.grid.some(row => row.some(c => c.type !== 'empty'));
      if (hasContent) {
        setGrid(autoData.grid);
        setPlayerPos(autoData.playerPos);
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
    const code = buildExportCode(grid, playerPos);
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
    const isValid = saveValidation ? saveValidation.errors.length === 0 : false;
    saveMapToStorage(name, grid, playerPos, isValid, musicTrack);
    setShowSaveDialog(false);
    setSaveName('');
  };

  const handleLoad = () => {
    setSavedMaps(listSavedMaps());
    setShowLoadDialog(true);
  };

  const handleLoadMap = (name: string, track?: TrackStyleType) => {
    const data = loadMapFromStorage(name);
    if (data) {
      updateGrid(data.grid, data.playerPos);
      if (track) setMusicTrack(track);
      else if (data.musicTrack) setMusicTrack(data.musicTrack);
      setShowLoadDialog(false);
    }
  };

  const handleDeleteMap = (name: string) => {
    if (confirm(`Delete map "${name}"?`)) {
      deleteMapFromStorage(name);
      setSavedMaps(listSavedMaps());
    }
  };

  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicEngineRef = useRef<MusicEngine | null>(null);
  const menuSynthRef = useRef<MenuSynth | null>(null);

  const stopMusicPreview = () => {
    if (musicEngineRef.current) musicEngineRef.current.stop();
    if (menuSynthRef.current) menuSynthRef.current.stop();
  };

  const toggleMusicPreview = () => {
    if (musicPlaying) {
      // Stop
      stopMusicPreview();
      setMusicPlaying(false);
    } else {
      // Play
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      gain.connect(ctx.destination);
      stopMusicPreview();
      if (musicTrack === 'classic') {
        const synth = new MenuSynth();
        synth.start(ctx, gain);
        menuSynthRef.current = synth;
        musicEngineRef.current = null;
      } else {
        const engine = new MusicEngine();
        engine.start(ctx, gain, musicTrack);
        musicEngineRef.current = engine;
        menuSynthRef.current = null;
      }
      setMusicPlaying(true);
    }
  };

  // Restart preview when track changes
  useEffect(() => {
    if (musicPlaying && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      gain.connect(ctx.destination);
      stopMusicPreview();
      if (musicTrack === 'classic') {
        const synth = new MenuSynth();
        synth.start(ctx, gain);
        menuSynthRef.current = synth;
        musicEngineRef.current = null;
      } else {
        const engine = new MusicEngine();
        engine.start(ctx, gain, musicTrack);
        musicEngineRef.current = engine;
        menuSynthRef.current = null;
      }
    }
    return () => {
      stopMusicPreview();
    };
  }, [musicTrack]);

  const handlePlayMap = () => {
    // Save current map and level data so the game can load it
    const ld = gridToLevelData(grid, playerPos, musicTrack);
    localStorage.setItem('doom-leveldata-__playing__', JSON.stringify(ld));
    // Also save grid data for the editor to restore
    saveMapToStorage('__playing__', grid, playerPos, false, musicTrack);
    // Navigate to game — use hash without reload so React picks it up
    window.location.hash = '';
  };

  const validate = () => {
    const result = runValidation(grid, playerPos);
    if (result.reachableCells) {
      setReachableCells(result.reachableCells);
    }
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
          const result = runValidation(grid, playerPos);
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
      <div style={{ display: 'flex', gap: 4, marginTop: 8, justifyContent: 'center', alignItems: 'center' }}>
        <span style={{ color: '#aaa', fontFamily: 'monospace', fontSize: 13 }}>🎵 Music:</span>
        {TRACK_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setMusicTrack(opt.value)}
            style={{
              ...btnStyle,
              background: musicTrack === opt.value ? '#600' : '#333',
              border: musicTrack === opt.value ? '2px solid #f00' : '1px solid #c00',
              fontSize: 11,
              padding: '4px 8px',
            }}
          >
            {opt.emoji} {opt.label}
          </button>
        ))}
        <button
          onClick={toggleMusicPreview}
          style={{
            ...btnStyle,
            background: musicPlaying ? '#050' : '#333',
            border: musicPlaying ? '2px solid #0f0' : '1px solid #c00',
            fontSize: 13,
            padding: '4px 10px',
          }}
        >
          {musicPlaying ? '⏸' : '▶'}
        </button>
      </div>

      <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
        Mode: <span style={{ color: '#ff0' }}>{drawModeLabels[drawMode]}</span> | Tool: <span style={{ color: CELL_COLORS[tool] }}>{CELL_LABELS[tool]}</span> | Grid: {GRID_W}×{GRID_H}
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <SaveModal
          saveValidation={saveValidation}
          saveName={saveName}
          setSaveName={setSaveName}
          onSave={handleSave}
          onCancel={() => {
            setShowSaveDialog(false);
            setSaveName('');
            setSaveValidation(null);
          }}
        />
      )}

      {/* Load dialog */}
      {showLoadDialog && (
        <LoadModal
          savedMaps={savedMaps}
          onLoadMap={handleLoadMap}
          onDeleteMap={handleDeleteMap}
          onClose={() => setShowLoadDialog(false)}
        />
      )}

      {/* Export dialog */}
      {showExport && (
        <ExportModal
          exportCode={exportCode}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = { background: '#444', border: '1px solid #c00', color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 13, borderRadius: 4, fontFamily: 'monospace' };

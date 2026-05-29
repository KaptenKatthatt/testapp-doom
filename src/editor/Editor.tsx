import { useState, useRef, useCallback, useEffect, useMemo, type JSX } from 'react';
import type { PresetMap } from './EditorPresets';
import { FALLBACK_PRESETS } from './EditorPresets';
import type {
  CellType,
  DrawMode,
  CellData,
  TrackStyle as TrackStyleType,
} from './EditorTypes';
import {
  CELL_SIZE,
  GRID_W,
  GRID_H,
  CELL_COLORS,
  CELL_LABELS,
  CELL_CATEGORIES,
  LIMITS,
  TRACK_OPTIONS,
} from './EditorTypes';
import type {
  SavedMapListItem} from '@/shared/storage/StorageHelpers';
import {
  saveMapToStorage,
  loadMapFromStorage,
  listSavedMaps,
  deleteMapFromStorage,
  autosave,
  loadAutosave,
  submitMapForApproval,
  listPendingMaps,
  reviewMap
} from '@/shared/storage/StorageHelpers';
import { MusicEngine } from '@/shared/audio/MusicEngine';
import { audioManager } from '@/shared/audio/Audio';
import { runValidation } from './EditorValidation';
import { gridToLevelData, buildExportCode } from './EditorExport';
import { SaveModal, LoadModal, ExportModal } from './EditorModals';

import { auth } from '@/shared/storage/firebase';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { loadPresetsFromCloud, savePresetToCloud, lazyMigratePresets } from '@/shared/storage/PresetStorage';
import AuthModal from './AuthModal';

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
function bresenhamLine(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
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


export default function Editor(): JSX.Element {
  const [grid, setGrid] = useState<CellData[][]>(makeGrid);
  const [undoStack, setUndoStack] = useState<CellData[][][]>([]);
  const [tool, setTool] = useState<CellType>('wall');
  const [drawMode, setDrawMode] = useState<DrawMode>('paint');
  const [isDragging, setIsDragging] = useState(false);
  const [lineStart, setLineStart] = useState<[number, number] | null>(null);
  const [rectStart, setRectStart] = useState<[number, number] | null>(null);
  const [previewCells, setPreviewCells] = useState<Array<[number, number]>>([]);
  const [showExport, setShowExport] = useState(false);
  const [reachableCells, setReachableCells] = useState<Set<string> | null>(null);
  const [exportCode, setExportCode] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveValidation, setSaveValidation] = useState<{ errors: string[]; warnings: string[] } | null>(null);
  const [musicTrack, setMusicTrack] = useState<TrackStyleType>('inferno');
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [saveName, setSaveName] = useState('');

  // Auth and Preset Storage additions
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [presets, setPresets] = useState<PresetMap[]>(FALLBACK_PRESETS);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [pendingMaps, setPendingMaps] = useState<SavedMapListItem[]>([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Count entities on the grid
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const row of grid) {
      for (const cell of row) {
        c[cell.type] = (c[cell.type] ?? 0) + 1;
      }
    }
    return c;
  }, [grid]);
  const [savedMaps, setSavedMaps] = useState<SavedMapListItem[]>([]);
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

  // Subscribe to Firebase Auth and set up admin features
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser?.email === 'jonas.olson@gmail.com') {
        // Lazy migrate presets on admin login
        void lazyMigratePresets();
        // Load pending reviews
        void listPendingMaps().then(setPendingMaps);
      }
    });
    return unsubscribe;
  }, []);

  // Fetch presets from cloud on mount
  useEffect(() => {
    setPresetsLoading(true);
    loadPresetsFromCloud().then((loaded) => {
      if (loaded && loaded.length > 0) {
        setPresets(loaded);
      } else {
        setPresets(FALLBACK_PRESETS);
      }
      setPresetsLoading(false);
    }).catch((err: unknown) => {
      console.error(err);
      setPresetsLoading(false);
    });
  }, []);

  // Check for autosave on mount — restore silently if available
  useEffect(() => {
    // Check if E1M1 should be loaded (flag set by main menu button)
    const loadE1m1 = localStorage.getItem('doom-load-e1m1');
    const loadMapName = localStorage.getItem('doom-load-map');
    if (loadE1m1) {
      localStorage.removeItem('doom-load-e1m1');
      const e1m1 = presets.find(p => p.id === 'e1m1') ?? FALLBACK_PRESETS.find(p => p.id === 'e1m1');
      if (e1m1) {
        setGrid(cloneGrid(e1m1.grid));
        setPlayerPos(e1m1.playerPos);
        setSelectedPresetId('e1m1');
      }
    } else if (loadMapName) {
      localStorage.removeItem('doom-load-map');
      loadMapFromStorage(loadMapName).then(data => {
        if (data) {
          setGrid(data.grid);
          setPlayerPos(data.playerPos);
          if (data.musicTrack) setMusicTrack(data.musicTrack);
        }
      });
    } else {
      const autoData = loadAutosave();
      if (autoData) {
        const hasContent = autoData.grid.some(row => row.some(c => c.type !== 'empty'));
        if (hasContent) {
          setGrid(autoData.grid);
          setPlayerPos(autoData.playerPos);
        }
      }
    }
  }, [presets]);

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
      const prev = stack.at(-1);
      if (!prev) return stack;
      setGrid(prev);
      return stack.slice(0, -1);
    });
  }, []);

  // Undo keyboard shortcut (Ctrl+Z)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo]);


  const paintCells = useCallback((cells: Array<[number, number]>, cellType: CellType) => {
    // Check limits before painting
    if (cellType !== 'empty' && cellType !== 'wall' && cellType !== 'lava' && cellType !== 'slime') {
      const currentCount = grid.flat().filter(c => c.type === cellType).length;
      const limit = LIMITS[cellType] ?? 999;
      // Allow painting over same type (replacing)
      const cellsWithSameType = cells.filter(([x, z]) => grid[z]?.[x]?.type === cellType).length;
      if (currentCount + cells.length - cellsWithSameType > limit) return; // silently block
    }
    setGrid(prev => {
      const next = cloneGrid(prev);
      for (const [x, z] of cells) {
        if (x < 0 || x >= GRID_W || z < 0 || z >= GRID_H) continue;
        if (cellType === 'player') {
          // Remove existing player
          for (let rz = 0; rz < GRID_H; rz++) {
            for (let rx = 0; rx < GRID_W; rx++) {
              const playerCell = next[rz]?.[rx];
              if (playerCell?.type === 'player') {
                playerCell.type = 'empty';
              }
            }
          }
          setPlayerPos([x, z]);
        }
        const cell = next[z]?.[x];
        if (cell) cell.type = cellType;
      }
      const firstCell = cells[0];
      scheduleAutosave(next, cellType === 'player' && firstCell ? [firstCell[0], firstCell[1]] : playerPos);
      return next;
    });
    setReachableCells(null);
  }, [playerPos, scheduleAutosave, grid]);

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
      const touch = e.touches[0];
      if (!touch) return null;
      clientX = touch.clientX;
      clientY = touch.clientY;
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

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent): void => {
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

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent): void => {
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
        const cells: Array<[number, number]> = [];
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

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent): void => {
    if (drawMode === 'paint') {
      setIsDragging(false);
      return;
    }

    // Don't finalize on mouseLeave — just keep the preview so user can come back
    if (e.type === 'mouseleave') return;
    const pos = getGridPos(e as React.MouseEvent | React.TouchEvent);

    if (drawMode === 'line' && lineStart) {
      const end = pos ?? lineStart;
      const cells = bresenhamLine(lineStart[0], lineStart[1], end[0], end[1]);
      paintCells(cells, tool);
      setLineStart(null);
      setPreviewCells([]);
    } else if ((drawMode === 'rect' || drawMode === 'hollowRect') && rectStart) {
      const end = pos ?? rectStart;
      const cells: Array<[number, number]> = [];
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

  const exportLevel = (): void => {
    const code = buildExportCode(grid, playerPos);
    setExportCode(code);
    setShowExport(true);
  };

  const clearGrid = (): void => {
    if (confirm('Clear the entire map?')) {
      updateGrid(makeGrid(), null);
    }
  };

  const loadPreset = (preset: PresetMap): void => {
    updateGrid(cloneGrid(preset.grid), preset.playerPos);
    setSelectedPresetId(preset.id);
    if (preset.musicTrack) setMusicTrack(preset.musicTrack);
  };

  const handleSave = async (): Promise<void> => {
    const name = saveName.trim();
    if (!name) return;
    const isValid = saveValidation ? saveValidation.errors.length === 0 : false;
    await saveMapToStorage(name, grid, playerPos, isValid, musicTrack, 'draft');
    setShowSaveDialog(false);
    setSaveName('');
  };

  const handleSubmitForApproval = async (): Promise<void> => {
    const name = saveName.trim();
    if (!name) {
      alert("Please enter a map name first");
      return;
    }
    try {
      await submitMapForApproval(name);
      alert(`✅ Map "${name}" has been submitted successfully for publishing! Status is now pending review.`);
      setShowSaveDialog(false);
      setSaveName('');
    } catch (err: unknown) {
      const errorObject = err as Error;
      alert(`❌ Failed to submit map: ${errorObject.message ?? String(err)}`);
    }
  };

  const handleSavePreset = async (): Promise<void> => {
    if (!selectedPresetId) return;
    const preset = presets.find(p => p.id === selectedPresetId) ?? FALLBACK_PRESETS.find(p => p.id === selectedPresetId);
    if (!preset) return;

    if (confirm(`Are you sure you want to permanently update the official preset "${preset.name}" for ALL players?`)) {
      try {
        const updatedPreset = {
          id: selectedPresetId,
          name: preset.name,
          description: preset.description,
          grid: grid,
          playerPos: playerPos ?? [2, 3],
          musicTrack: musicTrack,
        };
        await savePresetToCloud(updatedPreset, user?.uid);
        alert(`✅ Preset "${preset.name}" has been updated successfully in the cloud database!`);
        
        // Reload presets list
        const loaded = await loadPresetsFromCloud();
        if (loaded) setPresets(loaded);
      } catch (err: unknown) {
        const errorObject = err as Error;
        alert(`❌ Failed to save preset to cloud: ${errorObject.message ?? String(err)}`);
      }
    }
  };

  const handleReviewMap = async (mapName: string, action: 'approved' | 'rejected', notes?: string): Promise<void> => {
    try {
      await reviewMap(mapName, action, notes);
      alert(`✅ Map "${mapName}" reviewed successfully: ${action.toUpperCase()}`);
      
      // Reload pending reviews list
      const pending = await listPendingMaps();
      setPendingMaps(pending);
    } catch (err: unknown) {
      const errorObject = err as Error;
      alert(`❌ Failed to review map: ${errorObject.message ?? String(err)}`);
    }
  };

  const handleLoad = async (): Promise<void> => {
    const maps = await listSavedMaps();
    setSavedMaps(maps);
    setShowLoadDialog(true);
  };

  const handleLoadMap = async (name: string, track?: TrackStyleType): Promise<void> => {
    const data = await loadMapFromStorage(name);
    if (data) {
      updateGrid(data.grid, data.playerPos);
      if (track) setMusicTrack(track);
      else if (data.musicTrack) setMusicTrack(data.musicTrack);
      setShowLoadDialog(false);
    }
  };

  const handleDeleteMap = async (name: string): Promise<void> => {
    if (confirm(`Delete map "${name}"?`)) {
      await deleteMapFromStorage(name);
      const maps = await listSavedMaps();
      setSavedMaps(maps);
    }
  };

  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicEngineRef = useRef<MusicEngine | null>(null);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const stopMusicPreview = (): void => {
    if (musicEngineRef.current) musicEngineRef.current.stop();
    if (musicSourceRef.current) {
      try { musicSourceRef.current.stop(); } catch { /* already stopped */ }
      musicSourceRef.current = null;
    }
  };

  const toggleMusicPreview = async (): Promise<void> => {
    if (musicPlaying) {
      // Stop
      stopMusicPreview();
      setMusicPlaying(false);
    } else {
      // Stop menu music first
      audioManager.stopMenuMusic();
      // Play
      audioCtxRef.current ??= new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      gain.connect(ctx.destination);
      stopMusicPreview();

      // Try OGG file first, fall back to procedural
      const trackFile = musicTrack === 'classic' ? 'e1m1' : musicTrack;
      try {
        const response = await fetch(`/audio/${trackFile}.ogg`);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await ctx.decodeAudioData(arrayBuffer);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.connect(gain);
          source.start(0);
          musicSourceRef.current = source;
          musicEngineRef.current = null;
          setMusicPlaying(true);
          return;
        }
      } catch { /* fall back to procedural */ }

      // Fallback to procedural synth
      const engine = new MusicEngine();
      engine.start(ctx, gain, musicTrack);
      musicEngineRef.current = engine;
      musicSourceRef.current = null;
      setMusicPlaying(true);
    }
  };

  // Restart preview when track changes
  useEffect(() => {
    if (musicPlaying && audioCtxRef.current) {
      // Stop current and re-trigger toggle
      stopMusicPreview();
      setMusicPlaying(false);
    }
    return () => {
      stopMusicPreview();
    };
  }, [musicTrack]);

  const handlePlayMap = async (): Promise<void> => {
    // Save current map and level data so the game can load it
    const ld = gridToLevelData(grid, playerPos, musicTrack);
    localStorage.setItem('doom-leveldata-__playing__', JSON.stringify(ld));
    // Also save grid data for the editor to restore
    await saveMapToStorage('__playing__', grid, playerPos, false, musicTrack);
    // Navigate to game — use hash without reload so React picks it up
    window.location.hash = '';
  };

  const validate = (): void => {
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
    <div className="editor" style={{ background: '#111', color: '#fff', fontFamily: 'monospace', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 10 }}>
      {/* UAC Auth & Database Control Bar */}
      <div style={{ display: 'flex', width: '100%', maxWidth: '800px', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '8px 16px', background: 'rgba(20, 10, 10, 0.6)', border: '2px solid #311', borderRadius: 4, fontSize: 12, boxShadow: '0 0 15px rgba(255, 0, 0, 0.1)' }}>
        <div>
          {user ? (
            <span>Welcome, <strong style={{ color: '#ffcc00' }}>{user.displayName ?? user.email}</strong> {user.email === 'jonas.olson@gmail.com' && <span style={{ color: '#ff3333', background: '#330000', padding: '2px 6px', borderRadius: 3, border: '1px solid #f33', fontSize: 10, marginLeft: 6, fontWeight: 'bold' }}>ADMIN</span>}</span>
          ) : (
            <span style={{ color: '#888' }}>Offline/Local mode active. Login to submit maps or publish.</span>
          )}
        </div>
        <div>
          {user ? (
            <div style={{ display: 'flex', gap: 8 }}>
              {user.email === 'jonas.olson@gmail.com' && (
                <button onClick={() => { setShowAdminPanel(!showAdminPanel); }} style={{ ...btnStyle, background: showAdminPanel ? '#c00' : '#444', border: '1px solid #f66', padding: '3px 8px', fontSize: 11 }}>
                  🛡️ {showAdminPanel ? 'Close Reviews' : 'Pending Reviews'} ({pendingMaps.length})
                </button>
              )}
              <button onClick={() => { if (confirm('Log out?') && auth) signOut(auth); }} style={{ ...btnStyle, padding: '3px 8px', fontSize: 11 }}>Log Out</button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} style={{ ...btnStyle, background: '#c00', border: '1px solid #f66', padding: '4px 12px', fontSize: 11, fontWeight: 'bold' }}>🔑 LOG IN / SIGN UP</button>
          )}
        </div>
      </div>

      {/* Admin Review Panel */}
      {showAdminPanel && user?.email === 'jonas.olson@gmail.com' && (
        <div style={{ width: '100%', maxWidth: '800px', background: '#1c0d0d', border: '2px solid #c00', borderRadius: 6, padding: 16, marginBottom: 12, boxSizing: 'border-box' }}>
          <h3 style={{ color: '#ff4444', marginTop: 0, borderBottom: '1px solid #c00', paddingBottom: 6 }}>🛡️ Admin Review Panel — Pending Maps ({pendingMaps.length})</h3>
          {pendingMaps.length === 0 ? (
            <p style={{ color: '#888', fontSize: 12 }}>No pending maps in review queue.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '200px', overflowY: 'auto' }}>
              {pendingMaps.map(m => (
                <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '8px 12px', borderRadius: 4, border: '1px solid #333' }}>
                  <div>
                    <strong style={{ color: '#ffcc00' }}>{m.name}</strong> <span style={{ color: '#888', fontSize: 10 }}>by {m.ownerName}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={() => handleLoadMap(m.name)} style={{ ...btnStyle, padding: '3px 6px', fontSize: 11, background: '#222', border: '1px solid #888' }}>🔍 Load</button>
                    <button onClick={() => handleReviewMap(m.name, 'approved')} style={{ ...btnStyle, padding: '3px 6px', fontSize: 11, background: '#040', border: '1px solid #0f0', color: '#0f0' }}>👍 Approve</button>
                    <button onClick={() => {
                      const notes = prompt("Enter rejection reason:");
                      if (notes !== null) handleReviewMap(m.name, 'rejected', notes);
                    }} style={{ ...btnStyle, padding: '3px 6px', fontSize: 11, background: '#400', border: '1px solid #f33', color: '#f55' }}>👎 Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* Entity counters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, justifyContent: 'center', flexWrap: 'wrap', fontFamily: 'monospace', fontSize: 11 }}>
        {CELL_CATEGORIES.filter(cat => cat.types[0] !== 'empty').map(cat => {
          const total = cat.types.reduce((sum, t) => sum + (counts[t] ?? 0), 0);
          if (total === 0) return null;
          const overLimit = cat.types.some(t => (counts[t] ?? 0) > (LIMITS[t] ?? 999));
          return (
            <span key={cat.label} style={{ color: overLimit ? '#ff4444' : '#aaa', background: overLimit ? '#440000' : '#1a1a1a', padding: '2px 6px', borderRadius: 3, border: overLimit ? '1px solid #f44' : '1px solid #333' }}>
              {cat.label}: {total}
            </span>
          );
        })}
      </div>

      {/* Categorized tool buttons */}
      {CELL_CATEGORIES.map(cat => (
        <div key={cat.label} style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 2, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1 }}>{cat.label}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {cat.types.map(t => {
              const count = counts[t] ?? 0;
              const limit = LIMITS[t] ?? 999;
              const over = count >= limit;
              return (
                <button key={t} onClick={() => setTool(t)} style={{
                  background: tool === t ? CELL_COLORS[t] : '#333',
                  border: tool === t ? '2px solid #fff' : over ? '1px solid #f44' : '1px solid #555',
                  color: tool === t ? '#000' : over ? '#f44' : '#ccc',
                  padding: '3px 7px', cursor: over ? 'not-allowed' : 'pointer', fontSize: 11, borderRadius: 3, touchAction: 'none',
                  opacity: over && tool !== t ? 0.6 : 1,
                }}>
                  {CELL_LABELS[t]} <span style={{ fontSize: 9, color: over ? '#f44' : '#888' }}>{count}/{limit}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Preset selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#888', lineHeight: '24px' }}>Presets:</span>
        {presetsLoading ? (
          <span style={{ fontSize: 11, color: '#888' }}>Laddar presets...</span>
        ) : (
          presets.map(p => (
            <button key={p.id} onClick={() => { if (confirm(`Load "${p.name}" preset? This will replace current map.`)) loadPreset(p); }}
              title={p.description}
              style={{
                background: selectedPresetId === p.id ? '#500' : '#222',
                border: selectedPresetId === p.id ? '1px solid #ff4444' : '1px solid #555',
                color: selectedPresetId === p.id ? '#ff4444' : '#ccc',
                padding: '2px 8px', cursor: 'pointer', fontSize: 11, borderRadius: 3, fontFamily: 'monospace'
              }}>
              {p.name} {p.version ? `v${p.version}` : ''}
            </button>
          ))
        )}
        
        {/* Admin Preset Save Button */}
        {user?.email === 'jonas.olson@gmail.com' && selectedPresetId && (
          <button onClick={handleSavePreset} style={{ ...btnStyle, background: '#c00', border: '1px solid #fff', padding: '3px 8px', fontSize: 10, marginLeft: 10, fontWeight: 'bold' }}>
            💾 SAVE TO PRESET COLLECTION
          </button>
        )}
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
        <button onClick={async () => {
          const result = runValidation(grid, playerPos);
          setSaveValidation(result);
          if (result.errors.length === 0) {
            const maps = await listSavedMaps();
            setSavedMaps(maps);
            setShowSaveDialog(true);
          } else {
            setShowSaveDialog(true); // show dialog with errors
          }
        }} style={btnStyle}>💾 Save</button>
        <button onClick={handleLoad} style={btnStyle}>📂 Load</button>
        <button onClick={exportLevel} style={btnStyle}>📋 Export</button>
        <button onClick={clearGrid} style={btnStyle}>🗑️ Clear</button>
        <button onClick={async () => {
          await saveMapToStorage('__e1m1__', grid, playerPos, true, musicTrack, 'draft');
          alert('✅ Saved as E1M1! This replaces the default map when you play E1M1 from the main menu.');
        }} style={{ ...btnStyle, background: '#553300', border: '1px solid #c80' }}>🏴‍☠️ Save as E1M1</button>
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
          user={user}
          onSubmitForApproval={handleSubmitForApproval}
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

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = { background: '#444', border: '1px solid #c00', color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 13, borderRadius: 4, fontFamily: 'monospace' };

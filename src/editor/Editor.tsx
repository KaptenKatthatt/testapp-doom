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

  // Responsive layout state
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<'canvas' | 'palette' | 'config'>('canvas');

  useEffect(() => {
    setIsMobile(window.innerWidth <= 768);
    const handleResize = (): void => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  if (isMobile) {
    return (
      <div className="editor-mobile" style={{
        background: '#111',
        color: '#fff',
        fontFamily: 'monospace',
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}>
        {/* MOBILE TABS */}
        <div style={{
          display: 'flex',
          background: 'rgba(20, 10, 10, 0.95)',
          borderBottom: '2px solid #c00',
          height: 48,
          boxSizing: 'border-box',
          zIndex: 10,
        }}>
          {(['canvas', 'palette', 'config'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1,
              background: activeTab === tab ? '#300' : 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '3px solid #ff3333' : 'none',
              color: activeTab === tab ? '#fff' : '#888',
              fontSize: 12,
              fontWeight: 'bold',
              textTransform: 'uppercase',
              fontFamily: 'monospace',
              cursor: 'pointer',
              outline: 'none',
            }}>
              {tab === 'canvas' ? '🎮 Canvas' : tab === 'palette' ? '🖌️ Palette' : '⚙️ Config'}
            </button>
          ))}
        </div>

        {/* MOBILE TAB CONTENTS */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          boxSizing: 'border-box',
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          background: '#0d0d0d',
        }}>
          {activeTab === 'canvas' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
              {/* Header Title + Draw Mode */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <h3 style={{ color: '#c00', margin: 0, fontSize: 14, letterSpacing: '1px' }}>🎮 RENDER VIEWPORT</h3>
                
                {/* Exit Button */}
                <button onClick={() => { window.location.hash = String(); }} style={{ color: "#c00", fontSize: 16, background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}>✕</button>
              </div>

              {/* Draw Mode Selectors */}
              <div style={{ display: 'flex', gap: 4, width: '100%' }}>
                {(Object.keys(drawModeLabels) as DrawMode[]).map(m => (
                  <button key={m} onClick={() => { setDrawMode(m); setLineStart(null); setRectStart(null); setPreviewCells([]); }} style={{
                    flex: 1,
                    background: drawMode === m ? '#c00' : '#222',
                    border: drawMode === m ? '1px solid #fff' : '1px solid #444',
                    color: drawMode === m ? '#fff' : '#aaa',
                    padding: '6px 4px', cursor: 'pointer', fontSize: 10, borderRadius: 3, fontFamily: 'monospace',
                  }}>
                    {drawModeLabels[m].split(' ')[1] ?? drawModeLabels[m]}
                  </button>
                ))}
              </div>

              {/* Actions Row */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button onClick={handleUndo} disabled={undoStack.length === 0} style={{ ...btnStyle, flex: 1, padding: '6px 4px', fontSize: 10, opacity: undoStack.length === 0 ? 0.3 : 1 }}>↩️ Undo</button>
                <button onClick={validate} style={{ ...btnStyle, flex: 1, padding: '6px 4px', fontSize: 10 }}>✅ Valid</button>
                <button onClick={async () => {
                  const result = runValidation(grid, playerPos);
                  setSaveValidation(result);
                  const maps = await listSavedMaps();
                  setSavedMaps(maps);
                  setShowSaveDialog(true);
                }} style={{ ...btnStyle, flex: 1, padding: '6px 4px', fontSize: 10, background: '#750' }}>💾 Save</button>
                <button onClick={handlePlayMap} style={{ ...btnStyle, flex: 1.5, padding: '6px 4px', fontSize: 10, background: '#050', fontWeight: 'bold' }}>🎮 Play</button>
              </div>

              {/* Canvas Container */}
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#000',
                border: '1.5px solid #333',
                borderRadius: 4,
                overflow: 'hidden',
                padding: 4,
                aspectRatio: '1/1',
              }}>
                <canvas ref={canvasRef} width={GRID_W * CELL_SIZE} height={GRID_H * CELL_SIZE}
                  onMouseDown={handlePointerDown} onMouseMove={handlePointerMove}
                  onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
                  onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}
                  style={{ border: '1px solid #c00', cursor: drawMode === 'paint' ? 'crosshair' : drawMode === 'line' ? 'crosshair' : 'cell', touchAction: 'none', maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', aspectRatio: '1/1', objectFit: 'contain' }}
                />
              </div>

              {/* Mobile Canvas Status Info */}
              <div style={{ fontSize: 10, color: '#888', display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                <span>Tool: <strong style={{ color: CELL_COLORS[tool] }}>{CELL_LABELS[tool].toUpperCase()}</strong></span>
                <span>Coord: {GRID_W}×{GRID_H}</span>
              </div>
            </div>
          )}

          {activeTab === 'palette' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 style={{ color: '#c00', margin: '0 0 4px 0', fontSize: 14, letterSpacing: '1px', borderBottom: '1px solid #333', paddingBottom: 6 }}>🖌️ BLOCK PALETTE</h3>
              
              {/* Entity counters */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                {CELL_CATEGORIES.filter(cat => cat.types[0] !== 'empty').map(cat => {
                  const total = cat.types.reduce((sum, t) => sum + (counts[t] ?? 0), 0);
                  if (total === 0) return null;
                  const overLimit = cat.types.some(t => (counts[t] ?? 0) > (LIMITS[t] ?? 999));
                  return (
                    <span key={cat.label} style={{ fontSize: 9, color: overLimit ? '#ff4444' : '#aaa', background: overLimit ? '#440000' : '#1a1a1a', padding: '2px 4px', borderRadius: 3, border: '1.5px solid #222' }}>
                      {cat.label.toUpperCase()}: {total}
                    </span>
                  );
                })}
              </div>

              {/* Palette Categories */}
              {CELL_CATEGORIES.map(cat => (
                <div key={cat.label} style={{ background: 'rgba(20, 10, 10, 0.4)', border: '1.5px solid #222', borderRadius: 4, padding: 8 }}>
                  <div style={{ fontSize: 10, color: '#ff6666', marginBottom: 6, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>{cat.label}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {cat.types.map(t => {
                      const count = counts[t] ?? 0;
                      const limit = LIMITS[t] ?? 999;
                      const over = t !== 'empty' && count >= limit;
                      return (
                        <button key={t} onClick={() => { setTool(t); setActiveTab('canvas'); }} style={{
                          background: tool === t ? CELL_COLORS[t] : '#222',
                          border: tool === t ? '1.5px solid #fff' : over ? '1px solid #f44' : '1px solid #444',
                          color: tool === t ? '#000' : over ? '#f44' : '#ccc',
                          padding: '4px 8px', cursor: over ? 'not-allowed' : 'pointer', fontSize: 10, borderRadius: 3,
                          opacity: over && tool !== t ? 0.6 : 1,
                        }}>
                          {CELL_LABELS[t]} {t !== 'empty' && <span style={{ fontSize: 8, color: over ? '#f44' : '#777' }}>{count}/{limit}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'config' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ color: '#c00', margin: '0 0 4px 0', fontSize: 14, letterSpacing: '1px', borderBottom: '1px solid #333', paddingBottom: 6 }}>⚙️ CONFIG & AUTH</h3>
              
              {/* Compact Auth Bar */}
              <div style={{ padding: 10, background: '#181818', border: '1.5px solid #222', borderRadius: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, gap: 8 }}>
                  {user ? (
                    <div>
                      <span>User: <strong style={{ color: '#ffcc00' }}>{(user.displayName ?? user.email ?? '').slice(0, 16)}</strong></span>
                      {user.email === 'jonas.olson@gmail.com' && <span style={{ color: '#f55', marginLeft: 4 }}>[ADMIN]</span>}
                    </div>
                  ) : (
                    <span style={{ color: '#888' }}>💻 Local Mode active</span>
                  )}
                  {user ? (
                    <button onClick={() => { if (confirm('Log out?') && auth) signOut(auth); }} style={{ ...btnStyle, padding: '3px 8px', fontSize: 10 }}>Log Out</button>
                  ) : (
                    <button onClick={() => setShowAuthModal(true)} style={{ ...btnStyle, background: '#c00', border: '1px solid #f66', padding: '4px 10px', fontSize: 10, fontWeight: 'bold' }}>🔑 LOG IN</button>
                  )}
                </div>
              </div>

              {/* Admin Pending Reviews */}
              {user?.email === 'jonas.olson@gmail.com' && (
                <div style={{ padding: 10, background: '#1c0d0d', border: '1.5px solid #c00', borderRadius: 4 }}>
                  <h4 style={{ color: '#ff4444', margin: '0 0 8px 0', fontSize: 11 }}>🛡️ Admin Review Panel ({pendingMaps.length})</h4>
                  {pendingMaps.length === 0 ? (
                    <p style={{ color: '#888', fontSize: 10, margin: 0 }}>No pending reviews.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
                      {pendingMaps.map(m => (
                        <div key={m.name} style={{ background: '#111', padding: 6, borderRadius: 3, border: '1px solid #333', fontSize: 9, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ color: '#ffcc00' }}>{m.name}</strong> <span style={{ color: '#888' }}>by {m.ownerName}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => { handleLoadMap(m.name); setActiveTab('canvas'); }} style={{ ...btnStyle, padding: '2px 4px', fontSize: 8 }}>🔍 Load</button>
                            <button onClick={() => handleReviewMap(m.name, 'approved')} style={{ ...btnStyle, padding: '2px 4px', fontSize: 8, background: '#040', color: '#0f0', border: '1px solid #0f0' }}>👍 Appr</button>
                            <button onClick={() => {
                              const notes = prompt("Enter reason:");
                              if (notes !== null) handleReviewMap(m.name, 'rejected', notes);
                            }} style={{ ...btnStyle, padding: '2px 4px', fontSize: 8, background: '#400', color: '#f55', border: '1px solid #f33' }}>👎 Rej</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Presets List */}
              <div style={{ padding: 10, background: '#181818', border: '1.5px solid #222', borderRadius: 4 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Official presets:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {presets.map(p => (
                    <button key={p.id} onClick={() => { if (confirm(`Load "${p.name}"?`)) { loadPreset(p); setActiveTab('canvas'); } }}
                      style={{
                        background: selectedPresetId === p.id ? '#500' : '#222',
                        border: selectedPresetId === p.id ? '1px solid #ff4444' : '1px solid #444',
                        color: selectedPresetId === p.id ? '#ff4444' : '#ccc',
                        padding: '4px 8px', fontSize: 10, borderRadius: 3,
                      }}>
                      {p.name}
                    </button>
                  ))}
                </div>
                {user?.email === 'jonas.olson@gmail.com' && selectedPresetId && (
                  <button onClick={handleSavePreset} style={{ ...btnStyle, background: '#c00', width: '100%', marginTop: 8, padding: '6px', fontSize: 10, fontWeight: 'bold' }}>
                    💾 UPDATE PRESET IN CLOUD
                  </button>
                )}
              </div>

              {/* Music Settings */}
              <div style={{ padding: 10, background: '#181818', border: '1.5px solid #222', borderRadius: 4 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Level Music:</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                  {TRACK_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setMusicTrack(opt.value)}
                      style={{
                        ...btnStyle,
                        background: musicTrack === opt.value ? '#600' : '#222',
                        border: musicTrack === opt.value ? '1px solid #f00' : '1px solid #444',
                        fontSize: 10,
                        padding: '4px 8px',
                      }}
                    >
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                  <button onClick={toggleMusicPreview}
                    style={{
                      ...btnStyle,
                      background: musicPlaying ? '#050' : '#222',
                      border: musicPlaying ? '1px solid #0f0' : '1px solid #444',
                      fontSize: 10,
                      padding: '4px 10px',
                    }}
                  >
                    {musicPlaying ? '⏸ Mute' : '▶ Play'}
                  </button>
                </div>
              </div>

              {/* Extra Utility Actions */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderTop: '1px solid #333', paddingTop: 10 }}>
                <button onClick={handleLoad} style={{ ...btnStyle, flex: 1, padding: '8px 4px', fontSize: 11 }}>📂 Load Map</button>
                <button onClick={exportLevel} style={{ ...btnStyle, flex: 1, padding: '8px 4px', fontSize: 11 }}>📋 Export Code</button>
                <button onClick={clearGrid} style={{ ...btnStyle, flex: 1, padding: '8px 4px', fontSize: 11, background: '#300' }}>🗑️ Clear Grid</button>
              </div>
              <button onClick={async () => {
                await saveMapToStorage('__e1m1__', grid, playerPos, true, musicTrack, 'draft');
                alert('Saved as E1M1!');
              }} style={{ ...btnStyle, width: '100%', padding: '8px', fontSize: 11, background: '#530', border: '1px solid #c80' }}>
                🏴‍☠️ Save as Default E1M1
              </button>
            </div>
          )}
        </div>

        {/* Modals & Dialogs */}
        {showSaveDialog && (
          <SaveModal
            saveValidation={saveValidation}
            saveName={saveName}
            setSaveName={setSaveName}
            onSave={handleSave}
            onCancel={() => { setShowSaveDialog(false); setSaveName(''); setSaveValidation(null); }}
            user={user}
            onSubmitForApproval={handleSubmitForApproval}
          />
        )}
        {showLoadDialog && (
          <LoadModal
            savedMaps={savedMaps}
            onLoadMap={(n) => { handleLoadMap(n); setActiveTab('canvas'); }}
            onDeleteMap={handleDeleteMap}
            onClose={() => setShowLoadDialog(false)}
          />
        )}
        {showExport && <ExportModal exportCode={exportCode} onClose={() => setShowExport(false)} />}
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      </div>
    );
  }

  // Desktop Side-by-Side Layout
  return (
    <div className="editor-desktop" style={{
      background: '#111',
      color: '#fff',
      fontFamily: 'monospace',
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'row',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* LEFT SIDEBAR (320px wide) */}
      <div style={{
        width: 320,
        minWidth: 320,
        background: '#151515',
        borderRight: '2px solid #c00',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        boxSizing: 'border-box',
        boxShadow: '5px 0 15px rgba(0,0,0,0.5)',
        zIndex: 5,
      }}>
        {/* Compact Auth Bar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #311', background: 'rgba(20, 10, 10, 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, gap: 8 }}>
            {user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>User: <strong style={{ color: '#ffcc00' }}>{(user.displayName ?? user.email ?? '').slice(0, 20)}</strong></span>
                {user.email === 'jonas.olson@gmail.com' && (
                  <span style={{ color: '#ff3333', fontSize: 10, fontWeight: 'bold' }}>🛡️ ADMIN</span>
                )}
              </div>
            ) : (
              <span style={{ color: '#888' }}>💻 Local / Offline Mode</span>
            )}
            {user ? (
              <button onClick={() => { if (confirm('Log out?') && auth) signOut(auth); }} style={{ ...btnStyle, padding: '2px 6px', fontSize: 10 }}>Log Out</button>
            ) : (
              <button onClick={() => setShowAuthModal(true)} style={{ ...btnStyle, background: '#c00', border: '1px solid #f66', padding: '3px 8px', fontSize: 10, fontWeight: 'bold' }}>🔑 LOG IN</button>
            )}
          </div>
        </div>

        {/* Admin Review Panel */}
        {showAdminPanel && user?.email === 'jonas.olson@gmail.com' && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #c00', background: '#1c0d0d' }}>
            <h4 style={{ color: '#ff4444', margin: '0 0 8px 0', fontSize: 11 }}>🛡️ Pending Reviews ({pendingMaps.length})</h4>
            {pendingMaps.length === 0 ? (
              <p style={{ color: '#888', fontSize: 10, margin: 0 }}>No pending reviews.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                {pendingMaps.map(m => (
                  <div key={m.name} style={{ background: '#111', padding: 6, borderRadius: 3, border: '1px solid #333', fontSize: 10 }}>
                    <div style={{ marginBottom: 4 }}>
                      <strong style={{ color: '#ffcc00' }}>{m.name}</strong> <span style={{ color: '#888', fontSize: 9 }}>by {m.ownerName}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleLoadMap(m.name)} style={{ ...btnStyle, padding: '1px 4px', fontSize: 9 }}>🔍 Load</button>
                      <button onClick={() => handleReviewMap(m.name, 'approved')} style={{ ...btnStyle, padding: '1px 4px', fontSize: 9, background: '#040', color: '#0f0', border: '1px solid #0f0' }}>👍 Appr</button>
                      <button onClick={() => {
                        const notes = prompt("Enter reason:");
                        if (notes !== null) handleReviewMap(m.name, 'rejected', notes);
                      }} style={{ ...btnStyle, padding: '1px 4px', fontSize: 9, background: '#400', color: '#f55', border: '1px solid #f33' }}>👎 Rej</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Presets List */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #311' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Presets:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {presetsLoading ? (
              <span style={{ fontSize: 10, color: '#888' }}>Loading...</span>
            ) : (
              presets.map(p => (
                <button key={p.id} onClick={() => { if (confirm(`Load "${p.name}"?`)) loadPreset(p); }}
                  title={p.description}
                  style={{
                    background: selectedPresetId === p.id ? '#500' : '#222',
                    border: selectedPresetId === p.id ? '1px solid #ff4444' : '1px solid #555',
                    color: selectedPresetId === p.id ? '#ff4444' : '#ccc',
                    padding: '3px 6px', cursor: 'pointer', fontSize: 10, borderRadius: 3, fontFamily: 'monospace'
                  }}>
                  {p.name}
                </button>
              ))
            )}
          </div>
          {user?.email === 'jonas.olson@gmail.com' && selectedPresetId && (
            <button onClick={handleSavePreset} style={{ ...btnStyle, background: '#c00', width: '100%', marginTop: 8, padding: '4px', fontSize: 9, fontWeight: 'bold' }}>
              💾 SAVE TO PRESET COLLECTION
            </button>
          )}
        </div>

        {/* Music Options */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #311' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Level Music:</div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {TRACK_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setMusicTrack(opt.value)}
                style={{
                  ...btnStyle,
                  background: musicTrack === opt.value ? '#600' : '#222',
                  border: musicTrack === opt.value ? '1px solid #f00' : '1px solid #555',
                  fontSize: 10,
                  padding: '2px 4px',
                }}
                title={opt.label}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
            <button onClick={toggleMusicPreview}
              style={{
                ...btnStyle,
                background: musicPlaying ? '#050' : '#222',
                border: musicPlaying ? '1px solid #0f0' : '1px solid #555',
                fontSize: 10,
                padding: '2px 6px',
              }}
            >
              {musicPlaying ? '⏸' : '▶'}
            </button>
          </div>
        </div>

        {/* Tool Palette */}
        <div style={{ padding: '12px 16px', flex: 1 }}>
          {CELL_CATEGORIES.map(cat => (
            <div key={cat.label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{cat.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {cat.types.map(t => {
                  const count = counts[t] ?? 0;
                  const limit = LIMITS[t] ?? 999;
                  const over = t !== 'empty' && count >= limit;
                  return (
                    <button key={t} onClick={() => setTool(t)} style={{
                      background: tool === t ? CELL_COLORS[t] : '#222',
                      border: tool === t ? '1.5px solid #fff' : over ? '1px solid #f44' : '1px solid #444',
                      color: tool === t ? '#000' : over ? '#f44' : '#ccc',
                      padding: '2px 5px', cursor: over ? 'not-allowed' : 'pointer', fontSize: 10, borderRadius: 3,
                      opacity: over && tool !== t ? 0.6 : 1,
                    }}>
                      {CELL_LABELS[t]} {t !== 'empty' && <span style={{ fontSize: 8, color: over ? '#f44' : '#777' }}>{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Entity counters */}
        <div style={{ padding: '8px 16px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid #222', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CELL_CATEGORIES.filter(cat => cat.types[0] !== 'empty').map(cat => {
            const total = cat.types.reduce((sum, t) => sum + (counts[t] ?? 0), 0);
            if (total === 0) return null;
            const overLimit = cat.types.some(t => (counts[t] ?? 0) > (LIMITS[t] ?? 999));
            return (
              <span key={cat.label} style={{ fontSize: 9, color: overLimit ? '#ff4444' : '#aaa', background: overLimit ? '#440000' : '#1a1a1a', padding: '1px 4px', borderRadius: 3, border: '1px solid #333' }}>
                {cat.label.toUpperCase()}: {total}
              </span>
            );
          })}
        </div>
      </div>

      {/* RIGHT MAIN VIEWPORT */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
        padding: 12,
        overflow: 'hidden',
      }}>
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1.5px solid #c00', paddingBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ color: '#c00', margin: 0, fontSize: 18, letterSpacing: '1px', textShadow: '0 0 10px rgba(255,0,0,0.2)' }}>🏴‍☠️ DOOM LEVEL EDITOR</h1>
            {user?.email === 'jonas.olson@gmail.com' && (
              <button onClick={() => { setShowAdminPanel(!showAdminPanel); }} style={{ ...btnStyle, padding: '2px 6px', fontSize: 10, background: showAdminPanel ? '#c00' : '#333', border: '1px solid #f55' }}>
                🛡️ Reviews ({pendingMaps.length})
              </button>
            )}
          </div>

          {/* Draw Mode Selectors */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(Object.keys(drawModeLabels) as DrawMode[]).map(m => (
              <button key={m} onClick={() => { setDrawMode(m); setLineStart(null); setRectStart(null); setPreviewCells([]); }} style={{
                background: drawMode === m ? '#c00' : '#222',
                border: drawMode === m ? '1px solid #fff' : '1px solid #444',
                color: drawMode === m ? '#fff' : '#aaa',
                padding: '4px 10px', cursor: 'pointer', fontSize: 11, borderRadius: 3, fontFamily: 'monospace',
              }}>
                {drawModeLabels[m]}
              </button>
            ))}
          </div>

          {/* Exit button */}
          <button onClick={() => { window.location.hash = String(); }} style={{ color: "#c00", fontSize: 20, background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }} title="Exit to menu">✕</button>
        </div>

        {/* Action Button Row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <button onClick={handleUndo} disabled={undoStack.length === 0} style={{ ...btnStyle, padding: '4px 8px', fontSize: 11, opacity: undoStack.length === 0 ? 0.3 : 1 }}>↩️ Undo</button>
          <button onClick={validate} style={{ ...btnStyle, padding: '4px 8px', fontSize: 11 }}>✅ Validate</button>
          <button onClick={async () => {
            const result = runValidation(grid, playerPos);
            setSaveValidation(result);
            const maps = await listSavedMaps();
            setSavedMaps(maps);
            setShowSaveDialog(true);
          }} style={{ ...btnStyle, padding: '4px 8px', fontSize: 11, background: '#750', border: '1px solid #a80' }}>💾 Save Map</button>
          <button onClick={handleLoad} style={{ ...btnStyle, padding: '4px 8px', fontSize: 11 }}>📂 Load Map</button>
          <button onClick={exportLevel} style={{ ...btnStyle, padding: '4px 8px', fontSize: 11 }}>📋 Export Code</button>
          <button onClick={clearGrid} style={{ ...btnStyle, padding: '4px 8px', fontSize: 11 }}>🗑️ Clear Canvas</button>
          <button onClick={async () => {
            await saveMapToStorage('__e1m1__', grid, playerPos, true, musicTrack, 'draft');
            alert('Saved as E1M1!');
          }} style={{ ...btnStyle, padding: '4px 8px', fontSize: 11, background: '#530', border: '1px solid #c80' }}>🏴‍☠️ Save as Default E1M1</button>
          
          <div style={{ flex: 1 }} />
          
          <button onClick={handlePlayMap} style={{ ...btnStyle, padding: '4px 14px', fontSize: 11, background: '#050', border: '1.5px solid #0f0', fontWeight: 'bold', color: '#0f0', boxShadow: '0 0 10px rgba(0,255,0,0.2)' }}>🎮 Play This Map</button>
        </div>

        {/* Canvas Display Viewport (Responsive flex center) */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          border: '2px solid #222',
          borderRadius: 6,
          overflow: 'hidden',
          padding: 10,
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)',
        }}>
          <canvas ref={canvasRef} width={GRID_W * CELL_SIZE} height={GRID_H * CELL_SIZE}
            onMouseDown={handlePointerDown} onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}
            style={{ border: '2px solid #c00', cursor: drawMode === 'paint' ? 'crosshair' : drawMode === 'line' ? 'crosshair' : 'cell', touchAction: 'none', maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', aspectRatio: '1/1', objectFit: 'contain' }}
          />
        </div>

        {/* Statusbar footer */}
        <div style={{ marginTop: 6, fontSize: 11, color: '#888', display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
          <span>Mode: <strong style={{ color: '#ff0' }}>{drawModeLabels[drawMode]}</strong> | Active Tool: <strong style={{ color: CELL_COLORS[tool] }}>{CELL_LABELS[tool].toUpperCase()}</strong></span>
          <span>Workspace Grid: {GRID_W}×{GRID_H}</span>
        </div>
      </div>

      {/* Modals & Dialogs */}
      {showSaveDialog && (
        <SaveModal
          saveValidation={saveValidation}
          saveName={saveName}
          setSaveName={setSaveName}
          onSave={handleSave}
          onCancel={() => { setShowSaveDialog(false); setSaveName(''); setSaveValidation(null); }}
          user={user}
          onSubmitForApproval={handleSubmitForApproval}
        />
      )}
      {showLoadDialog && (
        <LoadModal
          savedMaps={savedMaps}
          onLoadMap={handleLoadMap}
          onDeleteMap={handleDeleteMap}
          onClose={() => setShowLoadDialog(false)}
        />
      )}
      {showExport && <ExportModal exportCode={exportCode} onClose={() => setShowExport(false)} />}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}

const btnStyle: React.CSSProperties = { background: '#444', border: '1px solid #c00', color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 13, borderRadius: 4, fontFamily: 'monospace' };

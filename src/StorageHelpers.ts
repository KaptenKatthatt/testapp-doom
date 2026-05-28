import { CellType, CellData, TrackStyle } from './EditorTypes';

export const AUTOSAVE_KEY = 'doom-editor-autosave';
export const MAP_PREFIX = 'doom-map-';

export interface SavedMap {
  name: string;
  grid: CellType[][];
  playerPos: [number, number] | null;
  timestamp: number;
  validated?: boolean;
  musicTrack?: TrackStyle | undefined;
}

export function saveMapToStorage(name: string, grid: CellData[][], playerPos: [number, number] | null, validated: boolean, musicTrack?: TrackStyle) {
  const data: SavedMap = {
    name,
    grid: grid.map(row => row.map(c => c.type)),
    playerPos,
    timestamp: Date.now(),
    validated,
    ...(musicTrack ? { musicTrack } : {}),
  };
  localStorage.setItem(MAP_PREFIX + name, JSON.stringify(data));
}

export function loadMapFromStorage(name: string): { grid: CellData[][], playerPos: [number, number] | null, musicTrack?: TrackStyle } | null {
  const raw = localStorage.getItem(MAP_PREFIX + name);
  if (!raw) return null;
  try {
    const data: SavedMap = JSON.parse(raw);
    return {
      grid: data.grid.map(row => row.map((t: CellType) => ({ type: t }))),
      playerPos: data.playerPos,
      ...(data.musicTrack ? { musicTrack: data.musicTrack } : {}),
    };
  } catch {
    return null;
  }
}

export function listSavedMaps(includeSystemMaps = false): Array<{ name: string; timestamp: number; validated: boolean; musicTrack?: TrackStyle }> {
  const maps: Array<{ name: string; timestamp: number; validated: boolean; musicTrack?: TrackStyle }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(MAP_PREFIX)) {
      if (!includeSystemMaps && (key.includes('__playing__') || key.includes('__autosache__') || key.includes('__autosave__') || key.includes('__e1m1__'))) {
        continue;
      }
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const data = JSON.parse(raw) as SavedMap;
          maps.push({ name: data.name, timestamp: data.timestamp, validated: !!data.validated, ...(data.musicTrack ? { musicTrack: data.musicTrack } : {}) });
        }
      } catch { /* skip */ }
    }
  }
  maps.sort((a, b) => b.timestamp - a.timestamp);
  return maps;
}

export function deleteMapFromStorage(name: string) {
  localStorage.removeItem(MAP_PREFIX + name);
}

export function autosave(grid: CellData[][], playerPos: [number, number] | null) {
  const data: SavedMap = {
    name: '__autosache__',
    grid: grid.map(row => row.map(c => c.type)),
    playerPos,
    timestamp: Date.now(),
  };
  localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
}

export function loadAutosave(): { grid: CellData[][], playerPos: [number, number] | null } | null {
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

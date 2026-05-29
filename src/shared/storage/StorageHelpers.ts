import type { CellType, CellData, TrackStyle } from '@/editor/EditorTypes';
import { db } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';

export const AUTOSAVE_KEY = 'doom-editor-autosave';
export const MAP_PREFIX = 'doom-map-';

const FIRESTORE_TIMEOUT_MS = 5000;

function withFirestoreTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore request timed out')), FIRESTORE_TIMEOUT_MS)
    ),
  ]);
}

export interface SavedMap {
  name: string;
  grid: CellType[][];
  playerPos: [number, number] | null;
  timestamp: number;
  validated?: boolean;
  musicTrack?: TrackStyle | undefined;
}

export interface SavedMapListItem {
  name: string;
  timestamp: number;
  validated: boolean;
  musicTrack?: TrackStyle;
  cloudSaved?: boolean;
}

interface FirestoreMapRecord {
  name: string;
  gridJson?: string;
  grid?: CellType[][];
  playerPos: [number, number] | null;
  timestamp: number;
  validated?: boolean;
  musicTrack?: TrackStyle;
}

function isTrackStyle(value: unknown): value is TrackStyle {
  return value === 'inferno'
    || value === 'darkness'
    || value === 'rampage'
    || value === 'eerie'
    || value === 'doom'
    || value === 'classic';
}

function isPlayerPos(value: unknown): value is [number, number] | null {
  if (value === null) return true;
  if (!Array.isArray(value) || value.length !== 2) return false;
  return typeof value[0] === 'number' && typeof value[1] === 'number';
}

function isCellTypeGrid(value: unknown): value is CellType[][] {
  if (!Array.isArray(value)) return false;
  return value.every((row: unknown) =>
    Array.isArray(row) && row.every((cell: unknown) => typeof cell === 'string')
  );
}

function readFirestoreMapRecord(value: unknown): FirestoreMapRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const name = record.name;
  const timestamp = record.timestamp;
  if (typeof name !== 'string' || typeof timestamp !== 'number') return null;
  if (!isPlayerPos(record.playerPos)) return null;

  const parsed: FirestoreMapRecord = {
    name,
    timestamp,
    playerPos: record.playerPos,
  };

  const gridJson = record.gridJson;
  if (typeof gridJson === 'string') {
    parsed.gridJson = gridJson;
  }

  const grid = record.grid;
  if (isCellTypeGrid(grid)) {
    parsed.grid = grid;
  }

  const validated = record.validated;
  if (typeof validated === 'boolean') {
    parsed.validated = validated;
  }

  const musicTrack = record.musicTrack;
  if (isTrackStyle(musicTrack)) {
    parsed.musicTrack = musicTrack;
  }

  return parsed;
}

function mapRecordToLoadedMap(
  data: FirestoreMapRecord
): { grid: CellData[][], playerPos: [number, number] | null, musicTrack?: TrackStyle } {
  let gridTypes: CellType[][] = [];
  if (data.gridJson) {
    const parsed: unknown = JSON.parse(data.gridJson);
    if (isCellTypeGrid(parsed)) {
      gridTypes = parsed;
    }
  } else if (data.grid) {
    gridTypes = data.grid;
  }

  return {
    grid: gridTypes.map(row => row.map((t: CellType) => ({ type: t }))),
    playerPos: data.playerPos,
    ...(data.musicTrack ? { musicTrack: data.musicTrack } : {}),
  };
}

function isSystemMapName(name: string): boolean {
  return name.includes('__playing__')
    || name.includes('__autosache__')
    || name.includes('__autosave__')
    || name.includes('__e1m1__');
}

/**
 * Helper to map local map names to valid Firestore document IDs.
 * Firestore reserves document IDs starting with double underscores '__'.
 * We map '__e1m1__' to 'system_e1m1' so the player's custom E1M1 edits are persistently saved in the database.
 * Other transient system maps like '__playing__' and '__autosache__' remain purely local.
 */
export function getFirestoreDocId(name: string): string | null {
  if (name === '__e1m1__') return 'system_e1m1';
  if (name.startsWith('__')) return null; // Ignore __playing__, __autosache__, etc.
  return name;
}

function loadMapFromLocalStorage(
  name: string
): { grid: CellData[][], playerPos: [number, number] | null, musicTrack?: TrackStyle } | null {
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

function syncMapToCloud(
  cloudId: string,
  name: string,
  localData: SavedMap,
  validated: boolean,
  musicTrack?: TrackStyle
): void {
  if (!db) return;
  const mapDocRef = doc(db, 'maps', cloudId);
  const firestoreData = {
    name,
    gridJson: JSON.stringify(localData.grid),
    playerPos: localData.playerPos,
    timestamp: localData.timestamp,
    validated,
    ...(musicTrack ? { musicTrack } : {}),
  };
  void withFirestoreTimeout(setDoc(mapDocRef, firestoreData))
    .then(() => {
      console.log(`Successfully synced map "${name}" (as "${cloudId}") with Firebase Cloud Firestore.`);
    })
    .catch((error: unknown) => {
      console.error(`Failed to sync map "${name}" to Cloud Firestore:`, error);
    });
}

/**
 * Saves a map to localStorage, and if Firebase Firestore is connected, uploads it to the database as well.
 * We sanitize the reserved '__e1m1__' ID to 'system_e1m1' for Firestore, and bypass Firestore for other '__' system maps.
 * We also serialize the 2D grid array as a JSON string to bypass Firestore's nested array limitation.
 */
export async function saveMapToStorage(
  name: string,
  grid: CellData[][],
  playerPos: [number, number] | null,
  validated: boolean,
  musicTrack?: TrackStyle
): Promise<void> {
  const localData: SavedMap = {
    name,
    grid: grid.map(row => row.map(c => c.type)),
    playerPos,
    timestamp: Date.now(),
    validated,
    ...(musicTrack ? { musicTrack } : {}),
  };

  // 1. Always save to localStorage immediately for fast offline access
  localStorage.setItem(MAP_PREFIX + name, JSON.stringify(localData));

  // 2. Cloud sync runs in the background so Save/Play never blocks on network
  const cloudId = getFirestoreDocId(name);
  if (cloudId) {
    syncMapToCloud(cloudId, name, localData, validated, musicTrack);
  }
}

/**
 * Loads a map from Firebase Cloud Firestore first. Fallback to localStorage if Firebase is offline,
 * if it's a local-only system map, or if the map is not found in the database.
 */
export async function loadMapFromStorage(
  name: string
): Promise<{ grid: CellData[][], playerPos: [number, number] | null, musicTrack?: TrackStyle } | null> {
  // Try to load from Cloud Firestore first (if supported)
  const cloudId = getFirestoreDocId(name);
  if (db && cloudId) {
    try {
      const mapDocRef = doc(db, 'maps', cloudId);
      const docSnap = await withFirestoreTimeout(getDoc(mapDocRef));
      if (docSnap.exists()) {
        const data = readFirestoreMapRecord(docSnap.data());
        if (data) {
          return mapRecordToLoadedMap(data);
        }
      }
    } catch (error: unknown) {
      console.error(`Failed to retrieve map "${name}" (as "${cloudId}") from Cloud Firestore, falling back to local storage:`, error);
    }
  }

  return loadMapFromLocalStorage(name);
}

/**
 * Lists all saved maps, combining local maps (from localStorage) and cloud maps (from Cloud Firestore).
 * Maps that exist on the cloud are flagged with `cloudSaved: true` and take precedence if duplicates exist.
 */
export async function listSavedMaps(
  includeSystemMaps = false
): Promise<SavedMapListItem[]> {
  const mapsMap = new Map<string, SavedMapListItem>();

  // 1. Fetch local maps from localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(MAP_PREFIX)) {
      if (!includeSystemMaps && (key.includes('__playing__') || key.includes('__autosache__') || key.includes('__autosave__') || key.includes('__e1m1__'))) {
        continue;
      }
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const data = JSON.parse(raw) as SavedMap;
          mapsMap.set(data.name, {
            name: data.name,
            timestamp: data.timestamp,
            validated: !!data.validated,
            ...(data.musicTrack ? { musicTrack: data.musicTrack } : {}),
            cloudSaved: false
          });
        }
      } catch { /* skip */ }
    }
  }

  // 2. Fetch cloud maps from Firebase Cloud Firestore
  if (db) {
    try {
      const mapsQuery = query(collection(db, 'maps'), orderBy('timestamp', 'desc'));
      const snapshot = await withFirestoreTimeout(getDocs(mapsQuery));
      snapshot.forEach(docSnap => {
        if (docSnap.exists()) {
          const data = readFirestoreMapRecord(docSnap.data());
          if (!data) return;
          // Skip if it is a system map that shouldn't be listed publicly
          if (!includeSystemMaps && isSystemMapName(data.name)) {
            return;
          }
          mapsMap.set(data.name, {
            name: data.name,
            timestamp: data.timestamp,
            validated: !!data.validated,
            ...(data.musicTrack ? { musicTrack: data.musicTrack } : {}),
            cloudSaved: true
          });
        }
      });
    } catch (error: unknown) {
      console.error("Failed to fetch maps from Cloud Firestore:", error);
    }
  }

  // Convert to array and sort descending by timestamp
  const maps = Array.from(mapsMap.values());
  maps.sort((a, b) => b.timestamp - a.timestamp);
  return maps;
}

/**
 * Deletes a map from local storage, and if connected, deletes it from Cloud Firestore.
 */
export async function deleteMapFromStorage(name: string): Promise<void> {
  // Always delete locally
  localStorage.removeItem(MAP_PREFIX + name);

  // Sync delete with Cloud Firestore if available
  const cloudId = getFirestoreDocId(name);
  if (db && cloudId) {
    const mapDocRef = doc(db, 'maps', cloudId);
    void withFirestoreTimeout(deleteDoc(mapDocRef))
      .then(() => {
        console.log(`Successfully deleted map "${name}" (as "${cloudId}") from Cloud Firestore.`);
      })
      .catch((error: unknown) => {
        console.error(`Failed to delete map "${name}" from Cloud Firestore:`, error);
      });
  }
}

/**
 * Autosaves the map state locally. Keeping this fully synchronous in localStorage prevents
 * network hammering on Firebase (e.g. during frequent fast debounced editor updates).
 */
export function autosave(grid: CellData[][], playerPos: [number, number] | null): void {
  const data: SavedMap = {
    name: '__autosache__',
    grid: grid.map(row => row.map(c => c.type)),
    playerPos,
    timestamp: Date.now(),
  };
  localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
}

/**
 * Loads the local autosave synchronously.
 */
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

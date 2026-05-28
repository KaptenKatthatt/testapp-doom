import { CellType, CellData, TrackStyle } from './EditorTypes';
import { db } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';

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

export interface SavedMapListItem {
  name: string;
  timestamp: number;
  validated: boolean;
  musicTrack?: TrackStyle;
  cloudSaved?: boolean;
}

/**
 * Saves a map to localStorage, and if Firebase Firestore is connected, uploads it to the database as well.
 * We bypass Cloud Firestore for reserved system maps starting with double underscores '__'.
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

  // 2. If Firebase is initialized and it's not a reserved system map, sync it to the cloud db
  if (db && !name.startsWith('__')) {
    try {
      const mapDocRef = doc(db, 'maps', name);
      // Map to Firestore-compatible format by serializing the nested grid array as a JSON string
      const firestoreData = {
        name,
        gridJson: JSON.stringify(localData.grid),
        playerPos,
        timestamp: localData.timestamp,
        validated,
        ...(musicTrack ? { musicTrack } : {}),
      };
      await setDoc(mapDocRef, firestoreData);
      console.log(`Successfully synced map "${name}" with Firebase Cloud Firestore.`);
    } catch (error) {
      console.error(`Failed to sync map "${name}" to Cloud Firestore:`, error);
    }
  }
}

/**
 * Loads a map from Firebase Cloud Firestore first. Fallback to localStorage if Firebase is offline,
 * if it's a reserved system map, or if the map is not found in the database.
 */
export async function loadMapFromStorage(
  name: string
): Promise<{ grid: CellData[][], playerPos: [number, number] | null, musicTrack?: TrackStyle } | null> {
  // Try to load from Cloud Firestore first (if not a reserved system map)
  if (db && !name.startsWith('__')) {
    try {
      const mapDocRef = doc(db, 'maps', name);
      const docSnap = await getDoc(mapDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // De-serialize the nested grid array from JSON string format
        let gridTypes: CellType[][] = [];
        if (data.gridJson) {
          gridTypes = JSON.parse(data.gridJson);
        } else if (data.grid) {
          // Fallback just in case some legacy non-nested array data exists
          gridTypes = data.grid;
        }

        return {
          grid: gridTypes.map(row => row.map((t: CellType) => ({ type: t }))),
          playerPos: data.playerPos,
          ...(data.musicTrack ? { musicTrack: data.musicTrack as TrackStyle } : {}),
        };
      }
    } catch (error) {
      console.error(`Failed to retrieve map "${name}" from Cloud Firestore, falling back to local storage:`, error);
    }
  }

  // Local storage fallback
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

/**
 * Lists all saved maps, combining local maps (from localStorage) and cloud maps (from Cloud Firestore).
 * Maps that exist on the cloud are flagged with `cloudSaved: true` and take precedence if duplicates exist.
 */
export async function listSavedMaps(
  includeSystemMaps = false
): Promise<Array<SavedMapListItem>> {
  const mapsMap = new Map<string, SavedMapListItem>();

  // 1. Fetch local maps from localStorage
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
      const snapshot = await getDocs(mapsQuery);
      snapshot.forEach(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (!includeSystemMaps && (data.name.includes('__playing__') || data.name.includes('__autosache__') || data.name.includes('__autosave__') || data.name.includes('__e1m1__'))) {
            return;
          }
          mapsMap.set(data.name, {
            name: data.name,
            timestamp: data.timestamp,
            validated: !!data.validated,
            ...(data.musicTrack ? { musicTrack: data.musicTrack as TrackStyle } : {}),
            cloudSaved: true
          });
        }
      });
    } catch (error) {
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

  // Sync delete with Cloud Firestore if available (and not a reserved system map)
  if (db && !name.startsWith('__')) {
    try {
      const mapDocRef = doc(db, 'maps', name);
      await deleteDoc(mapDocRef);
      console.log(`Successfully deleted map "${name}" from Cloud Firestore.`);
    } catch (error) {
      console.error(`Failed to delete map "${name}" from Cloud Firestore:`, error);
    }
  }
}

/**
 * Autosaves the map state locally. Keeping this fully synchronous in localStorage prevents
 * network hammering on Firebase (e.g. during frequent fast debounced editor updates).
 */
export function autosave(grid: CellData[][], playerPos: [number, number] | null) {
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

import type { CellType, CellData, TrackStyle } from '@/editor/EditorTypes';
import { db, auth } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, orderBy, updateDoc, where } from 'firebase/firestore';

export const AUTOSAVE_KEY = 'doom-editor-autosave';
export const MAP_PREFIX = 'doom-map-';

const FIRESTORE_TIMEOUT_MS = 15000;

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
  validated?: boolean | undefined;
  musicTrack?: TrackStyle | undefined;
  
  // Auth and Lifecycle properties (Issue #50)
  status?: 'draft' | 'pending' | 'approved' | 'rejected' | undefined;
  ownerId?: string | undefined;
  ownerName?: string | undefined;
  reviewNotes?: string | undefined;
}

export interface SavedMapListItem {
  name: string;
  timestamp: number;
  validated: boolean;
  musicTrack?: TrackStyle | undefined;
  cloudSaved?: boolean | undefined;
  
  // Auth and Lifecycle properties (Issue #50)
  status?: 'draft' | 'pending' | 'approved' | 'rejected' | undefined;
  ownerId?: string | undefined;
  ownerName?: string | undefined;
  reviewNotes?: string | undefined;
}

interface FirestoreMapRecord {
  name: string;
  gridJson?: string | undefined;
  grid?: CellType[][] | undefined;
  playerPos: [number, number] | null;
  timestamp: number;
  validated?: boolean | undefined;
  musicTrack?: TrackStyle | undefined;
  
  // Auth and Lifecycle properties (Issue #50)
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  ownerId: string;
  ownerName?: string | undefined;
  reviewNotes?: string | undefined;
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

  const status = typeof record.status === 'string' ? record.status : 'draft';
  const ownerId = typeof record.ownerId === 'string' ? record.ownerId : 'legacy';
  const ownerName = typeof record.ownerName === 'string' ? record.ownerName : undefined;
  const reviewNotes = typeof record.reviewNotes === 'string' ? record.reviewNotes : undefined;

  const parsed: FirestoreMapRecord = {
    name,
    timestamp,
    playerPos: record.playerPos,
    status: status as 'draft' | 'pending' | 'approved' | 'rejected',
    ownerId,
    ownerName,
    reviewNotes,
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
): { 
  grid: CellData[][], 
  playerPos: [number, number] | null, 
  musicTrack?: TrackStyle | undefined,
  status?: 'draft' | 'pending' | 'approved' | 'rejected' | undefined,
  ownerId?: string | undefined,
  ownerName?: string | undefined,
  reviewNotes?: string | undefined
} {
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
    status: data.status,
    ownerId: data.ownerId,
    ownerName: data.ownerName,
    reviewNotes: data.reviewNotes,
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
): { 
  grid: CellData[][], 
  playerPos: [number, number] | null, 
  musicTrack?: TrackStyle | undefined, 
  status?: 'draft' | 'pending' | 'approved' | 'rejected' | undefined, 
  ownerId?: string | undefined, 
  ownerName?: string | undefined 
} | null {
  const raw = localStorage.getItem(MAP_PREFIX + name);
  if (!raw) return null;
  try {
    const data: SavedMap = JSON.parse(raw);
    return {
      grid: data.grid.map(row => row.map((t: CellType) => ({ type: t }))),
      playerPos: data.playerPos,
      ...(data.musicTrack ? { musicTrack: data.musicTrack } : {}),
      status: data.status,
      ownerId: data.ownerId,
      ownerName: data.ownerName,
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
  const currentUser = auth?.currentUser;

  const status = localData.status ?? 'draft';
  const ownerId = localData.ownerId ?? currentUser?.uid ?? 'anonymous';
  const ownerName = localData.ownerName ?? currentUser?.displayName ?? currentUser?.email ?? 'Anonymous';

  const firestoreData = {
    name,
    gridJson: JSON.stringify(localData.grid),
    playerPos: localData.playerPos,
    timestamp: localData.timestamp,
    validated,
    ...(musicTrack ? { musicTrack } : {}),
    
    // Auth and Lifecycle additions
    status,
    ownerId,
    ownerName,
    ...(localData.reviewNotes ? { reviewNotes: localData.reviewNotes } : {}),
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
 * Saves a map to localStorage, and if Firebase Firestore is connected and the user is logged in,
 * uploads it to the cloud database as well.
 */
export async function saveMapToStorage(
  name: string,
  grid: CellData[][],
  playerPos: [number, number] | null,
  validated: boolean,
  musicTrack?: TrackStyle,
  status: 'draft' | 'pending' | 'approved' | 'rejected' = 'draft'
): Promise<void> {
  const currentUser = auth?.currentUser;

  let currentOwnerId = currentUser?.uid ?? 'anonymous';
  let currentOwnerName = currentUser?.displayName ?? currentUser?.email ?? 'Anonymous';
  let currentStatus = status;

  // Preserve existing ownership/status details if we are updating a local copy
  const existingRaw = localStorage.getItem(MAP_PREFIX + name);
  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw) as SavedMap;
      if (parsed.ownerId) currentOwnerId = parsed.ownerId;
      if (parsed.ownerName) currentOwnerName = parsed.ownerName;
      // Do not downgrade status to draft on minor edits unless explicitly intended
      if (parsed.status && status === 'draft') {
        currentStatus = parsed.status;
      }
    } catch { /* skip */ }
  }

  const localData: SavedMap = {
    name,
    grid: grid.map(row => row.map(c => c.type)),
    playerPos,
    timestamp: Date.now(),
    validated,
    ...(musicTrack ? { musicTrack } : {}),
    status: currentStatus,
    ownerId: currentOwnerId,
    ownerName: currentOwnerName,
  };

  // 1. Always save to localStorage immediately for fast offline access
  localStorage.setItem(MAP_PREFIX + name, JSON.stringify(localData));

  // 2. Cloud sync runs in the background if logged in (per user instruction)
  const cloudId = getFirestoreDocId(name);
  if (cloudId && currentUser) {
    syncMapToCloud(cloudId, name, localData, validated, musicTrack);
  }
}

/**
 * Loads a map from Firebase Cloud Firestore first. Fallback to localStorage if Firebase is offline,
 * if it's a local-only system map, or if the map is not found in the database.
 */
export async function loadMapFromStorage(
  name: string
): Promise<{ 
  grid: CellData[][], 
  playerPos: [number, number] | null, 
  musicTrack?: TrackStyle | undefined, 
  status?: 'draft' | 'pending' | 'approved' | 'rejected' | undefined, 
  ownerId?: string | undefined, 
  ownerName?: string | undefined 
} | null> {
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
 * Submits a custom map for publishing approval (sets status to 'pending' in cloud and local).
 */
export async function submitMapForApproval(name: string): Promise<void> {
  const currentUser = auth?.currentUser;
  if (!currentUser) throw new Error("Must be logged in to submit maps");

  const localRaw = localStorage.getItem(MAP_PREFIX + name);
  if (!localRaw) throw new Error("Map not found locally");
  
  const localData = JSON.parse(localRaw) as SavedMap;
  localData.status = 'pending';
  localData.ownerId = currentUser.uid;
  localData.ownerName = currentUser.displayName ?? currentUser.email ?? 'Anonymous';
  localData.timestamp = Date.now();
  
  // Save locally
  localStorage.setItem(MAP_PREFIX + name, JSON.stringify(localData));

  // Save/Update in Firestore
  const cloudId = getFirestoreDocId(name);
  if (cloudId && db) {
    const mapDocRef = doc(db, 'maps', cloudId);
    const firestoreData = {
      name,
      gridJson: JSON.stringify(localData.grid),
      playerPos: localData.playerPos,
      timestamp: localData.timestamp,
      validated: !!localData.validated,
      ...(localData.musicTrack ? { musicTrack: localData.musicTrack } : {}),
      status: 'pending',
      ownerId: currentUser.uid,
      ownerName: localData.ownerName,
    };
    await withFirestoreTimeout(setDoc(mapDocRef, firestoreData));
  }
}

/**
 * Fetches all pending maps (Admin only, enforced by rules).
 */
export async function listPendingMaps(): Promise<SavedMapListItem[]> {
  const pendingList: SavedMapListItem[] = [];
  if (!db) return pendingList;
  try {
    const mapsRef = collection(db, 'maps');
    const q = query(mapsRef, where('status', '==', 'pending'), orderBy('timestamp', 'desc'));
    const snapshot = await withFirestoreTimeout(getDocs(q));
    
    snapshot.forEach(docSnap => {
      if (docSnap.exists()) {
        const data = readFirestoreMapRecord(docSnap.data());
        if (!data) return;
        pendingList.push({
          name: data.name,
          timestamp: data.timestamp,
          validated: !!data.validated,
          ...(data.musicTrack ? { musicTrack: data.musicTrack } : {}),
          status: data.status,
          ownerId: data.ownerId,
          ownerName: data.ownerName,
          cloudSaved: true,
        });
      }
    });
  } catch (error) {
    console.error("Failed to fetch pending maps:", error);
  }
  return pendingList;
}

/**
 * Reviews a community map (appproves or rejects) and updates Firestore (Admin only).
 */
export async function reviewMap(
  name: string,
  status: 'approved' | 'rejected',
  notes?: string
): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const cloudId = getFirestoreDocId(name);
  if (!cloudId) throw new Error("Invalid map name for review");

  const mapDocRef = doc(db, 'maps', cloudId);
  const updateData: Record<string, unknown> = {
    status,
    reviewedAt: Date.now(),
  };
  if (notes !== undefined) {
    updateData.reviewNotes = notes;
  }

  // Update in Firestore
  await withFirestoreTimeout(updateDoc(mapDocRef, updateData));
  console.log(`Successfully reviewed map "${name}" to status "${status}"`);

  // Update local storage too if it exists locally
  const localRaw = localStorage.getItem(MAP_PREFIX + name);
  if (localRaw) {
    try {
      const localData = JSON.parse(localRaw) as SavedMap;
      localData.status = status;
      if (notes !== undefined) {
        localData.reviewNotes = notes;
      }
      localStorage.setItem(MAP_PREFIX + name, JSON.stringify(localData));
    } catch { /* skip */ }
  }
}

/**
 * Lists all saved maps, combining local maps (from localStorage) and cloud maps (from Cloud Firestore).
 * Maps that exist on the cloud are flagged with `cloudSaved: true` and take precedence if duplicates exist.
 * - Non-logged-in users see local maps plus APPROVED community maps.
 * - Ordinary logged-in users see all local maps, APPROVED community maps, plus their own drafts/pending maps.
 * - Jonas (Admin) sees ALL maps in the database.
 */
export async function listSavedMaps(
  includeSystemMaps = false
): Promise<SavedMapListItem[]> {
  const mapsMap = new Map<string, SavedMapListItem>();
  const currentUser = auth?.currentUser;
  const isAdmin = currentUser?.email === 'jonas.olson@gmail.com';

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
            status: data.status ?? 'draft',
            ownerId: data.ownerId ?? 'anonymous',
            ownerName: data.ownerName ?? 'Anonymous',
            cloudSaved: false
          });
        }
      } catch { /* skip */ }
    }
  }

  // 2. Fetch cloud maps from Firebase Cloud Firestore
  if (db) {
    try {
      // Fetch maps ordered by timestamp
      const mapsQuery = query(collection(db, 'maps'), orderBy('timestamp', 'desc'));
      const snapshot = await withFirestoreTimeout(getDocs(mapsQuery));
      
      snapshot.forEach(docSnap => {
        if (docSnap.exists()) {
          const data = readFirestoreMapRecord(docSnap.data());
          if (!data) return;
          // Skip if it is a system map
          if (!includeSystemMaps && isSystemMapName(data.name)) {
            return;
          }
          
          // Visibility check
          const isVisible = data.status === 'approved' || 
                            isAdmin || 
                            data.ownerId === currentUser?.uid;

          if (isVisible) {
            mapsMap.set(data.name, {
              name: data.name,
              timestamp: data.timestamp,
              validated: !!data.validated,
              ...(data.musicTrack ? { musicTrack: data.musicTrack } : {}),
              status: data.status,
              ownerId: data.ownerId,
              ownerName: data.ownerName,
              cloudSaved: true,
              ...(data.reviewNotes ? { reviewNotes: data.reviewNotes } : {})
            });
          }
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

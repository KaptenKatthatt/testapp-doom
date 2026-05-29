import { db } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs } from 'firebase/firestore';
import type { CellData, CellType, TrackStyle } from '@/editor/EditorTypes';
import { FALLBACK_PRESETS } from '@/editor/EditorPresets';

export interface PresetMap {
  id: string; // 'e1m1', 'tight', 'open', 'maze', 'arena', 'fortress'
  name: string;
  description: string;
  grid: CellData[][];
  playerPos: [number, number];
  musicTrack?: TrackStyle | undefined;
  version?: number | undefined;
  updatedAt?: number | undefined;
}

const PRESETS_CACHE_KEY = 'doom-presets-cache';
const FIRESTORE_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Preset request timed out')), FIRESTORE_TIMEOUT_MS)
    ),
  ]);
}

/**
 * Loads all preset levels from Firestore, caches them locally, and returns them.
 * Falls back to localStorage cache if Firestore is offline.
 * Returns null if no cloud or cached presets are available (so the caller can use hardcoded fallbacks).
 */
export async function loadPresetsFromCloud(): Promise<PresetMap[] | null> {
  if (db) {
    try {
      const colRef = collection(db, 'presets');
      const snapshot = await withTimeout(getDocs(colRef));
      const presets: PresetMap[] = [];

      snapshot.forEach(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Record<string, unknown>;
          const id = docSnap.id;
          const name = data.name as string;
          const description = data.description as string;
          const playerPos = data.playerPos as [number, number];
          const gridJson = data.gridJson as string;
          const musicTrack = data.musicTrack as TrackStyle | undefined;
          const version = data.version as number;
          const updatedAt = data.updatedAt as number;

          if (name && playerPos && gridJson) {
            const gridTypes = JSON.parse(gridJson) as CellType[][];
            const grid = gridTypes.map(row => row.map((t: CellType) => ({ type: t })));
            presets.push({
              id,
              name,
              description,
              grid,
              playerPos,
              ...(musicTrack ? { musicTrack } : {}),
              version,
              updatedAt,
            });
          }
        }
      });

      if (presets.length > 0) {
        // Sort presets in the standard order for consistency
        const order = ['e1m1', 'tight', 'open', 'maze', 'arena', 'fortress'];
        presets.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

        // Cache in localStorage
        const cacheData = presets.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          gridTypes: p.grid.map(row => row.map(c => c.type)),
          playerPos: p.playerPos,
          musicTrack: p.musicTrack,
          version: p.version,
          updatedAt: p.updatedAt,
        }));
        localStorage.setItem(PRESETS_CACHE_KEY, JSON.stringify(cacheData));
        return presets;
      }
    } catch (error) {
      console.error("Failed to load presets from Firestore, trying cache:", error);
    }
  }

  // Load from localStorage cache (fallback if db is null or query fails)
  const cached = localStorage.getItem(PRESETS_CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as Array<{
        id: string;
        name: string;
        description: string;
        gridTypes: CellType[][];
        playerPos: [number, number];
        musicTrack?: TrackStyle;
        version?: number;
        updatedAt?: number;
      }>;
      return parsed.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        grid: p.gridTypes.map(row => row.map((t: CellType) => ({ type: t }))),
        playerPos: p.playerPos,
        musicTrack: p.musicTrack,
        version: p.version,
        updatedAt: p.updatedAt,
      }));
    } catch (e) {
      console.error("Failed to parse cached presets:", e);
    }
  }

  return null;
}

/**
 * Saves a preset map to Firestore (Admin only, enforced by Firestore rules).
 * Increments the preset version number.
 */
export async function savePresetToCloud(
  preset: PresetMap,
  uid?: string
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');
  const docRef = doc(db, 'presets', preset.id);

  // Get current preset to read version
  let nextVersion = 1;
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const current = docSnap.data() as Record<string, unknown>;
      nextVersion = (current.version as number ?? 0) + 1;
    }
  } catch (e) {
    console.warn("Could not read current preset version, defaulting to 1:", e);
  }

  const firestoreData = {
    name: preset.name,
    description: preset.description,
    gridJson: JSON.stringify(preset.grid.map(row => row.map(c => c.type))),
    playerPos: preset.playerPos,
    ...(preset.musicTrack ? { musicTrack: preset.musicTrack } : {}),
    version: nextVersion,
    updatedAt: Date.now(),
    ...(uid ? { updatedBy: uid } : {}),
  };

  await withTimeout(setDoc(docRef, firestoreData));
  console.log(`Preset "${preset.name}" (id: ${preset.id}) saved to Firestore successfully (v${nextVersion}).`);
}

/**
 * Migration helper to upload hardcoded presets to Firestore on first launch (Admin only).
 */
export async function lazyMigratePresets(): Promise<void> {
  if (!db) return;
  try {
    const colRef = collection(db, 'presets');
    const snapshot = await withTimeout(getDocs(colRef));
    if (snapshot.empty) {
      console.log("No presets found in Firestore. Commencing lazy migration...");
      for (const p of FALLBACK_PRESETS) {
        await savePresetToCloud(p);
      }
      console.log("Lazy migration of presets to Firestore complete!");
    }
  } catch (error) {
    console.error("Failed to run lazy migration for presets:", error);
  }
}

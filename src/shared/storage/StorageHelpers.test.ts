import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MAP_PREFIX,
  getFirestoreDocId,
  saveMapToStorage,
  loadMapFromStorage,
  listSavedMaps,
  deleteMapFromStorage,
  autosave,
  loadAutosave,
  saveLightingForLevel,
  resolveMapStorageKey,
  type LevelLightingData,
} from "./StorageHelpers";
import type { CellData } from "@/editor/EditorTypes";

vi.mock("./firebase", () => ({ db: null, auth: null }));

function makeGrid(): CellData[][] {
  return Array.from({ length: 50 }, () =>
    Array.from({ length: 50 }, () => ({ type: "empty" as const }))
  );
}

function setCell(grid: CellData[][], z: number, x: number, cell: CellData): void {
  const row = grid[z];
  if (row) row[x] = cell;
}

describe("getFirestoreDocId", () => {
  it("maps __e1m1__ to system_e1m1", () => {
    expect(getFirestoreDocId("__e1m1__")).toBe("system_e1m1");
  });

  it("returns null for other system maps", () => {
    expect(getFirestoreDocId("__playing__")).toBeNull();
    expect(getFirestoreDocId("__autosache__")).toBeNull();
  });

  it("returns the map name for user maps", () => {
    expect(getFirestoreDocId("MyLevel")).toBe("MyLevel");
  });
});

describe("localStorage map storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saveMapToStorage writes to localStorage immediately", async () => {
    const grid = makeGrid();
    setCell(grid, 3, 3, { type: "player" });
    await saveMapToStorage("TestMap", grid, [3, 3], true);

    const raw = localStorage.getItem(MAP_PREFIX + "TestMap");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "") as { name: string; validated: boolean };
    expect(parsed.name).toBe("TestMap");
    expect(parsed.validated).toBe(true);
  });

  it("loadMapFromStorage round-trips grid and player position", async () => {
    const grid = makeGrid();
    setCell(grid, 5, 5, { type: "wall" });
    setCell(grid, 4, 4, { type: "player" });
    await saveMapToStorage("RoundTrip", grid, [4, 4], false);

    const loaded = await loadMapFromStorage("RoundTrip");
    expect(loaded).not.toBeNull();
    expect(loaded?.playerPos).toEqual([4, 4]);
    expect(loaded?.grid[5]?.[5]?.type).toBe("wall");
    expect(loaded?.grid[4]?.[4]?.type).toBe("player");
  });

  it("listSavedMaps excludes system maps by default", async () => {
    const grid = makeGrid();
    await saveMapToStorage("UserMap", grid, [2, 2], true);
    await saveMapToStorage("__playing__", grid, [2, 2], false);

    const maps = await listSavedMaps();
    expect(maps.map((m) => m.name)).toContain("UserMap");
    expect(maps.map((m) => m.name)).not.toContain("__playing__");
  });

  it("deleteMapFromStorage removes the local entry", async () => {
    const grid = makeGrid();
    await saveMapToStorage("ToDelete", grid, null, false);
    await deleteMapFromStorage("ToDelete");
    expect(localStorage.getItem(MAP_PREFIX + "ToDelete")).toBeNull();
  });

  it("autosave and loadAutosave round-trip", () => {
    const grid = makeGrid();
    setCell(grid, 1, 1, { type: "wall" });
    autosave(grid, [1, 1]);
    const loaded = loadAutosave();
    expect(loaded).not.toBeNull();
    expect(loaded?.playerPos).toEqual([1, 1]);
    expect(loaded?.grid[1]?.[1]?.type).toBe("wall");
  });

  it("saveLightingForLevel preserves validated flag", async () => {
    const grid = makeGrid();
    const lighting: LevelLightingData = {
      ambientColor: "#ffffff",
      ambientIntensity: 0.5,
      hemisphereSkyColor: "#88aaff",
      hemisphereGroundColor: "#443322",
      hemisphereIntensity: 0.4,
      pointLights: [],
    };
    await saveMapToStorage("LitMap", grid, [2, 2], true);

    const result = await saveLightingForLevel("saved:LitMap", lighting);
    expect(result).toBe("saved");

    const raw = localStorage.getItem(MAP_PREFIX + "LitMap");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "") as { validated: boolean; lighting?: LevelLightingData };
    expect(parsed.validated).toBe(true);
    expect(parsed.lighting?.ambientColor).toBe("#ffffff");
  });

  it("resolveMapStorageKey maps level selectors to storage keys", () => {
    expect(resolveMapStorageKey("saved:MyMap")).toBe("MyMap");
    expect(resolveMapStorageKey("__default__")).toBe("__e1m1__");
    expect(resolveMapStorageKey("__custom__")).toBe("__playing__");
  });
});

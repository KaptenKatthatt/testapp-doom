import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadPresetsFromCloud, savePresetToCloud } from "./PresetStorage";
import type { CellData } from "@/editor/EditorTypes";

// Mock firebase database and auth instances as null for local storage fallback tests
vi.mock("./firebase", () => ({ db: null, auth: null }));

function makeGrid(): CellData[][] {
  return Array.from({ length: 50 }, () =>
    Array.from({ length: 50 }, () => ({ type: "empty" as const }))
  );
}

describe("PresetStorage local fallback and cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loadPresetsFromCloud returns null when both db and cache are missing", async () => {
    const presets = await loadPresetsFromCloud();
    expect(presets).toBeNull();
  });

  it("loadPresetsFromCloud loads from local cache when offline", async () => {
    const mockPresets = [
      {
        id: "e1m1",
        name: "Test E1M1",
        description: "Test Desc",
        gridTypes: [["wall", "empty"]],
        playerPos: [0, 1] as [number, number],
        version: 1,
        updatedAt: 123456
      }
    ];
    
    localStorage.setItem("doom-presets-cache", JSON.stringify(mockPresets));

    const presets = await loadPresetsFromCloud();
    expect(presets).not.toBeNull();
    expect(presets?.length).toBe(1);
    expect(presets?.[0]?.id).toBe("e1m1");
    expect(presets?.[0]?.name).toBe("Test E1M1");
    expect(presets?.[0]?.grid[0]?.[0]?.type).toBe("wall");
    expect(presets?.[0]?.grid[0]?.[1]?.type).toBe("empty");
    expect(presets?.[0]?.playerPos).toEqual([0, 1]);
  });

  it("savePresetToCloud throws error when db is not connected", async () => {
    const grid = makeGrid();
    const preset = {
      id: "tight",
      name: "Tight",
      description: "Desc",
      grid,
      playerPos: [2, 2] as [number, number]
    };
    
    await expect(savePresetToCloud(preset)).rejects.toThrow("Firestore not initialized");
  });
});

import { describe, it, expect } from "vitest";
import { gridToLevelData } from "./EditorExport";
import { GRID_H, GRID_W, type CellData } from "./EditorTypes";

function makeEmptyGrid(): CellData[][] {
  return Array.from({ length: GRID_H }, () =>
    Array.from({ length: GRID_W }, () => ({ type: "empty" as const }))
  );
}

describe("gridToLevelData", () => {
  it("merges adjacent walls into rectangles", () => {
    const grid = makeEmptyGrid();
    for (let x = 0; x < 5; x++) {
      grid[2]![x]! = { type: "wall" };
    }
    const level = gridToLevelData(grid, [3, 3]);
    expect(level.walls).toHaveLength(1);
    expect(level.walls[0]).toMatchObject({ x: 0, z: 2, w: 5, d: 1, isDoor: false });
  });

  it("exports player start from grid position", () => {
    const grid = makeEmptyGrid();
    const level = gridToLevelData(grid, [7, 9]);
    expect(level.playerStart).toEqual([7, 9]);
  });

  it("collects enemies and pickups from the grid", () => {
    const grid = makeEmptyGrid();
    grid[10]![10]! = { type: "imp" };
    grid[11]![11]! = { type: "health" };
    const level = gridToLevelData(grid, [5, 5]);
    expect(level.enemies).toHaveLength(1);
    expect(level.enemies[0]!.type).toBe("imp");
    expect(level.pickups).toHaveLength(1);
    expect(level.pickups[0]!.type).toBe("health");
  });

  it("marks half-height walls correctly", () => {
    const grid = makeEmptyGrid();
    grid[4]![4]! = { type: "halfwall" };
    const level = gridToLevelData(grid, [2, 2]);
    expect(level.walls[0]!.isHalfWall).toBe(true);
  });
});

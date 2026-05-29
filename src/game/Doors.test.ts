import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateDoor, type DoorData } from "./Doors";

vi.mock("./Audio", () => ({
  audioManager: { play: vi.fn() },
}));

function makeDoor(overrides: Partial<DoorData> = {}): DoorData {
  return {
    id: 1,
    position: [10, 2, 5],
    size: [1, 4, 1],
    state: "closed",
    timer: 0,
    autoClose: 4,
    isSecret: false,
    triggerDistance: 2.5,
    ...overrides,
  };
}

describe("updateDoor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens when player uses E nearby", () => {
    const door = makeDoor();
    const playerPos: [number, number, number] = [10, 0, 5];
    const next = updateDoor(door, 0.016, playerPos, true);
    expect(next.state).toBe("opening");
  });

  it("stays closed without use action", () => {
    const door = makeDoor();
    const playerPos: [number, number, number] = [10, 0, 5];
    const next = updateDoor(door, 0.016, playerPos, false);
    expect(next.state).toBe("closed");
  });

  it("stays closed when player is too far", () => {
    const door = makeDoor();
    const playerPos: [number, number, number] = [20, 0, 20];
    const next = updateDoor(door, 0.016, playerPos, true);
    expect(next.state).toBe("closed");
  });

  it("transitions to open after opening animation", () => {
    const door = makeDoor({ state: "opening", timer: 0.99 });
    const next = updateDoor(door, 0.02, [10, 0, 5], false);
    expect(next.state).toBe("open");
  });
});

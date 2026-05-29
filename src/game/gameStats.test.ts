import { describe, it, expect } from "vitest";
import { formatTime, calcScore } from "./gameStats";
import type { PlayerState } from "./types";

function makePlayerState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    health: 100,
    ammo: 60,
    bullets: 60,
    shells: 10,
    currentWeapon: "revolver",
    revolverChamber: 6,
    machinegunMag: 70,
    revolverReloading: false,
    machinegunReloading: false,
    kills: 0,
    shotsFired: 0,
    timesHit: 0,
    startTime: 100,
    endTime: 0,
    damageFlash: 0,
    ...overrides,
  };
}

describe("formatTime", () => {
  it("returns 0:00 when startTime is zero", () => {
    expect(formatTime(0, 100)).toBe("0:00");
  });

  it("formats elapsed seconds as m:ss", () => {
    expect(formatTime(100, 163)).toBe("1:03");
  });

  it("pads seconds with a leading zero", () => {
    expect(formatTime(100, 105)).toBe("0:05");
  });
});

describe("calcScore", () => {
  it("is stable when endTime is frozen", () => {
    const state = makePlayerState({
      kills: 11,
      startTime: 100,
      endTime: 163,
      shotsFired: 20,
      health: 80,
      timesHit: 5,
    });
    expect(calcScore(state)).toBe(calcScore(state));
  });

  it("changes when endTime changes", () => {
    const base = makePlayerState({
      kills: 11,
      startTime: 100,
      endTime: 163,
      shotsFired: 20,
      health: 80,
      timesHit: 5,
    });
    const slower = makePlayerState({ ...base, endTime: 263 });
    expect(calcScore(slower)).not.toBe(calcScore(base));
  });

  it("never returns a negative score", () => {
    const state = makePlayerState({
      kills: 0,
      startTime: 100,
      endTime: 500,
      shotsFired: 0,
      health: 1,
      timesHit: 100,
    });
    expect(calcScore(state)).toBeGreaterThanOrEqual(0);
  });
});

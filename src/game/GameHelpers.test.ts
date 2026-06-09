import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { checkSlimeDamageHelper, updatePickupCollectionHelper } from "./GameHelpers";
import type { PickupData } from "./types";
import type { PlayerData } from "./Game";

vi.mock("@/shared/audio/Audio", () => ({
  audioManager: { play: vi.fn() },
}));

function makePlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    position: new THREE.Vector3(0, 1.7, 0),
    rotation: 0,
    pitch: 0,
    health: 100,
    ammo: 60,
    bullets: 60,
    shells: 10,
    currentWeapon: "revolver",
    revolverChamber: 6,
    revolverReloadTimer: 0,
    machinegunMag: 70,
    machinegunReloadTimer: 0,
    unlockedShotgun: false,
    kills: 0,
    shotsFired: 0,
    timesHit: 0,
    startTime: 0,
    endTime: 0,
    shooting: false,
    lastShot: 0,
    lastContactDmg: 0,
    lastEnvDmg: 0,
    damageFlash: 0,
    isMoving: false,
    hasPlayedEmptyClick: false,
    ...overrides,
  };
}

describe("checkSlimeDamageHelper", () => {
  it("does not damage the player on old invisible fallback slime coordinates", () => {
    const player = makePlayer({ position: new THREE.Vector3(12, 1.7, 22) });

    const health = checkSlimeDamageHelper(2, player, vi.fn(), vi.fn(), []);

    expect(health).toBe(100);
    expect(player.timesHit).toBe(0);
  });

  it("does not damage the player near special floors unless standing on a marked tile", () => {
    const player = makePlayer({ position: new THREE.Vector3(28.5, 1.7, 41.5) });

    const health = checkSlimeDamageHelper(2, player, vi.fn(), vi.fn(), [
      { x: 28, z: 42, type: "slime" },
    ]);

    expect(health).toBe(100);
    expect(player.timesHit).toBe(0);
  });

  it("damages the player on explicit slime floor tiles", () => {
    const player = makePlayer({ position: new THREE.Vector3(28.5, 1.7, 42.5) });

    const health = checkSlimeDamageHelper(2, player, vi.fn(), vi.fn(), [
      { x: 28, z: 42, type: "slime" },
    ]);

    expect(health).toBe(95);
    expect(player.health).toBe(95);
    expect(player.timesHit).toBe(1);
    expect(player.damageFlash).toBe(1);
  });
});

describe("updatePickupCollectionHelper", () => {
  function makePickup(overrides: Partial<PickupData> = {}): PickupData {
    return {
      id: 1,
      position: [0, 0.3, 0],
      type: "ammo",
      active: true,
      ...overrides,
    };
  }

  it("reports changed and deactivates a pickup within range", () => {
    const pickups = [makePickup()];
    const playerPos = new THREE.Vector3(0, 1.7, 0);

    const result = updatePickupCollectionHelper(playerPos, pickups, 100);

    expect(result.changed).toBe(true);
    expect(result.updatedPickups[0]?.active).toBe(false);
    expect(result.ammoBonus).toBe(20);
    expect(result.updatedPickups).not.toBe(pickups);
  });

  it("reports unchanged when no pickup is collected", () => {
    const pickups = [makePickup({ position: [10, 0.3, 10] })];
    const playerPos = new THREE.Vector3(0, 1.7, 0);

    const result = updatePickupCollectionHelper(playerPos, pickups, 100);

    expect(result.changed).toBe(false);
    expect(result.updatedPickups).toBe(pickups);
    expect(result.ammoBonus).toBe(0);
  });

  it("does not treat reference equality as unchanged when active state differs", () => {
    const pickups = [makePickup()];
    const pickup = pickups[0];
    if (!pickup) throw new Error("expected pickup");
    pickup.active = false;
    const playerPos = new THREE.Vector3(0, 1.7, 0);

    const result = updatePickupCollectionHelper(playerPos, pickups, 100);

    expect(result.changed).toBe(false);
    expect(result.updatedPickups).toBe(pickups);
  });
});

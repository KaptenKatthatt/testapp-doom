import * as THREE from "three";
import { getDoorCollisionBox } from "./Doors";
import type { DoorData } from "./Doors";
import type { BarrelData } from "./Level";
import type { WallBox, EnemyData } from "./types";

export function checkCollision(
  pos: THREE.Vector3,
  walls: WallBox[],
  doors: DoorData[],
  barrels: BarrelData[],
  radius: number
): boolean {
  for (const wall of walls) {
    const closestX = Math.max(wall.min[0], Math.min(pos.x, wall.max[0]));
    const closestZ = Math.max(wall.min[2], Math.min(pos.z, wall.max[2]));
    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    if (dx * dx + dz * dz < radius * radius) {
      return true;
    }
  }
  // Also check closed doors
  for (const door of doors) {
    const doorBox = getDoorCollisionBox(door);
    if (!doorBox) continue;
    const closestX = Math.max(doorBox.min[0], Math.min(pos.x, doorBox.max[0]));
    const closestZ = Math.max(doorBox.min[2], Math.min(pos.z, doorBox.max[2]));
    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    if (dx * dx + dz * dz < radius * radius) {
      return true;
    }
  }
  // Also check barrels
  for (const barrel of barrels) {
    if (!barrel.alive) continue;
    const dx = pos.x - barrel.position[0];
    const dz = pos.z - barrel.position[2];
    const distSq = dx * dx + dz * dz;
    const minDist = radius + barrel.radius;
    if (distSq < minDist * minDist) {
      return true;
    }
  }
  return false;
}

export function checkDoorHit(x: number, z: number, doors: DoorData[]): boolean {
  for (const door of doors) {
    const doorBox = getDoorCollisionBox(door);
    if (!doorBox) continue;
    if (x >= doorBox.min[0] && x <= doorBox.max[0] && z >= doorBox.min[2] && z <= doorBox.max[2]) {
      return true;
    }
  }
  return false;
}

export function checkWallHit(
  x: number,
  y: number,
  z: number,
  walls: WallBox[],
  doors: DoorData[],
  barrels: BarrelData[]
): boolean {
  for (const wall of walls) {
    if (x >= wall.min[0] && x <= wall.max[0] && z >= wall.min[2] && z <= wall.max[2]) {
      if (y >= wall.min[1] && y <= wall.max[1]) {
        return true;
      }
    }
  }
  if (checkDoorHit(x, z, doors)) return true;
  // Check barrels
  for (const barrel of barrels) {
    if (!barrel.alive) continue;
    const dx = x - barrel.position[0];
    const dz = z - barrel.position[2];
    if (dx * dx + dz * dz < barrel.radius * barrel.radius) {
      if (y >= 0 && y <= 1.0) {
        return true;
      }
    }
  }
  return false;
}

export function checkEnemyCollision(pos: THREE.Vector3, currentEnemies: EnemyData[], radius = 0.8): boolean {
  for (const e of currentEnemies) {
    if (!e.alive) continue;
    const dx = pos.x - e.position[0];
    const dz = pos.z - e.position[2];
    if (dx * dx + dz * dz < radius * radius) {
      return true;
    }
  }
  return false;
}

export function hasLineOfSight(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  walls: WallBox[],
  doors: DoorData[]
): boolean {
  const steps = Math.ceil(Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x1 + (x2 - x1) * t;
    const cz = z1 + (z2 - z1) * t;
    for (const wall of walls) {
      if (cx >= wall.min[0] && cx <= wall.max[0] && cz >= wall.min[2] && cz <= wall.max[2]) {
        if (wall.isHalfWall) continue;
        return false;
      }
    }
    if (checkDoorHit(cx, cz, doors)) {
      return false;
    }
  }
  return true;
}

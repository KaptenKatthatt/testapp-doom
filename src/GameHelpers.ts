import * as THREE from "three";
import type { EnemyData, ProjectileData, PickupData } from "./types";
import { audioManager } from "./Audio";

const PROJECTILE_SPEED = 12;

const ENEMY_SPEEDS: Record<string, number> = {
  imp: 3.0,
  demon: 5.0,
  zombieman: 2.5,
};

const ENEMY_ATTACK_RANGES: Record<string, number> = {
  imp: 8,
  demon: 2.5,
  zombieman: 12,
};

const ENEMY_ATTACK_COOLDOWNS: Record<string, number> = {
  imp: 1.5,
  demon: 0.8,
  zombieman: 2.5,
};

const PROJECTILE_COLORS: Record<string, string> = {
  imp: "#ff6600",
  demon: "#ff0044",
  zombieman: "#88ff44",
};

/** Helper to update all projectiles in the game */
export function updateProjectilesHelper(
  dt: number,
  projectiles: ProjectileData[],
  player: { health: number; timesHit: number; damageFlash: number; position: THREE.Vector3 },
  enemies: EnemyData[],
  checkWallHit: (x: number, z: number) => boolean,
  onGameOver: () => void,
  setGameActive: (active: boolean) => void
): ProjectileData[] {
  return projectiles
    .map((p: ProjectileData): ProjectileData => ({
      ...p,
      position: [
        p.position[0] + p.direction[0] * p.speed * dt,
        p.position[1] + p.direction[1] * p.speed * dt,
        p.position[2] + p.direction[2] * p.speed * dt,
      ] as [number, number, number],
      life: p.life - dt,
    }))
    .filter((p: ProjectileData): boolean => {
      // Remove if expired
      if (p.life <= 0) return false;
      // Remove if hit wall
      if (checkWallHit(p.position[0], p.position[2])) return false;
      // Remove if out of bounds
      if (Math.abs(p.position[0]) > 60 || Math.abs(p.position[2]) > 60) return false;

      // Player projectiles hit first enemy they touch
      if (!p.fromEnemy) {
        for (const e of enemies) {
          if (!e.alive) continue;
          const dx = p.position[0] - e.position[0];
          const dz = p.position[2] - e.position[2];
          if (dx * dx + dz * dz < 0.8) {
            // Bullet hit enemy — remove projectile
            return false;
          }
        }
      }

      // Enemy projectiles hit player
      if (p.fromEnemy) {
        const dx = p.position[0] - player.position.x;
        const dz = p.position[2] - player.position.z;
        if (dx * dx + dz * dz < 0.8) {
          // Enemy projectile hit player — apply damage
          player.health = Math.max(0, player.health - 2);
          player.timesHit++;
          player.damageFlash = 1;
          audioManager.play('player_hurt');
          if (player.health <= 0) {
            setGameActive(false);
            onGameOver();
            audioManager.play('player_death');
          }
          return false; // Remove projectile on player hit
        }
      }

      return true;
    });
}

/** Helper to run the AI pathfinding, chasing, and shooting code for enemies */
export function updateEnemyAIHelper(
  dt: number,
  now: number,
  player: { position: THREE.Vector3; health: number },
  enemies: EnemyData[],
  checkCollision: (pos: THREE.Vector3, radius?: number) => boolean,
  hasLineOfSight: (x1: number, z1: number, x2: number, z2: number) => boolean,
  startProjectileId: number
): { updatedEnemies: EnemyData[]; spawnedProjectiles: ProjectileData[] } {
  const spawnedProjectiles: ProjectileData[] = [];
  let nextId = startProjectileId;

  const updatedEnemies = enemies.map((e: EnemyData): EnemyData => {
    if (!e.alive) {
      if (e.hitFlash > 0) {
        return { ...e, hitFlash: Math.max(0, e.hitFlash - dt * 4) };
      }
      return e;
    }

    const eSpeed = ENEMY_SPEEDS[e.type] ?? 1.5;
    const attackRange = ENEMY_ATTACK_RANGES[e.type] ?? 8;
    const attackCooldown = ENEMY_ATTACK_COOLDOWNS[e.type] ?? 2;

    const dist = Math.sqrt(
      (player.position.x - e.position[0]) ** 2 +
      (player.position.z - e.position[2]) ** 2,
    );

    let newX = e.position[0];
    let newZ = e.position[2];
    let newAttack = e.lastAttack;
    const newHitFlash = Math.max(0, e.hitFlash - dt * 4);

    // Always chase the player
    const dx = player.position.x - e.position[0];
    const dz = player.position.z - e.position[2];
    const len = Math.sqrt(dx * dx + dz * dz);
    const ndx = len > 0.01 ? dx / len : 0;
    const ndz = len > 0.01 ? dz / len : 0;

    // Check line of sight before moving or attacking
    const canSeePlayer = hasLineOfSight(e.position[0], e.position[2], player.position.x, player.position.z);

    // Alert sound when enemy first sees the player (scaled down to 0.2 volume)
    if (canSeePlayer && !e.hasAlerted) {
      const alertSounds: Record<string, string> = { imp: 'imp_alert', demon: 'demon_alert', zombieman: 'zombie_alert' };
      audioManager.play(alertSounds[e.type] ?? 'zombie_alert', 0.2);
    }

    if (dist > 1.2) {
      // Direct movement toward player
      const proposedX = e.position[0] + ndx * eSpeed * dt;
      const proposedZ = e.position[2] + ndz * eSpeed * dt;

      if (!checkCollision(new THREE.Vector3(proposedX, 0, proposedZ), 0.6)) {
        // Can move directly toward player
        newX = proposedX;
        newZ = proposedZ;
      } else {
        // Blocked — try wall sliding (X or Z independently)
        let movedX = false;
        let movedZ = false;
        const slideXPos = e.position[0] + ndx * eSpeed * dt;
        const slideZPos = e.position[2] + ndz * eSpeed * dt;

        if (!checkCollision(new THREE.Vector3(slideXPos, 0, e.position[2]), 0.6)) {
          newX = slideXPos;
          movedX = true;
        }
        if (!checkCollision(new THREE.Vector3(e.position[0], 0, slideZPos), 0.6)) {
          newZ = slideZPos;
          movedZ = true;
        }

        // If stuck, try perpendicular or random directions
        if (!movedX && !movedZ) {
          const dxLast = e.position[0] - e.lastPosition[0];
          const dzLast = e.position[2] - e.lastPosition[2];
          const moved = dxLast * dxLast + dzLast * dzLast;

          if (moved < 0.01) {
            // Truly stuck — try 8 directions
            for (const [mx, mz] of [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]] as Array<[number, number]>) {
              const tryX = e.position[0] + mx * eSpeed * dt * 2;
              const tryZ = e.position[2] + mz * eSpeed * dt * 2;
              if (!checkCollision(new THREE.Vector3(tryX, 0, tryZ), 0.6)) {
                newX = tryX;
                newZ = tryZ;
                break;
              }
            }
          } else {
            // Sliding — try perpendicular
            const perpX = -ndz * eSpeed * dt;
            const perpZ = ndx * eSpeed * dt;
            if (!checkCollision(new THREE.Vector3(e.position[0] + perpX, 0, e.position[2] + perpZ), 0.6)) {
              newX = e.position[0] + perpX;
              newZ = e.position[2] + perpZ;
            } else if (!checkCollision(new THREE.Vector3(e.position[0] - perpX, 0, e.position[2] - perpZ), 0.6)) {
              newX = e.position[0] - perpX;
              newZ = e.position[2] - perpZ;
            }
          }
        }
      }

      // Only attack if enemy can see the player
      if (canSeePlayer && dist < attackRange && now - e.lastAttack > attackCooldown) {
        newAttack = now;

        // Spawn projectile
        const projDir: [number, number, number] = [ndx, 0, ndz];
        const projPos: [number, number, number] = [e.position[0], 1, e.position[2]];
        const projColor = PROJECTILE_COLORS[e.type] ?? "#ff6600";
        spawnedProjectiles.push({
          id: nextId++,
          position: projPos,
          direction: projDir,
          speed: PROJECTILE_SPEED,
          fromEnemy: true,
          color: projColor,
          life: 2,
        });
      }
    }

    return {
      ...e,
      position: [newX, 0, newZ] as [number, number, number],
      lastAttack: newAttack,
      hitFlash: newHitFlash,
      rotation: Math.atan2(player.position.x - newX, player.position.z - newZ) + Math.PI,
      lastPosition: [e.position[0], 0, e.position[2]] as [number, number, number],
      hasAlerted: e.hasAlerted || canSeePlayer,
    };
  });

  return { updatedEnemies, spawnedProjectiles };
}

/** Helper to handle standing in nukage pools/slime damage */
export function checkSlimeDamageHelper(
  dt: number,
  playerPos: THREE.Vector3,
  playerHealth: number,
  onGameOver: () => void,
  setGameActive: (active: boolean) => void
): number {
  const SLIME_ZONES: Array<{ x: number; z: number; radius: number }> = [
    { x: 12, z: 22, radius: 4 }, // Slime room center
    { x: 8, z: 18, radius: 3 },  // Slime room west
    { x: 18, z: 28, radius: 3 },  // Slime room east
  ];

  for (const zone of SLIME_ZONES) {
    const sdx = playerPos.x - zone.x;
    const sdz = playerPos.z - zone.z;
    if (sdx * sdx + sdz * sdz < zone.radius * zone.radius) {
      const nextHealth = Math.max(0, playerHealth - dt * 1);
      if (nextHealth <= 0) {
        setGameActive(false);
        onGameOver();
        audioManager.play('player_death');
      }
      return nextHealth;
    }
  }

  return playerHealth;
}

/** Helper to check for pickup items */
export function updatePickupCollectionHelper(
  playerPos: THREE.Vector3,
  pickups: PickupData[],
  playerHealth: number
): { updatedPickups: PickupData[]; healthBonus: number; ammoBonus: number; shotgunPickup: boolean } {
  let healthBonus = 0;
  let ammoBonus = 0;
  let shotgunPickup = false;

  const updatedPickups = pickups.map((p: PickupData): PickupData => {
    if (!p.active) return p;
    const dx = playerPos.x - p.position[0];
    const dz = playerPos.z - p.position[2];
    if (dx * dx + dz * dz < 1.5) {
      if (p.type === "health") {
        if (playerHealth >= 100) return p; // Don't pick up health if already full
        healthBonus = 25;
      }
      else if (p.type === "ammo") ammoBonus = 20;
      else if (p.type === "shotgun") { ammoBonus = 8; shotgunPickup = true; }
      return { ...p, active: false };
    }
    return p;
  });

  return { updatedPickups, healthBonus, ammoBonus, shotgunPickup };
}

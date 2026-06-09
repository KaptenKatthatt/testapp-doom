import * as THREE from "three";
import type { EnemyData, ProjectileData, PickupData, WallBox } from "./types";
import { audioManager } from "@/shared/audio/Audio";
import type { PlayerData } from "./Game";
import type { BarrelData } from "./Level";

// Pre-allocated reusable objects to avoid GC pressure per frame
const _v3a = new THREE.Vector3();
const _v3b = new THREE.Vector3();
const _v3c = new THREE.Vector3();
const _v3d = new THREE.Vector3();

const PROJECTILE_SPEED = 12;

const ENEMY_SPEEDS: Record<string, number> = {
  imp: 3.0,
  demon: 5.0,
  zombieman: 2.5,
  ratman: 2.5,
  mancubus: 1.6,
  cacodemon: 3.5,
};

const ENEMY_ATTACK_RANGES: Record<string, number> = {
  imp: 25,
  demon: 2.5,
  zombieman: 30,
  ratman: 30,
  mancubus: 20,
  cacodemon: 25,
};

const ENEMY_ATTACK_COOLDOWNS: Record<string, number> = {
  imp: 1.5,
  demon: 0.8,
  zombieman: 2.5,
  ratman: 2.5,
  mancubus: 3.5,
  cacodemon: 2.0,
};

const PROJECTILE_COLORS: Record<string, string> = {
  imp: "#ff6600",
  demon: "#ff0044",
  zombieman: "#88ff44",
  ratman: "#ccaa44",
  mancubus: "#ffaa00",
  cacodemon: "#00ffff",
};

/** Helper to update all projectiles in the game */
export function updateProjectilesHelper(
  dt: number,
  projectiles: ProjectileData[],
  player: { health: number; timesHit: number; damageFlash: number; position: THREE.Vector3 },
  enemies: EnemyData[],
  checkWallHit: (x: number, y: number, z: number) => boolean,
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
      if (checkWallHit(p.position[0], p.position[1], p.position[2])) return false;
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
          audioManager.play('player_pain');
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

    // Throttle line-of-sight checks to once every 150ms per enemy to optimize performance
    let canSeePlayer = false;
    let nextLosCheck = e.lastLosCheck;
    let nextLosResult = e.lastLosResult;

    if (e.lastLosCheck !== undefined && now - e.lastLosCheck < 0.15 && e.lastLosResult !== undefined) {
      canSeePlayer = e.lastLosResult;
    } else {
      canSeePlayer = hasLineOfSight(e.position[0], e.position[2], player.position.x, player.position.z);
      nextLosCheck = now;
      nextLosResult = canSeePlayer;
    }

    const alerted = e.hasAlerted || canSeePlayer;

    if (canSeePlayer && !e.hasAlerted) {
      const alertSounds: Record<string, string> = {
        imp: 'imp_alert',
        demon: 'demon_alert',
        zombieman: 'zombie_alert',
        ratman: 'zombie_alert',
        mancubus: 'demon_alert',
        cacodemon: 'imp_alert',
      };
      audioManager.play(alertSounds[e.type] ?? 'zombie_alert', 0.02);
    }

    if (!alerted) {
      // Not alerted yet, remain idle (no movement, no player tracking)
      return {
        ...e,
        hitFlash: newHitFlash,
        lastPosition: [e.position[0], 0, e.position[2]] as [number, number, number],
        lastLosCheck: nextLosCheck,
        lastLosResult: nextLosResult,
      };
    }

    // Always chase the player if alerted
    const dx = player.position.x - e.position[0];
    const dz = player.position.z - e.position[2];
    const len = Math.sqrt(dx * dx + dz * dz);
    const ndx = len > 0.01 ? dx / len : 0;
    const ndz = len > 0.01 ? dz / len : 0;

    if (dist > 1.2) {
      // Direct movement toward player
      const proposedX = e.position[0] + ndx * eSpeed * dt;
      const proposedZ = e.position[2] + ndz * eSpeed * dt;

      if (!checkCollision(_v3a.set(proposedX, 0, proposedZ), 0.6)) {
        // Can move directly toward player
        newX = proposedX;
        newZ = proposedZ;
      } else {
        // Blocked — try wall sliding (X or Z independently)
        let movedX = false;
        let movedZ = false;
        const slideXPos = e.position[0] + ndx * eSpeed * dt;
        const slideZPos = e.position[2] + ndz * eSpeed * dt;

        if (!checkCollision(_v3a.set(slideXPos, 0, e.position[2]), 0.6)) {
          newX = slideXPos;
          movedX = true;
        }
        if (!checkCollision(_v3a.set(e.position[0], 0, slideZPos), 0.6)) {
          newZ = slideZPos;
          movedZ = true;
        }

        // If stuck, try perpendicular or random directions
        if (!movedX && !movedZ) {
          const dxLast = e.position[0] - e.lastPosition[0];
          const dzLast = e.position[2] - e.lastPosition[2];
          const moved = dxLast * dxLast + dzLast * dzLast;

          if (moved < 0.05) {
            // Truly stuck — try 8 directions with smaller steps
            for (const [mx, mz] of [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]] as Array<[number, number]>) {
              const tryX = e.position[0] + mx * eSpeed * dt;
              const tryZ = e.position[2] + mz * eSpeed * dt;
              if (!checkCollision(_v3a.set(tryX, 0, tryZ), 0.5)) {
                newX = tryX;
                newZ = tryZ;
                break;
              }
            }
          } else {
            // Sliding — try perpendicular
            const perpX = -ndz * eSpeed * dt;
            const perpZ = ndx * eSpeed * dt;
            if (!checkCollision(_v3a.set(e.position[0] + perpX, 0, e.position[2] + perpZ), 0.6)) {
              newX = e.position[0] + perpX;
              newZ = e.position[2] + perpZ;
            } else if (!checkCollision(_v3a.set(e.position[0] - perpX, 0, e.position[2] - perpZ), 0.6)) {
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
        const projPos: [number, number, number] = [e.position[0] + ndx * 0.8, 1.5, e.position[2] + ndz * 0.8];
        const projColor = PROJECTILE_COLORS[e.type] ?? "#ff6600";
        spawnedProjectiles.push({
          id: nextId++,
          position: projPos,
          direction: projDir,
          speed: PROJECTILE_SPEED,
          fromEnemy: true,
          color: projColor,
          life: 3.5,
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
      lastLosCheck: nextLosCheck,
      lastLosResult: nextLosResult,
    };
  });

  return { updatedEnemies, spawnedProjectiles };
}

/** Helper to handle standing in nukage pools/slime damage */
export function checkSlimeDamageHelper(
  now: number,
  player: PlayerData,
  onGameOver: () => void,
  setGameActive: (active: boolean) => void,
  specialFloors?: Array<{ x: number; z: number; type: 'lava' | 'slime' }>
): number {
  let standingTileType: 'lava' | 'slime' | null = null;

  if (specialFloors && specialFloors.length > 0) {
    const gx = Math.floor(player.position.x);
    const gz = Math.floor(player.position.z);
    const standingTile = specialFloors.find(tile => tile.x === gx && tile.z === gz);
    if (standingTile) {
      standingTileType = standingTile.type;
    }
  }

  if (standingTileType) {
    if (now - player.lastEnvDmg > 1.0) {
      player.lastEnvDmg = now;
      const dmg = standingTileType === 'lava' ? 20 : 5;
      const nextHealth = Math.max(0, player.health - dmg);
      player.health = nextHealth;
      player.timesHit++;
      player.damageFlash = 1.0;
      audioManager.play('player_pain');

      if (nextHealth <= 0) {
        setGameActive(false);
        onGameOver();
        audioManager.play('player_death');
      }
      return nextHealth;
    }
  }

  return player.health;
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
  let changed = false;

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
      changed = true;
      return { ...p, active: false };
    }
    return p;
  });

  return { updatedPickups: changed ? updatedPickups : pickups, healthBonus, ammoBonus, shotgunPickup };
}

export function handlePlayerMovementHelper(
  dt: number,
  player: PlayerData,
  keys: Record<string, boolean>,
  mobileMove: [number, number],
  mobileLook: number,
  mobilePitch: number,
  checkCollision: (pos: THREE.Vector3, radius?: number) => boolean,
  checkEnemyCollision: (pos: THREE.Vector3, enemies: EnemyData[]) => boolean,
  enemies: EnemyData[]
): void {
  const speed = 8;
  _v3a.set(-Math.sin(player.rotation), 0, -Math.cos(player.rotation)); // forward
  _v3b.set(Math.cos(player.rotation), 0, -Math.sin(player.rotation)); // right
  _v3c.set(0, 0, 0); // move (reuse _v3c, reset)
  const forward = _v3a;
  const right = _v3b;
  const move = _v3c;

  if (keys["KeyW"] ?? false) move.add(forward);
  if (keys["KeyS"] ?? false) move.sub(forward);
  if (keys["KeyA"] ?? false) move.sub(right);
  if (keys["KeyD"] ?? false) move.add(right);

  const [moveX, moveY] = mobileMove;
  if (Math.abs(moveX) > 0.05 || Math.abs(moveY) > 0.05) {
    // Add mobile input without cloning
    move.x += forward.x * (-moveY) + right.x * moveX;
    move.z += forward.z * (-moveY) + right.z * moveX;
  }

  const MOBILE_TURN_SPEED = 2.5;
  const MOBILE_PITCH_SPEED = 1.5;
  if (Math.abs(mobileLook) > 0.05) {
    player.rotation -= mobileLook * MOBILE_TURN_SPEED * dt;
  }
  if (Math.abs(mobilePitch) > 0.05) {
    player.pitch -= mobilePitch * MOBILE_PITCH_SPEED * dt;
    player.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, player.pitch));
  }

  player.isMoving = move.length() > 0;
  if (move.length() > 0) {
    move.normalize().multiplyScalar(speed * dt);
  }

  const newPos = player.position.clone().add(move);
  const hitWall = checkCollision(newPos);
  const hitEnemy = checkEnemyCollision(newPos, enemies);
  if (!hitWall && !hitEnemy) {
    player.position.copy(newPos);
  } else if (!hitEnemy) {
    const slideX = player.position.clone();
    slideX.x += move.x;
    if (!checkCollision(slideX)) {
      player.position.x = slideX.x;
    }
    const slideZ = player.position.clone();
    slideZ.z += move.z;
    if (!checkCollision(slideZ)) {
      player.position.z = slideZ.z;
    }
  }
}

export function handlePlayerShootingHelper(
  player: PlayerData,
  now: number,
  camera: THREE.Camera,
  projectilesRef: { current: ProjectileData[] },
  projectileIdRef: { current: number },
  walls: WallBox[],
  enemiesRef: { current: EnemyData[] },
  setEnemies: (value: EnemyData[]) => void,
  barrelsRef?: React.MutableRefObject<BarrelData[]>,
  setBarrels?: React.Dispatch<React.SetStateAction<BarrelData[]>>
): void {
  if (!player.shooting) return;

  const currentWeapon = player.currentWeapon ?? "revolver";

  // --- REVOLVER ---
  if (currentWeapon === "revolver") {
    // Check reload / chamber state
    if (player.revolverReloadTimer > 0) return;
    
    if (player.revolverChamber <= 0) {
      if (player.bullets > 0) {
        player.revolverReloadTimer = 1.0;
        audioManager.play('shotgun_cock');
      } else {
        if (!player.hasPlayedEmptyClick) {
          audioManager.play('noway');
          player.hasPlayedEmptyClick = true;
        }
        player.shooting = false;
      }
      return;
    }

    if (now - player.lastShot > 0.3) {
      player.revolverChamber--;
      player.lastShot = now;
      player.shotsFired++;
      audioManager.play('pistol');
      player.shooting = false; // Semi-automatic: must click again

      // Trigger auto-reload if chamber is now empty
      if (player.revolverChamber === 0 && player.bullets > 0) {
        player.revolverReloadTimer = 1.0;
        setTimeout(() => audioManager.play('shotgun_cock'), 200);
      }

      spawnBullet(45, "#ffff44");
      applyDamage(22 + Math.random() * 8); // High power revolver hit!
    }
  }

  // --- SHOTGUN ---
  else if (currentWeapon === "shotgun") {
    if (player.shells <= 0) {
      if (!player.hasPlayedEmptyClick) {
        audioManager.play('noway');
        player.hasPlayedEmptyClick = true;
      }
      player.shooting = false;
      return;
    }

    if (now - player.lastShot > 0.6) {
      player.shells--;
      player.lastShot = now;
      player.shotsFired++;
      audioManager.play('shotgun');
      setTimeout(() => audioManager.play('shotgun_cock'), 300);
      player.shooting = false; // Semi-automatic: must click again

      spawnBullet(40, "#ffff22");
      applyDamage(15 + Math.random() * 10);
    }
  }

  // --- MACHINE GUN (DP-28) ---
  else if (currentWeapon === "machinegun") {
    // Check reload / mag state
    if (player.machinegunReloadTimer > 0) return;

    if (player.machinegunMag <= 0) {
      if (player.bullets > 0) {
        player.machinegunReloadTimer = 2.0;
        audioManager.play('shotgun_cock');
      } else {
        if (!player.hasPlayedEmptyClick) {
          audioManager.play('noway');
          player.hasPlayedEmptyClick = true;
        }
      }
      return;
    }

    if (now - player.lastShot > 0.1) {
      player.machinegunMag--;
      player.lastShot = now;
      player.shotsFired++;
      audioManager.play('pistol');
      // DO NOT reset player.shooting to false! (Fully automatic)

      // Trigger auto-reload if mag is now empty
      if (player.machinegunMag === 0 && player.bullets > 0) {
        player.machinegunReloadTimer = 2.0;
        setTimeout(() => audioManager.play('shotgun_cock'), 300);
      }

      spawnBullet(40, "#ffdd44");
      applyDamage(10 + Math.random() * 6); // Faster, slightly lower damage per bullet
    }
  }

  // Helper to spawn a projectile bullet
  function spawnBullet(speed: number, color: string): void {
    const camDir = _v3d; // reuse pre-allocated vector
    camera.getWorldDirection(camDir);
    const bulletDir: [number, number, number] = [camDir.x, camDir.y, camDir.z];
    const bulletPos: [number, number, number] = [
      camera.position.x + camDir.x * 1.5,
      camera.position.y + camDir.y * 0.5 - 0.1,
      camera.position.z + camDir.z * 1.5,
    ];
    const bullet: ProjectileData = {
      id: projectileIdRef.current++,
      position: bulletPos,
      direction: bulletDir,
      speed,
      fromEnemy: false,
      color,
      life: 1.5,
    };
    projectilesRef.current = [...projectilesRef.current, bullet];
  }

  // Helper to apply raycasted bullet hitscan damage
  function applyDamage(baseDamage: number): void {
    let closestTarget: { type: 'enemy'; e: EnemyData } | { type: 'barrel'; b: BarrelData } | null = null;
    let closestDist = Infinity;
    let closestDamage = 0;

    // 1. Check enemies
    for (const e of enemiesRef.current) {
      if (!e.alive) continue;
      for (const hitY of [1, 2.5]) {
        const ePos = new THREE.Vector3(e.position[0], hitY, e.position[2]);
        const dist = ePos.distanceTo(camera.position);
        if (dist > 50) continue;

        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const toEnemy = ePos.clone().sub(camera.position).normalize();
        const angle = dir.angleTo(toEnemy);

        const hitRange = Math.max(0.12, 0.45 / (dist / 5));
        if (angle < hitRange && dist < closestDist) {
          // Check line of sight
          const rayDir = ePos.clone().sub(camera.position).normalize();
          const rayLen = camera.position.distanceTo(ePos);
          let blocked = false;
          const raySteps = Math.ceil(rayLen * 2);
          for (let s = 1; s < raySteps; s++) {
            const t = s / raySteps;
            const px = camera.position.x + rayDir.x * rayLen * t;
            const py = camera.position.y + rayDir.y * rayLen * t;
            const pz = camera.position.z + rayDir.z * rayLen * t;
            for (const wall of walls) {
              if (px >= wall.min[0] && px <= wall.max[0] &&
                  py >= wall.min[1] && py <= wall.max[1] &&
                  pz >= wall.min[2] && pz <= wall.max[2]) {
                blocked = true;
                break;
              }
            }
            if (blocked) break;
          }
          if (blocked) continue;
          closestDist = dist;
          closestTarget = { type: 'enemy', e };
          closestDamage = baseDamage;
          break;
        }
      }
    }

    // 2. Check barrels
    if (barrelsRef?.current) {
      for (const b of barrelsRef.current) {
        if (!b.alive) continue;
        const bPos = new THREE.Vector3(b.position[0], 0.5, b.position[2]);
        const dist = bPos.distanceTo(camera.position);
        if (dist > 50) continue;

        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const toBarrel = bPos.clone().sub(camera.position).normalize();
        const angle = dir.angleTo(toBarrel);

        const hitRange = Math.max(0.12, 0.45 / (dist / 5));
        if (angle < hitRange && dist < closestDist) {
          // Check blocked by walls
          const rayDir = bPos.clone().sub(camera.position).normalize();
          const rayLen = camera.position.distanceTo(bPos);
          let blocked = false;
          const raySteps = Math.ceil(rayLen * 2);
          for (let s = 1; s < raySteps; s++) {
            const t = s / raySteps;
            const px = camera.position.x + rayDir.x * rayLen * t;
            const py = camera.position.y + rayDir.y * rayLen * t;
            const pz = camera.position.z + rayDir.z * rayLen * t;
            for (const wall of walls) {
              if (px >= wall.min[0] && px <= wall.max[0] &&
                  py >= wall.min[1] && py <= wall.max[1] &&
                  pz >= wall.min[2] && pz <= wall.max[2]) {
                blocked = true;
                break;
              }
            }
            if (blocked) break;
          }
          if (blocked) continue;
          closestDist = dist;
          closestTarget = { type: 'barrel', b };
          closestDamage = baseDamage;
        }
      }
    }

    // 3. Apply damage
    if (closestTarget) {
      if (closestTarget.type === 'enemy') {
        const targetEnemy = closestTarget.e;
        const updated = enemiesRef.current.map((e: EnemyData): EnemyData => {
          if (!e.alive) return e;
          if (e.id !== targetEnemy.id) return e;
          const newHealth = e.health - closestDamage;
          if (newHealth <= 0) {
            const deathSounds: Record<string, string> = { imp: 'imp_death', demon: 'demon_death', zombieman: 'zombie_death', ratman: 'zombie_death', mancubus: 'demon_death', cacodemon: 'demon_death' };
            audioManager.play(deathSounds[e.type] ?? 'imp_death');
            return { ...e, health: 0, alive: false, hitFlash: 0 };
          }
          return { ...e, health: newHealth, hitFlash: 1 };
        });
        enemiesRef.current = updated;
        setEnemies(updated);
      } else if (closestTarget.type === 'barrel' && setBarrels && barrelsRef) {
        const targetBarrel = closestTarget.b;
        setBarrels((prev: BarrelData[]): BarrelData[] => {
          const updated = prev.map((b: BarrelData): BarrelData => {
            if (b.id !== targetBarrel.id) return b;
            const newHealth = Math.max(0, b.health - closestDamage);
            return { ...b, health: newHealth };
          });
          barrelsRef.current = updated;
          return updated;
        });
      }
    }
  }
}

/** Helper to apply radial blast damage from exploding barrels */
export function explodeBarrelSplash(
  barrel: BarrelData,
  player: { health: number; timesHit: number; damageFlash: number; position: THREE.Vector3; kills: number; endTime: number },
  enemies: EnemyData[],
  onGameOver: () => void,
  setGameActive: (active: boolean) => void,
  barrels: BarrelData[],
  hasLineOfSight: (x1: number, z1: number, x2: number, z2: number) => boolean
): { updatedEnemies: EnemyData[]; updatedBarrels: BarrelData[] } {
  const bx = barrel.position[0];
  const bz = barrel.position[2];
  const maxRadius = 6.0;

  // 1. Damage Player
  const playerDist = player.position.distanceTo(new THREE.Vector3(bx, player.position.y, bz));
  if (playerDist <= maxRadius) {
    if (hasLineOfSight(bx, bz, player.position.x, player.position.z)) {
      const baseDmg = 70 + Math.random() * 5;
      const dmg = baseDmg * (1 - playerDist / maxRadius);
      player.health = Math.max(0, player.health - dmg);
      player.timesHit++;
      player.damageFlash = 1.0;
      audioManager.play('player_pain');
      if (player.health <= 0) {
        setGameActive(false);
        onGameOver();
        audioManager.play('player_death');
      }
    }
  }

  // 2. Damage Enemies
  const updatedEnemies = enemies.map(e => {
    if (!e.alive) return e;
    const dist = Math.sqrt((e.position[0] - bx) ** 2 + (e.position[2] - bz) ** 2);
    if (dist <= maxRadius) {
      if (hasLineOfSight(bx, bz, e.position[0], e.position[2])) {
        const baseDmg = 70 + Math.random() * 5;
        const dmg = baseDmg * (1 - dist / maxRadius);
        const nextHP = Math.max(0, e.health - dmg);
        if (nextHP <= 0) {
          const deathSounds: Record<string, string> = { imp: 'imp_death', demon: 'demon_death', zombieman: 'zombie_death', ratman: 'zombie_death', mancubus: 'demon_death', cacodemon: 'demon_death' };
          audioManager.play(deathSounds[e.type] ?? 'imp_death');
          return { ...e, health: 0, alive: false, hitFlash: 0 };
        }
        return { ...e, health: nextHP, hitFlash: 1.0 };
      }
    }
    return e;
  });

  // 3. Damage other Barrels (chain reactions)
  const updatedBarrels = barrels.map(other => {
    if (other.id === barrel.id || !other.alive) return other;
    const dist = Math.sqrt((other.position[0] - bx) ** 2 + (other.position[2] - bz) ** 2);
    if (dist <= maxRadius) {
      if (hasLineOfSight(bx, bz, other.position[0], other.position[2])) {
        const baseDmg = 70 + Math.random() * 5;
        const dmg = baseDmg * (1 - dist / maxRadius);
        const nextHP = Math.max(0, other.health - dmg);
        return { ...other, health: nextHP };
      }
    }
    return other;
  });

  return { updatedEnemies, updatedBarrels };
}

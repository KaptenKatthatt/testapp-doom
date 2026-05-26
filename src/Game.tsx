import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Level, { getWalls } from "./Level";
import Enemies from "./Enemies";
import Weapons from "./Weapons";
import Pickups from "./Pickups";
import Projectiles from "./Projectiles";
import { audioManager } from "./Audio";
import { updateDoor, getDoorVisual, getDoorCollisionBox, INITIAL_DOORS } from "./Doors";
import type { DoorData } from "./Doors";
import { createDoorTexture } from "./Textures";
import type {
  PlayerState,
  EnemyData,
  PickupData,
  WallBox,
  ProjectileData,
} from "./types";
import {
  updateProjectilesHelper,
  updateEnemyAIHelper,
  checkSlimeDamageHelper,
  updatePickupCollectionHelper,
} from "./GameHelpers";

const COLLISION_MARGIN = 0.4;

interface GameProps {
  readonly onPlayerState: (state: PlayerState) => void;
  readonly onGameOver: () => void;
  readonly onMissionComplete: () => void;
  readonly mobileMoveRef: React.MutableRefObject<[number, number]>;
  readonly mobileLookRef: React.MutableRefObject<number>;
  readonly mobilePitchRef: React.MutableRefObject<number>;
  readonly useActionRef: React.MutableRefObject<boolean>;
}

interface PlayerData {
  position: THREE.Vector3;
  rotation: number;
  pitch: number;
  health: number;
  ammo: number;
  kills: number;
  shotsFired: number;
  timesHit: number;
  startTime: number;
  endTime: number;
  shooting: boolean;
  lastShot: number;
  lastContactDmg: number;
  damageFlash: number;
  isMoving: boolean;
}

const INITIAL_ENEMIES: EnemyData[] = [
  // L-Corridor zombiemen
  { id: 1, position: [2, 0, 12], type: "zombieman", health: 35, maxHealth: 35, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [2, 0, 12] as [number, number, number], hasAlerted: false },
  { id: 2, position: [10, 0, 15], type: "zombieman", health: 35, maxHealth: 35, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [10, 0, 15] as [number, number, number], hasAlerted: false },
  // Slime Room imps
  { id: 3, position: [8, 0, 22], type: "imp", health: 45, maxHealth: 45, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [8, 0, 22] as [number, number, number], hasAlerted: false },
  { id: 4, position: [18, 0, 26], type: "imp", health: 45, maxHealth: 45, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [18, 0, 26] as [number, number, number], hasAlerted: false },
  // Extra enemies
  { id: 5, position: [15, 0, 20], type: "demon", health: 80, maxHealth: 80, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [15, 0, 20] as [number, number, number], hasAlerted: false },
  { id: 6, position: [6, 0, 16], type: "imp", health: 45, maxHealth: 45, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [6, 0, 16] as [number, number, number], hasAlerted: false },
  // North corridor
  { id: 7, position: [13, 0, 32], type: "zombieman", health: 35, maxHealth: 35, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [13, 0, 32] as [number, number, number], hasAlerted: false },
];

const INITIAL_PICKUPS: PickupData[] = [
  // Start room health pickups (corners)
  { id: 1, position: [1, 0.3, 1], type: "health", active: true },
  { id: 2, position: [9, 0.3, 1], type: "health", active: true },
  // L-Corridor ammo
  { id: 3, position: [1, 0.3, 12], type: "ammo", active: true },
  { id: 4, position: [12, 0.3, 16], type: "ammo", active: true },
  // Slime room pickups
  { id: 5, position: [10, 0.3, 22], type: "health", active: true },
  { id: 6, position: [18, 0.3, 28], type: "shotgun", active: true },
  // North corridor ammo
  { id: 7, position: [13, 0.3, 33], type: "ammo", active: true },
];


export default function Game({ onPlayerState, onGameOver, onMissionComplete, mobileMoveRef, mobileLookRef, mobilePitchRef, useActionRef }: GameProps): React.JSX.Element {
  const playerRef = useRef<PlayerData>({
    position: new THREE.Vector3(3, 1.7, 4),
    rotation: Math.PI / 2,
    pitch: 0,
    health: 100,
    ammo: 50,
    kills: 0,
    shotsFired: 0,
    timesHit: 0,
    startTime: performance.now() / 1000,
    endTime: 0,
    shooting: false,
    lastShot: 0,
    lastContactDmg: 0,
    damageFlash: 0,
    isMoving: false,
  });
  const keysRef = useRef<Record<string, boolean>>({});
  const projectilesRef = useRef<ProjectileData[]>([]);
  const projectileIdRef = useRef(0);
  const missionCompleteRef = useRef(false);
  const gameActiveRef = useRef(true);
  const { camera } = useThree();
  const pullbackRef = useRef(0);
  const doorTexture = useMemo(() => createDoorTexture(), []);
  const [enemies, setEnemies] = useState<EnemyData[]>(INITIAL_ENEMIES);
  const enemiesRef = useRef<EnemyData[]>(INITIAL_ENEMIES);
  const [pickups, setPickups] = useState<PickupData[]>(INITIAL_PICKUPS);
  const [doors, setDoors] = useState<DoorData[]>(INITIAL_DOORS);
  const doorsRef = useRef<DoorData[]>(INITIAL_DOORS);
  // Keep doors ref in sync for collision checks
  useEffect(() => {
    doorsRef.current = doors;
  }, [doors]);
  const [projectiles, setProjectiles] = useState<ProjectileData[]>([]);

  const walls: WallBox[] = useMemo(() => getWalls(), []);

  const handlePlayerState = useCallback((): void => {
    const p = playerRef.current;
    onPlayerState({
      health: Math.round(p.health),
      ammo: p.ammo,
      kills: p.kills,
      shotsFired: p.shotsFired,
      timesHit: p.timesHit,
      startTime: p.startTime,
      endTime: p.endTime,
      damageFlash: p.damageFlash,
    });
  }, [onPlayerState]);

  // Input handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      keysRef.current[e.code] = true;
      if (e.code === "Escape") {
        document.exitPointerLock?.();
      }
      if (e.code === "KeyE" && useActionRef) {
        useActionRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent): void => {
      keysRef.current[e.code] = false;
    };
    const handleMouseDown = (e: MouseEvent): void => {
      if (e.button === 0) {
        if (!gameActiveRef.current) return;
        if (!document.pointerLockElement) {
          document.body.requestPointerLock?.();
        }
        playerRef.current.shooting = true;
      }
    };
    const handleMouseUp = (e: MouseEvent): void => {
      if (e.button === 0) {
        playerRef.current.shooting = false;
      }
    };
    const handleMouseMove = (e: MouseEvent): void => {
      if (document.pointerLockElement) {
        playerRef.current.rotation -= e.movementX * 0.002;
        playerRef.current.pitch -= e.movementY * 0.002;
        playerRef.current.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, playerRef.current.pitch));
      }
    };

    const handleGameShoot = ((e: Event): void => {
      const detail = (e as CustomEvent<{ shooting: boolean }>).detail;
      playerRef.current.shooting = detail.shooting;
    }) as EventListener;

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("game-shoot", handleGameShoot);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("game-shoot", handleGameShoot);
    };
  }, []);

  // Collision detection
  const checkCollision = useCallback((pos: THREE.Vector3, radius: number = COLLISION_MARGIN): boolean => {
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
    for (const door of doorsRef.current) {
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
    return false;
  }, [walls]);

  // Check if a point hits a wall (for projectiles)
  const checkWallHit = useCallback((x: number, z: number): boolean => {
    for (const wall of walls) {
      if (x >= wall.min[0] && x <= wall.max[0] && z >= wall.min[2] && z <= wall.max[2]) {
        return true;
      }
    }
    return false;
  }, [walls]);

  // Check if position collides with any alive enemy
  const checkEnemyCollision = useCallback((pos: THREE.Vector3, currentEnemies: EnemyData[], radius = 0.8): boolean => {
    for (const e of currentEnemies) {
      if (!e.alive) continue;
      const dx = pos.x - e.position[0];
      const dz = pos.z - e.position[2];
      if (dx * dx + dz * dz < radius * radius) {
        return true;
      }
    }
    return false;
  }, []);

  // Check line of sight between two points (no wall in between)
  const hasLineOfSight = useCallback((x1: number, z1: number, x2: number, z2: number): boolean => {
    const steps = Math.ceil(Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2) * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = x1 + (x2 - x1) * t;
      const cz = z1 + (z2 - z1) * t;
      for (const wall of walls) {
        if (cx >= wall.min[0] && cx <= wall.max[0] && cz >= wall.min[2] && cz <= wall.max[2]) {
          return false;
        }
      }
    }
    return true;
  }, [walls]);

  // Main game loop
  useFrame((_state, delta) => {
    const player = playerRef.current;
    if (player.health <= 0) return;

    const dt = Math.min(delta, 0.05);
    const keys = keysRef.current;
    const speed = 8;
    const now = performance.now() / 1000;

    // Movement
    const forward = new THREE.Vector3(
      -Math.sin(player.rotation),
      0,
      -Math.cos(player.rotation),
    );
    const right = new THREE.Vector3(
      Math.cos(player.rotation),
      0,
      -Math.sin(player.rotation),
    );
    const move = new THREE.Vector3();

    if (keys["KeyW"] ?? false) move.add(forward);
    if (keys["KeyS"] ?? false) move.sub(forward);
    if (keys["KeyA"] ?? false) move.sub(right);
    if (keys["KeyD"] ?? false) move.add(right);

    // Mobile joystick input
    const [moveX, moveY] = mobileMoveRef.current;
    if (Math.abs(moveX) > 0.05 || Math.abs(moveY) > 0.05) {
      const mobileForward = forward.clone().multiplyScalar(-moveY);
      const mobileRight = right.clone().multiplyScalar(moveX);
      move.add(mobileForward).add(mobileRight);
    }

    // Mobile look input (joystick position × speed × dt)
    const MOBILE_TURN_SPEED = 2.5;
    const MOBILE_PITCH_SPEED = 1.5;
    const lookX = mobileLookRef.current;
    const lookY = mobilePitchRef.current;
    if (Math.abs(lookX) > 0.05) {
      player.rotation -= lookX * MOBILE_TURN_SPEED * dt;
    }
    if (Math.abs(lookY) > 0.05) {
      player.pitch -= lookY * MOBILE_PITCH_SPEED * dt;
      player.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, player.pitch));
    }

    player.isMoving = move.length() > 0;
    if (move.length() > 0) {
      move.normalize().multiplyScalar(speed * dt);
    }

    // Collision resolution with wall sliding + enemy collision
    const newPos = player.position.clone().add(move);
    const hitWall = checkCollision(newPos);
    const hitEnemy = checkEnemyCollision(newPos, enemiesRef.current);
    if (!hitWall && !hitEnemy) {
      player.position.copy(newPos);
    } else if (!hitEnemy) {
      // Wall slide
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
    // If hitEnemy, don't move at all (can't walk through monsters)

    // Contact damage: if player is very close to any alive enemy, take damage
    const contactRadius = 1.0;
    for (const e of enemiesRef.current) {
      if (!e.alive) continue;
      const cdx = player.position.x - e.position[0];
      const cdz = player.position.z - e.position[2];
      if (cdx * cdx + cdz * cdz < contactRadius * contactRadius) {
        // Only damage if no wall between player and enemy
        if (!hasLineOfSight(e.position[0], e.position[2], player.position.x, player.position.z)) continue;
        if (now - player.lastContactDmg > 0.5) {
          player.lastContactDmg = now;
          player.health = Math.max(0, player.health - 2);
          player.timesHit++;
          player.damageFlash = 1;
          audioManager.play('player_pain');
          if (player.health <= 0) {
            gameActiveRef.current = false;
            onGameOver();
            audioManager.play('player_death');
          }
        }
        break;
      }
    }

    // Also trigger flash on ranged damage (already applied in setEnemies callback)
    // Fade damage flash
    if (player.damageFlash > 0) {
      player.damageFlash = Math.max(0, player.damageFlash - dt * 2);
    }

    // Camera follow with pitch
    camera.position.set(player.position.x, player.position.y, player.position.z);
    const lookDir = new THREE.Vector3(
      -Math.sin(player.rotation) * Math.cos(player.pitch),
      Math.sin(player.pitch),
      -Math.cos(player.rotation) * Math.cos(player.pitch),
    );
    const lookTarget = camera.position.clone().add(lookDir.multiplyScalar(10));
    camera.lookAt(lookTarget);
    camera.updateMatrixWorld(true);

    // Shooting - pump action: one shot per click
    if (player.shooting && now - player.lastShot > 0.6 && player.ammo > 0) {
      player.ammo--;
      player.lastShot = now;
      player.shotsFired++;
      audioManager.play('shotgun');
      // Pump sound plays after a short delay (matches Doom pump timing)
      setTimeout(() => audioManager.play('shotgun_cock'), 300);
      player.shooting = false; // Reset: must click again for next shot

      // Spawn player bullet projectile
      const camDir = new THREE.Vector3();
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
        speed: 40,
        fromEnemy: false,
        color: "#ffff44",
        life: 1.5,
      };
      projectilesRef.current = [...projectilesRef.current, bullet];

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      raycaster.far = 50;

      setEnemies((prev: EnemyData[]): EnemyData[] => {
        // Find the closest enemy in the hit cone — only damage that one
        let closestEnemy: EnemyData | null = null;
        let closestDist = Infinity;
        let closestDamage = 0;

        for (const e of prev) {
          if (!e.alive) continue;
          const ePos = new THREE.Vector3(e.position[0], 1, e.position[2]);
          const dist = ePos.distanceTo(camera.position);
          if (dist > 50) continue;

          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
          const toEnemy = ePos.clone().sub(camera.position).normalize();
          const angle = dir.angleTo(toEnemy);

          const hitRange = Math.max(0.12, 0.45 / (dist / 5));
          if (angle < hitRange && dist < closestDist) {
            // Can't shoot through walls
            if (!hasLineOfSight(camera.position.x, camera.position.z, e.position[0], e.position[2])) continue;
            closestDist = dist;
            closestEnemy = e;
            closestDamage = 15 + Math.random() * 10;
          }
        }

        const updated = prev.map((e: EnemyData): EnemyData => {
          if (!e.alive) return e;
          if (e !== closestEnemy) return e;
          const newHealth = e.health - closestDamage;
          if (newHealth <= 0) {
            player.kills++;
            const totalEnemies = INITIAL_ENEMIES.length;
            if (player.kills >= totalEnemies && !missionCompleteRef.current) {
              missionCompleteRef.current = true;
              gameActiveRef.current = false;
              player.endTime = now;
              onPlayerState({
                health: Math.round(player.health),
                ammo: player.ammo,
                kills: player.kills,
                shotsFired: player.shotsFired,
                timesHit: player.timesHit,
                startTime: player.startTime,
                endTime: now,
                damageFlash: 0,
              });
              onMissionComplete();
            }
            const deathSounds: Record<string, string> = { imp: 'imp_death', demon: 'demon_death', zombieman: 'zombie_death' };
            audioManager.play(deathSounds[e.type] ?? 'imp_death');
            return { ...e, health: 0, alive: false, hitFlash: 0 };
          }
          return { ...e, health: newHealth, hitFlash: 1 };
        });
        return updated;
      });
    }    // Enemy AI + projectile spawning
    const { updatedEnemies, spawnedProjectiles } = updateEnemyAIHelper(
      dt,
      now,
      player,
      enemiesRef.current,
      checkCollision,
      hasLineOfSight,
      projectileIdRef.current
    );
    projectileIdRef.current += spawnedProjectiles.length;
    projectilesRef.current = [...projectilesRef.current, ...spawnedProjectiles];
    setEnemies(updatedEnemies);

    // Update projectiles
    projectilesRef.current = updateProjectilesHelper(
      dt,
      projectilesRef.current,
      player,
      enemiesRef.current,
      checkWallHit,
      onGameOver,
      (active) => { gameActiveRef.current = active; }
    );
    setProjectiles([...projectilesRef.current]);

    // Pickup collection
    const { updatedPickups, healthBonus, ammoBonus, shotgunPickup } = updatePickupCollectionHelper(
      player.position,
      pickups
    );
    setPickups(updatedPickups);
    if (healthBonus > 0) { player.health = Math.min(100, player.health + healthBonus); audioManager.play('item_pickup'); }
    if (ammoBonus > 0) { player.ammo += ammoBonus; audioManager.play('shotgun' in audioManager ? 'weapon_pickup' : 'item_pickup'); }
    if (shotgunPickup) { audioManager.play('weapon_pickup'); }

    // Update doors
    const playerPos: [number, number, number] = [player.position.x, 0, player.position.z];
    const useAct = useActionRef ? useActionRef.current : false;
    setDoors((prev: DoorData[]): DoorData[] =>
      prev.map((d: DoorData): DoorData => updateDoor(d, dt, playerPos, useAct))
    );

    // Reset use action after processing
    if (useActionRef) useActionRef.current = false;

    // Calculate tactical weapon pullback when close to walls/doors
    const pullbackLookDir = new THREE.Vector3();
    camera.getWorldDirection(pullbackLookDir);
    const ray = new THREE.Ray(camera.position, pullbackLookDir);
    let minDistance = 1.2; // Max distance we care about for pullback

    const boxes: THREE.Box3[] = [];
    for (const wall of walls) {
      boxes.push(new THREE.Box3(
        new THREE.Vector3(wall.min[0], 0, wall.min[2]),
        new THREE.Vector3(wall.max[0], wall.max[1], wall.max[2])
      ));
    }
    for (const door of doorsRef.current) {
      const doorBox = getDoorCollisionBox(door);
      if (doorBox) {
        boxes.push(new THREE.Box3(
          new THREE.Vector3(doorBox.min[0], 0, doorBox.min[2]),
          new THREE.Vector3(doorBox.max[0], doorBox.max[1], doorBox.max[2])
        ));
      }
    }

    for (const box of boxes) {
      const target = new THREE.Vector3();
      if (ray.intersectBox(box, target)) {
        const dist = camera.position.distanceTo(target);
        if (dist < minDistance) {
          minDistance = dist;
        }
      }
    }

    const pullbackThreshold = 0.95; // Weapon extends ~0.9 units
    const pullbackVal = minDistance < pullbackThreshold
      ? (pullbackThreshold - minDistance) / (pullbackThreshold - 0.4)
      : 0;
    pullbackRef.current = Math.max(0, Math.min(1, pullbackVal));

    // Nukage/slime damage — 1 damage per second when standing in slime zones
    player.health = checkSlimeDamageHelper(
      dt,
      player.position,
      player.health,
      onGameOver,
      (active) => { gameActiveRef.current = active; }
    );

    handlePlayerState();
  });

  return (
    <>
      <Level />
      {/* Doors */}
      {doors.map((door: DoorData) => {
        const visual = getDoorVisual(door);
        return (
          <mesh key={`door-${door.id}`} position={visual.position}>
            <boxGeometry args={visual.size} />
            <meshLambertMaterial
              map={doorTexture}
              color={door.isSecret ? 0x553322 : 0xcc7744}
              emissive={door.isSecret ? 0x221100 : 0x664400}
              emissiveIntensity={door.isSecret ? 0.3 : 0.6}
            />
          </mesh>
        );
      })}
      <Enemies enemies={enemies} />
      <Pickups pickups={pickups} />
      <Projectiles projectiles={projectiles} />
      <Weapons
        shooting={playerRef.current.shooting}
        lastShot={playerRef.current.lastShot}
        isMoving={playerRef.current.isMoving}
        pullbackRef={pullbackRef}
      />
    </>
  );
}
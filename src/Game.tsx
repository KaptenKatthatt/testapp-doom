import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Level, { getWalls, getBarrels } from "./Level";
import type { BarrelData } from "./Level";
import Enemies from "./Enemies";
import Weapons from "./Weapons";
import Pickups from "./Pickups";
import Projectiles from "./Projectiles";
import { audioManager } from "./Audio";
import { updateDoor, getDoorVisual, getDoorCollisionBox, INITIAL_DOORS } from "./Doors";
import type { DoorData } from "./Doors";
import { createDoorTexture, createBarrelTexture } from "./Textures";
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
  explodeBarrelSplash,
} from "./GameHelpers";

const COLLISION_MARGIN = 0.4;

interface CustomLevelData {
  walls: Array<{ x: number; z: number; w: number; d: number; isDoor: boolean }>;
  enemies: Array<{ id: number; x: number; z: number; type: string }>;
  pickups: Array<{ id: number; x: number; z: number; type: string }>;
  playerStart: [number, number];
  barrels?: Array<{ id: number; x: number; z: number }>;
  specialFloors?: Array<{ x: number; z: number; type: 'lava' | 'slime' }>;
}

interface GameProps {
  readonly onPlayerState: (state: PlayerState) => void;
  readonly onGameOver: () => void;
  readonly onMissionComplete: () => void;
  readonly mobileMoveRef: React.MutableRefObject<[number, number]>;
  readonly mobileLookRef: React.MutableRefObject<number>;
  readonly mobilePitchRef: React.MutableRefObject<number>;
  readonly useActionRef: React.MutableRefObject<boolean>;
  readonly levelData?: CustomLevelData | null;
  readonly paused?: boolean;
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
  { id: 0, position: [20, 0, 14], type: "imp", health: 45, maxHealth: 45, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [20, 0, 14] as [number, number, number], hasAlerted: false },
  { id: 1, position: [36, 0, 28], type: "imp", health: 45, maxHealth: 45, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [36, 0, 28] as [number, number, number], hasAlerted: false },
  { id: 2, position: [20, 0, 2], type: "imp", health: 45, maxHealth: 45, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [20, 0, 2] as [number, number, number], hasAlerted: false },
  { id: 3, position: [14, 0, 18], type: "imp", health: 45, maxHealth: 45, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [14, 0, 18] as [number, number, number], hasAlerted: false },
  { id: 4, position: [30, 0, 12], type: "demon", health: 80, maxHealth: 80, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [30, 0, 12] as [number, number, number], hasAlerted: false },
  { id: 5, position: [36, 0, 8], type: "imp", health: 45, maxHealth: 45, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [36, 0, 8] as [number, number, number], hasAlerted: false },
  { id: 6, position: [28, 0, 28], type: "imp", health: 45, maxHealth: 45, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [28, 0, 28] as [number, number, number], hasAlerted: false },
  { id: 7, position: [36, 0, 12], type: "demon", health: 80, maxHealth: 80, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [36, 0, 12] as [number, number, number], hasAlerted: false },
  { id: 8, position: [10, 0, 26], type: "imp", health: 45, maxHealth: 45, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [10, 0, 26] as [number, number, number], hasAlerted: false },
  { id: 9, position: [34, 0, 14], type: "zombieman", health: 35, maxHealth: 35, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [34, 0, 14] as [number, number, number], hasAlerted: false },
  { id: 10, position: [18, 0, 34], type: "zombieman", health: 35, maxHealth: 35, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [18, 0, 34] as [number, number, number], hasAlerted: false },
];

const INITIAL_PICKUPS: PickupData[] = [
  { id: 1, position: [10, 0.3, 10], type: "health", active: true },
  { id: 2, position: [28, 0.3, 16], type: "ammo", active: true },
  { id: 3, position: [38, 0.3, 14], type: "health", active: true },
  { id: 4, position: [3, 0.3, 20], type: "ammo", active: true },
  { id: 5, position: [32, 0.3, 26], type: "health", active: true },
  { id: 6, position: [12, 0.3, 30], type: "shotgun", active: true },
  { id: 7, position: [42, 0.3, 40], type: "ammo", active: true },
];


export default function Game({ onPlayerState, onGameOver, onMissionComplete, mobileMoveRef, mobileLookRef, mobilePitchRef, useActionRef, levelData, paused }: GameProps): React.JSX.Element {
  const barrelTexture = useMemo(() => createBarrelTexture(), []);
  // Use custom level data if provided, otherwise defaults
  const customEnemies: EnemyData[] = levelData ? levelData.enemies.map(e => {
    const hp = e.type === 'imp' ? 45 : e.type === 'demon' ? 80 : 35;
    return { id: e.id, position: [e.x, 0, e.z] as [number, number, number], type: e.type as "imp" | "demon" | "zombieman", health: hp, maxHealth: hp, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [e.x, 0, e.z] as [number, number, number], hasAlerted: false };
  }) : INITIAL_ENEMIES;
  const customPickups: PickupData[] = levelData ? levelData.pickups.map(p => ({ id: p.id, position: [p.x, 0.3, p.z] as [number, number, number], type: p.type as "health" | "ammo" | "shotgun", active: true })) : INITIAL_PICKUPS;
  const customPlayerStart: [number, number] | null = levelData ? levelData.playerStart : null;

  const playerRef = useRef<PlayerData>({
    position: new THREE.Vector3(customPlayerStart ? customPlayerStart[0] : 2, 1.7, customPlayerStart ? customPlayerStart[1] : 3),
    rotation: -Math.PI / 2,
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
  // Use custom level data if provided, otherwise defaults
  // Build custom doors from level data
  const customDoors: DoorData[] = useMemo(() => {
    if (!levelData || levelData.walls.length === 0) return INITIAL_DOORS;
    const doorWalls = levelData.walls.filter(w => w.isDoor);
    return doorWalls.map((w, i) => ({
      id: 1000 + i, // offset to avoid clash with hardcoded doors
      position: [w.x + w.w / 2, 2, w.z + w.d / 2] as [number, number, number],
      size: [w.w, 4, w.d] as [number, number, number],
      state: 'closed' as const,
      timer: 0,
      autoClose: 4.0,
      isSecret: false,
      triggerDistance: 2.5,
    }));
  }, [levelData]);

  const [enemies, setEnemies] = useState<EnemyData[]>(customEnemies);
  const enemiesRef = useRef<EnemyData[]>(customEnemies);
  const [pickups, setPickups] = useState<PickupData[]>(customPickups);
  const [doors, setDoors] = useState<DoorData[]>(customDoors);
  const doorsRef = useRef<DoorData[]>(customDoors);
  // Keep doors ref in sync for collision checks
  useEffect(() => {
    doorsRef.current = doors;
  }, [doors]);
  const [projectiles, setProjectiles] = useState<ProjectileData[]>([]);

  // Build wall data for Level component and collision
  // Doors are rendered separately by the door system, so exclude them from walls
  const customWallData = useMemo(() => {
    if (levelData && levelData.walls.length > 0) {
      return levelData.walls
        .filter(w => !w.isDoor)
        .map(w => ({ x: w.x, y: 2, z: w.z, w: w.w, h: 4, d: w.d, color: w.isDoor ? 0xcc0000 : 0x8b7355, isDoor: w.isDoor }));
    }
    return null;
  }, [levelData]);

  const walls: WallBox[] = useMemo(() => {
    if (customWallData) return getWalls(customWallData);
    return getWalls();
  }, [customWallData]);
  const customBarrels: BarrelData[] = useMemo(() => {
    if (levelData && levelData.barrels) {
      return levelData.barrels.map((b: { id: number; x: number; z: number }) => ({
        id: b.id,
        position: [b.x + 0.5, 0.5, b.z + 0.5] as [number, number, number],
        radius: 0.4,
        health: 20,
        maxHealth: 20,
        alive: true,
        explosionTimer: 0,
      }));
    }
    return getBarrels();
  }, [levelData]);

  const [barrels, setBarrels] = useState<BarrelData[]>(customBarrels);
  const barrelsRef = useRef<BarrelData[]>(customBarrels);
  useEffect(() => {
    barrelsRef.current = barrels;
  }, [barrels]);

  const specialFloors = useMemo(() => {
    return levelData?.specialFloors ?? [];
  }, [levelData]);

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
    // Also check barrels
    for (const barrel of barrelsRef.current) {
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
  }, [walls]);

  // Check if a point hits a door (only when closed)
  const checkDoorHit = useCallback((x: number, z: number): boolean => {
    for (const door of doorsRef.current) {
      const doorBox = getDoorCollisionBox(door);
      if (!doorBox) continue;
      if (x >= doorBox.min[0] && x <= doorBox.max[0] && z >= doorBox.min[2] && z <= doorBox.max[2]) {
        return true;
      }
    }
    return false;
  }, []);

  // Check if a point hits a wall or barrel (for projectiles)
  const checkWallHit = useCallback((x: number, z: number): boolean => {
    for (const wall of walls) {
      if (x >= wall.min[0] && x <= wall.max[0] && z >= wall.min[2] && z <= wall.max[2]) {
        return true;
      }
    }
    if (checkDoorHit(x, z)) return true;
    // Check barrels
    for (const barrel of barrelsRef.current) {
      if (!barrel.alive) continue;
      const dx = x - barrel.position[0];
      const dz = z - barrel.position[2];
      if (dx * dx + dz * dz < barrel.radius * barrel.radius) {
        return true;
      }
    }
    return false;
  }, [walls, checkDoorHit]);

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

  // Check line of sight between two points (no wall or door in between)
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
      if (checkDoorHit(cx, cz)) {
        return false;
      }
    }
    return true;
  }, [walls, checkDoorHit]);

  // Main game loop
  useFrame((_state, delta) => {
    const player = playerRef.current;
    if (player.health <= 0) return;

    if (paused) {
      // Pause camera setup - keep camera sync but skip all logic
      camera.position.set(player.position.x, player.position.y, player.position.z);
      const lookDir = new THREE.Vector3(
        -Math.sin(player.rotation) * Math.cos(player.pitch),
        Math.sin(player.pitch),
        -Math.cos(player.rotation) * Math.cos(player.pitch),
      );
      const lookTarget = camera.position.clone().add(lookDir.multiplyScalar(10));
      camera.lookAt(lookTarget);
      camera.updateMatrixWorld(true);
      return;
    }

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
            // Check blocked by walls
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
            closestDamage = 15 + Math.random() * 10;
            break;
          }
        }
      }

      // 2. Check barrels
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
          closestDamage = 15 + Math.random() * 10;
        }
      }

      // 3. Apply damage
      if (closestTarget) {
        if (closestTarget.type === 'enemy') {
          const targetEnemy = closestTarget.e;
          setEnemies((prev) => {
            const updated = prev.map((e) => {
              if (e.id !== targetEnemy.id) return e;
              const newHealth = e.health - closestDamage;
              if (newHealth <= 0) {
                player.kills++;
                const deathSounds: Record<string, string> = { imp: 'imp_death', demon: 'demon_death', zombieman: 'zombie_death' };
                audioManager.play(deathSounds[e.type] ?? 'imp_death');
                return { ...e, health: 0, alive: false, hitFlash: 0 };
              }
              return { ...e, health: newHealth, hitFlash: 1 };
            });
            enemiesRef.current = updated;
            return updated;
          });
        } else {
          const targetBarrel = closestTarget.b;
          setBarrels((prev) => {
            const updated = prev.map((b) => {
              if (b.id !== targetBarrel.id) return b;
              const newHealth = Math.max(0, b.health - closestDamage);
              return { ...b, health: newHealth };
            });
            barrelsRef.current = updated;
            return updated;
          });
        }
      }
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
    enemiesRef.current = updatedEnemies;
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
      pickups,
      player.health
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

    // Exit Switch interaction — only for default level (no custom levelData)
    if (!levelData) {
    const switchX = 16;
    const switchZ = 36.35;
    const sdx = player.position.x - switchX;
    const sdz = player.position.z - switchZ;
    const distToSwitch = Math.sqrt(sdx * sdx + sdz * sdz);
    if (useAct && distToSwitch < 2.2) {
      if (!missionCompleteRef.current) {
        missionCompleteRef.current = true;
        gameActiveRef.current = false;
        player.endTime = now;
        audioManager.play('switch');
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
    }
    }

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

    // Process barrel explosions and fade explosion timers
    setBarrels((prevBarrels) => {
      let changed = false;
      const nextBarrels = prevBarrels.map(b => {
        if (!b.alive && b.explosionTimer > 0) {
          changed = true;
          return { ...b, explosionTimer: Math.max(0, b.explosionTimer - dt * 2.5) };
        }
        if (b.alive && b.health <= 0) {
          changed = true;
          audioManager.play('explosion');
          const { updatedEnemies } = explodeBarrelSplash(
            b,
            playerRef.current,
            enemiesRef.current,
            onGameOver,
            (active) => { gameActiveRef.current = active; },
            prevBarrels,
            hasLineOfSight
          );
          setEnemies(updatedEnemies);
          return { ...b, alive: false, explosionTimer: 1.0 };
        }
        return b;
      });

      const exploded = nextBarrels.find(b => !b.alive && b.explosionTimer === 1.0);
      if (exploded) {
        const originalExploded = prevBarrels.find(b => b.id === exploded.id);
        if (originalExploded && originalExploded.alive) {
          const { updatedBarrels } = explodeBarrelSplash(
            originalExploded,
            playerRef.current,
            enemiesRef.current,
            onGameOver,
            (active) => { gameActiveRef.current = active; },
            prevBarrels,
            hasLineOfSight
          );
          return nextBarrels.map(b => {
            if (b.id === exploded.id) return b;
            const updated = updatedBarrels.find(u => u.id === b.id);
            return updated ? { ...b, health: updated.health } : b;
          });
        }
      }

      return changed ? nextBarrels : prevBarrels;
    });

    // Centralized mission completion check: if all enemies are dead, player wins!
    const totalEnemies = enemiesRef.current.length;
    const aliveEnemies = enemiesRef.current.filter(e => e.alive).length;
    if (totalEnemies > 0 && aliveEnemies === 0 && !missionCompleteRef.current) {
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

    // Nukage/slime damage — standing in custom lava or slime zones
    player.health = checkSlimeDamageHelper(
      dt,
      player.position,
      player.health,
      onGameOver,
      (active) => { gameActiveRef.current = active; },
      specialFloors
    );

    handlePlayerState();
  });

  return (
    <>
      <Level customWalls={customWallData} specialFloors={specialFloors} />
      {/* Doors */}
      {doors.map((door: DoorData) => {
        const visual = getDoorVisual(door);
        // Don't render door mesh when fully open (visible height near zero)
        if (door.state === 'open' || (door.state === 'opening' && visual.size[1] < 0.1)) {
          return null;
        }
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
      {/* Barrels */}
      {barrels.map((barrel) => {
        if (!barrel.alive && barrel.explosionTimer <= 0) return null;
        if (!barrel.alive) {
          const progress = 1 - barrel.explosionTimer;
          const scale = 0.5 + progress * 3.5;
          const opacity = barrel.explosionTimer;
          return (
            <mesh key={`explosion-${barrel.id}`} position={barrel.position}>
              <sphereGeometry args={[scale, 16, 16]} />
              <meshBasicMaterial
                color="#ff5500"
                transparent
                opacity={opacity * 0.8}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          );
        }
        return (
          <mesh key={`barrel-${barrel.id}`} position={barrel.position}>
            <cylinderGeometry args={[0.4, 0.4, 1, 8]} />
            <meshLambertMaterial map={barrelTexture} />
          </mesh>
        );
      })}
      <Weapons
        shooting={playerRef.current.shooting}
        lastShot={playerRef.current.lastShot}
        isMoving={playerRef.current.isMoving}
        pullbackRef={pullbackRef}
      />
    </>
  );
}
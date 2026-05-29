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
  checkCollision as checkCollisionPure,
  checkWallHit as checkWallHitPure,
  checkEnemyCollision as checkEnemyCollisionPure,
  hasLineOfSight as hasLineOfSightPure,
} from "./GameCollision";
import {
  updateProjectilesHelper,
  updateEnemyAIHelper,
  checkSlimeDamageHelper,
  updatePickupCollectionHelper,
  handlePlayerMovementHelper,
  handlePlayerShootingHelper,
  explodeBarrelSplash,
} from "./GameHelpers";
import { useGameInputs } from "./useGameInputs";
import { patchE2EState, registerE2EHandlers } from "./e2eBridge";

const COLLISION_MARGIN = 0.4;

interface CustomLevelData {
  walls: Array<{ x: number; z: number; w: number; d: number; isDoor: boolean; isHalfWall?: boolean }>;
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

export interface PlayerData {
  position: THREE.Vector3;
  rotation: number;
  pitch: number;
  health: number;
  ammo: number;
  bullets: number; // Revolver and Machine Gun ammo
  shells: number; // Shotgun ammo
  currentWeapon: "revolver" | "shotgun" | "machinegun";
  revolverChamber: number;
  revolverReloadTimer: number;
  machinegunMag: number;
  machinegunReloadTimer: number;
  unlockedShotgun: boolean;
  kills: number;
  shotsFired: number;
  timesHit: number;
  startTime: number;
  endTime: number;
  shooting: boolean;
  lastShot: number;
  lastContactDmg: number;
  lastEnvDmg: number;
  damageFlash: number;
  isMoving: boolean;
  hasPlayedEmptyClick: boolean;
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

function findSafeSpawn(startX: number, startZ: number, walls: WallBox[]): THREE.Vector3 {
  const checkCollisionLocal = (x: number, z: number): boolean => {
    const radius = 0.4;
    for (const wall of walls) {
      const closestX = Math.max(wall.min[0], Math.min(x, wall.max[0]));
      const closestZ = Math.max(wall.min[2], Math.min(z, wall.max[2]));
      const dx = x - closestX;
      const dz = z - closestZ;
      if (dx * dx + dz * dz < radius * radius) {
        return true;
      }
    }
    return false;
  };

  const initialX = Math.floor(startX) + 0.5;
  const initialZ = Math.floor(startZ) + 0.5;

  if (!checkCollisionLocal(initialX, initialZ)) {
    return new THREE.Vector3(initialX, 1.7, initialZ);
  }

  // Spiral search out to find the nearest non-colliding cell center
  for (let r = 1; r < 50; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (const dz of [-r, r]) {
        const cx = initialX + dx;
        const cz = initialZ + dz;
        if (cx > 0 && cx < 50 && cz > 0 && cz < 50) {
          if (!checkCollisionLocal(cx, cz)) {
            return new THREE.Vector3(cx, 1.7, cz);
          }
        }
      }
    }
    for (let dz = -r + 1; dz <= r - 1; dz++) {
      for (const dx of [-r, r]) {
        const cx = initialX + dx;
        const cz = initialZ + dz;
        if (cx > 0 && cx < 50 && cz > 0 && cz < 50) {
          if (!checkCollisionLocal(cx, cz)) {
            return new THREE.Vector3(cx, 1.7, cz);
          }
        }
      }
    }
  }

  return new THREE.Vector3(initialX, 1.7, initialZ);
}


export default function Game({ onPlayerState, onGameOver, onMissionComplete, mobileMoveRef, mobileLookRef, mobilePitchRef, useActionRef, levelData, paused }: GameProps): React.JSX.Element {
  const barrelTexture = useMemo(() => createBarrelTexture(), []);
  // Use custom level data if provided, otherwise defaults
  const customEnemies: EnemyData[] = levelData ? levelData.enemies.map(e => {
    const hp = e.type === 'imp' ? 45 : e.type === 'demon' ? 80 : 35;
    return { id: e.id, position: [e.x, 0, e.z] as [number, number, number], type: e.type as "imp" | "demon" | "zombieman", health: hp, maxHealth: hp, alive: true, lastAttack: 0, hitFlash: 0, rotation: Math.PI, stuckCounter: 0, lastPosition: [e.x, 0, e.z] as [number, number, number], hasAlerted: false };
  }) : INITIAL_ENEMIES;
  const customPickups: PickupData[] = levelData ? levelData.pickups.map(p => ({ id: p.id, position: [p.x, 0.3, p.z] as [number, number, number], type: p.type as "health" | "ammo" | "shotgun", active: true })) : INITIAL_PICKUPS;
  const customPlayerStart: [number, number] | null = levelData ? levelData.playerStart : null;

  const initialSpawn = useMemo(() => {
    const rawWalls = levelData && levelData.walls.length > 0
      ? getWalls(levelData.walls.filter(w => !w.isDoor).map(w => {
          const isHalf = w.isHalfWall ?? false;
          return { x: w.x, y: isHalf ? 0.5 : 2.0, z: w.z, w: w.w, h: isHalf ? 1.0 : 4.0, d: w.d, color: isHalf ? 0x6e563a : 0x8b7355, isHalfWall: isHalf };
        }))
      : getWalls();

    const startX = customPlayerStart ? customPlayerStart[0] + 0.5 : 2.5;
    const startZ = customPlayerStart ? customPlayerStart[1] + 0.5 : 3.5;

    return findSafeSpawn(startX, startZ, rawWalls);
  }, [levelData, customPlayerStart]);

  const playerRef = useRef<PlayerData>({
    position: initialSpawn,
    rotation: -Math.PI / 2,
    pitch: 0,
    health: 100,
    ammo: 60, // starts with 60 bullets
    bullets: 60,
    shells: 10,
    currentWeapon: "revolver",
    revolverChamber: 6,
    revolverReloadTimer: 0,
    machinegunMag: 70,
    machinegunReloadTimer: 0,
    unlockedShotgun: false, // starts locked, needs to be picked up
    kills: 0,
    shotsFired: 0,
    timesHit: 0,
    startTime: performance.now() / 1000,
    endTime: 0,
    shooting: false,
    lastShot: 0,
    lastContactDmg: 0,
    lastEnvDmg: 0,
    damageFlash: 0,
    isMoving: false,
    hasPlayedEmptyClick: false,
  });
  const keysRef = useRef<Record<string, boolean>>({});
  const projectilesRef = useRef<ProjectileData[]>([]);
  const projectileIdRef = useRef(0);
  const missionCompleteRef = useRef(false);
  const gameActiveRef = useRef(true);
  const { camera } = useThree();
  const pullbackRef = useRef(0);
  const lastEnemyDeathTimeRef = useRef<number | null>(null);

  // Pre-allocated objects for pullback raycast (avoid GC pressure per frame)
  const _pullbackDir = useMemo(() => new THREE.Vector3(), []);
  const _pullbackRay = useMemo(() => new THREE.Ray(), []);
  const _pullbackTarget = useMemo(() => new THREE.Vector3(), []);
  const _pullboxMin = useMemo(() => new THREE.Vector3(), []);
  const _pullboxMax = useMemo(() => new THREE.Vector3(), []);
  const _pullbox = useMemo(() => new THREE.Box3(), []);

  // Pre-allocated objects for camera look direction (avoid GC per frame)
  const _lookDir = useMemo(() => new THREE.Vector3(), []);
  const _lookTarget = useMemo(() => new THREE.Vector3(), []);
  const prevShootingRef = useRef(false);
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
        .map(w => {
          const isHalf = w.isHalfWall ?? false;
          return { x: w.x, y: isHalf ? 0.5 : 2.0, z: w.z, w: w.w, h: isHalf ? 1.0 : 4.0, d: w.d, color: w.isDoor ? 0xcc0000 : isHalf ? 0x6e563a : 0x8b7355, isDoor: w.isDoor, isHalfWall: isHalf };
        });
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
        health: 10,
        maxHealth: 10,
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
    p.kills = enemiesRef.current.filter(e => !e.alive).length;
    // Set legacy ammo count based on active weapon
    p.ammo = p.currentWeapon === "shotgun" ? p.shells : p.bullets;
    onPlayerState({
      health: Math.round(p.health),
      ammo: p.ammo,
      bullets: p.bullets,
      shells: p.shells,
      currentWeapon: p.currentWeapon,
      revolverChamber: p.revolverChamber,
      machinegunMag: p.machinegunMag,
      revolverReloading: p.revolverReloadTimer > 0,
      machinegunReloading: p.machinegunReloadTimer > 0,
      kills: p.kills,
      shotsFired: p.shotsFired,
      timesHit: p.timesHit,
      startTime: p.startTime,
      endTime: p.endTime,
      damageFlash: p.damageFlash,
    });
  }, [onPlayerState]);

  // Input handlers encapsulated in custom hook
  useGameInputs(keysRef, useActionRef, gameActiveRef, playerRef);

  useEffect(() => {
    registerE2EHandlers({
      teleportPlayer: (x, z) => {
        playerRef.current.position.set(x, 1.7, z);
      },
      defeatAllEnemies: () => {
        const updated = enemiesRef.current.map((e) => ({ ...e, alive: false, health: 0 }));
        enemiesRef.current = updated;
        setEnemies(updated);
      },
      unlockShotgun: () => {
        playerRef.current.unlockedShotgun = true;
        playerRef.current.shells = 10;
      },
    });
  }, []);

  // Weapon switching keydown listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const player = playerRef.current;
      if (player.health <= 0 || !gameActiveRef.current || paused) return;

      if (e.code === "Digit1" || e.key === "1") {
        player.currentWeapon = "revolver";
        audioManager.play("weapon_pickup"); // Switch sound
      } else if (e.code === "Digit2" || e.key === "2") {
        if (player.unlockedShotgun) {
          player.currentWeapon = "shotgun";
          audioManager.play("weapon_pickup");
        } else {
          audioManager.play("noway"); // Denied sound
        }
      } else if (e.code === "Digit3" || e.key === "3") {
        player.currentWeapon = "machinegun";
        audioManager.play("weapon_pickup");
      } else if (e.code === "KeyR" || e.key === "r" || e.key === "R") {
        if (player.currentWeapon === "revolver") {
          if (player.revolverReloadTimer === 0 && player.revolverChamber < 6 && player.bullets > player.revolverChamber) {
            player.revolverReloadTimer = 1.0;
            audioManager.play("shotgun_cock");
          }
        } else if (player.currentWeapon === "machinegun") {
          if (player.machinegunReloadTimer === 0 && player.machinegunMag < 70 && player.bullets > player.machinegunMag) {
            player.machinegunReloadTimer = 2.0;
            audioManager.play("shotgun_cock");
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paused]);

  // Collision detection callbacks delegating to pure GameCollision helpers
  const checkCollision = useCallback((pos: THREE.Vector3, radius: number = COLLISION_MARGIN): boolean => {
    return checkCollisionPure(pos, walls, doorsRef.current, barrels, radius);
  }, [walls, barrels]);

  const checkWallHit = useCallback((x: number, y: number, z: number): boolean => {
    return checkWallHitPure(x, y, z, walls, doorsRef.current, barrels);
  }, [walls, barrels]);

  const checkEnemyCollision = useCallback((pos: THREE.Vector3, currentEnemies: EnemyData[], radius = 0.8): boolean => {
    return checkEnemyCollisionPure(pos, currentEnemies, radius);
  }, []);

  const hasLineOfSight = useCallback((x1: number, z1: number, x2: number, z2: number): boolean => {
    return hasLineOfSightPure(x1, z1, x2, z2, walls, doorsRef.current);
  }, [walls]);

  // Main game loop
  useFrame((_state, delta) => {
    const player = playerRef.current;
    if (player.health <= 0) return;

    if (paused) {
      // Pause camera setup - keep camera sync but skip all logic (reuse vectors)
      camera.position.set(player.position.x, player.position.y, player.position.z);
      _lookDir.set(
        -Math.sin(player.rotation) * Math.cos(player.pitch),
        Math.sin(player.pitch),
        -Math.cos(player.rotation) * Math.cos(player.pitch),
      );
      _lookTarget.copy(camera.position).addScaledVector(_lookDir, 10);
      camera.lookAt(_lookTarget);
      camera.updateMatrixWorld(true);
      return;
    }

    const dt = Math.min(delta, 0.05);
    const keys = keysRef.current;
    const now = performance.now() / 1000;

    // Reset out-of-ammo click flag when player clicks down
    if (player.shooting && !prevShootingRef.current) {
      player.hasPlayedEmptyClick = false;
    }
    prevShootingRef.current = player.shooting;

    // Update weapon reload timers
    if (player.revolverReloadTimer > 0) {
      player.revolverReloadTimer = Math.max(0, player.revolverReloadTimer - dt);
      if (player.revolverReloadTimer === 0) {
        player.revolverChamber = Math.min(6, player.bullets);
      }
    }
    if (player.machinegunReloadTimer > 0) {
      player.machinegunReloadTimer = Math.max(0, player.machinegunReloadTimer - dt);
      if (player.machinegunReloadTimer === 0) {
        player.machinegunMag = Math.min(70, player.bullets);
      }
    }

    // Movement
    if (gameActiveRef.current) {
      handlePlayerMovementHelper(
        dt,
        player,
        keys,
        mobileMoveRef.current,
        mobileLookRef.current,
        mobilePitchRef.current,
        checkCollision,
        checkEnemyCollision,
        enemiesRef.current
      );
    }

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

    // Camera follow with pitch (reuse pre-allocated vectors)
    camera.position.set(player.position.x, player.position.y, player.position.z);
    _lookDir.set(
      -Math.sin(player.rotation) * Math.cos(player.pitch),
      Math.sin(player.pitch),
      -Math.cos(player.rotation) * Math.cos(player.pitch),
    );
    _lookTarget.copy(camera.position).addScaledVector(_lookDir, 10);
    camera.lookAt(_lookTarget);
    camera.updateMatrixWorld(true);

    // Shooting
    handlePlayerShootingHelper(
      player,
      now,
      camera,
      projectilesRef,
      projectileIdRef,
      walls,
      enemiesRef,
      setEnemies,
      barrelsRef,
      setBarrels
    );
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
    if (healthBonus > 0) { 
      player.health = Math.min(100, player.health + healthBonus); 
      audioManager.play('item_pickup'); 
    }
    if (ammoBonus > 0 && !shotgunPickup) {
      player.bullets += 24;
      audioManager.play('item_pickup');
    }
    if (shotgunPickup) {
      player.shells += 8;
      player.unlockedShotgun = true;
      player.currentWeapon = "shotgun"; // Auto switch to newly found weapon!
      audioManager.play('weapon_pickup');
    }

    // Update doors
    const playerPos: [number, number, number] = [player.position.x, 0, player.position.z];
    const useAct = useActionRef ? useActionRef.current : false;
    setDoors((prev: DoorData[]): DoorData[] =>
      prev.map((d: DoorData): DoorData => updateDoor(d, dt, playerPos, useAct))
    );

    // Exit Switch interaction — E1M1 exit pad at fixed coordinates
    {
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
        handlePlayerState();
        onMissionComplete();
      }
    }
    }

    // Reset use action after processing
    if (useActionRef) useActionRef.current = false;

    // Calculate tactical weapon pullback when close to walls/doors (reuse pre-allocated objects)
    camera.getWorldDirection(_pullbackDir);
    _pullbackRay.set(camera.position, _pullbackDir);
    let minDistance = 1.2; // Max distance we care about for pullback

    for (const wall of walls) {
      _pullboxMin.set(wall.min[0], 0, wall.min[2]);
      _pullboxMax.set(wall.max[0], wall.max[1], wall.max[2]);
      _pullbox.set(_pullboxMin, _pullboxMax);
      if (_pullbackRay.intersectBox(_pullbox, _pullbackTarget)) {
        const dist = camera.position.distanceTo(_pullbackTarget);
        if (dist < minDistance) minDistance = dist;
      }
    }
    for (const door of doorsRef.current) {
      const doorBox = getDoorCollisionBox(door);
      if (doorBox) {
        _pullboxMin.set(doorBox.min[0], 0, doorBox.min[2]);
        _pullboxMax.set(doorBox.max[0], doorBox.max[1], doorBox.max[2]);
        _pullbox.set(_pullboxMin, _pullboxMax);
        if (_pullbackRay.intersectBox(_pullbox, _pullbackTarget)) {
          const dist = camera.position.distanceTo(_pullbackTarget);
          if (dist < minDistance) minDistance = dist;
        }
      }
    }

    const pullbackThreshold = 0.95; // Weapon extends ~0.9 units
    const pullbackVal = minDistance < pullbackThreshold
      ? (pullbackThreshold - minDistance) / (pullbackThreshold - 0.4)
      : 0;
    // Smooth pullback to prevent weapon from jittering rapidly near walls/doors
    const pullbackTarget = Math.max(0, Math.min(1, pullbackVal));
    pullbackRef.current = THREE.MathUtils.lerp(pullbackRef.current, pullbackTarget, Math.min(delta, 0.05) * 12);

    // Process barrel explosions and fade explosion timers
    setBarrels((prevBarrels) => {
      let changed = false;
      let explodedBarrel: BarrelData | null = null;

      const nextBarrels = prevBarrels.map(b => {
        if (!b.alive && b.explosionTimer > 0) {
          changed = true;
          return { ...b, explosionTimer: Math.max(0, b.explosionTimer - dt * 2.5) };
        }
        if (b.alive && b.health <= 0) {
          changed = true;
          explodedBarrel = b;
          return { ...b, alive: false, explosionTimer: 1.0 };
        }
        return b;
      });

      if (explodedBarrel) {
        audioManager.play('explosion');
        const { updatedEnemies, updatedBarrels } = explodeBarrelSplash(
          explodedBarrel,
          playerRef.current,
          enemiesRef.current,
          onGameOver,
          (active) => { gameActiveRef.current = active; },
          prevBarrels,
          hasLineOfSight
        );
        enemiesRef.current = updatedEnemies;
        setEnemies(updatedEnemies);

        return nextBarrels.map(b => {
          if (b.id === (explodedBarrel as BarrelData).id) return b;
          const updated = updatedBarrels.find(u => u.id === b.id);
          return updated ? { ...b, health: updated.health } : b;
        });
      }

      return changed ? nextBarrels : prevBarrels;
    });

    // Centralized mission completion check: if all enemies are dead, player wins!
    player.kills = enemiesRef.current.filter(e => !e.alive).length;
    const totalEnemies = enemiesRef.current.length;
    const aliveEnemies = enemiesRef.current.filter(e => e.alive).length;
    if (totalEnemies > 0 && aliveEnemies === 0) {
      if (lastEnemyDeathTimeRef.current === null) {
        lastEnemyDeathTimeRef.current = now;
      } else if (now - lastEnemyDeathTimeRef.current >= 2.0 && !missionCompleteRef.current) {
        missionCompleteRef.current = true;
        gameActiveRef.current = false;
        player.endTime = now;
        handlePlayerState();
        onMissionComplete();
      }
    } else {
      lastEnemyDeathTimeRef.current = null;
    }

    // Nukage/slime damage — standing in custom lava or slime zones
    player.health = checkSlimeDamageHelper(
      now,
      player,
      onGameOver,
      (active) => { gameActiveRef.current = active; },
      specialFloors
    );

    handlePlayerState();

    patchE2EState({
      currentWeapon: player.currentWeapon,
      unlockedShotgun: player.unlockedShotgun,
      doors: doors.map((d) => ({ id: d.id, state: d.state })),
      totalEnemies: enemiesRef.current.length,
      aliveEnemies: enemiesRef.current.filter((e) => e.alive).length,
    });
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
        currentWeapon={playerRef.current.currentWeapon}
        revolverReloading={playerRef.current.revolverReloadTimer > 0}
        machinegunReloading={playerRef.current.machinegunReloadTimer > 0}
      />
    </>
  );
}
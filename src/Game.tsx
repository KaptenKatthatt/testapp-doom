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
import { createDoorTexture } from "./Textures";
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
} from "./GameHelpers";

const COLLISION_MARGIN = 0.4;

interface CustomLevelData {
  walls: Array<{ x: number; z: number; w: number; d: number; isDoor: boolean }>;
  enemies: Array<{ id: number; x: number; z: number; type: string }>;
  pickups: Array<{ id: number; x: number; z: number; type: string }>;
  playerStart: [number, number];
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
}

export interface PlayerData {
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


export default function Game({ onPlayerState, onGameOver, onMissionComplete, mobileMoveRef, mobileLookRef, mobilePitchRef, useActionRef, levelData }: GameProps): React.JSX.Element {
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
  const barrels: BarrelData[] = useMemo(() => getBarrels(), []);

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

  // Collision detection callbacks delegating to pure GameCollision helpers
  const checkCollision = useCallback((pos: THREE.Vector3, radius: number = COLLISION_MARGIN): boolean => {
    return checkCollisionPure(pos, walls, doorsRef.current, barrels, radius);
  }, [walls, barrels]);

  const checkWallHit = useCallback((x: number, z: number): boolean => {
    return checkWallHitPure(x, z, walls, doorsRef.current, barrels);
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

    const dt = Math.min(delta, 0.05);
    const keys = keysRef.current;
    const now = performance.now() / 1000;

    // Movement
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
      missionCompleteRef,
      gameActiveRef,
      onPlayerState,
      onMissionComplete
    );
    // Enemy AI + projectile spawning
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
      <Level customWalls={customWallData} />
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
      <Weapons
        shooting={playerRef.current.shooting}
        lastShot={playerRef.current.lastShot}
        isMoving={playerRef.current.isMoving}
        pullbackRef={pullbackRef}
      />
    </>
  );
}
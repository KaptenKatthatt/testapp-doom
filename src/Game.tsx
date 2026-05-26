import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Level, { getWalls } from "./Level";
import Enemies from "./Enemies";
import Weapons from "./Weapons";
import Pickups from "./Pickups";
import type {
  PlayerState,
  EnemyData,
  PickupData,
  WallBox,
} from "./types";

const COLLISION_MARGIN = 0.4;

interface GameProps {
  readonly onPlayerState: (state: PlayerState) => void;
  readonly onGameOver: () => void;
  readonly mobileMoveRef: React.MutableRefObject<[number, number]>;
  readonly mobileLookRef: React.MutableRefObject<number>;
}

interface PlayerData {
  position: THREE.Vector3;
  rotation: number;
  health: number;
  ammo: number;
  kills: number;
  shooting: boolean;
  lastShot: number;
}

const INITIAL_ENEMIES: EnemyData[] = [
  { id: 0, position: [4, 0, 2], type: "imp", health: 30, maxHealth: 30, alive: true, lastAttack: 0, hitFlash: 0 },
  { id: 1, position: [8, 0, 8], type: "imp", health: 30, maxHealth: 30, alive: true, lastAttack: 0, hitFlash: 0 },
  { id: 2, position: [20, 0, 6], type: "imp", health: 30, maxHealth: 30, alive: true, lastAttack: 0, hitFlash: 0 },
  { id: 3, position: [14, 0, 18], type: "imp", health: 30, maxHealth: 30, alive: true, lastAttack: 0, hitFlash: 0 },
  { id: 4, position: [30, 0, 12], type: "demon", health: 60, maxHealth: 60, alive: true, lastAttack: 0, hitFlash: 0 },
  { id: 5, position: [36, 0, 8], type: "imp", health: 30, maxHealth: 30, alive: true, lastAttack: 0, hitFlash: 0 },
  { id: 6, position: [24, 0, 24], type: "imp", health: 30, maxHealth: 30, alive: true, lastAttack: 0, hitFlash: 0 },
  { id: 7, position: [40, 0, 20], type: "demon", health: 60, maxHealth: 60, alive: true, lastAttack: 0, hitFlash: 0 },
  { id: 8, position: [10, 0, 26], type: "imp", health: 30, maxHealth: 30, alive: true, lastAttack: 0, hitFlash: 0 },
  { id: 9, position: [34, 0, 14], type: "zombieman", health: 20, maxHealth: 20, alive: true, lastAttack: 0, hitFlash: 0 },
  { id: 10, position: [18, 0, 34], type: "zombieman", health: 20, maxHealth: 20, alive: true, lastAttack: 0, hitFlash: 0 },
];

const INITIAL_PICKUPS: PickupData[] = [
  { id: 1, position: [16, 0.3, 10], type: "health", active: true },
  { id: 2, position: [28, 0.3, 16], type: "ammo", active: true },
  { id: 3, position: [38, 0.3, 14], type: "health", active: true },
  { id: 4, position: [6, 0.3, 20], type: "ammo", active: true },
  { id: 5, position: [32, 0.3, 26], type: "health", active: true },
  { id: 6, position: [12, 0.3, 30], type: "shotgun", active: true },
  { id: 7, position: [42, 0.3, 40], type: "ammo", active: true },
];

const ENEMY_SPEEDS: Record<string, number> = {
  imp: 1.5,
  demon: 3,
  zombieman: 1.0,
};

const ENEMY_ATTACK_RANGES: Record<string, number> = {
  imp: 8,
  demon: 2.5,
  zombieman: 12,
};

const ENEMY_ATTACK_COOLDOWNS: Record<string, number> = {
  imp: 2,
  demon: 1.2,
  zombieman: 2.5,
};

export default function Game({ onPlayerState, onGameOver: _onGameOver, mobileMoveRef, mobileLookRef }: GameProps): React.JSX.Element {
  const playerRef = useRef<PlayerData>({
    position: new THREE.Vector3(3, 1.7, 4),
    rotation: Math.PI / 2, // Face east toward the door opening
    health: 100,
    ammo: 50,
    kills: 0,
    shooting: false,
    lastShot: 0,
  });
  const keysRef = useRef<Record<string, boolean>>({});
  const { camera } = useThree();
  const [enemies, setEnemies] = useState<EnemyData[]>(INITIAL_ENEMIES);
  const [pickups, setPickups] = useState<PickupData[]>(INITIAL_PICKUPS);

  const walls: WallBox[] = useMemo(() => getWalls(), []);

  const handlePlayerState = useCallback((): void => {
    const p = playerRef.current;
    onPlayerState({
      health: Math.round(p.health),
      ammo: p.ammo,
      kills: p.kills,
    });
  }, [onPlayerState]);

  // Input handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      keysRef.current[e.code] = true;
      if (e.code === "Escape") {
        document.exitPointerLock?.();
      }
    };
    const handleKeyUp = (e: KeyboardEvent): void => {
      keysRef.current[e.code] = false;
    };
    const handleMouseDown = (e: MouseEvent): void => {
      if (e.button === 0) {
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
      }
    };

    // Mobile shoot events
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
    return false;
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

    // Mobile look input
    if (Math.abs(mobileLookRef.current) > 0.0001) {
      player.rotation += mobileLookRef.current;
      mobileLookRef.current = 0;
    }

    if (move.length() > 0) {
      move.normalize().multiplyScalar(speed * dt);
    }

    // Collision resolution with wall sliding
    const newPos = player.position.clone().add(move);
    if (!checkCollision(newPos)) {
      player.position.copy(newPos);
    } else {
      // Try sliding along X
      const slideX = player.position.clone();
      slideX.x += move.x;
      if (!checkCollision(slideX)) {
        player.position.x = slideX.x;
      }
      // Try sliding along Z
      const slideZ = player.position.clone();
      slideZ.z += move.z;
      if (!checkCollision(slideZ)) {
        player.position.z = slideZ.z;
      }
    }

    // Camera follow - use lookAt approach for correct rotation
    camera.position.set(player.position.x, player.position.y, player.position.z);
    const lookTarget = new THREE.Vector3(
      player.position.x - Math.sin(player.rotation) * 10,
      player.position.y,
      player.position.z - Math.cos(player.rotation) * 10,
    );
    camera.lookAt(lookTarget);
    camera.updateMatrixWorld(true);

    // Shooting
    if (player.shooting && now - player.lastShot > 0.25 && player.ammo > 0) {
      player.ammo--;
      player.lastShot = now;

      // Raycast hit detection
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      raycaster.far = 50;

      setEnemies((prev: EnemyData[]): EnemyData[] => {
        const updated = prev.map((e: EnemyData): EnemyData => {
          if (!e.alive) return e;
          const ePos = new THREE.Vector3(e.position[0], 1, e.position[2]);
          const dist = ePos.distanceTo(camera.position);
          if (dist > 50) return e;

          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
          const toEnemy = ePos.clone().sub(camera.position).normalize();
          const angle = dir.angleTo(toEnemy);

          const hitRange = Math.max(0.08, 0.3 / (dist / 5));
          if (angle < hitRange) {
            const damage = 15 + Math.random() * 10;
            const newHealth = e.health - damage;
            if (newHealth <= 0) {
              player.kills++;
              return { ...e, health: 0, alive: false, hitFlash: 0 };
            }
            return { ...e, health: newHealth, hitFlash: 1 };
          }
          return e;
        });
        return updated;
      });
    }

    // Enemy AI
    setEnemies((prev: EnemyData[]): EnemyData[] => {
      let tookDamage = false;
      let damageAmount = 0;
      const updated = prev.map((e: EnemyData): EnemyData => {
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

        if (dist < 20) {
          const dx = player.position.x - e.position[0];
          const dz = player.position.z - e.position[2];
          const len = Math.sqrt(dx * dx + dz * dz);
          const ndx = len > 0.01 ? dx / len : 0;
          const ndz = len > 0.01 ? dz / len : 0;

          if (dist > 2) {
            newX += ndx * eSpeed * dt;
            newZ += ndz * eSpeed * dt;
          }

          if (dist < attackRange && now - e.lastAttack > attackCooldown) {
            tookDamage = true;
            damageAmount += 2; // All enemies deal 2 damage per hit
            newAttack = now;
          }
        }

        return {
          ...e,
          position: [newX, 0, newZ] as [number, number, number],
          lastAttack: newAttack,
          hitFlash: newHitFlash,
        };
      });

      if (tookDamage) {
        // God mode: health never goes below 1, player can't die
        player.health = Math.max(1, player.health - damageAmount);
      }

      return updated;
    });

    // Pickup collection
    setPickups((prev: PickupData[]): PickupData[] => {
      let healthBonus = 0;
      let ammoBonus = 0;
      const updated = prev.map((p: PickupData): PickupData => {
        if (!p.active) return p;
        const dx = player.position.x - p.position[0];
        const dz = player.position.z - p.position[2];
        if (dx * dx + dz * dz < 1.5) {
          if (p.type === "health") healthBonus = 25;
          else if (p.type === "ammo") ammoBonus = 20;
          return { ...p, active: false };
        }
        return p;
      });
      if (healthBonus > 0) player.health = Math.min(100, player.health + healthBonus);
      if (ammoBonus > 0) player.ammo += ammoBonus;
      return updated;
    });

    handlePlayerState();
  });

  return (
    <>
      <Level />
      <Enemies enemies={enemies} />
      <Pickups pickups={pickups} />
      <Weapons
        shooting={playerRef.current.shooting}
        lastShot={playerRef.current.lastShot}
      />
    </>
  );
}
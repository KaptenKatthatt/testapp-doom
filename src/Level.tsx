import { useMemo } from "react";
import type { WallBox } from "./types";
import {
  createWallTexture,
  createFloorTexture,
  createCeilingTexture,
  createDoorTexture,
  createMetalTexture,
  createSlimeTexture,
  createBarrelTexture,
  createBloodTexture,
  createLavaTexture,
} from "./Textures";
import { LevelLights } from "./LevelLights";
import { LevelDecorations } from "./LevelDecorations";

// Custom level data interface (matches editor format)
export interface CustomWallData {
  x: number;
  z: number;
  w: number;
  d: number;
  isDoor: boolean;
  isHalfWall?: boolean;
}

interface LevelProps {
  customWalls?: CustomWallData[] | null;
  specialFloors?: Array<{ x: number; z: number; type: 'lava' | 'slime' }> | null;
}

// E1M1-inspired level geometry
const WALL_COLOR = 0xaa9988;
const WALL_COLOR2 = 0x998877;
const DOOR_COLOR = 0xcc7744;
const METAL_COLOR = 0x888899;
const GREEN_ACCENT = 0x55aa55;
const DARK_WALL = 0x776655;

const WALL_DATA: Array<{
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  color: number; isDoor?: boolean;
}> = [
  // === OUTER WALLS (fully sealed - overlapping at corners) ===
  // West wall
  { x: -2, y: 2, z: -2, w: 1, h: 4, d: 50, color: WALL_COLOR },
  // East wall
  { x: 47, y: 2, z: -2, w: 1, h: 4, d: 50, color: WALL_COLOR },
  // South wall
  { x: -2, y: 2, z: -2, w: 50, h: 4, d: 1, color: WALL_COLOR },
  // North wall
  { x: -2, y: 2, z: 47, w: 50, h: 4, d: 1, color: WALL_COLOR },

  // === STARTING ROOM (southwest) ===
  { x: 6, y: 2, z: 0, w: 1, h: 4, d: 10, color: WALL_COLOR2 },
  { x: 0, y: 2, z: 8, w: 10, h: 4, d: 1, color: WALL_COLOR2 },

  // Corridor east from start
  { x: 6, y: 2, z: 14, w: 1, h: 4, d: 8, color: WALL_COLOR2 },
  { x: 0, y: 2, z: 22, w: 10, h: 4, d: 1, color: WALL_COLOR2 },

  // === CENTRAL ROOM ===
  { x: 16, y: 2, z: 6, w: 1, h: 4, d: 12, color: WALL_COLOR },
  { x: 16, y: 2, z: 24, w: 12, h: 4, d: 1, color: WALL_COLOR },
  // Door opening
  { x: 16, y: 2, z: 16, w: 1, h: 4, d: 4, color: DOOR_COLOR, isDoor: true },

  // Pillars in central room
  { x: 10, y: 2, z: 14, w: 2, h: 4, d: 2, color: METAL_COLOR },
  { x: 14, y: 2, z: 14, w: 2, h: 4, d: 2, color: METAL_COLOR },
  { x: 10, y: 2, z: 20, w: 2, h: 4, d: 2, color: METAL_COLOR },
  { x: 14, y: 2, z: 20, w: 2, h: 4, d: 2, color: METAL_COLOR },

  // === EAST CORRIDOR ===
  { x: 24, y: 2, z: 0, w: 1, h: 4, d: 16, color: WALL_COLOR },
  { x: 24, y: 2, z: 24, w: 1, h: 4, d: 22, color: WALL_COLOR },

  // === NORTH ROOM ===
  { x: 16, y: 2, z: 0, w: 1, h: 4, d: 10, color: WALL_COLOR },
  { x: 16, y: 2, z: 16, w: 10, h: 4, d: 1, color: DOOR_COLOR, isDoor: true },

  // === SOUTH ROOM ===
  { x: 8, y: 2, z: 32, w: 16, h: 4, d: 1, color: WALL_COLOR },
  { x: 24, y: 2, z: 28, w: 1, h: 4, d: 10, color: WALL_COLOR },

  // === NORTHEAST ROOM ===
  { x: 32, y: 2, z: 6, w: 1, h: 4, d: 14, color: WALL_COLOR },
  { x: 32, y: 2, z: 24, w: 14, h: 4, d: 1, color: WALL_COLOR },

  // === SOUTHEAST ROOM ===
  { x: 32, y: 2, z: 32, w: 14, h: 4, d: 1, color: WALL_COLOR },
  { x: 38, y: 2, z: 24, w: 1, h: 4, d: 12, color: WALL_COLOR },

  // Interior walls for maze feel
  { x: 36, y: 2, z: 16, w: 6, h: 4, d: 1, color: WALL_COLOR2 },
  { x: 40, y: 2, z: 10, w: 1, h: 4, d: 10, color: WALL_COLOR2 },

  // Green slime walls
  { x: 28, y: 2, z: 36, w: 8, h: 4, d: 1, color: GREEN_ACCENT },
  { x: 36, y: 2, z: 36, w: 1, h: 4, d: 6, color: GREEN_ACCENT },

  // Steps/ramp
  { x: 4, y: 1, z: 28, w: 4, h: 2, d: 2, color: METAL_COLOR },
  { x: 4, y: 0.5, z: 30, w: 4, h: 1, d: 2, color: METAL_COLOR },

  // Small alcove north
  { x: 20, y: 2, z: 4, w: 1, h: 4, d: 4, color: WALL_COLOR2 },

  // === SECRET ROOM (hidden behind wall) ===
  { x: 42, y: 2, z: 38, w: 4, h: 4, d: 1, color: DARK_WALL },
  { x: 42, y: 2, z: 42, w: 1, h: 4, d: 6, color: DARK_WALL },
  { x: 44, y: 2, z: 42, w: 1, h: 4, d: 4, color: DARK_WALL },

  // More corridors
  { x: 30, y: 2, z: 28, w: 1, h: 4, d: 6, color: WALL_COLOR },
  { x: 30, y: 2, z: 22, w: 6, h: 4, d: 1, color: WALL_COLOR },
];

interface WallMeshData {
  key: number;
  position: [number, number, number];
  scale: [number, number, number];
  color: number;
  isDoor: boolean;
  isHalfWall?: boolean;
}

function buildWallMeshes(): WallMeshData[] {
  return WALL_DATA.map((w, i) => ({
    key: i,
    position: [w.x + w.w / 2, w.y, w.z + w.d / 2] as [number, number, number],
    scale: [w.w, w.h, w.d] as [number, number, number],
    color: w.color,
    isDoor: w.isDoor ?? false,
    isHalfWall: false,
  }));
}

const WALL_MESHES: WallMeshData[] = buildWallMeshes();

export function getWalls(wallDataOverride?: Array<{ x: number; y: number; z: number; w: number; h: number; d: number; color: number; isDoor?: boolean; isHalfWall?: boolean }>): WallBox[] {
  const data = wallDataOverride ?? (WALL_DATA as Array<{ x: number; y: number; z: number; w: number; h: number; d: number; color: number; isDoor?: boolean; isHalfWall?: boolean }>);
  return data.map((w) => ({
    min: [w.x, 0, w.z] as [number, number, number],
    max: [w.x + w.w, w.h, w.z + w.d] as [number, number, number],
    isHalfWall: w.isHalfWall ?? false,
  }));
}

export default function Level({ customWalls, specialFloors }: LevelProps): React.JSX.Element {
  // Build wall data from custom or default
  const activeWallData = useMemo(() => {
    if (customWalls && customWalls.length > 0) {
      return customWalls.map((w, i) => {
        const isHalfWall = w.isHalfWall ?? false;
        const height = isHalfWall ? 2 : 4;
        const yPos = isHalfWall ? 1 : 2;
        return {
          key: i,
          x: w.x, y: yPos, z: w.z, w: w.w, h: height, d: w.d,
          color: w.isDoor ? 0xcc0000 : isHalfWall ? 0x6e563a : 0x8b7355,
          isDoor: w.isDoor,
          isHalfWall,
          position: [w.x + w.w / 2, yPos, w.z + w.d / 2] as [number, number, number],
          scale: [w.w, height, w.d] as [number, number, number],
        };
      });
    }
    return WALL_MESHES;
  }, [customWalls]);

  // Build collision data (exported via getWalls for Game.tsx)
  // const wallsForCollision = ... // not needed here, Game.tsx calls getWalls()

  // Calculate level size for floor/ceiling
  const levelSize = useMemo(() => {
    if (customWalls && customWalls.length > 0) {
      let maxX = 50, maxZ = 50;
      for (const w of customWalls) {
        maxX = Math.max(maxX, w.x + w.w + 2);
        maxZ = Math.max(maxZ, w.z + w.d + 2);
      }
      return Math.max(maxX, maxZ, 50);
    }
    return 50;
  }, [customWalls]);

  const textures = useMemo(() => ({
    wall: createWallTexture(),
    floor: createFloorTexture(),
    ceiling: createCeilingTexture(),
    door: createDoorTexture(),
    metal: createMetalTexture(),
    slime: createSlimeTexture(),
    lava: createLavaTexture(),
    barrel: createBarrelTexture(),
    blood: createBloodTexture(),
  }), []);

  return (
    <group>
      <LevelLights />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[levelSize / 2, 0, levelSize / 2]}>
        <planeGeometry args={[levelSize, levelSize]} />
        <meshLambertMaterial map={textures.floor} color={0x776655} emissive={0x221100} emissiveIntensity={0.2} />
      </mesh>

      {/* Special custom floor tiles (lava, slime) placed above the main floor */}
      {specialFloors?.map((tile, i) => {
        const isLava = tile.type === 'lava';
        return (
          <mesh
            key={`special-floor-${i}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[tile.x + 0.5, 0.005, tile.z + 0.5]}
          >
            <planeGeometry args={[1, 1]} />
            <meshLambertMaterial
              map={isLava ? textures.lava : textures.slime}
              color={isLava ? 0xff8844 : 0x44aa44}
              emissive={isLava ? 0xcc4400 : 0x114411}
              emissiveIntensity={isLava ? 0.9 : 0.5}
            />
          </mesh>
        );
      })}

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[levelSize / 2, 4, levelSize / 2]}>
        <planeGeometry args={[levelSize, levelSize]} />
        <meshLambertMaterial map={textures.ceiling} color={0x666655} emissive={0x222211} emissiveIntensity={0.15} />
      </mesh>

      {/* Walls */}
      {activeWallData.map((w) => {
        // Choose texture based on wall type
        const isGreenSlime = w.color === GREEN_ACCENT;
        const isMetal = w.color === METAL_COLOR;
        const isDark = w.color === DARK_WALL;

        let wallTexture = textures.wall;
        if (w.isDoor) wallTexture = textures.door;
        else if (isGreenSlime) wallTexture = textures.slime;
        else if (isMetal) wallTexture = textures.metal;
        else if (isDark) wallTexture = textures.wall;

        const materialProps: Record<string, unknown> = {
          map: wallTexture,
          color: w.color,
          emissive: w.isDoor ? 0x664400 : isGreenSlime ? 0x225522 : isMetal ? 0x222233 : isDark ? 0x332211 : 0x333322,
          emissiveIntensity: w.isDoor ? 0.6 : isGreenSlime ? 0.4 : 0.35,
        };

        return (
          <mesh key={`wall-${w.key}`} position={w.position} >
            <boxGeometry args={w.scale} />
            <meshLambertMaterial {...materialProps} />
          </mesh>
        );
      })}

      <LevelDecorations textures={textures} />
    </group>
  );
}
export interface BarrelData {
  id: number;
  position: [number, number, number];
  radius: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  explosionTimer: number;
}

export function getBarrels(): BarrelData[] {
  return [
    { id: 100, position: [22, 0.5, 10], radius: 0.4, health: 10, maxHealth: 10, alive: true, explosionTimer: 0 },
    { id: 101, position: [22, 0.5, 12], radius: 0.4, health: 10, maxHealth: 10, alive: true, explosionTimer: 0 },
  ];
}
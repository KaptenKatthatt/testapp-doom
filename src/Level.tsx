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
} from "./Textures";

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
  { x: 6, y: 2, z: 0, w: 1, h: 4, d: 16, color: WALL_COLOR2 },
  { x: 0, y: 2, z: 8, w: 14, h: 4, d: 1, color: WALL_COLOR2 },

  // Corridor east from start
  { x: 6, y: 2, z: 16, w: 1, h: 4, d: 6, color: WALL_COLOR2 },
  { x: 0, y: 2, z: 22, w: 8, h: 4, d: 1, color: WALL_COLOR2 },

  // === CENTRAL ROOM ===
  { x: 16, y: 2, z: 8, w: 1, h: 4, d: 16, color: WALL_COLOR },
  { x: 16, y: 2, z: 24, w: 12, h: 4, d: 1, color: WALL_COLOR },
  // Door opening
  { x: 16, y: 2, z: 16, w: 1, h: 4, d: 2, color: DOOR_COLOR, isDoor: true },

  // Pillars in central room
  { x: 10, y: 2, z: 14, w: 2, h: 4, d: 2, color: METAL_COLOR },
  { x: 14, y: 2, z: 14, w: 2, h: 4, d: 2, color: METAL_COLOR },
  { x: 10, y: 2, z: 20, w: 2, h: 4, d: 2, color: METAL_COLOR },
  { x: 14, y: 2, z: 20, w: 2, h: 4, d: 2, color: METAL_COLOR },

  // === EAST CORRIDOR ===
  { x: 24, y: 2, z: 0, w: 1, h: 4, d: 20, color: WALL_COLOR },
  { x: 24, y: 2, z: 24, w: 1, h: 4, d: 22, color: WALL_COLOR },

  // === NORTH ROOM ===
  { x: 16, y: 2, z: 0, w: 1, h: 4, d: 12, color: WALL_COLOR },
  { x: 16, y: 2, z: 16, w: 8, h: 4, d: 1, color: DOOR_COLOR, isDoor: true },

  // === SOUTH ROOM ===
  { x: 8, y: 2, z: 32, w: 16, h: 4, d: 1, color: WALL_COLOR },
  { x: 24, y: 2, z: 28, w: 1, h: 4, d: 12, color: WALL_COLOR },

  // === NORTHEAST ROOM ===
  { x: 32, y: 2, z: 6, w: 1, h: 4, d: 16, color: WALL_COLOR },
  { x: 32, y: 2, z: 24, w: 14, h: 4, d: 1, color: WALL_COLOR },

  // === SOUTHEAST ROOM ===
  { x: 32, y: 2, z: 32, w: 14, h: 4, d: 1, color: WALL_COLOR },
  { x: 38, y: 2, z: 24, w: 1, h: 4, d: 12, color: WALL_COLOR },

  // Interior walls for maze feel
  { x: 36, y: 2, z: 16, w: 8, h: 4, d: 1, color: WALL_COLOR2 },
  { x: 40, y: 2, z: 10, w: 1, h: 4, d: 14, color: WALL_COLOR2 },

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
}

function buildWallMeshes(): WallMeshData[] {
  return WALL_DATA.map((w, i) => ({
    key: i,
    position: [w.x + w.w / 2, w.y, w.z + w.d / 2] as [number, number, number],
    scale: [w.w, w.h, w.d] as [number, number, number],
    color: w.color,
    isDoor: w.isDoor ?? false,
  }));
}

const WALL_MESHES: WallMeshData[] = buildWallMeshes();

export function getWalls(): WallBox[] {
  return WALL_DATA.map((w) => ({
    min: [w.x, 0, w.z] as [number, number, number],
    max: [w.x + w.w, w.h, w.z + w.d] as [number, number, number],
  }));
}

export default function Level(): React.JSX.Element {
  const textures = useMemo(() => ({
    wall: createWallTexture(),
    floor: createFloorTexture(),
    ceiling: createCeilingTexture(),
    door: createDoorTexture(),
    metal: createMetalTexture(),
    slime: createSlimeTexture(),
    barrel: createBarrelTexture(),
    blood: createBloodTexture(),
  }), []);

  return (
    <group>
      {/* Strong ambient so everything is visible */}
      <ambientLight intensity={1.5} color="#eeccaa" />
      <hemisphereLight args={["#ffeedd", "#665544", 0.8]} />

      {/* Key point lights for atmosphere - much stronger */}
      <pointLight position={[3, 3.5, 4]} intensity={6.0} color="#ffaa66" distance={30} />
      <pointLight position={[8, 3.5, 8]} intensity={5.0} color="#ff9944" distance={25} />
      <pointLight position={[20, 3.5, 14]} intensity={4.0} color="#ffcc88" distance={30} />
      <pointLight position={[36, 3.5, 8]} intensity={3.0} color="#ff8844" distance={25} />
      <pointLight position={[14, 3.5, 26]} intensity={3.0} color="#ffaa66" distance={25} />
      <pointLight position={[38, 3.5, 28]} intensity={3.0} color="#88ff88" distance={25} />
      <pointLight position={[4, 3.5, 34]} intensity={2.0} color="#ff6666" distance={20} />

      {/* Ceiling lights - uniform overhead lighting */}
      <pointLight position={[10, 3.8, 16]} intensity={4.0} color="#ffffff" distance={20} />
      <pointLight position={[28, 3.8, 16]} intensity={3.0} color="#ffffff" distance={20} />
      <pointLight position={[40, 3.8, 30]} intensity={3.0} color="#ffffff" distance={20} />

      {/* Torch lights on walls - brighter */}
      <pointLight position={[6, 3, 4]} intensity={3.0} color="#ff8833" distance={15} />
      <pointLight position={[16, 3, 18]} intensity={3.0} color="#ff8833" distance={15} />
      <pointLight position={[30, 3, 12]} intensity={2.5} color="#ff8833" distance={15} />
      <pointLight position={[40, 3, 20]} intensity={2.5} color="#88cc88" distance={15} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[22, 0, 22]}>
        <planeGeometry args={[50, 50]} />
        <meshLambertMaterial map={textures.floor} color={0x776655} emissive={0x221100} emissiveIntensity={0.2} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[22, 4, 22]}>
        <planeGeometry args={[50, 50]} />
        <meshLambertMaterial map={textures.ceiling} color={0x666655} emissive={0x222211} emissiveIntensity={0.15} />
      </mesh>

      {/* Walls */}
      {WALL_MESHES.map((w) => {
        // Choose texture based on wall type
        const isGreenSlime = w.color === GREEN_ACCENT;
        const isMetal = w.color === METAL_COLOR;
        const isDark = w.color === DARK_WALL;

        let wallTexture = textures.wall;
        if (w.isDoor) wallTexture = textures.door;
        else if (isGreenSlime) wallTexture = textures.slime;
        else if (isMetal) wallTexture = textures.metal;
        else if (isDark) wallTexture = textures.wall;

        // Adjust repeat based on wall size
        const materialProps: Record<string, unknown> = {
          map: wallTexture,
          color: w.color,
          emissive: w.isDoor ? 0x664400 : isGreenSlime ? 0x225522 : isMetal ? 0x222233 : isDark ? 0x332211 : 0x333322,
          emissiveIntensity: w.isDoor ? 0.6 : isGreenSlime ? 0.4 : 0.35,
        };

        return (
          <mesh key={w.key} position={w.position}>
            <boxGeometry args={w.scale} />
            <meshLambertMaterial {...materialProps} />
          </mesh>
        );
      })}

      {/* Blood pool */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12, 0.01, 18]}>
        <circleGeometry args={[1.5, 16]} />
        <meshLambertMaterial map={textures.blood} transparent opacity={0.8} />
      </mesh>

      {/* Slime pool */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[38, 0.01, 38]}>
        <circleGeometry args={[2, 16]} />
        <meshLambertMaterial map={textures.slime} transparent opacity={0.8} />
      </mesh>

      {/* Cross in starting room */}
      <mesh position={[3, 2.5, 4]}>
        <boxGeometry args={[0.2, 1.2, 0.05]} />
        <meshLambertMaterial color={0xcc4444} emissive={0x441111} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[3, 3, 4]}>
        <boxGeometry args={[0.6, 0.2, 0.05]} />
        <meshLambertMaterial color={0xcc4444} emissive={0x441111} emissiveIntensity={0.5} />
      </mesh>

      {/* Barrels/crates */}
      <mesh position={[22, 0.5, 10]}>
        <cylinderGeometry args={[0.4, 0.4, 1, 8]} />
        <meshLambertMaterial map={textures.barrel} />
      </mesh>
      <mesh position={[22, 0.5, 12]}>
        <cylinderGeometry args={[0.4, 0.4, 1, 8]} />
        <meshLambertMaterial map={textures.barrel} />
      </mesh>

      {/* Torch flames - small emissive cubes on walls */}
      {[
        [6, 3, 4], [16, 3, 18], [30, 3, 12], [40, 3, 20],
        [3, 3.5, 4], [8, 3.5, 8],
      ].map((pos, i) => (
        <mesh key={`torch-${i}`} position={pos as [number, number, number]}>
          <boxGeometry args={[0.15, 0.15, 0.15]} />
          <meshBasicMaterial color="#ff6600" />
        </mesh>
      ))}
    </group>
  );
}
export interface BarrelData {
  position: [number, number, number];
  radius: number;
}

export function getBarrels(): BarrelData[] {
  return [];
}

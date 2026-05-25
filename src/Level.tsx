import type { WallBox } from "./types";

// E1M1-inspired level geometry
// Format: [x, y, z, width, height, depth, color, isDoor?]

const WALL_COLOR = 0x887766;
const WALL_COLOR2 = 0x776655;
const DOOR_COLOR = 0xaa6633;
const METAL_COLOR = 0x666677;
const GREEN_ACCENT = 0x448844;
const DARK_WALL = 0x554433;

const WALL_DATA: Array<{
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  color: number; isDoor?: boolean;
}> = [
  // === OUTER WALLS ===
  { x: -2, y: 2, z: 0, w: 1, h: 4, d: 44, color: WALL_COLOR },
  { x: 46, y: 2, z: 0, w: 1, h: 4, d: 44, color: WALL_COLOR },
  { x: 0, y: 2, z: -2, w: 48, h: 4, d: 1, color: WALL_COLOR },
  { x: 0, y: 2, z: 46, w: 48, h: 4, d: 1, color: WALL_COLOR },

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
  return (
    <group>
      {/* Strong ambient so everything is visible */}
      <ambientLight intensity={0.7} color="#bbaa99" />
      
      {/* Main overhead light (like ceiling lights) */}
      <hemisphereLight args={["#ffeedd", "#332211", 0.4]} />
      
      {/* Key point lights for atmosphere */}
      <pointLight position={[3, 3.5, 4]} intensity={3.0} color="#ffaa66" />
      <pointLight position={[8, 3.5, 8]} intensity={2.5} color="#ff9944" />
      <pointLight position={[20, 3.5, 14]} intensity={2.0} color="#ffcc88" />
      <pointLight position={[36, 3.5, 8]} intensity={1.5} color="#ff8844" />
      <pointLight position={[14, 3.5, 26]} intensity={1.5} color="#ffaa66" />
      <pointLight position={[38, 3.5, 28]} intensity={1.5} color="#88ff88" />
      <pointLight position={[4, 3.5, 34]} intensity={1.0} color="#ff6666" />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[22, 0, 22]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshLambertMaterial color={0x665544} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[22, 4, 22]}>
        <planeGeometry args={[50, 50]} />
        <meshLambertMaterial color={0x444433} />
      </mesh>

      {/* Walls */}
      {WALL_MESHES.map((w) => (
        <mesh key={w.key} position={w.position}>
          <boxGeometry args={w.scale} />
          <meshLambertMaterial
            color={w.color}
            emissive={w.isDoor ? 0x442200 : 0x111111}
            emissiveIntensity={w.isDoor ? 0.5 : 0.1}
          />
        </mesh>
      ))}

      {/* Blood pool */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12, 0.01, 18]}>
        <circleGeometry args={[1.5, 16]} />
        <meshLambertMaterial color={0xaa2222} transparent opacity={0.8} />
      </mesh>

      {/* Slime pool */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[38, 0.01, 38]}>
        <circleGeometry args={[2, 16]} />
        <meshLambertMaterial color={0x33aa33} transparent opacity={0.8} />
      </mesh>

      {/* Cross in starting room */}
      <mesh position={[3, 2.5, 4]}>
        <boxGeometry args={[0.2, 1.2, 0.05]} />
        <meshLambertMaterial color={0xcc4444} emissive={0x441111} emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[3, 3, 4]}>
        <boxGeometry args={[0.6, 0.2, 0.05]} />
        <meshLambertMaterial color={0xcc4444} emissive={0x441111} emissiveIntensity={0.3} />
      </mesh>

      {/* Barrels/crates */}
      <mesh position={[22, 0.5, 10]}>
        <cylinderGeometry args={[0.4, 0.4, 1, 8]} />
        <meshLambertMaterial color={0x667755} />
      </mesh>
      <mesh position={[22, 0.5, 12]}>
        <cylinderGeometry args={[0.4, 0.4, 1, 8]} />
        <meshLambertMaterial color={0x667755} />
      </mesh>

      {/* Torch lights on walls */}
      <pointLight position={[6, 3, 4]} intensity={1.0} color="#ff8833" />
      <pointLight position={[16, 3, 18]} intensity={1.0} color="#ff8833" />
      <pointLight position={[30, 3, 12]} intensity={0.8} color="#ff8833" />
      <pointLight position={[40, 3, 20]} intensity={0.8} color="#88cc88" />
    </group>
  );
}
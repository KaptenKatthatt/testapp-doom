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

// ============================================================
// E1M1 "Hangar" — simplified layout for our raycasting engine
// Coordinate system: X=east, Y=up, Z=north
// Player starts at approximately (3, 1.7, 4) facing north
// Map roughly 32 wide (X) × 38 deep (Z)
// ============================================================

const WH = 4; // Wall height
const W  = 0xaa9988; // Standard concrete
const W2 = 0x998877; // Secondary wall tone
const D  = 0xcc7744; // Door color
const M  = 0x888899; // Metal
const G  = 0x55aa55; // Nukage/slime
const RE = 0xcc2222; // Exit red

// ============================================================
// Layout (south to north, matching player start at z≈4):
//
// START ROOM:      x:0..10,  z:0..10   (player starts here, no enemies)
// L-CORRIDOR:      x:0..3 z:10..14 north, then x:3..16 z:14..17 east
// SLIME ROOM:      x:3..22,  z:14..31  (nukage + zigzag walkway)
// NORTH CORRIDOR:  x:12..15, z:31..34   (short, with door)
// EXIT ROOM:       x:12..20,  z:34..37  (exit switch)
//
// Doors (all require USE button):
//   Door 1: x:4..7, z:10  (start room → L-corridor)
//   Door 2: x:9..12, z:17 (L-corridor → slime room)
//   Door 3: x:12..15, z:31 (slime room → north corridor)
//   Door 4: x:13..15, z:34 (north corridor → exit room)
// ============================================================

const WALL_DATA: Array<{
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  color: number; isDoor?: boolean; noCollision?: boolean;
}> = [
  // ═══════════════════════════════════════════════════
  // OUTER PERIMETER (fully sealed, corners overlap)
  // ═══════════════════════════════════════════════════
  { x: -1, y: 2, z: -1, w: 1, h: WH, d: 39, color: W },       // West wall
  { x: 32, y: 2, z: -1, w: 1, h: WH, d: 39, color: W },       // East wall
  { x: -1, y: 2, z: -1, w: 34, h: WH, d: 1, color: W },        // South wall
  // North wall — split around exit room opening (x:12..20)
  { x: -1, y: 2, z: 37, w: 13, h: WH, d: 1, color: W },       // NW (x:-1..12)
  { x: 20, y: 2, z: 37, w: 13, h: WH, d: 1, color: W },       // NE (x:20..33)

  // ═══════════════════════════════════════════════════
  // START ROOM — x:0..10, z:0..10
  // Player at ~(3, 1.7, 4), facing north
  // ═══════════════════════════════════════════════════
  // East wall (x=10, z:0..10)
  { x: 10, y: 2, z: 0, w: 1, h: WH, d: 10, color: W2 },
  // North wall (z=10) — split around Door 1
  { x: 0, y: 2, z: 10, w: 4, h: WH, d: 1, color: W2 },               // left of door
  { x: 4, y: 2, z: 10, w: 3, h: WH, d: 1, color: D, isDoor: true },  // DOOR 1
  { x: 7, y: 2, z: 10, w: 3, h: WH, d: 1, color: W2 },               // right of door

  // ═══════════════════════════════════════════════════
  // L-CORRIDOR — north leg then east leg
  // North leg: x:0..3, z:10..14 (3 wide, player walks north)
  // East leg:  x:3..16, z:14..17 (3 deep, player walks east)
  // ═══════════════════════════════════════════════════
  // East wall of north leg (x=3, z:10..14)
  { x: 3, y: 2, z: 10, w: 1, h: WH, d: 4, color: W2 },
  // North wall of east leg / south wall of slime room (z=14, x:3..16)
  // This wall separates the corridor (south) from the slime room (north)
  { x: 3, y: 2, z: 14, w: 13, h: WH, d: 1, color: W2 },
  // East wall of east leg (x=16, z:14..17)
  { x: 16, y: 2, z: 14, w: 1, h: WH, d: 3, color: W2 },
  // South wall of east leg (z=17) — split for Door 2
  { x: 3, y: 2, z: 17, w: 6, h: WH, d: 1, color: W2 },               // x:3..9
  { x: 9, y: 2, z: 17, w: 3, h: WH, d: 1, color: D, isDoor: true },  // DOOR 2
  { x: 12, y: 2, z: 17, w: 4, h: WH, d: 1, color: W2 },              // x:12..16

  // ═══════════════════════════════════════════════════
  // SLIME / NUKAGE ROOM — x:3..22, z:14..31 (19×17)
  // Large room with nukage pool and zigzag walkway
  // ═══════════════════════════════════════════════════
  // West wall (x=3, z:17..31) — gap at z:14..17 for corridor
  { x: 3, y: 2, z: 17, w: 1, h: WH, d: 14, color: W2 },
  // South wall east extension (z=17, x:16..22) — past corridor east leg
  { x: 16, y: 2, z: 17, w: 6, h: WH, d: 1, color: W2 },
  // East wall (x=22, z:14..31)
  { x: 22, y: 2, z: 14, w: 1, h: WH, d: 17, color: W },
  // North wall (z=31) — split for Door 3
  { x: 3, y: 2, z: 31, w: 9, h: WH, d: 1, color: W2 },               // x:3..12
  { x: 12, y: 2, z: 31, w: 3, h: WH, d: 1, color: D, isDoor: true }, // DOOR 3
  { x: 15, y: 2, z: 31, w: 7, h: WH, d: 1, color: W },               // x:15..22
  // Internal partitions for zigzag walkway feel
  { x: 8, y: 2, z: 20, w: 1, h: WH, d: 7, color: G },
  { x: 18, y: 2, z: 22, w: 1, h: WH, d: 7, color: G },

  // ═══════════════════════════════════════════════════
  // NORTH CORRIDOR — x:12..15, z:31..34 (3 wide)
  // ═══════════════════════════════════════════════════
  // West wall (x=12, z:31..34)
  { x: 12, y: 2, z: 31, w: 1, h: WH, d: 3, color: W2 },
  // East wall (x=15, z:31..34)
  { x: 15, y: 2, z: 31, w: 1, h: WH, d: 3, color: W2 },
  // North wall (z=34) — split for Door 4
  { x: 12, y: 2, z: 34, w: 1, h: WH, d: 1, color: W2 },
  { x: 13, y: 2, z: 34, w: 2, h: WH, d: 1, color: D, isDoor: true }, // DOOR 4

  // ═══════════════════════════════════════════════════
  // EXIT ROOM — x:12..20, z:34..37
  // ═══════════════════════════════════════════════════
  // West wall (x=12, z:34..37)
  { x: 12, y: 2, z: 34, w: 1, h: WH, d: 3, color: RE },
  // East wall (x=20, z:34..37)
  { x: 20, y: 2, z: 34, w: 1, h: WH, d: 3, color: RE },
  // Red accent wall (interior face of north outer wall)
  { x: 13, y: 2, z: 36.5, w: 7, h: WH, d: 0.3, color: RE },

  // ═══════════════════════════════════════════════════
  // DECORATIVE / DETAIL
  // ═══════════════════════════════════════════════════
  // Alcove in start room SW corner
  { x: 0, y: 2, z: 8, w: 1.5, h: WH, d: 1, color: W2 },
];

interface WallMeshData {
  key: number;
  position: [number, number, number];
  scale: [number, number, number];
  color: number;
  isDoor: boolean;
}

function buildWallMeshes(): WallMeshData[] {
  return WALL_DATA.filter((w) => !w.isDoor).map((w, i) => ({
    key: i,
    position: [w.x + w.w / 2, w.y, w.z + w.d / 2] as [number, number, number],
    scale: [w.w, w.h, w.d] as [number, number, number],
    color: w.color,
    isDoor: w.isDoor ?? false,
  }));
}

const WALL_MESHES: WallMeshData[] = buildWallMeshes();

export function getWalls(): WallBox[] {
  return WALL_DATA.filter((w) => !w.isDoor && !w.noCollision).map((w) => ({
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
      {/* ═══ Ambient + hemisphere for base visibility ═══ */}
      <ambientLight intensity={1.2} color="#ddccaa" />
      <hemisphereLight args={["#ffeedd", "#443322", 0.6]} />

      {/* ═══ Start Room lighting ═══ */}
      <pointLight position={[5, 3.5, 5]} intensity={5.0} color="#ffaa66" distance={20} />
      <pointLight position={[5, 3.5, 8]} intensity={3.0} color="#ffcc88" distance={15} />

      {/* ═══ L-Corridor lighting ═══ */}
      <pointLight position={[2, 3.5, 12]} intensity={3.0} color="#ff9944" distance={12} />
      <pointLight position={[8, 3.5, 15]} intensity={3.0} color="#ffaa55" distance={12} />

      {/* ═══ Slime Room lighting ═══ */}
      <pointLight position={[12, 3.5, 24]} intensity={4.0} color="#88ff88" distance={25} />
      <pointLight position={[18, 3.5, 22]} intensity={3.0} color="#66dd66" distance={20} />
      <pointLight position={[6, 3.5, 26]} intensity={2.5} color="#ffaa44" distance={15} />

      {/* ═══ North Corridor & Exit lighting ═══ */}
      <pointLight position={[13.5, 3.5, 32.5]} intensity={3.0} color="#ff6666" distance={12} />
      <pointLight position={[16, 3.5, 35.5]} intensity={4.0} color="#ff4444" distance={10} />

      {/* ═══ Ceiling lights ═══ */}
      <pointLight position={[5, 3.9, 5]} intensity={2.0} color="#ffffff" distance={12} />
      <pointLight position={[13, 3.9, 24]} intensity={2.5} color="#ffffff" distance={18} />
      <pointLight position={[16, 3.9, 35.5]} intensity={2.0} color="#ffffff" distance={8} />

      {/* ═══ FLOOR ═══ */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[16, 0, 18]}>
        <planeGeometry args={[34, 40]} />
        <meshLambertMaterial map={textures.floor} color={0x776655} emissive={0x221100} emissiveIntensity={0.2} />
      </mesh>

      {/* ═══ CEILING ═══ */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[16, 4, 18]}>
        <planeGeometry args={[34, 40]} />
        <meshLambertMaterial map={textures.ceiling} color={0x666655} emissive={0x222211} emissiveIntensity={0.15} />
      </mesh>

      {/* ═══ WALLS ═══ */}
      {WALL_MESHES.map((w) => {
        const isDoor = w.isDoor;
        const isGreen = w.color === G;
        const isMetal = w.color === M;
        const isRedExit = w.color === RE;

        let wallTexture = textures.wall;
        if (isDoor) wallTexture = textures.door;
        else if (isGreen) wallTexture = textures.slime;
        else if (isMetal) wallTexture = textures.metal;
        else if (isRedExit) wallTexture = textures.blood;

        const materialProps: Record<string, unknown> = {
          map: wallTexture,
          color: w.color,
          emissive: isDoor ? 0x664400 : isGreen ? 0x225522 : isMetal ? 0x222233 : isRedExit ? 0x661111 : 0x333322,
          emissiveIntensity: isDoor ? 0.6 : isGreen ? 0.4 : isRedExit ? 0.8 : 0.35,
        };

        return (
          <mesh key={w.key} position={w.position}>
            <boxGeometry args={w.scale} />
            <meshLambertMaterial {...materialProps} />
          </mesh>
        );
      })}

      {/* ═══ NUKAGE POOLS ═══ */}
      {/* Main nukage pool in slime room */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[13, 0.01, 24]}>
        <planeGeometry args={[10, 7]} />
        <meshLambertMaterial
          map={textures.slime}
          color={0x44aa44}
          emissive={0x22ff22}
          emissiveIntensity={0.6}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Secondary nukage pool */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12, 0.01, 29]}>
        <planeGeometry args={[8, 4]} />
        <meshLambertMaterial
          map={textures.slime}
          color={0x44aa44}
          emissive={0x22ff22}
          emissiveIntensity={0.6}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* ═══ ZIGZAG WALKWAY (raised metal platforms over nukage) ═══ */}
      {/* Segment 1: entrance from south, heading north */}
      <mesh position={[10, 0.25, 19]}>
        <boxGeometry args={[3, 0.5, 3]} />
        <meshLambertMaterial map={textures.metal} color={0x888899} emissive={0x222233} emissiveIntensity={0.3} />
      </mesh>
      {/* Segment 2: turns east */}
      <mesh position={[13, 0.25, 20]}>
        <boxGeometry args={[4, 0.5, 3]} />
        <meshLambertMaterial map={textures.metal} color={0x888899} emissive={0x222233} emissiveIntensity={0.3} />
      </mesh>
      {/* Segment 3: turns north */}
      <mesh position={[16, 0.25, 24]}>
        <boxGeometry args={[3, 0.5, 5]} />
        <meshLambertMaterial map={textures.metal} color={0x888899} emissive={0x222233} emissiveIntensity={0.3} />
      </mesh>
      {/* Segment 4: approaches north corridor door */}
      <mesh position={[14, 0.25, 28]}>
        <boxGeometry args={[5, 0.5, 3]} />
        <meshLambertMaterial map={textures.metal} color={0x888899} emissive={0x222233} emissiveIntensity={0.3} />
      </mesh>

      {/* ═══ EXIT SIGN ═══ */}
      <mesh position={[16, 3.2, 36.5]}>
        <boxGeometry args={[2, 0.6, 0.15]} />
        <meshBasicMaterial color={0xff0000} />
      </mesh>
      <pointLight position={[16, 3.5, 36]} intensity={3.0} color="#ff0000" distance={8} />

      {/* ═══ CROSS in start room ═══ */}
      <mesh position={[1.5, 2.5, 3]}>
        <boxGeometry args={[0.15, 1.0, 0.05]} />
        <meshLambertMaterial color={0xcc4444} emissive={0x441111} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[1.5, 2.8, 3]}>
        <boxGeometry args={[0.5, 0.15, 0.05]} />
        <meshLambertMaterial color={0xcc4444} emissive={0x441111} emissiveIntensity={0.5} />
      </mesh>

      {/* ═══ BARRELS ═══ */}
      {/* Start room */}
      <mesh position={[1.5, 0.5, 7]}>
        <cylinderGeometry args={[0.4, 0.4, 1, 8]} />
        <meshLambertMaterial map={textures.barrel} />
      </mesh>
      <mesh position={[8.5, 0.5, 2]}>
        <cylinderGeometry args={[0.4, 0.4, 1, 8]} />
        <meshLambertMaterial map={textures.barrel} />
      </mesh>
      {/* Slime room */}
      <mesh position={[21, 0.5, 28]}>
        <cylinderGeometry args={[0.4, 0.4, 1, 8]} />
        <meshLambertMaterial map={textures.barrel} />
      </mesh>
      <mesh position={[5, 0.5, 30]}>
        <cylinderGeometry args={[0.4, 0.4, 1, 8]} />
        <meshLambertMaterial map={textures.barrel} />
      </mesh>
      {/* North corridor */}
      <mesh position={[14.5, 0.5, 33]}>
        <cylinderGeometry args={[0.35, 0.35, 1, 8]} />
        <meshLambertMaterial map={textures.barrel} />
      </mesh>

      {/* ═══ BLOOD POOL ═══ */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[20, 0.01, 29]}>
        <circleGeometry args={[1.2, 16]} />
        <meshLambertMaterial map={textures.blood} transparent opacity={0.7} />
      </mesh>

      {/* ═══ TORCH FLAMES ═══ */}
      {[
        [1, 3.2, 6] as [number, number, number],
        [9, 3.2, 3] as [number, number, number],
        [1.5, 3.2, 12] as [number, number, number],
        [10, 3.2, 16] as [number, number, number],
        [4, 3.2, 19] as [number, number, number],
        [7, 3.2, 26] as [number, number, number],
        [20, 3.2, 20] as [number, number, number],
        [20, 3.2, 28] as [number, number, number],
        [13.5, 3.2, 32.5] as [number, number, number],
      ].map((pos, i) => (
        <mesh key={`torch-${i}`} position={pos}>
          <boxGeometry args={[0.15, 0.15, 0.15]} />
          <meshBasicMaterial color="#ff6600" />
        </mesh>
      ))}

    </group>
  );
}
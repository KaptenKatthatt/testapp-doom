import { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Mesh, Group } from "three";
import type { EnemyData, EnemyType } from "./types";

const ENEMY_CONFIG: Record<EnemyType, {
  bodyW: number; bodyH: number; bodyD: number;
  headSize: number; color: number; speed: number;
  attackRange: number; attackCooldown: number; attackDamage: number;
}> = {
  imp: {
    bodyW: 1.0, bodyH: 2.0, bodyD: 0.8,
    headSize: 0.65, color: 0xcc6622, speed: 1.5,
    attackRange: 8, attackCooldown: 2, attackDamage: 2,
  },
  demon: {
    bodyW: 1.5, bodyH: 1.6, bodyD: 1.0,
    headSize: 0.9, color: 0xcc1144, speed: 3,
    attackRange: 2.5, attackCooldown: 1.2, attackDamage: 2,
  },
  zombieman: {
    bodyW: 0.9, bodyH: 3.2, bodyD: 0.7,
    headSize: 0.55, color: 0x99aa77, speed: 1.0,
    attackRange: 12, attackCooldown: 2.5, attackDamage: 2,
  },
  ratman: {
    bodyW: 0.9, bodyH: 2.8, bodyD: 0.7,
    headSize: 0.55, color: 0xccaa44, speed: 1.0,
    attackRange: 12, attackCooldown: 2.5, attackDamage: 2,
  },
  mancubus: {
    bodyW: 1.8, bodyH: 2.2, bodyD: 1.8,
    headSize: 0.8, color: 0xffa500, speed: 1.6,
    attackRange: 20, attackCooldown: 3.5, attackDamage: 12,
  },
  cacodemon: {
    bodyW: 1.5, bodyH: 1.6, bodyD: 1.5,
    headSize: 0.8, color: 0x9400d3, speed: 3.5,
    attackRange: 25, attackCooldown: 2.0, attackDamage: 8,
  },
};

const CACODEMON_FLOAT_HEIGHT = 1.4;

interface SpriteCol {
  minX: number;
  maxX: number;
  w: number;
}

interface SpriteRow {
  endY: number;
  height: number;
  cols?: SpriteCol[];
}

const textureCache = new Map<string, THREE.Texture>();

function isCyanKey(r: number, g: number, b: number): boolean {
  return (r < 120 && g > 150 && b > 150) || (g > r + 15 && b > r + 15);
}

function isNeutralGrayKey(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max < 115 && max - min < 12;
}

function createChromaKeyTexture(src: string): THREE.Texture {
  const cached = textureCache.get(src);
  if (cached) return cached;

  const texture = new THREE.Texture();
  const img = new Image();
  img.src = src;
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] ?? 0;
        const g = data[i + 1] ?? 0;
        const b = data[i + 2] ?? 0;
        if (isCyanKey(r, g, b)) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      (texture as unknown as { image: HTMLCanvasElement }).image = canvas;
      texture.needsUpdate = true;
    }
  };
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  textureCache.set(src, texture);
  return texture;
}

function createCacodemonTexture(): THREE.Texture {
  const src = "/cacodemon.png";
  const cached = textureCache.get(src);
  if (cached) return cached;

  const texture = new THREE.Texture();
  const img = new Image();
  img.src = src;
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] ?? 0;
        const g = data[i + 1] ?? 0;
        const b = data[i + 2] ?? 0;
        if (isCyanKey(r, g, b) || isNeutralGrayKey(r, g, b)) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      (texture as unknown as { image: HTMLCanvasElement }).image = canvas;
      texture.needsUpdate = true;
    }
  };
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  textureCache.set(src, texture);
  return texture;
}

function getMancubusBaseTexture(): THREE.Texture {
  return createChromaKeyTexture("/mancubus.png");
}

function getRatmanBaseTexture(): THREE.Texture {
  return createChromaKeyTexture("/ratman.png");
}

function getCacodemonBaseTexture(): THREE.Texture {
  return createCacodemonTexture();
}

function applyUniformGridUV(
  texture: THREE.Texture,
  sheetH: number,
  endY: number,
  height: number,
  col: number,
  colCount: number,
  mirrored: boolean,
): void {
  const repeatY = height / sheetH;
  const offsetY = (sheetH - endY - 1) / sheetH;
  const repeatX = mirrored ? -1 / colCount : 1 / colCount;
  const offsetX = mirrored ? (col + 1) / colCount : col / colCount;
  texture.repeat.set(repeatX, repeatY);
  texture.offset.set(offsetX, offsetY);
}

function applyVariableColUV(
  texture: THREE.Texture,
  sheetW: number,
  sheetH: number,
  row: SpriteRow,
  col: number,
  mirrored: boolean,
): void {
  const colData = row.cols?.[col] ?? row.cols?.[0];
  if (!colData) return;
  const repeatY = row.height / sheetH;
  const offsetY = (sheetH - row.endY - 1) / sheetH;
  const repeatX = colData.w / sheetW;
  texture.repeat.set(mirrored ? -repeatX : repeatX, repeatY);
  texture.offset.set(
    mirrored ? (colData.maxX + 1) / sheetW : colData.minX / sheetW,
    offsetY,
  );
}

function getDirectionCol5(diff: number): { col: number; mirrored: boolean } {
  const absDiff = Math.abs(diff);
  let col = 0;
  if (absDiff < Math.PI / 8) col = 0;
  else if (absDiff < 3 * Math.PI / 8) col = 1;
  else if (absDiff < 5 * Math.PI / 8) col = 2;
  else if (absDiff < 7 * Math.PI / 8) col = 3;
  else col = 4;
  const mirrored = diff < 0 && col > 0 && col < 4;
  return { col, mirrored };
}

function getDirectionCol8(diff: number): number {
  const idx = Math.round(diff / (Math.PI / 4));
  return ((idx % 8) + 8) % 8;
}

function getCameraDiff(
  cameraX: number,
  cameraZ: number,
  posX: number,
  posZ: number,
  rotation: number,
): number {
  const dx = posX - cameraX;
  const dz = posZ - cameraZ;
  const angleToCamera = Math.atan2(dx, dz);
  const diff = angleToCamera - rotation;
  return Math.atan2(Math.sin(diff), Math.cos(diff));
}

const MANCUBUS_ROWS: SpriteRow[] = [
  { endY: 87, height: 62 },
  { endY: 172, height: 65 },
  { endY: 259, height: 62 },
  { endY: 350, height: 65 },
  { endY: 427, height: 63 },
  { endY: 501, height: 61 },
  { endY: 573, height: 62 },
  { endY: 647, height: 60 },
  { endY: 723, height: 59 },
  { endY: 792, height: 57 },
  { endY: 860, height: 58 },
  { endY: 937, height: 68 },
  { endY: 1010, height: 43 },
];

const RATMAN_COLS: SpriteCol[] = [
  { minX: 18, maxX: 53, w: 36 },
  { minX: 91, maxX: 126, w: 36 },
  { minX: 173, maxX: 214, w: 42 },
  { minX: 249, maxX: 293, w: 45 },
  { minX: 324, maxX: 361, w: 38 },
  { minX: 393, maxX: 428, w: 36 },
  { minX: 454, maxX: 494, w: 41 },
  { minX: 517, maxX: 560, w: 44 },
];

const RATMAN_ROWS: SpriteRow[] = [
  { endY: 78, height: 60, cols: RATMAN_COLS },
  { endY: 152, height: 63, cols: RATMAN_COLS },
  { endY: 223, height: 63, cols: RATMAN_COLS },
  { endY: 295, height: 61, cols: RATMAN_COLS },
  { endY: 373, height: 66, cols: RATMAN_COLS },
  { endY: 448, height: 66, cols: RATMAN_COLS },
  { endY: 523, height: 61, cols: RATMAN_COLS },
  { endY: 615, height: 63, cols: RATMAN_COLS.slice(0, 6) },
];

const CACODEMON_ROWS: SpriteRow[] = [
  {
    endY: 81, height: 78,
    cols: [
      { minX: 16, maxX: 77, w: 62 },
      { minX: 106, maxX: 183, w: 78 },
      { minX: 202, maxX: 281, w: 80 },
      { minX: 300, maxX: 370, w: 71 },
      { minX: 392, maxX: 447, w: 56 },
    ],
  },
  {
    endY: 156, height: 78,
    cols: [
      { minX: 16, maxX: 76, w: 61 },
      { minX: 106, maxX: 183, w: 78 },
      { minX: 202, maxX: 280, w: 79 },
      { minX: 300, maxX: 370, w: 71 },
      { minX: 397, maxX: 447, w: 51 },
    ],
  },
  {
    endY: 244, height: 79,
    cols: [
      { minX: 19, maxX: 76, w: 58 },
      { minX: 112, maxX: 181, w: 70 },
      { minX: 205, maxX: 283, w: 79 },
      { minX: 300, maxX: 370, w: 71 },
      { minX: 393, maxX: 451, w: 59 },
    ],
  },
  {
    endY: 331, height: 76,
    cols: [
      { minX: 19, maxX: 80, w: 62 },
      { minX: 111, maxX: 184, w: 74 },
      { minX: 209, maxX: 284, w: 76 },
      { minX: 300, maxX: 373, w: 74 },
      { minX: 393, maxX: 451, w: 59 },
    ],
  },
  {
    endY: 415, height: 75,
    cols: [
      { minX: 18, maxX: 86, w: 69 },
      { minX: 114, maxX: 183, w: 70 },
      { minX: 208, maxX: 285, w: 78 },
      { minX: 301, maxX: 368, w: 68 },
      { minX: 393, maxX: 452, w: 60 },
    ],
  },
  {
    endY: 509, height: 85,
    cols: [
      { minX: 19, maxX: 88, w: 70 },
      { minX: 118, maxX: 185, w: 68 },
      { minX: 212, maxX: 281, w: 70 },
      { minX: 300, maxX: 366, w: 67 },
      { minX: 390, maxX: 453, w: 64 },
    ],
  },
  {
    endY: 591, height: 77,
    cols: [
      { minX: 22, maxX: 85, w: 64 },
      { minX: 121, maxX: 184, w: 64 },
      { minX: 214, maxX: 282, w: 69 },
      { minX: 304, maxX: 369, w: 66 },
      { minX: 393, maxX: 453, w: 61 },
    ],
  },
  {
    endY: 684, height: 81,
    cols: [
      { minX: 28, maxX: 91, w: 64 },
      { minX: 117, maxX: 188, w: 72 },
      { minX: 216, maxX: 285, w: 70 },
      { minX: 303, maxX: 367, w: 65 },
      { minX: 389, maxX: 447, w: 59 },
      { minX: 462, maxX: 530, w: 69 },
      { minX: 544, maxX: 619, w: 76 },
      { minX: 652, maxX: 717, w: 66 },
    ],
  },
  {
    endY: 765, height: 81,
    cols: [
      { minX: 24, maxX: 88, w: 65 },
      { minX: 105, maxX: 192, w: 88 },
      { minX: 201, maxX: 290, w: 90 },
      { minX: 301, maxX: 365, w: 65 },
      { minX: 387, maxX: 448, w: 62 },
      { minX: 464, maxX: 544, w: 81 },
      { minX: 551, maxX: 645, w: 95 },
      { minX: 657, maxX: 727, w: 71 },
    ],
  },
  {
    endY: 839, height: 75,
    cols: [
      { minX: 24, maxX: 86, w: 63 },
      { minX: 92, maxX: 189, w: 98 },
      { minX: 194, maxX: 293, w: 100 },
      { minX: 298, maxX: 367, w: 70 },
      { minX: 387, maxX: 450, w: 64 },
      { minX: 464, maxX: 552, w: 89 },
      { minX: 555, maxX: 662, w: 108 },
      { minX: 666, maxX: 738, w: 73 },
    ],
  },
  {
    endY: 919, height: 79,
    cols: [
      { minX: 24, maxX: 84, w: 61 },
      { minX: 117, maxX: 190, w: 74 },
      { minX: 208, maxX: 295, w: 88 },
      { minX: 305, maxX: 370, w: 66 },
      { minX: 396, maxX: 449, w: 54 },
      { minX: 615, maxX: 677, w: 63 },
    ],
  },
  {
    endY: 998, height: 78,
    cols: [
      { minX: 20, maxX: 86, w: 67 },
      { minX: 116, maxX: 197, w: 82 },
      { minX: 221, maxX: 292, w: 72 },
      { minX: 307, maxX: 378, w: 72 },
      { minX: 392, maxX: 463, w: 72 },
      { minX: 476, maxX: 551, w: 76 },
      { minX: 560, maxX: 625, w: 66 },
      { minX: 645, maxX: 716, w: 72 },
    ],
  },
];

function updateSpriteScale(
  sprite: THREE.Sprite,
  bodyW: number,
  bodyH: number,
  frameHeight: number,
  refHeight: number,
  yOffset: number,
): void {
  const scaleY = bodyH * (frameHeight / refHeight);
  sprite.scale.set(bodyW * 2.2, scaleY, 1);
  sprite.position.set(0, scaleY / 2 + yOffset, 0);
}

function HealthBar({
  healthPct,
  y,
  width = 1.2,
}: {
  readonly healthPct: number;
  readonly y: number;
  readonly width?: number;
}): React.JSX.Element {
  return (
    <>
      <mesh position={[0, y, 0]}>
        <planeGeometry args={[width, 0.1]} />
        <meshBasicMaterial color={0x440000} />
      </mesh>
      <mesh position={[-width / 2 + healthPct * (width / 2), y, 0.01]}>
        <planeGeometry args={[width * healthPct, 0.1]} />
        <meshBasicMaterial color={healthPct > 0.5 ? 0x00ff00 : healthPct > 0.25 ? 0xff8800 : 0xff0000} />
      </mesh>
    </>
  );
}

function EnemyLight({
  lightRef,
  position,
  bodyH,
  color,
}: {
  readonly lightRef: React.RefObject<THREE.PointLight | null>;
  readonly position: [number, number, number];
  readonly bodyH: number;
  readonly color: string;
}): React.JSX.Element {
  return (
    <pointLight
      ref={lightRef}
      position={[position[0], position[1] + bodyH + 0.5, position[2]]}
      color={color}
      intensity={2.0}
      distance={8}
    />
  );
}

export default function Enemies({ enemies }: { readonly enemies: EnemyData[] }): React.JSX.Element {
  return (
    <group>
      {enemies.map((e) =>
        e.alive ? <Enemy key={e.id} enemy={e} /> : <Corpse key={e.id} enemy={e} />
      )}
    </group>
  );
}

function Enemy({ enemy }: { readonly enemy: EnemyData }): React.JSX.Element {
  const meshRef = useRef<Group>(null);
  const glowRef = useRef<Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const spriteRef = useRef<THREE.Sprite>(null);
  const { position, type, hitFlash, rotation } = enemy;
  const config = ENEMY_CONFIG[type];
  const isDemon = type === "demon";
  const eyeColor = isDemon ? "#ff0044" : "#ff4400";
  const healthPct = enemy.health / enemy.maxHealth;
  const flashIntensity = hitFlash > 0 ? hitFlash : 0;
  const isSpriteEnemy = type === "mancubus" || type === "ratman" || type === "cacodemon";

  const mancubusTexture = useMemo(() => getMancubusBaseTexture().clone(), []);
  const ratmanTexture = useMemo(() => getRatmanBaseTexture().clone(), []);
  const cacodemonTexture = useMemo(() => getCacodemonBaseTexture().clone(), []);

  const bodyTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return new THREE.CanvasTexture(canvas);
    }
    const baseColor = type === "imp" ? [204, 102, 34] : type === "demon" ? [204, 17, 68] : [153, 170, 119];
    ctx.fillStyle = `rgb(${baseColor[0]},${baseColor[1]},${baseColor[2]})`;
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const bright = Math.random() > 0.5;
      const a = Math.random() * 0.3;
      ctx.fillStyle = bright ? `rgba(255,255,255,${a * 0.3})` : `rgba(0,0,0,${a})`;
      ctx.fillRect(x, y, 2 + Math.random() * 2, 1 + Math.random());
    }
    ctx.fillStyle = `rgba(255,200,100,0.3)`;
    ctx.fillRect(16, 24, 32, 16);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }, [type]);

  useFrame((state) => {
    if (type === "mancubus") {
      const diff = getCameraDiff(
        state.camera.position.x,
        state.camera.position.z,
        position[0],
        position[2],
        rotation,
      );
      const { col, mirrored } = getDirectionCol5(diff);

      let row = 0;
      if (hitFlash > 0.1) {
        row = 7;
      } else if (state.clock.getElapsedTime() - enemy.lastAttack < 0.6) {
        const fireFrame = Math.floor((state.clock.getElapsedTime() - enemy.lastAttack) / 0.2) % 3;
        row = 4 + fireFrame;
      } else {
        row = Math.floor(state.clock.getElapsedTime() * 6) % 4;
      }

      const rowData = MANCUBUS_ROWS[row] ?? MANCUBUS_ROWS[0];
      if (!rowData) return;
      applyUniformGridUV(mancubusTexture, 1024, rowData.endY, rowData.height, col, 5, mirrored);

      if (spriteRef.current) {
        updateSpriteScale(spriteRef.current, config.bodyW, config.bodyH, rowData.height, 65, 0);
      }
    }

    if (type === "ratman") {
      const diff = getCameraDiff(
        state.camera.position.x,
        state.camera.position.z,
        position[0],
        position[2],
        rotation,
      );
      const col = getDirectionCol8(diff);

      let row = 0;
      if (hitFlash > 0.1) {
        row = 6;
      } else if (state.clock.getElapsedTime() - enemy.lastAttack < 0.5) {
        const fireFrame = Math.floor((state.clock.getElapsedTime() - enemy.lastAttack) / 0.25) % 2;
        row = 4 + fireFrame;
      } else {
        row = Math.floor(state.clock.getElapsedTime() * 6) % 4;
      }

      const rowData = RATMAN_ROWS[row] ?? RATMAN_ROWS[0];
      if (!rowData) return;
      applyVariableColUV(ratmanTexture, 592, 658, rowData, col, false);

      if (spriteRef.current) {
        updateSpriteScale(spriteRef.current, config.bodyW, config.bodyH, rowData.height, 63, 0);
      }
    }

    if (type === "cacodemon") {
      const diff = getCameraDiff(
        state.camera.position.x,
        state.camera.position.z,
        position[0],
        position[2],
        rotation,
      );
      const { col, mirrored } = getDirectionCol5(diff);

      let row = 0;
      if (hitFlash > 0.1) {
        row = 6;
      } else if (state.clock.getElapsedTime() - enemy.lastAttack < 0.5) {
        row = 5;
      } else {
        row = Math.floor(state.clock.getElapsedTime() * 4) % 5;
      }

      const rowData = CACODEMON_ROWS[row] ?? CACODEMON_ROWS[0];
      if (!rowData) return;
      applyVariableColUV(cacodemonTexture, 758, 1024, rowData, col, mirrored);

      const bob = Math.sin(state.clock.getElapsedTime() * 2 + enemy.id) * 0.15;
      if (spriteRef.current) {
        updateSpriteScale(spriteRef.current, config.bodyW, config.bodyH, rowData.height, 78, CACODEMON_FLOAT_HEIGHT + bob);
      }
    }

    if (meshRef.current && !isSpriteEnemy) {
      meshRef.current.position.y =
        Math.sin(state.clock.getElapsedTime() * 3 + enemy.id) * 0.05;
    }
    if (glowRef.current) {
      const material = glowRef.current.material;
      if (material && "emissiveIntensity" in material) {
        const pulse = 0.5 + Math.sin(state.clock.getElapsedTime() * 5 + enemy.id * 2) * 0.3;
        (material as { emissiveIntensity: number }).emissiveIntensity = pulse;
      }
    }
    if (lightRef.current) {
      const dx = position[0] - state.camera.position.x;
      const dz = position[2] - state.camera.position.z;
      const distSq = dx * dx + dz * dz;
      lightRef.current.visible = distSq < 225;
      lightRef.current.intensity = 2.0;
    }
  });

  if (type === "mancubus") {
    return (
      <group position={[position[0], 0, position[2]]}>
        <sprite ref={spriteRef} scale={[config.bodyW * 2.2, config.bodyH * 1.1, 1]}>
          <spriteMaterial
            map={mancubusTexture}
            transparent
            alphaTest={0.01}
            color={hitFlash > 0.05 ? "#ff5555" : "#ffffff"}
          />
        </sprite>
        <HealthBar healthPct={healthPct} y={config.bodyH + 0.3} width={1.5} />
        <EnemyLight lightRef={lightRef} position={position} bodyH={config.bodyH} color="#ffaa00" />
      </group>
    );
  }

  if (type === "ratman") {
    return (
      <group position={[position[0], 0, position[2]]}>
        <sprite ref={spriteRef} scale={[config.bodyW * 2.2, config.bodyH, 1]}>
          <spriteMaterial
            map={ratmanTexture}
            transparent
            alphaTest={0.01}
            color={hitFlash > 0.05 ? "#ff5555" : "#ffffff"}
          />
        </sprite>
        <HealthBar healthPct={healthPct} y={config.bodyH + 0.3} width={1.2} />
        <EnemyLight lightRef={lightRef} position={position} bodyH={config.bodyH} color="#88ff88" />
      </group>
    );
  }

  if (type === "cacodemon") {
    return (
      <group position={[position[0], 0, position[2]]}>
        <sprite ref={spriteRef} scale={[config.bodyW * 2.2, config.bodyH, 1]}>
          <spriteMaterial
            map={cacodemonTexture}
            transparent
            alphaTest={0.01}
            color={hitFlash > 0.05 ? "#ff5555" : "#ffffff"}
          />
        </sprite>
        <HealthBar healthPct={healthPct} y={config.bodyH + CACODEMON_FLOAT_HEIGHT + 0.5} width={1.2} />
        <EnemyLight lightRef={lightRef} position={position} bodyH={config.bodyH + CACODEMON_FLOAT_HEIGHT} color="#cc44ff" />
      </group>
    );
  }

  return (
    <group position={[position[0], 0, position[2]]} rotation={[0, rotation, 0]}>
      <group ref={meshRef} position={[0, config.bodyH / 2, 0]}>
        <mesh>
          <boxGeometry args={[config.bodyW, config.bodyH, config.bodyD]} />
          <meshLambertMaterial
            map={bodyTexture}
            color={config.color}
            emissive={config.color}
            emissiveIntensity={flashIntensity + 0.4}
          />
        </mesh>
        <mesh position={[0, config.bodyH / 2 + config.headSize / 2, 0]}>
          <boxGeometry args={[config.headSize, config.headSize, config.headSize]} />
          <meshLambertMaterial color={config.color} emissive={config.color} emissiveIntensity={0.5} />
        </mesh>
        <mesh
          ref={glowRef}
          position={[
            isDemon ? -0.2 : -0.13,
            config.bodyH / 2 + config.headSize / 2 + 0.05,
            isDemon ? -0.35 : -0.28,
          ]}
        >
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshBasicMaterial color={eyeColor} />
        </mesh>
        <mesh
          position={[
            isDemon ? 0.2 : 0.13,
            config.bodyH / 2 + config.headSize / 2 + 0.05,
            isDemon ? -0.35 : -0.28,
          ]}
        >
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshBasicMaterial color={eyeColor} />
        </mesh>
        {isDemon && (
          <>
            <mesh position={[-0.35, config.bodyH / 2 + config.headSize, 0]} rotation={[0, 0, 0.3]}>
              <coneGeometry args={[0.08, 0.4, 6]} />
              <meshLambertMaterial color={0x440022} />
            </mesh>
            <mesh position={[0.35, config.bodyH / 2 + config.headSize, 0]} rotation={[0, 0, -0.3]}>
              <coneGeometry args={[0.08, 0.4, 6]} />
              <meshLambertMaterial color={0x440022} />
            </mesh>
          </>
        )}
        <mesh position={[-(config.bodyW / 2 + 0.25), config.bodyH * 0.1, 0]}>
          <boxGeometry args={[0.3, config.bodyH * 0.4, 0.3]} />
          <meshLambertMaterial color={config.color} emissive={config.color} emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[config.bodyW / 2 + 0.25, config.bodyH * 0.1, 0]}>
          <boxGeometry args={[0.3, config.bodyH * 0.4, 0.3]} />
          <meshLambertMaterial color={config.color} emissive={config.color} emissiveIntensity={0.3} />
        </mesh>
      </group>
      <HealthBar healthPct={healthPct} y={config.bodyH + 1.0} />
      <EnemyLight lightRef={lightRef} position={position} bodyH={config.bodyH} color={type === "demon" ? "#ff0044" : type === "zombieman" ? "#88ff88" : "#ff6600"} />
    </group>
  );
}

function Corpse({ enemy }: { readonly enemy: EnemyData }): React.JSX.Element {
  const { position } = enemy;
  const config = ENEMY_CONFIG[enemy.type];
  const [deathTime] = useState(() => performance.now() / 1000);
  const mancubusTexture = useMemo(() => getMancubusBaseTexture().clone(), []);
  const ratmanTexture = useMemo(() => getRatmanBaseTexture().clone(), []);
  const cacodemonTexture = useMemo(() => getCacodemonBaseTexture().clone(), []);
  const spriteRef = useRef<THREE.Sprite>(null);

  useFrame(() => {
    const elapsed = (performance.now() / 1000) - deathTime;

    if (enemy.type === "mancubus") {
      let row = 8;
      if (elapsed < 0.1) row = 8;
      else if (elapsed < 0.2) row = 9;
      else if (elapsed < 0.3) row = 10;
      else if (elapsed < 0.4) row = 11;
      else row = 12;

      const rowData = MANCUBUS_ROWS[row] ?? MANCUBUS_ROWS[12];
      if (!rowData) return;
      applyUniformGridUV(mancubusTexture, 1024, rowData.endY, rowData.height, 0, 5, false);

      if (spriteRef.current) {
        updateSpriteScale(spriteRef.current, config.bodyW, config.bodyH, rowData.height, 65, 0);
      }
    }

    if (enemy.type === "ratman") {
      const rowData = RATMAN_ROWS[7] ?? RATMAN_ROWS[0];
      if (!rowData) return;
      const deathFrame = Math.min(5, Math.floor(elapsed / 0.12));
      applyVariableColUV(ratmanTexture, 592, 658, rowData, deathFrame, false);

      if (spriteRef.current) {
        updateSpriteScale(spriteRef.current, config.bodyW, config.bodyH, rowData.height, 63, 0);
      }
    }

    if (enemy.type === "cacodemon") {
      const rowData = CACODEMON_ROWS[11] ?? CACODEMON_ROWS[0];
      if (!rowData) return;
      const deathFrame = Math.min(7, Math.floor(elapsed / 0.1));
      applyVariableColUV(cacodemonTexture, 758, 1024, rowData, deathFrame, false);

      const fallDuration = 0.7;
      const fallProgress = Math.min(1, elapsed / fallDuration);
      const yOffset = CACODEMON_FLOAT_HEIGHT * (1 - fallProgress);

      if (spriteRef.current) {
        updateSpriteScale(spriteRef.current, config.bodyW, config.bodyH, rowData.height, 78, yOffset);
      }
    }
  });

  if (enemy.type === "mancubus") {
    return (
      <group position={[position[0], 0, position[2]]}>
        <sprite ref={spriteRef} scale={[config.bodyW * 2.2, config.bodyH, 1]}>
          <spriteMaterial map={mancubusTexture} transparent alphaTest={0.01} />
        </sprite>
      </group>
    );
  }

  if (enemy.type === "ratman") {
    return (
      <group position={[position[0], 0, position[2]]}>
        <sprite ref={spriteRef} scale={[config.bodyW * 2.2, config.bodyH, 1]}>
          <spriteMaterial map={ratmanTexture} transparent alphaTest={0.01} />
        </sprite>
      </group>
    );
  }

  if (enemy.type === "cacodemon") {
    return (
      <group position={[position[0], 0, position[2]]}>
        <sprite ref={spriteRef} scale={[config.bodyW * 2.2, config.bodyH, 1]}>
          <spriteMaterial map={cacodemonTexture} transparent alphaTest={0.01} />
        </sprite>
      </group>
    );
  }

  return (
    <group position={[position[0], 0.15, position[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, enemy.id * 1.3]}>
        <boxGeometry args={[config.bodyW, config.bodyH * 0.15, config.bodyD]} />
        <meshLambertMaterial color={0x332211} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[1, 8]} />
        <meshLambertMaterial color={0x660000} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

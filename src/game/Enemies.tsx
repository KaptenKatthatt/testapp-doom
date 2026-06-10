import { useRef, useMemo, useState, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Mesh, Group } from "three";
import type { EnemyData, EnemyType } from "./types";
import QuaterniusDemonModel from "./QuaterniusDemonModel";

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
  bloodimp: {
    bodyW: 1.0, bodyH: 2.1, bodyD: 0.8,
    headSize: 0.65, color: 0xb00018, speed: 3.2,
    attackRange: 24, attackCooldown: 1.8, attackDamage: 4,
  },
  horneddemon: {
    bodyW: 1.25, bodyH: 2.25, bodyD: 0.9,
    headSize: 0.7, color: 0xc05235, speed: 2.8,
    attackRange: 18, attackCooldown: 2.2, attackDamage: 6,
  },
  quaterniusdemon: {
    bodyW: 1.4, bodyH: 2.6, bodyD: 1.0,
    headSize: 0.8, color: 0xa1003c, speed: 2.6,
    attackRange: 22, attackCooldown: 2.0, attackDamage: 8,
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

interface SpriteFrame {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
}

const bodyTextureCache = new Map<EnemyType, THREE.Texture>();

type SpriteTextureProcessor = (data: Uint8ClampedArray, width: number, height: number) => void;

interface SpriteTextureState {
  canvas?: HTMLCanvasElement;
  loading: boolean;
  textures: Set<THREE.Texture>;
}

const spriteTextureCache = new Map<string, SpriteTextureState>();

function setTextureImage(texture: THREE.Texture, image: HTMLCanvasElement | HTMLImageElement): void {
  (texture as unknown as { image: HTMLCanvasElement | HTMLImageElement }).image = image;
}

function isCyanKey(r: number, g: number, b: number): boolean {
  return (r < 120 && g > 150 && b > 150) || (g > r + 15 && b > r + 15);
}

function isNeutralGrayKey(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max < 115 && max - min < 12;
}

function createProcessedSpriteTexture(src: string, processPixels: SpriteTextureProcessor): THREE.Texture {
  const texture = new THREE.Texture();
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;

  const cached = spriteTextureCache.get(src);
  if (cached?.canvas) {
    setTextureImage(texture, cached.canvas);
    texture.needsUpdate = true;
    return texture;
  }

  const state = cached ?? { loading: false, textures: new Set<THREE.Texture>() };
  state.textures.add(texture);
  spriteTextureCache.set(src, state);

  if (state.loading) return texture;

  state.loading = true;
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    processPixels(imgData.data, canvas.width, canvas.height);
    ctx.putImageData(imgData, 0, 0);

    state.canvas = canvas;
    state.loading = false;
    state.textures.forEach((waitingTexture) => {
      setTextureImage(waitingTexture, canvas);
      waitingTexture.needsUpdate = true;
    });
    state.textures.clear();
  };
  img.onerror = () => {
    state.loading = false;
    state.textures.delete(texture);
  };
  img.src = src;

  return texture;
}

function createChromaKeyTexture(src: string): THREE.Texture {
  return createProcessedSpriteTexture(src, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      if (isCyanKey(r, g, b)) {
        data[i + 3] = 0;
      }
    }
  });
}

function createBlackKeyTexture(src: string): THREE.Texture {
  const texture = new THREE.Texture();
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;

  const img = new Image();
  setTextureImage(texture, img);
  img.onload = () => {
    texture.needsUpdate = true;
  };
  img.src = src;

  return texture;
}

function createCacodemonTexture(): THREE.Texture {
  const src = "/cacodemon.png";
  return createProcessedSpriteTexture(src, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      if (isCyanKey(r, g, b) || isNeutralGrayKey(r, g, b)) {
        data[i + 3] = 0;
      }
    }
  });
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

function getBloodImpBaseTexture(): THREE.Texture {
  return createBlackKeyTexture("/bloodimp.png?v=2");
}

function getHornedDemonBaseTexture(): THREE.Texture {
  return createBlackKeyTexture("/horneddemon.png?v=2");
}

function getBodyTexture(type: EnemyType): THREE.Texture {
  const cached = bodyTextureCache.get(type);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const texture = new THREE.CanvasTexture(canvas);
    bodyTextureCache.set(type, texture);
    return texture;
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
  bodyTextureCache.set(type, texture);
  return texture;
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

function applySpriteFrameUV(
  texture: THREE.Texture,
  sheetW: number,
  sheetH: number,
  frame: SpriteFrame,
  mirrored: boolean,
): void {
  const repeatX = frame.w / sheetW;
  const repeatY = frame.h / sheetH;
  texture.repeat.set(mirrored ? -repeatX : repeatX, repeatY);
  texture.offset.set(
    mirrored ? (frame.maxX + 1) / sheetW : frame.minX / sheetW,
    (sheetH - frame.maxY - 1) / sheetH,
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

const BLOODIMP_SHEET_W = 840;
const BLOODIMP_SHEET_H = 859;

const BLOODIMP_IDLE_FRAMES: SpriteFrame[] = [
  { minX: 10, minY: 9, maxX: 83, maxY: 111, w: 74, h: 103 },
  { minX: 89, minY: 11, maxX: 158, maxY: 111, w: 70, h: 101 },
  { minX: 164, minY: 3, maxX: 234, maxY: 111, w: 71, h: 109 },
  { minX: 240, minY: 9, maxX: 306, maxY: 111, w: 67, h: 103 },
  { minX: 312, minY: 3, maxX: 400, maxY: 111, w: 89, h: 109 },
  { minX: 406, minY: 12, maxX: 485, maxY: 111, w: 80, h: 100 },
  { minX: 490, minY: 12, maxX: 548, maxY: 111, w: 59, h: 100 },
];

const BLOODIMP_ATTACK_FRAMES: SpriteFrame[] = [
  { minX: 11, minY: 524, maxX: 85, maxY: 623, w: 75, h: 100 },
  { minX: 90, minY: 522, maxX: 146, maxY: 623, w: 57, h: 102 },
  { minX: 152, minY: 520, maxX: 213, maxY: 623, w: 62, h: 104 },
  { minX: 218, minY: 522, maxX: 279, maxY: 623, w: 62, h: 102 },
  { minX: 285, minY: 520, maxX: 355, maxY: 623, w: 71, h: 104 },
];

const BLOODIMP_DEATH_FRAMES: SpriteFrame[] = [
  { minX: 9, minY: 632, maxX: 85, maxY: 740, w: 77, h: 109 },
  { minX: 91, minY: 636, maxX: 164, maxY: 740, w: 74, h: 105 },
  { minX: 171, minY: 654, maxX: 243, maxY: 740, w: 73, h: 87 },
  { minX: 249, minY: 672, maxX: 335, maxY: 740, w: 87, h: 69 },
  { minX: 341, minY: 695, maxX: 445, maxY: 735, w: 105, h: 41 },
  { minX: 759, minY: 708, maxX: 832, maxY: 740, w: 74, h: 33 },
];

const HORNEDDEMON_SHEET_W = 1024;
const HORNEDDEMON_SHEET_H = 1024;

const HORNEDDEMON_IDLE_FRAMES: SpriteFrame[] = [
  { minX: 0, minY: 0, maxX: 81, maxY: 145, w: 82, h: 146 },
  { minX: 95, minY: 0, maxX: 179, maxY: 141, w: 85, h: 142 },
  { minX: 183, minY: 0, maxX: 287, maxY: 137, w: 105, h: 138 },
  { minX: 305, minY: 0, maxX: 395, maxY: 133, w: 91, h: 134 },
  { minX: 405, minY: 0, maxX: 487, maxY: 133, w: 83, h: 134 },
  { minX: 503, minY: 0, maxX: 601, maxY: 147, w: 99, h: 148 },
  { minX: 611, minY: 0, maxX: 693, maxY: 143, w: 83, h: 144 },
  { minX: 703, minY: 0, maxX: 791, maxY: 139, w: 89, h: 140 },
  { minX: 811, minY: 0, maxX: 899, maxY: 135, w: 89, h: 136 },
  { minX: 905, minY: 0, maxX: 999, maxY: 133, w: 95, h: 134 },
];

const HORNEDDEMON_ATTACK_FRAMES: SpriteFrame[] = [
  { minX: 0, minY: 323, maxX: 129, maxY: 463, w: 130, h: 141 },
  { minX: 147, minY: 323, maxX: 215, maxY: 467, w: 69, h: 145 },
  { minX: 231, minY: 329, maxX: 343, maxY: 461, w: 113, h: 133 },
  { minX: 359, minY: 323, maxX: 475, maxY: 455, w: 117, h: 133 },
  { minX: 483, minY: 325, maxX: 611, maxY: 467, w: 129, h: 143 },
  { minX: 621, minY: 323, maxX: 719, maxY: 475, w: 99, h: 153 },
  { minX: 741, minY: 323, maxX: 825, maxY: 477, w: 85, h: 155 },
  { minX: 837, minY: 323, maxX: 961, maxY: 481, w: 125, h: 159 },
];

const HORNEDDEMON_DEATH_FRAMES: SpriteFrame[] = [
  { minX: 0, minY: 655, maxX: 105, maxY: 783, w: 106, h: 129 },
  { minX: 113, minY: 655, maxX: 229, maxY: 783, w: 117, h: 129 },
  { minX: 237, minY: 667, maxX: 335, maxY: 791, w: 99, h: 125 },
  { minX: 345, minY: 673, maxX: 443, maxY: 791, w: 99, h: 119 },
  { minX: 453, minY: 677, maxX: 575, maxY: 791, w: 123, h: 115 },
  { minX: 579, minY: 675, maxX: 683, maxY: 791, w: 105, h: 117 },
  { minX: 699, minY: 669, maxX: 791, maxY: 791, w: 93, h: 123 },
  { minX: 807, minY: 671, maxX: 919, maxY: 791, w: 113, h: 121 },
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
  bodyH,
  color,
}: {
  readonly lightRef: React.RefObject<THREE.PointLight | null>;
  readonly bodyH: number;
  readonly color: string;
}): React.JSX.Element {
  return (
    <pointLight
      ref={lightRef}
      position={[0, bodyH + 0.5, 0]}
      color={color}
      intensity={2.0}
      distance={8}
    />
  );
}

function EnemyEntry({ enemy }: { readonly enemy: EnemyData }): React.JSX.Element {
  return enemy.alive ? <Enemy enemy={enemy} /> : <Corpse enemy={enemy} />;
}

export default function Enemies({ enemies }: { readonly enemies: EnemyData[] }): React.JSX.Element {
  return (
    <group>
      {enemies.map((e) => (
        <EnemyEntry key={e.id} enemy={e} />
      ))}
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
  const isSpriteEnemy = type === "mancubus" || type === "ratman" || type === "cacodemon" || type === "bloodimp" || type === "horneddemon";

  const mancubusTexture = useMemo(() => (type === "mancubus" ? getMancubusBaseTexture() : null), [type]);
  const ratmanTexture = useMemo(() => (type === "ratman" ? getRatmanBaseTexture() : null), [type]);
  const cacodemonTexture = useMemo(() => (type === "cacodemon" ? getCacodemonBaseTexture() : null), [type]);
  const bloodImpTexture = useMemo(() => (type === "bloodimp" ? getBloodImpBaseTexture() : null), [type]);
  const hornedDemonTexture = useMemo(() => (type === "horneddemon" ? getHornedDemonBaseTexture() : null), [type]);
  const bodyTexture = useMemo(() => getBodyTexture(type), [type]);

  useFrame((state) => {
    if (type === "mancubus" && mancubusTexture) {
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

    if (type === "ratman" && ratmanTexture) {
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

    if (type === "cacodemon" && cacodemonTexture) {
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

    if (type === "bloodimp" && bloodImpTexture) {
      let frame = BLOODIMP_IDLE_FRAMES[Math.floor(state.clock.getElapsedTime() * 7) % BLOODIMP_IDLE_FRAMES.length];
      if (hitFlash > 0.1) {
        frame = BLOODIMP_IDLE_FRAMES[5] ?? frame;
      } else if (state.clock.getElapsedTime() - enemy.lastAttack < 0.55) {
        const fireFrame = Math.floor((state.clock.getElapsedTime() - enemy.lastAttack) / 0.11) % BLOODIMP_ATTACK_FRAMES.length;
        frame = BLOODIMP_ATTACK_FRAMES[fireFrame] ?? frame;
      }

      if (!frame) return;
      applySpriteFrameUV(bloodImpTexture, BLOODIMP_SHEET_W, BLOODIMP_SHEET_H, frame, false);

      if (spriteRef.current) {
        updateSpriteScale(spriteRef.current, config.bodyW, config.bodyH, frame.h, 104, 0);
      }
    }

    if (type === "horneddemon" && hornedDemonTexture) {
      let frame = HORNEDDEMON_IDLE_FRAMES[Math.floor(state.clock.getElapsedTime() * 6) % HORNEDDEMON_IDLE_FRAMES.length];
      if (hitFlash > 0.1) {
        frame = HORNEDDEMON_IDLE_FRAMES[5] ?? frame;
      } else if (state.clock.getElapsedTime() - enemy.lastAttack < 0.7) {
        const fireFrame = Math.floor((state.clock.getElapsedTime() - enemy.lastAttack) / 0.1) % HORNEDDEMON_ATTACK_FRAMES.length;
        frame = HORNEDDEMON_ATTACK_FRAMES[fireFrame] ?? frame;
      }

      if (!frame) return;
      applySpriteFrameUV(hornedDemonTexture, HORNEDDEMON_SHEET_W, HORNEDDEMON_SHEET_H, frame, false);

      if (spriteRef.current) {
        updateSpriteScale(spriteRef.current, config.bodyW, config.bodyH, frame.h, 145, 0);
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
        <EnemyLight lightRef={lightRef} bodyH={config.bodyH} color="#ffaa00" />
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
        <EnemyLight lightRef={lightRef} bodyH={config.bodyH} color="#ccaa44" />
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
        <EnemyLight lightRef={lightRef} bodyH={config.bodyH + CACODEMON_FLOAT_HEIGHT} color="#cc44ff" />
      </group>
    );
  }

  if (type === "bloodimp") {
    return (
      <group position={[position[0], 0, position[2]]}>
        <sprite ref={spriteRef} scale={[config.bodyW * 2.2, config.bodyH, 1]}>
          <spriteMaterial
            map={bloodImpTexture}
            transparent
            alphaTest={0.01}
            color={hitFlash > 0.05 ? "#ff5555" : "#ffffff"}
          />
        </sprite>
        <HealthBar healthPct={healthPct} y={config.bodyH + 0.3} width={1.2} />
        <EnemyLight lightRef={lightRef} bodyH={config.bodyH} color="#ff2222" />
      </group>
    );
  }

  if (type === "horneddemon") {
    return (
      <group position={[position[0], 0, position[2]]}>
        <sprite ref={spriteRef} scale={[config.bodyW * 2.2, config.bodyH, 1]}>
          <spriteMaterial
            map={hornedDemonTexture}
            transparent
            alphaTest={0.01}
            color={hitFlash > 0.05 ? "#ff5555" : "#ffffff"}
          />
        </sprite>
        <HealthBar healthPct={healthPct} y={config.bodyH + 0.3} width={1.3} />
        <EnemyLight lightRef={lightRef} bodyH={config.bodyH} color="#44ff55" />
      </group>
    );
  }

  if (type === "quaterniusdemon") {
    return (
      <group position={[position[0], 0, position[2]]}>
        <Suspense fallback={null}>
          <QuaterniusDemonModel
            rotation={rotation}
            hitFlash={hitFlash}
            lastAttack={enemy.lastAttack}
            alerted={enemy.hasAlerted}
            dead={false}
          />
        </Suspense>
        <HealthBar healthPct={healthPct} y={config.bodyH + 0.4} width={1.5} />
        <EnemyLight lightRef={lightRef} bodyH={config.bodyH} color="#ff3366" />
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
      <EnemyLight lightRef={lightRef} bodyH={config.bodyH} color={type === "demon" ? "#ff0044" : type === "zombieman" ? "#88ff88" : "#ff6600"} />
    </group>
  );
}

function Corpse({ enemy }: { readonly enemy: EnemyData }): React.JSX.Element {
  const { position } = enemy;
  const config = ENEMY_CONFIG[enemy.type];
  const [deathTime] = useState(() => performance.now() / 1000);
  const mancubusTexture = useMemo(() => (enemy.type === "mancubus" ? getMancubusBaseTexture() : null), [enemy.type]);
  const ratmanTexture = useMemo(() => (enemy.type === "ratman" ? getRatmanBaseTexture() : null), [enemy.type]);
  const cacodemonTexture = useMemo(() => (enemy.type === "cacodemon" ? getCacodemonBaseTexture() : null), [enemy.type]);
  const bloodImpTexture = useMemo(() => (enemy.type === "bloodimp" ? getBloodImpBaseTexture() : null), [enemy.type]);
  const hornedDemonTexture = useMemo(() => (enemy.type === "horneddemon" ? getHornedDemonBaseTexture() : null), [enemy.type]);
  const spriteRef = useRef<THREE.Sprite>(null);

  useFrame(() => {
    const elapsed = (performance.now() / 1000) - deathTime;

    if (enemy.type === "mancubus" && mancubusTexture) {
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

    if (enemy.type === "ratman" && ratmanTexture) {
      const rowData = RATMAN_ROWS[7] ?? RATMAN_ROWS[0];
      if (!rowData) return;
      const deathFrame = Math.min(5, Math.floor(elapsed / 0.12));
      applyVariableColUV(ratmanTexture, 592, 658, rowData, deathFrame, false);

      if (spriteRef.current) {
        updateSpriteScale(spriteRef.current, config.bodyW, config.bodyH, rowData.height, 63, 0);
      }
    }

    if (enemy.type === "cacodemon" && cacodemonTexture) {
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

    if (enemy.type === "bloodimp" && bloodImpTexture) {
      const deathFrame = Math.min(BLOODIMP_DEATH_FRAMES.length - 1, Math.floor(elapsed / 0.12));
      const frame = BLOODIMP_DEATH_FRAMES[deathFrame] ?? BLOODIMP_DEATH_FRAMES[BLOODIMP_DEATH_FRAMES.length - 1];
      if (!frame) return;
      applySpriteFrameUV(bloodImpTexture, BLOODIMP_SHEET_W, BLOODIMP_SHEET_H, frame, false);

      if (spriteRef.current) {
        updateSpriteScale(spriteRef.current, config.bodyW, config.bodyH, frame.h, 104, 0);
      }
    }

    if (enemy.type === "horneddemon" && hornedDemonTexture) {
      const deathFrame = Math.min(HORNEDDEMON_DEATH_FRAMES.length - 1, Math.floor(elapsed / 0.12));
      const frame = HORNEDDEMON_DEATH_FRAMES[deathFrame] ?? HORNEDDEMON_DEATH_FRAMES[HORNEDDEMON_DEATH_FRAMES.length - 1];
      if (!frame) return;
      applySpriteFrameUV(hornedDemonTexture, HORNEDDEMON_SHEET_W, HORNEDDEMON_SHEET_H, frame, false);

      if (spriteRef.current) {
        updateSpriteScale(spriteRef.current, config.bodyW, config.bodyH, frame.h, 145, 0);
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

  if (enemy.type === "bloodimp") {
    return (
      <group position={[position[0], 0, position[2]]}>
        <sprite ref={spriteRef} scale={[config.bodyW * 2.2, config.bodyH, 1]}>
          <spriteMaterial map={bloodImpTexture} transparent alphaTest={0.01} />
        </sprite>
      </group>
    );
  }

  if (enemy.type === "horneddemon") {
    return (
      <group position={[position[0], 0, position[2]]}>
        <sprite ref={spriteRef} scale={[config.bodyW * 2.2, config.bodyH, 1]}>
          <spriteMaterial map={hornedDemonTexture} transparent alphaTest={0.01} />
        </sprite>
      </group>
    );
  }

  if (enemy.type === "quaterniusdemon") {
    return (
      <group position={[position[0], 0, position[2]]}>
        <Suspense fallback={null}>
          <QuaterniusDemonModel
            rotation={enemy.rotation}
            hitFlash={0}
            lastAttack={0}
            alerted={false}
            dead
          />
        </Suspense>
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

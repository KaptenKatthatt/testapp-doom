import * as THREE from "three";

function getCtx(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2d context");
  return ctx;
}

/** Create a procedural wall texture - brownish brick/stone pattern */
export function createWallTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = getCtx(canvas);

  // Base color - lighter for visibility
  ctx.fillStyle = "#887766";
  ctx.fillRect(0, 0, 128, 128);

  // Brick pattern
  const brickH = 16;
  const brickW = 32;
  for (let row = 0; row < 128 / brickH; row++) {
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let col = -1; col < 128 / brickW + 1; col++) {
      const x = col * brickW + offset;
      const y = row * brickH;
      // Brighter brick colors for visibility
      const r = 140 + Math.random() * 40;
      const g = 110 + Math.random() * 35;
      const b = 80 + Math.random() * 30;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + 1, y + 1, brickW - 2, brickH - 2);
    }
    // Mortar lines - lighter
    ctx.fillStyle = "#665544";
    ctx.fillRect(0, row * brickH, 128, 1);
  }
  // Vertical mortar - lighter
  for (let col = 0; col < 128 / brickW + 1; col++) {
    ctx.fillStyle = "#665544";
    for (let row = 0; row < 128 / brickH; row++) {
      const offset = row % 2 === 0 ? 0 : brickW / 2;
      ctx.fillRect(col * brickW + offset, row * brickH, 1, brickH);
    }
  }

  // Noise/grain
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const a = Math.random() * 0.15;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

/** Create a procedural floor texture - dark stone tiles */
export function createFloorTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = getCtx(canvas);

  // Base dark stone - lighter for visibility
  ctx.fillStyle = "#776655";
  ctx.fillRect(0, 0, 128, 128);

  // Tile grid
  const tileSize = 32;
  for (let row = 0; row < 128 / tileSize; row++) {
    for (let col = 0; col < 128 / tileSize; col++) {
      const r = 110 + Math.random() * 30;
      const g = 90 + Math.random() * 25;
      const b = 70 + Math.random() * 20;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(col * tileSize + 1, row * tileSize + 1, tileSize - 2, tileSize - 2);

      // Crack/detail in some tiles
      if (Math.random() > 0.6) {
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(col * tileSize + 8 + Math.random() * 16, row * tileSize + 8);
        ctx.lineTo(col * tileSize + 8 + Math.random() * 16, row * tileSize + 24);
        ctx.stroke();
      }
    }
  }

  // Grout lines
  ctx.fillStyle = "#554433";
  for (let i = 0; i <= 128; i += tileSize) {
    ctx.fillRect(i, 0, 1, 128);
    ctx.fillRect(0, i, 128, 1);
  }

  // Noise
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const a = Math.random() * 0.1;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  return texture;
}

/** Create a procedural ceiling texture - dark gray concrete */
export function createCeilingTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = getCtx(canvas);

  // Base - lighter
  ctx.fillStyle = "#666655";
  ctx.fillRect(0, 0, 128, 128);

  // Panel lines
  const panelSize = 64;
  ctx.fillStyle = "#555544";
  for (let i = 0; i <= 128; i += panelSize) {
    ctx.fillRect(i, 0, 2, 128);
    ctx.fillRect(0, i, 128, 2);
  }

  // Stains/shadows
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const r = 8 + Math.random() * 20;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(0,0,0,0.15)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Noise
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const a = Math.random() * 0.08;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

/** Create a door texture - reddish-brown with a panel */
export function createDoorTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = getCtx(canvas);

  // Base door color
  ctx.fillStyle = "#885522";
  ctx.fillRect(0, 0, 64, 128);

  // Panel border
  ctx.fillStyle = "#663311";
  ctx.fillRect(0, 0, 64, 4);
  ctx.fillRect(0, 124, 64, 4);
  ctx.fillRect(0, 0, 4, 128);
  ctx.fillRect(60, 0, 4, 128);

  // Inner panel
  ctx.fillStyle = "#774411";
  ctx.fillRect(8, 20, 48, 50);
  ctx.fillRect(8, 80, 48, 40);

  // Panel borders
  ctx.strokeStyle = "#553300";
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 20, 48, 50);
  ctx.strokeRect(8, 80, 48, 40);

  // Door handle
  ctx.fillStyle = "#ccaa66";
  ctx.fillRect(48, 95, 6, 4);

  // Keyhole
  ctx.fillStyle = "#111";
  ctx.fillRect(50, 88, 3, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Create a metal texture - for pillars and steps */
export function createMetalTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = getCtx(canvas);

  // Base metal
  ctx.fillStyle = "#556666";
  ctx.fillRect(0, 0, 64, 64);

  // Brushed metal lines
  for (let y = 0; y < 64; y += 2) {
    const b = 80 + Math.random() * 20;
    ctx.fillStyle = `rgb(${b},${b + 10},${b + 10})`;
    ctx.fillRect(0, y, 64, 1);
  }

  // Rivets
  for (let x = 8; x < 64; x += 24) {
    for (let y = 8; y < 64; y += 24) {
      ctx.fillStyle = "#778888";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#445555";
      ctx.beginPath();
      ctx.arc(x + 1, y + 1, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Create a slime texture - for pools and green walls */
export function createSlimeTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = getCtx(canvas);

  // Base green
  ctx.fillStyle = "#225522";
  ctx.fillRect(0, 0, 64, 64);

  // Bubbles
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * 64;
    const y = Math.random() * 64;
    const r = 2 + Math.random() * 4;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(100,255,100,0.4)");
    grad.addColorStop(1, "rgba(30,80,30,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Create a barrel/crate texture */
export function createBarrelTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 64;
  const ctx = getCtx(canvas);

  // Base wood
  ctx.fillStyle = "#556644";
  ctx.fillRect(0, 0, 32, 64);

  // Metal bands
  ctx.fillStyle = "#445566";
  ctx.fillRect(0, 4, 32, 4);
  ctx.fillRect(0, 30, 32, 4);
  ctx.fillRect(0, 56, 32, 4);

  // Wood grain
  for (let y = 0; y < 64; y += 3) {
    const b = 70 + Math.random() * 15;
    ctx.fillStyle = `rgb(${b},${b + 10},${b - 5})`;
    ctx.fillRect(0, y, 32, 2);
  }

  // Hazard stripe
  ctx.fillStyle = "#cc8800";
  ctx.fillRect(8, 14, 16, 14);
  ctx.fillStyle = "#111";
  for (let i = 0; i < 16; i += 4) {
    ctx.fillRect(8 + i, 14, 2, 14);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Create blood pool texture */
export function createBloodTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = getCtx(canvas);

  // Base
  ctx.fillStyle = "#880000";
  ctx.fillRect(0, 0, 64, 64);

  // Blood swirls
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * 64;
    const y = Math.random() * 64;
    const r = 5 + Math.random() * 15;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(180,0,0,0.5)");
    grad.addColorStop(1, "rgba(100,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
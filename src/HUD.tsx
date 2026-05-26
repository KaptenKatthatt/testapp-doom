import { useEffect, useRef } from "react";

interface HUDProps {
  readonly health: number;
  readonly ammo: number;
  readonly kills: number;
}

export default function HUD({ health, ammo, kills }: HUDProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceImgRef = useRef<HTMLImageElement | null>(null);

  // Load Doom face image once
  useEffect(() => {
    const img = new Image();
    img.src = "/doom-face.jpg";
    img.onload = () => {
      faceImgRef.current = img;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const displayW = Math.round(rect.width * dpr);
    const displayH = Math.round(rect.height * dpr);

    if (canvas.width !== displayW || canvas.height !== displayH) {
      canvas.width = displayW;
      canvas.height = displayH;
    }

    const w = canvas.width;
    const h = canvas.height;
    const s = h / 100; // Scale factor (base 100px height)

    ctx.clearRect(0, 0, w, h);

    // === Bottom HUD bar (Doom style) ===
    ctx.fillStyle = "#444444";
    ctx.fillRect(0, 0, w, h);

    // Top border (bright edge)
    ctx.fillStyle = "#777777";
    ctx.fillRect(0, 0, w, 2 * s);
    // Bottom border (dark edge)
    ctx.fillStyle = "#222222";
    ctx.fillRect(0, h - 2 * s, w, 2 * s);

    // Section dividers
    const sectionW = w / 4;
    ctx.fillStyle = "#333333";
    ctx.fillRect(sectionW, 4 * s, 2 * s, h - 8 * s);
    ctx.fillRect(sectionW * 2, 4 * s, 2 * s, h - 8 * s);
    ctx.fillRect(sectionW * 3, 4 * s, 2 * s, h - 8 * s);

    // === Font setup ===
    const doomFont = (size: number): string => `bold ${Math.round(size)}px "DooM", monospace`;
    const labelSize = Math.round(12 * s);
    const valueSize = Math.round(40 * s);

    // === AMMO section (left quarter) ===
    const ammoX = 16 * s;
    ctx.textAlign = "left";
    ctx.fillStyle = "#aaaaaa";
    ctx.font = doomFont(labelSize);
    ctx.fillText("AMMO", ammoX, 20 * s);
    ctx.fillStyle = ammo > 20 ? "#ffcc00" : "#ff3300";
    ctx.font = doomFont(valueSize);
    ctx.fillText(String(ammo).padStart(3, "0"), ammoX, 62 * s);

    // === HEALTH section (second quarter) ===
    const healthX = sectionW + 16 * s;
    ctx.fillStyle = "#aaaaaa";
    ctx.font = doomFont(labelSize);
    ctx.fillText("HEALTH", healthX, 20 * s);
    const healthColor = health > 50 ? "#00cc00" : health > 25 ? "#ccaa00" : "#cc0000";
    ctx.fillStyle = healthColor;
    ctx.font = doomFont(valueSize);
    ctx.fillText(String(health).padStart(3, "0"), healthX, 62 * s);

    // Health bar
    ctx.fillStyle = "#333333";
    ctx.fillRect(healthX, 70 * s, 100 * s, 6 * s);
    ctx.fillStyle = healthColor;
    ctx.fillRect(healthX, 70 * s, 100 * s * (health / 100), 6 * s);

    // === DOOM FACE (center section) ===
    const faceCenterX = sectionW * 2 + sectionW / 2;
    // Draw face background (dark border like in Doom)
    const faceSize = 70 * s; // Big! Like in Doom
    const faceX = faceCenterX - faceSize / 2;
    const faceY = (h - faceSize) / 2;

    // Dark background behind face
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(faceX - 4 * s, faceY - 4 * s, faceSize + 8 * s, faceSize + 8 * s);

    // Draw the actual Doom face image
    const faceImg = faceImgRef.current;
    if (faceImg) {
      ctx.drawImage(faceImg, faceX, faceY, faceSize, faceSize);
    } else {
      // Fallback: simple colored square while image loads
      ctx.fillStyle = "#cc9966";
      ctx.fillRect(faceX, faceY, faceSize, faceSize);
    }

    // === KILLS section (right quarter) ===
    const killsX = sectionW * 3 + 16 * s;
    ctx.textAlign = "left";
    ctx.fillStyle = "#aaaaaa";
    ctx.font = doomFont(labelSize);
    ctx.fillText("KILLS", killsX, 20 * s);
    ctx.fillStyle = "#dddddd";
    ctx.font = doomFont(valueSize);
    ctx.fillText(String(kills), killsX, 62 * s);

    // Weapon name
    ctx.fillStyle = "#666666";
    ctx.font = doomFont(Math.round(10 * s));
    ctx.fillText("SHOTGUN", ammoX, 80 * s);

    // Arms indicator (like Doom) - small
    ctx.fillStyle = "#888888";
    ctx.font = doomFont(Math.round(9 * s));
    ctx.fillText("ARMS", killsX, 80 * s);

  }, [health, ammo, kills]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={100}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        width: "100%",
        height: "80px",
        minHeight: "80px",
        imageRendering: "auto",
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  );
}
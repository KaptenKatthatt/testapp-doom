import { useEffect, useRef } from "react";

type FaceExpression = "normal" | "hurt" | "pain" | "critical";

interface HUDProps {
  readonly health: number;
  readonly ammo: number;
  readonly kills: number;
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pupilColor: string,
  eyeWidth: number,
  eyeHeight: number,
  pupilWidth: number,
  pupilHeight: number,
  pupilOffX: number,
  pupilOffY: number,
): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 5, y, eyeWidth, eyeHeight);
  ctx.fillRect(x + 2, y, eyeWidth, eyeHeight);
  ctx.fillStyle = pupilColor;
  ctx.fillRect(x - 4 + pupilOffX, y + 1 + pupilOffY, pupilWidth, pupilHeight);
  ctx.fillRect(x + 3 + pupilOffX, y + 1 + pupilOffY, pupilWidth, pupilHeight);
}

function drawDoomFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  expression: FaceExpression,
  scale: number,
): void {
  const size = 18 * scale;

  // Head
  ctx.fillStyle = "#cc9966";
  ctx.fillRect(x - size / 2, y, size, size);

  // Hair
  ctx.fillStyle = "#664433";
  ctx.fillRect(x - size / 2, y, size, 5 * scale);

  const es = scale; // eye scale
  switch (expression) {
    case "normal":
      drawEyes(ctx, x, y + 6 * scale, "#000000", 3 * es, 3 * es, 2 * es, 2 * es, 0, 0);
      ctx.fillStyle = "#993333";
      ctx.fillRect(x - 3 * scale, y + 13 * scale, 6 * scale, 2 * scale);
      break;
    case "hurt":
      drawEyes(ctx, x, y + 7 * scale, "#000000", 3 * es, 2 * es, 2 * es, 2 * es, 0, 0);
      ctx.fillStyle = "#993333";
      ctx.fillRect(x - 4 * scale, y + 13 * scale, 8 * scale, 2 * scale);
      break;
    case "pain":
      drawEyes(ctx, x, y + 5 * scale, "#000000", 4 * es, 4 * es, 2 * es, 2 * es, 0, 1 * scale);
      ctx.fillStyle = "#993333";
      ctx.fillRect(x - 3 * scale, y + 12 * scale, 6 * scale, 4 * scale);
      ctx.fillStyle = "#000000";
      ctx.fillRect(x - 2 * scale, y + 13 * scale, 4 * scale, 2 * scale);
      break;
    case "critical":
      drawEyes(ctx, x, y + 6 * scale, "#cc0000", 4 * es, 3 * es, 2 * es, 2 * es, 0, 1 * scale);
      ctx.fillStyle = "#664433";
      ctx.fillRect(x - 6 * scale, y + 5 * scale, 5 * scale, 2 * scale);
      ctx.fillRect(x + 2 * scale, y + 5 * scale, 5 * scale, 2 * scale);
      ctx.fillStyle = "#993333";
      ctx.fillRect(x - 4 * scale, y + 13 * scale, 8 * scale, 3 * scale);
      break;
  }
}

export default function HUD({ health, ammo, kills }: HUDProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const face: FaceExpression =
    health > 75 ? "normal" : health > 50 ? "hurt" : health > 25 ? "pain" : "critical";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Make canvas resolution match display size
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
    const s = h / 100; // Scale factor based on height (base = 100px)

    ctx.clearRect(0, 0, w, h);

    // Bottom HUD bar (Doom style) - full width
    ctx.fillStyle = "#555555";
    ctx.fillRect(0, 0, w, h);

    // Border lines
    ctx.fillStyle = "#888888";
    ctx.fillRect(0, 0, w, 2 * s);
    ctx.fillStyle = "#222222";
    ctx.fillRect(0, h - 2 * s, w, 2 * s);

    // Section widths proportional to canvas width
    const sectionW = w / 4;
    const padding = 20 * s;
    const labelFont = `bold ${Math.round(14 * s)}px monospace`;
    const valueFont = `bold ${Math.round(36 * s)}px monospace`;
    const smallFont = `${Math.round(11 * s)}px monospace`;

    // AMMO section (left quarter)
    const ammoX = padding;
    ctx.fillStyle = "#aaaaaa";
    ctx.font = labelFont;
    ctx.fillText("AMMO", ammoX, 22 * s);
    ctx.fillStyle = ammo > 20 ? "#ffcc00" : "#ff3300";
    ctx.font = valueFont;
    ctx.fillText(String(ammo).padStart(3, "0"), ammoX, 58 * s);

    // HEALTH section (second quarter)
    const healthX = sectionW + padding;
    ctx.fillStyle = "#aaaaaa";
    ctx.font = labelFont;
    ctx.fillText("HEALTH", healthX, 22 * s);
    const healthColor = health > 50 ? "#00cc00" : health > 25 ? "#ccaa00" : "#cc0000";
    ctx.fillStyle = healthColor;
    ctx.font = valueFont;
    ctx.fillText(String(health).padStart(3, "0"), healthX, 58 * s);

    // Health bar
    const barX = healthX;
    const barW = 100 * s;
    ctx.fillStyle = "#333333";
    ctx.fillRect(barX, 66 * s, barW, 6 * s);
    ctx.fillStyle = healthColor;
    ctx.fillRect(barX, 66 * s, barW * (health / 100), 6 * s);

    // Doom face (center)
    const faceX = sectionW * 2 + sectionW / 2;
    drawDoomFace(ctx, faceX, 16 * s, face, s);

    // KILLS section (right quarter)
    const killsX = sectionW * 3 + padding;
    ctx.fillStyle = "#aaaaaa";
    ctx.font = labelFont;
    ctx.fillText("KILLS", killsX, 22 * s);
    ctx.fillStyle = "#dddddd";
    ctx.font = valueFont;
    ctx.fillText(String(kills), killsX, 58 * s);

    // Weapon name
    ctx.fillStyle = "#888888";
    ctx.font = smallFont;
    ctx.fillText("PISTOL", ammoX, 76 * s);
  }, [health, ammo, kills, face]);

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
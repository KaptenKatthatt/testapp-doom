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
): void {
  const size = 18;

  // Head
  ctx.fillStyle = "#cc9966";
  ctx.fillRect(x - size / 2, y, size, size);

  // Hair
  ctx.fillStyle = "#664433";
  ctx.fillRect(x - size / 2, y, size, 5);

  switch (expression) {
    case "normal":
      drawEyes(ctx, x, y + 6, "#000000", 3, 3, 2, 2, 0, 0);
      ctx.fillStyle = "#993333";
      ctx.fillRect(x - 3, y + 13, 6, 2);
      break;
    case "hurt":
      drawEyes(ctx, x, y + 7, "#000000", 3, 2, 2, 2, 0, 0);
      ctx.fillStyle = "#993333";
      ctx.fillRect(x - 4, y + 13, 8, 2);
      break;
    case "pain":
      drawEyes(ctx, x, y + 5, "#000000", 4, 4, 2, 2, 0, 1);
      ctx.fillStyle = "#993333";
      ctx.fillRect(x - 3, y + 12, 6, 4);
      ctx.fillStyle = "#000000";
      ctx.fillRect(x - 2, y + 13, 4, 2);
      break;
    case "critical":
      drawEyes(ctx, x, y + 6, "#cc0000", 4, 3, 2, 2, 0, 1);
      ctx.fillStyle = "#664433";
      ctx.fillRect(x - 6, y + 5, 5, 2);
      ctx.fillRect(x + 2, y + 5, 5, 2);
      ctx.fillStyle = "#993333";
      ctx.fillRect(x - 4, y + 13, 8, 3);
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

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Bottom HUD bar (Doom style) - full width
    ctx.fillStyle = "#555555";
    ctx.fillRect(0, 0, w, h);

    // Border lines
    ctx.fillStyle = "#888888";
    ctx.fillRect(0, 0, w, 2);
    ctx.fillStyle = "#222222";
    ctx.fillRect(0, h - 2, w, 2);

    // AMMO section
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "bold 14px monospace";
    ctx.fillText("AMMO", 20, 22);
    ctx.fillStyle = ammo > 20 ? "#ffcc00" : "#ff3300";
    ctx.font = "bold 36px monospace";
    ctx.fillText(String(ammo).padStart(3, "0"), 20, 58);

    // HEALTH section
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "bold 14px monospace";
    ctx.fillText("HEALTH", 140, 22);
    const healthColor = health > 50 ? "#00cc00" : health > 25 ? "#ccaa00" : "#cc0000";
    ctx.fillStyle = healthColor;
    ctx.font = "bold 36px monospace";
    ctx.fillText(String(health).padStart(3, "0"), 140, 58);

    // Health bar
    ctx.fillStyle = "#333333";
    ctx.fillRect(140, 66, 100, 6);
    ctx.fillStyle = healthColor;
    ctx.fillRect(140, 66, 100 * (health / 100), 6);

    // Doom face
    drawDoomFace(ctx, 290, 16, face);

    // KILLS section
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "bold 14px monospace";
    ctx.fillText("KILLS", 340, 22);
    ctx.fillStyle = "#dddddd";
    ctx.font = "bold 36px monospace";
    ctx.fillText(String(kills), 340, 58);

    // Weapon name
    ctx.fillStyle = "#888888";
    ctx.font = "11px monospace";
    ctx.fillText("PISTOL", 20, 76);
  }, [health, ammo, kills, face]);

  return (
    <canvas
      ref={canvasRef}
      width={480}
      height={80}
      style={{
        position: "absolute",
        bottom: "env(safe-area-inset-bottom, 0px)",
        left: 0,
        width: "100%",
        height: "80px",
        imageRendering: "pixelated" as const,
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  );
}
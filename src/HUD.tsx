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

    // Bottom HUD bar
    ctx.fillStyle = "#444444";
    ctx.fillRect(0, h - 60, w, 60);

    // Border
    ctx.strokeStyle = "#666666";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, h - 60, w, 60);

    // AMMO section
    ctx.fillStyle = "#888888";
    ctx.font = "12px monospace";
    ctx.fillText("AMMO", 30, h - 40);
    ctx.fillStyle = ammo > 20 ? "#ffaa00" : "#ff3300";
    ctx.font = "bold 28px monospace";
    ctx.fillText(String(ammo).padStart(3, "0"), 20, h - 10);

    // HEALTH section
    ctx.fillStyle = "#888888";
    ctx.font = "12px monospace";
    ctx.fillText("HEALTH", 150, h - 40);
    const healthColor = health > 50 ? "#00cc00" : health > 25 ? "#ccaa00" : "#cc0000";
    ctx.fillStyle = healthColor;
    ctx.font = "bold 28px monospace";
    ctx.fillText(String(health).padStart(3, "0"), 140, h - 10);

    // Doom face
    drawDoomFace(ctx, 220, h - 45, face);

    // KILLS section
    ctx.fillStyle = "#888888";
    ctx.font = "12px monospace";
    ctx.fillText("KILLS", 290, h - 40);
    ctx.fillStyle = "#cccccc";
    ctx.font = "bold 28px monospace";
    ctx.fillText(String(kills), 290, h - 10);

    // Weapon name
    ctx.fillStyle = "#666666";
    ctx.font = "10px monospace";
    ctx.fillText("PISTOL", 30, h - 60 + 10);

    // Health bar visual
    const barWidth = 100;
    const barX = 140;
    const barY = h - 8;
    ctx.fillStyle = "#333333";
    ctx.fillRect(barX, barY, barWidth, 4);
    ctx.fillStyle = healthColor;
    ctx.fillRect(barX, barY, barWidth * (health / 100), 4);
  }, [health, ammo, kills, face]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={300}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        width: "100%",
        height: "auto",
        maxHeight: "120px",
        imageRendering: "pixelated" as const,
        pointerEvents: "none",
      }}
    />
  );
}
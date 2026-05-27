import { useEffect, useRef, useState } from "react";

interface HUDProps {
  readonly health: number;
  readonly ammo: number;
  readonly bullets?: number;
  readonly shells?: number;
  readonly currentWeapon?: "revolver" | "shotgun" | "machinegun";
  readonly revolverChamber?: number;
  readonly machinegunMag?: number;
  readonly revolverReloading?: boolean;
  readonly machinegunReloading?: boolean;
  readonly kills: number;
}

export default function HUD({
  health,
  ammo,
  bullets = 0,
  shells = 0,
  currentWeapon = "revolver",
  revolverChamber = 0,
  machinegunMag = 0,
  revolverReloading = false,
  machinegunReloading = false,
  kills,
}: HUDProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faceImg, setFaceImg] = useState<HTMLImageElement | null>(null);
  const [fontLoaded, setFontLoaded] = useState(false);

  // Load Doom face image once and listen to font loading
  useEffect(() => {
    const img = new Image();
    img.src = "/doom-face.png";
    img.onload = () => {
      setFaceImg(img);
    };

    document.fonts.ready.then(() => {
      setFontLoaded(true);
    });
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

    // Determine ammo digits and reloading/low states based on selected weapon
    let ammoText = "000";
    let isLow = false;
    let isReloading = false;
    let reserveText = "";

    const activeW = currentWeapon ?? "revolver";

    if (activeW === "shotgun") {
      ammoText = String(shells).padStart(3, "0");
      isLow = shells <= 2;
    } else if (activeW === "revolver") {
      isReloading = revolverReloading;
      if (isReloading) {
        ammoText = "RLD";
        isLow = true;
      } else {
        ammoText = String(revolverChamber).padStart(3, "0");
        isLow = revolverChamber <= 1;
      }
      reserveText = `RES:${String(bullets).padStart(3, "0")}`;
    } else if (activeW === "machinegun") {
      isReloading = machinegunReloading;
      if (isReloading) {
        ammoText = "RLD";
        isLow = true;
      } else {
        ammoText = String(machinegunMag).padStart(3, "0");
        isLow = machinegunMag <= 10;
      }
      reserveText = `RES:${String(bullets).padStart(3, "0")}`;
    }

    // === AMMO section (left quarter) ===
    const ammoX = 16 * s;
    ctx.textAlign = "left";
    ctx.fillStyle = "#aaaaaa";
    ctx.font = doomFont(labelSize);
    ctx.fillText("AMMO", ammoX, 20 * s);

    // Flash large reload text dynamically
    if (isReloading) {
      const flash = Math.floor(performance.now() / 150) % 2 === 0;
      ctx.fillStyle = flash ? "#ff3300" : "#771100";
    } else {
      ctx.fillStyle = isLow ? "#ff3300" : "#ffcc00";
    }

    ctx.font = doomFont(valueSize);
    ctx.fillText(ammoText, ammoX, 62 * s);

    // Draw small ammo reserve indicator (e.g. bullets reserve)
    if (reserveText) {
      ctx.fillStyle = "#888888";
      ctx.font = doomFont(Math.round(8.5 * s));
      ctx.fillText(reserveText, ammoX + 80 * s, 62 * s);
    }

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
    const faceSize = 70 * s; // Big! Like in Doom
    const faceX = faceCenterX - faceSize / 2;
    const faceY = (h - faceSize) / 2;

    // No background behind face (PNG has transparency)

    // Draw the actual Doom face image
    if (faceImg) {
      ctx.drawImage(faceImg, faceX, faceY, faceSize, faceSize);
    } else {
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

    // Weapon name display
    ctx.fillStyle = "#666666";
    ctx.font = doomFont(Math.round(10 * s));
    
    let weaponDisplayName = "REVOLVER";
    if (activeW === "shotgun") weaponDisplayName = "SHOTGUN";
    else if (activeW === "machinegun") weaponDisplayName = "DP-28 MACHINE GUN";

    ctx.fillText(weaponDisplayName, ammoX, 80 * s);

    // Arms indicator (like Doom) - small
    ctx.fillStyle = "#888888";
    ctx.font = doomFont(Math.round(9 * s));
    ctx.fillText("ARMS", killsX, 80 * s);

  }, [
    health,
    ammo,
    bullets,
    shells,
    currentWeapon,
    revolverChamber,
    machinegunMag,
    revolverReloading,
    machinegunReloading,
    faceImg,
    fontLoaded,
  ]);

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
import { useEffect } from "react";
import type { PlayerData } from "./Game";

export function useGameInputs(
  keysRef: React.MutableRefObject<Record<string, boolean>>,
  useActionRef: React.MutableRefObject<boolean>,
  gameActiveRef: React.MutableRefObject<boolean>,
  playerRef: React.MutableRefObject<PlayerData>
): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      keysRef.current[e.code] = true;
      const keyLower = e.key ? e.key.toLowerCase() : "";
      if (e.code === "KeyW" || keyLower === "w" || e.code === "ArrowUp") {
        keysRef.current["KeyW"] = true;
      }
      if (e.code === "KeyS" || keyLower === "s" || e.code === "ArrowDown") {
        keysRef.current["KeyS"] = true;
      }
      if (e.code === "KeyA" || keyLower === "a" || e.code === "ArrowLeft") {
        keysRef.current["KeyA"] = true;
      }
      if (e.code === "KeyD" || keyLower === "d" || e.code === "ArrowRight") {
        keysRef.current["KeyD"] = true;
      }
      if ((e.code === "KeyE" || keyLower === "e") && useActionRef) {
        useActionRef.current = true;
      }
      if (e.code === "Escape") {
        document.exitPointerLock?.();
      }
    };
    const handleKeyUp = (e: KeyboardEvent): void => {
      keysRef.current[e.code] = false;
      const keyLower = e.key ? e.key.toLowerCase() : "";
      if (e.code === "KeyW" || keyLower === "w" || e.code === "ArrowUp") {
        keysRef.current["KeyW"] = false;
      }
      if (e.code === "KeyS" || keyLower === "s" || e.code === "ArrowDown") {
        keysRef.current["KeyS"] = false;
      }
      if (e.code === "KeyA" || keyLower === "a" || e.code === "ArrowLeft") {
        keysRef.current["KeyA"] = false;
      }
      if (e.code === "KeyD" || keyLower === "d" || e.code === "ArrowRight") {
        keysRef.current["KeyD"] = false;
      }
    };
    const handleMouseDown = (e: MouseEvent): void => {
      if (e.button === 0) {
        if (!gameActiveRef.current) return;
        if (!document.pointerLockElement) {
          document.body.requestPointerLock?.();
        }
        playerRef.current.shooting = true;
      }
    };
    const handleMouseUp = (e: MouseEvent): void => {
      if (e.button === 0) {
        playerRef.current.shooting = false;
      }
    };
    const handleMouseMove = (e: MouseEvent): void => {
      if (document.pointerLockElement) {
        playerRef.current.rotation -= e.movementX * 0.002;
        playerRef.current.pitch -= e.movementY * 0.002;
        playerRef.current.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, playerRef.current.pitch));
      }
    };

    const handleGameShoot = ((e: Event): void => {
      const detail = (e as CustomEvent<{ shooting: boolean }>).detail;
      playerRef.current.shooting = detail.shooting;
    }) as EventListener;

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("game-shoot", handleGameShoot);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("game-shoot", handleGameShoot);
    };
  }, [keysRef, useActionRef, gameActiveRef, playerRef]);
}

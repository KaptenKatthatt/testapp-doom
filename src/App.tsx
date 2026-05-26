import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Game from "./Game";
import HUD from "./HUD";
import MobileControls from "./MobileControls";
import type { PlayerState } from "./types";

export default function App(): React.JSX.Element {
  const [started, setStarted] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState>({
    health: 100,
    ammo: 50,
    kills: 0,
  });
  const [gameOver, setGameOver] = useState(false);
  const [missionComplete, setMissionComplete] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const mobileMoveRef = useRef<[number, number]>([0, 0]);
  const mobileLookRef = useRef(0);

  const handleStart = useCallback((): void => {
    setStarted(true);
    setGameOver(false);
    setMissionComplete(false);
    setGameKey((k) => k + 1);
    setPlayerState({ health: 100, ammo: 50, kills: 0 });
    // Request pointer lock synchronously while still in user gesture context
    document.body.requestPointerLock();
  }, []);

  // Restart on click/Enter/Space when game over or mission complete
  useEffect(() => {
    const handleRestartKey = (e: KeyboardEvent): void => {
      if (!gameOver && !missionComplete) return;
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        document.exitPointerLock();
        handleStart();
      }
    };

    // Global mousedown: restart game from overlay click
    const handleMouseDown = (): void => {
      if (!gameOver && !missionComplete) return; // Skip if game is running
      document.exitPointerLock();
      handleStart(); // This requests pointer lock synchronously
    };

    // Also listen for pointerlockchange to force exit
    const handlePointerLockChange = (): void => {
      if ((gameOver || missionComplete) && document.pointerLockElement) {
        document.exitPointerLock();
      }
    };

    window.addEventListener("keydown", handleRestartKey);
    window.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    return () => {
      window.removeEventListener("keydown", handleRestartKey);
      window.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, [gameOver, missionComplete, handleStart]);

  const handleMobileMove = useCallback((dx: number, dy: number): void => {
    mobileMoveRef.current = [dx, dy];
  }, []);

  const handleMobileLook = useCallback((dx: number): void => {
    mobileLookRef.current += dx;
  }, []);

  const handleShootStart = useCallback((): void => {
    window.dispatchEvent(new CustomEvent("game-shoot", { detail: { shooting: true } }));
  }, []);

  const handleShootEnd = useCallback((): void => {
    window.dispatchEvent(new CustomEvent("game-shoot", { detail: { shooting: false } }));
  }, []);

  if (!started) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100dvh",
          background: "#000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          color: "#c00",
          cursor: "pointer",
          overflow: "hidden",
        }}
        onClick={handleStart}
      >
        <h1
          style={{
            fontSize: "64px",
            margin: 0,
            textShadow: "0 0 20px #f00",
          }}
        >
          DOOM
        </h1>
        <p style={{ fontSize: "18px", color: "#888", marginTop: "20px" }}>
          E1M1 - Entryway
        </p>
        <p
          style={{
            fontSize: "14px",
            color: "#666",
            marginTop: "40px",
            animation: "blink 1s infinite",
          }}
        >
          Tap to start
        </p>
        <p style={{ fontSize: "12px", color: "#444", marginTop: "10px" }}>
          WASD / Joystick · Mouse / Touch · Click to shoot
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100dvh", background: "#000", position: "relative", overflow: "hidden" }}>
      <Canvas camera={{ fov: 75, near: 0.1, far: 200 }} gl={{ alpha: false, antialias: true }}>
        <color attach="background" args={["#3d2e1e"]} />
        <fog attach="fog" args={["#3d2e1e", 20, 120]} />
        <Game
          key={gameKey}
          onPlayerState={setPlayerState}
          onGameOver={(): void => {
            setGameOver(true);
            document.exitPointerLock();
          }}
          onMissionComplete={(): void => {
            setMissionComplete(true);
            document.exitPointerLock();
          }}
          mobileMoveRef={mobileMoveRef}
          mobileLookRef={mobileLookRef}
        />
      </Canvas>
      <HUD
        health={playerState.health}
        ammo={playerState.ammo}
        kills={playerState.kills}
      />

      {/* Crosshair - CSS overlay, zero lag */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "4px",
        height: "4px",
        borderRadius: "50%",
        background: "rgba(255,255,255,0.7)",
        pointerEvents: "none",
        zIndex: 15,
      }} />

      <MobileControls
        onMove={handleMobileMove}
        onLook={handleMobileLook}
        onShootStart={handleShootStart}
        onShootEnd={handleShootEnd}
      />
      {gameOver && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(180,0,0,0.7)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "monospace",
            color: "#fff",
            zIndex: 100,
            cursor: "pointer",
          }}
          onClick={(): void => {
            document.exitPointerLock();
            handleStart();
          }}
          onMouseDown={(): void => {
            document.exitPointerLock();
          }}
        >
          <h1
            style={{
              fontSize: "72px",
              textShadow: "0 0 30px #f00",
            }}
          >
            YOU DIED
          </h1>
          <p
            style={{
              fontSize: "18px",
            }}
          >
            Click anywhere to restart
          </p>
        </div>
      )}
      {missionComplete && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,40,0,0.8)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "monospace",
            color: "#00ff00",
            zIndex: 100,
            cursor: "pointer",
          }}
          onClick={(): void => {
            document.exitPointerLock();
            handleStart();
          }}
          onMouseDown={(): void => {
            document.exitPointerLock();
          }}
        >
          <h1
            style={{
              fontSize: "56px",
              textShadow: "0 0 30px #0f0",
            }}
          >
            MISSION ACCOMPLISHED
          </h1>
          <p
            style={{
              fontSize: "20px",
              marginTop: "20px",
              color: "#88ff88",
            }}
          >
            Play again?
          </p>
        </div>
      )}
    </div>
  );
}
import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Game from "./Game";
import HUD from "./HUD";
import MobileControls from "./MobileControls";
import type { PlayerState } from "./types";

function formatTime(startTime: number, endTime: number): string {
  if (!startTime) return "0:00";
  const end = endTime || performance.now() / 1000;
  const elapsed = Math.round(end - startTime);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function calcScore(state: PlayerState): number {
  const end = state.endTime || performance.now() / 1000;
  const killPoints = state.kills * 100;
  const timeBonus = Math.max(0, 3000 - Math.round((end - state.startTime) * 10));
  const accuracyBonus = state.shotsFired > 0 ? Math.round((state.kills / state.shotsFired) * 500) : 0;
  const healthBonus = state.health * 5;
  const hitPenalty = state.timesHit * 50;
  return Math.max(0, killPoints + timeBonus + accuracyBonus + healthBonus - hitPenalty);
}

export default function App(): React.JSX.Element {
  const [started, setStarted] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState>({
    health: 100,
    ammo: 50,
    kills: 0,
    shotsFired: 0,
    timesHit: 0,
    startTime: 0,
    endTime: 0,
    damageFlash: 0,
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
    setPlayerState({ health: 100, ammo: 50, kills: 0, shotsFired: 0, timesHit: 0, startTime: performance.now() / 1000, endTime: 0, damageFlash: 0 });
    // Request pointer lock synchronously while still in user gesture context
    document.body.requestPointerLock();
  }, []);

  // Restart on keyboard/mouse when game over or mission complete
  useEffect(() => {
    const handleRestartKey = (e: KeyboardEvent): void => {
      if (!gameOver && !missionComplete) return;
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        document.exitPointerLock();
        handleStart();
      }
    };

    // Global mousedown for death screen only (click anywhere to restart)
    // Mission complete has a dedicated button
    const handleMouseDown = (): void => {
      if (!gameOver) return;
      document.exitPointerLock();
      handleStart();
    };

    // Force exit pointer lock if game is over
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

      {/* Damage flash - subtle red overlay */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "radial-gradient(ellipse at center, transparent 30%, rgba(200,0,0,0.35) 100%)",
        opacity: playerState.damageFlash,
        pointerEvents: "none",
        zIndex: 14,
        transition: "opacity 0.1s ease-out",
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
            background: "#1a0a00",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "monospace",
            color: "#cc8800",
            zIndex: 100,
            cursor: "crosshair",
            overflow: "hidden",
            padding: "20px",
            boxSizing: "border-box",
          }}
        >
          <h1 style={{
            fontSize: "clamp(28px, 5vw, 48px)",
            color: "#ff6600",
            textShadow: "0 0 20px #ff4400, 0 0 40px #aa2200",
            margin: "0 0 20px 0",
            letterSpacing: "4px",
          }}>
            LEVEL COMPLETE
          </h1>

          <div style={{
            border: "2px solid #663300",
            padding: "20px 40px",
            background: "rgba(40,20,0,0.9)",
            margin: "0 0 20px 0",
            minWidth: "280px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0", fontSize: "clamp(14px, 2.5vw, 18px)" }}>
              <span style={{ color: "#aa7744" }}>KILLS</span>
              <span style={{ color: "#ffcc00" }}>{playerState.kills}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0", fontSize: "clamp(14px, 2.5vw, 18px)" }}>
              <span style={{ color: "#aa7744" }}>ITEMS</span>
              <span style={{ color: "#ffcc00" }}>{playerState.kills * 100}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0", fontSize: "clamp(14px, 2.5vw, 18px)" }}>
              <span style={{ color: "#aa7744" }}>TIME</span>
              <span style={{ color: "#ffcc00" }}>{formatTime(playerState.startTime, playerState.endTime)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0", fontSize: "clamp(14px, 2.5vw, 18px)" }}>
              <span style={{ color: "#aa7744" }}>SHOTS FIRED</span>
              <span style={{ color: "#ffcc00" }}>{playerState.shotsFired}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0", fontSize: "clamp(14px, 2.5vw, 18px)" }}>
              <span style={{ color: "#aa7744" }}>TIMES HIT</span>
              <span style={{ color: "#ff4400" }}>{playerState.timesHit}</span>
            </div>
            <div style={{ borderTop: "1px solid #663300", marginTop: "12px", paddingTop: "12px", display: "flex", justifyContent: "space-between", fontSize: "clamp(16px, 3vw, 22px)" }}>
              <span style={{ color: "#ff6600" }}>TOTAL SCORE</span>
              <span style={{ color: "#ffee00", fontWeight: "bold" }}>{calcScore(playerState)}</span>
            </div>
          </div>

          <button
            onClick={(): void => {
              document.exitPointerLock();
              handleStart();
            }}
            style={{
              fontFamily: "monospace",
              fontSize: "clamp(14px, 2.5vw, 18px)",
              padding: "12px 32px",
              background: "#663300",
              color: "#ffcc00",
              border: "2px solid #aa5500",
              cursor: "crosshair",
              letterSpacing: "2px",
              marginTop: "8px",
            }}
          >
            RESTART GAME
          </button>
        </div>
      )}
    </div>
  );
}
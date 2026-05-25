import { useCallback, useRef, useState } from "react";
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
  const mobileMoveRef = useRef<[number, number]>([0, 0]);
  const mobileLookRef = useRef(0);

  const handleStart = useCallback((): void => {
    setStarted(true);
    setGameOver(false);
    setPlayerState({ health: 100, ammo: 50, kills: 0 });
  }, []);

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
          height: "100vh",
          background: "#000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          color: "#c00",
          cursor: "pointer",
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
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      <Canvas shadows camera={{ fov: 75, near: 0.1, far: 100 }}>
        <Game
          onPlayerState={setPlayerState}
          onGameOver={(): void => { setGameOver(true); }}
          mobileMoveRef={mobileMoveRef}
          mobileLookRef={mobileLookRef}
        />
      </Canvas>
      <HUD
        health={playerState.health}
        ammo={playerState.ammo}
        kills={playerState.kills}
      />
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
            zIndex: 20,
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
              cursor: "pointer",
            }}
            onClick={(): void => { window.location.reload(); }}
          >
            Tap to restart
          </p>
        </div>
      )}
    </div>
  );
}
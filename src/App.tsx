import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Game from "./Game";
import HUD from "./HUD";
import MobileControls from "./MobileControls";
import AudioMenu from "./AudioMenu";
import { audioManager } from "./Audio";
import type { PlayerState } from "./types";
import type { LevelData } from "./main";
import { gridToLevelData } from "./Editor";

type CellType = 'empty' | 'wall' | 'door' | 'player' | 'imp' | 'demon' | 'zombieman' | 'health' | 'ammo' | 'shotgun';

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

function listSavedMaps(): Array<{ name: string; timestamp: number }> {
  const maps: Array<{ name: string; timestamp: number }> = [];
  const prefix = 'doom-map-';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix) && !key.includes('__playing__') && !key.includes('__autosache__')) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const data = JSON.parse(raw);
          maps.push({ name: data.name, timestamp: data.timestamp });
        }
      } catch { /* skip */ }
    }
  }
  maps.sort((a, b) => b.timestamp - a.timestamp);
  return maps;
}

interface AppProps {
  levelData?: LevelData | null;
  onClearLevelData?: () => void;
}

export default function App({ levelData }: AppProps): React.JSX.Element {
  const [started, setStarted] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string>('__default__');

  // When levelData arrives from editor play, auto-select it
  useEffect(() => {
    if (levelData) setSelectedLevel('__custom__');
  }, [levelData]);
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
  const [savedMaps, setSavedMaps] = useState<Array<{ name: string; timestamp: number }>>([]);
  const [showMapModal, setShowMapModal] = useState(false);
  const mobileMoveRef = useRef<[number, number]>([0, 0]);
  const mobileLookRef = useRef(0);
  const mobilePitchRef = useRef(0);
  const useActionRef = useRef(false);
  const audioMenuOpenRef = useRef(false);

  // Load saved maps list on mount
  useEffect(() => {
    setSavedMaps(listSavedMaps());
  }, []);

  // If we have levelData from the editor, use it; otherwise load saved map
  const activeLevelData = useMemo(() => {
    if (selectedLevel === '__custom__' && levelData) return levelData;
    if (selectedLevel?.startsWith('saved:')) {
      const mapName = selectedLevel.slice(6);
      const raw = localStorage.getItem('doom-map-' + mapName);
      if (raw) {
        try {
          const data = JSON.parse(raw);
          const grid = data.grid.map((row: CellType[]) => row.map((t: CellType) => ({ type: t })));
          const playerPos: [number, number] = data.playerPos || [2, 2];
          return gridToLevelData(grid, playerPos);
        } catch { /* fall through */ }
      }
    }
    return null;
  }, [selectedLevel, levelData]);

  const handleStart = useCallback((): void => {
    setStarted(true);
    setGameOver(false);
    setMissionComplete(false);
    setGameKey((k) => k + 1);
    setPlayerState({ health: 100, ammo: 50, kills: 0, shotsFired: 0, timesHit: 0, startTime: performance.now() / 1000, endTime: 0, damageFlash: 0 });
    audioManager.init().then(() => {
      audioManager.resume();
      audioManager.playMusic();
    });
    document.body.requestPointerLock();
  }, []);

  useEffect(() => {
    const handleRestartKey = (e: KeyboardEvent): void => {
      if (!gameOver && !missionComplete) return;
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        document.exitPointerLock();
        handleStart();
      }
    };

    const handleMouseDown = (): void => {
      if (!gameOver) return;
      document.exitPointerLock();
      handleStart();
    };

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

  const handleMobileLook = useCallback((dx: number, dy: number): void => {
    mobileLookRef.current = dx;
    mobilePitchRef.current = dy;
  }, []);

  const handleShootStart = useCallback((): void => {
    if (audioMenuOpenRef.current) return;
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
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === 'A' || target.tagName === 'BUTTON' || target.tagName === 'SELECT' || target.tagName === 'OPTION') return;
          handleStart();
        }}
      >
        <h1 style={{ fontSize: "64px", margin: 0, textShadow: "0 0 20px #f00" }}>
          DOOM
        </h1>

        {/* Level selector */}
        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "14px", color: "#888" }}>Select Level:</label>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#222",
              color: "#fff",
              border: "1px solid #c00",
              padding: "8px 16px",
              fontSize: "16px",
              fontFamily: "monospace",
              cursor: "pointer",
            }}
          >
            <option value="__default__">E1M1 - Entryway (Default)</option>
            {levelData && <option value="__custom__">Custom Level (from Editor)</option>}
            {savedMaps.map(m => (
              <option key={m.name} value={`saved:${m.name}`}>{m.name}</option>
            ))}
          </select>
        </div>

        <p style={{ fontSize: "14px", color: selectedLevel === '__custom__' ? "#0f0" : "#888", marginTop: "8px" }}>
          {selectedLevel === '__custom__' ? '▶ Custom Level' : selectedLevel?.startsWith('saved:') ? `▶ ${selectedLevel.slice(6)}` : '▶ E1M1 - Entryway'}
        </p>

        {/* Custom Map button */}
        <button
          onClick={(e) => { e.stopPropagation(); setSavedMaps(listSavedMaps()); setShowMapModal(true); }}
          style={{
            marginTop: "16px", padding: "10px 24px", background: "#222", color: "#c00", border: "2px solid #c00",
            fontFamily: '"DooM", monospace', fontSize: "16px", cursor: "pointer", letterSpacing: "2px",
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#c00"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#222"; e.currentTarget.style.color = "#c00"; }}
        >
          🗺️ CUSTOM MAP
        </button>

        <p style={{ fontSize: "14px", color: "#666", marginTop: "20px", animation: "blink 1s infinite" }}>
          Tap to start
        </p>
        <a
          href="#editor"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: "12px", color: "#c00", marginTop: "12px", textDecoration: "none", opacity: 0.7 }}
        >
          📐 Level Editor
        </a>
        <p style={{ fontSize: "12px", color: "#444", marginTop: "10px" }}>
          WASD / Joystick · Mouse / Touch · Click to shoot
        </p>

        {/* Custom Map Modal */}
        {showMapModal && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
              background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 10000, fontFamily: '"DooM", monospace',
            }}
          >
            <div style={{
              background: "#1a0a00", border: "2px solid #c00", borderRadius: 6, padding: "20px 24px",
              minWidth: "320px", maxWidth: "90vw", maxHeight: "80vh", overflow: "auto",
            }}>
              <h2 style={{ color: "#c00", marginTop: 0, letterSpacing: "3px" }}>🗺️ CUSTOM MAPS</h2>

              {/* Default level option */}
              <div
                onClick={() => { setSelectedLevel('__default__'); setShowMapModal(false); }}
                style={{
                  padding: "10px 12px", margin: "4px 0", background: selectedLevel === '__default__' ? '#331100' : '#222',
                  border: selectedLevel === '__default__' ? '1px solid #c00' : '1px solid #444',
                  cursor: "pointer", color: "#ffcc00", fontSize: "14px",
                }}
              >
                🏚️ E1M1 - Entryway (Default)
              </div>

              {/* Editor level if available */}
              {levelData && (
                <div
                  onClick={() => { setSelectedLevel('__custom__'); setShowMapModal(false); }}
                  style={{
                    padding: "10px 12px", margin: "4px 0", background: selectedLevel === '__custom__' ? '#331100' : '#222',
                    border: selectedLevel === '__custom__' ? '1px solid #c00' : '1px solid #444',
                    cursor: "pointer", color: "#0f0", fontSize: "14px",
                  }}
                >
                  ✏️ Custom Level (from Editor)
                </div>
              )}

              {/* Saved maps */}
              {savedMaps.length === 0 && !levelData && (
                <p style={{ color: "#666", fontSize: "13px", marginTop: "8px" }}>
                  No saved maps yet. Create one in the Level Editor!
                </p>
              )}
              {savedMaps.map(m => (
                <div
                  key={m.name}
                  onClick={() => { setSelectedLevel(`saved:${m.name}`); setShowMapModal(false); }}
                  style={{
                    padding: "10px 12px", margin: "4px 0", background: selectedLevel === `saved:${m.name}` ? '#331100' : '#222',
                    border: selectedLevel === `saved:${m.name}` ? '1px solid #c00' : '1px solid #444',
                    cursor: "pointer", color: "#ffcc00", fontSize: "14px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                >
                  <span>🗺️ {m.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      localStorage.removeItem(`doom-map-${m.name}`);
                      setSavedMaps(listSavedMaps());
                    }}
                    style={{ background: "#660000", color: "#ff4444", border: "1px solid #ff4444", padding: "2px 8px", cursor: "pointer", fontSize: "11px" }}
                  >
                    🗑️
                  </button>
                </div>
              ))}

              <button
                onClick={() => setShowMapModal(false)}
                style={{
                  marginTop: "16px", padding: "8px 20px", background: "#333", color: "#aaa",
                  border: "1px solid #555", cursor: "pointer", fontFamily: '"DooM", monospace', fontSize: "14px",
                }}
              >
                CLOSE
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100dvh", background: "#000", position: "relative", overflow: "hidden" }}>
      <a href="#editor" style={{ position: 'fixed', top: 4, left: 4, color: '#666', fontSize: 10, fontFamily: 'monospace', textDecoration: 'none', zIndex: 999, opacity: 0.5 }}>📐 Editor</a>
      <Canvas camera={{ fov: 75, near: 0.1, far: 200 }} gl={{ alpha: false, antialias: true }}>
        <color attach="background" args={["#3d2e1e"]} />
        <fog attach="fog" args={["#3d2e1e", 20, 120]} />
        <Game
          key={gameKey}
          onPlayerState={setPlayerState}
          onGameOver={(): void => {
            setGameOver(true);
            audioManager.stopMusic();
            document.exitPointerLock();
          }}
          onMissionComplete={(): void => {
            setMissionComplete(true);
            document.exitPointerLock();
          }}
          mobileMoveRef={mobileMoveRef}
          mobileLookRef={mobileLookRef}
          mobilePitchRef={mobilePitchRef}
          useActionRef={useActionRef}
          levelData={activeLevelData}
        />
      </Canvas>
      <HUD health={playerState.health} ammo={playerState.ammo} kills={playerState.kills} />

      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "4px", height: "4px", borderRadius: "50%", background: "rgba(255,255,255,0.7)",
        pointerEvents: "none", zIndex: 15,
      }} />

      <div style={{
        position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
        background: "radial-gradient(ellipse at center, rgba(255,0,0,0.2) 0%, rgba(220,0,0,0.7) 60%, rgba(180,0,0,0.85) 100%)",
        opacity: playerState.damageFlash, pointerEvents: "none", zIndex: 14, transition: "opacity 0.1s ease-out",
      }} />

      <MobileControls
        onMove={handleMobileMove}
        onLook={handleMobileLook}
        onShootStart={handleShootStart}
        onShootEnd={handleShootEnd}
        onUse={(): void => { useActionRef.current = true; }}
      />
      {gameOver && (
        <div
          style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            background: "rgba(180,0,0,0.7)", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", fontFamily: "monospace", color: "#fff", zIndex: 100, cursor: "pointer",
          }}
          onClick={(): void => { document.exitPointerLock(); handleStart(); }}
          onMouseDown={(): void => { document.exitPointerLock(); }}
        >
          <h1 style={{ fontSize: "72px", textShadow: "0 0 30px #f00" }}>YOU DIED</h1>
          <p style={{ fontSize: "18px" }}>Click anywhere to restart</p>
        </div>
      )}
      {missionComplete && (
        <div
          style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            background: "#1a0a00", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", fontFamily: "monospace", color: "#cc8800",
            zIndex: 100, cursor: "url(/doom-cursor.png) 16 16, crosshair", overflow: "hidden", padding: "20px", boxSizing: "border-box",
          }}
        >
          <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", color: "#ff6600", textShadow: "0 0 20px #ff4400, 0 0 40px #aa2200", margin: "0 0 20px 0", letterSpacing: "4px" }}>
            LEVEL COMPLETE
          </h1>
          <div style={{ border: "2px solid #663300", padding: "20px 40px", background: "rgba(40,20,0,0.9)", margin: "0 0 20px 0", minWidth: "280px" }}>
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
            onClick={(): void => { document.exitPointerLock(); handleStart(); }}
            style={{
              fontFamily: '"DooM", monospace', fontSize: "clamp(14px, 2.5vw, 18px)", padding: "12px 32px",
              background: "#663300", color: "#ffcc00", border: "2px solid #aa5500", cursor: "url(/doom-cursor.png) 16 16, crosshair",
              letterSpacing: "2px", marginTop: "8px", transition: "background 0.15s, color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e): void => { e.currentTarget.style.background = "#aa5500"; e.currentTarget.style.color = "#ffffff"; e.currentTarget.style.borderColor = "#ff8800"; }}
            onMouseLeave={(e): void => { e.currentTarget.style.background = "#663300"; e.currentTarget.style.color = "#ffcc00"; e.currentTarget.style.borderColor = "#aa5500"; }}
          >
            RESTART GAME
          </button>
        </div>
      )}
      <AudioMenu 
        onMenuOpen={() => { audioMenuOpenRef.current = true; handleShootEnd(); }}
        onMenuClose={() => { audioMenuOpenRef.current = false; }}
      />
    </div>
  );
}
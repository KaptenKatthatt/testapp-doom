import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MainMenu from "./MainMenu";
import { Canvas } from "@react-three/fiber";
import Game from "./Game";
import HUD from "./HUD";
import MobileControls from "./MobileControls";
import { audioManager } from "./Audio";
import type { PlayerState } from "./types";
import type { LevelData } from "./main";
import { gridToLevelData } from "./EditorExport";
import { listSavedMaps } from "./StorageHelpers";
import type { TrackStyle } from "./EditorTypes";

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
    ammo: 60,
    bullets: 60,
    shells: 10,
    currentWeapon: "revolver",
    revolverChamber: 6,
    machinegunMag: 70,
    revolverReloading: false,
    machinegunReloading: false,
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
  const [savedMaps, setSavedMaps] = useState<Array<{ name: string; timestamp: number; validated: boolean; musicTrack?: string }>>([]);
  const [showMapModal, setShowMapModal] = useState(false);
  const mobileMoveRef = useRef<[number, number]>([0, 0]);
  const mobileLookRef = useRef(0);
  const mobilePitchRef = useRef(0);
  const useActionRef = useRef(false);
  const audioMenuOpenRef = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [musicVol, setMusicVol] = useState(audioManager.getMusicVolume());
  const [sfxVol, setSfxVol] = useState(audioManager.getSfxVolume());

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
          return gridToLevelData(grid, playerPos, data.musicTrack);
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
    setPlayerState({ 
      health: 100, 
      ammo: 60, 
      bullets: 60,
      shells: 10,
      currentWeapon: "revolver",
      revolverChamber: 6,
      machinegunMag: 70,
      revolverReloading: false,
      machinegunReloading: false,
      kills: 0, 
      shotsFired: 0, 
      timesHit: 0, 
      startTime: performance.now() / 1000, 
      endTime: 0, 
      damageFlash: 0 
    });
    audioManager.init().then(() => {
      audioManager.resume();
      audioManager.stopMenuMusic();
      const track = activeLevelData?.musicTrack as TrackStyle | undefined;
      if (track) {
        audioManager.playGameMusic(track);
      } else {
        audioManager.playMusic();
      }
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

    const handlePointerLockChange = (): void => {
      if ((gameOver || missionComplete) && document.pointerLockElement) {
        document.exitPointerLock();
      }
    };

    window.addEventListener("keydown", handleRestartKey);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    return () => {
      window.removeEventListener("keydown", handleRestartKey);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, [gameOver, missionComplete, handleStart]);

  // Restart menu music when returning to the main menu
  useEffect(() => {
    if (!started) {
      if (audioManager.isLoaded()) {
        audioManager.stopMusic();
        audioManager.playMenuMusic();
      }
    }
  }, [started]);

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
      <MainMenu
        selectedLevel={selectedLevel}
        setSelectedLevel={setSelectedLevel}
        handleStart={handleStart}
        savedMaps={savedMaps}
        setSavedMaps={setSavedMaps}
        showMapModal={showMapModal}
        setShowMapModal={setShowMapModal}
        levelData={levelData}
        listSavedMaps={listSavedMaps}
      />
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
          paused={menuOpen}
        />
      </Canvas>
      <HUD 
        health={playerState.health} 
        ammo={playerState.ammo} 
        bullets={playerState.bullets}
        shells={playerState.shells}
        currentWeapon={playerState.currentWeapon}
        revolverChamber={playerState.revolverChamber}
        machinegunMag={playerState.machinegunMag}
        revolverReloading={playerState.revolverReloading}
        machinegunReloading={playerState.machinegunReloading}
        kills={playerState.kills} 
      />

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
            alignItems: "center", justifyContent: "center", fontFamily: "monospace", color: "#fff", zIndex: 100,
          }}
          onMouseDown={(): void => { document.exitPointerLock(); }}
        >
          <h1 style={{ fontSize: "72px", textShadow: "0 0 30px #f00", fontFamily: '"DooM", monospace', color: "#ff1111", marginBottom: "20px" }}>YOU DIED</h1>
          <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
            <button
              onClick={(): void => { document.exitPointerLock(); handleStart(); }}
              style={{
                fontFamily: '"DooM", monospace', fontSize: "clamp(14px, 2.5vw, 18px)", padding: "12px 32px",
                background: "#663300", color: "#ffcc00", border: "2px solid #aa5500", cursor: "url(/doom-cursor.png) 16 16, crosshair",
                letterSpacing: "2px", transition: "background 0.15s, color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e): void => { e.currentTarget.style.background = "#aa5500"; e.currentTarget.style.color = "#ffffff"; e.currentTarget.style.borderColor = "#ff8800"; }}
              onMouseLeave={(e): void => { e.currentTarget.style.background = "#663300"; e.currentTarget.style.color = "#ffcc00"; e.currentTarget.style.borderColor = "#aa5500"; }}
            >
              RESTART GAME
            </button>
            <button
              onClick={(): void => {
                document.exitPointerLock();
                setStarted(false);
              }}
              style={{
                fontFamily: '"DooM", monospace', fontSize: "clamp(14px, 2.5vw, 18px)", padding: "12px 32px",
                background: "#551111", color: "#ff4444", border: "2px solid #bb2222", cursor: "url(/doom-cursor.png) 16 16, crosshair",
                letterSpacing: "2px", transition: "background 0.15s, color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e): void => { e.currentTarget.style.background = "#882222"; e.currentTarget.style.color = "#ffffff"; e.currentTarget.style.borderColor = "#ff4444"; }}
              onMouseLeave={(e): void => { e.currentTarget.style.background = "#551111"; e.currentTarget.style.color = "#ff4444"; e.currentTarget.style.borderColor = "#bb2222"; }}
            >
              EXIT TO MAIN MENU
            </button>
          </div>
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
          <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
            <button
              onClick={(): void => { document.exitPointerLock(); handleStart(); }}
              style={{
                fontFamily: '"DooM", monospace', fontSize: "clamp(14px, 2.5vw, 18px)", padding: "12px 32px",
                background: "#663300", color: "#ffcc00", border: "2px solid #aa5500", cursor: "url(/doom-cursor.png) 16 16, crosshair",
                letterSpacing: "2px", transition: "background 0.15s, color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e): void => { e.currentTarget.style.background = "#aa5500"; e.currentTarget.style.color = "#ffffff"; e.currentTarget.style.borderColor = "#ff8800"; }}
              onMouseLeave={(e): void => { e.currentTarget.style.background = "#663300"; e.currentTarget.style.color = "#ffcc00"; e.currentTarget.style.borderColor = "#aa5500"; }}
            >
              RESTART GAME
            </button>
            <button
              onClick={(): void => {
                document.exitPointerLock();
                setStarted(false);
              }}
              style={{
                fontFamily: '"DooM", monospace', fontSize: "clamp(14px, 2.5vw, 18px)", padding: "12px 32px",
                background: "#551111", color: "#ff4444", border: "2px solid #bb2222", cursor: "url(/doom-cursor.png) 16 16, crosshair",
                letterSpacing: "2px", transition: "background 0.15s, color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e): void => { e.currentTarget.style.background = "#882222"; e.currentTarget.style.color = "#ffffff"; e.currentTarget.style.borderColor = "#ff4444"; }}
              onMouseLeave={(e): void => { e.currentTarget.style.background = "#551111"; e.currentTarget.style.color = "#ff4444"; e.currentTarget.style.borderColor = "#bb2222"; }}
            >
              EXIT TO MAIN MENU
            </button>
          </div>
        </div>
      )}
      {/* Sleek, state-of-the-art Menu Button — bottom right corner, above HUD */}
      {!gameOver && !missionComplete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(true);
            document.exitPointerLock?.();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setMenuOpen(true);
            document.exitPointerLock?.();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            bottom: 60,
            right: 12,
            padding: '8px 16px',
            background: 'rgba(20, 10, 10, 0.85)',
            border: '2px solid #c00',
            borderRadius: 4,
            color: '#ff4444',
            fontFamily: "'Courier New', monospace",
            fontSize: 12,
            fontWeight: 'bold',
            letterSpacing: '1px',
            cursor: 'pointer',
            zIndex: 1002,
            boxShadow: '0 0 10px rgba(255, 0, 0, 0.2)',
            transition: 'all 0.15s ease-in-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#c00';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 0, 0, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(20, 10, 10, 0.85)';
            e.currentTarget.style.color = '#ff4444';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.2)';
          }}
        >
          ⚙️ MENU
        </button>
      )}

      {/* Modern Retro Game Menu Modal */}
      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: 'rgba(15, 8, 8, 0.96)',
              border: '3px solid #c00',
              borderRadius: 8,
              padding: '24px 32px',
              width: '320px',
              boxShadow: '0 0 35px rgba(255, 0, 0, 0.4)',
              fontFamily: "'Courier New', monospace",
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              boxSizing: 'border-box',
            }}
          >
            {/* Title */}
            <div
              style={{
                fontSize: 24,
                fontWeight: 'bold',
                color: '#c00',
                textShadow: '0 0 10px #f00',
                textAlign: 'center',
                letterSpacing: 2,
                borderBottom: '2px solid #c00',
                paddingBottom: 10,
              }}
            >
              GAME MENU
            </div>

            {/* Volume settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Music Volume */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#aa7744' }}>🎵 MUSIC VOLUME</span>
                  <span style={{ color: '#ffcc00', fontWeight: 'bold' }}>{musicVol.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={musicVol}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMusicVol(val);
                    audioManager.setMusicVolume(val);
                  }}
                  style={{
                    width: '100%',
                    accentColor: '#c00',
                    cursor: 'pointer',
                  }}
                />
              </div>

              {/* SFX Volume */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#aa7744' }}>💥 SFX VOLUME</span>
                  <span style={{ color: '#ffcc00', fontWeight: 'bold' }}>{sfxVol.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={sfxVol}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setSfxVol(val);
                    audioManager.setSfxVolume(val);
                  }}
                  style={{
                    width: '100%',
                    accentColor: '#c00',
                    cursor: 'pointer',
                  }}
                />
              </div>
            </div>

            {/* Menu Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
              {/* Continue Button */}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  document.body.requestPointerLock?.();
                }}
                style={{
                  padding: '12px 0',
                  background: '#224422',
                  border: '2px solid #33aa33',
                  borderRadius: 4,
                  color: '#55ff55',
                  fontSize: 14,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  letterSpacing: 1.5,
                  transition: 'all 0.1s ease-in-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#336633';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#224422';
                  e.currentTarget.style.color = '#55ff55';
                }}
              >
                CONTINUE
              </button>

              {/* Exit Button */}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setStarted(false);
                  document.exitPointerLock?.();
                }}
                style={{
                  padding: '12px 0',
                  background: '#551111',
                  border: '2px solid #bb2222',
                  borderRadius: 4,
                  color: '#ff4444',
                  fontSize: 14,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  letterSpacing: 1.5,
                  transition: 'all 0.1s ease-in-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#882222';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#551111';
                  e.currentTarget.style.color = '#ff4444';
                }}
              >
                EXIT GAME
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
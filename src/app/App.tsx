import { useCallback, useEffect, useRef, useState } from "react";
import MainMenu, { type SavedMap } from "@/game/MainMenu";
import { Canvas } from "@react-three/fiber";
import Game from "@/game/Game";
import HUD from "@/game/HUD";
import MobileControls from "@/game/MobileControls";
import { audioManager } from "@/shared/audio/Audio";
import type { PlayerState, WeaponType } from "@/game/types";
import type { LevelData } from "@/shared/levelData";
import { gridToLevelData } from "@/editor/EditorExport";
import { E1M1_GRID } from "@/game/levels/E1M1Grid";
import { listSavedMaps, loadMapFromStorage, saveLightingForLevel, type LevelLightingData } from "@/shared/storage/StorageHelpers";
import type { PlayerCommandHandlers } from "@/game/playerCommands";
import { DEFAULT_LIGHTING } from "@/shared/lighting/defaults";
import type { TrackStyle } from "@/editor/EditorTypes";
import { patchE2EState } from "@/shared/e2eBridge";
import { type CellType } from "@/editor/EditorTypes";
import { formatTime, calcScore } from "@/game/gameStats";
import LightingEditorHUD from "@/game/lighting/LightingEditorHUD";

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
    unlockedShotgun: false,
    kills: 0,
    shotsFired: 0,
    timesHit: 0,
    startTime: 0,
    endTime: 0,
    damageFlash: 0,
  });
  const [gameOver, setGameOver] = useState(false);
  const [missionComplete, setMissionComplete] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [savedMaps, setSavedMaps] = useState<SavedMap[]>([]);
  const [showMapModal, setShowMapModal] = useState(false);
  const mobileMoveRef = useRef<[number, number]>([0, 0]);
  const mobileLookRef = useRef(0);
  const mobilePitchRef = useRef(0);
  const useActionRef = useRef(false);
  const playerCommandRef = useRef<PlayerCommandHandlers | null>(null);
  const audioMenuOpenRef = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [musicVol, setMusicVol] = useState(audioManager.getMusicVolume());
  const [sfxVol, setSfxVol] = useState(audioManager.getSfxVolume());

  // Load saved maps list on mount
  useEffect(() => {
    let active = true;
    listSavedMaps().then(maps => {
      if (active) setSavedMaps(maps);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    patchE2EState({ missionComplete });
  }, [missionComplete]);

  const [activeLevelData, setActiveLevelData] = useState<LevelData | null>(null);

  const [lightingEditorActive, setLightingEditorActive] = useState(false);
  const [customLighting, setCustomLighting] = useState<LevelLightingData | null>(null);
  const [selectedLightId, setSelectedLightId] = useState<string | null>(null);

  // If we have levelData from the editor, use it; otherwise load saved map or E1M1 asynchronously
  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      if (selectedLevel === '__custom__' && levelData) {
        if (active) setActiveLevelData(levelData);
        return;
      }
      if (selectedLevel?.startsWith('saved:')) {
        const mapName = selectedLevel.slice(6);
        const data = await loadMapFromStorage(mapName);
        if (data && active) {
          setActiveLevelData(gridToLevelData(data.grid, data.playerPos ?? [2, 2], data.musicTrack, data.lighting));
        } else if (active) {
          setActiveLevelData(null);
        }
        return;
      }
      // Default E1M1 — check for saved custom version first, fallback to E1M1Grid
      if (selectedLevel === '__default__') {
        const data = await loadMapFromStorage('__e1m1__');
        if (data && active) {
          setActiveLevelData(gridToLevelData(data.grid, data.playerPos ?? [2, 3], data.musicTrack, data.lighting));
        } else if (active) {
          const grid = E1M1_GRID.map(row => row.map((t: CellType) => ({ type: t })));
          setActiveLevelData(gridToLevelData(grid, [2, 3] as [number, number], 'classic'));
        }
        return;
      }
      if (active) setActiveLevelData(null);
    };
    load();
    return () => { active = false; };
  }, [selectedLevel, levelData]);

  // Sync activeLevelData to customLighting when loaded
  useEffect(() => {
    if (activeLevelData) {
      setCustomLighting(activeLevelData.lighting ?? null);
    } else {
      setCustomLighting(null);
    }
    setLightingEditorActive(false);
    setSelectedLightId(null);
  }, [activeLevelData]);

  const handleStart = useCallback((): void => {
    setStarted(true);
    setGameOver(false);
    setMissionComplete(false);
    setShowStats(false);
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
      unlockedShotgun: false,
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
    if (!navigator.webdriver) {
      document.body.requestPointerLock?.();
    }
  }, [activeLevelData]);

  // Completion countdown timer removed in favor of Click to Continue interaction

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

  // Listen to 'L' key to toggle lighting editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!started || gameOver || missionComplete) return;
      if (e.key === "l" || e.key === "L") {
        setLightingEditorActive(prev => {
          const next = !prev;
          if (next) {
            document.exitPointerLock?.();
          } else {
            if (!navigator.webdriver) {
              document.body.requestPointerLock?.();
            }
          }
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [started, gameOver, missionComplete]);

  const handleSaveLighting = useCallback(async (): Promise<void> => {
    const lighting = customLighting ?? { ...DEFAULT_LIGHTING };
    const result = await saveLightingForLevel(selectedLevel, lighting);

    if (result === 'memory_only' || result === 'saved') {
      setActiveLevelData((prev) => (prev ? { ...prev, lighting } : prev));
    }

    if (result === 'saved') {
      alert("💡 Lighting configurations saved to map!");
    } else if (result === 'memory_only') {
      alert("💡 Lighting updated for this play session (map not saved to storage yet).");
    } else {
      alert("❌ Failed to find map data to save lighting to.");
    }
  }, [customLighting, selectedLevel]);

  const handleRequestPlayerPosition = useCallback((): Promise<[number, number, number]> => {
    return new Promise((resolve, reject) => {
      const deadline = performance.now() + 2000;
      const tryGet = (): void => {
        const pos = playerCommandRef.current?.getPosition();
        if (pos) {
          resolve(pos);
          return;
        }
        if (performance.now() >= deadline) {
          reject(new Error("Player position unavailable"));
          return;
        }
        requestAnimationFrame(tryGet);
      };
      tryGet();
    });
  }, []);

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

  const handleMobileWeaponSelect = useCallback((weapon: WeaponType): void => {
    playerCommandRef.current?.switchWeapon(weapon);
  }, []);

  const handleMobileReload = useCallback((): void => {
    playerCommandRef.current?.reload();
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
            setShowStats(false);
            document.exitPointerLock();
          }}
          mobileMoveRef={mobileMoveRef}
          mobileLookRef={mobileLookRef}
          mobilePitchRef={mobilePitchRef}
          useActionRef={useActionRef}
          playerCommandRef={playerCommandRef}
          levelData={activeLevelData}
          paused={menuOpen}
          customLighting={customLighting}
          editorModeActive={lightingEditorActive}
          selectedLightId={selectedLightId}
          onSelectLight={setSelectedLightId}
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
        onWeaponSelect={handleMobileWeaponSelect}
        onReload={handleMobileReload}
        currentWeapon={playerState.currentWeapon}
        unlockedShotgun={playerState.unlockedShotgun}
        revolverReloading={playerState.revolverReloading}
        machinegunReloading={playerState.machinegunReloading}
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
        <>
          <style>{`
            @keyframes completionPulse {
              0% { transform: scale(1); opacity: 0.8; }
              50% { transform: scale(1.15); opacity: 1; text-shadow: 0 0 30px #ff9900, 0 0 60px #ff3300; }
              100% { transform: scale(1); opacity: 0.8; }
            }
            @keyframes completionFadeIn {
              from { opacity: 0; transform: scale(0.9) translateY(-10px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes completionFadeToBlack {
              from { background: rgba(0, 0, 0, 0); backdrop-filter: blur(0px); }
              to { background: rgba(0, 0, 0, 1); backdrop-filter: blur(4px); }
            }
          `}</style>
          {!showStats ? (
            <div
              style={{
                position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                zIndex: 100, cursor: "pointer", boxSizing: "border-box",
                animation: "completionFadeToBlack 2s forwards ease-in-out"
              }}
              onClick={(): void => {
                setShowStats(true);
              }}
            >
              <h1 style={{
                fontSize: "clamp(24px, 5vw, 54px)", color: "#ff6600",
                textShadow: "0 0 20px #ff4400, 0 0 40px #aa2200", margin: "0 0 24px 0",
                letterSpacing: "4px", textAlign: "center", fontFamily: "monospace",
                animation: "completionFadeIn 0.6s ease-out"
              }}>
                MISSION ACCOMPLISHED
              </h1>
              <div style={{
                fontSize: "clamp(18px, 3.5vw, 28px)", color: "#ffcc00",
                textShadow: "0 0 20px #ff9900, 0 0 40px #aa5500", fontWeight: "bold",
                fontFamily: "monospace",
                animation: "completionPulse 1.5s infinite ease-in-out",
                marginTop: "10px"
              }}>
                CLICK TO CONTINUE
              </div>
            </div>
          ) : (
            <div
              style={{
                position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                background: "#1a0a00", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", fontFamily: "monospace", color: "#cc8800",
                zIndex: 100, cursor: "url(/doom-cursor.png) 16 16, crosshair", overflow: "hidden", padding: "20px", boxSizing: "border-box",
                animation: "completionFadeIn 0.5s ease-out"
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
        </>
      )}
      {/* Sleek, state-of-the-art Menu Button — bottom right corner, above HUD */}
      {!gameOver && !missionComplete && (
        <button
          data-testid="pause-menu-button"
          aria-label="Open game menu"
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
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
            width: 44,
            height: 44,
            padding: 0,
            background: 'rgba(20, 10, 10, 0.85)',
            border: '2px solid #888',
            borderRadius: '50%',
            color: '#aaa',
            fontFamily: "'Courier New', monospace",
            fontSize: 18,
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 1002,
            boxShadow: '0 0 10px rgba(255, 0, 0, 0.2)',
            transition: 'all 0.15s ease-in-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#666';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(150, 150, 150, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(20, 10, 10, 0.85)';
            e.currentTarget.style.color = '#aaa';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(150, 150, 150, 0.2)';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
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
                  if (!navigator.webdriver) {
                    document.body.requestPointerLock?.();
                  }
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

              {/* Lighting Editor Toggle Button */}
              <button
                onClick={() => {
                  setLightingEditorActive(true);
                  setMenuOpen(false);
                  document.exitPointerLock?.();
                }}
                style={{
                  padding: '12px 0',
                  background: '#442255',
                  border: '2px solid #9933cc',
                  borderRadius: 4,
                  color: '#dd88ff',
                  fontSize: 14,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  letterSpacing: 1.5,
                  transition: 'all 0.1s ease-in-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#663388';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#442255';
                  e.currentTarget.style.color = '#dd88ff';
                }}
              >
                💡 LIGHTS EDITOR
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
      {lightingEditorActive && (
        <LightingEditorHUD
          customLighting={customLighting}
          onChangeLighting={setCustomLighting}
          selectedLightId={selectedLightId}
          onSelectLight={setSelectedLightId}
          onRequestPlayerPosition={handleRequestPlayerPosition}
          onClose={() => {
            setLightingEditorActive(false);
            if (!navigator.webdriver) {
              document.body.requestPointerLock?.();
            }
          }}
          onSave={handleSaveLighting}
        />
      )}
    </div>
  );
}

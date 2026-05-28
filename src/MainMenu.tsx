import React from 'react';
import type { LevelData } from './main';
import { audioManager } from './Audio';
import { TRACK_OPTIONS, TrackStyle } from './EditorTypes';

const TRACK_EMOJI: Record<string, string> = {};
TRACK_OPTIONS.forEach(o => { TRACK_EMOJI[o.value] = o.emoji; });

interface SavedMap {
  name: string;
  timestamp: number;
  validated: boolean;
  musicTrack?: string;
}

interface MainMenuProps {
  selectedLevel: string;
  setSelectedLevel: (level: string) => void;
  handleStart: () => void;
  savedMaps: SavedMap[];
  setSavedMaps: React.Dispatch<React.SetStateAction<SavedMap[]>>;
  showMapModal: boolean;
  setShowMapModal: (show: boolean) => void;
  levelData?: LevelData | null | undefined;
  listSavedMaps: () => SavedMap[];
}

export default function MainMenu({
  selectedLevel,
  setSelectedLevel,
  handleStart,
  savedMaps,
  setSavedMaps,
  showMapModal,
  setShowMapModal,
  levelData,
  listSavedMaps
}: MainMenuProps): React.JSX.Element {
  const [musicActive, setMusicActive] = React.useState(false);

  React.useEffect(() => {
    if (audioManager.isLoaded() && audioManager.isMenuMusicPlaying()) {
      setMusicActive(true);
      return;
    }

    // Try auto-playing
    const startAudio = () => {
      audioManager.init().then(() => {
        audioManager.resume();
        audioManager.playMenuMusic();
        setMusicActive(true);
      }).catch((err) => {
        console.log("Autoplay blocked, waiting for user interaction.", err);
      });
    };

    startAudio();

    // Fallback: start on any screen interaction
    const handleInteraction = () => {
      if (!audioManager.isMenuMusicPlaying()) {
        startAudio();
      }
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('mousemove', handleInteraction);
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('mousedown', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    window.addEventListener('pointerdown', handleInteraction);
    window.addEventListener('mousemove', handleInteraction);

    return cleanup;
  }, []);

  const toggleMusic = (e: React.MouseEvent) => {
    e.stopPropagation();
    audioManager.init().then(() => {
      audioManager.resume();
      if (audioManager.isMenuMusicPlaying()) {
        audioManager.stopMenuMusic();
        setMusicActive(false);
      } else {
        audioManager.playMenuMusic();
        setMusicActive(true);
      }
    });
  };

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

        // Auto-play menu music on click if not playing
        if (!audioManager.isMenuMusicPlaying()) {
          audioManager.init().then(() => {
            audioManager.resume();
            audioManager.playMenuMusic();
            setMusicActive(true);
          });
        }
      }}
    >
      <h1 style={{ fontSize: "72px", margin: "0 0 8px", textShadow: "0 0 30px #f00, 0 0 60px #a00", fontFamily: '"DooM", Impact, sans-serif', letterSpacing: "8px" }}>
        DOOM
      </h1>

      {/* Menu items in classic Doom style */}
      <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px", minWidth: "280px" }}>
        {/* Current level indicator */}
        <p style={{ fontSize: "12px", color: "#666", margin: "0 0 8px 8px", fontFamily: 'monospace' }}>
          {selectedLevel === '__custom__' ? '▶ CUSTOM LEVEL' : selectedLevel?.startsWith('saved:') ? `▶ ${selectedLevel.slice(6).toUpperCase()}` : '▶ E1M1 - ENTRYWAY'}
        </p>

        {/* Start Game */}
        <button
          onClick={(e) => { e.stopPropagation(); handleStart(); }}
          style={{
            background: 'none', border: 'none', color: '#ff0', fontSize: '24px', fontFamily: '"DooM", Impact, sans-serif',
            cursor: 'pointer', padding: '6px 16px', textAlign: 'left', width: '100%', letterSpacing: '3px',
            textShadow: '0 0 10px rgba(255,255,0,0.5)', transition: 'all 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.textShadow = '0 0 20px #ff0'; e.currentTarget.style.transform = 'scale(1.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#ff0'; e.currentTarget.style.textShadow = '0 0 10px rgba(255,255,0,0.5)'; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          ► START GAME
        </button>

        {/* Custom Maps */}
        <button
          onClick={(e) => { e.stopPropagation(); setSavedMaps(listSavedMaps()); setShowMapModal(true); }}
          style={{
            background: 'none', border: 'none', color: '#c00', fontSize: '24px', fontFamily: '"DooM", Impact, sans-serif',
            cursor: 'pointer', padding: '6px 16px', textAlign: 'left', width: '100%', letterSpacing: '3px',
            transition: 'all 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#f44'; e.currentTarget.style.textShadow = '0 0 20px #f00'; e.currentTarget.style.transform = 'scale(1.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#c00'; e.currentTarget.style.textShadow = 'none'; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          ► CUSTOM MAPS
        </button>

        {/* Level Editor */}
        <a
          href="#editor"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'none', border: 'none', color: '#c00', fontSize: '24px', fontFamily: '"DooM", Impact, sans-serif',
            cursor: 'pointer', padding: '6px 16px', textAlign: 'left', width: '100%', letterSpacing: '3px',
            textDecoration: 'none', display: 'block', transition: 'all 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#f44'; e.currentTarget.style.textShadow = '0 0 20px #f00'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#c00'; e.currentTarget.style.textShadow = 'none'; }}
        >
          ► LEVEL EDITOR
        </a>


      </div>

      <p style={{ fontSize: "11px", color: "#444", marginTop: "24px", fontFamily: 'monospace' }}>
        WASD · MOUSE · CLICK TO SHOOT · E TO OPEN DOORS
      </p>

      {/* Custom Map Modal */}
      {showMapModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
            background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 10000, fontFamily: '"DooM", Impact, sans-serif',
          }}
        >
          <div style={{
            background: "#111", border: "2px solid #c00", padding: "24px 32px",
            minWidth: "300px", maxWidth: "90vw", maxHeight: "80vh", overflow: "auto",
          }}>
            <h2 style={{ color: "#c00", marginTop: 0, letterSpacing: "3px", fontSize: "28px" }}>SELECT MAP</h2>

            {/* Default level option */}
            <div
              onClick={() => { setSelectedLevel('__default__'); setShowMapModal(false); }}
              style={{
                padding: "10px 12px", margin: "2px 0", background: selectedLevel === '__default__' ? '#331100' : 'transparent',
                border: selectedLevel === '__default__' ? '1px solid #f80' : '1px solid transparent',
                cursor: "pointer", color: selectedLevel === '__default__' ? '#ff0' : '#ccc', fontSize: "18px",
                fontFamily: '"DooM", Impact, sans-serif', letterSpacing: "2px",
                transition: 'all 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = '#331100'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = selectedLevel === '__default__' ? '#ff0' : '#ccc'; e.currentTarget.style.background = selectedLevel === '__default__' ? '#331100' : 'transparent'; }}
            >
              ► E1M1 - ENTRYWAY
            </div>

            {/* Editor level if available */}
            {levelData && (
              <div
                onClick={() => { setSelectedLevel('__custom__'); setShowMapModal(false); }}
                style={{
                  padding: "10px 12px", margin: "2px 0", background: selectedLevel === '__custom__' ? '#0a2a0a' : 'transparent',
                  border: selectedLevel === '__custom__' ? '1px solid #0f0' : '1px solid transparent',
                  cursor: "pointer", color: selectedLevel === '__custom__' ? '#0f0' : '#0a0', fontSize: "18px",
                  fontFamily: '"DooM", Impact, sans-serif', letterSpacing: "2px",
                  transition: 'all 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#0f0'; e.currentTarget.style.background = '#0a2a0a'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = selectedLevel === '__custom__' ? '#0f0' : '#0a0'; e.currentTarget.style.background = selectedLevel === '__custom__' ? '#0a2a0a' : 'transparent'; }}
              >
                ► CUSTOM LEVEL
              </div>
            )}

            {/* Saved maps */}
            {savedMaps.filter(m => m.validated).length === 0 && !levelData && (
              <p style={{ color: "#555", fontSize: "13px", marginTop: "12px", fontFamily: 'monospace' }}>
                No validated maps yet.<br/>Create one in the Level Editor!
              </p>
            )}
            {savedMaps.filter(m => m.validated).map(m => (
              <div
                key={m.name}
                onClick={() => { setSelectedLevel(`saved:${m.name}`); setShowMapModal(false); }}
                style={{
                  padding: "10px 12px", margin: "2px 0", background: selectedLevel === `saved:${m.name}` ? '#331100' : 'transparent',
                  border: selectedLevel === `saved:${m.name}` ? '1px solid #f80' : '1px solid transparent',
                  cursor: "pointer", color: selectedLevel === `saved:${m.name}` ? '#ff0' : '#aaa', fontSize: "18px",
                  fontFamily: '"DooM", Impact, sans-serif', letterSpacing: "2px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  transition: 'all 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = '#331100'; }}
                onMouseLeave={(e) => { const sel = selectedLevel === `saved:${m.name}`; e.currentTarget.style.color = sel ? '#ff0' : '#aaa'; e.currentTarget.style.background = sel ? '#331100' : 'transparent'; }}
              >
                <span>► {m.name.toUpperCase()}{m.musicTrack ? ` ${TRACK_EMOJI[m.musicTrack as TrackStyle] || '🎵'}` : ''}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    localStorage.removeItem(`doom-map-${m.name}`);
                    setSavedMaps(listSavedMaps());
                  }}
                  style={{ background: "none", color: "#600", border: "1px solid #600", padding: "2px 6px", cursor: "pointer", fontSize: "12px", fontFamily: 'monospace' }}
                >
                  ✕
                </button>
              </div>
            ))}
            {savedMaps.filter(m => !m.validated).length > 0 && (
              <div style={{ color: '#660', fontSize: '12px', marginTop: 8, fontFamily: 'monospace', borderTop: '1px solid #333', paddingTop: 8 }}>
                ⚠️ {savedMaps.filter(m => !m.validated).length} map(s) not validated (finish & validate in editor)
              </div>
            )}

            <button
              onClick={() => setShowMapModal(false)}
              style={{
                marginTop: "16px", padding: "8px 16px", background: "none", color: "#c00",
                border: "1px solid #c00", cursor: "pointer", fontFamily: '"DooM", Impact, sans-serif',
                fontSize: "18px", letterSpacing: "2px", transition: 'all 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#c00'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#c00'; }}
            >
              ► BACK
            </button>
          </div>
        </div>
      )}

      {/* Floating retro metal volume controller */}
      <button
        onClick={toggleMusic}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = musicActive ? '0 0 25px #ff0000' : '0 0 15px rgba(255,255,255,0.3)';
          e.currentTarget.style.borderColor = musicActive ? '#ffffff' : '#aaaaaa';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = musicActive ? '0 0 15px rgba(255, 0, 0, 0.4)' : 'none';
          e.currentTarget.style.borderColor = musicActive ? '#cc0000' : '#444444';
        }}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(15, 5, 5, 0.9)',
          border: musicActive ? '2px solid #cc0000' : '2px solid #444444',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: musicActive ? '#ff3333' : '#666666',
          fontSize: '20px',
          cursor: 'pointer',
          boxShadow: musicActive ? '0 0 15px rgba(255, 0, 0, 0.4)' : 'none',
          transition: 'all 0.2s ease-in-out',
          zIndex: 1001,
          outline: 'none',
        }}
        title={musicActive ? "Mute Menu Music" : "Play Menu Music"}
      >
        {musicActive ? '🔊' : '🔇'}
      </button>

      {/* Pulsing prompt to activate music */}
      {!musicActive && (
        <div
          style={{
            position: "absolute",
            bottom: "80px",
            left: "50%",
            color: "#ff3333",
            fontSize: "11px",
            fontFamily: "monospace",
            letterSpacing: "3px",
            textShadow: "0 0 10px #ff0000",
            animation: "pulse 1.5s infinite",
            pointerEvents: "none",
            textAlign: "center",
          }}
        >
          [ CLICK ANYWHERE TO ACTIVATE MENACING METAL MUSIC ]
        </div>
      )}
    </div>
  );
}

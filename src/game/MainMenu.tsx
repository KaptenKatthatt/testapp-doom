import React from 'react';
import type { LevelData } from '@/shared/levelData';
import { audioManager } from '@/shared/audio/Audio';

export interface SavedMap {
  name: string;
  timestamp: number;
  validated: boolean;
  musicTrack?: string | undefined;
  cloudSaved?: boolean | undefined;
  status?: 'draft' | 'pending' | 'approved' | 'rejected' | undefined;
  ownerId?: string | undefined;
  ownerName?: string | undefined;
  reviewNotes?: string | undefined;
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
  listSavedMaps: () => Promise<SavedMap[]>;
}

type MainMenuItem = 'start' | 'maps' | 'editor';

type MapModalItem =
  | { kind: 'level'; id: string; label: string; status?: 'draft' | 'pending' | 'approved' | 'rejected' | undefined; ownerName?: string | undefined; cloudSaved?: boolean | undefined; reviewNotes?: string | undefined }
  | { kind: 'back' };

const MAIN_MENU_ITEMS: MainMenuItem[] = ['start', 'maps', 'editor'];

const MAIN_MENU_LABELS: Record<MainMenuItem, string> = {
  start: '► START GAME',
  maps: '► CUSTOM MAPS',
  editor: '► LEVEL EDITOR',
};

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
  const [menuIndex, setMenuIndex] = React.useState(0);
  const [modalIndex, setModalIndex] = React.useState(0);
  const musicStartingRef = React.useRef(false);

  const mapModalItems = React.useMemo((): MapModalItem[] => {
    const items: MapModalItem[] = [
      { kind: 'level', id: '__default__', label: '► E1M1 - ENTRYWAY' },
    ];
    if (levelData) {
      items.push({ kind: 'level', id: '__custom__', label: '► CUSTOM LEVEL' });
    }
    for (const m of savedMaps) {
      if (m.validated || m.status === 'approved' || m.status === 'pending' || m.status === 'rejected') {
        items.push({
          kind: 'level',
          id: `saved:${m.name}`,
          label: `► ${m.name.toUpperCase()}`,
          status: m.status,
          ownerName: m.ownerName,
          cloudSaved: m.cloudSaved,
          reviewNotes: m.reviewNotes,
        });
      }
    }
    items.push({ kind: 'back' });
    return items;
  }, [levelData, savedMaps]);

  const openMapModal = React.useCallback((): void => {
    listSavedMaps().then((maps) => {
      setSavedMaps(maps);
      setShowMapModal(true);
    });
  }, [listSavedMaps, setSavedMaps, setShowMapModal]);

  React.useEffect(() => {
    if (!showMapModal) return;
    const idx = mapModalItems.findIndex(
      (item) => item.kind === 'level' && item.id === selectedLevel
    );
    setModalIndex(idx >= 0 ? idx : 0);
  }, [showMapModal, mapModalItems, selectedLevel]);

  const activateMainMenuItem = React.useCallback((item: MainMenuItem): void => {
    if (item === 'start') handleStart();
    else if (item === 'maps') openMapModal();
    else window.location.hash = '#editor';
  }, [handleStart, openMapModal]);

  const activateMapModalItem = React.useCallback((item: MapModalItem): void => {
    if (item.kind === 'back') {
      setShowMapModal(false);
      return;
    }
    setSelectedLevel(item.id);
    setShowMapModal(false);
  }, [setSelectedLevel, setShowMapModal]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const key = e.key.toLowerCase();

      if (showMapModal) {
        if (key === 'w' || key === 'arrowup') {
          e.preventDefault();
          setModalIndex((i) => Math.max(0, i - 1));
        } else if (key === 'a' || key === 's' || key === 'arrowdown') {
          e.preventDefault();
          setModalIndex((i) => Math.min(mapModalItems.length - 1, i + 1));
        } else if (key === 'enter') {
          e.preventDefault();
          const item = mapModalItems[modalIndex];
          if (item) activateMapModalItem(item);
        } else if (key === 'escape') {
          e.preventDefault();
          setShowMapModal(false);
        }
        return;
      }

      if (key === 'w' || key === 'arrowup') {
        e.preventDefault();
        setMenuIndex((i) => Math.max(0, i - 1));
      } else if (key === 'a' || key === 's' || key === 'arrowdown') {
        e.preventDefault();
        setMenuIndex((i) => Math.min(MAIN_MENU_ITEMS.length - 1, i + 1));
      } else if (key === 'enter') {
        e.preventDefault();
        const item = MAIN_MENU_ITEMS[menuIndex];
        if (item) activateMainMenuItem(item);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showMapModal, menuIndex, modalIndex, mapModalItems, activateMainMenuItem, activateMapModalItem, setShowMapModal]);

  React.useEffect(() => {
    let disposed = false;

    const startAudio = (): Promise<boolean> => {
      if (disposed || musicStartingRef.current) {
        return Promise.resolve(audioManager.isMenuMusicPlaying());
      }
      musicStartingRef.current = true;
      return audioManager.init()
        .then(() => audioManager.resume())
        .then(() => {
          if (disposed) return false;
          if (!audioManager.isMenuMusicPlaying()) {
            audioManager.playMenuMusic();
          }
          const playing = audioManager.isMenuMusicPlaying();
          setMusicActive(playing);
          return playing;
        })
        .catch((err: unknown) => {
          console.log("Autoplay blocked, waiting for user interaction.", err);
          return false;
        })
        .finally(() => {
          musicStartingRef.current = false;
        });
    };

    const removeGestureListeners = (): void => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };

    const onGesture = (): void => {
      if (audioManager.isMenuMusicPlaying()) {
        setMusicActive(true);
        removeGestureListeners();
        return;
      }
      void startAudio().then((playing) => {
        if (playing) removeGestureListeners();
      });
    };

    if (audioManager.isLoaded() && audioManager.isMenuMusicPlaying()) {
      setMusicActive(true);
      return;
    }

    void startAudio().then((playing) => {
      if (!playing) {
        window.addEventListener('pointerdown', onGesture, { passive: true });
        window.addEventListener('keydown', onGesture);
      }
    });

    return () => {
      disposed = true;
      removeGestureListeners();
    };
  }, []);

  const toggleMusic = (e: React.MouseEvent): void => {
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

        {MAIN_MENU_ITEMS.map((item, index) => {
          const selected = menuIndex === index;
          const isStart = item === 'start';
          const baseColor = isStart ? '#ff0' : '#c00';
          const hoverColor = isStart ? '#fff' : '#f44';
          const Tag = item === 'editor' ? 'a' : 'button';
          return (
            <Tag
              key={item}
              href={item === 'editor' ? '#editor' : undefined}
              onClick={(e) => {
                e.stopPropagation();
                setMenuIndex(index);
                activateMainMenuItem(item);
              }}
              onMouseEnter={() => setMenuIndex(index)}
              style={{
                background: selected ? 'rgba(80, 0, 0, 0.35)' : 'none',
                border: 'none',
                color: selected ? hoverColor : baseColor,
                fontSize: '24px',
                fontFamily: '"DooM", Impact, sans-serif',
                cursor: 'pointer',
                padding: '6px 16px',
                textAlign: 'left',
                width: '100%',
                letterSpacing: '3px',
                textDecoration: 'none',
                display: 'block',
                textShadow: selected ? (isStart ? '0 0 20px #ff0' : '0 0 20px #f00') : (isStart ? '0 0 10px rgba(255,255,0,0.5)' : 'none'),
                transform: selected ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.1s',
              }}
            >
              {MAIN_MENU_LABELS[item]}
            </Tag>
          );
        })}


      </div>

      <p style={{ fontSize: "11px", color: "#444", marginTop: "24px", fontFamily: 'monospace' }}>
        CONTROLS: MOUSE + WASD · CLICK TO SHOOT · E DOORS
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

            {savedMaps.filter(m => m.validated || m.status === 'approved' || m.status === 'pending' || m.status === 'rejected').length === 0 && !levelData && (
              <p style={{ color: "#555", fontSize: "13px", marginTop: "12px", fontFamily: 'monospace' }}>
                No validated maps yet.<br />Create one in the Level Editor!
              </p>
            )}
            {mapModalItems.map((item, index) => {
              const selected = modalIndex === index;
              if (item.kind === 'back') {
                return (
                  <button
                    key="back"
                    onClick={() => activateMapModalItem(item)}
                    onMouseEnter={() => setModalIndex(index)}
                    style={{
                      marginTop: "16px", padding: "8px 16px", width: '100%',
                      background: selected ? '#c00' : 'none', color: selected ? '#fff' : '#c00',
                      border: "1px solid #c00", cursor: "pointer", fontFamily: '"DooM", Impact, sans-serif',
                      fontSize: "18px", letterSpacing: "2px", transition: 'all 0.1s',
                    }}
                  >
                    ► BACK
                  </button>
                );
              }
              const isCustom = item.id === '__custom__';
              const isCurrentLevel = selectedLevel === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setModalIndex(index);
                    activateMapModalItem(item);
                  }}
                  onMouseEnter={() => setModalIndex(index)}
                  style={{
                    padding: "10px 12px", margin: "2px 0",
                    background: selected ? (isCustom ? '#0a2a0a' : '#331100') : 'transparent',
                    border: selected || isCurrentLevel ? `1px solid ${isCustom ? '#0f0' : '#f80'}` : '1px solid transparent',
                    cursor: "pointer",
                    color: selected ? (isCustom ? '#0f0' : '#fff') : (isCurrentLevel ? (isCustom ? '#0f0' : '#ff0') : (isCustom ? '#0a0' : '#ccc')),
                    fontSize: "16px",
                    fontFamily: 'monospace',
                    letterSpacing: "1px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    transition: 'all 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: '"DooM", Impact, sans-serif', letterSpacing: '2px', fontSize: '18px' }}>{item.label}</span>
                      
                      {/* UAC Map Lifecycle Status Badges */}
                      {item.kind === 'level' && item.status && (
                        <span style={{
                          fontSize: 9,
                          fontWeight: 'bold',
                          padding: '1px 5px',
                          borderRadius: 3,
                          textTransform: 'uppercase',
                          background: item.status === 'approved' ? '#040' : item.status === 'pending' ? '#440' : item.status === 'rejected' ? '#400' : '#222',
                          border: item.status === 'approved' ? '1px solid #0f0' : item.status === 'pending' ? '1px solid #ff0' : item.status === 'rejected' ? '1px solid #f44' : '1px solid #555',
                          color: item.status === 'approved' ? '#0f0' : item.status === 'pending' ? '#ff0' : item.status === 'rejected' ? '#f44' : '#ccc',
                        }}>
                          {item.status}
                        </span>
                      )}
                      
                      {/* Cloud Sync indicator */}
                      {item.kind === 'level' && item.cloudSaved && (
                        <span style={{ fontSize: 10 }} title="Cloud Sync Active">☁️</span>
                      )}
                    </div>
                    
                    {/* Owner Details */}
                    {item.kind === 'level' && item.ownerName && (
                      <span style={{ fontSize: 10, color: '#666', fontFamily: 'monospace' }}>
                        BY: {item.ownerName.toUpperCase()}
                        {item.reviewNotes && <span style={{ color: '#ff6666', marginLeft: 8 }}>⚠️ FEEDBACK: {item.reviewNotes}</span>}
                      </span>
                    )}
                  </div>
                  
                  {item.id.startsWith('saved:') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        localStorage.setItem('doom-load-map', item.id.slice(6));
                        setShowMapModal(false);
                        window.location.hash = '#editor';
                      }}
                      style={{ background: "none", color: "#ff8800", border: "1px solid #ff8800", padding: "2px 6px", cursor: "pointer", fontSize: "12px", fontFamily: 'monospace' }}
                      title="Edit Map"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              );
            })}
            {savedMaps.filter(m => !m.validated).length > 0 && (
              <div style={{ color: '#660', fontSize: '12px', marginTop: 8, fontFamily: 'monospace', borderTop: '1px solid #333', paddingTop: 8 }}>
                ⚠️ {savedMaps.filter(m => !m.validated).length} map(s) not validated (finish & validate in editor)
              </div>
            )}

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

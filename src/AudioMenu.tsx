import { useState, useRef, useEffect } from 'react';
import { audioManager } from './Audio';

export default function AudioMenu() {
  const [open, setOpen] = useState(false);
  const [musicVol, setMusicVol] = useState(audioManager.getMusicVolume());
  const [sfxVol, setSfxVol] = useState(audioManager.getSfxVolume());
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const handleMusicChange = (v: number) => {
    setMusicVol(v);
    audioManager.setMusicVolume(v);
  };

  const handleSfxChange = (v: number) => {
    setSfxVol(v);
    audioManager.setSfxVolume(v);
  };

  return (
    <>
      {/* Gear button — bottom right corner, above HUD */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed',
          bottom: open ? 130 : 60,
          right: 12,
          width: 36,
          height: 36,
          background: 'rgba(0,0,0,0.7)',
          border: '2px solid #888',
          borderRadius: '50%',
          color: '#ccc',
          fontSize: 20,
          cursor: 'pointer',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'bottom 0.2s',
          touchAction: 'none',
          lineHeight: 1,
        }}
        title="Audio settings"
      >
        🔊
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            bottom: 60,
            right: 12,
            background: 'rgba(0,0,0,0.92)',
            border: '2px solid #c00',
            borderRadius: 6,
            padding: '10px 14px',
            zIndex: 1001,
            fontFamily: "'Courier New', monospace",
            color: '#fff',
            minWidth: 180,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 10, color: '#c00', textAlign: 'center' }}>
            🔊 AUDIO
          </div>

          {/* Music slider */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span>🎵 MUSIC</span>
              <span style={{ color: '#ff0' }}>{musicVol.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={musicVol}
              onChange={(e) => handleMusicChange(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#c00' }}
            />
          </div>

          {/* SFX slider */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 11, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span>💥 SFX</span>
              <span style={{ color: '#ff0' }}>{sfxVol.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={sfxVol}
              onChange={(e) => handleSfxChange(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#c00' }}
            />
          </div>
        </div>
      )}
    </>
  );
}
import React from 'react';

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0,0,0,0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const dialogStyle: React.CSSProperties = {
  background: '#1a1a1a',
  border: '2px solid #c00',
  borderRadius: 6,
  padding: 16,
  maxWidth: '90vw',
  maxHeight: '80vh',
  overflow: 'auto',
  minWidth: 300,
};

const btnStyle: React.CSSProperties = {
  background: '#444',
  border: '1px solid #c00',
  color: '#fff',
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: 13,
  borderRadius: 4,
  fontFamily: 'monospace',
};

interface SaveModalProps {
  saveValidation: { errors: string[]; warnings: string[] } | null;
  saveName: string;
  setSaveName: (name: string) => void;
  onSave: () => void;
  onCancel: () => void;
  user?: unknown;
  onSubmitForApproval?: () => void;
}

export function SaveModal({
  saveValidation,
  saveName,
  setSaveName,
  onSave,
  onCancel,
  user,
  onSubmitForApproval,
}: SaveModalProps): React.JSX.Element {
  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        {saveValidation?.errors.length === 0 ? (
          <h3 style={{ color: '#0f0', marginTop: 0 }}>✅ Map Validated!</h3>
        ) : (
          <h3 style={{ color: '#f00', marginTop: 0 }}>⚠️ Validation Issues</h3>
        )}
        {saveValidation && saveValidation.errors.length > 0 && (
          <div style={{ maxHeight: 120, overflowY: 'auto', fontSize: 12, color: '#f88', marginBottom: 8 }}>
            {saveValidation.errors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        )}
        {saveValidation && saveValidation.warnings.length > 0 && (
          <div style={{ maxHeight: 80, overflowY: 'auto', fontSize: 12, color: '#ff0', marginBottom: 8 }}>
            {saveValidation.warnings.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
        )}
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="Map name..."
          style={{
            background: '#111',
            color: '#fff',
            border: '1px solid #555',
            padding: '8px',
            fontFamily: 'monospace',
            fontSize: 14,
            width: '100%',
            boxSizing: 'border-box',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave();
          }}
          autoFocus
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={onSave} style={btnStyle}>💾 Save {user ? 'Cloud Draft' : 'Local'}</button>
          {!!user && saveValidation?.errors.length === 0 && onSubmitForApproval && (
            <button onClick={onSubmitForApproval} style={{ ...btnStyle, background: '#050', border: '1px solid #0f0', color: '#0f0' }}>🚀 Submit for Approval</button>
          )}
          <button onClick={onCancel} style={btnStyle}>❌ Cancel</button>
        </div>
      </div>
    </div>
  );
}

interface LoadModalProps {
  savedMaps: Array<{ name: string; timestamp: number; cloudSaved?: boolean | undefined }>;
  onLoadMap: (name: string) => void;
  onDeleteMap: (name: string) => void;
  onClose: () => void;
}

export function LoadModal({
  savedMaps,
  onLoadMap,
  onDeleteMap,
  onClose,
}: LoadModalProps): React.JSX.Element {
  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <h3 style={{ color: '#c00', marginTop: 0 }}>📂 Load Map</h3>
        {savedMaps.length === 0 ? (
          <p style={{ color: '#888' }}>No saved maps yet.</p>
        ) : (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {savedMaps.map((m) => (
              <div
                key={m.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  borderBottom: '1px solid #333',
                }}
              >
                <button
                  onClick={() => onLoadMap(m.name)}
                  style={{ ...btnStyle, background: '#222', border: '1px solid #0a0', color: '#0f0' }}
                >
                  📂 {m.name} {m.cloudSaved ? '☁️' : '💻'}
                </button>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#666' }}>
                    {new Date(m.timestamp).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => onDeleteMap(m.name)}
                    style={{
                      ...btnStyle,
                      background: '#300',
                      border: '1px solid #600',
                      color: '#f44',
                      padding: '2px 6px',
                      fontSize: 11,
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button onClick={onClose} style={btnStyle}>❌ Close</button>
        </div>
      </div>
    </div>
  );
}

interface ExportModalProps {
  exportCode: string;
  onClose: () => void;
}

export function ExportModal({ exportCode, onClose }: ExportModalProps): React.JSX.Element {
  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <h3 style={{ color: '#c00', marginTop: 0 }}>📋 Level Code</h3>
        <textarea
          readOnly
          value={exportCode}
          style={{
            width: '100%',
            minWidth: 400,
            height: 300,
            background: '#111',
            color: '#0f0',
            border: '1px solid #333',
            fontFamily: 'monospace',
            fontSize: 12,
            padding: 8,
          }}
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(exportCode);
              alert('Copied!');
            }}
            style={btnStyle}
          >
            📋 Copy
          </button>
          <button onClick={onClose} style={btnStyle}>❌ Close</button>
        </div>
      </div>
    </div>
  );
}

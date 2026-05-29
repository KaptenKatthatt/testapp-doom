import React, { useState } from 'react';
import { auth } from '@/shared/storage/firebase';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async (): Promise<void> => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const errorObject = err as Error;
      setError(errorObject.message ?? 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!auth) return;
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (activeTab === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName.trim()) {
          await updateProfile(userCredential.user, {
            displayName: displayName.trim(),
          });
        }
      }
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const errorObject = err as Error & { code?: string };
      let friendlyMessage = errorObject.message ?? 'Authentication failed';
      if (errorObject.code === 'auth/invalid-credential') {
        friendlyMessage = 'Invalid email or password';
      } else if (errorObject.code === 'auth/email-already-in-use') {
        friendlyMessage = 'An account with this email already exists';
      } else if (errorObject.code === 'auth/weak-password') {
        friendlyMessage = 'Password should be at least 6 characters';
      } else if (errorObject.code === 'auth/invalid-email') {
        friendlyMessage = 'Please enter a valid email address';
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        boxSizing: 'border-box',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(18, 9, 9, 0.95)',
          border: '3px solid #c00',
          borderRadius: 8,
          boxShadow: '0 0 35px rgba(255, 0, 0, 0.35), inset 0 0 15px rgba(255, 0, 0, 0.1)',
          color: '#fff',
          fontFamily: 'monospace',
          width: '100%',
          maxWidth: '400px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 16,
            background: 'none',
            border: 'none',
            color: '#888',
            fontSize: 20,
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#c00')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}
          title="Close"
        >
          ✕
        </button>

        {/* Title */}
        <h2
          style={{
            margin: '0 0 8px 0',
            textAlign: 'center',
            color: '#c00',
            fontSize: 22,
            letterSpacing: 2,
            textShadow: '0 0 12px rgba(255, 0, 0, 0.5)',
          }}
        >
          UAC LOGIN TERMINAL
        </h2>

        {/* Description */}
        <p style={{ margin: '0 0 4px 0', fontSize: 11, color: '#aaa', textAlign: 'center', lineHeight: '14px' }}>
          Connect to the cloud to share your custom creations with the community.
        </p>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', borderBottom: '2px solid #331111' }}>
          <button
            onClick={() => {
              setActiveTab('login');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '10px 0',
              background: activeTab === 'login' ? 'rgba(200, 0, 0, 0.1)' : 'transparent',
              border: 'none',
              color: activeTab === 'login' ? '#f44' : '#888',
              fontFamily: 'monospace',
              fontSize: 13,
              fontWeight: 'bold',
              cursor: 'pointer',
              borderBottom: activeTab === 'login' ? '3px solid #c00' : '3px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            SIGN IN
          </button>
          <button
            onClick={() => {
              setActiveTab('register');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '10px 0',
              background: activeTab === 'register' ? 'rgba(200, 0, 0, 0.1)' : 'transparent',
              border: 'none',
              color: activeTab === 'register' ? '#f44' : '#888',
              fontFamily: 'monospace',
              fontSize: 13,
              fontWeight: 'bold',
              cursor: 'pointer',
              borderBottom: activeTab === 'register' ? '3px solid #c00' : '3px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            CREATE ACCOUNT
          </button>
        </div>

        {/* Main Form */}
        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeTab === 'register' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: '#aa7744', fontWeight: 'bold' }}>DISPLAY NAME</label>
              <input
                type="text"
                placeholder="Marine"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: '#aa7744', fontWeight: 'bold' }}>EMAIL ADDRESS</label>
            <input
              type="email"
              placeholder="marine@uac.gov"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: '#aa7744', fontWeight: 'bold' }}>PASSWORD</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          {error && (
            <div
              style={{
                background: 'rgba(255, 0, 0, 0.1)',
                border: '1px solid #ff4444',
                color: '#ff6666',
                padding: '8px 12px',
                fontSize: 11,
                borderRadius: 4,
                lineHeight: '14px',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? '#444' : '#c00',
              border: '1px solid #f66',
              borderRadius: 4,
              color: '#fff',
              padding: '12px 0',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              fontSize: 14,
              letterSpacing: 1,
              marginTop: 4,
              transition: 'all 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#e00';
                e.currentTarget.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#c00';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {loading ? 'INITIALIZING...' : activeTab === 'login' ? 'ACCESS DATABASE' : 'REGISTER MARINE'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
          <div style={{ flex: 1, height: '1px', background: '#331111' }} />
          <span style={{ fontSize: 10, color: '#555' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: '#331111' }} />
        </div>

        {/* Google Sign-in */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            background: 'transparent',
            border: '1px solid #555',
            borderRadius: 4,
            color: '#ccc',
            padding: '10px 0',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontFamily: 'monospace',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.border = '1px solid #fff';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.border = '1px solid #555';
              e.currentTarget.style.color = '#ccc';
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          {/* Minimal inline Google icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          CONTINUE WITH GOOGLE
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#0d0505',
  border: '1px solid #441111',
  borderRadius: 4,
  color: '#fff',
  padding: '10px 12px',
  fontSize: 13,
  fontFamily: 'monospace',
  outline: 'none',
  boxSizing: 'border-box',
  width: '100%',
  transition: 'border-color 0.15s',
};

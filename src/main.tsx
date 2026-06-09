import "./style.css";
import { StrictMode, Suspense, lazy, useState, useEffect, Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { initE2EBridge } from "@/shared/e2eBridge";
import type { LevelData } from "@/shared/levelData";
import type { JSX } from "react";

const App = lazy(() => import("@/app/App"));
const Editor = lazy(() => import("@/editor/Editor"));

initE2EBridge();

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Chunk load failed:', error, info);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            width: "100vw",
            height: "100dvh",
            background: "#000",
            color: "#c00",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: '"DooM", Impact, monospace',
            gap: "16px",
          }}
        >
          <p style={{ fontSize: "clamp(20px, 5vw, 40px)", letterSpacing: "3px", margin: 0 }}>
            FAILED TO LOAD
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "none",
              border: "2px solid #c00",
              color: "#c00",
              padding: "10px 24px",
              fontFamily: '"DooM", Impact, sans-serif',
              fontSize: "20px",
              letterSpacing: "2px",
              cursor: "pointer",
            }}
          >
            RELOAD
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router(): JSX.Element {
  const [route, setRoute] = useState(window.location.hash);
  const [levelData, setLevelData] = useState<LevelData | null>(null);

  useEffect(() => {
    const handler = (): void => { setRoute(window.location.hash); };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  // Prefetch editor chunk while on main menu so navigation feels instant
  useEffect(() => {
    if (route !== '#editor') {
      void import("@/editor/Editor");
    }
  }, [route]);

  // Check for saved playing map
  useEffect(() => {
    const storedLevelData = localStorage.getItem('doom-leveldata-__playing__');
    if (storedLevelData && window.location.hash !== '#editor') {
      try {
        setLevelData(JSON.parse(storedLevelData));
      } catch { /* ignore */ }
    }
  }, [route]);

  const fallback = (
    <div
      style={{
        width: "100vw",
        height: "100dvh",
        background: "#000",
        color: "#c00",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: '"DooM", Impact, monospace',
        fontSize: "clamp(24px, 6vw, 56px)",
        letterSpacing: "4px",
      }}
    >
      LOADING
    </div>
  );

  return (
    <ErrorBoundary>
      <Suspense fallback={fallback}>
        {route === '#editor' ? (
          <Editor />
        ) : (
          <App levelData={levelData} onClearLevelData={() => {
            setLevelData(null);
            localStorage.removeItem('doom-map-__playing__');
            localStorage.removeItem('doom-leveldata-__playing__');
          }} />
        )}
      </Suspense>
    </ErrorBoundary>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Router />
  </StrictMode>
);

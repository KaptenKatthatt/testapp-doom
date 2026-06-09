import "./style.css";
import { StrictMode, Suspense, lazy, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { initE2EBridge } from "@/shared/e2eBridge";
import type { LevelData } from "@/shared/levelData";
import type { JSX } from "react";

const App = lazy(() => import("@/app/App"));
const Editor = lazy(() => import("@/editor/Editor"));

initE2EBridge();

function Router(): JSX.Element {
  const [route, setRoute] = useState(window.location.hash);
  const [levelData, setLevelData] = useState<LevelData | null>(null);

  useEffect(() => {
    const handler = (): void => { setRoute(window.location.hash); };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

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
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Router />
  </StrictMode>
);

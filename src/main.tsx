import "./style.css";
import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Editor from "./Editor";
import { initE2EBridge } from "./e2eBridge";

initE2EBridge();

export interface LevelData {
  walls: Array<{ x: number; z: number; w: number; d: number; isDoor: boolean }>;
  enemies: Array<{ id: number; x: number; z: number; type: string }>;
  pickups: Array<{ id: number; x: number; z: number; type: string }>;
  playerStart: [number, number];
  musicTrack?: string | undefined;
}

function Router() {
  const [route, setRoute] = useState(window.location.hash);
  const [levelData, setLevelData] = useState<LevelData | null>(null);

  useEffect(() => {
    const handler = () => setRoute(window.location.hash);
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

  if (route === '#editor') return <Editor />;

  return <App levelData={levelData} onClearLevelData={() => {
    setLevelData(null);
    localStorage.removeItem('doom-map-__playing__');
    localStorage.removeItem('doom-leveldata-__playing__');
  }} />;
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Router />
  </StrictMode>
);
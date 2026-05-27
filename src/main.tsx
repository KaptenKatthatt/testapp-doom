import "./style.css";
import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Editor from "./Editor";

export interface LevelData {
  walls: Array<{ x: number; z: number; w: number; d: number; isDoor: boolean }>;
  enemies: Array<{ id: number; x: number; z: number; type: string }>;
  pickups: Array<{ id: number; x: number; z: number; type: string }>;
  playerStart: [number, number];
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
    const playingMap = localStorage.getItem('doom-map-__playing__');
    if (playingMap && window.location.hash !== '#editor') {
      try {
        const data = JSON.parse(playingMap);
        if (data.grid && data.playerStart) {
          // We need to convert the grid to LevelData
          // Use the gridToLevelData function from Editor
          // But since we can't import it here easily, we'll store level data directly
          const storedLevelData = localStorage.getItem('doom-leveldata-__playing__');
          if (storedLevelData) {
            setLevelData(JSON.parse(storedLevelData));
          }
        }
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
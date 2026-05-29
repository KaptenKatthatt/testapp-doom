import "./style.css";
import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/App";
import Editor from "@/editor/Editor";
import { initE2EBridge } from "@/shared/e2eBridge";
import type { LevelData } from "@/shared/levelData";

initE2EBridge();

function Router(): React.JSX.Element {
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

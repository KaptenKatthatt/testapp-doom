export type GameSimulationMode = "play" | "lightingEdit";

export interface SimulationCapabilities {
  readonly mode: GameSimulationMode;
}

export function getSimulationCapabilities(editorModeActive: boolean): SimulationCapabilities {
  return { mode: editorModeActive ? "lightingEdit" : "play" };
}

export function applyLightingEditorMovement(
  dt: number,
  player: { position: { y: number } },
  keys: Record<string, boolean>
): void {
  if (keys["KeyE"] || keys["Space"]) {
    player.position.y += dt * 5;
  }
  if (keys["KeyQ"] || keys["ShiftLeft"]) {
    player.position.y = Math.max(0.2, player.position.y - dt * 5);
  }
}

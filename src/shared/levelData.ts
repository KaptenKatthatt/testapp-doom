export interface LevelData {
  walls: Array<{ x: number; z: number; w: number; d: number; isDoor: boolean }>;
  enemies: Array<{ id: number; x: number; z: number; type: string }>;
  pickups: Array<{ id: number; x: number; z: number; type: string }>;
  playerStart: [number, number];
  musicTrack?: string | undefined;
}

export type CellType = 'empty' | 'wall' | 'door' | 'player' | 'imp' | 'demon' | 'zombieman' | 'health' | 'ammo' | 'shotgun';
export type DrawMode = 'paint' | 'line' | 'rect' | 'hollowRect';

export interface CellData {
  type: CellType;
}

export const CELL_SIZE = 20;
export const GRID_W = 50;
export const GRID_H = 50;

export const CELL_COLORS: Record<CellType, string> = {
  empty: '#1a1a1a',
  wall: '#8B7355',
  door: '#CC0000',
  player: '#00FF00',
  imp: '#FF8800',
  demon: '#FF0000',
  zombieman: '#88FF00',
  health: '#0044FF',
  ammo: '#FFAA00',
  shotgun: '#00AAFF',
};

export const CELL_LABELS: Record<CellType, string> = {
  empty: '🧹 Erase',
  wall: '🧱 Wall',
  door: '🚪 Door',
  player: '👤 Player',
  imp: '👹 Imp',
  demon: '💀 Demon',
  zombieman: '🧟 Zombie',
  health: '💊 Health',
  ammo: '🔫 Ammo',
  shotgun: '🔫 Shotgun',
};

export const ENTITY_TYPES = ['imp', 'demon', 'zombieman'] as const;
export const PICKUP_TYPES = ['health', 'ammo', 'shotgun'] as const;

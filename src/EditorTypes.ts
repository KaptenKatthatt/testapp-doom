export type TrackStyle = 'inferno' | 'darkness' | 'rampage' | 'eerie' | 'doom' | 'classic';

export const TRACK_OPTIONS: { value: TrackStyle; label: string; emoji: string }[] = [
  { value: 'inferno', label: 'Inferno', emoji: '🔥' },
  { value: 'darkness', label: 'Darkness', emoji: '🌑' },
  { value: 'rampage', label: 'Rampage', emoji: '⚡' },
  { value: 'eerie', label: 'Eerie', emoji: '🏚️' },
  { value: 'doom', label: 'Doom', emoji: '💀' },
  { value: 'classic', label: 'Classic', emoji: '🎸' },
];

export type CellType = 'empty' | 'wall' | 'halfwall' | 'door' | 'player' | 'imp' | 'demon' | 'zombieman' | 'health' | 'ammo' | 'shotgun' | 'barrel' | 'lava' | 'slime';
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
  halfwall: '#6E563A',
  door: '#CC0000',
  player: '#00FF00',
  imp: '#FF8800',
  demon: '#FF0000',
  zombieman: '#88FF00',
  health: '#0044FF',
  ammo: '#FFAA00',
  shotgun: '#00AAFF',
  barrel: '#556644',
  lava: '#FF3300',
  slime: '#006600',
};

export const CELL_LABELS: Record<CellType, string> = {
  empty: '🧹 Erase',
  wall: '🧱 Wall',
  halfwall: '🧱 Half Wall',
  door: '🚪 Door',
  player: '👤 Player',
  imp: '👹 Imp',
  demon: '💀 Demon',
  zombieman: '🧟 Zombie',
  health: '💊 Health',
  ammo: '🔫 Ammo',
  shotgun: '🔫 Shotgun',
  barrel: '🛢️ Barrel',
  lava: '🌋 Lava',
  slime: '🤢 Slime',
};

export const ENTITY_TYPES = ['imp', 'demon', 'zombieman'] as const;
export const PICKUP_TYPES = ['health', 'ammo', 'shotgun'] as const;

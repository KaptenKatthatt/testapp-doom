export type TrackStyle = 'inferno' | 'darkness' | 'rampage' | 'eerie' | 'doom' | 'classic';

export const TRACK_OPTIONS: Array<{ value: TrackStyle; label: string; emoji: string }> = [
  { value: 'inferno', label: 'Inferno', emoji: '🔥' },
  { value: 'darkness', label: 'Darkness', emoji: '🌑' },
  { value: 'rampage', label: 'Rampage', emoji: '⚡' },
  { value: 'eerie', label: 'Eerie', emoji: '🏚️' },
  { value: 'doom', label: 'Doom', emoji: '💀' },
  { value: 'classic', label: 'Classic', emoji: '🎸' },
];

export type CellType = 'empty' | 'wall' | 'halfwall' | 'door' | 'player' | 'imp' | 'demon' | 'zombieman' | 'ratman' | 'mancubus' | 'cacodemon' | 'health' | 'ammo' | 'shotgun' | 'barrel' | 'lava' | 'slime';
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
  ratman: '#CCAA44',
  mancubus: '#FF33AA',
  cacodemon: '#9400D3',
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
  ratman: '🐀 Ratman',
  mancubus: '🐘 Mancubus',
  cacodemon: '👿 Cacodemon',
  health: '💊 Health',
  ammo: '🔫 Ammo',
  shotgun: '🔫 Shotgun',
  barrel: '🛢️ Barrel',
  lava: '🌋 Lava',
  slime: '🤢 Slime',
};

export const ENTITY_TYPES = ['imp', 'demon', 'zombieman', 'ratman', 'mancubus', 'cacodemon'] as const;
export const PICKUP_TYPES = ['health', 'ammo', 'shotgun'] as const;

// Limits for performance (enemies have ~12 meshes + 1 pointlight each)
export const LIMITS: Record<string, number> = {
  imp: 15,
  demon: 10,
  zombieman: 10,
  ratman: 10,
  mancubus: 8,
  cacodemon: 8,
  health: 20,
  ammo: 20,
  shotgun: 10,
  barrel: 15,
  door: 20,
  player: 1,
  lava: 50,
  slime: 50,
  wall: 200,
};

// Categories for the tool selector
export const CELL_CATEGORIES: Array<{ label: string; types: CellType[] }> = [
  { label: '🏗️ Structure', types: ['empty', 'wall', 'door'] },
  { label: '👹 Enemies', types: ['imp', 'demon', 'zombieman', 'ratman', 'mancubus', 'cacodemon'] },
  { label: '🎒 Pickups', types: ['health', 'ammo', 'shotgun'] },
  { label: '🎯 Objects', types: ['player', 'barrel'] },
  { label: '🌋 Floors', types: ['lava', 'slime'] },
];

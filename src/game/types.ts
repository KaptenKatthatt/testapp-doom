export type WeaponType = "revolver" | "shotgun" | "machinegun";

export interface PlayerState {
  health: number;
  ammo: number; // for backward compatibility/legacy reference
  bullets: number; // shared revolver & machinegun ammo
  shells: number; // shotgun ammo
  currentWeapon: WeaponType;
  revolverChamber: number; // 0-6
  machinegunMag: number; // 0-70
  revolverReloading: boolean;
  machinegunReloading: boolean;
  unlockedShotgun: boolean;
  kills: number;
  shotsFired: number;
  timesHit: number;
  startTime: number;
  endTime: number;
  damageFlash: number;
}

export interface EnemyData {
  id: number;
  position: [number, number, number];
  type: EnemyType;
  health: number;
  maxHealth: number;
  alive: boolean;
  lastAttack: number;
  hitFlash: number;
  rotation: number;
  stuckCounter: number;
  lastPosition: [number, number, number];
  hasAlerted: boolean;
  lastLosCheck?: number | undefined;
  lastLosResult?: boolean | undefined;
}

export type EnemyType = "imp" | "demon" | "zombieman" | "ratman" | "mancubus" | "cacodemon";

export const ENEMY_MAX_HEALTH: Record<EnemyType, number> = {
  imp: 45,
  demon: 80,
  zombieman: 35,
  ratman: 35,
  mancubus: 150,
  cacodemon: 100,
};

export interface PickupData {
  id: number;
  position: [number, number, number];
  type: PickupType;
  active: boolean;
}

export type PickupType = "health" | "ammo" | "shotgun";

export interface WallBox {
  min: [number, number, number];
  max: [number, number, number];
  isHalfWall?: boolean;
}

export interface ProjectileData {
  id: number;
  position: [number, number, number];
  direction: [number, number, number];
  speed: number;
  fromEnemy: boolean;
  color: string;
  life: number; // seconds remaining
}

export interface PlayerState {
  health: number;
  ammo: number;
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
}

export type EnemyType = "imp" | "demon" | "zombieman";

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
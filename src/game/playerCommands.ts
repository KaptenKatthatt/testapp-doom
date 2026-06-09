import type { WeaponType } from "./types";

export interface PlayerCommandHandlers {
  switchWeapon: (weapon: WeaponType) => void;
  reload: () => void;
  getPosition: () => [number, number, number] | null;
}

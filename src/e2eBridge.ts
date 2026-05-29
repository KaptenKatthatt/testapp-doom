export interface E2EDoorState {
  id: number;
  state: string;
}

export interface E2EState {
  currentWeapon: string;
  unlockedShotgun: boolean;
  doors: E2EDoorState[];
  missionComplete: boolean;
  totalEnemies: number;
  aliveEnemies: number;
}

let state: E2EState = {
  currentWeapon: "revolver",
  unlockedShotgun: false,
  doors: [],
  missionComplete: false,
  totalEnemies: 0,
  aliveEnemies: 0,
};

let teleportPlayer: ((x: number, z: number) => void) | null = null;
let defeatAllEnemies: (() => void) | null = null;
let unlockShotgun: (() => void) | null = null;

export function patchE2EState(partial: Partial<E2EState>): void {
  state = { ...state, ...partial };
}

export function registerE2EHandlers(handlers: {
  teleportPlayer?: (x: number, z: number) => void;
  defeatAllEnemies?: () => void;
  unlockShotgun?: () => void;
}): void {
  if (handlers.teleportPlayer) teleportPlayer = handlers.teleportPlayer;
  if (handlers.defeatAllEnemies) defeatAllEnemies = handlers.defeatAllEnemies;
  if (handlers.unlockShotgun) unlockShotgun = handlers.unlockShotgun;
}

export function initE2EBridge(): void {
  if (typeof window === "undefined") return;
  window.__DOOM_E2E__ = {
    getState: () => ({
      ...state,
      doors: state.doors.map((d) => ({ ...d })),
    }),
    teleport: (x: number, z: number) => teleportPlayer?.(x, z),
    defeatAllEnemies: () => defeatAllEnemies?.(),
    unlockShotgun: () => unlockShotgun?.(),
  };
}

declare global {
  interface Window {
    __DOOM_E2E__?: {
      getState: () => E2EState;
      teleport: (x: number, z: number) => void;
      defeatAllEnemies: () => void;
      unlockShotgun: () => void;
    };
  }
}

// Door system for E1M1
// ALL doors require USE button (E key) — no auto-open, like original Doom
// Secret walls stay open forever once opened
// Regular doors auto-close after a timer

import { audioManager } from "./Audio";

export interface DoorData {
  id: number;
  position: [number, number, number]; // original center position (never changes)
  size: [number, number, number]; // original width, height, depth (never changes)
  state: 'closed' | 'opening' | 'open' | 'closing';
  timer: number; // time in current state
  autoClose: number; // seconds before auto-closing (4.0 for regular doors)
  isSecret: boolean; // secret walls — stay open forever once opened
  triggerDistance: number; // how close player needs to be (2.5 for doors)
}

export const INITIAL_DOORS: DoorData[] = [
  // Door 1: Start Room north wall → L-Corridor
  { id: 1, position: [5.5, 2, 10], size: [3, 4, 1], state: 'closed', timer: 0, autoClose: 4.0, isSecret: false, triggerDistance: 2.5 },
  // Door 2: L-Corridor east → Slime Room
  { id: 2, position: [10.5, 2, 17], size: [3, 4, 1], state: 'closed', timer: 0, autoClose: 4.0, isSecret: false, triggerDistance: 2.5 },
  // Door 3: Slime Room → North Corridor
  { id: 3, position: [13.5, 2, 31], size: [3, 4, 1], state: 'closed', timer: 0, autoClose: 4.0, isSecret: false, triggerDistance: 2.5 },
  // Door 4: North Corridor → Exit Room
  { id: 4, position: [14, 2, 34], size: [3, 4, 1], state: 'closed', timer: 0, autoClose: 4.0, isSecret: false, triggerDistance: 2.5 },
];

export function updateDoor(door: DoorData, dt: number, playerPos: [number, number, number], useAction: boolean): DoorData {
  let state = door.state;
  let timer = door.timer + dt;

  const dx = playerPos[0] - door.position[0];
  const dz = playerPos[2] - door.position[2];
  const dist = Math.sqrt(dx * dx + dz * dz);
  const nearPlayer = dist < door.triggerDistance;

  switch (state) {
    case 'closed':
      timer = 0;
      // ALL doors require USE button (E key) — no auto-open
      if (useAction && nearPlayer) {
        state = 'opening';
        timer = 0;
        audioManager.play('door_open');
      }
      break;

    case 'opening':
      if (timer >= 1.0) {
        state = 'open';
        timer = 0;
      }
      break;

    case 'open':
      // Secret walls stay open forever
      if (door.isSecret) break;

      // Auto-close after delay
      if (timer >= door.autoClose) {
        if (!nearPlayer) {
          state = 'closing';
          timer = 0;
          audioManager.play('door_close');
        } else {
          timer = 0; // reset timer while player is in doorway
        }
      }
      break;

    case 'closing':
      if (timer >= 1.0) {
        state = 'closed';
        timer = 0;
      }
      // If player walks into closing door, re-open
      if (nearPlayer) {
        state = 'opening';
        timer = 0;
        audioManager.play('door_open');
      }
      break;
  }

  return { ...door, state, timer };
}

// Get the visual dimensions/position of a door based on its open state
export function getDoorVisual(door: DoorData): {
  position: [number, number, number];
  size: [number, number, number];
} {
  let openProgress = 0;
  if (door.state === 'opening') {
    openProgress = Math.min(door.timer / 1.0, 1.0);
  } else if (door.state === 'open') {
    openProgress = 1.0;
  } else if (door.state === 'closing') {
    openProgress = Math.max(1.0 - door.timer / 1.0, 0.0);
  }

  // Door slides up when opening
  const visibleHeight = door.size[1] * (1.0 - openProgress);
  const yOffset = (door.size[1] - visibleHeight) / 2;

  return {
    position: [door.position[0], door.position[1] + yOffset, door.position[2]],
    size: [door.size[0], Math.max(visibleHeight, 0.01), door.size[2]],
  };
}

// Check if a door is open enough to walk through
function isDoorPassable(door: DoorData): boolean {
  return door.state === 'open' || (door.state === 'opening' && door.timer > 0.5);
}

// Get collision box for a door (only when closed or early opening)
export function getDoorCollisionBox(door: DoorData): { min: [number, number, number]; max: [number, number, number] } | null {
  if (isDoorPassable(door)) return null;
  if (door.state === 'opening' && door.timer > 0.3) return null;

  const [w, h, d] = door.size;
  const [x, , z] = door.position;
  return {
    min: [x - w/2, 0, z - d/2],
    max: [x + w/2, h, z + d/2],
  };
}
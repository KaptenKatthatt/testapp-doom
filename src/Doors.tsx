// Door system for E1M1
// Doors auto-open when player approaches, close after a timer
// Secret walls open with USE button (E key)

export interface DoorData {
  id: number;
  position: [number, number, number]; // center position
  size: [number, number, number]; // width, height, depth
  state: 'closed' | 'opening' | 'open' | 'closing';
  timer: number; // time in current state
  autoClose: number; // seconds before auto-closing (4.0 like Doom)
  isSecret: boolean; // secret walls require USE button
  triggerDistance: number; // how close player needs to be (2.5 for doors)
}

export const INITIAL_DOORS: DoorData[] = [
  // E1M1 doors will be defined when rebuilding the level
  // Placeholder for now
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
      if (door.isSecret) {
        // Secret walls need USE button
        if (useAction && nearPlayer) {
          state = 'opening';
          timer = 0;
        }
      } else {
        // Regular doors auto-open when player is near
        if (nearPlayer) {
          state = 'opening';
          timer = 0;
        }
      }
      break;

    case 'opening':
      if (timer >= 1.0) { // 1 second to open
        state = 'open';
        timer = 0;
      }
      break;

    case 'open':
      // Auto-close after delay
      if (timer >= door.autoClose) {
        // Don't close if player is standing in the doorway
        if (!nearPlayer) {
          state = 'closing';
          timer = 0;
        } else {
          timer = 0; // reset timer while player is in doorway
        }
      }
      break;

    case 'closing':
      if (timer >= 1.0) { // 1 second to close
        state = 'closed';
        timer = 0;
      }
      // If player walks into closing door, re-open
      if (nearPlayer) {
        state = 'opening';
        timer = 0;
      }
      break;
  }

  // Calculate door height based on open progress
  let openProgress = 0;
  if (state === 'opening') {
    openProgress = Math.min(timer / 1.0, 1.0);
  } else if (state === 'open') {
    openProgress = 1.0;
  } else if (state === 'closing') {
    openProgress = Math.max(1.0 - timer / 1.0, 0.0);
  }

  // Door slides up when opening (shrinks from 4 to nearly 0)
  const visibleHeight = door.size[1] * (1.0 - openProgress);
  const yOffset = (door.size[1] - visibleHeight) / 2;

  return {
    ...door,
    state,
    timer,
    // Store visible dimensions for rendering
    size: [door.size[0], visibleHeight, door.size[2]],
    position: [door.position[0], door.position[1] + yOffset, door.position[2]] as [number, number, number],
    // Keep original size for collision reset
  } as DoorData;
}

// Check if a door is open enough to walk through
export function isDoorPassable(door: DoorData): boolean {
  return door.state === 'open' || (door.state === 'opening' && door.timer > 0.5);
}

// Get collision box for a door (only when closed or closing)
export function getDoorCollisionBox(door: DoorData): { min: [number, number, number]; max: [number, number, number] } | null {
  if (isDoorPassable(door)) return null;

  // For opening doors, fade out collision
  if (door.state === 'opening' && door.timer > 0.3) return null;

  const [w, h, d] = door.size;
  const [x, , z] = door.position;
  return {
    min: [x - w/2, 0, z - d/2],
    max: [x + w/2, h, z + d/2],
  };
}
export interface RampageGuitarNote {
  step: number;
  note: number;
  duration: number;
  type: "mute" | "open" | "clean";
}

export interface RampageBassNote {
  step: number;
  note: number;
  duration: number;
}

export type RampageDrumHit = "kick" | "snare" | "hat" | "crash";

export interface RampagePattern {
  guitarPattern: RampageGuitarNote[];
  bassPattern: RampageBassNote[];
  drumPattern: Map<number, RampageDrumHit>;
}

export { buildRampagePattern } from "./buildRampagePattern";

import { buildRampagePattern } from "./buildRampagePattern";

export function createRampagePattern(): RampagePattern {
  return buildRampagePattern();
}

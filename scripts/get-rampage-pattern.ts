import { buildRampagePattern } from "../src/shared/audio/patterns/buildRampagePattern";

const pattern = buildRampagePattern();
process.stdout.write(JSON.stringify({
  guitarPattern: pattern.guitarPattern,
  bassPattern: pattern.bassPattern,
  drumEntries: [...pattern.drumPattern.entries()],
}));

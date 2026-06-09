/**
 * Node bridge to the canonical TypeScript rampage pattern (buildRampagePattern.ts).
 */
const { execSync } = require("child_process");
const path = require("path");

let cachedPattern = null;

function buildRampagePattern() {
  if (cachedPattern) return cachedPattern;

  const root = path.join(__dirname, "..");
  const json = execSync("npx vite-node scripts/get-rampage-pattern.ts", {
    cwd: root,
    encoding: "utf8",
  });
  const parsed = JSON.parse(json);
  cachedPattern = {
    guitarPattern: parsed.guitarPattern,
    bassPattern: parsed.bassPattern,
    drumPattern: new Map(parsed.drumEntries),
  };
  return cachedPattern;
}

module.exports = { buildRampagePattern };

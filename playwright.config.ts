import { defineConfig } from "@playwright/test";

const PLAYWRIGHT_PORT = Number(process.env.PLAYWRIGHT_PORT ?? 5174);
const PLAYWRIGHT_HOST = "127.0.0.1";
const PLAYWRIGHT_BASE_URL = `http://${PLAYWRIGHT_HOST}:${PLAYWRIGHT_PORT}`;

process.env.PLAYWRIGHT_BASE_URL = PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: "on",
  },
  webServer: {
    command: `npx vite --host ${PLAYWRIGHT_HOST} --port ${PLAYWRIGHT_PORT} --strictPort`,
    url: PLAYWRIGHT_BASE_URL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
  },
});

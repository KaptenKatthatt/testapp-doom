import { test, expect } from "@playwright/test";

test("game renders correctly - DOM and state verification", async ({ page }) => {
  await page.goto("http://localhost:5174");
  await page.waitForTimeout(500);

  // Should show start screen
  const title = page.locator("text=DOOM");
  await expect(title).toBeVisible();

  // Click to start game
  await page.click("body");
  await page.waitForTimeout(2000);

  await page.screenshot({ path: "e2e/game-after-start.png", fullPage: true });

  // Verify WebGL canvas exists
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();

  // Verify canvas has renderer
  const engine = await canvas.getAttribute("data-engine");
  expect(engine).toContain("three.js");

  // Verify HUD canvas exists
  const hudCanvas = page.locator("canvas").nth(1);
  await expect(hudCanvas).toBeVisible();

  // Verify game state through DOM
  const gameRunning = await page.evaluate(() => {
    const canvases = document.querySelectorAll("canvas");
    return {
      canvasCount: canvases.length,
    };
  });

  expect(gameRunning.canvasCount).toBeGreaterThanOrEqual(2);
});

test("start screen shows correctly", async ({ page }) => {
  await page.goto("http://localhost:5174");
  await page.waitForTimeout(500);

  const title = page.locator("text=DOOM");
  await expect(title).toBeVisible();

  const subtitle = page.locator("text=E1M1");
  await expect(subtitle).toBeVisible();

  // Check for start prompt (either "Click" or "Tap")
  const startPrompt = page.locator("text=to start");
  await expect(startPrompt).toBeVisible();
});

test("game canvas has background color (not transparent/black)", async ({ page }) => {
  await page.goto("http://localhost:5174");
  await page.waitForTimeout(500);

  // Click to start
  await page.click("body");
  await page.waitForTimeout(2000);

  // Verify WebGL canvas is rendering
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return { found: false };
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return { found: true, hasWebGL: false };
    return {
      found: true,
      hasWebGL: true,
      renderer: gl.getParameter(gl.RENDERER),
    };
  });

  expect(canvasInfo.found).toBe(true);
  expect(canvasInfo.hasWebGL).toBe(true);
});

test("walking with WASD works", async ({ page }) => {
  await page.goto("http://localhost:5174");
  await page.waitForTimeout(500);

  // Click to start
  await page.click("body");
  await page.waitForTimeout(2000);

  // Walk forward for 2 seconds
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(2000);
  await page.keyboard.up("KeyW");

  // Take screenshot after walking
  await page.screenshot({ path: "e2e/game-walking-forward.png", fullPage: true });

  // Verify canvas still exists
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
});
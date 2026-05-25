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

  // Verify canvas exists
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();

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
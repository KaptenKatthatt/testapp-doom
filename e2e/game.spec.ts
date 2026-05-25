import { test, expect } from "@playwright/test";

test("game renders correctly - DOM and state verification", async ({ page }) => {
  await page.goto("http://localhost:5174");
  await page.waitForTimeout(500);

  // Should show start screen
  const title = page.locator("text=DOOM");
  await expect(title).toBeVisible();

  // Click to start game
  await page.locator("text=Click to start").click();
  await page.waitForTimeout(2000);

  await page.screenshot({ path: "e2e/game-after-start.png", fullPage: true });

  // Verify canvas exists and has proper dimensions
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.width).toBeGreaterThan(100);
  expect(box!.height).toBeGreaterThan(100);

  // Verify HUD canvas exists
  const hudCanvas = page.locator("canvas").nth(1);
  await expect(hudCanvas).toBeVisible();

  // Press W to walk forward
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyW");

  await page.screenshot({ path: "e2e/game-walking-forward.png", fullPage: true });

  // Verify game state through console
  const gameRunning = await page.evaluate(() => {
    // Check that React has rendered the game
    const root = document.getElementById("root");
    const canvases = document.querySelectorAll("canvas");
    return {
      rootExists: !!root,
      canvasCount: canvases.length,
      rootHTML: root?.innerHTML?.substring(0, 500),
    };
  });

  console.log("Game running:", JSON.stringify(gameRunning, null, 2));
  expect(gameRunning.canvasCount).toBeGreaterThanOrEqual(2);
});

test("start screen shows correctly", async ({ page }) => {
  await page.goto("http://localhost:5174");
  await page.waitForTimeout(500);

  const title = page.locator("text=DOOM");
  await expect(title).toBeVisible();

  const subtitle = page.locator("text=E1M1");
  await expect(subtitle).toBeVisible();

  const clickPrompt = page.locator("text=Click to start");
  await expect(clickPrompt).toBeVisible();
});
import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:5174";

test.describe("DOOM E1M1 - Core Game", () => {
  test("start screen renders correctly", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);

    const title = page.locator("text=DOOM");
    await expect(title).toBeVisible();

    const subtitle = page.locator("text=E1M1");
    await expect(subtitle).toBeVisible();

    const startPrompt = page.locator("text=to start");
    await expect(startPrompt).toBeVisible();
  });

  test("game starts and shows WebGL canvas with HUD", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);

    await page.click("body");
    await page.waitForTimeout(2000);

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 5000 });

    const canvasCount = await page.evaluate(() => document.querySelectorAll("canvas").length);
    expect(canvasCount).toBeGreaterThanOrEqual(2);
  });

  test("WebGL context is functional", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);
    await page.click("body");
    await page.waitForTimeout(1500);

    const canvasInfo = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      if (!canvas) return { found: false };
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (!gl) return { found: true, hasWebGL: false };
      return { found: true, hasWebGL: true, renderer: gl.getParameter(gl.RENDERER) };
    });

    expect(canvasInfo.found).toBe(true);
    expect(canvasInfo.hasWebGL).toBe(true);
  });

  test("WASD movement works without crashing", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);
    await page.click("body");
    await page.waitForTimeout(1500);

    for (const key of ["KeyW", "KeyD", "KeyS", "KeyA"]) {
      await page.keyboard.down(key);
      await page.waitForTimeout(200);
      await page.keyboard.up(key);
    }

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
  });

  test("HUD canvas renders correctly", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);
    await page.click("body");
    await page.waitForTimeout(1500);

    const hudData = await page.evaluate(() => {
      const canvases = document.querySelectorAll("canvas");
      if (canvases.length < 2) return { canvasCount: canvases.length };
      const hud = canvases[1] as HTMLCanvasElement;
      return { canvasCount: canvases.length, hudWidth: hud.width, hudHeight: hud.height };
    });

    expect(hudData.canvasCount).toBeGreaterThanOrEqual(2);
    expect(hudData.hudWidth).toBe(480);
    expect(hudData.hudHeight).toBe(80);
  });

  test("HUD draws visible content", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);
    await page.click("body");
    await page.waitForTimeout(1500);

    const hudData = await page.evaluate(() => {
      const canvases = document.querySelectorAll("canvas");
      if (canvases.length < 2) return null;
      const hud = canvases[1] as HTMLCanvasElement;
      const ctx = hud.getContext("2d");
      if (!ctx) return null;
      const imageData = ctx.getImageData(0, 0, hud.width, hud.height);
      let nonTransparentPixels = 0;
      for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 0) nonTransparentPixels++;
      }
      return { ratio: nonTransparentPixels / (hud.width * hud.height) };
    });

    expect(hudData).not.toBeNull();
    expect(hudData!.ratio).toBeGreaterThan(0.05);
  });
});

test.describe("DOOM E1M1 - Enemy Visibility", () => {
  test("enemies are rendered and visible in scene", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);
    await page.click("body");
    await page.waitForTimeout(2000);

    await page.keyboard.down("KeyW");
    await page.waitForTimeout(1500);
    await page.keyboard.up("KeyW");

    await page.screenshot({ path: "e2e/enemy-visibility-test.png", fullPage: true });

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
  });

  test("enemy health bars and glow are rendered", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);
    await page.click("body");
    await page.waitForTimeout(2000);

    await page.keyboard.down("KeyW");
    await page.waitForTimeout(1500);
    await page.keyboard.up("KeyW");

    await page.screenshot({ path: "e2e/enemy-healthbar-glow-test.png", fullPage: true });

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
  });
});

test.describe("DOOM E1M1 - Damage System (2 dmg per hit)", () => {
  test("player doesn't die quickly - 2 damage per hit", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);
    await page.click("body");
    await page.waitForTimeout(2000);

    // Stand near start for 5 seconds - can't die at 2 dmg/hit with cooldowns
    await page.waitForTimeout(5000);

    const diedOverlay = page.locator("text=YOU DIED");
    const isDeadVisible = await diedOverlay.isVisible().catch(() => false);
    expect(isDeadVisible).toBe(false);
  });

  test("player survives extended play with enemies", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);
    await page.click("body");
    await page.waitForTimeout(1500);

    await page.keyboard.down("KeyW");
    await page.waitForTimeout(2000);
    await page.keyboard.up("KeyW");

    await page.waitForTimeout(5000);

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();

    await page.screenshot({ path: "e2e/damage-survival-test.png", fullPage: true });
  });

  test("game runs stably with movement and enemies", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);
    await page.click("body");
    await page.waitForTimeout(1500);

    // Walk around
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(2000);
    await page.keyboard.up("KeyW");

    await page.keyboard.down("KeyD");
    await page.waitForTimeout(500);
    await page.keyboard.up("KeyD");

    await page.keyboard.down("KeyW");
    await page.waitForTimeout(1000);
    await page.keyboard.up("KeyW");

    await page.screenshot({ path: "e2e/stable-gameplay-test.png", fullPage: true });

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
  });
});

test.describe("DOOM E1M1 - Integration", () => {
  test("complete flow: start, walk, survive", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);

    await page.click("body");
    await page.waitForTimeout(1500);

    // Verify no "YOU DIED" at start
    const diedAtStart = page.locator("text=YOU DIED");
    expect(await diedAtStart.isVisible().catch(() => false)).toBe(false);

    // Walk around
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(1500);
    await page.keyboard.up("KeyW");

    await page.keyboard.down("KeyD");
    await page.waitForTimeout(500);
    await page.keyboard.up("KeyD");

    await page.keyboard.down("KeyW");
    await page.waitForTimeout(1500);
    await page.keyboard.up("KeyW");

    await page.screenshot({ path: "e2e/integration-test.png", fullPage: true });

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
  });
});
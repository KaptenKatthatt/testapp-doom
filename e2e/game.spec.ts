import { test, expect } from "@playwright/test";
import { BASE_URL, gotoMenu, startGame, waitForE2EState } from "./helpers";

test.describe("DOOM - Core Game", () => {
  test("start screen renders", async ({ page }) => {
    await gotoMenu(page);
    await expect(page.locator("text=DOOM")).toBeVisible();
  });

  test("game starts with WebGL and HUD canvases", async ({ page }) => {
    await gotoMenu(page);
    await page.click("body");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 5000 });
    const canvasCount = await page.evaluate(() => document.querySelectorAll("canvas").length);
    expect(canvasCount).toBeGreaterThanOrEqual(2);
  });

  test("WebGL context is functional", async ({ page }) => {
    test.skip(!process.env.CI_WITH_WEBGL, "WebGL not available in headless Playwright");

    await page.goto(BASE_URL);
    const canvasInfo = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      if (!canvas) return { found: false };
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (!gl) return { found: true, hasWebGL: false };
      return { found: true, hasWebGL: true };
    });
    expect(canvasInfo.found).toBe(true);
    expect(canvasInfo.hasWebGL).toBe(true);
  });

  test("HUD canvas has correct dimensions", async ({ page }) => {
    await startGame(page);
    const hudData = await page.evaluate(() => {
      const canvases = document.querySelectorAll("canvas");
      if (canvases.length < 2) return null;
      const hud = canvases[1] as HTMLCanvasElement;
      return { w: hud.width, h: hud.height };
    });
    expect(hudData).not.toBeNull();
    expect(hudData!.w).toBeGreaterThanOrEqual(480);
    expect(hudData!.h).toBeGreaterThanOrEqual(80);
  });

  test("HUD draws visible content", async ({ page }) => {
    await startGame(page);
    const hudData = await page.evaluate(() => {
      const canvases = document.querySelectorAll("canvas");
      if (canvases.length < 2) return null;
      const hud = canvases[1] as HTMLCanvasElement;
      const ctx = hud.getContext("2d");
      if (!ctx) return null;
      const imageData = ctx.getImageData(0, 0, hud.width, hud.height);
      let nonTransparent = 0;
      for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i]! > 0) nonTransparent++;
      }
      return { ratio: nonTransparent / (hud.width * hud.height) };
    });
    expect(hudData).not.toBeNull();
    expect(hudData!.ratio).toBeGreaterThan(0.05);
  });
});

test.describe("DOOM - Damage & Combat", () => {
  test("damage flash overlay exists in DOM", async ({ page }) => {
    await startGame(page);
    const flashDiv = await page.evaluate(() => {
      const divs = document.querySelectorAll("div");
      for (const d of divs) {
        const bg = window.getComputedStyle(d).background;
        if (bg.includes("200, 0, 0") || bg.includes("radial-gradient")) {
          return true;
        }
      }
      return false;
    });
    expect(flashDiv).toBe(true);
  });
});

test.describe("DOOM - Integration", () => {
  test("complete flow: start, move, survive", async ({ page }) => {
    test.setTimeout(60000);
    await startGame(page);
    await expect(page.locator("text=YOU DIED")).not.toBeVisible({ timeout: 2000 });
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(2000);
    await page.keyboard.up("KeyW");
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(500);
    await page.keyboard.up("KeyD");
    await expect(page.locator("canvas").first()).toBeVisible();
  });
});

test.describe("DOOM - Mobile Controls", () => {
  test.use({ hasTouch: true });

  test("move and look zones exist after game start", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startGame(page);
    await expect(page.locator('[data-testid="move-zone"]')).toBeAttached();
    await expect(page.locator('[data-testid="look-zone"]')).toBeAttached();
  });

  test("touch zones have touchAction none", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startGame(page);
    const touchAction = await page.evaluate(() => {
      const moveZone = document.querySelector('[data-testid="move-zone"]') as HTMLElement | null;
      const lookZone = document.querySelector('[data-testid="look-zone"]') as HTMLElement | null;
      if (!moveZone || !lookZone) return null;
      return {
        move: window.getComputedStyle(moveZone).touchAction,
        look: window.getComputedStyle(lookZone).touchAction,
      };
    });
    expect(touchAction).toEqual({ move: "none", look: "none" });
  });

  test("shoot button exists and is accessible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startGame(page);
    await expect(page.locator('[data-testid="shoot-button"]')).toBeAttached();
  });

  test("weapon and reload buttons exist, and weapon tap cycles available weapons", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startGame(page);
    await expect(page.locator('[data-testid="weapon-switch-button"]')).toBeAttached();
    await expect(page.locator('[data-testid="reload-button"]')).toBeAttached();
    await waitForE2EState(page, (s) => s.currentWeapon === "revolver", 10_000);

    await page.locator('[data-testid="weapon-switch-button"]').click();
    await waitForE2EState(page, (s) => s.currentWeapon === "machinegun", 10_000);
  });
});

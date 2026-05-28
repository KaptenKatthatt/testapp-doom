import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:5174";

test.describe("Level Editor", () => {
  test("editor page loads with canvas", async ({ page }) => {
    await page.goto(`${BASE_URL}#editor`);
    await page.waitForTimeout(500);
    await expect(page.locator("h1")).toContainText("DOOM LEVEL EDITOR");
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
  });

  test("export button shows export dialog", async ({ page }) => {
    await page.goto(`${BASE_URL}#editor`);
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /Export/ }).click();
    await page.waitForTimeout(300);
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 3000 });
  });

  test("hollow rect tool can be selected", async ({ page }) => {
    await page.goto(`${BASE_URL}#editor`);
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /Hollow/ }).click();
    await expect(page.getByRole("button", { name: /Hollow/ })).toBeVisible();
  });
});

test.describe("Custom Map Play", () => {
  test("start screen has Custom Map button", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
    await expect(page.getByRole("button", { name: /CUSTOM MAP/ })).toBeVisible({ timeout: 5000 });
  });

  test("Play This Map saves level data via editor", async ({ page }) => {
    await page.goto(`${BASE_URL}#editor`);
    await page.waitForTimeout(500);

    // Click Wall tool (first one in Structure category)
    await page.getByRole("button", { name: /Wall/ }).first().click();
    await page.waitForTimeout(100);

    // Click Play This Map
    await page.getByRole("button", { name: /Play This Map/ }).click();
    await page.waitForTimeout(2000);

    // Check that level data was saved
    const hasLevelData = await page.evaluate(() => {
      return localStorage.getItem('doom-leveldata-__playing__') !== null;
    });
    expect(hasLevelData).toBe(true);
  });

  test("Custom Map modal lists saved maps", async ({ page }) => {
    // Seed localStorage via addInitScript before page loads
    await page.addInitScript(() => {
      const grid = Array.from({ length: 50 }, (_, z) =>
        Array.from({ length: 50 }, (_, x) =>
          (z === 0 || z === 49 || x === 0 || x === 49) ? 'wall' : 'empty'
        )
      );
      grid[3][3] = 'player';
      localStorage.setItem('doom-map-UnitTestMap', JSON.stringify({
        name: 'UnitTestMap',
        grid,
        playerPos: [3, 3],
        timestamp: Date.now(),
        validated: true,
      }));
    });

    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);

    // Open modal
    await page.getByRole("button", { name: /CUSTOM MAP/ }).click();
    await page.waitForTimeout(500);

    // Validated maps render uppercase in the modal list
    await expect(page.getByText(/UNITTESTMAP/).first()).toBeVisible({ timeout: 3000 });
  });

  test("selecting saved map in modal sets active level", async ({ page }) => {
    // Seed localStorage via addInitScript before page loads
    await page.addInitScript(() => {
      const grid = Array.from({ length: 50 }, (_, z) =>
        Array.from({ length: 50 }, (_, x) =>
          (z === 0 || z === 49 || x === 0 || x === 49) ? 'wall' : 'empty'
        )
      );
      grid[5][5] = 'player';
      localStorage.setItem('doom-map-MyLevel', JSON.stringify({
        name: 'MyLevel',
        grid,
        playerPos: [5, 5],
        timestamp: Date.now(),
        validated: true,
      }));
    });

    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);

    // Open modal
    await page.getByRole("button", { name: /CUSTOM MAP/ }).click();
    await page.waitForTimeout(500);

    // Click the validated map entry (displayed uppercase)
    const mapEntry = page.locator('div').filter({ hasText: /^► MYLEVEL/ }).first();
    await mapEntry.click();
    await page.waitForTimeout(300);

    // Level indicator shows the selected map name in uppercase
    await expect(page.locator('p').filter({ hasText: /MYLEVEL/ })).toBeVisible({ timeout: 3000 });
  });
});
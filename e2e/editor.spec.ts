import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  gotoMenu,
  openCustomMapsModal,
  seedValidatedMap,
} from "./helpers";

test.describe("Level Editor", () => {
  test("editor page loads with canvas", async ({ page }) => {
    await page.goto(`${BASE_URL}#editor`);
    await expect(page.locator("h1")).toContainText("DOOM LEVEL EDITOR", { timeout: 5000 });
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("export button shows export dialog", async ({ page }) => {
    await page.goto(`${BASE_URL}#editor`);
    await page.getByRole("button", { name: /Export/ }).click();
    await expect(page.locator("textarea")).toBeVisible({ timeout: 3000 });
  });

  test("hollow rect tool can be selected", async ({ page }) => {
    await page.goto(`${BASE_URL}#editor`);
    const hollowBtn = page.getByRole("button", { name: /Hollow/ });
    await hollowBtn.click();
    await expect(hollowBtn).toBeVisible();
  });
});

test.describe("Custom Map Play", () => {
  test("start screen has Custom Map button", async ({ page }) => {
    await gotoMenu(page);
    await expect(page.getByRole("button", { name: /CUSTOM MAP/ })).toBeVisible();
  });

  test("Play This Map saves level data via editor", async ({ page }) => {
    await page.goto(`${BASE_URL}#editor`);
    await page.getByRole("button", { name: /Wall/ }).first().click();
    await page.getByRole("button", { name: /Play This Map/ }).click();
    await expect
      .poll(async () =>
        page.evaluate(() => localStorage.getItem("doom-leveldata-__playing__") !== null)
      )
      .toBe(true);
  });

  test("Custom Map modal lists saved maps", async ({ page }) => {
    await seedValidatedMap(page, "UnitTestMap");
    await gotoMenu(page);
    await openCustomMapsModal(page);
    await expect(page.getByText(/UNITTESTMAP/).first()).toBeVisible();
  });

  test("selecting saved map in modal sets active level", async ({ page }) => {
    await seedValidatedMap(page, "MyLevel", [5, 5]);
    await gotoMenu(page);
    await openCustomMapsModal(page);
    await page.locator("div").filter({ hasText: /^► MYLEVEL/ }).first().click();
    await expect(page.locator("p").filter({ hasText: /MYLEVEL/ })).toBeVisible();
  });
});

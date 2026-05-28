import { test, expect } from "@playwright/test";
import {
  acceptConfirmDialogs,
  gotoEditor,
  gotoMenu,
  loadEditorPreset,
  loadMapInEditor,
  openCustomMapsModal,
  openPauseMenu,
  saveMapInEditor,
  seedUnvalidatedMap,
  seedValidatedMap,
  selectSavedMapAndStart,
  startGame,
  getStoredMapValidated,
} from "./helpers";

test.describe("Editor flows", () => {
  test.beforeEach(({ page }) => {
    acceptConfirmDialogs(page);
  });

  test("save and load round-trips map data", async ({ page }) => {
    const mapName = `E2E_${Date.now()}`;
    await gotoEditor(page);
    await loadEditorPreset(page, "Tight");
    await saveMapInEditor(page, mapName);

    await page.getByRole("button", { name: "🗑️ Clear" }).click();
    await loadMapInEditor(page, mapName);

    const validated = await getStoredMapValidated(page, mapName);
    expect(validated).toBe(true);
    await page.getByRole("button", { name: "📋 Export" }).click();
    await expect(page.locator("textarea")).toContainText("enemies", { timeout: 3000 });
  });

  test("unvalidated maps are hidden from play list", async ({ page }) => {
    await seedUnvalidatedMap(page, "HiddenMap");
    await gotoMenu(page);
    await openCustomMapsModal(page);
    await expect(page.getByText(/not validated/i)).toBeVisible();
    await expect(page.getByText(/^► HIDDENMAP/)).not.toBeVisible();
  });

  test("validated save appears in custom map list", async ({ page }) => {
    const mapName = `Valid_${Date.now()}`;
    await gotoEditor(page);
    await loadEditorPreset(page, "Tight");
    await saveMapInEditor(page, mapName);

    await page.locator('button[title="Exit to menu"]').click();
    await gotoMenu(page);
    await openCustomMapsModal(page);
    await expect(page.getByText(new RegExp(mapName.toUpperCase()))).toBeVisible();
  });

  test("undo is available after painting on the grid", async ({ page }) => {
    await gotoEditor(page);
    await page.getByRole("button", { name: /Wall/ }).first().click();
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    // Top-left cell area is usually empty on a fresh editor grid
    await canvas.click({ position: { x: 12, y: 12 } });
    await expect(page.getByRole("button", { name: /Undo/ })).toBeEnabled();
    await page.getByRole("button", { name: /Undo/ }).click();
  });
});

test.describe("Game flows", () => {
  test("play saved custom map starts without immediate death", async ({ page }) => {
    await seedValidatedMap(page, "PlayFlowMap", [5, 5]);
    await selectSavedMapAndStart(page, "PlayFlowMap");
    await expect(page.getByText("YOU DIED")).not.toBeVisible({ timeout: 2000 });
  });

  test("pause menu opens and continue resumes game", async ({ page }) => {
    test.setTimeout(60_000);
    await startGame(page);
    // Let the game scene settle before opening pause (CI can be slower)
    await page.waitForTimeout(500);
    await openPauseMenu(page);
    await page.getByRole("button", { name: "CONTINUE" }).evaluate((el) =>
      (el as HTMLButtonElement).click()
    );
    await expect(page.getByText("GAME MENU")).not.toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible();
  });
});

import { expect, type Page } from "@playwright/test";

export const BASE_URL = "http://localhost:5174";

export function acceptConfirmDialogs(page: Page): void {
  page.on("dialog", (dialog) => dialog.accept());
}

export async function gotoMenu(page: Page): Promise<void> {
  await page.goto(BASE_URL);
  await expect(page.getByRole("button", { name: /START GAME/ })).toBeVisible({ timeout: 5000 });
}

export async function startGame(page: Page): Promise<void> {
  await gotoMenu(page);
  await page.getByRole("button", { name: /START GAME/ }).click();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
}

export async function openCustomMapsModal(page: Page): Promise<void> {
  await page.getByRole("button", { name: /CUSTOM MAP/ }).click();
  await expect(page.getByRole("heading", { name: /SELECT MAP/i })).toBeVisible({ timeout: 3000 });
}

/** Registers a validated custom map in localStorage before the page loads. */
export async function seedValidatedMap(
  page: Page,
  name: string,
  playerPos: [number, number] = [3, 3]
): Promise<void> {
  await page.addInitScript(
    ({ mapName, px, pz }: { mapName: string; px: number; pz: number }) => {
      const grid = Array.from({ length: 50 }, (_, z) =>
        Array.from({ length: 50 }, (_, x) =>
          z === 0 || z === 49 || x === 0 || x === 49 ? "wall" : "empty"
        )
      );
      grid[pz]![px]! = "player";
      localStorage.setItem(`doom-map-${mapName}`, JSON.stringify({
        name: mapName,
        grid,
        playerPos: [px, pz],
        timestamp: Date.now(),
        validated: true,
      }));
    },
    { mapName: name, px: playerPos[0], pz: playerPos[1] }
  );
}

/** Registers a map without validated flag (not shown in play list). */
export async function seedUnvalidatedMap(
  page: Page,
  name: string,
  playerPos: [number, number] = [3, 3]
): Promise<void> {
  await page.addInitScript(
    ({ mapName, px, pz }: { mapName: string; px: number; pz: number }) => {
      const grid = Array.from({ length: 50 }, (_, z) =>
        Array.from({ length: 50 }, (_, x) =>
          z === 0 || z === 49 || x === 0 || x === 49 ? "wall" : "empty"
        )
      );
      grid[pz]![px]! = "player";
      localStorage.setItem(`doom-map-${mapName}`, JSON.stringify({
        name: mapName,
        grid,
        playerPos: [px, pz],
        timestamp: Date.now(),
        validated: false,
      }));
    },
    { mapName: name, px: playerPos[0], pz: playerPos[1] }
  );
}

export async function gotoEditor(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}#editor`);
  await expect(page.locator("h1")).toContainText("DOOM LEVEL EDITOR", { timeout: 5000 });
}

export async function loadEditorPreset(page: Page, presetName: string): Promise<void> {
  await page.getByRole("button", { name: presetName, exact: true }).click();
}

export async function saveMapInEditor(page: Page, mapName: string): Promise<void> {
  await page.getByRole("button", { name: "💾 Save" }).click();
  await expect(page.getByPlaceholder("Map name...")).toBeVisible({ timeout: 3000 });
  await page.getByPlaceholder("Map name...").fill(mapName);
  await page.locator("button").filter({ hasText: "💾 Save" }).last().click();
  await expect(page.getByPlaceholder("Map name...")).not.toBeVisible({ timeout: 3000 });
}

export async function loadMapInEditor(page: Page, mapName: string): Promise<void> {
  await page.getByRole("button", { name: "📂 Load" }).click();
  await expect(page.getByRole("heading", { name: "📂 Load Map" })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`📂 ${mapName}`) }).click();
  await expect(page.getByRole("heading", { name: "📂 Load Map" })).not.toBeVisible({ timeout: 3000 });
}

export async function selectSavedMapAndStart(page: Page, mapName: string): Promise<void> {
  await gotoMenu(page);
  await openCustomMapsModal(page);
  await page.locator("div").filter({ hasText: new RegExp(`^► ${mapName.toUpperCase()}`) }).first().click();
  await page.getByRole("button", { name: /START GAME/ }).click();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 5000 });
}

export async function openPauseMenu(page: Page): Promise<void> {
  const menuBtn = page.locator('[data-testid="pause-menu-button"]');
  await expect(menuBtn).toBeAttached({ timeout: 5000 });
  await menuBtn.evaluate((el) => (el as HTMLButtonElement).click());
  await expect(page.getByText("GAME MENU")).toBeVisible({ timeout: 3000 });
}

export async function getStoredMapValidated(page: Page, mapName: string): Promise<boolean | null> {
  return page.evaluate((name) => {
    const raw = localStorage.getItem(`doom-map-${name}`);
    if (!raw) return null;
    try {
      return !!(JSON.parse(raw) as { validated?: boolean }).validated;
    } catch {
      return null;
    }
  }, mapName);
}

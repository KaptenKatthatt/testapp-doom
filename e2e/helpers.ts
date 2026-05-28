import { expect, type Page } from "@playwright/test";

export const BASE_URL = "http://localhost:5174";

export async function gotoMenu(page: Page): Promise<void> {
  await page.goto(BASE_URL);
  await expect(page.getByRole("button", { name: /START GAME/ })).toBeVisible({ timeout: 5000 });
}

export async function startGame(page: Page): Promise<void> {
  await gotoMenu(page);
  await page.click("body");
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 5000 });
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

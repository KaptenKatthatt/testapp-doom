import { test, expect } from "@playwright/test";
import {
  getE2EState,
  pressUseKey,
  pressWeaponKey,
  seedDoorTestMap,
  seedMissionTestMap,
  selectSavedMapAndStart,
  startGame,
  waitForE2EState,
} from "./helpers";

test.describe("Gameplay phase 3", () => {
  test("weapon keys 1–3 switch active weapon", async ({ page }) => {
    test.setTimeout(60_000);
    await startGame(page);
    await page.waitForTimeout(1000);
    await waitForE2EState(page, (s) => s.currentWeapon === "revolver", 15_000);

    await pressWeaponKey(page, "3");
    await waitForE2EState(page, (s) => s.currentWeapon === "machinegun", 10_000);

    await pressWeaponKey(page, "1");
    await waitForE2EState(page, (s) => s.currentWeapon === "revolver", 10_000);

    await pressWeaponKey(page, "2");
    const afterDenied = await getE2EState(page);
    expect(afterDenied?.currentWeapon).toBe("revolver");
    expect(afterDenied?.unlockedShotgun).toBe(false);

    await page.evaluate(() => window.__DOOM_E2E__?.unlockShotgun());
    await pressWeaponKey(page, "2");
    await waitForE2EState(page, (s) => s.currentWeapon === "shotgun", 10_000);

    await pressWeaponKey(page, "4");
    const afterFour = await getE2EState(page);
    expect(afterFour?.currentWeapon).toBe("shotgun");
  });

  test("E key opens nearby door on custom map", async ({ page }) => {
    await seedDoorTestMap(page);
    await selectSavedMapAndStart(page, "DoorTestMap");

    const before = await waitForE2EState(page, (s) => s.doors.length > 0);
    expect(before.doors[0]?.state).toBe("closed");

    await pressUseKey(page);
    await waitForE2EState(
      page,
      (s) => s.doors.some((d) => d.state === "opening" || d.state === "open"),
      8000
    );
  });

  test("exit switch completes mission on default E1M1", async ({ page }) => {
    test.setTimeout(60_000);
    await startGame(page);
    await page.waitForTimeout(1000);

    await page.evaluate(() => window.__DOOM_E2E__?.teleport(16, 36.35));
    await pressUseKey(page);

    await expect(page.getByText("MISSION ACCOMPLISHED")).toBeVisible({ timeout: 8000 });
  });

  test("clearing all enemies triggers mission complete", async ({ page }) => {
    test.setTimeout(60_000);
    await seedMissionTestMap(page);
    await selectSavedMapAndStart(page, "MissionTestMap");
    await page.waitForTimeout(1000);

    await waitForE2EState(page, (s) => s.totalEnemies > 0, 10_000);
    await page.evaluate(() => window.__DOOM_E2E__?.defeatAllEnemies());

    await expect(page.getByText("MISSION ACCOMPLISHED")).toBeVisible({ timeout: 15_000 });
  });
});

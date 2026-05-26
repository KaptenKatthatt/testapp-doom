# Mobile Joystick Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static mobile touch zones with two floating joysticks (COD Mobile style) and add right-joystick Y-axis for pitch aiming.

**Architecture:** `MobileControls.tsx` is fully rewritten with floating joystick visuals and touch-identifier multi-touch. App.tsx gains a `mobilePitchRef` and updates `handleMobileLook` from delta-based to position-based. Game.tsx gains a `mobilePitchRef` prop and replaces the look-delta reset with continuous position × speed × dt rotation.

**Tech Stack:** React 19, TypeScript, Playwright (E2E tests), Vite dev server on port 5174

---

## File Map

| File | Change |
|------|--------|
| `src/MobileControls.tsx` | Full rewrite — floating joysticks, multi-touch, `onLook(dx, dy)` |
| `src/App.tsx` | Add `mobilePitchRef`, update `handleMobileLook`, pass new prop to `Game` |
| `src/Game.tsx` | Add `mobilePitchRef` prop, replace look-delta block with position-based rotation + pitch |
| `e2e/game.spec.ts` | Add test block for mobile control DOM structure |

---

## Task 1: Add Playwright test for mobile control zones (failing first)

**Files:**
- Modify: `e2e/game.spec.ts`

- [ ] **Step 1: Add failing test block**

Append to `e2e/game.spec.ts` (after the last `test.describe` block, before the final `}`… actually append a new `test.describe` at the end of the file):

```typescript
test.describe("DOOM - Mobile Controls", () => {
  test("move and look zones exist after game start", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);
    await page.click("body");
    await page.waitForTimeout(2000);

    const moveZone = page.locator('[data-testid="move-zone"]');
    const lookZone = page.locator('[data-testid="look-zone"]');
    await expect(moveZone).toBeAttached();
    await expect(lookZone).toBeAttached();
  });

  test("touch zones have touchAction none", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);
    await page.click("body");
    await page.waitForTimeout(2000);

    const touchAction = await page.evaluate(() => {
      const moveZone = document.querySelector('[data-testid="move-zone"]') as HTMLElement | null;
      const lookZone = document.querySelector('[data-testid="look-zone"]') as HTMLElement | null;
      if (!moveZone || !lookZone) return null;
      return {
        move: window.getComputedStyle(moveZone).touchAction,
        look: window.getComputedStyle(lookZone).touchAction,
      };
    });
    expect(touchAction).not.toBeNull();
    expect(touchAction!.move).toBe("none");
    expect(touchAction!.look).toBe("none");
  });

  test("shoot button exists and is accessible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);
    await page.click("body");
    await page.waitForTimeout(2000);

    const shootBtn = page.locator('[data-testid="shoot-button"]');
    await expect(shootBtn).toBeAttached();
  });
});
```

- [ ] **Step 2: Verify tests fail (zones not yet present)**

Start dev server if not running: `npm run dev` (port 5174)

Run: `npx playwright test e2e/game.spec.ts --grep "Mobile Controls" --reporter=line`

Expected: all 3 tests FAIL with element not found or attachment timeout.

- [ ] **Step 3: Commit the failing tests**

```bash
git add e2e/game.spec.ts
git commit -m "test: add failing E2E tests for mobile control zones"
```

---

## Task 2: Rewrite `src/MobileControls.tsx`

**Files:**
- Modify: `src/MobileControls.tsx`

This is a full rewrite. Replace the entire file content.

- [ ] **Step 1: Write the new implementation**

Replace entire `src/MobileControls.tsx` with:

```tsx
import { useRef, useCallback, useState, useEffect } from "react";

interface MobileControlsProps {
  readonly onMove: (dx: number, dy: number) => void;
  readonly onLook: (dx: number, dy: number) => void;
  readonly onShootStart: () => void;
  readonly onShootEnd: () => void;
}

interface JoystickVisual {
  active: boolean;
  originX: number;
  originY: number;
  knobX: number;
  knobY: number;
}

const JOYSTICK_RADIUS = 55;
const RING_SIZE = JOYSTICK_RADIUS * 2;
const KNOB_SIZE = 46;

function getZoneLocal(clientX: number, clientY: number, el: HTMLDivElement): [number, number] {
  const rect = el.getBoundingClientRect();
  return [clientX - rect.left, clientY - rect.top];
}

function clampToZone(x: number, y: number, el: HTMLDivElement): [number, number] {
  const rect = el.getBoundingClientRect();
  return [
    Math.max(JOYSTICK_RADIUS, Math.min(rect.width - JOYSTICK_RADIUS, x)),
    Math.max(JOYSTICK_RADIUS, Math.min(rect.height - JOYSTICK_RADIUS, y)),
  ];
}

function computeKnob(localX: number, localY: number, ox: number, oy: number): { knobX: number; knobY: number; nx: number; ny: number } {
  const dx = localX - ox;
  const dy = localY - oy;
  const len = Math.sqrt(dx * dx + dy * dy);
  const clamped = Math.min(len, JOYSTICK_RADIUS);
  const scale = len > 0 ? clamped / len : 0;
  const cdx = dx * scale;
  const cdy = dy * scale;
  return {
    knobX: ox + cdx,
    knobY: oy + cdy,
    nx: cdx / JOYSTICK_RADIUS,
    ny: cdy / JOYSTICK_RADIUS,
  };
}

export default function MobileControls({
  onMove,
  onLook,
  onShootStart,
  onShootEnd,
}: MobileControlsProps): React.JSX.Element {
  const [isMobile, setIsMobile] = useState(false);
  const [moveJoystick, setMoveJoystick] = useState<JoystickVisual>({
    active: false, originX: 0, originY: 0, knobX: 0, knobY: 0,
  });
  const [lookJoystick, setLookJoystick] = useState<JoystickVisual>({
    active: false, originX: 0, originY: 0, knobX: 0, knobY: 0,
  });

  const moveTouchIdRef = useRef<number | null>(null);
  const lookTouchIdRef = useRef<number | null>(null);
  const moveOriginRef = useRef<{ x: number; y: number } | null>(null);
  const lookOriginRef = useRef<{ x: number; y: number } | null>(null);
  const moveZoneRef = useRef<HTMLDivElement>(null);
  const lookZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMobile("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  // ── Move zone handlers ──────────────────────────────────────────────────────

  const handleMoveStart = useCallback((e: React.TouchEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (moveTouchIdRef.current !== null || !moveZoneRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const [lx, ly] = getZoneLocal(touch.clientX, touch.clientY, moveZoneRef.current);
    const [ox, oy] = clampToZone(lx, ly, moveZoneRef.current);
    moveTouchIdRef.current = touch.identifier;
    moveOriginRef.current = { x: ox, y: oy };
    setMoveJoystick({ active: true, originX: ox, originY: oy, knobX: ox, knobY: oy });
  }, []);

  const handleMoveMove = useCallback((e: React.TouchEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (moveTouchIdRef.current === null || !moveOriginRef.current || !moveZoneRef.current) return;
    const touch = Array.from(e.touches).find(t => t.identifier === moveTouchIdRef.current);
    if (!touch) return;
    const [lx, ly] = getZoneLocal(touch.clientX, touch.clientY, moveZoneRef.current);
    const { x: ox, y: oy } = moveOriginRef.current;
    const { knobX, knobY, nx, ny } = computeKnob(lx, ly, ox, oy);
    onMove(nx, ny);
    setMoveJoystick(prev => ({ ...prev, knobX, knobY }));
  }, [onMove]);

  const handleMoveEnd = useCallback((e: React.TouchEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (!Array.from(e.changedTouches).some(t => t.identifier === moveTouchIdRef.current)) return;
    moveTouchIdRef.current = null;
    moveOriginRef.current = null;
    onMove(0, 0);
    setMoveJoystick(prev => ({ ...prev, active: false }));
  }, [onMove]);

  // ── Look zone handlers ──────────────────────────────────────────────────────

  const handleLookStart = useCallback((e: React.TouchEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (lookTouchIdRef.current !== null || !lookZoneRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const [lx, ly] = getZoneLocal(touch.clientX, touch.clientY, lookZoneRef.current);
    const [ox, oy] = clampToZone(lx, ly, lookZoneRef.current);
    lookTouchIdRef.current = touch.identifier;
    lookOriginRef.current = { x: ox, y: oy };
    setLookJoystick({ active: true, originX: ox, originY: oy, knobX: ox, knobY: oy });
  }, []);

  const handleLookMove = useCallback((e: React.TouchEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (lookTouchIdRef.current === null || !lookOriginRef.current || !lookZoneRef.current) return;
    const touch = Array.from(e.touches).find(t => t.identifier === lookTouchIdRef.current);
    if (!touch) return;
    const [lx, ly] = getZoneLocal(touch.clientX, touch.clientY, lookZoneRef.current);
    const { x: ox, y: oy } = lookOriginRef.current;
    const { knobX, knobY, nx, ny } = computeKnob(lx, ly, ox, oy);
    onLook(nx, ny);
    setLookJoystick(prev => ({ ...prev, knobX, knobY }));
  }, [onLook]);

  const handleLookEnd = useCallback((e: React.TouchEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (!Array.from(e.changedTouches).some(t => t.identifier === lookTouchIdRef.current)) return;
    lookTouchIdRef.current = null;
    lookOriginRef.current = null;
    onLook(0, 0);
    setLookJoystick(prev => ({ ...prev, active: false }));
  }, [onLook]);

  if (!isMobile) return <></>;

  const ringStyle = (j: JoystickVisual): React.CSSProperties => ({
    position: "absolute",
    left: j.originX - JOYSTICK_RADIUS,
    top: j.originY - JOYSTICK_RADIUS,
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.08)",
    border: "2px solid rgba(255, 255, 255, 0.35)",
    pointerEvents: "none",
  });

  const knobStyle = (j: JoystickVisual): React.CSSProperties => ({
    position: "absolute",
    left: (j.knobX - j.originX) + JOYSTICK_RADIUS - KNOB_SIZE / 2,
    top: (j.knobY - j.originY) + JOYSTICK_RADIUS - KNOB_SIZE / 2,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.45)",
    pointerEvents: "none",
  });

  return (
    <>
      {/* Left zone – movement */}
      <div
        ref={moveZoneRef}
        data-testid="move-zone"
        onTouchStart={handleMoveStart}
        onTouchMove={handleMoveMove}
        onTouchEnd={handleMoveEnd}
        onTouchCancel={handleMoveEnd}
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: "50%",
          height: "50%",
          zIndex: 15,
          touchAction: "none",
        }}
      >
        {moveJoystick.active && (
          <div style={ringStyle(moveJoystick)}>
            <div style={knobStyle(moveJoystick)} />
          </div>
        )}
      </div>

      {/* Right zone – look */}
      <div
        ref={lookZoneRef}
        data-testid="look-zone"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: "50%",
          height: "50%",
          zIndex: 15,
          touchAction: "none",
        }}
      >
        {lookJoystick.active && (
          <div style={ringStyle(lookJoystick)}>
            <div style={knobStyle(lookJoystick)} />
          </div>
        )}
      </div>

      {/* Shoot button */}
      <button
        data-testid="shoot-button"
        onTouchStart={(e: React.TouchEvent<HTMLButtonElement>): void => {
          e.preventDefault();
          onShootStart();
        }}
        onTouchEnd={(e: React.TouchEvent<HTMLButtonElement>): void => {
          e.preventDefault();
          onShootEnd();
        }}
        style={{
          position: "absolute",
          right: 20,
          bottom: 20,
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: "rgba(255, 60, 60, 0.5)",
          border: "3px solid rgba(255, 100, 100, 0.8)",
          color: "#fff",
          cursor: "pointer",
          zIndex: 20,
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="18" y="8" width="20" height="6" rx="2" fill="#fff" />
          <rect x="8" y="8" width="12" height="14" rx="2" fill="#fff" />
          <rect x="10" y="22" width="6" height="8" rx="1" fill="#fff" />
          <rect x="6" y="18" width="8" height="16" rx="2" fill="#ddd" />
          <circle cx="40" cy="11" r="3" fill="#ff0" opacity="0.8" />
        </svg>
      </button>
    </>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --build --noEmit
```

Expected: TypeScript error on `App.tsx` — `onLook` signature mismatch (expects `(dx: number)`, gets `(dx: number, dy: number)`). This is expected and will be fixed in Task 3.

- [ ] **Step 3: Commit MobileControls**

```bash
git add src/MobileControls.tsx
git commit -m "feat: rewrite MobileControls with floating joysticks (COD Mobile style)"
```

---

## Task 3: Update `src/App.tsx`

**Files:**
- Modify: `src/App.tsx`

Two changes: add `mobilePitchRef`, update `handleMobileLook`, pass new prop to `<Game>`.

- [ ] **Step 1: Add `mobilePitchRef` and update `handleMobileLook`**

Find the line:
```typescript
const mobileLookRef = useRef(0);
```
Replace with:
```typescript
const mobileLookRef = useRef(0);
const mobilePitchRef = useRef(0);
```

Find:
```typescript
const handleMobileLook = useCallback((dx: number): void => {
  mobileLookRef.current += dx;
}, []);
```
Replace with:
```typescript
const handleMobileLook = useCallback((dx: number, dy: number): void => {
  mobileLookRef.current = dx;
  mobilePitchRef.current = dy;
}, []);
```

- [ ] **Step 2: Pass `mobilePitchRef` to `<Game>`**

Find the `<Game>` JSX block. It currently ends with:
```tsx
mobileLookRef={mobileLookRef}
```
Add the new prop directly after:
```tsx
mobileLookRef={mobileLookRef}
mobilePitchRef={mobilePitchRef}
```

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --build --noEmit
```

Expected: TypeScript error on `Game.tsx` — `mobilePitchRef` is not a known prop. This is expected and will be fixed in Task 4.

- [ ] **Step 4: Commit App.tsx**

```bash
git add src/App.tsx
git commit -m "feat: add mobilePitchRef and update handleMobileLook for joystick Y-axis"
```

---

## Task 4: Update `src/Game.tsx`

**Files:**
- Modify: `src/Game.tsx`

Two changes: add `mobilePitchRef` to `GameProps`, update the look-input block in `useFrame`.

- [ ] **Step 1: Add `mobilePitchRef` to `GameProps`**

Find:
```typescript
interface GameProps {
  readonly onPlayerState: (state: PlayerState) => void;
  readonly onGameOver: () => void;
  readonly onMissionComplete: () => void;
  readonly mobileMoveRef: React.MutableRefObject<[number, number]>;
  readonly mobileLookRef: React.MutableRefObject<number>;
}
```
Replace with:
```typescript
interface GameProps {
  readonly onPlayerState: (state: PlayerState) => void;
  readonly onGameOver: () => void;
  readonly onMissionComplete: () => void;
  readonly mobileMoveRef: React.MutableRefObject<[number, number]>;
  readonly mobileLookRef: React.MutableRefObject<number>;
  readonly mobilePitchRef: React.MutableRefObject<number>;
}
```

- [ ] **Step 2: Add `mobilePitchRef` to the function signature**

Find:
```typescript
export default function Game({ onPlayerState, onGameOver, onMissionComplete, mobileMoveRef, mobileLookRef }: GameProps): React.JSX.Element {
```
Replace with:
```typescript
export default function Game({ onPlayerState, onGameOver, onMissionComplete, mobileMoveRef, mobileLookRef, mobilePitchRef }: GameProps): React.JSX.Element {
```

- [ ] **Step 3: Replace look-input block in `useFrame`**

Find this existing block (inside `useFrame`, after the mobile joystick move block):
```typescript
    // Mobile look input
    if (Math.abs(mobileLookRef.current) > 0.0001) {
      player.rotation += mobileLookRef.current;
      mobileLookRef.current = 0;
    }
```
Replace with:
```typescript
    // Mobile look input (joystick position × speed × dt)
    const MOBILE_TURN_SPEED = 2.5;
    const MOBILE_PITCH_SPEED = 1.5;
    const lookX = mobileLookRef.current;
    const lookY = mobilePitchRef.current;
    if (Math.abs(lookX) > 0.05) {
      player.rotation += lookX * MOBILE_TURN_SPEED * dt;
    }
    if (Math.abs(lookY) > 0.05) {
      player.pitch -= lookY * MOBILE_PITCH_SPEED * dt;
      player.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, player.pitch));
    }
```

- [ ] **Step 4: Run full typecheck — expect clean**

```bash
npx tsc --build --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit Game.tsx**

```bash
git add src/Game.tsx
git commit -m "feat: add mobilePitchRef support and position-based mobile look in game loop"
```

---

## Task 5: Run all tests and verify

**Files:**
- No code changes — verification only.

- [ ] **Step 1: Start dev server (if not running)**

```bash
npm run dev
```

Confirm it starts on port 5174 (check terminal output).

- [ ] **Step 2: Run Playwright mobile controls tests**

```bash
npx playwright test e2e/game.spec.ts --grep "Mobile Controls" --reporter=line
```

Expected: all 3 tests PASS.

- [ ] **Step 3: Run full Playwright suite**

```bash
npx playwright test e2e/game.spec.ts --reporter=line
```

Expected: all tests pass. If any pre-existing tests fail, check that the dev server is running and responsive.

- [ ] **Step 4: Run lint + typecheck**

```bash
npm run check
```

Expected: all checks pass (lint, typecheck, type-coverage at 100%).

- [ ] **Step 5: Commit verification result (if any lint fixes were needed)**

Only commit if `npm run check` required code changes. Otherwise skip.

```bash
git add -A
git commit -m "fix: lint/type cleanup after mobile joystick implementation"
```

---

## Summary

| Task | Files | Commits |
|------|-------|---------|
| 1 | `e2e/game.spec.ts` | 1 |
| 2 | `src/MobileControls.tsx` | 1 |
| 3 | `src/App.tsx` | 1 |
| 4 | `src/Game.tsx` | 1 |
| 5 | verification only | 0–1 |

After Task 5 passes, the feature is complete. Manual smoke test on a real phone (or Chrome DevTools mobile emulation) is recommended to verify the floating joystick feel.

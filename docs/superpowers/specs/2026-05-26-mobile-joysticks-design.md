# Mobile Joystick Controls — Design Spec

**Date:** 2026-05-26  
**Status:** Approved

## Summary

Replace the existing mobile touch controls with two floating joysticks in the style of COD Mobile and Fortnite Mobile — the dominant standard for FPS games on mobile. Add a right-joystick Y-axis for pitch (up/down aiming), which is currently missing.

## Reference: Popular Mobile FPS Controls

All major mobile FPS games (COD Mobile, Fortnite Mobile, PUBG Mobile, Shadowgun Legends) use the same layout:

| Zone | Control | Behavior |
|------|---------|----------|
| Left half | Movement joystick | Floating, appears at touch point |
| Right half | Look/aim joystick | Floating, appears at touch point |
| Right edge | Fire button | Fixed position, prominent circle |

**Floating joystick:** The joystick does not sit at a fixed position. When the player touches the zone, the outer ring appears centered on that touch point. The inner knob moves within the ring as the finger moves. On finger lift, the joystick disappears.

## Files Changed

### 1. `src/MobileControls.tsx` — full redesign

**Interface change:**
```typescript
interface MobileControlsProps {
  onMove: (dx: number, dy: number) => void;   // unchanged
  onLook: (dx: number, dy: number) => void;   // was (dx: number) — now also dy for pitch
  onShootStart: () => void;                   // unchanged
  onShootEnd: () => void;                     // unchanged
}
```

**Left joystick zone (left 50% of screen):**
- `onTouchStart`: record touch identifier + origin (x, y). Show joystick at that position.
- `onTouchMove`: compute offset = (currentX - originX, currentY - originY). Clamp to max radius (55px). Normalize to [-1, 1]. Call `onMove(normalizedX, normalizedY)`.
- `onTouchEnd`: call `onMove(0, 0)`. Hide joystick.

**Right joystick zone (right 50% of screen):**
- Same logic as left, but calls `onLook(normalizedX, normalizedY)`.
- The shoot button sits on top of this zone (higher z-index). Touches on the button do not reach the look zone.

**Joystick visual (both):**
- Only rendered while touch is active.
- Outer ring: 110px diameter, `rgba(255,255,255,0.08)` background, `2px solid rgba(255,255,255,0.35)` border. Rendered `position: absolute` at `left: originX - 55px, top: originY - 55px` within the zone div.
- Origin clamped to keep the ring fully within the zone: `originX = clamp(touchX, 55, zoneWidth - 55)`, same for Y.
- Inner knob: 46px diameter, `rgba(255,255,255,0.45)`. Rendered inside the ring div at `left: calc(50% + clampedOffsetX - 23px), top: calc(50% + clampedOffsetY - 23px)`.
- Pointer events none on both visual elements (touch handled by zone div).

**Multi-touch:** Each zone tracks a single touch identifier (`useRef<number | null>`). On `touchStart`, capture `touch.identifier`. On `touchMove`, scan `e.touches` for matching identifier. On `touchEnd`, scan `e.changedTouches` for matching identifier. This lets both joysticks work simultaneously without interference.

**Shoot button:** Unchanged visually and behaviorally. Fixed position bottom-right.

### 2. `src/App.tsx` — minor additions

- Add `mobilePitchRef = useRef<number>(0)` alongside existing `mobileLookRef`.
- Update `handleMobileLook`:
  ```typescript
  const handleMobileLook = useCallback((dx: number, dy: number): void => {
    mobileLookRef.current = dx;    // joystick X position (-1 to 1)
    mobilePitchRef.current = dy;   // joystick Y position (-1 to 1)
  }, []);
  ```
  Note: previously used `+=` (delta accumulation). Now uses `=` (position). The Game loop handles the frame-rate-scaled rotation.
- Pass `mobilePitchRef` to `<Game>` as a new prop.

### 3. `src/Game.tsx` — look-input change + pitch support

**New prop:**
```typescript
interface GameProps {
  // ...existing props...
  mobilePitchRef: React.MutableRefObject<number>;  // new
}
```

**Updated mobile look handling in game loop** (replaces existing block):
```typescript
const MOBILE_TURN_SPEED = 2.5;   // radians/sec at full deflection
const MOBILE_PITCH_SPEED = 1.5;  // radians/sec at full deflection

const lookX = mobileLookRef.current;
const lookY = mobilePitchRef.current;

if (Math.abs(lookX) > 0.05) {
  player.rotation += lookX * MOBILE_TURN_SPEED * dt;
}
if (Math.abs(lookY) > 0.05) {
  player.pitch -= lookY * MOBILE_PITCH_SPEED * dt;
  player.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, player.pitch));
}
// Do NOT zero out refs here — they hold joystick position, zeroed by onLook(0,0) on touchEnd
```

The existing `mobileLookRef.current = 0` reset is removed — refs are zeroed by `onLook(0, 0)` when the finger lifts.

## Constants

| Constant | Value | Rationale |
|----------|-------|-----------|
| Joystick max radius | 55px | Matches COD Mobile feel on typical phone |
| Outer ring size | 110px | 2× radius |
| Inner knob size | 46px | ~42% of outer ring |
| Turn speed | 2.5 rad/s | Full deflection = ~143°/s, responsive but not twitchy |
| Pitch speed | 1.5 rad/s | Slower than turn to match FPS conventions |
| Dead zone | 0.05 | Prevents drift from resting thumb |

## What Does Not Change

- Desktop keyboard + mouse controls
- Shooting logic and shoot button
- `onMove` interface and movement handling in Game
- Enemy AI, physics, HUD, level
- `types.ts`

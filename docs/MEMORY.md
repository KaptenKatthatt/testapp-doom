# Doom Project Memory

## Key Architecture Decisions

### Weapon Rendering (commit c0466be)
- **Portal rendering**: Weapon viewmodel rendered via `createPortal(<group/>, camera)` inside camera node, so weapons follow camera without per-frame world-space math
- **Local coordinates only**: Since gunGroup is portal-rendered inside camera, all offsets and rotations are local to camera — NO `applyQuaternion(camera.quaternion)` or `position.copy(camera.position).add(offset)`
- **Smooth bobbing**: `bobWeightRef` lerped with `dt * 10.0` to smooth out isMoving boolean transitions
- **High-precision clock**: Uses `_state.clock.getElapsedTime()` (R3F clock) instead of `Date.now()` for jitter-free sin curves
- **Bobbing frequency**: `bobFreq = 2.4` — smooth, heavy, natural walking pace

### Weapon Pullback (wall proximity)
- **Pullback** makes weapon retract when close to walls/doors
- **Problem**: Raw raycast values jitter rapidly, causing weapon to "hack forward and back"
- **Fix**: Smooth pullback with `THREE.MathUtils.lerp(current, target, dt * 12)` (commit: smooth-pullback)
- **Threshold**: Weapon extends ~0.9 units, pullback activates when wall < 0.95 units away

### Player Movement
- `player.isMoving = move.length() > 0` in GameHelpers.ts
- Wall sliding: tries X and Z independently if direct movement blocked
- Mobile controls: joystick for movement, swipe for look

### Important: Do NOT break these
1. Portal rendering in Weapons.tsx (`createPortal`)
2. `bobWeightRef` lerping for smooth walk/stop transitions
3. Pullback lerping for smooth wall proximity
4. Camera must be added to scene graph (`scene.add(camera)`) for portal rendering

## Commit History Highlights
- `c0466be`: Fix weapon viewmodel lag/vibration — portal rendering + smooth bob
- `44ddd6b`: Switch weapon bobbing to high-precision R3F clock, smooth freq to 3.5Hz (later changed to 2.4)
- `ade8cf5`: Add camera to scene graph for portal rendering
- `45e7dae`: Optimize enemy/pickup pointlights, throttle line-of-sight checks

## Known Issues (as of 2026-05-28)
- ~~Weapon pullback jitter near walls~~ (fixed with lerping)
- Mobile shoot/USE buttons were overlapping HUD (fixed in 0cd2f5e)
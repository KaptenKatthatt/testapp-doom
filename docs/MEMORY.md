# Doom Project Memory

## Development Process (MANDATORY)
1. **Always run `npx tsc --noEmit && npx vite build` before pushing** — no exceptions
2. **Never push directly to main** — always create a feature branch → PR → CI green → merge
3. **Self-code-review every PR before requesting merge** — re-read the diff, verify all facts against actual source code (not assumptions from memory), check for stale docs
4. **dev branch** can receive direct pushes for iteration, but main only via PR
5. **If Vercel CI fails** — fix immediately before any new work

---

## Project Architecture

### Tech Stack
- **React + Three.js** via React Three Fiber (R3F)
- **Vite** for build/dev
- **TypeScript** strict mode
- **Deployed on Vercel** (auto-deploys from GitHub main)
- **Audio**: Web Audio API (OGG files + procedural synth fallback)
- **Storage**: localStorage for maps, autosave, settings

### File Structure (src/)
| File | Lines | Purpose |
|------|-------|---------|
| App.tsx | 660 | Root: routing, game state, HUD overlay, menus, level loading |
| main.tsx | 47 | Entry point, hash router (#menu, #editor, #game) |
| Game.tsx | 735 | Core game loop: player, enemies, collision, doors, pickups, barrels |
| GameHelpers.ts | 771 | Player movement, enemy AI, damage, weapon logic |
| GameCollision.ts | 120 | Collision detection: walls, doors, barrels, line-of-sight |
| Weapons.tsx | 498 | Weapon rendering (portal), bobbing, recoil, muzzle flash |
| Level.tsx | 273 | Level geometry: walls, floors, ceilings, textures, barrels |
| Enemies.tsx | 212 | Enemy 3D models, health bars, glow lights |
| Pickups.tsx | 115 | Pickup items (health, ammo, shotgun) |
| Projectiles.tsx | 32 | Projectile rendering |
| Doors.tsx | 122 | Door system: open/close, auto-close, secret doors, USE button |
| HUD.tsx | 236 | Doom-style HUD bar (health, ammo, face, weapon indicator) |
| MobileControls.tsx | 313 | Touch joysticks, shoot/USE buttons (CoD-style layout) |
| MainMenu.tsx | 373 | Main menu UI, map selection, level list |
| Editor.tsx | 654 | Level editor: grid painting, line/rect tools, presets |
| EditorExport.ts | 125 | Grid → level data converter (walls, enemies, pickups) |
| EditorPresets.ts | 292 | Preset maps including E1M1 Entryway |
| EditorTypes.ts | 56 | Shared types: CellType, DrawMode, TrackStyle |
| EditorValidation.ts | 142 | Map validation rules |
| EditorModals.tsx | 213 | Editor modal dialogs |
| E1M1Grid.ts | 56 | E1M1 default map grid data |
| types.ts | 59 | Core types: PlayerState, EnemyData, PickupData, WallBox |
| Audio.ts | 277 | AudioManager singleton: SFX, music, volume control |
| MenuSynth.ts | 553 | Procedural menu music (Web Audio API synth) |
| MusicEngine.ts | 721 | Procedural game music engine (5 styles) |
| Textures.tsx | 378 | Procedural textures (walls, floors, doors, slime, lava) |
| StorageHelpers.ts | 90 | localStorage: save/load/delete maps, autosave |
| useGameInputs.ts | 91 | Keyboard/mouse input hooks |
| LevelDecorations.tsx | 51 | Decorative props (torches, etc.) |
| LevelLights.tsx | 31 | Ambient + directional lighting |
| AudioMenu.tsx | 184 | Audio settings UI |

### Data Flow
1. **MainMenu** → select level → `App.tsx` sets `selectedLevel`
2. **App.tsx** `activeLevelData` useMemo: resolves level from localStorage/E1M1_GRID/editor
3. **Game.tsx** receives `levelData` → builds walls, enemies, doors, pickups from it
4. If `levelData === null` → uses hardcoded E1M1 fallback (Level.tsx WALL_DATA + Game.tsx constants)

---

## Key Architecture Decisions

### Weapon Rendering (commit c0466be) — DO NOT BREAK
- **Portal rendering**: `createPortal(<group/>, camera)` renders weapon inside camera node
- **Local coordinates only**: offsets and rotations are local to camera — NO world-space sync
- **Smooth bobbing**: `bobWeightRef` lerped with `dt * 10.0` for smooth walk/stop transitions
- **High-precision clock**: `_state.clock.getElapsedTime()` (R3F clock) for jitter-free sin curves
- **Bobbing frequency**: `bobFreq = 2.4` — smooth, heavy, natural walking pace
- **Camera must be in scene graph**: `scene.add(camera)` in useEffect — required for portal rendering

### Weapon Pullback (wall proximity)
- Pullback makes weapon retract when close to walls/doors
- **MUST use lerping**: `THREE.MathUtils.lerp(current, target, dt * 12)` — raw raycast values jitter
- Threshold: weapon extends ~0.9 units, pullback at wall < 0.95 units

### Player Movement
- `player.isMoving = move.length() > 0` in GameHelpers.ts
- Wall sliding: tries X and Z independently if direct movement blocked
- Mobile controls: left joystick for movement, right for look
- Mobile shoot/USE: CoD-style buttons above HUD (right side)

### Door System (Doors.tsx)
- ALL doors require USE button (E key) — no auto-open
- Secret walls stay open forever once opened
- Regular doors auto-close after 4 seconds
- Door slides UP when opening (visual)
- Collision box removed when door is >50% open

### Enemy AI (GameHelpers.ts)
- 3 types: imp (ranged), demon (melee), zombieman (ranged)
- Line-of-sight checks throttled to 150ms per enemy
- Wake-on-sight: enemies alert when player is visible
- Stuck counter: if enemy hasn't moved, try perpendicular direction

### Audio System (Audio.ts)
- **Singleton** `audioManager` — init once, resume after user gesture
- SFX: loaded as OGG (fallback WAV) from `/sounds/`
- Music: OGG files from `/audio/` (inferno, darkness, rampage, eerie, doom, classic, e1m1)
- Fallback: procedural synth (MenuSynth, MusicEngine) if OGG missing
- **Stop menu music before playing game music** — must not overlap

### Level Editor System
- Grid: 50×50 cells, each cell is a CellType
- Presets loaded from EditorPresets.ts (including E1M1 Entryway)
- E1M1 can be edited via "✏️ EDIT E1M1" button (localStorage flag `doom-load-e1m1`)
- Saving as E1M1: stores to `doom-map-__e1m1__` key → replaces default when playing
- EditorExport.ts `gridToLevelData()`: converts grid → walls, enemies, pickups, barrels
- Autosave: `doom-editor-autosave` key (silent restore on editor open)
- System maps hidden from regular saved maps list

### Map/Level Loading Priority
1. Custom map from editor (`__custom__` + levelData prop)
2. Saved map (`saved:mapname` → localStorage `doom-map-mapname`)
3. Default E1M1: checks `doom-map-__e1m1__` (saved custom E1M1) first
4. Fallback: E1M1_GRID from E1M1Grid.ts (built-in)

### Three.js Rendering
- Canvas: fov 75, near 0.1, far 200, antialias true
- Fog: `#3d2e1e`, near 20, far 120
- Background: `#3d2e1e` (brownish)
- Textures: all procedural (Canvas-based), no external texture files

---

## Critical Rules — DO NOT BREAK

1. **Portal rendering** in Weapons.tsx — `createPortal(<group/>, camera)`, never replace with world-space sync
2. **bobWeightRef lerping** for smooth walk/stop transitions
3. **Pullback lerping** for smooth wall proximity
4. **Camera must be in scene graph** (`scene.add(camera)`) for portal rendering
5. **Pre-allocated Vector3/Ray/Box3** — never `new THREE.Vector3()` inside useFrame. Use module-level refs or `useMemo()`
6. **No duplicate types** — always import CellType from EditorTypes, never redefine locally
7. **Stop menu music** before playing game music — no overlap
8. **Doors require USE button** — no auto-open
9. **Enemy LOS throttling** — 150ms per enemy, don't check every frame
10. **Enemy/pickup pointlights** — disable when >15 units from camera

---

## Performance Optimizations
- Pre-allocated objects for pullback raycast (Game.tsx) — avoids ~20-100+ allocations/frame
- Pre-allocated camera look vectors — avoids 4 Vector3 + 1 clone/frame
- Pre-allocated enemy pathfinding vectors (GameHelpers.ts `_v3a`-`_v3d`) — avoids ~6 Vector3/enemy/frame
- Pre-allocated player movement vectors — avoids 3 Vector3/frame
- Line-of-sight checks throttled to 150ms per enemy (commit 45e7dae)
- Enemy/pickup pointlights disabled when >12-15 units from camera (commit 45e7dae)
- Fog at far=120 helps cull distant geometry

---

## Antigravity Pitfalls
- **Replaced portal rendering with world-space sync** → broke weapon bobbing with frame-lag jitter. Portal approach is essential because weapon is camera child in scene graph = zero latency movement.
- **Never replace portal-rendering with manual world-space sync** — it will always be one frame behind the camera.
- Lesson: AI agents that modify code MUST check MEMORY.md for architecture constraints first.

---

## Commit History Highlights
- `c0466be`: Fix weapon viewmodel lag/vibration — portal rendering + smooth bob
- `44ddd6b`: Switch weapon bobbing to high-precision R3F clock, smooth freq to 3.5Hz (later 2.4)
- `ade8cf5`: Add camera to scene graph for portal rendering
- `45e7dae`: Optimize enemy/pickup pointlights, throttle line-of-sight checks
- `0cd2f5e`: Move mobile shoot/USE buttons above HUD (CoD style)
- `b29436f`: Transparent Doom face PNG, favicon

---

## Asset Files
- `/sounds/`: Doom SFX as OGG+WAV (ds*.ogg) — loaded by AudioManager
- `/audio/`: Music tracks as OGG (e1m1, inferno, darkness, rampage, eerie, doom)
- `/doom-face.png`: Transparent PNG for HUD face + favicon
- `/doom-cursor.png`: Custom crosshair cursor
- `/fonts/`: DooM font for UI text

---

## Enemy Stats (GameHelpers.ts — authoritative)
| Type | HP | Speed | Attack | Range | Cooldown | Projectile |
|------|-----|-------|--------|-------|----------|------------|
| Imp | 45 | 3.0 | Fireball | 8 | 1.5s | speed=12, color=#ff6600 |
| Demon | 80 | 5.0 | Melee | 2.5 | 0.8s | — |
| Zombieman | 35 | 2.5 | Bullet | 12 | 2.5s | speed=12, color=#88ff44 |

## Weapon Stats
| Weapon | Ammo Type | Chamber/Mag | Reload |
|--------|-----------|-------------|--------|
| Revolver | Bullets | 6 rounds | Manual (R key) |
| Shotgun | Shells | 1 (pump) | Auto |
| Machinegun | Bullets | 70 mag | Manual (R key) |

---

## Mobile Layout
- Left half bottom 70%: movement joystick
- Right half bottom 70%: look joystick  
- Shoot button: right=16px, bottom=72px, 80×80px circle
- USE button: right=24px, bottom=140px, 56×56px circle (above shoot)
- HUD at very bottom, buttons above it

---

## Known Issues (as of 2026-05-28)
- ~~Weapon pullback jitter near walls~~ (fixed with lerping)
- ~~Weapon bobbing jitter (world-space sync)~~ (fixed: restored portal rendering)
- ~~CellType duplicate type error~~ (fixed: import from EditorTypes)
- ~~Edit E1M1 button not working (URL hash)~~ (fixed: localStorage flag)
- ~~Mobile shoot/USE overlapping HUD~~ (fixed in 0cd2f5e)

## Stale Code Warning
- **Enemies.tsx ENEMY_CONFIG is stale** — speeds (1.5/3.0/1.0) and cooldowns (2/1.2/2.5) are NOT used for gameplay. Only used for 3D mesh rendering (body size, head size, colors). Authoritative enemy tuning is in **GameHelpers.ts**: ENEMY_SPEEDS (3.0/5.0/2.5), ENEMY_ATTACK_RANGES (8/2.5/12), ENEMY_ATTACK_COOLDOWNS (1.5/0.8/2.5). Do NOT use Enemies.tsx values for balancing.
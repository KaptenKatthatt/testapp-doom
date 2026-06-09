---
name: add-animated-3d-enemy
description: >-
  Adds a new animated 3D GLB enemy to the Doom clone (React Three Fiber).
  Covers GLB inspection, SkeletonUtils cloning, AnimationMixer state machine,
  scaling/rotation fixes, and registration in types, GameHelpers, Editor, and
  Enemies. Use when adding 3D monsters, GLB/GLTF enemies, skeletal animations,
  or Quaternius-style animated models to testapp-doom.
---

# Add Animated 3D Enemy

Golden reference: `src/game/QuaterniusDemonModel.tsx` + `quaterniusdemon` wiring.

Copy that pattern per monster. Do **not** generalize into a shared abstraction until 2–3 animated enemies exist.

## Model requirements

Prefer game-ready GLB with:

- Skinned mesh (skeleton + skin)
- At minimum: **Idle**, **Run** or **Walk**, **Attack** (Weapon/Punch/Shoot), **Death**
- CC0 or compatible license (Quaternius / Poly Pizza are good sources)
- Named materials (for per-monster tinting)

Avoid static OBJ/FBX without embedded animations.

## Step 0 — Inspect the GLB before coding

Save to `public/models/<enemyid>.glb`, then list clips and materials:

```bash
node -e "
const fs = require('fs');
const buf = fs.readFileSync('public/models/<enemyid>.glb');
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
console.log('animations:', (json.animations || []).map(a => a.name));
console.log('materials:', (json.materials || []).map(m => m.name));
console.log('skins:', (json.skins || []).length);
"
```

Map clips to AI states. Quaternius uses `CharacterArmature|Idle` — lookup must handle both `|Name` suffix and plain `Name`.

## Step 1 — Register enemy type (7 touch points)

Use lowercase id (e.g. `quaterniusdemon`) and a display label in editor.

| File | What to add |
|------|-------------|
| `src/game/types.ts` | `EnemyType` union + `ENEMY_MAX_HEALTH` |
| `src/game/GameHelpers.ts` | `ENEMY_SPEEDS`, `ENEMY_ATTACK_RANGES`, `ENEMY_ATTACK_COOLDOWNS`, `PROJECTILE_COLORS`, `alertSounds`, both `deathSounds` maps |
| `src/editor/EditorTypes.ts` | `CellType`, `CELL_COLORS`, `CELL_LABELS`, `ENTITY_TYPES`, `ENTITY_LIMITS`, `TOOL_GROUPS` |
| `src/editor/Editor.tsx` | Add type to white-text-on-dark button list (grep `quaterniusdemon`) |
| `src/game/Enemies.tsx` | `ENEMY_CONFIG` + live `Enemy` branch + `Corpse` branch |
| `src/game/<Name>Model.tsx` | New dedicated model component |
| `public/models/<enemyid>.glb` | Asset file |

Unless the user asks, do **not** place the enemy on any level map.

## Step 2 — Model component recipe

Create `src/game/<Name>Model.tsx`. Structure:

```
useLoader(GLTFLoader, MODEL_URL)
  → buildInstance(gltf) via useMemo
  → useFrame: animation state machine + mixer.update(delta) + hit flash
  → <group rotation={[0, rotation + Math.PI, 0]}><primitive /></group>
```

### Critical fixes (do not skip)

These caused the first successful import; skipping them produces invisible/tiny/wrong-facing enemies.

1. **`SkeletonUtils.clone`** — one cloned scene per instance; never share the loaded gltf.scene across enemies.
2. **Clone materials per instance** — hit-flash emissive must not leak between instances.
3. **`mesh.frustumCulled = false`** on all skinned meshes — otherwise they disappear mid-animation.
4. **Scale after sampling Idle** — bind-pose `Box3` is wrong on Quaternius-style GLBs (armature scale 100 → ~163 unit height). Before measuring height:
   - play Idle clip, `mixer.update(0)`
   - traverse skinned meshes, `skeleton.update()`, `scene.updateMatrixWorld(true)`
   - then `Box3.setFromObject`, scale to `TARGET_HEIGHT`, offset Y so feet sit at y=0
5. **Rotation `+ Math.PI`** — Quaternius models face +Z; enemy convention points -Z toward player.
6. **Attack timing: `performance.now() / 1000`** — `lastAttack` is set by AI with `performance.now()`, not R3F `state.clock`. Guard with `lastAttack > 0`.
7. **Crossfade** — `fadeIn`/`fadeOut` (~0.18s) between states; `LoopOnce` + `clampWhenFinished` for Death and Attack.

### Animation state machine

```text
dead        → Death (once)
lastAttack  → Attack clip (Weapon/Punch — once, ~0.9s window)
alerted     → Run (loop) — or Walk if no Run
else        → Idle (loop)
```

Collect emissive materials during traverse for red hit-flash (`hitFlash > 0.05`).

### Per-monster tuning constants

- `MODEL_URL` — `/models/<enemyid>.glb`
- `TARGET_HEIGHT` — match `ENEMY_CONFIG.bodyH` in Enemies.tsx
- `MATERIAL_TINTS` — keyed by GLB material names from Step 0
- `ATTACK_ANIM_WINDOW` — tune to attack clip length
- Attack clip name — map to best available (Weapon, Punch, Shoot, etc.)

## Step 3 — Enemies.tsx integration

Live enemy branch:

```tsx
<group position={[position[0], 0, position[2]]}>
  <Suspense fallback={null}>
    <MyModel
      rotation={rotation}
      hitFlash={hitFlash}
      lastAttack={enemy.lastAttack}
      alerted={enemy.hasAlerted}
      dead={false}
    />
  </Suspense>
  <HealthBar ... />
  <EnemyLight ... />
</group>
```

Corpse branch — remount with `dead={true}`, `lastAttack={0}`, `hitFlash={0}`, `alerted={false}` so Death plays from start.

Do **not** apply `rotation` on the outer position group; the model component handles facing.

## Step 4 — Verify visually

Typecheck alone is insufficient. A bad bind-pose scale makes the model a 1-pixel dot with zero errors.

1. Run `npm run check`
2. Place enemy in `#editor`, play map, screenshot
3. Confirm: visible size (~`TARGET_HEIGHT`), faces player, Idle/Run/Attack/Death transitions, hit flash, corpse Death animation
4. Use **headless** Playwright only — never headed automation unless user requests it

Optional scale sanity script (after Idle sample):

```bash
node --input-type=module -e "
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { readFileSync } from 'fs';
const buf = readFileSync('public/models/<enemyid>.glb');
const loader = new GLTFLoader();
loader.parse(buf.buffer, '', (gltf) => {
  const scene = cloneSkeleton(gltf.scene);
  const mixer = new THREE.AnimationMixer(scene);
  const clip = gltf.animations.find(c => c.name.endsWith('|Idle') || c.name === 'Idle');
  if (clip) { mixer.clipAction(clip).play(); mixer.update(0); }
  scene.traverse(o => { if (o.isSkinnedMesh) o.skeleton?.update(); });
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  console.log('idle height:', (box.max.y - box.min.y).toFixed(3));
});
"
```

Expect ~2–3 units before game scaling, not 100+.

## Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| Invisible / tiny dot | Scaled from bind-pose bounds | Sample Idle before Box3 |
| Enemy backwards | +Z model in -Z game | `rotation + Math.PI` |
| Attack anim never plays | Wrong clock or `lastAttack === 0` | `performance.now()`, guard `> 0` |
| Mesh vanishes when moving | Frustum cull on skinned mesh | `frustumCulled = false` |
| Shared hit flash | Shared materials | Clone materials per instance |
| T-pose / no anim | Clip name mismatch | Inspect GLB names; flexible `endsWith('|Name') \|\| === Name` |

## When to generalize

After **2–3** animated enemies with the same pipeline, consider extracting shared `buildSkinnedInstance()` / `AnimatedEnemyModel`. Until then, one file per monster is intentional — per-monster material maps and attack clips differ too much.

## Checklist before done

- [ ] GLB in `public/models/`, animations verified
- [ ] All 7 registration touch points updated
- [ ] Dedicated `*Model.tsx` with all 7 critical fixes
- [ ] Live + Corpse branches in Enemies.tsx
- [ ] `npm run check` passes
- [ ] Visual screenshot confirms size, facing, and animations

# Implementation Plan - Bug Fixes & Refactoring (KaptenKatthatt/testapp-doom)

This plan outlines the changes required to address the weapon wall-clipping bug, resolve the E-key door interaction issue, add Doom-like textures to doors, refactor the largest files, and ensure the `npx fallow` tool checks pass successfully.

## Proposed Changes

### 1. Weapon Wall-Clipping Prevention (Tactical Pullback)

*   **Problem**: The player's weapon mesh extends ~0.9 units in front of the camera. When the player stands close to a wall/door (stopped by the player's 0.4-unit collision margin), the weapon extends into the wall, causing it to clip and disappear.
*   **Solution**:
    *   In `src/Game.tsx`, compute the distance from the player to the nearest wall or door in the look direction using Three.js `Ray` and `Box3` (up to a distance threshold of `1.0` unit).
    *   Determine a `pullback` factor (`0.0` to `1.0`) representing how close the player is to the wall.
    *   Pass the `pullback` factor as a prop to the `Weapons` component.
    *   In `src/Weapons.tsx`, adjust the weapon group's position (move it backward/downward) and tilt it down based on the `pullback` progress. This creates a highly premium "tactical weapon pullback" animation when standing near walls.

### 2. Door Interaction Bug (E Key) & Double-Door static collision fix

*   **Problem**: 
    1. In `src/Game.tsx`, the `useActionRef.current` reference is reset to `false` immediately *before* it is evaluated in the door update loop. This causes doors to never receive the "use action" trigger and therefore they never open when the E key is pressed.
    2. In `src/Level.tsx`, doors were included in `WALL_DATA` and processed into standard static wall meshes and wall collision boxes. When the door opened dynamically, a duplicate static door mesh and static collision box remained in place, preventing players from walking through the doorway.
*   **Solution**: 
    1. Swap the order of these operations in `src/Game.tsx`. Evaluate/store the `useAction` state first to update the doors, and then reset the ref's value to `false`.
    2. Filter out doors from static level meshes and collision blocks in `Level.tsx` using `WALL_DATA.filter((w) => !w.isDoor)`. This leaves doors exclusively managed and dynamically rendered/collided by `Game.tsx`'s dynamic doors loop, allowing passage once opened.

### 3. Door Texture & Emissive Lighting

*   **Problem**: Doors are currently rendered as flat orange blocks without textures, making them look unfinished.
*   **Solution**:
    *   Import `createDoorTexture` from `src/Textures.tsx` in `src/Game.tsx`.
    *   Create and memoize the door texture inside the `Game` component: `const doorTexture = useMemo(() => createDoorTexture(), []);`.
    *   Apply the `doorTexture` as a `map` prop to the door `meshLambertMaterial`.
    *   Keep the distinct color tinting (`color={door.isSecret ? 0x553322 : 0xcc7744}`) to maintain standard vs. secret door differentiation while overlaying the high-quality Doom door texture.

### 4. HUD starting face & Kills font visibility

*   **Problem**: The character's face in the lower status bar and the custom Doom font for values (like Kills, Health, Ammo) only render after the first action (like shooting), because setting `faceImgRef.current` does not trigger re-render on load, and custom fonts are not ready on initial mount.
*   **Solution**:
    *   Change `faceImgRef` to a React state `faceImg`.
    *   Add a listener for `document.fonts.ready` to trigger a state update when the font loads.
    *   Include both `faceImg` and `fontLoaded` in the canvas drawing `useEffect` dependency array, so the HUD renders correctly from the start.

### 5. Starting Player Rotation

*   **Problem**: The player starts the game looking directly into a wall instead of facing the room's main door.
*   **Solution**: Rotate the starting player rotation in `Game.tsx` by 180 degrees (setting `rotation: -Math.PI / 2` instead of `Math.PI / 2`), so they face the door immediately upon start.

### 6. Code Duplication & Export Cleanups (Fallow Errors)

*   **Problem**: `npx fallow` reports errors for:
    1.  Unused files in `e2e/` (cjs files) and `generate-midi.cjs`.
    2.  Unused export `isDoorPassable` in `src/Doors.tsx`.
    3.  Duplicate noise generation code in `src/Textures.tsx` (3 identical loops).
*   **Solution**:
    *   Create a `.fallowrc.json` configuration file in the project root to ignore the `e2e/*.cjs` and `generate-midi.cjs` development scripts under `ignorePatterns`.
    *   Remove the `export` keyword from `isDoorPassable` in `src/Doors.tsx` since it is only used internally in that file.
    *   Extract the duplicate canvas noise generation loops in `src/Textures.tsx` into a reusable `addNoise(ctx, count, maxOpacity)` helper function.

### 7. Code Refactoring (Reducing Large Files & Complexity)

*   **Problem**: `src/Game.tsx` is very large (758 lines) and contains high cognitive complexity, especially in the `useFrame` main loop.
*   **Solution**:
    *   Decompose the massive `useFrame` callback in `src/Game.tsx` by extracting independent logic blocks into separate helper functions or dedicated files:
        *   Extract projectile updating logic to `updateProjectiles` helper.
        *   Extract pickup collection logic to `updatePickups` helper.
        *   Extract nukage/slime damage logic to `updateNukageDamage` helper.
    *   This will significantly reduce the LOC of `src/Game.tsx` and improve health/complexity scores as required by the user.

---

## Verification Plan

### Automated Tests
*   Run `powershell -ExecutionPolicy Bypass -Command "npx fallow"` to confirm 100% compliance and that the command exits successfully with code 0.
*   Run `npm run typecheck` to verify TypeScript builds successfully.

### Manual Verification
*   Start the development server (`npm run dev`) and test the following in the browser:
    1.  **Weapon pullback**: Stand face-to-face with a wall or door; verify the gun slides back and tilts downward naturally instead of clipping.
    2.  **Door E-key opening**: Approach the door at the end of the start room, press **E**, and confirm the opening sound plays and the door slides upwards.
    3.  **Door textures**: Verify the doors have a detailed, retro-style Doom door texture (replete with paneling, handles, and keyholes) instead of a solid orange block.

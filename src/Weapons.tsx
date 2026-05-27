import { useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

interface WeaponsProps {
  readonly shooting: boolean;
  readonly lastShot: number;
  readonly isMoving: boolean;
  readonly pullbackRef: React.MutableRefObject<number>;
  readonly currentWeapon: "revolver" | "shotgun" | "machinegun";
  readonly revolverReloading: boolean;
  readonly machinegunReloading: boolean;
}

export default function Weapons({
  shooting,
  lastShot,
  isMoving,
  pullbackRef,
  currentWeapon,
  revolverReloading,
  machinegunReloading,
}: WeaponsProps): React.JSX.Element {
  const { camera } = useThree();

  // Weapon Group Refs (FPS container positioning)
  const gunGroupRef = useRef<THREE.Group>(null);

  // Muzzle Flash Refs
  const shotgunMuzzleRef = useRef<THREE.Mesh>(null);
  const shotgunMuzzleRingRef = useRef<THREE.Mesh>(null);
  const revolverMuzzleRef = useRef<THREE.Mesh>(null);
  const revolverMuzzleRingRef = useRef<THREE.Mesh>(null);
  const machinegunMuzzleRef = useRef<THREE.Mesh>(null);
  const machinegunMuzzleRingRef = useRef<THREE.Mesh>(null);

  // Animation values
  const recoilRef = useRef(0);
  const prevShootingRef = useRef(false);

  // Loaded 3D Models
  const [revolverGroup, setRevolverGroup] = useState<THREE.Group | null>(null);
  const [dp28Group, setDp28Group] = useState<THREE.Group | null>(null);

  // Submesh Refs for animations
  const cylinderRef = useRef<THREE.Object3D | null>(null);
  const panMagRef = useRef<THREE.Object3D | null>(null);
  const boltRef = useRef<THREE.Object3D | null>(null);

  // Cylinder/Pan Mag rotation trackers
  const targetCylinderRot = useRef(0);
  const currentCylinderRot = useRef(0);
  const targetMagRot = useRef(0);
  const currentMagRot = useRef(0);

  // Reload progress animation variables
  const reloadElapsed = useRef(0);

  // Load Models and apply textures
  useEffect(() => {
    const texLoader = new THREE.TextureLoader();

    // 1. Load Revolver Textures
    const revMetal1Color = texLoader.load("/models/textures/revolver_metal1_color.jpg");
    const revMetal1Normal = texLoader.load("/models/textures/revolver_metal1_normal.jpg");
    const revMetal1Rough = texLoader.load("/models/textures/revolver_metal1_roughness.jpg");

    const revMetal2Color = texLoader.load("/models/textures/revolver_metal2_color.jpg");
    const revMetal2Normal = texLoader.load("/models/textures/revolver_metal2_normal.jpg");
    const revMetal2Rough = texLoader.load("/models/textures/revolver_metal2_roughness.jpg");

    const revMetal3Color = texLoader.load("/models/textures/revolver_metal3_color.jpg");
    const revMetal3Normal = texLoader.load("/models/textures/revolver_metal3_normal.jpg");
    const revMetal3Rough = texLoader.load("/models/textures/revolver_metal3_roughness.jpg");

    const revWoodColor = texLoader.load("/models/textures/revolver_wood_color.jpg");
    const revWoodNormal = texLoader.load("/models/textures/revolver_wood_normal.jpg");
    const revWoodRough = texLoader.load("/models/textures/revolver_wood_roughness.jpg");

    // 2. Load DP-28 Textures
    const dp28Albedo = texLoader.load("/models/textures/dp28_albedo.jpg");
    const dp28Ao = texLoader.load("/models/textures/dp28_ao.jpg");
    const dp28Metal = texLoader.load("/models/textures/dp28_metalness.jpg");
    const dp28Normal = texLoader.load("/models/textures/dp28_normal.jpg");
    const dp28Rough = texLoader.load("/models/textures/dp28_roughness.jpg");

    // Fix texture orientations standard for FBX/GLTF
    [
      revMetal1Color, revMetal1Normal, revMetal1Rough,
      revMetal2Color, revMetal2Normal, revMetal2Rough,
      revMetal3Color, revMetal3Normal, revMetal3Rough,
      revWoodColor, revWoodNormal, revWoodRough,
      dp28Albedo, dp28Ao, dp28Metal, dp28Normal, dp28Rough,
    ].forEach((t) => {
      t.flipY = false;
      t.colorSpace = THREE.SRGBColorSpace;
    });

    const fbxLoader = new FBXLoader();

    // 3. Load Revolver Model
    fbxLoader.load(
      "/models/revolver.fbx",
      (fbx) => {
        fbx.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const name = mesh.name.toLowerCase();

            // Find rotating Cylinder
            if (name.includes("cylinder") || name.includes("drum")) {
              cylinderRef.current = mesh;
            }

            // Apply specific PBR materials to mesh parts
            if (name.includes("wood") || name.includes("grip") || name.includes("handle")) {
              mesh.material = new THREE.MeshStandardMaterial({
                map: revWoodColor,
                normalMap: revWoodNormal,
                roughnessMap: revWoodRough,
                emissive: 0xffffff,
                emissiveMap: revWoodColor,
                emissiveIntensity: 0.55, // brighten wood grip
                roughness: 0.75,
                metalness: 0.1,
              });
            } else if (name.includes("cylinder") || name.includes("drum") || name.includes("bullet")) {
              // Shiny polished steel
              mesh.material = new THREE.MeshStandardMaterial({
                map: revMetal2Color,
                normalMap: revMetal2Normal,
                roughnessMap: revMetal2Rough,
                emissive: 0xffffff,
                emissiveMap: revMetal2Color,
                emissiveIntensity: 0.45, // brighten cylinder
                metalness: 0.95,
                roughness: 0.12,
              });
            } else if (name.includes("barrel") || name.includes("trigger") || name.includes("hammer")) {
              // Dark metal
              mesh.material = new THREE.MeshStandardMaterial({
                map: revMetal3Color,
                normalMap: revMetal3Normal,
                roughnessMap: revMetal3Rough,
                emissive: 0xffffff,
                emissiveMap: revMetal3Color,
                emissiveIntensity: 0.45, // brighten barrel/parts
                metalness: 0.85,
                roughness: 0.28,
              });
            } else {
              // Default frame metal
              mesh.material = new THREE.MeshStandardMaterial({
                map: revMetal1Color,
                normalMap: revMetal1Normal,
                roughnessMap: revMetal1Rough,
                emissive: 0xffffff,
                emissiveMap: revMetal1Color,
                emissiveIntensity: 0.45, // brighten frame
                metalness: 0.88,
                roughness: 0.22,
              });
            }
          }
        });

        // Set scaling and orient pointing forward (only modify Y rotation to keep loader's X/Z Z-up conversion)
        fbx.scale.set(0.038, 0.038, 0.038);
        fbx.rotation.y = Math.PI * 1.5; 
        setRevolverGroup(fbx);
      },
      undefined,
      (err) => console.error("Error loading revolver FBX:", err)
    );

    // 4. Load DP-28 Model
    fbxLoader.load(
      "/models/dp28.fbx",
      (fbx) => {
        fbx.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const name = mesh.name.toLowerCase();

            // Locate rotating magazine disc or bolt slider
            if (name.includes("mag") || name.includes("drum")) {
              panMagRef.current = mesh;
            }
            if (name.includes("bolt") || name.includes("slide") || name.includes("zatvor")) {
              boltRef.current = mesh;
            }

            mesh.material = new THREE.MeshStandardMaterial({
              map: dp28Albedo,
              aoMap: dp28Ao,
              metalnessMap: dp28Metal,
              normalMap: dp28Normal,
              roughnessMap: dp28Rough,
              emissive: 0xffffff,
              emissiveMap: dp28Albedo,
              emissiveIntensity: 0.52, // brighten machinegun
              metalness: 0.85,
              roughness: 0.32,
            });
          }
        });

        // Scale up DP-28 and orient pointing forward (only modify Y rotation to keep loader's X/Z Z-up conversion)
        fbx.scale.set(0.024, 0.024, 0.024);
        fbx.rotation.y = Math.PI; 
        setDp28Group(fbx);
      },
      undefined,
      (err) => console.error("Error loading DP28 FBX:", err)
    );
  }, []);

  // Frame processing loop for FPS movement bobbing, sway, recoil, reload and custom rotations
  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05);

    // 1. Trigger recoil
    if (shooting && !prevShootingRef.current) {
      recoilRef.current = 0.5;

      // Increment rotation target for firing effects
      if (currentWeapon === "revolver") {
        targetCylinderRot.current += Math.PI / 3; // 60 deg rotation per chamber shot
      } else if (currentWeapon === "machinegun") {
        targetMagRot.current += 0.08; // small magazine rotation per shot
      }
    }
    prevShootingRef.current = shooting;

    // Decay recoil
    if (recoilRef.current > 0) {
      recoilRef.current = Math.max(0, recoilRef.current - dt * 5.0);
    }

    const recoil = recoilRef.current;

    // 2. Walking bobbing & sway (only when moving)
    const time = performance.now() / 1000;
    const bobFreq = 6.0;
    const sway = isMoving ? Math.sin(time * bobFreq) * 0.004 : 0;
    const bob = isMoving ? Math.abs(Math.sin(time * bobFreq)) * 0.008 : 0;
    const pullback = pullbackRef?.current ?? 0;

    // 3. Cylinder / Mag continuous spin animations
    if (cylinderRef.current) {
      if (revolverReloading) {
        // Rapid spinning during reload
        currentCylinderRot.current += dt * 10;
        cylinderRef.current.rotation.y = currentCylinderRot.current;
        // Swing cylinder out on reload (locally on X-axis, proportional to new scale)
        cylinderRef.current.position.x = THREE.MathUtils.lerp(cylinderRef.current.position.x, -0.35, dt * 10);
      } else {
        // Reset cylinder swing out
        cylinderRef.current.position.x = THREE.MathUtils.lerp(cylinderRef.current.position.x, 0, dt * 10);
        // Interpolate cylinder to fired target chamber position
        currentCylinderRot.current = THREE.MathUtils.lerp(currentCylinderRot.current, targetCylinderRot.current, dt * 15);
        cylinderRef.current.rotation.y = currentCylinderRot.current;
      }
    }

    if (panMagRef.current) {
      if (machinegunReloading) {
        // Magazine detach / attach animation (proportional to new scale)
        reloadElapsed.current += dt;
        const progress = reloadElapsed.current; // Max reload time is 2.0s

        if (progress < 0.6) {
          // 0.0s - 0.6s: Pan mag lifted up and off the weapon
          panMagRef.current.position.y = THREE.MathUtils.lerp(panMagRef.current.position.y, 11.0, dt * 8);
          panMagRef.current.position.z = THREE.MathUtils.lerp(panMagRef.current.position.z, 5.0, dt * 8);
        } else if (progress < 1.4) {
          // 0.6s - 1.4s: Magazine completely out of sight (beneath the player camera)
          panMagRef.current.position.y = THREE.MathUtils.lerp(panMagRef.current.position.y, -20.0, dt * 12);
        } else {
          // 1.4s - 2.0s: New magazine brought up, aligned, and snapped down on top
          panMagRef.current.position.y = THREE.MathUtils.lerp(panMagRef.current.position.y, 2.8, dt * 10);
          panMagRef.current.position.z = THREE.MathUtils.lerp(panMagRef.current.position.z, 0, dt * 10);
        }
      } else {
        // Normal state: mag resting on top of the barrel, rotating when firing
        reloadElapsed.current = 0;
        panMagRef.current.position.set(0, 2.8, 0); // original local coordinate position
        currentMagRot.current = THREE.MathUtils.lerp(currentMagRot.current, targetMagRot.current, dt * 10);
        panMagRef.current.rotation.y = currentMagRot.current;
      }
    }

    // Bolt pull back animation on machine gun firing
    if (boltRef.current) {
      if (shooting && currentWeapon === "machinegun" && !machinegunReloading) {
        boltRef.current.position.z = -2.0; // recoil bolt position (proportional to new scale)
      } else {
        boltRef.current.position.z = THREE.MathUtils.lerp(boltRef.current.position.z, 0, dt * 15); // snap back forward
      }
    }

    // 4. Position and Orient active weapon group following player camera
    const gunGroup = gunGroupRef.current;
    if (gunGroup) {
      // Offset calculation depending on selected weapon to make them look beautifully placed
      let offset = new THREE.Vector3();
      let rotX = 0, rotY = 0, rotZ = 0;

      if (currentWeapon === "revolver") {
        // Revolver: placed neatly at waist height on the right, pointing forward
        offset.set(
          0.16 + sway - pullback * 0.05,
          -0.40 + bob - recoil * 0.08 - (revolverReloading ? 0.15 : 0) - pullback * 0.15,
          -0.50 + recoil * 0.12 + pullback * 0.2
        );
        rotX = 0.02 + recoil * 0.12 - (revolverReloading ? 0.6 : 0) - pullback * 0.4;
        rotY = 0.02 + sway * 0.2 - (revolverReloading ? 0.2 : 0) - pullback * 0.1;
        rotZ = -0.03 + recoil * -0.04 + pullback * 0.08;
      } else if (currentWeapon === "shotgun") {
        // Shotgun: heavy long receiver, over-under layout
        offset.set(
          0.22 + sway - pullback * 0.08,
          -0.22 + bob - recoil * 0.08 - pullback * 0.25,
          -0.45 + recoil * 0.12 + pullback * 0.35
        );
        rotX = -0.04 + recoil * 0.12 - pullback * 0.6;
        rotY = 0.015 + sway * 0.3 - pullback * 0.2;
        rotZ = -0.06 + recoil * -0.08 + pullback * 0.15;
      } else if (currentWeapon === "machinegun") {
        // DP-28 Machine Gun: placed at waist height, centered more, pointing forward
        offset.set(
          0.08 + sway - pullback * 0.05,
          -0.55 + bob - recoil * 0.04 - (machinegunReloading ? 0.25 : 0) - pullback * 0.15,
          -0.65 + recoil * 0.08 + pullback * 0.2
        );
        rotX = 0.03 + recoil * 0.06 - (machinegunReloading ? 0.5 : 0) - pullback * 0.4;
        rotY = 0.01 + sway * 0.2 - pullback * 0.1;
        rotZ = -0.02 + recoil * -0.02 + pullback * 0.06;
      }

      offset.applyQuaternion(camera.quaternion);
      gunGroup.position.copy(camera.position).add(offset);
      gunGroup.quaternion.copy(camera.quaternion);
      gunGroup.rotateX(rotX);
      gunGroup.rotateY(rotY);
      gunGroup.rotateZ(rotZ);
    }

    // 5. Muzzle Flash trigger timing (only visible for 70ms post-shot)
    const nowSec = performance.now() / 1000;
    const timeSinceShot = nowSec - lastShot;
    const flashVisible = timeSinceShot >= 0 && timeSinceShot < 0.07;

    // Reset all muzzle flashes
    if (shotgunMuzzleRef.current) shotgunMuzzleRef.current.visible = false;
    if (shotgunMuzzleRingRef.current) shotgunMuzzleRingRef.current.visible = false;
    if (revolverMuzzleRef.current) revolverMuzzleRef.current.visible = false;
    if (revolverMuzzleRingRef.current) revolverMuzzleRingRef.current.visible = false;
    if (machinegunMuzzleRef.current) machinegunMuzzleRef.current.visible = false;
    if (machinegunMuzzleRingRef.current) machinegunMuzzleRingRef.current.visible = false;

    if (flashVisible) {
      if (currentWeapon === "shotgun") {
        if (shotgunMuzzleRef.current) shotgunMuzzleRef.current.visible = true;
        if (shotgunMuzzleRingRef.current) shotgunMuzzleRingRef.current.visible = true;
      } else if (currentWeapon === "revolver") {
        if (revolverMuzzleRef.current) revolverMuzzleRef.current.visible = true;
        if (revolverMuzzleRingRef.current) revolverMuzzleRingRef.current.visible = true;
      } else if (currentWeapon === "machinegun") {
        if (machinegunMuzzleRef.current) machinegunMuzzleRef.current.visible = true;
        if (machinegunMuzzleRingRef.current) machinegunMuzzleRingRef.current.visible = true;
      }
    }
  });

  return (
    <>
      <group ref={gunGroupRef}>
        {/* --- FPS REVOLVER MODEL --- */}
        {currentWeapon === "revolver" && revolverGroup && (
          <group>
            <primitive object={revolverGroup} />

            {/* Muzzle flash sphere in accurate world coordinates */}
            <mesh ref={revolverMuzzleRef} position={[0.16, -0.4, -1.0]} visible={false}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial color={0xffcc00} transparent opacity={0.95} />
            </mesh>

            {/* Muzzle flash glow ring */}
            <mesh
              ref={revolverMuzzleRingRef}
              position={[0.16, -0.4, -1.0]}
              rotation={[0, 0, 0]}
              visible={false}
            >
              <ringGeometry args={[0.025, 0.08, 8]} />
              <meshBasicMaterial color={0xff6600} transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}

        {/* --- FPS PROCEDURAL SHOTGUN (LEGACY RENDER) --- */}
        {currentWeapon === "shotgun" && (
          <>
            {/* Main receiver/body */}
            <mesh>
              <boxGeometry args={[0.07, 0.06, 0.35]} />
              <meshBasicMaterial color={0x555555} />
            </mesh>

            {/* Barrel - lower */}
            <mesh position={[0, 0.01, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.018, 0.022, 0.28, 8]} />
              <meshBasicMaterial color={0x333333} />
            </mesh>

            {/* Second barrel (over-under) */}
            <mesh position={[0, 0.04, -0.25]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.015, 0.018, 0.24, 8]} />
              <meshBasicMaterial color={0x2a2a2a} />
            </mesh>

            {/* Magazine tube below */}
            <mesh position={[0, -0.025, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.016, 0.016, 0.2, 8]} />
              <meshBasicMaterial color={0x444444} />
            </mesh>

            {/* Pump/forend */}
            <mesh position={[0, -0.01, -0.12]}>
              <boxGeometry args={[0.045, 0.045, 0.1]} />
              <meshBasicMaterial color={0x8b5a2b} />
            </mesh>

            {/* Stock */}
            <mesh position={[0, -0.01, 0.15]}>
              <boxGeometry args={[0.05, 0.055, 0.18]} />
              <meshBasicMaterial color={0x7a4b2a} />
            </mesh>

            {/* Stock butt */}
            <mesh position={[0, -0.01, 0.27]}>
              <boxGeometry args={[0.05, 0.07, 0.04]} />
              <meshBasicMaterial color={0x6b3e20} />
            </mesh>

            {/* Grip */}
            <mesh position={[0, -0.05, 0.06]} rotation={[0.2, 0, 0]}>
              <boxGeometry args={[0.035, 0.06, 0.03]} />
              <meshBasicMaterial color={0x7a4b2a} />
            </mesh>

            {/* Trigger guard */}
            <mesh position={[0, -0.04, 0.02]}>
              <boxGeometry args={[0.02, 0.025, 0.04]} />
              <meshBasicMaterial color={0x444444} />
            </mesh>

            {/* Ejection port */}
            <mesh position={[0.02, 0.035, 0.05]}>
              <boxGeometry args={[0.015, 0.01, 0.05]} />
              <meshBasicMaterial color={0x666666} />
            </mesh>

            {/* Muzzle brake */}
            <mesh position={[0, 0.025, -0.42]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.024, 0.024, 0.02, 8]} />
              <meshBasicMaterial color={0x222222} />
            </mesh>

            {/* Muzzle flash sphere */}
            <mesh ref={shotgunMuzzleRef} position={[0, 0.025, -0.45]} visible={false}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshBasicMaterial color={0xffcc00} transparent opacity={0.95} />
            </mesh>

            {/* Muzzle flash glow ring */}
            <mesh
              ref={shotgunMuzzleRingRef}
              position={[0, 0.025, -0.45]}
              rotation={[0, 0, 0]}
              visible={false}
            >
              <ringGeometry args={[0.03, 0.08, 8]} />
              <meshBasicMaterial color={0xff6600} transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
          </>
        )}

        {/* --- FPS MACHINE GUN (DP-28) MODEL --- */}
        {currentWeapon === "machinegun" && dp28Group && (
          <group>
            <primitive object={dp28Group} />

            {/* Muzzle flash sphere in accurate world coordinates */}
            <mesh ref={machinegunMuzzleRef} position={[0.08, -0.55, -1.3]} visible={false}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color={0xffcc00} transparent opacity={0.95} />
            </mesh>

            {/* Muzzle flash glow ring */}
            <mesh
              ref={machinegunMuzzleRingRef}
              position={[0.08, -0.55, -1.3]}
              rotation={[0, 0, 0]}
              visible={false}
            >
              <ringGeometry args={[0.04, 0.15, 8]} />
              <meshBasicMaterial color={0xff6600} transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}
      </group>
    </>
  );
}
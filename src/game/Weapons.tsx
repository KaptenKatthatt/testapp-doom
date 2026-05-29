import { useRef, useEffect } from "react";
import { useFrame, useThree, createPortal } from "@react-three/fiber";
import * as THREE from "three";

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
  const { camera, scene } = useThree();

  // Ensure the camera is added to the scene graph so that portal-rendered weapon models are rendered
  useEffect(() => {
    scene.add(camera);
  }, [scene, camera]);

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

  // Submesh Refs for animations
  const cylinderRef = useRef<THREE.Group>(null);
  const panMagRef = useRef<THREE.Group>(null);
  const boltRef = useRef<THREE.Mesh>(null);

  // Cylinder/Pan Mag rotation trackers
  const targetCylinderRot = useRef(0);
  const currentCylinderRot = useRef(0);
  const targetMagRot = useRef(0);
  const currentMagRot = useRef(0);

  // Reload progress animation variables
  const reloadElapsed = useRef(0);

  // Bobbing weight for smoothing out motion
  const bobWeightRef = useRef(0);

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

    // 2. Walking bobbing & sway (smoothly lerped to filter any rapid key/physics stuttering)
    bobWeightRef.current = THREE.MathUtils.lerp(
      bobWeightRef.current,
      isMoving ? 1.0 : 0.0,
      dt * 10.0
    );
    const time = _state.clock.getElapsedTime();
    const bobFreq = 2.4; // smooth, heavy, and natural walking pace
    const sway = Math.sin(time * bobFreq) * 0.004 * bobWeightRef.current;
    const bob = Math.abs(Math.sin(time * bobFreq)) * 0.008 * bobWeightRef.current;
    const pullback = pullbackRef?.current ?? 0;

    // 3. Cylinder / Mag continuous spin animations
    if (cylinderRef.current) {
      if (revolverReloading) {
        // Rapid spinning during reload
        currentCylinderRot.current += dt * 10;
        cylinderRef.current.rotation.z = currentCylinderRot.current;
        // Swing cylinder out on reload (locally on X-axis, proportional to new procedural scale)
        cylinderRef.current.position.x = THREE.MathUtils.lerp(cylinderRef.current.position.x, -0.015, dt * 10);
      } else {
        // Reset cylinder swing out
        cylinderRef.current.position.x = THREE.MathUtils.lerp(cylinderRef.current.position.x, 0, dt * 10);
        // Interpolate cylinder to fired target chamber position
        currentCylinderRot.current = THREE.MathUtils.lerp(currentCylinderRot.current, targetCylinderRot.current, dt * 15);
        cylinderRef.current.rotation.z = currentCylinderRot.current;
      }
    }

    if (panMagRef.current) {
      if (machinegunReloading) {
        // Magazine detach / attach animation (recalibrated for bottom banana magazine)
        reloadElapsed.current += dt;
        const progress = reloadElapsed.current; // Max reload time is 2.0s

        if (progress < 0.6) {
          // 0.0s - 0.6s: Mag pulled down and out of receiver
          panMagRef.current.position.y = THREE.MathUtils.lerp(panMagRef.current.position.y, -0.22, dt * 8);
          panMagRef.current.position.z = THREE.MathUtils.lerp(panMagRef.current.position.z, -0.02, dt * 8);
        } else if (progress < 1.4) {
          // 0.6s - 1.4s: Magazine completely out of sight (beneath the player camera)
          panMagRef.current.position.y = THREE.MathUtils.lerp(panMagRef.current.position.y, -0.50, dt * 12);
        } else {
          // 1.4s - 2.0s: New magazine brought up and snapped back in
          panMagRef.current.position.y = THREE.MathUtils.lerp(panMagRef.current.position.y, -0.06, dt * 10);
          panMagRef.current.position.z = THREE.MathUtils.lerp(panMagRef.current.position.z, -0.05, dt * 10);
        }
      } else {
        // Normal state: mag resting inside receiver at the bottom
        reloadElapsed.current = 0;
        panMagRef.current.position.set(0, -0.06, -0.05); // baseline bottom mag position
        currentMagRot.current = THREE.MathUtils.lerp(currentMagRot.current, targetMagRot.current, dt * 10);
        panMagRef.current.rotation.y = currentMagRot.current;
      }
    }

    // Bolt pull back animation on machine gun firing
    if (boltRef.current) {
      if (shooting && currentWeapon === "machinegun" && !machinegunReloading) {
        boltRef.current.position.z = -0.02; // recoil bolt position relative to its baseline
      } else {
        boltRef.current.position.z = THREE.MathUtils.lerp(boltRef.current.position.z, 0.02, dt * 15); // snap back forward
      }
    }

    // 4. Position and Orient active weapon group following player camera
    const gunGroup = gunGroupRef.current;
    if (gunGroup) {
      // Offset calculation depending on selected weapon to make them look beautifully placed
      const offset = new THREE.Vector3();
      let rotX = 0, rotY = 0, rotZ = 0;

      if (currentWeapon === "revolver") {
        // Revolver: placed neatly at waist height on the right, pointing forward
        offset.set(
          0.18 + sway - pullback * 0.05,
          -0.24 + bob - recoil * 0.08 - (revolverReloading ? 0.10 : 0) - pullback * 0.15,
          -0.45 + recoil * 0.12 + pullback * 0.2
        );
        rotX = 0.02 + recoil * 0.12 - (revolverReloading ? 0.6 : 0) - pullback * 0.4;
        rotY = 0.025 + sway * 0.2 - (revolverReloading ? 0.2 : 0) - pullback * 0.1;
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
        // DP-28 Machine Gun: placed on the right (like shotgun), pointing diagonally towards the center
        offset.set(
          0.22 + sway - pullback * 0.08,
          -0.28 + bob - recoil * 0.06 - (machinegunReloading ? 0.25 : 0) - pullback * 0.22,
          -0.50 + recoil * 0.10 + pullback * 0.3
        );
        rotX = 0.02 + recoil * 0.12 - (machinegunReloading ? 0.6 : 0) - pullback * 0.5;
        rotY = 0.025 + sway * 0.3 - pullback * 0.2;
        rotZ = -0.06 + recoil * -0.08 + pullback * 0.15;
      }

      // Since gunGroup is portal-rendered inside the camera, its coordinate space is relative to camera.
      // Thus, we copy the local offsets and rotations directly to gunGroup local properties.
      gunGroup.position.copy(offset);
      gunGroup.rotation.set(rotX, rotY, rotZ);
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

  return createPortal(
    <group ref={gunGroupRef}>
      {/* --- FPS PROCEDURAL REVOLVER (STYLIZED RETRO RENDER) --- */}
      {currentWeapon === "revolver" && (
        <group>
          {/* Wooden Grip/Handle */}
          <mesh position={[-0.01, -0.12, 0.06]} rotation={[0.4, 0, 0]}>
            <boxGeometry args={[0.045, 0.12, 0.05]} />
            <meshStandardMaterial color={0x8b5a2b} emissive={0x8b5a2b} emissiveIntensity={0.25} roughness={0.7} />
          </mesh>

          {/* Main Metal Frame/Receiver */}
          <mesh position={[0, -0.01, 0.0]}>
            <boxGeometry args={[0.048, 0.07, 0.22]} />
            <meshStandardMaterial color={0x444444} emissive={0x444444} emissiveIntensity={0.25} metalness={0.85} roughness={0.25} />
          </mesh>

          {/* Trigger Guard */}
          <mesh position={[0, -0.06, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.04, 8, 1, true]} />
            <meshStandardMaterial color={0x333333} emissive={0x333333} emissiveIntensity={0.3} metalness={0.8} />
          </mesh>

          {/* Trigger */}
          <mesh position={[0, -0.05, -0.015]} rotation={[-0.2, 0, 0]}>
            <boxGeometry args={[0.008, 0.025, 0.008]} />
            <meshStandardMaterial color={0x222222} emissive={0x222222} emissiveIntensity={0.3} metalness={0.9} />
          </mesh>

          {/* Rotating Cylinder (Chamber) */}
          <group ref={cylinderRef} position={[0, 0.005, -0.02]}>
            {/* Central Cylinder Body */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.09, 12]} />
              <meshStandardMaterial color={0x666666} emissive={0x666666} emissiveIntensity={0.2} metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Six Bullet Chambers (embedded dark cylinders representing loaded chambers) */}
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const angle = (i * Math.PI) / 3;
              const radius = 0.016;
              const cx = Math.cos(angle) * radius;
              const cy = Math.sin(angle) * radius;
              return (
                <mesh key={i} position={[cx, cy, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.007, 0.007, 0.092, 6]} />
                  <meshStandardMaterial color={0x222222} emissive={0x222222} emissiveIntensity={0.35} metalness={0.9} roughness={0.8} />
                </mesh>
              );
            })}
          </group>

          {/* Gun Hammer */}
          <mesh position={[0, 0.045, 0.09]} rotation={[-0.4, 0, 0]}>
            <boxGeometry args={[0.01, 0.035, 0.012]} />
            <meshStandardMaterial color={0x222222} emissive={0x222222} emissiveIntensity={0.3} metalness={0.9} />
          </mesh>

          {/* Long Hexagonal Barrel */}
          <mesh position={[0, 0.02, -0.22]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.22, 6]} />
            <meshStandardMaterial color={0x333333} emissive={0x333333} emissiveIntensity={0.25} metalness={0.85} roughness={0.3} />
          </mesh>

          {/* Front Sight Post */}
          <mesh position={[0, 0.04, -0.31]}>
            <boxGeometry args={[0.006, 0.015, 0.02]} />
            <meshStandardMaterial color={0x222222} emissive={0x222222} emissiveIntensity={0.3} metalness={0.9} />
          </mesh>

          {/* Muzzle Flash relative to new barrel tip */}
          <mesh ref={revolverMuzzleRef} position={[0, 0.02, -0.34]} visible={false}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color={0xffcc00} transparent opacity={0.95} />
          </mesh>

          {/* Muzzle flash glow ring */}
          <mesh
            ref={revolverMuzzleRingRef}
            position={[0, 0.02, -0.34]}
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

      {/* --- FPS PROCEDURAL TACTICAL MACHINE GUN (MODERN RENDER) --- */}
      {currentWeapon === "machinegun" && (
        <group>
          {/* Main Receiver/Body */}
          <mesh position={[0, 0, -0.05]}>
            <boxGeometry args={[0.05, 0.055, 0.35]} />
            <meshStandardMaterial color={0x333333} emissive={0x333333} emissiveIntensity={0.25} metalness={0.8} roughness={0.3} />
          </mesh>

          {/* Tactical Shroud / Handguard */}
          <mesh position={[0, 0.005, -0.22]}>
            <boxGeometry args={[0.046, 0.05, 0.16]} />
            <meshStandardMaterial color={0x222222} emissive={0x222222} emissiveIntensity={0.3} metalness={0.7} roughness={0.5} />
          </mesh>
          {/* Handguard grip ridges */}
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[0, -0.022, -0.28 + i * 0.04]}>
              <boxGeometry args={[0.035, 0.006, 0.012]} />
              <meshStandardMaterial color={0x111111} emissive={0x111111} emissiveIntensity={0.3} />
            </mesh>
          ))}

          {/* Modern Tactical Stock */}
          <mesh position={[0, -0.015, 0.20]} rotation={[-0.05, 0, 0]}>
            <boxGeometry args={[0.038, 0.045, 0.16]} />
            <meshStandardMaterial color={0x2a2a2a} emissive={0x2a2a2a} emissiveIntensity={0.25} roughness={0.6} />
          </mesh>
          {/* Buttstock pad */}
          <mesh position={[0, -0.018, 0.28]}>
            <boxGeometry args={[0.04, 0.06, 0.016]} />
            <meshStandardMaterial color={0x1a1a1a} emissive={0x1a1a1a} emissiveIntensity={0.3} roughness={0.8} />
          </mesh>

          {/* Tactical Pistol Grip */}
          <mesh position={[0, -0.06, 0.10]} rotation={[0.35, 0, 0]}>
            <boxGeometry args={[0.028, 0.06, 0.03]} />
            <meshStandardMaterial color={0x222222} emissive={0x222222} emissiveIntensity={0.3} roughness={0.7} />
          </mesh>

          {/* Trigger Guard */}
          <mesh position={[0, -0.042, 0.055]}>
            <boxGeometry args={[0.014, 0.022, 0.04]} />
            <meshStandardMaterial color={0x1a1a1a} emissive={0x1a1a1a} emissiveIntensity={0.3} metalness={0.8} />
          </mesh>

          {/* Modern Bottom Curved Magazine (Banana Mag) */}
          <group ref={panMagRef} position={[0, -0.06, -0.05]}>
            {/* Main curved banana box */}
            <mesh rotation={[0.2, 0, 0]}>
              <boxGeometry args={[0.026, 0.12, 0.045]} />
              <meshStandardMaterial color={0x222222} emissive={0x222222} emissiveIntensity={0.3} roughness={0.7} />
            </mesh>
            {/* Magazine reinforcement ridges */}
            {[0, 1, 2].map((i) => (
              <mesh key={i} position={[0, -0.04 + i * 0.03, 0.005]}>
                <boxGeometry args={[0.03, 0.006, 0.04]} />
                <meshStandardMaterial color={0x111111} emissive={0x111111} emissiveIntensity={0.3} />
              </mesh>
            ))}
          </group>

          {/* Recoiling Bolt Slider */}
          <mesh ref={boltRef} position={[0.027, 0.008, 0.02]}>
            <boxGeometry args={[0.008, 0.012, 0.03]} />
            <meshStandardMaterial color={0xdddddd} emissive={0xdddddd} emissiveIntensity={0.2} metalness={0.95} roughness={0.1} />
          </mesh>

          {/* Tactical Steel Barrel */}
          <mesh position={[0, 0.01, -0.36]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.24, 8]} />
            <meshStandardMaterial color={0x1a1a1a} emissive={0x1a1a1a} emissiveIntensity={0.3} metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Tactical Flash Hider */}
          <mesh position={[0, 0.01, -0.49]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.04, 8]} />
            <meshStandardMaterial color={0x222222} emissive={0x222222} emissiveIntensity={0.3} metalness={0.95} />
          </mesh>

          {/* Muzzle Flash relative to new flash hider tip */}
          <mesh ref={machinegunMuzzleRef} position={[0, 0.01, -0.52]} visible={false}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color={0xffcc00} transparent opacity={0.95} />
          </mesh>

          {/* Muzzle flash glow ring */}
          <mesh
            ref={machinegunMuzzleRingRef}
            position={[0, 0.01, -0.52]}
            rotation={[0, 0, 0]}
            visible={false}
          >
            <ringGeometry args={[0.04, 0.15, 8]} />
            <meshBasicMaterial color={0xff6600} transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
      </group>,
    camera
  );
}
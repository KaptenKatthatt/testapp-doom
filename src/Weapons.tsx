import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Group, Mesh } from "three";

interface WeaponsProps {
  readonly shooting: boolean;
  readonly lastShot: number;
  readonly isMoving: boolean;
}

export default function Weapons({ shooting, lastShot, isMoving }: WeaponsProps): React.JSX.Element {
  const gunGroupRef = useRef<Group>(null);
  const muzzleRef = useRef<Mesh>(null);
  const muzzleRingRef = useRef<Mesh>(null);
  const recoilRef = useRef(0);
  const prevShootingRef = useRef(false);
  const { camera } = useThree();

  useFrame(() => {
    // Recoil animation
    if (recoilRef.current > 0) {
      recoilRef.current = Math.max(0, recoilRef.current - 0.15);
    }

    const recoil = recoilRef.current;

    // Walking bob (only when moving)
    const time = performance.now() / 1000;
    const bobFreq = 6; // Slower, more natural walking rhythm
    const sway = isMoving ? Math.sin(time * bobFreq) * 0.004 : 0;
    const bob = isMoving ? Math.abs(Math.sin(time * bobFreq)) * 0.008 : 0;

    // Trigger recoil
    if (shooting && !prevShootingRef.current) {
      recoilRef.current = 0.5;
    }
    prevShootingRef.current = shooting;

    const gunGroup = gunGroupRef.current;
    if (gunGroup) {
      const offset = new THREE.Vector3(
        0.22 + sway,
        -0.22 + bob - recoil * 0.08,
        -0.45 + recoil * 0.12,
      );
      offset.applyQuaternion(camera.quaternion);
      gunGroup.position.copy(camera.position).add(offset);
      gunGroup.quaternion.copy(camera.quaternion);
      gunGroup.rotateX(-0.04 + recoil * 0.12);
      gunGroup.rotateY(0.015 + sway * 0.3);
      gunGroup.rotateZ(-0.06 + recoil * -0.08);
    }

    // Muzzle flash: only visible for 70ms after shot
    const now = performance.now() / 1000;
    const timeSinceShot = now - lastShot;
    const flashVisible = timeSinceShot >= 0 && timeSinceShot < 0.07;
    if (muzzleRef.current) {
      muzzleRef.current.visible = flashVisible;
    }
    if (muzzleRingRef.current) {
      muzzleRingRef.current.visible = flashVisible;
    }
  });

  return (
    <>
      {/* FPS Shotgun - follows camera */}
      <group ref={gunGroupRef}>
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
          <meshBasicMaterial color={0x8B5A2B} />
        </mesh>

        {/* Stock */}
        <mesh position={[0, -0.01, 0.15]}>
          <boxGeometry args={[0.05, 0.055, 0.18]} />
          <meshBasicMaterial color={0x7A4B2A} />
        </mesh>

        {/* Stock butt */}
        <mesh position={[0, -0.01, 0.27]}>
          <boxGeometry args={[0.05, 0.07, 0.04]} />
          <meshBasicMaterial color={0x6B3E20} />
        </mesh>

        {/* Grip */}
        <mesh position={[0, -0.05, 0.06]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.035, 0.06, 0.03]} />
          <meshBasicMaterial color={0x7A4B2A} />
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
        <mesh ref={muzzleRef} position={[0, 0.025, -0.45]} visible={false}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color={0xffcc00} transparent opacity={0.95} />
        </mesh>

        {/* Muzzle flash glow ring */}
        <mesh ref={muzzleRingRef} position={[0, 0.025, -0.45]} rotation={[0, 0, 0]} visible={false}>
          <ringGeometry args={[0.03, 0.08, 8]} />
          <meshBasicMaterial color={0xff6600} transparent opacity={0.6} side={2} />
        </mesh>
      </group>
    </>
  );
}
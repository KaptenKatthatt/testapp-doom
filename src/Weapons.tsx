import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";

interface WeaponsProps {
  readonly shooting: boolean;
  readonly lastShot: number;
}

export default function Weapons({ shooting, lastShot }: WeaponsProps): React.JSX.Element {
  const gunGroupRef = useRef<Group>(null);
  const muzzleRef = useRef<Mesh>(null);
  const recoilRef = useRef(0);
  const prevShootingRef = useRef(false);

  useFrame((state) => {
    if (!gunGroupRef.current) return;

    // Recoil animation
    if (recoilRef.current > 0) {
      recoilRef.current = Math.max(0, recoilRef.current - 0.15);
    }

    const recoil = recoilRef.current;

    // Walking bob - sinusoidal movement like real Doom
    const time = state.clock.getElapsedTime();

    // Horizontal sway (left-right)
    const sway = Math.sin(time * 10) * 0.012;
    // Vertical bob (up-down) - two cycles per step
    const bob = Math.abs(Math.sin(time * 10)) * 0.02;

    // Trigger recoil
    if (shooting && !prevShootingRef.current) {
      recoilRef.current = 0.6;
    }
    prevShootingRef.current = shooting;

    // Shotgun position: right side, held lower
    gunGroupRef.current.position.set(
      0.35 + sway + recoil * 0.04,
      -0.35 + bob - recoil * 0.1,
      -0.55 + recoil * 0.18,
    );

    // Slight rotation during walk
    gunGroupRef.current.rotation.set(
      -0.05 + recoil * 0.15,
      0.02 + sway * 0.5,
      -0.1 + recoil * -0.1,
    );

    // Muzzle flash visibility
    if (muzzleRef.current) {
      const timeSinceShot = state.clock.getElapsedTime() - lastShot;
      muzzleRef.current.visible = timeSinceShot < 0.08;
    }
  });

  return (
    <>
      {/* FPS Shotgun */}
      <group ref={gunGroupRef}>
        {/* Main receiver/body */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.45]} />
          <meshLambertMaterial color={0x444444} />
        </mesh>

        {/* Barrel - long and thick */}
        <mesh position={[0, 0.02, -0.35]}>
          <cylinderGeometry args={[0.025, 0.03, 0.35, 8]} />
          <meshLambertMaterial color={0x222222} />
        </mesh>

        {/* Second barrel (over-under style) */}
        <mesh position={[0, 0.06, -0.35]}>
          <cylinderGeometry args={[0.02, 0.025, 0.3, 8]} />
          <meshLambertMaterial color={0x1a1a1a} />
        </mesh>

        {/* Pump/forend */}
        <mesh position={[0, -0.02, -0.15]}>
          <boxGeometry args={[0.07, 0.07, 0.15]} />
          <meshLambertMaterial color={0x664422} />
        </mesh>

        {/* Stock/grip */}
        <mesh position={[0.02, -0.06, 0.2]} rotation={[0.15, 0, 0]}>
          <boxGeometry args={[0.06, 0.08, 0.25]} />
          <meshLambertMaterial color={0x553311} />
        </mesh>

        {/* Trigger guard */}
        <mesh position={[0, -0.06, 0.02]}>
          <boxGeometry args={[0.03, 0.04, 0.05]} />
          <meshLambertMaterial color={0x333333} />
        </mesh>

        {/* Ejection port */}
        <mesh position={[0.04, 0.03, 0.05]}>
          <boxGeometry args={[0.02, 0.03, 0.08]} />
          <meshLambertMaterial color={0x555555} />
        </mesh>

        {/* Muzzle flash */}
        <mesh ref={muzzleRef} position={[0, 0.02, -0.55]} visible={false}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={0xffaa00} transparent opacity={0.9} />
        </mesh>
        {/* Flash glow */}
        <mesh position={[0, 0.02, -0.55]} visible={false}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshBasicMaterial color={0xff6600} transparent opacity={0.4} />
        </mesh>
      </group>

      {/* Crosshair - always visible on top */}
      <group position={[0, 0, -2]} renderOrder={999}>
        <mesh renderOrder={999}>
          <planeGeometry args={[0.03, 0.12]} />
          <meshBasicMaterial color={0x00ff00} transparent opacity={0.9} depthTest={false} depthWrite={false} />
        </mesh>
        <mesh renderOrder={999}>
          <planeGeometry args={[0.12, 0.03]} />
          <meshBasicMaterial color={0x00ff00} transparent opacity={0.9} depthTest={false} depthWrite={false} />
        </mesh>
        {/* Center dot */}
        <mesh renderOrder={999}>
          <circleGeometry args={[0.015, 16]} />
          <meshBasicMaterial color={0xffffff} transparent opacity={0.8} depthTest={false} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}
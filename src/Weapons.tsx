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

  useFrame((state) => {
    if (!gunGroupRef.current) return;

    // Recoil animation
    if (recoilRef.current > 0) {
      recoilRef.current = Math.max(0, recoilRef.current - 0.15);
    }

    const recoil = recoilRef.current;

    // Gun sway
    const sway = Math.sin(state.clock.getElapsedTime() * 8) * 0.003;
    const bob = Math.sin(state.clock.getElapsedTime() * 4) * 0.005;

    gunGroupRef.current.position.set(
      0.3 + sway + recoil * 0.05,
      -0.3 + bob - recoil * 0.08,
      -0.5 + recoil * 0.15,
    );

    // Muzzle flash visibility
    if (muzzleRef.current) {
      const timeSinceShot = state.clock.getElapsedTime() - lastShot;
      muzzleRef.current.visible = timeSinceShot < 0.05;
    }

    // Trigger recoil
    if (shooting) {
      const timeSinceShot = state.clock.getElapsedTime() - lastShot;
      if (timeSinceShot < 0.05) {
        recoilRef.current = 0.5;
      }
    }
  });

  return (
    <>
      {/* FPS Gun - Pistol */}
      <group ref={gunGroupRef}>
        {/* Gun body */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.08, 0.12, 0.25]} />
          <meshLambertMaterial color={0x333333} />
        </mesh>

        {/* Barrel */}
        <mesh position={[0, 0.03, -0.18]}>
          <boxGeometry args={[0.04, 0.04, 0.15]} />
          <meshLambertMaterial color={0x222222} />
        </mesh>

        {/* Grip */}
        <mesh position={[0, -0.08, 0.05]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.06, 0.15, 0.06]} />
          <meshLambertMaterial color={0x554433} />
        </mesh>

        {/* Muzzle flash */}
        <mesh ref={muzzleRef} position={[0, 0.03, -0.28]} visible={false}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color={0xffaa00} transparent opacity={0.9} />
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
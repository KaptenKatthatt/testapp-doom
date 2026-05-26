import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Group, Mesh } from "three";

interface WeaponsProps {
  readonly shooting: boolean;
  readonly lastShot: number;
}

export default function Weapons({ shooting, lastShot }: WeaponsProps): React.JSX.Element {
  const gunGroupRef = useRef<Group>(null);
  const crosshairRef = useRef<Group>(null);
  const muzzleRef = useRef<Mesh>(null);
  const recoilRef = useRef(0);
  const prevShootingRef = useRef(false);
  const { camera } = useThree();

  useFrame((state) => {
    // Attach weapon group to camera so it moves with the player
    if (gunGroupRef.current) {
      gunGroupRef.current.position.copy(camera.position);
      gunGroupRef.current.quaternion.copy(camera.quaternion);
    }

    // Crosshair also follows camera
    if (crosshairRef.current) {
      crosshairRef.current.position.copy(camera.position);
      crosshairRef.current.quaternion.copy(camera.quaternion);
    }

    // Recoil animation
    if (recoilRef.current > 0) {
      recoilRef.current = Math.max(0, recoilRef.current - 0.15);
    }

    const recoil = recoilRef.current;

    // Walking bob - sinusoidal movement like real Doom
    const time = state.clock.getElapsedTime();
    const sway = Math.sin(time * 10) * 0.008;
    const bob = Math.abs(Math.sin(time * 10)) * 0.015;

    // Trigger recoil on first frame of shooting
    if (shooting && !prevShootingRef.current) {
      recoilRef.current = 0.6;
    }
    prevShootingRef.current = shooting;

    // Local position offsets (relative to camera)
    const gunGroup = gunGroupRef.current;
    if (gunGroup) {
      // Apply local offset in camera space
      const offset = new THREE.Vector3(
        0.25 + sway + recoil * 0.04,
        -0.25 + bob - recoil * 0.1,
        -0.5 + recoil * 0.15
      );
      // Rotate offset by camera quaternion to get world-space offset
      offset.applyQuaternion(camera.quaternion);
      gunGroup.position.copy(camera.position).add(offset);
      gunGroup.quaternion.copy(camera.quaternion);
      gunGroup.rotateX(-0.05 + recoil * 0.15);
      gunGroup.rotateY(0.02 + sway * 0.5);
      gunGroup.rotateZ(-0.1 + recoil * -0.1);
    }

    // Muzzle flash visibility
    if (muzzleRef.current) {
      const timeSinceShot = state.clock.getElapsedTime() - lastShot;
      muzzleRef.current.visible = timeSinceShot < 0.08;
    }
  });

  return (
    <>
      {/* FPS Shotgun - follows camera */}
      <group ref={gunGroupRef}>
        {/* Main receiver/body */}
        <mesh>
          <boxGeometry args={[0.08, 0.08, 0.4]} />
          <meshBasicMaterial color={0x555555} />
        </mesh>

        {/* Barrel */}
        <mesh position={[0, 0.02, -0.3]}>
          <cylinderGeometry args={[0.02, 0.025, 0.35, 8]} />
          <meshBasicMaterial color={0x333333} />
        </mesh>

        {/* Second barrel (over-under) */}
        <mesh position={[0, 0.055, -0.3]}>
          <cylinderGeometry args={[0.015, 0.02, 0.3, 8]} />
          <meshBasicMaterial color={0x222222} />
        </mesh>

        {/* Pump/forend */}
        <mesh position={[0, -0.02, -0.12]}>
          <boxGeometry args={[0.06, 0.06, 0.12]} />
          <meshBasicMaterial color={0x774422} />
        </mesh>

        {/* Stock/grip */}
        <mesh position={[0.02, -0.05, 0.18]} rotation={[0.15, 0, 0]}>
          <boxGeometry args={[0.05, 0.07, 0.22]} />
          <meshBasicMaterial color={0x663311} />
        </mesh>

        {/* Trigger guard */}
        <mesh position={[0, -0.05, 0.02]}>
          <boxGeometry args={[0.025, 0.03, 0.04]} />
          <meshBasicMaterial color={0x444444} />
        </mesh>

        {/* Muzzle flash */}
        <mesh ref={muzzleRef} position={[0, 0.02, -0.5]} visible={false}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={0xffaa00} transparent opacity={0.9} />
        </mesh>
      </group>

      {/* Crosshair - follows camera, always on top */}
      <group ref={crosshairRef} renderOrder={999}>
        <mesh renderOrder={999} position={[0, 0, -2]}>
          <planeGeometry args={[0.03, 0.12]} />
          <meshBasicMaterial color={0x00ff00} transparent opacity={0.9} depthTest={false} depthWrite={false} />
        </mesh>
        <mesh renderOrder={999} position={[0, 0, -2]}>
          <planeGeometry args={[0.12, 0.03]} />
          <meshBasicMaterial color={0x00ff00} transparent opacity={0.9} depthTest={false} depthWrite={false} />
        </mesh>
        {/* Center dot */}
        <mesh renderOrder={999} position={[0, 0, -2]}>
          <circleGeometry args={[0.015, 16]} />
          <meshBasicMaterial color={0xffffff} transparent opacity={0.8} depthTest={false} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}
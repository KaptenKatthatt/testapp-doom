import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, PointLight } from "three";
import type { PickupData } from "./types";

export default function Pickups({ pickups }: { readonly pickups: PickupData[] }): React.JSX.Element {
  return (
    <group>
      {pickups.map(
        (p) => p.active && <Pickup key={p.id} pickup={p} />,
      )}
    </group>
  );
}

function Pickup({ pickup }: { readonly pickup: PickupData }): React.JSX.Element {
  const meshRef = useRef<Group>(null);
  const lightRef = useRef<PointLight>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 2;
      meshRef.current.position.y =
        pickup.position[1] + Math.sin(state.clock.getElapsedTime() * 3) * 0.1;
    }
    if (lightRef.current) {
      const pulse = 0.5 + Math.sin(state.clock.getElapsedTime() * 4) * 0.3;
      lightRef.current.intensity = pulse;
    }
  });

  const isHealth = pickup.type === "health";
  const isAmmo = pickup.type === "ammo";
  const color = isHealth ? 0xff0000 : isAmmo ? 0xffaa00 : 0xff3300;
  const emissiveColor = isHealth ? 0xff0000 : isAmmo ? 0xff8800 : 0x880000;
  const lightColor = isHealth ? "#ff0000" : isAmmo ? "#ffaa00" : "#ff3300";

  return (
    <group position={pickup.position}>
      <group ref={meshRef} position={[0, 0.3, 0]}>
        {pickup.type === "health" ? (
          <>
            <mesh>
              <boxGeometry args={[0.4, 0.12, 0.12]} />
              <meshLambertMaterial color={color} emissive={emissiveColor} emissiveIntensity={0.8} />
            </mesh>
            <mesh>
              <boxGeometry args={[0.12, 0.4, 0.12]} />
              <meshLambertMaterial color={color} emissive={emissiveColor} emissiveIntensity={0.8} />
            </mesh>
          </>
        ) : pickup.type === "ammo" ? (
          <mesh>
            <boxGeometry args={[0.3, 0.2, 0.2]} />
            <meshLambertMaterial color={color} emissive={emissiveColor} emissiveIntensity={0.8} />
          </mesh>
        ) : (
          <group>
            {/* Shell 1 - standing slightly tilted */}
            <group position={[0, -0.05, -0.06]} rotation={[0.1, 0, 0.05]}>
              <mesh position={[0, 0.02, 0]}>
                <cylinderGeometry args={[0.045, 0.045, 0.04, 8]} />
                <meshLambertMaterial color={0xffcc00} emissive={0x664400} />
              </mesh>
              <mesh position={[0, 0.12, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 0.16, 8]} />
                <meshLambertMaterial color={0xcc1111} emissive={0x440000} />
              </mesh>
            </group>

            {/* Shell 2 - lying down slightly */}
            <group position={[-0.06, -0.05, 0.04]} rotation={[1.4, 0.3, 0.5]}>
              <mesh position={[0, 0.02, 0]}>
                <cylinderGeometry args={[0.045, 0.045, 0.04, 8]} />
                <meshLambertMaterial color={0xffcc00} emissive={0x664400} />
              </mesh>
              <mesh position={[0, 0.12, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 0.16, 8]} />
                <meshLambertMaterial color={0xcc1111} emissive={0x440000} />
              </mesh>
            </group>

            {/* Shell 3 - tilted other direction */}
            <group position={[0.06, -0.05, 0.04]} rotation={[-0.1, 0.2, -1.3]}>
              <mesh position={[0, 0.02, 0]}>
                <cylinderGeometry args={[0.045, 0.045, 0.04, 8]} />
                <meshLambertMaterial color={0xffcc00} emissive={0x664400} />
              </mesh>
              <mesh position={[0, 0.12, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 0.16, 8]} />
                <meshLambertMaterial color={0xcc1111} emissive={0x440000} />
              </mesh>
            </group>
          </group>
        )}
      </group>
      <pointLight
        ref={lightRef}
        position={[0, 0.5, 0]}
        color={lightColor}
        intensity={1.0}
        distance={6}
      />
    </group>
  );
}
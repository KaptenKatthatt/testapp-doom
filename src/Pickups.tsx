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
  const color = isHealth ? 0xff0000 : isAmmo ? 0xffaa00 : 0x00aaff;
  const emissiveColor = isHealth ? 0xff0000 : isAmmo ? 0xff8800 : 0x0066ff;
  const lightColor = isHealth ? "#ff0000" : isAmmo ? "#ffaa00" : "#00aaff";

  return (
    <group position={pickup.position}>
      <group ref={meshRef} position={[0, 0.3, 0]}>
        {pickup.type === "health" ? (
          <>
            <mesh>
              <boxGeometry args={[0.4, 0.12, 0.12]} />
              <meshStandardMaterial
                color={color}
                emissive={emissiveColor}
                emissiveIntensity={0.5}
              />
            </mesh>
            <mesh>
              <boxGeometry args={[0.12, 0.4, 0.12]} />
              <meshStandardMaterial
                color={color}
                emissive={emissiveColor}
                emissiveIntensity={0.5}
              />
            </mesh>
          </>
        ) : pickup.type === "ammo" ? (
          <mesh>
            <boxGeometry args={[0.3, 0.2, 0.2]} />
            <meshStandardMaterial
              color={color}
              emissive={emissiveColor}
              emissiveIntensity={0.5}
            />
          </mesh>
        ) : (
          <mesh>
            <boxGeometry args={[0.25, 0.15, 0.5]} />
            <meshStandardMaterial
              color={color}
              emissive={emissiveColor}
              emissiveIntensity={0.5}
            />
          </mesh>
        )}
      </group>
      <pointLight
        ref={lightRef}
        position={[0, 0.5, 0]}
        color={lightColor}
        intensity={0.5}
        distance={4}
      />
    </group>
  );
}
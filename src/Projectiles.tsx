import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import type { ProjectileData } from "./types";

export default function Projectiles({ projectiles }: { readonly projectiles: ProjectileData[] }): React.JSX.Element {
  return (
    <group>
      {projectiles.map((p) => (
        <Projectile key={p.id} projectile={p} />
      ))}
    </group>
  );
}

function Projectile({ projectile }: { readonly projectile: ProjectileData }): React.JSX.Element {
  const meshRef = useRef<Mesh>(null);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;
    const dt = Math.min(delta, 0.05);
    meshRef.current.position.x += projectile.direction[0] * projectile.speed * dt;
    meshRef.current.position.y += projectile.direction[1] * projectile.speed * dt;
    meshRef.current.position.z += projectile.direction[2] * projectile.speed * dt;
  });

  return (
    <mesh ref={meshRef} position={projectile.position}>
      <sphereGeometry args={[0.12, 6, 6]} />
      <meshBasicMaterial color={projectile.color} />
    </mesh>
  );
}
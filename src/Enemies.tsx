import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, Group } from "three";
import type { EnemyData, EnemyType } from "./types";

const ENEMY_CONFIG: Record<EnemyType, {
  bodyW: number; bodyH: number; bodyD: number;
  headSize: number; color: number; speed: number;
  attackRange: number; attackCooldown: number; attackDamage: number;
}> = {
  imp: {
    bodyW: 0.8, bodyH: 1.6, bodyD: 0.6,
    headSize: 0.5, color: 0xaa7733, speed: 1.5,
    attackRange: 8, attackCooldown: 2, attackDamage: 8,
  },
  demon: {
    bodyW: 1.2, bodyH: 1.2, bodyD: 0.8,
    headSize: 0.7, color: 0xaa3366, speed: 3,
    attackRange: 2.5, attackCooldown: 1.2, attackDamage: 15,
  },
  zombieman: {
    bodyW: 0.7, bodyH: 1.7, bodyD: 0.5,
    headSize: 0.45, color: 0x778877, speed: 1.0,
    attackRange: 12, attackCooldown: 2.5, attackDamage: 6,
  },
};

export default function Enemies({ enemies }: { readonly enemies: EnemyData[] }): React.JSX.Element {
  return (
    <group>
      {enemies.map((e) =>
        e.alive ? <Enemy key={e.id} enemy={e} /> : <Corpse key={e.id} enemy={e} />
      )}
    </group>
  );
}

function Enemy({ enemy }: { readonly enemy: EnemyData }): React.JSX.Element {
  const meshRef = useRef<Group>(null);
  const glowRef = useRef<Mesh>(null);
  const { position, type, hitFlash } = enemy;
  const config = ENEMY_CONFIG[type];
  const isDemon = type === "demon";
  const eyeColor = isDemon ? "#ff0044" : "#ff4400";
  const healthPct = enemy.health / enemy.maxHealth;
  const flashColor = hitFlash > 0 ? 0xffffff : 0x000000;
  const flashIntensity = hitFlash > 0 ? hitFlash : 0;

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y =
        Math.sin(state.clock.getElapsedTime() * 3 + enemy.id) * 0.05;
    }
    if (glowRef.current) {
      const material = glowRef.current.material;
      if (material && "emissiveIntensity" in material) {
        const pulse = 0.5 + Math.sin(state.clock.getElapsedTime() * 5 + enemy.id * 2) * 0.3;
        (material as { emissiveIntensity: number }).emissiveIntensity = pulse;
      }
    }
  });

  return (
    <group position={[position[0], 0, position[2]]}>
      <group ref={meshRef} position={[0, config.bodyH / 2, 0]}>
        {/* Body */}
        <mesh>
          <boxGeometry args={[config.bodyW, config.bodyH, config.bodyD]} />
          <meshLambertMaterial
            color={config.color}
            emissive={flashColor}
            emissiveIntensity={flashIntensity + 0.15}
          />
        </mesh>

        {/* Head */}
        <mesh position={[0, config.bodyH / 2 + config.headSize / 2, 0]}>
          <boxGeometry args={[config.headSize, config.headSize, config.headSize]} />
          <meshLambertMaterial color={config.color} emissive={0x221100} emissiveIntensity={0.3} />
        </mesh>

        {/* Eyes - glowing */}
        <mesh
          ref={glowRef}
          position={[
            isDemon ? -0.15 : -0.1,
            config.bodyH / 2 + config.headSize / 2 + 0.05,
            isDemon ? -0.3 : -0.25,
          ]}
        >
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={eyeColor} />
        </mesh>
        <mesh
          position={[
            isDemon ? 0.15 : 0.1,
            config.bodyH / 2 + config.headSize / 2 + 0.05,
            isDemon ? -0.3 : -0.25,
          ]}
        >
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={eyeColor} />
        </mesh>

        {/* Horns for demon */}
        {isDemon && (
          <>
            <mesh position={[-0.35, config.bodyH / 2 + config.headSize, 0]} rotation={[0, 0, 0.3]}>
              <coneGeometry args={[0.08, 0.4, 6]} />
              <meshLambertMaterial color={0x440022} />
            </mesh>
            <mesh position={[0.35, config.bodyH / 2 + config.headSize, 0]} rotation={[0, 0, -0.3]}>
              <coneGeometry args={[0.08, 0.4, 6]} />
              <meshLambertMaterial color={0x440022} />
            </mesh>
          </>
        )}

        {/* Arms */}
        <mesh position={[-(config.bodyW / 2 + 0.2), config.bodyH * 0.1, 0]}>
          <boxGeometry args={[0.25, config.bodyH * 0.4, 0.25]} />
          <meshLambertMaterial color={config.color} emissive={0x110800} emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[config.bodyW / 2 + 0.2, config.bodyH * 0.1, 0]}>
          <boxGeometry args={[0.25, config.bodyH * 0.4, 0.25]} />
          <meshLambertMaterial color={config.color} emissive={0x110800} emissiveIntensity={0.2} />
        </mesh>
      </group>

      {/* Health bar */}
      <mesh position={[0, config.bodyH + 0.8, 0]}>
        <planeGeometry args={[0.8, 0.06]} />
        <meshBasicMaterial color={0x440000} />
      </mesh>
      <mesh position={[-0.4 + healthPct * 0.4, config.bodyH + 0.8, 0.01]}>
        <planeGeometry args={[0.8 * healthPct, 0.06]} />
        <meshBasicMaterial color={healthPct > 0.5 ? 0x00ff00 : 0xff4400} />
      </mesh>
    </group>
  );
}

function Corpse({ enemy }: { readonly enemy: EnemyData }): React.JSX.Element {
  const { position } = enemy;
  const config = ENEMY_CONFIG[enemy.type];

  return (
    <group position={[position[0], 0.15, position[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, enemy.id * 1.3]}>
        <boxGeometry args={[config.bodyW, config.bodyH * 0.15, config.bodyD]} />
        <meshLambertMaterial color={0x332211} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[1, 8]} />
        <meshLambertMaterial color={0x660000} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}
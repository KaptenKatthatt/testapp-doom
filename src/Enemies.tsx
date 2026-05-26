import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Mesh, Group, PointLight } from "three";
import type { EnemyData, EnemyType } from "./types";

const ENEMY_CONFIG: Record<EnemyType, {
  bodyW: number; bodyH: number; bodyD: number;
  headSize: number; color: number; speed: number;
  attackRange: number; attackCooldown: number; attackDamage: number;
}> = {
  imp: {
    bodyW: 1.0, bodyH: 2.0, bodyD: 0.8,
    headSize: 0.65, color: 0xcc6622, speed: 1.5,
    attackRange: 8, attackCooldown: 2, attackDamage: 2,
  },
  demon: {
    bodyW: 1.5, bodyH: 1.6, bodyD: 1.0,
    headSize: 0.9, color: 0xcc1144, speed: 3,
    attackRange: 2.5, attackCooldown: 1.2, attackDamage: 2,
  },
  zombieman: {
    bodyW: 0.9, bodyH: 2.2, bodyD: 0.7,
    headSize: 0.55, color: 0x99aa77, speed: 1.0,
    attackRange: 12, attackCooldown: 2.5, attackDamage: 2,
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
  const isZombie = type === "zombieman";
  const eyeColor = isDemon ? "#ff0044" : "#ff4400";
  const healthPct = enemy.health / enemy.maxHealth;
  const flashColor = hitFlash > 0 ? 0xffffff : 0x000000;
  const flashIntensity = hitFlash > 0 ? hitFlash : 0;

  // Create procedural texture for this enemy type
  const bodyTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return new THREE.CanvasTexture(canvas);
    }
    const baseColor = type === "imp" ? [204, 102, 34] : type === "demon" ? [204, 17, 68] : [153, 170, 119];
    ctx.fillStyle = `rgb(${baseColor[0]},${baseColor[1]},${baseColor[2]})`;
    ctx.fillRect(0, 0, 64, 64);
    // Scale/skin detail - more contrast for visibility
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const bright = Math.random() > 0.5;
      const a = Math.random() * 0.3;
      ctx.fillStyle = bright ? `rgba(255,255,255,${a * 0.3})` : `rgba(0,0,0,${a})`;
      ctx.fillRect(x, y, 2 + Math.random() * 2, 1 + Math.random());
    }
    // Add bright belly/chest stripe for visibility at distance
    ctx.fillStyle = `rgba(255,200,100,0.3)`;
    ctx.fillRect(16, 24, 32, 16);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }, [type]);

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
            map={bodyTexture}
            color={config.color}
            emissive={config.color}
            emissiveIntensity={flashIntensity + 0.4}
          />
        </mesh>

        {/* Head */}
        <mesh position={[0, config.bodyH / 2 + config.headSize / 2, 0]}>
          <boxGeometry args={[config.headSize, config.headSize, config.headSize]} />
          <meshLambertMaterial color={config.color} emissive={config.color} emissiveIntensity={0.5} />
        </mesh>

        {/* Eyes - larger glowing */}
        <mesh
          ref={glowRef}
          position={[
            isDemon ? -0.2 : -0.13,
            config.bodyH / 2 + config.headSize / 2 + 0.05,
            isDemon ? -0.35 : -0.28,
          ]}
        >
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshBasicMaterial color={eyeColor} />
        </mesh>
        <mesh
          position={[
            isDemon ? 0.2 : 0.13,
            config.bodyH / 2 + config.headSize / 2 + 0.05,
            isDemon ? -0.35 : -0.28,
          ]}
        >
          <sphereGeometry args={[0.12, 8, 8]} />
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
        <mesh position={[-(config.bodyW / 2 + 0.25), config.bodyH * 0.1, 0]}>
          <boxGeometry args={[0.3, config.bodyH * 0.4, 0.3]} />
          <meshLambertMaterial color={config.color} emissive={config.color} emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[config.bodyW / 2 + 0.25, config.bodyH * 0.1, 0]}>
          <boxGeometry args={[0.3, config.bodyH * 0.4, 0.3]} />
          <meshLambertMaterial color={config.color} emissive={config.color} emissiveIntensity={0.3} />
        </mesh>
      </group>

      {/* Health bar - larger and more visible */}
      <mesh position={[0, config.bodyH + 1.0, 0]}>
        <planeGeometry args={[1.2, 0.1]} />
        <meshBasicMaterial color={0x440000} />
      </mesh>
      <mesh position={[-0.6 + healthPct * 0.6, config.bodyH + 1.0, 0.01]}>
        <planeGeometry args={[1.2 * healthPct, 0.1]} />
        <meshBasicMaterial color={healthPct > 0.5 ? 0x00ff00 : healthPct > 0.25 ? 0xff8800 : 0xff0000} />
      </mesh>

      {/* Enemy glow light */}
      <pointLight
        position={[0, config.bodyH + 0.5, 0]}
        color={type === "demon" ? "#ff0044" : type === "zombieman" ? "#88ff88" : "#ff6600"}
        intensity={2.0}
        distance={8}
      />
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
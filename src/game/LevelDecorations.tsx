import React from "react";
import type * as THREE from "three";

interface LevelDecorationsProps {
  readonly textures: {
    readonly blood: THREE.Texture;
    readonly slime: THREE.Texture;
    readonly barrel: THREE.Texture;
  };
}

export function LevelDecorations({ textures }: LevelDecorationsProps): React.JSX.Element {
  return (
    <>
      {/* Blood pool */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12, 0.01, 18]}>
        <circleGeometry args={[1.5, 16]} />
        <meshLambertMaterial map={textures.blood} transparent opacity={0.8} />
      </mesh>

      {/* Slime pool */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[38, 0.01, 38]}>
        <circleGeometry args={[2, 16]} />
        <meshLambertMaterial map={textures.slime} transparent opacity={0.8} />
      </mesh>

      {/* Cross in starting room */}
      <mesh position={[3, 2.5, 4]}>
        <boxGeometry args={[0.2, 1.2, 0.05]} />
        <meshLambertMaterial color={0xcc4444} emissive={0x441111} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[3, 3, 4]}>
        <boxGeometry args={[0.6, 0.2, 0.05]} />
        <meshLambertMaterial color={0xcc4444} emissive={0x441111} emissiveIntensity={0.5} />
      </mesh>



      {/* Torch flames - small emissive cubes on walls */}
      {[
        [6, 3, 4], [16, 3, 18], [30, 3, 12], [40, 3, 20],
        [3, 3.5, 4], [8, 3.5, 8],
      ].map((pos, i) => (
        <mesh key={`torch-${i}`} position={pos as [number, number, number]}>
          <boxGeometry args={[0.15, 0.15, 0.15]} />
          <meshBasicMaterial color="#ff6600" />
        </mesh>
      ))}
    </>
  );
}

import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

const MODEL_URL = "/models/quaterniusdemon.glb";
const TARGET_HEIGHT = 2.6;
const ATTACK_ANIM_WINDOW = 0.9;
const FADE_TIME = 0.18;

// Hellish material overrides per GLB material name (Doom Eternal vibe)
const MATERIAL_TINTS: Record<string, { color?: number; emissive: number; emissiveIntensity: number }> = {
  Demon_Main: { color: 0x991122, emissive: 0x330008, emissiveIntensity: 0.6 },
  Black: { emissive: 0x1a0000, emissiveIntensity: 0.4 },
  Eye_White: { color: 0xffcc44, emissive: 0xff6600, emissiveIntensity: 1.2 },
  Eye_Black: { emissive: 0xff2200, emissiveIntensity: 0.8 },
};

type AnimName = "Idle" | "Walk" | "Run" | "Weapon" | "Death" | "HitReact";

interface DemonInstance {
  scene: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Partial<Record<AnimName, THREE.AnimationAction>>;
  materials: THREE.MeshStandardMaterial[];
  baseEmissive: Map<THREE.MeshStandardMaterial, { color: number; intensity: number }>;
}

function updateSkinnedBounds(scene: THREE.Object3D): void {
  scene.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) {
      mesh.skeleton?.update();
    }
  });
  scene.updateMatrixWorld(true);
}

function buildInstance(gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }): DemonInstance {
  const scene = cloneSkeleton(gltf.scene);

  const materials: THREE.MeshStandardMaterial[] = [];
  const baseEmissive = new Map<THREE.MeshStandardMaterial, { color: number; intensity: number }>();

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false; // skinned meshes can be culled incorrectly mid-animation
    const cloneMat = (m: THREE.Material): THREE.Material => {
      const cloned = m.clone() as THREE.MeshStandardMaterial;
      const tint = MATERIAL_TINTS[m.name];
      if (tint && cloned.emissive) {
        if (tint.color !== undefined && cloned.color) cloned.color.setHex(tint.color);
        cloned.emissive.setHex(tint.emissive);
        cloned.emissiveIntensity = tint.emissiveIntensity;
      }
      if (cloned.emissive) {
        materials.push(cloned);
        baseEmissive.set(cloned, { color: cloned.emissive.getHex(), intensity: cloned.emissiveIntensity });
      }
      return cloned;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(cloneMat) : cloneMat(mesh.material);
  });

  const mixer = new THREE.AnimationMixer(scene);
  const actions: Partial<Record<AnimName, THREE.AnimationAction>> = {};
  for (const name of ["Idle", "Walk", "Run", "Weapon", "Death", "HitReact"] as AnimName[]) {
    const clip = gltf.animations.find((c) => c.name.endsWith(`|${name}`) || c.name === name);
    if (clip) actions[name] = mixer.clipAction(clip);
  }

  // Skinned GLB bind-pose bounds are wrong (armature scale 100); sample Idle first.
  const idle = actions.Idle;
  if (idle) {
    idle.play();
    mixer.update(0);
  }
  updateSkinnedBounds(scene);

  const box = new THREE.Box3().setFromObject(scene);
  const height = Math.max(0.001, box.max.y - box.min.y);
  const scale = TARGET_HEIGHT / height;
  scene.scale.setScalar(scale);
  scene.position.y = -box.min.y * scale;

  return { scene, mixer, actions, materials, baseEmissive };
}

export default function QuaterniusDemonModel({
  rotation,
  hitFlash,
  lastAttack,
  alerted,
  dead,
}: {
  readonly rotation: number;
  readonly hitFlash: number;
  readonly lastAttack: number;
  readonly alerted: boolean;
  readonly dead: boolean;
}): React.JSX.Element {
  const gltf = useLoader(GLTFLoader, MODEL_URL);
  const instance = useMemo(() => buildInstance(gltf), [gltf]);
  const currentAnim = useRef<AnimName | null>(null);

  useFrame((_state, delta) => {
    const { mixer, actions, materials, baseEmissive } = instance;
    // lastAttack is set by the AI using performance.now()/1000, not the R3F clock
    const now = performance.now() / 1000;

    let desired: AnimName;
    if (dead) {
      desired = "Death";
    } else if (lastAttack > 0 && now - lastAttack < ATTACK_ANIM_WINDOW) {
      desired = "Weapon";
    } else if (alerted) {
      desired = "Run";
    } else {
      desired = "Idle";
    }

    if (desired !== currentAnim.current) {
      const next = actions[desired] ?? actions.Idle;
      const prev = currentAnim.current ? actions[currentAnim.current] : undefined;
      if (next) {
        next.reset();
        if (desired === "Death" || desired === "Weapon") {
          next.setLoop(THREE.LoopOnce, 1);
          next.clampWhenFinished = true;
        } else {
          next.setLoop(THREE.LoopRepeat, Infinity);
        }
        next.fadeIn(FADE_TIME).play();
      }
      prev?.fadeOut(FADE_TIME);
      currentAnim.current = desired;
    }

    mixer.update(delta);

    // Red emissive flash when taking damage
    for (const mat of materials) {
      const base = baseEmissive.get(mat);
      if (!base) continue;
      if (hitFlash > 0.05) {
        mat.emissive.setHex(0xff2222);
        mat.emissiveIntensity = base.intensity + hitFlash * 1.6;
      } else {
        mat.emissive.setHex(base.color);
        mat.emissiveIntensity = base.intensity;
      }
    }
  });

  // Model faces +Z; enemy rotation convention points -Z toward the player
  return (
    <group rotation={[0, rotation + Math.PI, 0]}>
      <primitive object={instance.scene} />
    </group>
  );
}

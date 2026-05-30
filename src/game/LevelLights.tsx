import React from "react";
import type { LevelLightingData } from "@/shared/storage/StorageHelpers";

interface LevelLightsProps {
  readonly customLighting?: LevelLightingData | null | undefined;
  readonly editorModeActive?: boolean | undefined;
  readonly selectedLightId?: string | null | undefined;
  readonly onSelectLight?: ((id: string | null) => void) | undefined;
}

export const DEFAULT_LIGHTING: LevelLightingData = {
  ambientColor: "#eeccaa",
  ambientIntensity: 1.5,
  hemisphereSkyColor: "#ffeedd",
  hemisphereGroundColor: "#665544",
  hemisphereIntensity: 0.8,
  pointLights: [
    // Key point lights for atmosphere - much stronger
    { id: "key-1", position: [3, 3.5, 4], intensity: 6.0, color: "#ffaa66", distance: 30 },
    { id: "key-2", position: [8, 3.5, 8], intensity: 5.0, color: "#ff9944", distance: 25 },
    { id: "key-3", position: [20, 3.5, 14], intensity: 4.0, color: "#ffcc88", distance: 30 },
    { id: "key-4", position: [36, 3.5, 8], intensity: 3.0, color: "#ff8844", distance: 25 },
    { id: "key-5", position: [14, 3.5, 26], intensity: 3.0, color: "#ffaa66", distance: 25 },
    { id: "key-6", position: [38, 3.5, 28], intensity: 3.0, color: "#88ff88", distance: 25 },
    { id: "key-7", position: [4, 3.5, 34], intensity: 2.0, color: "#ff6666", distance: 20 },

    // Ceiling lights - uniform overhead lighting
    { id: "ceil-1", position: [10, 3.8, 16], intensity: 4.0, color: "#ffffff", distance: 20 },
    { id: "ceil-2", position: [28, 3.8, 16], intensity: 3.0, color: "#ffffff", distance: 20 },
    { id: "ceil-3", position: [40, 3.8, 30], intensity: 3.0, color: "#ffffff", distance: 20 },

    // Torch lights on walls - brighter
    { id: "torch-1", position: [6, 3, 4], intensity: 3.0, color: "#ff8833", distance: 15 },
    { id: "torch-2", position: [16, 3, 18], intensity: 3.0, color: "#ff8833", distance: 15 },
    { id: "torch-3", position: [30, 3, 12], intensity: 2.5, color: "#ff8833", distance: 15 },
    { id: "torch-4", position: [40, 3, 20], intensity: 2.5, color: "#88cc88", distance: 15 },
  ],
};

export function LevelLights({
  customLighting,
  editorModeActive = false,
  selectedLightId = null,
  onSelectLight,
}: LevelLightsProps): React.JSX.Element {
  // Use custom lighting if provided, otherwise fallback to defaults
  const lighting = customLighting ?? DEFAULT_LIGHTING;

  return (
    <>
      {/* Ambient and Hemisphere light */}
      <ambientLight intensity={lighting.ambientIntensity} color={lighting.ambientColor} />
      <hemisphereLight args={[lighting.hemisphereSkyColor, lighting.hemisphereGroundColor, lighting.hemisphereIntensity]} />

      {/* Point lights mapping */}
      {lighting.pointLights.map((light) => {
        const isSelected = selectedLightId === light.id;
        
        return (
          <group key={light.id}>
            <pointLight
              position={light.position}
              intensity={light.intensity}
              color={light.color}
              distance={light.distance}
            />

            {/* Render 3D helper spheres in lighting editor mode */}
            {editorModeActive && (
              <mesh
                position={light.position}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectLight) {
                    onSelectLight(light.id);
                  }
                }}
              >
                <sphereGeometry args={[0.2, 16, 16]} />
                <meshBasicMaterial
                  color={isSelected ? "#00ffff" : light.color}
                  toneMapped={false}
                  wireframe={isSelected}
                  transparent
                  opacity={isSelected ? 0.9 : 0.65}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}

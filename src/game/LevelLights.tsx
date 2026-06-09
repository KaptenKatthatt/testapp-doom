import React from "react";
import type { LevelLightingData } from "@/shared/storage/StorageHelpers";
import { DEFAULT_LIGHTING } from "@/shared/lighting/defaults";

export { DEFAULT_LIGHTING };

interface LevelLightsProps {
  readonly customLighting?: LevelLightingData | null | undefined;
  readonly editorModeActive?: boolean | undefined;
  readonly selectedLightId?: string | null | undefined;
  readonly onSelectLight?: ((id: string | null) => void) | undefined;
}

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

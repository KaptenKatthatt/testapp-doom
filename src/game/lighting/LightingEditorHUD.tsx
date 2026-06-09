import React, { useState } from "react";
import type { LevelLightingData, PointLightData } from "@/shared/storage/StorageHelpers";
import { DEFAULT_LIGHTING } from "@/shared/lighting/defaults";
import LightingSliderField from "./LightingSliderField";
import LightingColorField from "./LightingColorField";
import {
  editorButtonStyle,
  lightItemStyle,
  lightingEditorStyles,
  tabButtonStyle,
} from "./lightingEditorStyles";

interface LightingEditorHUDProps {
  readonly customLighting: LevelLightingData | null;
  readonly onChangeLighting: (lighting: LevelLightingData) => void;
  readonly selectedLightId: string | null;
  readonly onSelectLight: (id: string | null) => void;
  readonly onRequestPlayerPosition: () => Promise<[number, number, number]>;
  readonly onClose: () => void;
  readonly onSave: () => void;
}

export default function LightingEditorHUD({
  customLighting,
  onChangeLighting,
  selectedLightId,
  onSelectLight,
  onRequestPlayerPosition,
  onClose,
  onSave,
}: LightingEditorHUDProps): React.JSX.Element {
  const lighting = customLighting ?? { ...DEFAULT_LIGHTING };
  const [activeTab, setActiveTab] = useState<"global" | "lights">("global");

  const updateLighting = (updates: Partial<LevelLightingData>): void => {
    onChangeLighting({ ...lighting, ...updates });
  };

  const handleAddLight = async (): Promise<void> => {
    try {
      const pos = await onRequestPlayerPosition();
      const newLight: PointLightData = {
        id: `light-${Date.now()}`,
        position: [
          parseFloat(pos[0].toFixed(2)),
          parseFloat((pos[1] + 0.3).toFixed(2)),
          parseFloat(pos[2].toFixed(2)),
        ],
        color: "#ffa500",
        intensity: 4.0,
        distance: 20,
      };
      updateLighting({ pointLights: [...lighting.pointLights, newLight] });
      onSelectLight(newLight.id);
    } catch (e) {
      console.error("Failed to get player position to add light:", e);
    }
  };

  const handleDeleteLight = (): void => {
    if (!selectedLightId) return;
    updateLighting({ pointLights: lighting.pointLights.filter((l) => l.id !== selectedLightId) });
    onSelectLight(null);
  };

  const selectedLight = lighting.pointLights.find((l) => l.id === selectedLightId);

  const updateSelectedLight = (updates: Partial<PointLightData>): void => {
    if (!selectedLightId) return;
    updateLighting({
      pointLights: lighting.pointLights.map((l) =>
        l.id === selectedLightId ? { ...l, ...updates } : l
      ),
    });
  };

  return (
    <div style={lightingEditorStyles.overlay} onMouseDown={(e) => e.stopPropagation()}>
      <div style={lightingEditorStyles.header}>
        <h3 style={lightingEditorStyles.title}>💡 LIGHTS EDITOR</h3>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "#ff4444",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
          }}
        >
          ✕
        </button>
      </div>

      <div style={lightingEditorStyles.tabContainer}>
        <button style={tabButtonStyle(activeTab === "global")} onClick={() => setActiveTab("global")}>
          GLOBAL LIGHTS
        </button>
        <button style={tabButtonStyle(activeTab === "lights")} onClick={() => setActiveTab("lights")}>
          POINT LIGHTS ({lighting.pointLights.length})
        </button>
      </div>

      <div style={lightingEditorStyles.content}>
        {activeTab === "global" && (
          <>
            <LightingSliderField
              label="AMBIENT INTENSITY"
              value={lighting.ambientIntensity}
              displayValue={lighting.ambientIntensity.toFixed(2)}
              min={0}
              max={4}
              step={0.05}
              onChange={(ambientIntensity) => updateLighting({ ambientIntensity })}
            />
            <LightingColorField
              label="AMBIENT COLOR"
              value={lighting.ambientColor}
              onChange={(ambientColor) => updateLighting({ ambientColor })}
            />
            <hr style={lightingEditorStyles.divider} />
            <LightingSliderField
              label="HEMISPHERE INTENSITY"
              value={lighting.hemisphereIntensity}
              displayValue={lighting.hemisphereIntensity.toFixed(2)}
              min={0}
              max={3}
              step={0.05}
              onChange={(hemisphereIntensity) => updateLighting({ hemisphereIntensity })}
            />
            <LightingColorField
              label="HEMISPHERE SKY (TOP)"
              value={lighting.hemisphereSkyColor}
              onChange={(hemisphereSkyColor) => updateLighting({ hemisphereSkyColor })}
            />
            <LightingColorField
              label="HEMISPHERE GROUND (BOTTOM)"
              value={lighting.hemisphereGroundColor}
              onChange={(hemisphereGroundColor) => updateLighting({ hemisphereGroundColor })}
            />
          </>
        )}

        {activeTab === "lights" && (
          <>
            <button style={editorButtonStyle("secondary")} onClick={handleAddLight}>
              ➕ PLACE LIGHT AT MY POSITION
            </button>

            <div>
              <div style={lightingEditorStyles.label}>SELECT LIGHT (OR CLICK SFX SFHERES IN 3D)</div>
              <div style={lightingEditorStyles.lightList}>
                {lighting.pointLights.length === 0 ? (
                  <div style={{ padding: "10px", fontSize: "11px", color: "#666", textAlign: "center" }}>
                    No point lights placed.
                  </div>
                ) : (
                  lighting.pointLights.map((l, index) => (
                    <div
                      key={l.id}
                      style={lightItemStyle(selectedLightId === l.id)}
                      onClick={() => onSelectLight(selectedLightId === l.id ? null : l.id)}
                    >
                      <span>💡 Light #{index + 1} ({l.id.substring(0, 8)})</span>
                      <span
                        style={{
                          width: "12px",
                          height: "12px",
                          borderRadius: "50%",
                          background: l.color,
                          border: "1px solid #fff",
                        }}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            {selectedLight && (
              <div
                style={{
                  border: "1px solid #442266",
                  background: "rgba(153, 51, 204, 0.05)",
                  padding: "10px",
                  borderRadius: "4px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: "bold", color: "#dd88ff" }}>EDIT SELECTED LIGHT</span>
                  <button
                    onClick={handleDeleteLight}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#ff4444",
                      cursor: "pointer",
                      fontSize: "11px",
                      textDecoration: "underline",
                      fontFamily: "inherit",
                    }}
                  >
                    🗑️ DELETE
                  </button>
                </div>

                <LightingColorField
                  label="COLOR"
                  value={selectedLight.color}
                  onChange={(color) => updateSelectedLight({ color })}
                />
                <LightingSliderField
                  label="INTENSITY"
                  value={selectedLight.intensity}
                  displayValue={selectedLight.intensity.toFixed(1)}
                  min={0.1}
                  max={15}
                  step={0.1}
                  onChange={(intensity) => updateSelectedLight({ intensity })}
                />
                <LightingSliderField
                  label="DISTANCE RANGE"
                  value={selectedLight.distance}
                  displayValue={`${selectedLight.distance}m`}
                  min={1}
                  max={50}
                  step={1}
                  onChange={(distance) => updateSelectedLight({ distance })}
                />
                <LightingSliderField
                  label="POSITION X"
                  value={selectedLight.position[0]}
                  displayValue={selectedLight.position[0].toFixed(2)}
                  min={-5}
                  max={55}
                  step={0.1}
                  onChange={(x) =>
                    updateSelectedLight({
                      position: [x, selectedLight.position[1], selectedLight.position[2]],
                    })
                  }
                />
                <LightingSliderField
                  label="POSITION Y (HEIGHT)"
                  value={selectedLight.position[1]}
                  displayValue={selectedLight.position[1].toFixed(2)}
                  min={0.1}
                  max={5}
                  step={0.05}
                  onChange={(y) =>
                    updateSelectedLight({
                      position: [selectedLight.position[0], y, selectedLight.position[2]],
                    })
                  }
                />
                <LightingSliderField
                  label="POSITION Z"
                  value={selectedLight.position[2]}
                  displayValue={selectedLight.position[2].toFixed(2)}
                  min={-5}
                  max={55}
                  step={0.1}
                  onChange={(z) =>
                    updateSelectedLight({
                      position: [selectedLight.position[0], selectedLight.position[1], z],
                    })
                  }
                />
              </div>
            )}
          </>
        )}

        <hr style={lightingEditorStyles.divider} />

        <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
          <button style={{ ...editorButtonStyle("primary"), flex: 1 }} onClick={onSave}>
            💾 SAVE LIGHTING
          </button>
          <button style={{ ...editorButtonStyle("secondary"), flex: 1 }} onClick={onClose}>
            DONE
          </button>
        </div>
      </div>
    </div>
  );
}

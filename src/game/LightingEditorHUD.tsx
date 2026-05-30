import React, { useState } from "react";
import type { LevelLightingData, PointLightData } from "@/shared/storage/StorageHelpers";
import { DEFAULT_LIGHTING } from "./LevelLights";

interface LightingEditorHUDProps {
  readonly customLighting: LevelLightingData | null;
  readonly onChangeLighting: (lighting: LevelLightingData) => void;
  readonly selectedLightId: string | null;
  readonly onSelectLight: (id: string | null) => void;
  readonly onClose: () => void;
  readonly onSave: () => void;
}

const requestPlayerPos = (): Promise<[number, number, number]> => {
  return new Promise((resolve) => {
    const event = new CustomEvent("get-player-position", {
      detail: {
        callback: (pos: [number, number, number]) => resolve(pos),
      },
    });
    window.dispatchEvent(event);
  });
};

export default function LightingEditorHUD({
  customLighting,
  onChangeLighting,
  selectedLightId,
  onSelectLight,
  onClose,
  onSave,
}: LightingEditorHUDProps): React.JSX.Element {
  const lighting = customLighting ?? { ...DEFAULT_LIGHTING };

  const [activeTab, setActiveTab] = useState<"global" | "lights">("global");

  const updateLighting = (updates: Partial<LevelLightingData>): void => {
    onChangeLighting({
      ...lighting,
      ...updates,
    });
  };

  const handleAddLight = async (): Promise<void> => {
    try {
      const pos = await requestPlayerPos();
      // Spawn slightly in front of the player
      const newLight: PointLightData = {
        id: `light-${Date.now()}`,
        position: [parseFloat(pos[0].toFixed(2)), parseFloat((pos[1] + 0.3).toFixed(2)), parseFloat(pos[2].toFixed(2))],
        color: "#ffa500",
        intensity: 4.0,
        distance: 20,
      };

      const updatedLights = [...lighting.pointLights, newLight];
      updateLighting({ pointLights: updatedLights });
      onSelectLight(newLight.id);
    } catch (e) {
      console.error("Failed to get player position to add light:", e);
    }
  };

  const handleDeleteLight = (): void => {
    if (!selectedLightId) return;
    const updatedLights = lighting.pointLights.filter((l) => l.id !== selectedLightId);
    updateLighting({ pointLights: updatedLights });
    onSelectLight(null);
  };

  const selectedLight = lighting.pointLights.find((l) => l.id === selectedLightId);

  const updateSelectedLight = (updates: Partial<PointLightData>): void => {
    if (!selectedLightId) return;
    const updatedLights = lighting.pointLights.map((l) => {
      if (l.id === selectedLightId) {
        return { ...l, ...updates };
      }
      return l;
    });
    updateLighting({ pointLights: updatedLights });
  };

  // UI styles
  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    top: 15,
    left: 15,
    width: "320px",
    maxHeight: "calc(100vh - 30px)",
    background: "rgba(10, 5, 12, 0.88)",
    border: "2px solid #9933cc",
    borderRadius: "8px",
    boxShadow: "0 0 25px rgba(153, 51, 204, 0.4)",
    backdropFilter: "blur(12px)",
    color: "#fff",
    fontFamily: "'Courier New', monospace",
    display: "flex",
    flexDirection: "column",
    zIndex: 10001,
    overflowY: "auto",
    boxSizing: "border-box",
  };

  const headerStyle: React.CSSProperties = {
    padding: "16px",
    borderBottom: "2px solid #9933cc",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: "18px",
    fontWeight: "bold",
    color: "#dd88ff",
    textShadow: "0 0 8px rgba(221, 136, 255, 0.6)",
    letterSpacing: "1px",
  };

  const tabContainerStyle: React.CSSProperties = {
    display: "flex",
    borderBottom: "1px solid #442266",
  };

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "10px",
    background: active ? "rgba(153, 51, 204, 0.25)" : "transparent",
    border: "none",
    color: active ? "#fff" : "#888",
    fontFamily: "inherit",
    fontSize: "12px",
    fontWeight: "bold",
    cursor: "pointer",
    borderBottom: active ? "2px solid #dd88ff" : "none",
    transition: "all 0.2s",
  });

  const contentStyle: React.CSSProperties = {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    color: "#aa99cc",
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "4px",
  };

  const sliderStyle: React.CSSProperties = {
    width: "100%",
    accentColor: "#9933cc",
    cursor: "pointer",
  };

  const colorInputStyle: React.CSSProperties = {
    width: "100%",
    height: "28px",
    background: "transparent",
    border: "1px solid #442266",
    borderRadius: "4px",
    cursor: "pointer",
    padding: 0,
  };

  const lightListStyle: React.CSSProperties = {
    maxHeight: "140px",
    overflowY: "auto",
    border: "1px solid #442266",
    borderRadius: "4px",
    background: "rgba(0,0,0,0.3)",
    padding: "4px",
  };

  const lightItemStyle = (isSelected: boolean): React.CSSProperties => ({
    padding: "6px 8px",
    fontSize: "11px",
    cursor: "pointer",
    borderRadius: "3px",
    background: isSelected ? "rgba(153, 51, 204, 0.3)" : "transparent",
    border: isSelected ? "1px solid #dd88ff" : "1px solid transparent",
    color: isSelected ? "#fff" : "#ccc",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "2px",
  });

  const buttonStyle = (variant: "primary" | "secondary" | "danger"): React.CSSProperties => ({
    padding: "10px 14px",
    background: variant === "primary" ? "#224422" : variant === "danger" ? "#551111" : "#222233",
    border: `1px solid ${variant === "primary" ? "#33aa33" : variant === "danger" ? "#bb2222" : "#444466"}`,
    borderRadius: "4px",
    color: variant === "primary" ? "#55ff55" : variant === "danger" ? "#ff4444" : "#ccc",
    fontFamily: "inherit",
    fontSize: "11px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "all 0.15s",
    textAlign: "center",
  });

  return (
    <div style={overlayStyle} onMouseDown={(e) => e.stopPropagation()}>
      {/* Header */}
      <div style={headerStyle}>
        <h3 style={titleStyle}>💡 LIGHTS EDITOR</h3>
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

      {/* Tabs */}
      <div style={tabContainerStyle}>
        <button style={tabButtonStyle(activeTab === "global")} onClick={() => setActiveTab("global")}>
          GLOBAL LIGHTS
        </button>
        <button style={tabButtonStyle(activeTab === "lights")} onClick={() => setActiveTab("lights")}>
          POINT LIGHTS ({lighting.pointLights.length})
        </button>
      </div>

      {/* Tab Contents */}
      <div style={contentStyle}>
        {activeTab === "global" && (
          <>
            {/* Ambient Intensity */}
            <div>
              <div style={labelStyle}>
                <span>AMBIENT INTENSITY</span>
                <span style={{ color: "#dd88ff", fontWeight: "bold" }}>{lighting.ambientIntensity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="4.0"
                step="0.05"
                value={lighting.ambientIntensity}
                onChange={(e) => updateLighting({ ambientIntensity: parseFloat(e.target.value) })}
                style={sliderStyle}
              />
            </div>

            {/* Ambient Color */}
            <div>
              <div style={labelStyle}>
                <span>AMBIENT COLOR</span>
                <span style={{ color: "#dd88ff", fontFamily: "monospace" }}>{lighting.ambientColor.toUpperCase()}</span>
              </div>
              <input
                type="color"
                value={lighting.ambientColor}
                onChange={(e) => updateLighting({ ambientColor: e.target.value })}
                style={colorInputStyle}
              />
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #442266", margin: "6px 0" }} />

            {/* Hemisphere Intensity */}
            <div>
              <div style={labelStyle}>
                <span>HEMISPHERE INTENSITY</span>
                <span style={{ color: "#dd88ff", fontWeight: "bold" }}>{lighting.hemisphereIntensity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="3.0"
                step="0.05"
                value={lighting.hemisphereIntensity}
                onChange={(e) => updateLighting({ hemisphereIntensity: parseFloat(e.target.value) })}
                style={sliderStyle}
              />
            </div>

            {/* Hemisphere Sky Color */}
            <div>
              <div style={labelStyle}>
                <span>HEMISPHERE SKY (TOP)</span>
                <span style={{ color: "#dd88ff" }}>{lighting.hemisphereSkyColor.toUpperCase()}</span>
              </div>
              <input
                type="color"
                value={lighting.hemisphereSkyColor}
                onChange={(e) => updateLighting({ hemisphereSkyColor: e.target.value })}
                style={colorInputStyle}
              />
            </div>

            {/* Hemisphere Ground Color */}
            <div>
              <div style={labelStyle}>
                <span>HEMISPHERE GROUND (BOTTOM)</span>
                <span style={{ color: "#dd88ff" }}>{lighting.hemisphereGroundColor.toUpperCase()}</span>
              </div>
              <input
                type="color"
                value={lighting.hemisphereGroundColor}
                onChange={(e) => updateLighting({ hemisphereGroundColor: e.target.value })}
                style={colorInputStyle}
              />
            </div>
          </>
        )}

        {activeTab === "lights" && (
          <>
            <button style={buttonStyle("secondary")} onClick={handleAddLight}>
              ➕ PLACE LIGHT AT MY POSITION
            </button>

            {/* Lights list */}
            <div>
              <div style={labelStyle}>SELECT LIGHT (OR CLICK SFX SFHERES IN 3D)</div>
              <div style={lightListStyle}>
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
                      <span>
                        💡 Light #{index + 1} ({l.id.substring(0, 8)})
                      </span>
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

                {/* Light Color */}
                <div>
                  <div style={labelStyle}>
                    <span>COLOR</span>
                    <span>{selectedLight.color.toUpperCase()}</span>
                  </div>
                  <input
                    type="color"
                    value={selectedLight.color}
                    onChange={(e) => updateSelectedLight({ color: e.target.value })}
                    style={colorInputStyle}
                  />
                </div>

                {/* Light Intensity */}
                <div>
                  <div style={labelStyle}>
                    <span>INTENSITY</span>
                    <span style={{ color: "#dd88ff", fontWeight: "bold" }}>{selectedLight.intensity.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="15.0"
                    step="0.1"
                    value={selectedLight.intensity}
                    onChange={(e) => updateSelectedLight({ intensity: parseFloat(e.target.value) })}
                    style={sliderStyle}
                  />
                </div>

                {/* Light Distance */}
                <div>
                  <div style={labelStyle}>
                    <span>DISTANCE RANGE</span>
                    <span style={{ color: "#dd88ff", fontWeight: "bold" }}>{selectedLight.distance}m</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={selectedLight.distance}
                    onChange={(e) => updateSelectedLight({ distance: parseInt(e.target.value, 10) })}
                    style={sliderStyle}
                  />
                </div>

                {/* Light Position: X */}
                <div>
                  <div style={labelStyle}>
                    <span>POSITION X</span>
                    <span style={{ color: "#dd88ff" }}>{selectedLight.position[0].toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-5.0"
                    max="55.0"
                    step="0.1"
                    value={selectedLight.position[0]}
                    onChange={(e) =>
                      updateSelectedLight({
                        position: [parseFloat(e.target.value), selectedLight.position[1], selectedLight.position[2]],
                      })
                    }
                    style={sliderStyle}
                  />
                </div>

                {/* Light Position: Y */}
                <div>
                  <div style={labelStyle}>
                    <span>POSITION Y (HEIGHT)</span>
                    <span style={{ color: "#dd88ff" }}>{selectedLight.position[1].toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.05"
                    value={selectedLight.position[1]}
                    onChange={(e) =>
                      updateSelectedLight({
                        position: [selectedLight.position[0], parseFloat(e.target.value), selectedLight.position[2]],
                      })
                    }
                    style={sliderStyle}
                  />
                </div>

                {/* Light Position: Z */}
                <div>
                  <div style={labelStyle}>
                    <span>POSITION Z</span>
                    <span style={{ color: "#dd88ff" }}>{selectedLight.position[2].toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-5.0"
                    max="55.0"
                    step="0.1"
                    value={selectedLight.position[2]}
                    onChange={(e) =>
                      updateSelectedLight({
                        position: [selectedLight.position[0], selectedLight.position[1], parseFloat(e.target.value)],
                      })
                    }
                    style={sliderStyle}
                  />
                </div>
              </div>
            )}
          </>
        )}

        <hr style={{ border: "none", borderTop: "1px solid #442266", margin: "6px 0" }} />

        {/* Footer Actions */}
        <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
          <button style={{ ...buttonStyle("primary"), flex: 1 }} onClick={onSave}>
            💾 SAVE LIGHTING
          </button>
          <button style={{ ...buttonStyle("secondary"), flex: 1 }} onClick={onClose}>
            DONE
          </button>
        </div>
      </div>
    </div>
  );
}

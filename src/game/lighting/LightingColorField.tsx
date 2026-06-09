import React from "react";
import { lightingEditorStyles } from "./lightingEditorStyles";

interface LightingColorFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export default function LightingColorField({
  label,
  value,
  onChange,
}: LightingColorFieldProps): React.JSX.Element {
  return (
    <div>
      <div style={lightingEditorStyles.label}>
        <span>{label}</span>
        <span style={{ color: "#dd88ff", fontFamily: "monospace" }}>{value.toUpperCase()}</span>
      </div>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={lightingEditorStyles.colorInput}
      />
    </div>
  );
}

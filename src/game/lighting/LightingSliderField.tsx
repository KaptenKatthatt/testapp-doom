import React from "react";
import { lightingEditorStyles } from "./lightingEditorStyles";

interface LightingSliderFieldProps {
  readonly label: string;
  readonly value: number;
  readonly displayValue: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
}

export default function LightingSliderField({
  label,
  value,
  displayValue,
  min,
  max,
  step,
  onChange,
}: LightingSliderFieldProps): React.JSX.Element {
  return (
    <div>
      <div style={lightingEditorStyles.label}>
        <span>{label}</span>
        <span style={{ color: "#dd88ff", fontWeight: "bold" }}>{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={lightingEditorStyles.slider}
      />
    </div>
  );
}

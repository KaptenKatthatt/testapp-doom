import type React from "react";

export const lightingEditorStyles = {
  overlay: {
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
  } satisfies React.CSSProperties,

  header: {
    padding: "16px",
    borderBottom: "2px solid #9933cc",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } satisfies React.CSSProperties,

  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "bold",
    color: "#dd88ff",
    textShadow: "0 0 8px rgba(221, 136, 255, 0.6)",
    letterSpacing: "1px",
  } satisfies React.CSSProperties,

  tabContainer: {
    display: "flex",
    borderBottom: "1px solid #442266",
  } satisfies React.CSSProperties,

  content: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  } satisfies React.CSSProperties,

  label: {
    fontSize: "11px",
    color: "#aa99cc",
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "4px",
  } satisfies React.CSSProperties,

  slider: {
    width: "100%",
    accentColor: "#9933cc",
    cursor: "pointer",
  } satisfies React.CSSProperties,

  colorInput: {
    width: "100%",
    height: "28px",
    background: "transparent",
    border: "1px solid #442266",
    borderRadius: "4px",
    cursor: "pointer",
    padding: 0,
  } satisfies React.CSSProperties,

  lightList: {
    maxHeight: "140px",
    overflowY: "auto",
    border: "1px solid #442266",
    borderRadius: "4px",
    background: "rgba(0,0,0,0.3)",
    padding: "4px",
  } satisfies React.CSSProperties,

  divider: {
    border: "none",
    borderTop: "1px solid #442266",
    margin: "6px 0",
  } satisfies React.CSSProperties,
};

export function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
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
  };
}

export function lightItemStyle(isSelected: boolean): React.CSSProperties {
  return {
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
  };
}

export function editorButtonStyle(variant: "primary" | "secondary" | "danger"): React.CSSProperties {
  return {
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
  };
}

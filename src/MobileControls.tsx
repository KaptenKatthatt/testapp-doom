import { useRef, useCallback, useState, useEffect } from "react";

interface MobileControlsProps {
  readonly onMove: (dx: number, dy: number) => void;
  readonly onLook: (dx: number, dy: number) => void;
  readonly onShootStart: () => void;
  readonly onShootEnd: () => void;
  readonly onUse: () => void;
}

interface JoystickVisual {
  active: boolean;
  originX: number;
  originY: number;
  knobX: number;
  knobY: number;
}

const JOYSTICK_RADIUS = 55;
const RING_SIZE = JOYSTICK_RADIUS * 2;
const KNOB_SIZE = 46;

function getZoneLocal(clientX: number, clientY: number, el: HTMLDivElement): [number, number] {
  const rect = el.getBoundingClientRect();
  return [clientX - rect.left, clientY - rect.top];
}

function clampToZone(x: number, y: number, el: HTMLDivElement): [number, number] {
  const rect = el.getBoundingClientRect();
  return [
    Math.max(JOYSTICK_RADIUS, Math.min(rect.width - JOYSTICK_RADIUS, x)),
    Math.max(JOYSTICK_RADIUS, Math.min(rect.height - JOYSTICK_RADIUS, y)),
  ];
}

function computeKnob(localX: number, localY: number, ox: number, oy: number): { knobX: number; knobY: number; nx: number; ny: number } {
  const dx = localX - ox;
  const dy = localY - oy;
  const len = Math.sqrt(dx * dx + dy * dy);
  const clamped = Math.min(len, JOYSTICK_RADIUS);
  const scale = len > 0 ? clamped / len : 0;
  const cdx = dx * scale;
  const cdy = dy * scale;
  return {
    knobX: ox + cdx,
    knobY: oy + cdy,
    nx: cdx / JOYSTICK_RADIUS,
    ny: cdy / JOYSTICK_RADIUS,
  };
}

export default function MobileControls({
  onMove,
  onLook,
  onShootStart,
  onShootEnd,
  onUse,
}: MobileControlsProps): React.JSX.Element {
  const [isMobile, setIsMobile] = useState(false);
  const [moveJoystick, setMoveJoystick] = useState<JoystickVisual>({
    active: false, originX: 0, originY: 0, knobX: 0, knobY: 0,
  });
  const [lookJoystick, setLookJoystick] = useState<JoystickVisual>({
    active: false, originX: 0, originY: 0, knobX: 0, knobY: 0,
  });

  const moveTouchIdRef = useRef<number | null>(null);
  const lookTouchIdRef = useRef<number | null>(null);
  const moveOriginRef = useRef<{ x: number; y: number } | null>(null);
  const lookOriginRef = useRef<{ x: number; y: number } | null>(null);
  const moveZoneRef = useRef<HTMLDivElement>(null);
  const lookZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMobile("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  // ── Move zone handlers ──────────────────────────────────────────────────────

  const handleMoveStart = useCallback((e: React.TouchEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (moveTouchIdRef.current !== null || !moveZoneRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const [lx, ly] = getZoneLocal(touch.clientX, touch.clientY, moveZoneRef.current);
    const [ox, oy] = clampToZone(lx, ly, moveZoneRef.current);
    moveTouchIdRef.current = touch.identifier;
    moveOriginRef.current = { x: ox, y: oy };
    setMoveJoystick({ active: true, originX: ox, originY: oy, knobX: ox, knobY: oy });
  }, []);

  const handleMoveMove = useCallback((e: React.TouchEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (moveTouchIdRef.current === null || !moveOriginRef.current || !moveZoneRef.current) return;
    const touch = Array.from(e.touches).find(t => t.identifier === moveTouchIdRef.current);
    if (!touch) return;
    const [lx, ly] = getZoneLocal(touch.clientX, touch.clientY, moveZoneRef.current);
    const { x: ox, y: oy } = moveOriginRef.current;
    const { knobX, knobY, nx, ny } = computeKnob(lx, ly, ox, oy);
    onMove(nx, ny);
    setMoveJoystick(prev => ({ ...prev, knobX, knobY }));
  }, [onMove]);

  const handleMoveEnd = useCallback((e: React.TouchEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (!Array.from(e.changedTouches).some(t => t.identifier === moveTouchIdRef.current)) return;
    moveTouchIdRef.current = null;
    moveOriginRef.current = null;
    onMove(0, 0);
    setMoveJoystick(prev => ({ ...prev, active: false }));
  }, [onMove]);

  // ── Look zone handlers ──────────────────────────────────────────────────────

  const handleLookStart = useCallback((e: React.TouchEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (lookTouchIdRef.current !== null || !lookZoneRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const [lx, ly] = getZoneLocal(touch.clientX, touch.clientY, lookZoneRef.current);
    const [ox, oy] = clampToZone(lx, ly, lookZoneRef.current);
    lookTouchIdRef.current = touch.identifier;
    lookOriginRef.current = { x: ox, y: oy };
    setLookJoystick({ active: true, originX: ox, originY: oy, knobX: ox, knobY: oy });
  }, []);

  const handleLookMove = useCallback((e: React.TouchEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (lookTouchIdRef.current === null || !lookOriginRef.current || !lookZoneRef.current) return;
    const touch = Array.from(e.touches).find(t => t.identifier === lookTouchIdRef.current);
    if (!touch) return;
    const [lx, ly] = getZoneLocal(touch.clientX, touch.clientY, lookZoneRef.current);
    const { x: ox, y: oy } = lookOriginRef.current;
    const { knobX, knobY, nx, ny } = computeKnob(lx, ly, ox, oy);
    onLook(nx, ny);
    setLookJoystick(prev => ({ ...prev, knobX, knobY }));
  }, [onLook]);

  const handleLookEnd = useCallback((e: React.TouchEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (!Array.from(e.changedTouches).some(t => t.identifier === lookTouchIdRef.current)) return;
    lookTouchIdRef.current = null;
    lookOriginRef.current = null;
    onLook(0, 0);
    setLookJoystick(prev => ({ ...prev, active: false }));
  }, [onLook]);

  if (!isMobile) return <></>;

  const ringStyle = (j: JoystickVisual): React.CSSProperties => ({
    position: "absolute",
    left: j.originX - JOYSTICK_RADIUS,
    top: j.originY - JOYSTICK_RADIUS,
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.08)",
    border: "2px solid rgba(255, 255, 255, 0.35)",
    pointerEvents: "none",
    overflow: "visible",
  });

  const knobStyle = (j: JoystickVisual): React.CSSProperties => ({
    position: "absolute",
    left: (j.knobX - j.originX) + JOYSTICK_RADIUS - KNOB_SIZE / 2,
    top: (j.knobY - j.originY) + JOYSTICK_RADIUS - KNOB_SIZE / 2,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.45)",
    pointerEvents: "none",
  });

  return (
    <>
      {/* Left zone – movement */}
      <div
        ref={moveZoneRef}
        data-testid="move-zone"
        onTouchStart={handleMoveStart}
        onTouchMove={handleMoveMove}
        onTouchEnd={handleMoveEnd}
        onTouchCancel={handleMoveEnd}
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: "50%",
          height: "70%",
          zIndex: 15,
          touchAction: "none",
        }}
      >
        {moveJoystick.active && (
          <div style={ringStyle(moveJoystick)}>
            <div style={knobStyle(moveJoystick)} />
          </div>
        )}
      </div>

      {/* Right zone – look */}
      <div
        ref={lookZoneRef}
        data-testid="look-zone"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: "50%",
          height: "70%",
          zIndex: 15,
          touchAction: "none",
        }}
      >
        {lookJoystick.active && (
          <div style={ringStyle(lookJoystick)}>
            <div style={knobStyle(lookJoystick)} />
          </div>
        )}
      </div>

      {/* Use button (E key) */}
      <button
        data-testid="use-button"
        onTouchStart={(e: React.TouchEvent<HTMLButtonElement>): void => {
          e.preventDefault();
          onUse();
        }}
        onTouchEnd={(e: React.TouchEvent<HTMLButtonElement>): void => {
          e.preventDefault();
        }}
        onTouchCancel={(e: React.TouchEvent<HTMLButtonElement>): void => {
          e.preventDefault();
        }}
        onClick={(): void => onUse()}
        style={{
          position: "absolute",
          right: 110,
          bottom: 25,
          width: 70,
          height: 70,
          borderRadius: "50%",
          background: "rgba(60, 180, 255, 0.5)",
          border: "3px solid rgba(100, 200, 255, 0.8)",
          color: "#fff",
          cursor: "pointer",
          zIndex: 20,
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          fontSize: 18,
          fontWeight: "bold",
          fontFamily: "monospace",
        }}
      >
        USE
      </button>

      {/* Shoot button */}
      <button
        data-testid="shoot-button"
        onTouchStart={(e: React.TouchEvent<HTMLButtonElement>): void => {
          e.preventDefault();
          onShootStart();
        }}
        onTouchEnd={(e: React.TouchEvent<HTMLButtonElement>): void => {
          e.preventDefault();
          onShootEnd();
        }}
        onTouchCancel={(e: React.TouchEvent<HTMLButtonElement>): void => {
          e.preventDefault();
          onShootEnd();
        }}
        style={{
          position: "absolute",
          right: 20,
          bottom: 20,
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: "rgba(255, 60, 60, 0.5)",
          border: "3px solid rgba(255, 100, 100, 0.8)",
          color: "#fff",
          cursor: "pointer",
          zIndex: 20,
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="18" y="8" width="20" height="6" rx="2" fill="#fff" />
          <rect x="8" y="8" width="12" height="14" rx="2" fill="#fff" />
          <rect x="10" y="22" width="6" height="8" rx="1" fill="#fff" />
          <rect x="6" y="18" width="8" height="16" rx="2" fill="#ddd" />
          <circle cx="40" cy="11" r="3" fill="#ff0" opacity="0.8" />
        </svg>
      </button>
    </>
  );
}

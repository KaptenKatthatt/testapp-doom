import { useRef, useCallback, useState, useEffect } from "react";
import type { WeaponType } from "./types";

interface MobileControlsProps {
  readonly onMove: (dx: number, dy: number) => void;
  readonly onLook: (dx: number, dy: number) => void;
  readonly onShootStart: () => void;
  readonly onShootEnd: () => void;
  readonly onUse: () => void;
  readonly onWeaponSelect: (weapon: WeaponType) => void;
  readonly onReload: () => void;
  readonly currentWeapon: WeaponType;
  readonly unlockedShotgun: boolean;
  readonly revolverReloading: boolean;
  readonly machinegunReloading: boolean;
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
const WEAPON_ORDER: WeaponType[] = ["revolver", "shotgun", "machinegun"];
const WEAPON_LABELS: Record<WeaponType, string> = {
  revolver: "REV",
  shotgun: "SG",
  machinegun: "MG",
};

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
  onWeaponSelect,
  onReload,
  currentWeapon,
  unlockedShotgun,
  revolverReloading,
  machinegunReloading,
}: MobileControlsProps): React.JSX.Element {
  const [isMobile, setIsMobile] = useState(false);
  const [weaponPickerOpen, setWeaponPickerOpen] = useState(false);
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
  const weaponLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weaponLongPressTriggeredRef = useRef(false);
  const lastWeaponPointerActionRef = useRef(0);
  const lastReloadPointerActionRef = useRef(0);

  useEffect(() => {
    const updateMobileFlag = (): void => {
      setIsMobile("ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 768);
    };
    updateMobileFlag();
    window.addEventListener("resize", updateMobileFlag);
    return () => window.removeEventListener("resize", updateMobileFlag);
  }, []);

  // ── Move zone handlers ──────────────────────────────────────────────────────

  const getAvailableWeapons = useCallback((): WeaponType[] => {
    return WEAPON_ORDER.filter((weapon) => weapon !== "shotgun" || unlockedShotgun);
  }, [unlockedShotgun]);

  const cycleWeapon = useCallback((): void => {
    const availableWeapons = getAvailableWeapons();
    const currentIndex = availableWeapons.indexOf(currentWeapon);
    const nextWeapon = availableWeapons[(currentIndex + 1) % availableWeapons.length] ?? "revolver";
    onWeaponSelect(nextWeapon);
  }, [currentWeapon, getAvailableWeapons, onWeaponSelect]);

  const clearWeaponLongPressTimer = useCallback((): void => {
    if (weaponLongPressTimerRef.current) {
      clearTimeout(weaponLongPressTimerRef.current);
      weaponLongPressTimerRef.current = null;
    }
  }, []);

  const handleWeaponPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    weaponLongPressTriggeredRef.current = false;
    clearWeaponLongPressTimer();
    weaponLongPressTimerRef.current = setTimeout(() => {
      weaponLongPressTriggeredRef.current = true;
      setWeaponPickerOpen(true);
    }, 350);
  }, [clearWeaponLongPressTimer]);

  const handleWeaponPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    clearWeaponLongPressTimer();
    if (weaponLongPressTriggeredRef.current) return;
    lastWeaponPointerActionRef.current = performance.now();
    if (weaponPickerOpen) {
      setWeaponPickerOpen(false);
      return;
    }
    cycleWeapon();
  }, [clearWeaponLongPressTimer, cycleWeapon, weaponPickerOpen]);

  const handleWeaponPointerCancel = useCallback((e: React.PointerEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    clearWeaponLongPressTimer();
  }, [clearWeaponLongPressTimer]);

  const handleWeaponClick = useCallback((e: React.MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (performance.now() - lastWeaponPointerActionRef.current < 250) return;
    if (weaponPickerOpen) {
      setWeaponPickerOpen(false);
      return;
    }
    cycleWeapon();
  }, [cycleWeapon, weaponPickerOpen]);

  const handleReloadAction = useCallback((): void => {
    lastReloadPointerActionRef.current = performance.now();
    onReload();
  }, [onReload]);

  const handleReloadClick = useCallback((e: React.MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (performance.now() - lastReloadPointerActionRef.current < 250) return;
    onReload();
  }, [onReload]);

  useEffect(() => clearWeaponLongPressTimer, [clearWeaponLongPressTimer]);

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

  const commandButtonBase: React.CSSProperties = {
    position: "absolute",
    borderRadius: "50%",
    color: "#fff",
    cursor: "pointer",
    zIndex: 21,
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "monospace",
    textShadow: "0 1px 2px #000",
  };

  const reloadActive = currentWeapon === "revolver"
    ? revolverReloading
    : currentWeapon === "machinegun" && machinegunReloading;

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

      {/* Use button (E key) — CoD style: above shoot button */}
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
          right: 24,
          bottom: 140,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "rgba(60, 180, 255, 0.45)",
          border: "2px solid rgba(100, 200, 255, 0.7)",
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
          fontSize: 14,
          fontWeight: "bold",
          fontFamily: "monospace",
        }}
      >
        USE
      </button>

      {/* Weapon and reload buttons */}
      <button
        data-testid="weapon-switch-button"
        aria-label="Switch weapon"
        onPointerDown={handleWeaponPointerDown}
        onPointerUp={handleWeaponPointerUp}
        onPointerCancel={handleWeaponPointerCancel}
        onClick={handleWeaponClick}
        style={{
          ...commandButtonBase,
          right: 24,
          bottom: 204,
          width: 56,
          height: 56,
          background: "rgba(255, 190, 40, 0.52)",
          border: "2px solid rgba(255, 220, 90, 0.82)",
          boxShadow: currentWeapon === "shotgun"
            ? "0 0 14px rgba(255, 120, 40, 0.42)"
            : currentWeapon === "machinegun"
              ? "0 0 14px rgba(255, 220, 60, 0.42)"
              : "0 0 14px rgba(255, 255, 255, 0.18)",
        }}
      >
        {WEAPON_LABELS[currentWeapon]}
      </button>

      <button
        data-testid="reload-button"
        aria-label="Reload weapon"
        onPointerDown={(e: React.PointerEvent<HTMLButtonElement>): void => {
          e.preventDefault();
          e.stopPropagation();
          handleReloadAction();
        }}
        onClick={handleReloadClick}
        style={{
          ...commandButtonBase,
          right: 88,
          bottom: 208,
          width: 48,
          height: 48,
          background: reloadActive ? "rgba(255, 80, 30, 0.65)" : "rgba(40, 40, 40, 0.58)",
          border: reloadActive ? "2px solid rgba(255, 130, 80, 0.9)" : "2px solid rgba(180, 180, 180, 0.58)",
          opacity: currentWeapon === "shotgun" ? 0.48 : 1,
        }}
      >
        RLD
      </button>

      {weaponPickerOpen && (
        <div
          data-testid="weapon-picker"
          style={{
            position: "absolute",
            right: 18,
            bottom: 266,
            display: "flex",
            gap: 8,
            zIndex: 22,
            touchAction: "none",
          }}
        >
          {WEAPON_ORDER.map((weapon) => {
            const locked = weapon === "shotgun" && !unlockedShotgun;
            const active = weapon === currentWeapon;
            return (
              <button
                key={weapon}
                data-testid={`weapon-slot-${weapon}`}
                aria-label={`Select ${weapon}`}
                disabled={locked}
                onPointerDown={(e: React.PointerEvent<HTMLButtonElement>): void => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!locked) {
                    onWeaponSelect(weapon);
                    setWeaponPickerOpen(false);
                  }
                }}
                style={{
                  ...commandButtonBase,
                  position: "relative",
                  width: 48,
                  height: 48,
                  background: locked
                    ? "rgba(30, 30, 30, 0.52)"
                    : active
                      ? "rgba(255, 190, 40, 0.82)"
                      : "rgba(20, 10, 10, 0.74)",
                  border: active
                    ? "2px solid rgba(255, 255, 180, 0.95)"
                    : locked
                      ? "2px solid rgba(100, 100, 100, 0.45)"
                      : "2px solid rgba(255, 160, 60, 0.72)",
                  color: locked ? "rgba(255, 255, 255, 0.42)" : "#fff",
                  opacity: locked ? 0.62 : 1,
                }}
              >
                {WEAPON_LABELS[weapon]}
              </button>
            );
          })}
        </div>
      )}

      {/* Shoot button — CoD style: right side, above HUD */}
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
          right: 16,
          bottom: 72,
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

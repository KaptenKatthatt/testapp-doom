import { useRef, useEffect, useCallback, useState } from "react";

interface MobileControlsProps {
  readonly onMove: (dx: number, dy: number) => void;
  readonly onLook: (dx: number) => void;
  readonly onShootStart: () => void;
  readonly onShootEnd: () => void;
}

export default function MobileControls({
  onMove,
  onLook,
  onShootStart,
  onShootEnd,
}: MobileControlsProps): React.JSX.Element {
  const [isMobile, setIsMobile] = useState(false);
  const moveStartRef = useRef<{ x: number; y: number } | null>(null);
  const lookLastRef = useRef<number | null>(null);

  useEffect(() => {
    const hasTouchScreen =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setIsMobile(hasTouchScreen);
  }, []);

  const handleMoveStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>): void => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      moveStartRef.current = { x: touch.clientX, y: touch.clientY };
    },
    [],
  );

  const handleMoveMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>): void => {
      e.preventDefault();
      if (!moveStartRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = (touch.clientX - moveStartRef.current.x) / 60;
      const dy = (touch.clientY - moveStartRef.current.y) / 60;
      onMove(
        Math.max(-1, Math.min(1, dx)),
        Math.max(-1, Math.min(1, dy)),
      );
    },
    [onMove],
  );

  const handleMoveEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>): void => {
      e.preventDefault();
      moveStartRef.current = null;
      onMove(0, 0);
    },
    [onMove],
  );

  const handleLookMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>): void => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      if (lookLastRef.current !== null) {
        const dx = touch.clientX - lookLastRef.current;
        onLook(dx * 0.003);
      }
      lookLastRef.current = touch.clientX;
    },
    [onLook],
  );

  const handleLookEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>): void => {
      e.preventDefault();
      lookLastRef.current = null;
    },
    [],
  );

  if (!isMobile) return <></>;

  return (
    <>
      {/* Left side - Movement joystick */}
      <div
        onTouchStart={handleMoveStart}
        onTouchMove={handleMoveMove}
        onTouchEnd={handleMoveEnd}
        style={{
          position: "absolute",
          left: 0,
          bottom: "12vh",
          width: "50%",
          height: "calc(100% - 12vh)",
          zIndex: 15,
          touchAction: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 40,
            bottom: 40,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.15)",
            border: "2px solid rgba(255, 255, 255, 0.3)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.4)",
              pointerEvents: "none",
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: 30,
            bottom: 20,
            color: "rgba(255,255,255,0.5)",
            fontFamily: "monospace",
            fontSize: 10,
            pointerEvents: "none",
          }}
        >
          MOVE
        </div>
      </div>

      {/* Right side - Look zone */}
      <div
        onTouchStart={(): void => { lookLastRef.current = null; }}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        style={{
          position: "absolute",
          right: 0,
          bottom: "12vh",
          width: "50%",
          height: "calc(100% - 12vh)",
          zIndex: 15,
          touchAction: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: 30,
            bottom: 20,
            color: "rgba(255,255,255,0.5)",
            fontFamily: "monospace",
            fontSize: 10,
            pointerEvents: "none",
          }}
        >
          LOOK
        </div>
      </div>

      {/* Shoot button with pistol SVG icon */}
      <button
        onTouchStart={(e: React.TouchEvent<HTMLButtonElement>): void => {
          e.preventDefault();
          onShootStart();
        }}
        onTouchEnd={(e: React.TouchEvent<HTMLButtonElement>): void => {
          e.preventDefault();
          onShootEnd();
        }}
        style={{
          position: "absolute",
          right: 20,
          bottom: "calc(12vh + 20px)",
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
          {/* Pistol icon - pointed right */}
          {/* Barrel */}
          <rect x="18" y="8" width="20" height="6" rx="2" fill="#fff" />
          {/* Body */}
          <rect x="8" y="8" width="12" height="14" rx="2" fill="#fff" />
          {/* Trigger guard */}
          <rect x="10" y="22" width="6" height="8" rx="1" fill="#fff" />
          {/* Grip */}
          <rect x="6" y="18" width="8" height="16" rx="2" fill="#ddd" />
          {/* Muzzle flash hint */}
          <circle cx="40" cy="11" r="3" fill="#ff0" opacity="0.8" />
        </svg>
      </button>
    </>
  );
}
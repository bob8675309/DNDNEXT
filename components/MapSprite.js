import { useEffect, useMemo, useRef, useState } from "react";

// Lightweight sprite renderer for map pins.
// Renders a single animation row from a sprite sheet using CSS background-position.
//
// Supports either:
// - explicit `row` (number)
// - or `dir` + `dirOrder` (maps direction to row index)
//
// Animation can be driven by:
// - `isAnimated` (legacy)
// - or `moving` (preferred; defaults animation on when moving)
export default function MapSprite({
  spriteUrl,
  frameW = 32,
  frameH = 32,
  row = null,
  dir = null,
  dirOrder = ["down", "left", "right", "up"],
  frames = 3,
  fps = 6,
  scale = 0.75,
  moving = true,
  isAnimated = null,
  className = "",
}) {
  const [frame, setFrame] = useState(0);
  const timerRef = useRef(null);

  const resolvedRow = useMemo(() => {
    if (Number.isFinite(row)) return Math.max(0, Number(row));
    if (!dir) return 0;
    const idx = dirOrder.indexOf(String(dir));
    return Math.max(0, idx);
  }, [row, dir, dirOrder]);

  const animated = useMemo(() => {
    if (typeof isAnimated === "boolean") return isAnimated;
    return !!moving;
  }, [isAnimated, moving]);

  useEffect(() => {
    if (!animated || !spriteUrl || frames <= 1) return;
    const ms = Math.max(80, Math.floor(1000 / Math.max(1, fps)));
    timerRef.current = setInterval(() => {
      setFrame((f) => (f + 1) % frames);
    }, ms);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [animated, spriteUrl, frames, fps]);

  // If not animating, always show frame 0.
  useEffect(() => {
    if (!animated && frame !== 0) setFrame(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated]);

  const style = useMemo(() => {
    const x = -frame * frameW;
    const y = -resolvedRow * frameH;
    return {
      width: frameW,
      height: frameH,
      backgroundImage: spriteUrl ? `url(${spriteUrl})` : "none",
      backgroundRepeat: "no-repeat",
      backgroundPosition: `${x}px ${y}px`,
      imageRendering: "pixelated",
      transform: `scale(${scale})`,
      transformOrigin: "center center",
      pointerEvents: "none",
    };
  }, [spriteUrl, frame, frameW, resolvedRow, frameH, scale]);

  return <span className={`map-sprite ${className}`.trim()} style={style} aria-hidden="true" />;
}

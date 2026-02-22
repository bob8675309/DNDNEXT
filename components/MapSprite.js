import { useEffect, useMemo, useRef, useState } from "react";

// Lightweight sprite renderer for map pins.
// Renders a single animation row from a sprite sheet using CSS background-position.
export default function MapSprite({
  spriteUrl,
  frameW = 32,
  frameH = 32,
  row = 0,
  frames = 3,
  fps = 6,
  scale = 0.75,
  isAnimated = true,
  className = "",
}) {
  const [frame, setFrame] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isAnimated || !spriteUrl || frames <= 1) return;
    const ms = Math.max(80, Math.floor(1000 / Math.max(1, fps)));
    timerRef.current = setInterval(() => {
      setFrame((f) => (f + 1) % frames);
    }, ms);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isAnimated, spriteUrl, frames, fps]);

  const style = useMemo(() => {
    const x = -frame * frameW;
    const y = -row * frameH;
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
  }, [spriteUrl, frame, frameW, row, frameH, scale]);

  return <span className={`map-sprite ${className}`.trim()} style={style} aria-hidden="true" />;
}

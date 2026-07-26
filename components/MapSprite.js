import { useEffect, useMemo, useState } from "react";
import { normalizeSpriteAsset, spriteCssFrame } from "../utils/spriteAnimation";

// Shared visual-only sprite renderer. This component never decides movement legality or
// position; callers supply current facing/movement state from their existing movement engine.
export default function MapSprite({
  spriteUrl,
  asset = null,
  direction = "down",
  moving = false,
  scale = null,
  className = "",
  clockMs = null,

  // Legacy props remain accepted during the migration away from 4-direction sheets.
  frameW = null,
  frameH = null,
  row = null,
  dirHint = null,
  dirToRow = null,
  frames = null,
  fps = null,
  isAnimated = null,
}) {
  const [localClock, setLocalClock] = useState(() => Date.now());

  const resolvedAsset = useMemo(() => {
    if (asset) return normalizeSpriteAsset(asset);
    const legacyDirectionOrder = dirToRow
      ? Object.entries(dirToRow).sort((a, b) => Number(a[1]) - Number(b[1])).map(([key]) => key)
      : ["down", "left", "right", "up"];
    return normalizeSpriteAsset({
      sprite_format: "legacy_4dir_3frame_32",
      frame_width: frameW || 32,
      frame_height: frameH || 32,
      direction_order: legacyDirectionOrder,
      idle_frame: 0,
      walk_frames: Array.from({ length: Math.max(1, Number(frames || 3)) }, (_value, index) => index),
      fps: fps || 6,
      overworld_scale: scale || 0.75,
    });
  }, [asset, dirToRow, fps, frameH, frameW, frames, scale]);

  const shouldMove = typeof isAnimated === "boolean" ? isAnimated : moving;
  const hasExternalClock = Number.isFinite(Number(clockMs));

  useEffect(() => {
    if (hasExternalClock || !shouldMove || !spriteUrl) return undefined;
    const interval = Math.max(80, Math.round(1000 / Math.max(1, Number(resolvedAsset.fps || 7))));
    const timer = setInterval(() => setLocalClock(Date.now()), interval);
    return () => clearInterval(timer);
  }, [hasExternalClock, resolvedAsset.fps, shouldMove, spriteUrl]);

  const effectiveDirection = useMemo(() => {
    if (Number.isFinite(Number(row))) {
      return resolvedAsset.direction_order[Math.max(0, Math.min(resolvedAsset.direction_order.length - 1, Number(row)))] || "down";
    }
    return String(direction || dirHint || "down");
  }, [direction, dirHint, resolvedAsset.direction_order, row]);

  const frame = useMemo(() => spriteCssFrame(resolvedAsset, {
    direction: effectiveDirection,
    moving: shouldMove,
    timeMs: hasExternalClock ? Number(clockMs) : localClock,
    scale,
  }), [clockMs, effectiveDirection, hasExternalClock, localClock, resolvedAsset, scale, shouldMove]);

  if (!spriteUrl) return null;

  return (
    <span
      className={`map-sprite ${className}`.trim()}
      style={{
        display: "block",
        width: frame.outerWidth,
        height: frame.outerHeight,
        overflow: "hidden",
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <span
        style={{
          display: "block",
          width: frame.frameWidth,
          height: frame.frameHeight,
          backgroundImage: `url(${spriteUrl})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: `${frame.backgroundX}px ${frame.backgroundY}px`,
          imageRendering: "pixelated",
          transform: `scale(${frame.scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      />
    </span>
  );
}

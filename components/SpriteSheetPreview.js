import { useEffect, useMemo, useState } from "react";

const DEFAULT_DIRECTIONS = Object.freeze([
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right",
  "right",
  "down-right",
]);

function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function normalizeFrames(asset) {
  const idle = Number.isFinite(Number(asset?.idle_frame)) ? Math.max(0, Number(asset.idle_frame)) : 0;
  const walk = Array.isArray(asset?.walk_frames)
    ? asset.walk_frames.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value >= 0)
    : [];
  return { idle, walk: walk.length ? walk : [1, 2, 3] };
}

export default function SpriteSheetPreview({
  asset,
  spriteUrl = "",
  direction = "down",
  walking = true,
  displaySize = 88,
  className = "",
}) {
  const [frameIndex, setFrameIndex] = useState(0);

  const directions = useMemo(() => {
    const rows = Array.isArray(asset?.direction_order) ? asset.direction_order.filter(Boolean).map(String) : [];
    return rows.length ? rows : DEFAULT_DIRECTIONS;
  }, [asset?.direction_order]);

  const frames = useMemo(() => normalizeFrames(asset), [asset]);
  const frameW = positiveInt(asset?.frame_width, 64);
  const frameH = positiveInt(asset?.frame_height, 64);
  const fps = Math.max(1, Number(asset?.fps || 7));
  const availableFrames = walking ? frames.walk : [frames.idle];
  const currentFrame = availableFrames[frameIndex % Math.max(1, availableFrames.length)] ?? frames.idle;
  const maxFrame = Math.max(frames.idle, ...frames.walk, 0);
  const columns = Math.max(1, maxFrame + 1);
  const row = Math.max(0, directions.indexOf(direction));
  const scale = Math.max(0.1, Number(displaySize || 88) / Math.max(frameW, frameH));

  useEffect(() => {
    setFrameIndex(0);
  }, [asset?.id, direction, walking]);

  useEffect(() => {
    if (!walking || availableFrames.length <= 1 || !spriteUrl) return undefined;
    const timer = setInterval(() => setFrameIndex((value) => value + 1), Math.max(80, Math.round(1000 / fps)));
    return () => clearInterval(timer);
  }, [availableFrames.length, fps, spriteUrl, walking]);

  if (!asset || !spriteUrl) {
    return <div className={`sprite-sheet-preview is-empty ${className}`.trim()}>No sprite selected</div>;
  }

  return (
    <div
      className={`sprite-sheet-preview ${className}`.trim()}
      style={{ width: frameW * scale, height: frameH * scale }}
      title={`${direction} • ${walking ? "walking" : "idle"}`}
      aria-label={`${asset.name || "Sprite"} ${direction} ${walking ? "walking preview" : "idle preview"}`}
    >
      <span
        aria-hidden="true"
        style={{
          display: "block",
          width: frameW,
          height: frameH,
          backgroundImage: `url(${spriteUrl})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${frameW * columns}px ${frameH * directions.length}px`,
          backgroundPosition: `${-currentFrame * frameW}px ${-row * frameH}px`,
          imageRendering: "pixelated",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}

export { DEFAULT_DIRECTIONS };

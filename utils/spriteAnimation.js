export const EIGHT_DIRECTION_ORDER = Object.freeze([
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right",
  "right",
  "down-right",
]);

export const DEFAULT_SPRITE_ASSET = Object.freeze({
  sprite_format: "eight_direction_idle_walk_v1",
  frame_width: 64,
  frame_height: 64,
  direction_order: EIGHT_DIRECTION_ORDER,
  idle_frame: 0,
  walk_frames: Object.freeze([1, 2, 3]),
  fps: 7,
  overworld_scale: 0.35,
  tactical_scale: 1,
});

const EAST_CLOCKWISE_DIRECTIONS = Object.freeze([
  "right",
  "down-right",
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right",
]);

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback;
}

export function normalizeSpriteAsset(asset = {}) {
  const directionOrder = Array.isArray(asset?.direction_order) && asset.direction_order.length
    ? asset.direction_order.map((value) => String(value))
    : [...EIGHT_DIRECTION_ORDER];
  const walkFrames = Array.isArray(asset?.walk_frames) && asset.walk_frames.length
    ? asset.walk_frames.map((value) => nonNegativeInt(value, 0))
    : [1, 2, 3];
  return {
    ...DEFAULT_SPRITE_ASSET,
    ...asset,
    frame_width: Math.round(positiveNumber(asset?.frame_width, 64)),
    frame_height: Math.round(positiveNumber(asset?.frame_height, 64)),
    direction_order: directionOrder,
    idle_frame: nonNegativeInt(asset?.idle_frame, 0),
    walk_frames: walkFrames,
    fps: positiveNumber(asset?.fps, 7),
    overworld_scale: positiveNumber(asset?.overworld_scale ?? asset?.default_scale, 0.35),
    tactical_scale: positiveNumber(asset?.tactical_scale, 1),
  };
}

export function spriteDirectionFromVelocity(vx, vy, fallback = "down", deadzone = 0.00005) {
  const dx = Number(vx || 0);
  const dy = Number(vy || 0);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return fallback;
  if (Math.abs(dx) < deadzone && Math.abs(dy) < deadzone) return fallback;

  let degrees = Math.atan2(dy, dx) * (180 / Math.PI);
  if (degrees < 0) degrees += 360;
  const octant = Math.round(degrees / 45) % 8;
  return EAST_CLOCKWISE_DIRECTIONS[octant] || fallback;
}

export function spriteRowForDirection(asset, direction, fallback = "down") {
  const normalized = normalizeSpriteAsset(asset);
  const requested = String(direction || fallback);
  const requestedIndex = normalized.direction_order.indexOf(requested);
  if (requestedIndex >= 0) return requestedIndex;
  const fallbackIndex = normalized.direction_order.indexOf(fallback);
  return fallbackIndex >= 0 ? fallbackIndex : 0;
}

export function spriteFrameForTime(asset, { moving = false, timeMs = 0 } = {}) {
  const normalized = normalizeSpriteAsset(asset);
  if (!moving || !normalized.walk_frames.length) return normalized.idle_frame;
  const frameMs = Math.max(80, Math.round(1000 / normalized.fps));
  const index = Math.floor(Math.max(0, Number(timeMs || 0)) / frameMs) % normalized.walk_frames.length;
  return normalized.walk_frames[index];
}

export function spriteSheetColumnCount(asset) {
  const normalized = normalizeSpriteAsset(asset);
  return Math.max(normalized.idle_frame, ...normalized.walk_frames, 0) + 1;
}

export function spriteCssFrame(asset, { direction = "down", moving = false, timeMs = 0, scale = null } = {}) {
  const normalized = normalizeSpriteAsset(asset);
  const row = spriteRowForDirection(normalized, direction);
  const frame = spriteFrameForTime(normalized, { moving, timeMs });
  const resolvedScale = positiveNumber(scale, normalized.overworld_scale);
  return {
    frameWidth: normalized.frame_width,
    frameHeight: normalized.frame_height,
    columns: spriteSheetColumnCount(normalized),
    rows: normalized.direction_order.length,
    row,
    frame,
    scale: resolvedScale,
    outerWidth: normalized.frame_width * resolvedScale,
    outerHeight: normalized.frame_height * resolvedScale,
    backgroundX: -frame * normalized.frame_width,
    backgroundY: -row * normalized.frame_height,
  };
}

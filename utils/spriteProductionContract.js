export const SPRITE_DIRECTION_ORDER = Object.freeze([
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right",
  "right",
  "down-right",
]);

export const SPRITE_DIRECTION_LABELS = Object.freeze({
  down: "South",
  "down-left": "Southwest",
  left: "West",
  "up-left": "Northwest",
  up: "North",
  "up-right": "Northeast",
  right: "East",
  "down-right": "Southeast",
});

export const SPRITE_FRAME_LABELS = Object.freeze([
  "Idle",
  "Walk A",
  "Walk B",
  "Walk C",
]);

export const SPRITE_FRAME_WIDTH = 64;
export const SPRITE_FRAME_HEIGHT = 64;
export const SPRITE_COLUMNS = 4;
export const SPRITE_ROWS = 8;
export const SPRITE_SHEET_WIDTH = SPRITE_FRAME_WIDTH * SPRITE_COLUMNS;
export const SPRITE_SHEET_HEIGHT = SPRITE_FRAME_HEIGHT * SPRITE_ROWS;
export const SPRITE_WALK_SEQUENCE = Object.freeze([0, 1, 2, 3, 2, 1]);
export const SPRITE_FPS = 7;

export function spriteCellStyle({ row, column, scale = 1 }) {
  const safeScale = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : 1;
  return {
    width: SPRITE_FRAME_WIDTH * safeScale,
    height: SPRITE_FRAME_HEIGHT * safeScale,
    backgroundSize: `${SPRITE_SHEET_WIDTH * safeScale}px ${SPRITE_SHEET_HEIGHT * safeScale}px`,
    backgroundPosition: `${-column * SPRITE_FRAME_WIDTH * safeScale}px ${-row * SPRITE_FRAME_HEIGHT * safeScale}px`,
  };
}

export function validateSpriteDimensions(width, height) {
  const errors = [];
  if (Number(width) !== SPRITE_SHEET_WIDTH || Number(height) !== SPRITE_SHEET_HEIGHT) {
    errors.push(`Sheet must be exactly ${SPRITE_SHEET_WIDTH}×${SPRITE_SHEET_HEIGHT}px.`);
  }
  return errors;
}

export function validateSpriteTransparency(alphaValues = []) {
  if (!Array.isArray(alphaValues) || !alphaValues.length) return ["Transparency could not be inspected."];
  return alphaValues.some((value) => Number(value) < 250)
    ? []
    : ["No transparent pixels were detected."];
}

export function spriteRuntimeMetadata() {
  return {
    sprite_format: "eight_direction_idle_walk_v1",
    frame_width: SPRITE_FRAME_WIDTH,
    frame_height: SPRITE_FRAME_HEIGHT,
    direction_order: [...SPRITE_DIRECTION_ORDER],
    idle_frame: 0,
    walk_frames: [1, 2, 3],
    fps: SPRITE_FPS,
  };
}

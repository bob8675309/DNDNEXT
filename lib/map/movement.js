// lib/map/movement.js
// Pure helpers for the new movement system (segment timing + interpolation).
// Keep this file React/Supabase-free.

import { clamp01, lerp } from "./coords";

export function tsToMs(ts) {
  if (!ts) return null;
  const ms = new Date(ts).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Compute normalized segment progress in [0,1].
 * Returns null when the segment is not valid.
 */
export function computeProgress(renderWorldMs, segStartMs, segEndMs) {
  if (renderWorldMs == null || segStartMs == null || segEndMs == null) return null;
  if (!Number.isFinite(renderWorldMs) || !Number.isFinite(segStartMs) || !Number.isFinite(segEndMs)) return null;
  if (segEndMs <= segStartMs) return null;
  const total = segEndMs - segStartMs;
  const elapsed = renderWorldMs - segStartMs;
  return clamp01(elapsed / total);
}

/**
 * Interpolate between endpoints (a -> b) in 0..100 space.
 */
export function lerpXY(a, b, t) {
  if (!a || !b) return null;
  const x = lerp(a.x, b.x, t);
  const y = lerp(a.y, b.y, t);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

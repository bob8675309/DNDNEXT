// lib/map/movement.js
// Pure movement helpers for segment-based interpolation.

import { clamp01 } from "./coords";

export function tsToMs(ts) {
  if (!ts) return null;
  if (typeof ts === "number") return Number.isFinite(ts) ? ts : null;
  try {
    const d = ts instanceof Date ? ts : new Date(ts);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

export function computeProgress(renderWorldMs, segStartMs, segEndMs) {
  const now = Number(renderWorldMs);
  const a = Number(segStartMs);
  const b = Number(segEndMs);
  if (!Number.isFinite(now) || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (b <= a) return null;
  return clamp01((now - a) / (b - a));
}

export function lerpXY(ax, ay, bx, by, t) {
  const tt = clamp01(t);
  return {
    x: ax + (bx - ax) * tt,
    y: ay + (by - ay) * tt,
  };
}

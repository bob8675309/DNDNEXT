// lib/map/coords.js
// Pure helpers for working in "map percent space" (0..100).
// Keep this file React/Supabase-free so it can be imported anywhere safely.

/** Parse a value that may be a number, numeric string, or "12.3%" into a float. */
export function asPct(v) {
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  const n = parseFloat(s.replace("%", ""));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Normalize historical coordinate formats into 0..100 space.
 * Some rows stored 0..1 fractions; others stored 0..100.
 */
export function normalizePct(v) {
  const n = asPct(v);
  if (!Number.isFinite(n)) return NaN;
  if (n >= 0 && n <= 1.5) return n * 100;
  return n;
}

// Semantic aliases used throughout the app.
export const asLocPct = normalizePct;
export const asCharPct = normalizePct;

export function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function lerp(a, b, t) {
  const ta = Number(a);
  const tb = Number(b);
  const tt = clamp01(t);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return NaN;
  return ta + (tb - ta) * tt;
}

export function dist(a, b) {
  if (!a || !b) return 0;
  const dx = (Number(a.x) || 0) - (Number(b.x) || 0);
  const dy = (Number(a.y) || 0) - (Number(b.y) || 0);
  return Math.sqrt(dx * dx + dy * dy);
}

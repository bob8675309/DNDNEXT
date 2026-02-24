// lib/map/coords.js
// Pure coordinate + math helpers (no React, no Supabase).

export function asPct(v) {
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  const n = parseFloat(s.replace("%", ""));
  return Number.isFinite(n) ? n : NaN;
}

// Normalize historical coords that may be stored as 0..1 fractions or 0..100 percents.
export function normalizePct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return NaN;
  if (x >= 0 && x <= 1.5) return x * 100;
  return x;
}

export function asLocPct(v) {
  return normalizePct(asPct(v));
}

export function asCharPct(v) {
  return normalizePct(asPct(v));
}

export function clamp01(t) {
  const x = Number(t);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function lerp(a, b, t) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return NaN;
  return x + (y - x) * clamp01(t);
}

export function dist(ax, ay, bx, by) {
  const dx = Number(ax) - Number(bx);
  const dy = Number(ay) - Number(by);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return NaN;
  return Math.sqrt(dx * dx + dy * dy);
}

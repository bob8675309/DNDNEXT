// Tactical encounter hex utilities.
// This module is intentionally independent from world/town map movement.

export const HEX_FEET = 5;

export const AXIAL_DIRECTIONS = Object.freeze([
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]);

export function hexKey(q, r) {
  return `${Number(q) || 0}:${Number(r) || 0}`;
}

export function axialToCube({ q = 0, r = 0 } = {}) {
  const x = Number(q) || 0;
  const z = Number(r) || 0;
  return { x, y: -x - z, z };
}

export function hexDistance(a, b) {
  const ac = axialToCube(a);
  const bc = axialToCube(b);
  return Math.max(Math.abs(ac.x - bc.x), Math.abs(ac.y - bc.y), Math.abs(ac.z - bc.z));
}

export function feetToHexes(feet) {
  const value = Math.max(0, Number(feet) || 0);
  return Math.floor(value / HEX_FEET);
}

export function hexesToFeet(hexes) {
  return Math.max(0, Number(hexes) || 0) * HEX_FEET;
}

export function axialNeighbors(hex) {
  const q = Number(hex?.q) || 0;
  const r = Number(hex?.r) || 0;
  return AXIAL_DIRECTIONS.map((dir) => ({ q: q + dir.q, r: r + dir.r }));
}

export function axialToPixel({ q = 0, r = 0 } = {}, size = 36) {
  const s = Number(size) || 36;
  // Pointy-top axial layout.
  return {
    x: s * Math.sqrt(3) * (Number(q) + Number(r) / 2),
    y: s * 1.5 * Number(r),
  };
}

export function hexPolygonPoints(cx, cy, size = 36) {
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = ((60 * i - 30) * Math.PI) / 180;
    points.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return points.join(" ");
}

export function makeHexDisk(radius = 5) {
  const rad = Math.max(0, Math.floor(Number(radius) || 0));
  const cells = [];
  for (let q = -rad; q <= rad; q += 1) {
    const rMin = Math.max(-rad, -q - rad);
    const rMax = Math.min(rad, -q + rad);
    for (let r = rMin; r <= rMax; r += 1) cells.push({ q, r });
  }
  return cells;
}

export function movementCostFeet(pathLengthHexes, { difficultHexes = 0 } = {}) {
  const normal = Math.max(0, Number(pathLengthHexes) || 0);
  const difficult = Math.max(0, Math.min(normal, Number(difficultHexes) || 0));
  return hexesToFeet(normal + difficult);
}

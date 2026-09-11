function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createDiceVisualSeed(hint = "dice") {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    return `${hint}:${values[0].toString(36)}:${values[1].toString(36)}`;
  }
  const perf = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now().toString(36) : "0";
  return `${hint}:${Date.now().toString(36)}:${perf}`;
}

export function createSeededRandom(seed) {
  let state = hashString(seed) || 0x6d2b79f5;
  return function random() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

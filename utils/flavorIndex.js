// utils/flavorIndex.js
// Robust loader + normalizer for flavor overrides.
// Works with either { "Name": {flavor} } maps or { items:[{name,flavor}...] } shapes.

const norm = (s = "") =>
  String(s)
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")             // strip accents
    .replace(/[’‘]/g, "'").replace(/[“”]/g, '"')                   // quotes → straight
    .replace(/[‐-–—−]+/g, "-")                                     // dashes → hyphen
    .replace(/\s+/g, " ").trim().toLowerCase();

async function loadOne(url, intoMap) {
  const res = await fetch(url).catch(() => null);
  if (!res || !res.ok) return;
  let json;
  try { json = await res.json(); } catch { return; }

  // Accept either object-map or {items:[...]}
  if (Array.isArray(json?.items)) {
    for (const it of json.items) {
      if (!it?.name || !it?.flavor) continue;
      const key = norm(it.name);
      if (!intoMap.has(key)) intoMap.set(key, String(it.flavor));
    }
    return;
  }
  if (json && typeof json === "object") {
    for (const [name, v] of Object.entries(json)) {
      if (!v || typeof v !== "object" || !("flavor" in v)) continue;
      const key = norm(name);
      if (!intoMap.has(key)) intoMap.set(key, String(v.flavor));
    }
  }
}

export async function loadFlavorIndex() {
  const map = new Map();
  // 1) primary file in /public/items/
  await loadOne("/items/flavor-overrides.json", map);
  // 2) allow a “finished” file to override or fill gaps
  await loadOne("/items/flavor-overrides.finished.json", map);

  return {
    /** exact → drop trailing (...) → loosened article/“of the” pass */
    get(name) {
      if (!name) return null;
      const k1 = norm(name);
      if (map.has(k1)) return map.get(k1);

      // “Name (Qualifier)” → try base
      const base = name.replace(/\s*\([^)]*\)\s*$/, "");
      if (base && base !== name) {
        const k2 = norm(base);
        if (map.has(k2)) return map.get(k2);
      }

      // soften articles/‘of the’
      const soft = name.replace(/\b(of|the)\b/gi, " ").replace(/\s+/g, " ");
      const k3 = norm(soft);
      if (map.has(k3)) return map.get(k3);

      return null;
    }
  };
}

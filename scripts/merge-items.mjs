// scripts/merge-items.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
// Adjust these if your files live elsewhere:
const SRC_DIR = path.join(ROOT, "public", "items");
const OUT_FILE = path.join(SRC_DIR, "all-items.json");

const FILES = {
  items: "items.json",
  base: "items-base.json",
  fluff: "fluff-items.json",
  foundry: "foundry-items.json",
};

const TYPE_MAP = {
  LA: "Light Armor",
  MA: "Medium Armor",
  HA: "Heavy Armor",
  S: "Shield",
  W: "Weapon",
  M: "Melee Weapon",
  R: "Ranged Weapon",
  RG: "Ranged Weapon",
  G: "Adventuring Gear",
  P: "Potion",
  SC: "Scroll",
  WD: "Wand",
  RD: "Rod",
  ST: "Staff",
  SCF: "Spellcasting Focus",
  INS: "Instrument",
  T: "Tool",
  AT: "Artisan Tool",
  TAH: "Tack and Harness",
  SHP: "Ship",
};

const norm = (s = "") =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function cpToString(cp) {
  if (cp == null || Number.isNaN(Number(cp))) return null;
  const n = Number(cp);
  const gp = n / 100;
  if (gp >= 1) return Number.isInteger(gp) ? `${gp|0} gp` : `${gp} gp`;
  const sp = n / 10;
  if (sp >= 1) return Number.isInteger(sp) ? `${sp|0} sp` : `${sp} sp`;
  return `${n} cp`;
}

function mapType(code, wondrousFlag) {
  if (wondrousFlag) return "Wondrous Item";
  if (!code) return null;
  const tokens = String(code).match(/[A-Z]{1,3}/g) || [];
  for (const t of tokens) {
    if (TYPE_MAP[t]) return TYPE_MAP[t];
  }
  // fall back to raw code so nothing is lost
  return String(code);
}

// flatten 5eTools "entries" into readable paragraphs and strip '{@...}' tags
function renderEntries(entries) {
  const out = [];
  const visit = (node) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (typeof node === "string" || typeof node === "number") {
      out.push(String(node));
      return;
    }
    if (typeof node === "object") {
      if ("entries" in node) { visit(node.name); visit(node.entries); return; }
      if ("items" in node) { visit(node.name); visit(node.items); return; }
      if ("text" in node) { visit(node.text); return; }
      for (const v of Object.values(node)) visit(v);
    }
  };
  visit(entries);
  const strip = (s) =>
    String(s)
      .replace(/\{@[^|}]+?\|([^}]+)\}/g, "$1")   // {@spell fireball|phb} -> fireball
      .replace(/\{@[^}]+? ([^}|]+)\}/g, "$1")   // {@i italic} -> italic
      .replace(/\\n/g, "\n")
      .trim();
  // unique paragraphs
  const seen = new Set();
  return out
    .map(strip)
    .filter(Boolean)
    .filter((p) => (seen.has(p) ? false : (seen.add(p), true)))
    .join("\n\n");
}

async function readJSON(p) {
  const raw = await readFile(p, "utf8");
  return JSON.parse(raw);
}

async function main() {
  // Load sources
  const items = (await readJSON(path.join(SRC_DIR, FILES.items))).item || [];
  const base  = (await readJSON(path.join(SRC_DIR, FILES.base))).baseitem || [];
  const fluff = (await readJSON(path.join(SRC_DIR, FILES.fluff))).itemFluff || [];
  const found = (await readJSON(path.join(SRC_DIR, FILES.foundry))).item || [];

  // Index by normalized name
  const byItems   = new Map();
  for (const it of items) {
    const k = norm(it.name);
    if (!byItems.has(k)) byItems.set(k, it);
    else {
      // prefer entry with more text
      const cur = byItems.get(k);
      const lenA = Array.isArray(it.entries) ? it.entries.length : 0;
      const lenB = Array.isArray(cur.entries) ? cur.entries.length : 0;
      if (lenA > lenB) byItems.set(k, it);
    }
  }
  const byBase    = new Map(base.map((b) => [norm(b.name), b]));
  const byFluff   = new Map(fluff.map((f) => [norm(f.name), f]));
  const byFoundry = new Map(found.map((f) => [norm(f.name), f]));

  const allNames = new Set([
    ...byItems.keys(),
    ...byBase.keys(),
    ...byFluff.keys(),
    ...byFoundry.keys(),
  ]);

  const merged = [];
  for (const key of [...allNames].sort()) {
    const i = byItems.get(key);
    const b = byBase.get(key);
    const f = byFluff.get(key);
    const fd = byFoundry.get(key);

    const name =
      i?.name ?? b?.name ?? f?.name ?? fd?.name ?? key;

    const type = mapType(i?.type ?? b?.type, !!i?.wondrous);
    const rarity =
      i?.rarity ??
      (typeof fd?.rarity === "string"
        ? fd.rarity
        : fd?.rarity?.value ?? null);

    const source = i?.source ?? b?.source ?? f?.source ?? null;

    // Description: rules (items) + fluff + Foundry HTML stripped
    const parts = [];
    if (i?.entries) parts.push(renderEntries(i.entries));
    if (f?.entries) parts.push(renderEntries(f.entries));
    const sysDesc =
      typeof fd?.system?.description === "object"
        ? fd.system.description.value
        : null;
    if (sysDesc) {
      parts.push(String(sysDesc).replace(/<[^>]*>/g, "").trim());
    }
    const description = parts.filter(Boolean).join("\n\n") || null;

    // Attunement requirement shown in your UI as "slot"
    const slot = i?.slot ?? i?.reqAttune ?? null;

    const img = i?.img ?? fd?.img ?? null;

    // weight & cost
    const weightRaw = i?.weight ?? b?.weight ?? null;
    const weight =
      typeof weightRaw === "number"
        ? (weightRaw ? `${weightRaw} lb` : null)
        : (weightRaw ?? null);

    const valueRaw = i?.value ?? b?.value ?? null;
    const cost =
      typeof valueRaw === "number" ? cpToString(valueRaw) : (valueRaw ?? null);

    merged.push({
      name,
      type,
      rarity,
      source,
      description,
      slot,                // for your current UI
      attunement: slot,    // also available under a clearer name
      img,
      weight,
      cost,
    });
  }

  await mkdir(SRC_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf8");

  // quick stats to help you sanity-check in CI logs
  const stats = (k) => merged.reduce((a, r) => a + (r[k] ? 1 : 0), 0);
  console.log(`Merged items written to ${path.relative(ROOT, OUT_FILE)}`);
  console.log({
    total: merged.length,
    with_description: stats("description"),
    with_type: stats("type"),
    with_rarity: stats("rarity"),
    with_weight: stats("weight"),
    with_cost: stats("cost"),
    with_img: stats("img"),
    wondrous: merged.filter((r) => r.type === "Wondrous Item").length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

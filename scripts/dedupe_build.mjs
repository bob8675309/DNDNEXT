#!/usr/bin/env node
/*
  dedupe_build.mjs
  -----------------
  Consolidate flavor-overrides.json, keep the *newest* entry per item, drop Tracking Lantern variants,
  align against all-items.json, and emit:
    - flavor-overrides.dedup.json
    - flavor-overrides.scaffold.json
    - flavor-overrides.delta-missing.json
    - coverage_report.csv
    - missing_flavor_items.csv
    - duplicates_report.csv
    - item_index.csv   (stable ID for each item)

  Usage:
    node dedupe_build.mjs \
      --overrides item/flavor-overrides.json \
      --items item/all-items.json \
      --out item \
      [--keepLanternVariants]    # optional; default is to DROP the Tracking Lantern variants
*/

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// ------------------------- CLI -------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) return [a, true];
    return [m[1], m[2] ?? true];
  })
);

const OVERRIDES_PATH = args.overrides || "item/flavor-overrides.json";
const ALL_ITEMS_PATH = args.items || "item/all-items.json";
const OUT_DIR = args.out || "item";
const KEEP_LANTERNS = Boolean(args.keepLanternVariants);

fs.mkdirSync(OUT_DIR, { recursive: true });

// ------------------------- Helpers -------------------------
const readText = (p) => fs.readFileSync(p, "utf8");

function stripCommentsAndTrailingCommas(src) {
  // Remove // line comments
  src = src.replace(/(^|\s)\/\/.*$/gm, (m, p1) => p1);
  // Remove /* ... */ block comments
  src = src.replace(/\/\*[\s\S]*?\*\//g, "");
  // Collapse duplicate commas
  src = src.replace(/,\s*,+/g, ",");
  // Remove trailing commas before } or ]
  src = src.replace(/,\s*([}\]])/g, "$1");
  return src;
}

function* scanTopLevelJSON(src) {
  // Yields successive top-level JSON values (objects or arrays) found in src.
  const s = src;
  const n = s.length;
  let i = 0;
  const ws = /\s/;
  while (i < n) {
    while (i < n && ws.test(s[i])) i++;
    if (i >= n) break;
    // seek next opening bracket if needed
    if (s[i] !== "{" && s[i] !== "[") {
      let j = s.indexOf("{", i);
      let k = s.indexOf("[", i);
      if (j === -1 && k === -1) break;
      i = Math.min(j === -1 ? Infinity : j, k === -1 ? Infinity : k);
      if (!isFinite(i)) break;
    }
    const start = i;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (; i < n; i++) {
      const ch = s[i];
      if (inStr) {
        if (esc) {
          esc = false;
        } else if (ch === "\\") {
          esc = true;
        } else if (ch === '"') {
          inStr = false;
        }
        continue;
      }
      if (ch === '"') {
        inStr = true;
        continue;
      }
      if (ch === "{" || ch === "[") depth++;
      if (ch === "}" || ch === "]") depth--;
      if (depth === 0) {
        // include this closing brace/bracket
        i++;
        const chunk = s.slice(start, i);
        yield chunk;
        break;
      }
    }
  }
}

function parseMultiJSON(src) {
  const cleaned = stripCommentsAndTrailingCommas(src);
  const docs = [];
  for (const chunk of scanTopLevelJSON(cleaned)) {
    try {
      docs.push(JSON.parse(chunk));
    } catch {
      // Try wrapping in braces in case it's entries only
      try {
        docs.push(JSON.parse("{" + chunk + "}"));
      } catch {
        // skip
      }
    }
  }
  return docs;
}

function getFlavor(val) {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    if (typeof val.flavor === "string") return val.flavor;
    for (const k of Object.keys(val)) {
      if (typeof val[k] === "string") return val[k];
    }
  }
  return null;
}

function flattenItems(obj, outPairs) {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object" && v.section) continue; // skip section headers
    if (v && typeof v === "object" && !("flavor" in v) && getFlavor(v) === null) {
      // nested group
      flattenItems(v, outPairs);
    } else {
      outPairs.push([k, getFlavor(v)]);
    }
  }
}

function shaID(name) {
  return "ITM-" + crypto.createHash("sha1").update(name, "utf8").digest("hex").slice(0, 10).toUpperCase();
}

function baseName(n) {
  const m = n.match(/^\s*\+\d+\s+(.*)$/);
  return m ? m[1] : n;
}

function toCSVRow(cells) {
  return cells
    .map((c) => {
      const s = c == null ? "" : String(c);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    })
    .join(",");
}

// ------------------------- 1) Load overrides -------------------------
const overridesSrc = readText(OVERRIDES_PATH);
const docs = parseMultiJSON(overridesSrc);

const overridesMapSrc = {};
for (const d of docs) {
  if (d && typeof d === "object" && d.items && typeof d.items === "object") {
    Object.assign(overridesMapSrc, d.items);
  } else if (d && typeof d === "object") {
    Object.assign(overridesMapSrc, d);
  }
}

// Flatten to pairs preserving order of appearance across docs
const flatPairs = [];
flattenItems(overridesMapSrc, flatPairs);

// ------------------------- 2) Deduplicate (last-wins) -------------------------
const dedup = new Map();
const dupeCounter = new Map(); // name -> extra occurrences beyond first
for (const [name, flavorStr] of flatPairs) {
  if (dedup.has(name)) {
    dupeCounter.set(name, (dupeCounter.get(name) || 0) + 1);
  }
  dedup.set(name, flavorStr);
}

// ------------------------- 3) Drop Tracking Lantern variants -------------------------
const dropNames = new Set([
  "Lantern of Tracking (Fiends)",
  "Lantern of Tracking (Undead)",
  "Lantern of Tracking (Aberrations)",
  "Lantern, Tracking (Fiends)",
  "Lantern, Tracking (Undead)",
  "Lantern, Tracking (Aberrations)",
]);
if (!KEEP_LANTERNS) {
  for (const n of dropNames) dedup.delete(n);
}

// ------------------------- 4) Load all-items -------------------------
function loadJSONLenient(p) {
  const t = readText(p);
  try {
    return JSON.parse(t);
  } catch {
    return JSON.parse(stripCommentsAndTrailingCommas(t));
  }
}

const allItemsRaw = loadJSONLenient(ALL_ITEMS_PATH);
const names = [];
if (Array.isArray(allItemsRaw)) {
  for (const it of allItemsRaw) {
    if (typeof it === "string") names.push(it);
    else if (it && typeof it === "object" && it.name) names.push(String(it.name));
  }
} else if (allItemsRaw && typeof allItemsRaw === "object" && Array.isArray(allItemsRaw.items)) {
  for (const it of allItemsRaw.items) {
    if (typeof it === "string") names.push(it);
    else if (it && typeof it === "object" && it.name) names.push(String(it.name));
  }
}

// unique preserve order
const seen = new Set();
const namesUnique = [];
for (const n of names) {
  if (n && !seen.has(n)) { seen.add(n); namesUnique.push(n); }
}

// ------------------------- 5) Coverage & scaffolds -------------------------
const scaffold = {};
const deltaMissing = {};
const rows = [];

for (const nm of namesUnique) {
  const exact = dedup.has(nm) && typeof dedup.get(nm) === "string" && dedup.get(nm) != null;
  let flav = exact ? dedup.get(nm) : null;
  let usedFallback = false;
  if (!exact) {
    const bn = baseName(nm);
    if (bn !== nm && dedup.has(bn) && typeof dedup.get(bn) === "string" && dedup.get(bn) != null) {
      flav = dedup.get(bn);
      usedFallback = true;
    }
  }
  const hasFlavor = typeof flav === "string" && flav.trim() !== "";
  scaffold[nm] = { flavor: hasFlavor ? flav : "" };
  if (!hasFlavor) deltaMissing[nm] = { flavor: "" };
  rows.push({
    id: shaID(nm),
    name: nm,
    has_exact: exact ? "Y" : "N",
    used_fallback: usedFallback ? "Y" : "N",
    has_flavor: hasFlavor ? "Y" : "N",
    chosen_flavor: hasFlavor ? flav : "",
  });
}

// ------------------------- 6) Write outputs -------------------------
const outDedup = path.join(OUT_DIR, "flavor-overrides.dedup.json");
const outScaffold = path.join(OUT_DIR, "flavor-overrides.scaffold.json");
const outDelta = path.join(OUT_DIR, "flavor-overrides.delta-missing.json");
const outCoverage = path.join(OUT_DIR, "coverage_report.csv");
const outMissing = path.join(OUT_DIR, "missing_flavor_items.csv");
const outDupes = path.join(OUT_DIR, "duplicates_report.csv");
const outIndex = path.join(OUT_DIR, "item_index.csv");

const dedupObj = Object.fromEntries([...dedup.entries()].map(([k,v]) => [k, { flavor: typeof v === "string" ? v : "" }]));
fs.writeFileSync(outDedup, JSON.stringify(dedupObj, null, 2));
fs.writeFileSync(outScaffold, JSON.stringify(scaffold, null, 2));
fs.writeFileSync(outDelta, JSON.stringify(deltaMissing, null, 2));

// coverage CSV
{
  const headers = ["id","name","has_exact","used_fallback","has_flavor","chosen_flavor"];
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(toCSVRow(headers.map(h => r[h])));
  fs.writeFileSync(outCoverage, lines.join("\n"));
}

// missing CSV
{
  const lines = ["id,name"]; 
  for (const r of rows) if (r.has_flavor !== "Y") lines.push(toCSVRow([r.id, r.name]));
  fs.writeFileSync(outMissing, lines.join("\n"));
}

// dupes CSV
{
  const entries = [...dupeCounter.entries()].filter(([,v]) => v>0).sort((a,b)=> a[0].localeCompare(b[0]));
  const lines = ["name,extra_occurrences", ...entries.map(([k,v]) => toCSVRow([k,String(v)]))];
  fs.writeFileSync(outDupes, lines.join("\n"));
}

// index CSV
{
  const headers = ["id","name","has_exact","used_fallback","has_flavor"];
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(toCSVRow(headers.map(h => r[h])));
  fs.writeFileSync(outIndex, lines.join("\n"));
}

// ------------------------- Console summary -------------------------
const summary = {
  overrides_docs_parsed: docs.length,
  pairs_seen: flatPairs.length,
  unique_after_dedupe: Object.keys(dedupObj).length,
  lantern_variants_removed: KEEP_LANTERNS ? 0 : [
    "Lantern of Tracking (Fiends)",
    "Lantern of Tracking (Undead)",
    "Lantern of Tracking (Aberrations)",
    "Lantern, Tracking (Fiends)",
    "Lantern, Tracking (Undead)",
    "Lantern, Tracking (Aberrations)",
  ].filter(n => n in overridesMapSrc).length,
  all_items_unique: namesUnique.length,
  still_missing_flavor: rows.filter(r => r.has_flavor !== "Y").length,
  duplicates_with_extras: [...dupeCounter.values()].filter(v => v>0).length,
  outputs: { outDedup, outScaffold, outDelta, outCoverage, outMissing, outDupes, outIndex }
};

console.log(JSON.stringify(summary, null, 2));

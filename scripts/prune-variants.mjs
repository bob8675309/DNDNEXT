// scripts/prune-variants.mjs
import fs from "node:fs/promises";
import path from "node:path";

const argv = new Map(process.argv.slice(2).map((a)=>a.split("=").map(s=>s.trim())));
const IN  = argv.get("--in")  || "public/items/all-items.json";
const OUT = argv.get("--out") || "public/items/all-items.no-variants.json";
const REP = argv.get("--report") || "public/items/all-items.no-variants.report.txt";

const stripTag = (s)=>String(s||"").split("|")[0];

function isVariantToOmit(it) {
  const name = String(it.name || it.item_name || "");
  const raw = stripTag(it.type || it.item_type || "");
  const isArmor = raw === "LA" || raw === "MA" || raw === "HA";
  const isShield = raw === "S";
  const isWeapon = raw === "M" || raw === "R";
  const isAmmo   = raw === "A";

  const plus = /^\s*\+[123]\s+/.test(name) || /\(\s*\+[123]\s*\)/.test(name);
  const adamantine = /\badamantine\b/i.test(name);
  const resistArmor = (isArmor || isShield) && /\bresistance\b/i.test(name);
  const moonSicklePlus =
    /\bmoon\s*sickle\b/i.test(name) &&
    (plus || /\b\+[123]\b/.test(name));

  if ((isWeapon || isArmor || isShield || isAmmo) && (plus || adamantine)) return true;
  if (resistArmor) return true;
  if (moonSicklePlus) return true;
  return false;
}

const src = JSON.parse(await fs.readFile(IN, "utf8"));
const removed = [];
const kept = [];

for (const it of src) (isVariantToOmit(it) ? removed : kept).push(it);

await fs.writeFile(OUT, JSON.stringify(kept, null, 2), "utf8");

const breakdown = removed.reduce((m, it)=>{
  const n = it.name || it.item_name || "";
  const tag =
    (/^\s*\+/.test(n) || /\(\s*\+[123]\s*\)/.test(n)) ? "plus" :
    (/\badamantine\b/i.test(n)) ? "adamantine" :
    (/\bresistance\b/i.test(n)) ? "resistance" : "other";
  m[tag] = (m[tag]||0)+1;
  return m;
}, {});

const sample = Array.from(new Set(removed.map(it=>it.name || it.item_name))).sort().slice(0,80).join("\n");

const report = `Source: ${IN}
Kept: ${kept.length}
Removed: ${removed.length}
Breakdown: ${JSON.stringify(breakdown)}
Examples removed (first 80 unique):
${sample}
`;
await fs.writeFile(REP, report, "utf8");
console.log(`[prune-variants] Kept ${kept.length}, removed ${removed.length}`);
console.log(`[prune-variants] Wrote ${OUT} and ${REP}`);

// scripts/check-overrides.mjs
// Verifies flavor-overrides against the live catalog.
// - Lists items in all-items.json that lack an override
// - Lists orphans in overrides not present in the catalog
// - Summarizes coverage by uiType + rarity
//
// Run: node scripts/check-overrides.mjs
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public", "items");
const ALLOW_SECTION_KEY = /^==/;

const readJSON = async (p) => JSON.parse(await fs.readFile(p, "utf8"));

const load = async () => {
  const catalog = await readJSON(path.join(ROOT, "all-items.json"));
  const overrides = await readJSON(path.join(ROOT, "flavor-overrides.json"));
  return { catalog, overrides };
};

const toName = (it) => String(it?.name ?? "").trim();
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

const isSectionKey = (k, v) =>
  ALLOW_SECTION_KEY.test(k) || (v && typeof v === "object" && v.section === true);

const main = async () => {
  const { catalog, overrides } = await load();
  const overrideItems = overrides?.items || {};

  const namesInCatalog = new Map(); // norm -> {name, rarity, uiType, source}
  for (const it of catalog) {
    const n = toName(it);
    if (!n) continue;
    const k = norm(n);
    if (!namesInCatalog.has(k)) {
      namesInCatalog.set(k, {
        name: n,
        rarity: it?.rarity ?? "",
        uiType: it?.uiType ?? it?.type ?? "",
        source: it?.source ?? "",
      });
    }
  }

  // gather override keys, skipping section headers
  const overrideKeys = Object.keys(overrideItems).filter(
    (k) => !isSectionKey(k, overrideItems[k])
  );

  const overrideSet = new Set(overrideKeys.map(norm));

  // missing overrides for items that will actually show flavor boxes
  const missing = [];
  for (const [k, meta] of namesInCatalog) {
    // ignore purely mundane throwaways? we keep everything selectable; filter none
    if (!overrideSet.has(k)) missing.push(meta);
  }

  // orphans (in overrides but not in catalog)
  const orphans = [];
  for (const rawKey of overrideKeys) {
    const k = norm(rawKey);
    if (!namesInCatalog.has(k)) orphans.push(rawKey);
  }

  // coverage by group
  const byKey = (arr, key) =>
    arr.reduce((m, x) => ((m[x[key] || ""] = (m[x[key] || ""] || 0) + 1), m), {});
  const total = catalog.length;
  const covered = total - missing.length;

  const byUiType = {};
  for (const [k, meta] of namesInCatalog) {
    const grp = String(meta.uiType || "Unclassified");
    const coveredHere = overrideSet.has(k);
    byUiType[grp] = byUiType[grp] || { total: 0, covered: 0 };
    byUiType[grp].total++;
    if (coveredHere) byUiType[grp].covered++;
  }

  // rarity coverage (treat literal "none" as Mundane)
  const byRarity = {};
  for (const [k, meta] of namesInCatalog) {
    const r =
      String(meta.rarity || "")
        .trim()
        .toLowerCase() === "none"
        ? "Mundane"
        : (meta.rarity || "—");
    const coveredHere = overrideSet.has(k);
    byRarity[r] = byRarity[r] || { total: 0, covered: 0 };
    byRarity[r].total++;
    if (coveredHere) byRarity[r].covered++;
  }

  // format
  const lines = [];
  lines.push(`[check-overrides] Catalog items: ${total}`);
  lines.push(`[check-overrides] Overrides present: ${overrideSet.size}`);
  lines.push(`[check-overrides] Covered: ${covered}  Missing: ${missing.length}`);
  lines.push("");
  lines.push("Coverage by uiType:");
  for (const [grp, { total, covered }] of Object.entries(byUiType).sort(
    (a, b) => a[0].localeCompare(b[0])
  )) {
    const pct = total ? Math.round((covered / total) * 100) : 0;
    lines.push(`  - ${grp}: ${covered}/${total} (${pct}%)`);
  }
  lines.push("");
  lines.push("Coverage by rarity:");
  for (const [rar, { total, covered }] of Object.entries(byRarity).sort(
    (a, b) => a[0].localeCompare(b[0])
  )) {
    const pct = total ? Math.round((covered / total) * 100) : 0;
    lines.push(`  - ${rar}: ${covered}/${total} (${pct}%)`);
  }

  // top 100 missing (alphabetical)
  lines.push("");
  lines.push("Missing overrides (first 100, A→Z):");
  const missNames = missing
    .map((m) => m.name)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 100);
  missNames.forEach((n) => lines.push(`  • ${n}`));

  // orphans
  lines.push("");
  lines.push(`Orphans in overrides (not in catalog): ${orphans.length}`);
  orphans.sort((a, b) => a.localeCompare(b)).forEach((n) => lines.push(`  • ${n}`));

  const outPath = path.join(ROOT, "flavor-overrides.report.txt");
  await fs.writeFile(outPath, lines.join("\n") + "\n", "utf8");
  console.log(lines.join("\n"));
  console.log(`\n[check-overrides] Wrote report → ${outPath}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

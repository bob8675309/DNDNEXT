const SOURCE = "GrimHollowPG24";
const SOURCE_COMMIT = "ab4012f136dc1224c45d6c13c1d8f71b543c34bb";
const SOURCE_PATH = "collection/Ghostfire Gaming; Grim Hollow - Player's Guide - 2024.json";
const DUPLICATE_SOURCE_NAMES = new Set(["Dhampir", "Dragonborn", "Dwarf", "Elf", "Gnome", "Halfling", "Human"]);
const PRIMARY_CATEGORY_OVERRIDES = new Map([
  ["Artifice Expertise", "E"],
  ["Helping Hand", "E"],
  ["Powerful Build", "E"],
]);

const text = (value) => String(value ?? "").trim();
const array = (value) => Array.isArray(value) ? value : [];
const unique = (values) => [...new Set(array(values).map(text).filter(Boolean))];
const slug = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function clean5eText(value) {
  return text(value)
    .replace(/\{@dc\s+([^}]+)}/gi, "DC $1")
    .replace(/\{@hit\s+([^}]+)}/gi, "$1")
    .replace(/\{@(?:b|i|u|s|sup|sub|note)\s+([^}]+)}/gi, "$1")
    .replace(/\{@(?:dice|damage|scaledice|scaledamage)\s+([^}|]+)(?:\|[^}]*)?}/gi, "$1")
    .replace(/\{@[^\s}]+\s+([^}|]+)(?:\|[^}]*)?}/g, "$1")
    .replace(/\{@[^}]+}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenEntries(node, depth = 0) {
  if (node == null || depth > 24) return [];
  if (typeof node === "string" || typeof node === "number") {
    const cleaned = clean5eText(node);
    return cleaned ? [cleaned] : [];
  }
  if (Array.isArray(node)) return node.flatMap((entry) => flattenEntries(entry, depth + 1));
  if (typeof node !== "object") return [];
  const output = [];
  const heading = clean5eText(node.name || node.title || node.caption || "");
  const bodyKeys = ["entry", "entries", "items", "rows"];
  if (heading && bodyKeys.some((key) => node[key] != null)) output.push(heading);
  for (const key of bodyKeys) if (node[key] != null) output.push(...flattenEntries(node[key], depth + 1));
  return output.filter(Boolean);
}

function heritageCategory(row = {}) {
  if (PRIMARY_CATEGORY_OVERRIDES.has(row.name)) return PRIMARY_CATEGORY_OVERRIDES.get(row.name);
  const types = array(row.featureType).map((entry) => text(entry).toUpperCase());
  if (types.includes("C")) return "C";
  if (types.includes("E")) return "E";
  return "R";
}

function heritageImprovedName(row = {}) {
  return array(row.entries).find((entry) => entry && typeof entry === "object" && text(entry.name))?.name || null;
}

function heritageRepeatLimit(row = {}) {
  const raw = JSON.stringify(row.entries || []);
  if (/multiple times|each time/i.test(raw)) return 8;
  return heritageImprovedName(row) ? 2 : 1;
}

export function grimHollowHeritageCatalog(book = {}) {
  return array(book.optionalfeature)
    .filter((row) => row?.source === SOURCE && array(row.featureType).includes("HT"))
    .map((row) => ({
      key: "heritage-trait:" + slug(row.name) + "|" + SOURCE.toUpperCase(),
      name: row.name,
      category: heritageCategory(row),
      description: unique(flattenEntries(row.entries || [])).join("\n\n"),
      improvedName: heritageImprovedName(row),
      repeatLimit: heritageRepeatLimit(row),
    }))
    .sort((a, b) => {
      const rank = { C: 0, E: 1, R: 2 };
      return (rank[a.category] ?? 9) - (rank[b.category] ?? 9) || a.name.localeCompare(b.name);
    });
}

export function sourceTraditionalHeritageSelections(race = {}, catalog = []) {
  const byName = new Map(catalog.map((entry) => [entry.name, entry]));
  const inset = array(race.entries).find((entry) => entry?.name === "Traditional " + race.name + " Traits");
  const output = [];
  for (const categoryEntry of array(inset?.entries)) {
    if (!categoryEntry || typeof categoryEntry !== "object" || categoryEntry.type !== "entries") continue;
    for (const list of array(categoryEntry.entries)) {
      if (list?.type !== "list") continue;
      for (const raw of array(list.items)) {
        const value = typeof raw === "string" ? raw : JSON.stringify(raw);
        const match = value.match(/\{@optfeature\s+([^|}]+)\|GrimHollowPG24(?:\|[^}]*)?}/i);
        if (!match) continue;
        const name = text(match[1]);
        const resolved = byName.get(name);
        output.push({
          key: resolved?.key || ("heritage-trait:" + slug(name) + "|" + SOURCE.toUpperCase()),
          name,
          category: resolved?.category || null,
          raw: value,
        });
      }
    }
  }
  return output;
}

function sourceRaceFluff(book = {}, raceName = "") {
  const fluff = array(book.raceFluff).find((entry) => entry?.source === SOURCE && entry?.name === raceName) || null;
  if (!fluff) return { lore: "", artUrl: null };
  const direct = unique(flattenEntries(fluff.entries || []));
  const copied = unique(flattenEntries(fluff?._copy?._mod?.entries?.items || []));
  return {
    lore: (direct.length ? direct : copied).join("\n\n"),
    artUrl: array(fluff.images).map((image) => image?.href?.url).find(Boolean) || null,
  };
}

function sourceDisplayName(sourceName = "") {
  return DUPLICATE_SOURCE_NAMES.has(sourceName) ? sourceName + " (Grim Hollow)" : sourceName;
}

export function speciesRows(book = {}) {
  const heritageTraitCatalog = grimHollowHeritageCatalog(book);
  if (heritageTraitCatalog.length !== 107) {
    throw new Error("Grim Hollow Heritage Trait count mismatch: expected 107, received " + heritageTraitCatalog.length);
  }

  return array(book.race)
    .filter((race) => race?.source === SOURCE)
    .map((race) => {
      const sourceName = text(race.name);
      const name = sourceDisplayName(sourceName);
      const traditionalHeritageSelections = sourceTraditionalHeritageSelections(race, heritageTraitCatalog);
      const fluff = sourceRaceFluff(book, sourceName);
      const sourceRules = unique(flattenEntries(race.entries || [])).join("\n\n");
      const speedRule = unique(flattenEntries(race.speedEntry || [])).join(" ");
      const smallSpeedBonusHeritagePick = /gain an extra traditional trait/i.test(speedRule);
      return {
        option_key: "species:" + slug(sourceName) + (name !== sourceName ? "-grim-hollow" : "") + "|" + SOURCE.toUpperCase(),
        option_type: "species",
        name,
        source: SOURCE,
        category: array(race.creatureTypes)[0] || "humanoid",
        description: sourceRules,
        prerequisite_text: null,
        tags: ["size:" + JSON.stringify(race.size || []), "heritage-system:grim-hollow"],
        metadata: {
          lore: fluff.lore,
          page: race.page ?? null,
          size: race.size || [],
          speed: race.speed ?? 30,
          traits: [{
            name: "Heritage Traits",
            type: "entries",
            entries: [
              unique(flattenEntries(array(race.entries)[1] || [])).join(" "),
              unique(flattenEntries(array(race.entries)[2] || [])).join(" "),
            ].filter(Boolean),
          }],
          lineage: race.lineage ?? null,
          languages: [],
          darkvision: null,
          loreSource: SOURCE,
          creatureTypes: race.creatureTypes || ["humanoid"],
          heritageOnly: true,
          heritagePickCount: 8,
          heritageTraitCatalog,
          traditionalHeritageSelections,
          sourceName,
          sourceDisplayVariant: name !== sourceName,
          sourceArtUrl: fluff.artUrl,
          smallSpeedBonusHeritagePick,
          smallSpeedReduction: smallSpeedBonusHeritagePick ? 5 : 0,
          sourceSpeedEntry: race.speedEntry || null,
          importedFrom: SOURCE,
          sourceEdition: "2024",
        },
        raw_payload: {
          ...race,
          sourceCommit: SOURCE_COMMIT,
          sourceFile: SOURCE_PATH,
          sourceName,
        },
      };
    });
}

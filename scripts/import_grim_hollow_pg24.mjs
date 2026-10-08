#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const GRIM_HOLLOW_SOURCE = "GrimHollowPG24";
export const GRIM_HOLLOW_SOURCE_COMMIT = "ab4012f136dc1224c45d6c13c1d8f71b543c34bb";
export const GRIM_HOLLOW_SOURCE_PATH = "collection/Ghostfire Gaming; Grim Hollow - Player's Guide - 2024.json";
export const GRIM_HOLLOW_SOURCE_URL = `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/${GRIM_HOLLOW_SOURCE_COMMIT}/collection/Ghostfire%20Gaming%3B%20Grim%20Hollow%20-%20Player%27s%20Guide%20-%202024.json`;
export const EXPECTED_COUNTS = Object.freeze({ spells: 101, subclasses: 40, subclassFeatures: 258, items: 106, itemVariants: 1 });

const text = (value) => String(value ?? "").trim();
const array = (value) => Array.isArray(value) ? value : [];
const slug = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const strip = (value) => text(value).split("|")[0].trim();
const unique = (values) => [...new Set(array(values).map(text).filter(Boolean))];

export function clean5eText(value) {
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

export function flattenEntries(node, depth = 0) {
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

const SCHOOL_NAMES = Object.freeze({ A: "Abjuration", C: "Conjuration", D: "Divination", E: "Enchantment", V: "Evocation", I: "Illusion", N: "Necromancy", T: "Transmutation" });
const ABILITY_NAMES = Object.freeze({ str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" });

function formatTime(time = []) {
  return array(time).map((entry) => {
    const number = entry?.number ?? 1;
    const unit = entry?.unit || "action";
    const condition = entry?.condition ? `, ${clean5eText(entry.condition)}` : "";
    return `${number} ${unit}${number === 1 ? "" : "s"}${condition}`;
  }).join(" or ");
}

function formatRange(range = {}) {
  const distance = range?.distance || {};
  if (distance.type === "self") return "Self";
  if (distance.type === "touch") return "Touch";
  if (distance.type === "sight") return "Sight";
  if (distance.type === "unlimited") return "Unlimited";
  if (distance.amount != null && distance.type) return `${distance.amount} ${distance.type}`;
  return range?.type || "";
}

function formatDuration(duration = []) {
  return array(duration).map((entry) => {
    const prefix = entry?.concentration ? "Concentration, up to " : "";
    if (entry?.type === "instant") return "Instantaneous";
    if (entry?.type === "permanent") return "Until dispelled";
    if (entry?.type === "special") return "Special";
    const amount = entry?.duration?.amount;
    const type = entry?.duration?.type;
    return amount && type ? `${prefix}${amount} ${type}${amount === 1 ? "" : "s"}` : prefix + (entry?.type || "");
  }).filter(Boolean).join(" or ");
}

function normalizeAbilities(values = []) {
  return unique(array(values).map((value) => ABILITY_NAMES[text(value).toLowerCase()] || text(value)));
}

function inferDice(value = "") {
  return text(value).match(/\b\d+d\d+(?:\s*[+-]\s*\d+)?\b/i)?.[0] || null;
}

function materialText(value) {
  if (typeof value === "string") return clean5eText(value);
  if (value && typeof value === "object") return clean5eText(value.text || value.entry || "");
  return null;
}

function scalingText(value = null, higherLevelText = "") {
  if (higherLevelText) return higherLevelText;
  const scaling = value?.scaling && typeof value.scaling === "object" ? value.scaling : null;
  if (!scaling) return null;
  const label = clean5eText(value.label || "Scaling");
  const parts = Object.entries(scaling)
    .map(([level, formula]) => `level ${level}: ${clean5eText(formula)}`)
    .filter((entry) => !entry.endsWith(": "));
  return parts.length ? `${label}: ${parts.join(" • ")}` : null;
}

function effectKind(spell = {}, description = "") {
  if (array(spell.damageInflict).length) return "damage";
  if (/heal|healing|regain|hit point maximum/i.test(description)) return "healing";
  if (array(spell.conditionInflict).length) return "condition";
  if (array(spell.savingThrow).length) return "control";
  if (/summon|conjure/i.test(spell.name || "")) return "summon";
  if (/resistance|armor|shield|protection/i.test(description)) return "defense";
  return "utility";
}

function subclassSpellIndex(book = {}) {
  const map = new Map();
  for (const subclass of array(book.subclass)) {
    const label = `${subclass.className || ""}: ${subclass.name || subclass.shortName || ""}`.trim();
    for (const token of array(subclass.subclassSpells)) {
      const [name, source] = text(token).split("|");
      const key = `${slug(name)}|${text(source || GRIM_HOLLOW_SOURCE).toUpperCase()}`;
      if (!map.has(key)) map.set(key, new Set());
      if (label) map.get(key).add(label);
    }
  }
  return map;
}

export function spellRows(book = {}) {
  const subclassIndex = subclassSpellIndex(book);
  const rows = [];
  const effects = [];
  for (const spell of array(book.spell).filter((entry) => entry?.source === GRIM_HOLLOW_SOURCE)) {
    const description = unique(flattenEntries(spell.entries || [])).join("\n\n");
    const higherLevelText = unique(flattenEntries(spell.entriesHigherLevel || [])).join("\n\n");
    const classes = unique([
      ...array(spell?.classes?.fromClassList).map((entry) => entry?.name),
      ...array(spell?.classes?.fromClassListVariant).map((entry) => entry?.name),
    ]);
    const directSubclasses = array(spell?.classes?.fromSubclass).map((entry) => {
      const className = entry?.class?.name || "";
      const subclassName = entry?.subclass?.name || "";
      return className && subclassName ? `${className}: ${subclassName}` : subclassName;
    });
    const spellKey = `${slug(spell.name)}|${GRIM_HOLLOW_SOURCE.toUpperCase()}`;
    const subclasses = unique([...directSubclasses, ...Array.from(subclassIndex.get(spellKey) || [])]);
    const range = spell.range || {};
    const distance = range.distance || {};
    const area = range.type && !["point", "special"].includes(range.type)
      ? { area_type: range.type, area_size: distance.amount || null, area_unit: distance.type || null }
      : { area_type: null, area_size: null, area_unit: null };
    const damageDice = spell.scalingLevelDice?.scaling ? Object.values(spell.scalingLevelDice.scaling)[0] : inferDice(description);
    const healingDice = array(spell.miscTags).includes("HL") || /hit points?|healing|regain/i.test(description) ? inferDice(description) : null;
    const attackTags = array(spell.spellAttack);
    const attackType = attackTags.includes("M") ? "Melee Spell Attack" : attackTags.includes("R") ? "Ranged Spell Attack" : attackTags.length ? "Spell Attack" : null;
    const tags = unique([...array(spell.miscTags), ...array(spell.areaTags), ...array(spell.damageInflict), ...array(spell.conditionInflict), ...array(spell.savingThrow), ...attackTags]);
    const row = {
      spell_key: spellKey,
      slug: slug(spell.name),
      name: spell.name,
      source: GRIM_HOLLOW_SOURCE,
      source_file: GRIM_HOLLOW_SOURCE_PATH,
      page: spell.page ?? null,
      level: Number(spell.level || 0),
      school_code: spell.school || null,
      school: SCHOOL_NAMES[spell.school] || spell.school || null,
      classes,
      subclasses,
      ritual: Boolean(spell?.meta?.ritual),
      concentration: array(spell.duration).some((entry) => entry?.concentration),
      casting_time: formatTime(spell.time),
      casting_time_json: spell.time || [],
      range_text: formatRange(range),
      range_type: range.type || null,
      range_distance: typeof distance.amount === "number" ? distance.amount : null,
      range_unit: distance.type || null,
      range_json: range,
      ...area,
      components_v: Boolean(spell.components?.v),
      components_s: Boolean(spell.components?.s),
      components_m: Boolean(spell.components?.m),
      material_text: materialText(spell.components?.m),
      components_json: spell.components || {},
      duration_text: formatDuration(spell.duration),
      duration_json: spell.duration || [],
      saving_throw_abilities: normalizeAbilities(spell.savingThrow),
      attack_type: attackType,
      damage_dice: damageDice || null,
      damage_types: spell.damageInflict || [],
      healing_dice: healingDice || null,
      scaling_text: scalingText(spell.scalingLevelDice, higherLevelText),
      scaling_json: spell.scalingLevelDice || {},
      description: description || null,
      higher_level_text: higherLevelText || null,
      tags,
      misc_tags: spell.miscTags || [],
      area_tags: spell.areaTags || [],
      raw_payload: { ...spell, sourceCommit: GRIM_HOLLOW_SOURCE_COMMIT, sourceFile: GRIM_HOLLOW_SOURCE_PATH },
    };
    rows.push(row);
    effects.push({
      spell_key: spellKey,
      effect_index: 0,
      effect_kind: effectKind(spell, description),
      damage_type: array(spell.damageInflict)[0] || null,
      dice_formula: damageDice || healingDice || null,
      save_ability: normalizeAbilities(spell.savingThrow)[0] || null,
      save_effect: array(spell.savingThrow).length ? "see description" : null,
      condition: array(spell.conditionInflict)[0] || null,
      duration_text: row.duration_text || null,
      area_type: row.area_type,
      area_size: row.area_size,
      area_unit: row.area_unit,
      targeting_text: row.range_text,
      scaling_formula: row.scaling_text,
      effect_text: description,
      tags,
      raw_payload: row.raw_payload,
    });
  }
  return { rows, effects };
}

function subclassIdentity(className, classSource, shortName) {
  return `${slug(className)}|${text(classSource).toUpperCase()}|${slug(shortName)}`;
}

export function subclassRows(book = {}) {
  const definitions = new Map(array(book.subclass)
    .filter((entry) => entry?.source === GRIM_HOLLOW_SOURCE)
    .map((entry) => [subclassIdentity(entry.className, entry.classSource, entry.shortName || entry.name), entry]));
  const fluff = new Map(array(book.subclassFluff)
    .filter((entry) => entry?.source === GRIM_HOLLOW_SOURCE)
    .map((entry) => [slug(entry.name), entry]));
  const rows = [];
  for (const raw of array(book.subclassFeature).filter((entry) => entry?.source === GRIM_HOLLOW_SOURCE)) {
    const className = text(raw.className);
    const classSource = text(raw.classSource || raw.source);
    const shortName = text(raw.subclassShortName || raw.subclassName);
    const definition = definitions.get(subclassIdentity(className, classSource, shortName)) || null;
    const subclassName = text(definition?.name || raw.subclassName || shortName);
    const resolvedShortName = text(definition?.shortName || shortName || subclassName);
    const sourceFluff = fluff.get(slug(resolvedShortName)) || fluff.get(slug(subclassName)) || null;
    const artUrl = array(sourceFluff?.images).map((image) => image?.href?.url).find(Boolean) || null;
    const name = clean5eText(raw.name);
    const level = Number(raw.level || 0);
    if (!className || !classSource || !name || !level) continue;
    rows.push({
      feature_key: ["subclass", slug(className), slug(classSource), slug(resolvedShortName), slug(name), slug(GRIM_HOLLOW_SOURCE), level].join(":"),
      feature_type: "subclass",
      name,
      source: GRIM_HOLLOW_SOURCE,
      class_key: slug(className),
      class_name: className,
      class_source: classSource,
      subclass_name: subclassName,
      subclass_short_name: resolvedShortName,
      level,
      description: unique(flattenEntries(raw.entries || raw.entry || [])).join("\n\n") || null,
      entries: Array.isArray(raw.entries) ? raw.entries : raw.entry != null ? [raw.entry] : [],
      raw_payload: {
        ...raw,
        sourceCommit: GRIM_HOLLOW_SOURCE_COMMIT,
        sourceFile: GRIM_HOLLOW_SOURCE_PATH,
        subclassDefinition: definition,
        subclassAdditionalSpells: definition?.additionalSpells || [],
        subclassSpells: definition?.subclassSpells || [],
        subclassArtUrl: artUrl,
      },
    });
  }
  return rows;
}

const PROP_NAMES = Object.freeze({ L: "Light", F: "Finesse", H: "Heavy", R: "Reach", T: "Thrown", V: "Versatile", "2H": "Two-Handed", A: "Ammunition", LD: "Loading", S: "Special", RLD: "Reload" });
const DAMAGE_NAMES = Object.freeze({ P: "piercing", S: "slashing", B: "bludgeoning", R: "radiant", N: "necrotic", F: "fire", C: "cold", L: "lightning", A: "acid", T: "thunder", Psn: "poison", Psy: "psychic", Frc: "force" });

function advancedEquipmentType(name = "") {
  const key = text(name).toLowerCase();
  if (["buckler", "retractable shield", "tower shield"].includes(key)) return "Shield";
  if (["blessed stake", "concealed blade"].includes(key)) return "Melee Weapon";
  if (key === "iron net") return "Ranged Weapon";
  if (key === "breath of beleth") return "Potions & Poisons";
  if (key === "mastercraft instrument") return "Instrument";
  if (key === "shadowsteel focus") return "Scroll & Focus";
  if (["fire bomb", "smoke bomb"].includes(key)) return "Explosives";
  return "Adventuring Gear";
}

function itemUiType(row = {}) {
  const type = strip(row.type);
  if (type === "M") return "Melee Weapon";
  if (type === "R") return "Ranged Weapon";
  if (type === "A") return "Ammunition";
  if (type === "G") return "Adventuring Gear";
  if (type === "AdvEq") return advancedEquipmentType(row.name);
  return "Adventuring Gear";
}

export function itemRows(book = {}) {
  const propertyNames = { ...PROP_NAMES };
  for (const property of array(book.itemProperty)) propertyNames[text(property.abbreviation)] = property.name;
  return [...array(book.baseitem), ...array(book.item)]
    .filter((row) => row?.source === GRIM_HOLLOW_SOURCE)
    .map((row) => {
      const properties = array(row.property).map(strip);
      const description = unique(flattenEntries(row.entries || [])).join("\n\n");
      const priceGp = Number.isFinite(Number(row.value)) ? Number(row.value) / 100 : null;
      const uiType = itemUiType(row);
      const itemKey = `${row.name}|${GRIM_HOLLOW_SOURCE}`;
      return {
        ...row,
        source: GRIM_HOLLOW_SOURCE,
        source_file: GRIM_HOLLOW_SOURCE_PATH,
        source_commit: GRIM_HOLLOW_SOURCE_COMMIT,
        item_key: itemKey,
        item_id: itemKey,
        item_name: row.name,
        item_type: uiType,
        item_rarity: "mundane",
        price_gp: priceGp,
        cost: priceGp == null ? null : `${priceGp} gp`,
        rawType: strip(row.type),
        uiType,
        uiSubKind: null,
        source_property: row.property || [],
        property: properties,
        propertiesText: properties.map((property) => propertyNames[property] || property).join(", "),
        damageText: row.dmg1 ? `${row.dmg1} ${DAMAGE_NAMES[strip(row.dmgType)] || strip(row.dmgType) || ""}`.trim() + (properties.includes("V") && row.dmg2 ? `; versatile (${row.dmg2})` : "") : "",
        rangeText: row.range != null ? `${row.range} ft.` : "",
        item_description: description,
        rulesShort: description.length > 420 ? `${description.slice(0, 417).trimEnd()}…` : description,
        sourcePack: "Grim Hollow: Player's Guide (2024)",
      };
    });
}

export function itemVariants(book = {}) {
  return array(book.magicvariant).filter((row) => row?.inherits?.source === GRIM_HOLLOW_SOURCE).map((row) => {
    const description = unique(flattenEntries(row.inherits?.entries || [])).join("\n\n");
    return {
      key: `${slug(row.name)}_grim_hollow_pg24`,
      name: row.name,
      source: GRIM_HOLLOW_SOURCE,
      source_file: GRIM_HOLLOW_SOURCE_PATH,
      source_commit: GRIM_HOLLOW_SOURCE_COMMIT,
      appliesTo: ["armor"],
      rarity: "Mundane",
      entries: [description],
      textByKind: { armor: description },
      requires: { armorWeight: ["light", "medium", "heavy"] },
      valueGpDelta: 500,
      raw_payload: row,
    };
  });
}

export function buildGrimHollowImport(book = {}) {
  const spells = spellRows(book);
  const subclasses = subclassRows(book);
  const items = itemRows(book);
  const variants = itemVariants(book);
  const subclassCount = array(book.subclass).filter((entry) => entry?.source === GRIM_HOLLOW_SOURCE).length;
  const actual = { spells: spells.rows.length, subclasses: subclassCount, subclassFeatures: subclasses.length, items: items.length, itemVariants: variants.length };
  for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
    if (actual[key] !== expected) throw new Error(`Grim Hollow source count mismatch for ${key}: expected ${expected}, received ${actual[key]}`);
  }
  return { spells, subclasses, items, variants, actual };
}

async function loadSource(input = "") {
  if (input) return JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
  const response = await fetch(GRIM_HOLLOW_SOURCE_URL);
  if (!response.ok) throw new Error(`Failed to download pinned Grim Hollow source: HTTP ${response.status}`);
  return response.json();
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function main() {
  const args = process.argv.slice(2);
  let input = "";
  let outDir = "grim-hollow-pg24-import";
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--input") input = args[++index] || "";
    else if (args[index] === "--out-dir") outDir = args[++index] || outDir;
    else if (args[index] === "--apply") throw new Error("Direct database writes are intentionally disabled. Review generated batches before applying them.");
    else throw new Error(`Unknown argument: ${args[index]}`);
  }
  const book = await loadSource(input);
  const built = buildGrimHollowImport(book);
  const resolved = path.resolve(outDir);
  writeJson(path.join(resolved, "spells.json"), { source: GRIM_HOLLOW_SOURCE, sourceCommit: GRIM_HOLLOW_SOURCE_COMMIT, rows: built.spells.rows, effects: built.spells.effects });
  writeJson(path.join(resolved, "subclasses.json"), { source: GRIM_HOLLOW_SOURCE, sourceCommit: GRIM_HOLLOW_SOURCE_COMMIT, rows: built.subclasses });
  writeJson(path.join(resolved, "items.json"), built.items);
  writeJson(path.join(resolved, "item-variants.json"), built.variants);
  console.log(JSON.stringify(built.actual, null, 2));
  console.log(`Generated reviewed Grim Hollow import files in ${resolved}. No database writes were performed.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

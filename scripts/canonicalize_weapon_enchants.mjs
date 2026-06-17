import fs from "node:fs";
import path from "node:path";

const catalogPath = path.join(process.cwd(), "public", "items", "magicvariants.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const variants = Array.isArray(catalog?.variants) ? catalog.variants : [];
const broadenedKeys = new Set(["sharpness", "life_stealing", "wounding", "vengeance"]);
const expectedNames = new Map([
  ["sharpness", "Weapon of Sharpness"],
  ["life_stealing", "Weapon of Life Stealing"],
  ["wounding", "Weapon of Wounding"],
  ["vengeance", "Weapon of Vengeance"],
]);
let changed = false;

for (const variant of variants) {
  const key = String(variant?.key || "");
  if (!broadenedKeys.has(key)) continue;

  const expectedName = expectedNames.get(key);
  if (variant.name !== expectedName) {
    variant.name = expectedName;
    changed = true;
  }

  const requires = variant.requires && typeof variant.requires === "object" && !Array.isArray(variant.requires)
    ? { ...variant.requires }
    : null;
  const families = Array.isArray(requires?.weaponFamily)
    ? requires.weaponFamily.map((value) => String(value).toLowerCase())
    : [];

  if (requires && families.length === 1 && families[0] === "sword") {
    delete requires.weaponFamily;
    if (Object.keys(requires).length) variant.requires = requires;
    else delete variant.requires;
    changed = true;
  }
}

for (const [key, expectedName] of expectedNames) {
  const variant = variants.find((entry) => entry?.key === key);
  if (!variant) throw new Error(`Missing enchanting variant: ${key}`);
  if (variant.name !== expectedName) throw new Error(`${key} must be named ${expectedName}`);
  if (Array.isArray(variant.requires?.weaponFamily) && variant.requires.weaponFamily.some((value) => String(value).toLowerCase() === "sword")) {
    throw new Error(`${key} must not retain a sword-only family requirement`);
  }
}

const sharpness = variants.find((entry) => entry?.key === "sharpness");
if (!Array.isArray(sharpness?.requires?.damageType) || !sharpness.requires.damageType.some((value) => String(value).toLowerCase() === "slashing")) {
  throw new Error("Weapon of Sharpness must retain its Slashing damage requirement");
}

if (!Array.isArray(catalog.notes)) catalog.notes = [];
const note = "Legacy Sword of Sharpness, Life Stealing, Wounding, and Vengeance patterns are canonical Weapon of variants. Their sword-only family gates are removed, while genuine damage-type restrictions remain.";
if (!catalog.notes.includes(note)) {
  catalog.notes.push(note);
  changed = true;
}

if (catalog.updated !== "2026-06-17T00:00:00Z") {
  catalog.updated = "2026-06-17T00:00:00Z";
  changed = true;
}

if (changed) {
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log("Canonicalized legacy Sword of enchantments as Weapon of patterns.");
} else {
  console.log("Weapon enchantment names and compatibility are already canonical.");
}

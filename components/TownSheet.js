import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { buildTownData } from "../utils/townData";
import styles from "./TownSheet.module.scss";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function toneKey(tone) {
  switch (tone) {
    case "amber":
      return styles.toneAmber;
    case "rose":
      return styles.toneRose;
    case "emerald":
      return styles.toneEmerald;
    case "violet":
      return styles.toneViolet;
    case "cyan":
      return styles.toneCyan;
    default:
      return styles.toneStone;
  }
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeOverlayItem(item, fallbackType = "location") {
  return {
    id: item?.id || uid(fallbackType),
    key: item?.key || item?.id || uid(fallbackType),
    name: item?.name || item?.label || "New label",
    x: Number(item?.x ?? 50),
    y: Number(item?.y ?? 50),
    tone: item?.tone || (fallbackType === "discovery" ? "amber" : "stone"),
    targetPanel: item?.targetPanel || item?.target_panel || null,
    category: item?.category || null,
    labelType: item?.labelType || item?.label_type || fallbackType,
    notes: item?.notes || null,
    isVisible: item?.isVisible !== false && item?.is_visible !== false,
  };
}

function normalizeCrafterRoleToken(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferCraftTypeFromText(text = "") {
  const s = normalizeCrafterRoleToken(text);
  if (!s) return null;

  // Keep this intentionally strict: a plain class like "Wizard" should not surface
  // as a workshop provider. The NPC creator now writes explicit workshop tags
  // such as "enchanter" for clear Town Sheet provider discovery.
  if (/\b(jeweler|jeweller|gemcutter|lapidary|goldsmith|silversmith|gem setter|gem setting)\b/.test(s)) return "jeweler";
  if (/\b(blacksmith|weaponsmith|weapon smith|armorsmith|armor smith|armorer|armourer|bladesmith|forge master|forgemaster|smithy|anvil)\b/.test(s)) return "blacksmith";
  if (/\b(smith|forge|forged|forging)\b/.test(s) && !/\b(goldsmith|silversmith)\b/.test(s)) return "blacksmith";
  if (/\b(alchemist|alchemy|potion maker|potioner|poisoner|brewer|apothecary|herbalist|tonic maker)\b/.test(s)) return "alchemist";
  if (/\b(enchanter|enchantress|enchanting|enchantment|imbuer|imbuement|runecrafter|rune crafter|runesmith|rune smith|rune carver|arcane artisan|spellwright)\b/.test(s)) return "enchanter";
  if (/\b(scribe|scrivener|scroll scribe|scrollwright|calligrapher|illuminator|ritual copyist|inscriber)\b/.test(s)) return "scribe";
  return null;
}

function collectCrafterRoleValues(crafter) {
  const values = [];
  const pushValue = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(pushValue);
      return;
    }
    if (typeof value === "object") {
      Object.values(value).forEach(pushValue);
      return;
    }
    values.push(value);
  };

  // Explicit/current and future NPC-creator fields. Most are not selected from
  // Supabase yet, but supporting them here prevents a later role-field rename
  // from regressing Crafters' Quarter provider detection.
  pushValue(crafter?.crafterTypes);
  pushValue(crafter?.craft_roles);
  pushValue(crafter?.craftRoles);
  pushValue(crafter?.crafter_roles);
  pushValue(crafter?.crafterRoles);
  pushValue(crafter?.workshop_roles);
  pushValue(crafter?.workshopRoles);
  pushValue(crafter?.crafting_roles);
  pushValue(crafter?.craftingRoles);
  pushValue(crafter?.services);
  pushValue(crafter?.professions);
  pushValue(crafter?.tags);

  // Secondary fuzzy fields remain supported, but only with stricter keywords.
  pushValue(crafter?.role);
  pushValue(crafter?.affiliation);
  pushValue(crafter?.storefront_title);
  pushValue(crafter?.storefront_tagline);
  pushValue(crafter?.name);
  return values;
}

function inferCrafterTypes(crafter) {
  const types = new Set();
  collectCrafterRoleValues(crafter).forEach((value) => {
    const type = inferCraftTypeFromText(value);
    if (type) types.add(type);
  });
  return Array.from(types);
}

function humanizeCraftType(type) {
  switch (type) {
    case "blacksmith": return "Blacksmith";
    case "alchemist": return "Alchemist";
    case "enchanter": return "Enchanter";
    case "scribe": return "Scribe";
    case "jeweler": return "Jeweler";
    default: return "Artisan";
  }
}

function buildWorkshopServices(types = []) {
  const services = [];
  if (types.includes("blacksmith")) {
    services.push({
      id: "forge_mundane",
      title: "Forge mundane",
      subtitle: "New weapons, armor, shields, and ammunition",
      requiresSecondary: false,
      requiresTier: false,
      allowedTypes: ["weapon", "armor", "shield", "ammunition"],
      baseLabel: "Forge pattern",
      basePlaceholder: "Choose the item pattern to forge",
      resultLabel: "Fresh forge preview",
      description: "Create a new mundane item from a proven smithing pattern.",
    });
    services.push({
      id: "reforge",
      title: "Reforge & temper",
      subtitle: "Weapons and armor improvements",
      requiresSecondary: false,
      requiresTier: true,
      allowedTypes: ["weapon", "armor", "shield"],
      baseLabel: "Base weapon / armor",
      basePlaceholder: "Choose the mundane item to improve",
      tierLabel: "Enhancement tier",
      resultLabel: "Forged finish preview",
      description: "Temper a martial item into a stronger town-crafted variant.",
    });
  }
  if (types.includes("alchemist")) {
    services.push({
      id: "brew",
      title: "Alchemy blend",
      subtitle: "Potions, herbs, poisons, and essences",
      requiresSecondary: true,
      requiresTier: false,
      allowedTypes: ["potion", "poison", "consumable", "gear"],
      baseLabel: "Base reagent",
      basePlaceholder: "Choose the primary ingredient",
      secondaryLabel: "Secondary ingredient",
      secondaryPlaceholder: "Choose the supporting ingredient",
      resultLabel: "Experimental mixture preview",
      description: "Combine one base reagent with one supporting ingredient.",
    });
  }
  if (types.includes("enchanter")) {
    services.push({
      id: "imbue",
      title: "Arcane imbuement",
      subtitle: "A/B/C magical traits for tiered gear",
      requiresSecondary: false,
      requiresTier: false,
      requiresExistingTier: true,
      allowedTypes: ["weapon", "armor", "shield", "ammunition"],
      baseLabel: "Tiered item to imbue",
      basePlaceholder: "Choose a +1, +2, or +3 item",
      resultLabel: "Runed result preview",
      description: "Etch magical traits into a smith-tiered weapon, armor, shield, or ammunition.",
    });
  }
  if (types.includes("scribe")) {
    services.push({
      id: "inscribe",
      title: "Inscribe & copy",
      subtitle: "Scrolls, manuals, and coded notes",
      requiresSecondary: false,
      requiresTier: false,
      allowedTypes: ["scroll", "book", "tool", "gear"],
      baseLabel: "Base text / tool",
      basePlaceholder: "Choose the item to inscribe",
      resultLabel: "Inscribed utility preview",
      description: "Prepare a written or encoded upgrade concept.",
    });
  }
  if (types.includes("jeweler")) {
    services.push({
      id: "socket",
      title: "Gem setting",
      subtitle: "Socket, polish, and finish",
      requiresSecondary: true,
      requiresTier: false,
      allowedTypes: ["wondrous item", "gear", "armor", "weapon"],
      baseLabel: "Base item to socket",
      basePlaceholder: "Choose the item receiving the setting",
      secondaryLabel: "Socket component",
      secondaryPlaceholder: "Choose the gem, shard, or fitting",
      resultLabel: "Gem-set refinement preview",
      description: "Set a gem or ceremonial component into a suitable item.",
    });
  }
  return services;
}

function looksLikeMaterialItem(item) {
  const blob = [
    item?.item_name,
    item?.item_type,
    item?.card_payload?.item_type,
    item?.card_payload?.type,
    item?.card_payload?.uiType,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
    .join(" | ");
  return /(adamant|mithral|silver|silvered|ruidium|ore|ingot|dust|hide|scale|core|essence|obsidian|cold iron)/.test(blob);
}

function looksLikeCatalystItem(item) {
  const blob = [
    item?.item_name,
    item?.item_type,
    item?.card_payload?.item_type,
    item?.card_payload?.type,
    item?.card_payload?.uiType,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
    .join(" | ");
  return /(fang|eye|claw|hide|horn|rune|sigil|essence|dust|shard|gem|scale|heart|core|ichor|venom|gland|ink|oil|resin)/.test(blob);
}

const WORKSHOP_TABS = [
  { id: "melee", label: "Melee", allowedTypes: ["weapon"] },
  { id: "ranged", label: "Ranged", allowedTypes: ["weapon"] },
  { id: "thrown", label: "Thrown", allowedTypes: ["weapon"] },
  { id: "armor", label: "Armor", allowedTypes: ["armor"] },
  { id: "shield", label: "Shield", allowedTypes: ["shield"] },
  { id: "ammunition", label: "Ammunition", allowedTypes: ["ammunition"] },
];

const DAMAGE_TYPES = {
  P: "piercing",
  S: "slashing",
  B: "bludgeoning",
  R: "radiant",
  N: "necrotic",
  F: "fire",
  C: "cold",
  L: "lightning",
  A: "acid",
  T: "thunder",
  Psn: "poison",
  Psy: "psychic",
  Frc: "force",
};

const PROP_LABELS = {
  L: "Light",
  F: "Finesse",
  H: "Heavy",
  R: "Reach",
  T: "Thrown",
  V: "Versatile",
  "2H": "Two-Handed",
  A: "Ammunition",
  LD: "Loading",
  S: "Special",
  RLD: "Reload",
};

const RANGED_WORKSHOP_NAME = /(bow|crossbow|sling|blowgun)/i;
const FIREARM_WORKSHOP_NAME = /(pistol|rifle|musket|revolver|firearm|shotgun|carbine|antimatter)/i;

function titleCaseText(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function stripCatalogTag(value) {
  return String(value || "").split("|")[0].trim();
}

function getWorkshopPayload(item) {
  return item?.card_payload && typeof item.card_payload === "object" ? item.card_payload : item || {};
}

function getWorkshopUiType(item) {
  const payload = getWorkshopPayload(item);
  return String(
    item?.uiType ||
    item?.rawType ||
    item?.item_type ||
    payload.uiType ||
    payload.rawType ||
    payload.item_type ||
    payload.type ||
    item?.type ||
    ""
  );
}

function getWorkshopPropCodes(item) {
  const payload = getWorkshopPayload(item);
  const raw = []
    .concat(item?.property || item?.properties || [])
    .concat(payload.property || payload.properties || []);
  const codes = raw
    .map((prop) => (typeof prop === "string" ? prop : prop?.uid || prop?.abbreviation || prop?.abbrev || ""))
    .map(stripCatalogTag)
    .filter(Boolean);

  const text = [item?.propertiesText, payload.propertiesText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (text.includes("versatile")) codes.push("V");
  if (text.includes("thrown")) codes.push("T");
  if (text.includes("ammunition")) codes.push("A");
  if (text.includes("loading")) codes.push("LD");
  if (text.includes("two-handed") || /\b2h\b/i.test(text)) codes.push("2H");
  if (text.includes("reach")) codes.push("R");

  const seen = new Set();
  return codes.filter((code) => {
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

function buildWorkshopDamageText(item) {
  const payload = getWorkshopPayload(item);
  const props = getWorkshopPropCodes(item);
  const dmg1 = item?.dmg1 || payload.dmg1;
  const dmg2 = item?.dmg2 || payload.dmg2;
  const dmgType = item?.dmgType || payload.dmgType;
  const base = dmg1 ? `${dmg1} ${DAMAGE_TYPES[dmgType] || dmgType || ""}`.trim() : "";
  const versatile = props.includes("V") && dmg2 ? `versatile (${dmg2})` : "";
  return [base, versatile].filter(Boolean).join("; ");
}

function buildWorkshopRangeText(item) {
  const payload = getWorkshopPayload(item);
  const props = getWorkshopPropCodes(item);
  const range = item?.rangeText || payload.rangeText || item?.range || payload.range || "";
  const clean = range ? String(range).replace(/ft\.?$/i, "").trim() : "";
  if (props.includes("T")) return clean ? `Thrown ${clean} ft.` : "Thrown";
  return clean ? `${clean} ft.` : "";
}

function buildWorkshopPropsText(item) {
  const payload = getWorkshopPayload(item);
  const existing = item?.propertiesText || payload.propertiesText || "";
  if (String(existing).trim()) return existing;
  return getWorkshopPropCodes(item).map((code) => PROP_LABELS[code] || code).join(", ");
}

function hasWorkshopDamage(item) {
  const payload = getWorkshopPayload(item);
  return Boolean(item?.dmg1 || item?.damageText || payload.dmg1 || payload.damageText);
}

function isWorkshopTradeGood(item) {
  const ui = getWorkshopUiType(item).toLowerCase();
  const type = String(item?.type || item?.item_type || getWorkshopPayload(item).type || "").toUpperCase();
  return ui === "trade good" || ui === "trade goods" || type === "TG";
}

function isWorkshopFutureItem(item) {
  const payload = getWorkshopPayload(item);
  const blob = [
    getWorkshopUiType(item),
    item?.name,
    item?.item_name,
    payload.name,
    payload.item_name,
    item?.source,
    payload.source,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Keep the town smith list medieval/fantasy by default. These catalog rows are
  // mundane by rarity, but they are explicitly modern/futuristic equipment and
  // should not be presented as ordinary blacksmith forge patterns.
  return /future|modern|futuristic|antimatter|laser|automatic\s+(pistol|rifle)|\b(pistol|musket|rifle|revolver|shotgun|carbine)\b|firearm\s+(bullet|needle|ammunition)|hunting rifle|modern rifle|alien firearm/.test(blob);
}

function isWorkshopThrownWeapon(item) {
  return getWorkshopPropCodes(item).includes("T");
}

function isWorkshopRangedWeapon(item) {
  const payload = getWorkshopPayload(item);
  const name = String(item?.name || item?.item_name || payload.name || payload.item_name || "");
  const ui = getWorkshopUiType(item);
  const props = getWorkshopPropCodes(item);
  if (/ranged/i.test(ui)) return true;
  if (RANGED_WORKSHOP_NAME.test(name)) return true;
  if (FIREARM_WORKSHOP_NAME.test(name)) return true;
  if (props.includes("A")) return true;
  return false;
}

function isWorkshopMeleeWeapon(item) {
  const payload = getWorkshopPayload(item);
  const name = String(item?.name || item?.item_name || payload.name || payload.item_name || "");
  const ui = getWorkshopUiType(item);
  if (/melee/i.test(ui)) return true;
  if (/weapon/i.test(ui) && !isWorkshopRangedWeapon(item)) return true;
  if (RANGED_WORKSHOP_NAME.test(name) || FIREARM_WORKSHOP_NAME.test(name)) return false;
  return hasWorkshopDamage(item);
}

function buildPreviewText({ service, primaryItem, secondaryItem, materialItem, catalystA, catalystB, catalystC, bonus = 0, crafter }) {
  if (!service || !primaryItem) return "Choose a service and a base item to preview the workshop result.";
  const crafterName = crafter?.name || "this crafter";
  const main = primaryItem?.item_name || "the selected item";
  const pieces = [];
  if (materialItem?.item_name) pieces.push(`material: ${materialItem.item_name}`);
  if (secondaryItem?.item_name) pieces.push(`secondary: ${secondaryItem.item_name}`);
  if (catalystA?.item_name) pieces.push(`A: ${catalystA.item_name}`);
  if (catalystB?.item_name) pieces.push(`B: ${catalystB.item_name}`);
  if (catalystC?.item_name) pieces.push(`C: ${catalystC.item_name}`);
  const extras = pieces.length ? ` using ${pieces.join(" • ")}` : "";
  switch (service.id) {
    case "forge_mundane":
      return `${crafterName} can forge a fresh ${main}${extras}, producing a newly made mundane item ready for later upgrades.`;
    case "reforge":
      return `${crafterName} can reforge ${main}${bonus > 0 ? ` to +${bonus}` : ""}${extras}, hardening its finish into a stronger forged variant.`;
    case "brew":
      return `${crafterName} can blend ${main}${extras} into an unstable alchemical mixture with a stronger consumable effect.`;
    case "imbue":
      return `${crafterName} can etch arcane runes into ${main}${bonus > 0 ? ` at tier ${bonus}` : ""}${extras}, previewing a magical rider or infused trait.`;
    case "inscribe":
      return `${crafterName} can inscribe ${main}${extras}, preparing a written utility effect, encoded script, or copied ritual form.`;
    case "socket":
      return `${crafterName} can set and polish ${main}${extras}, previewing a gemmed refinement or ceremonial enhancement.`;
    default:
      return `${crafterName} can rework ${main}${extras} into a custom artisan result suited to the town.`;
  }
}

function hasWorkshopMagicSignals(item) {
  const payload = getWorkshopPayload(item);
  const nameBlob = [
    item?.name,
    item?.item_name,
    payload.name,
    payload.item_name,
    item?.baseItem,
    payload.baseItem,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const textBlob = [
    item?.attunementText,
    payload.attunementText,
    item?.tier,
    payload.tier,
    item?.rarity,
    payload.rarity,
    item?.item_description,
    payload.item_description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Defensive guard used by Forge Mundane. Some generated/catalog-copy rows have
  // rarity "none" but are clearly magic variants or legacy artifact states.
  // Those belong to Enchanter work, loot, or admin tooling—not smith templates.
  return Boolean(
    item?.wondrous ||
    payload.wondrous ||
    item?.reqAttune ||
    payload.reqAttune ||
    item?.reqAttuneTags ||
    payload.reqAttuneTags ||
    item?.bonusWeapon ||
    payload.bonusWeapon ||
    item?.bonusAc ||
    payload.bonusAc ||
    item?.bonusSpellAttack ||
    payload.bonusSpellAttack ||
    item?.bonusSpellSaveDc ||
    payload.bonusSpellSaveDc ||
    item?.attachedSpells ||
    payload.attachedSpells ||
    item?.charges ||
    payload.charges ||
    item?.recharge ||
    payload.recharge ||
    item?.curse ||
    payload.curse ||
    item?.sentient ||
    payload.sentient ||
    /^\s*\+\d+\b/.test(nameBlob) ||
    /\b(awakened|exalted|dormant|slumbering|stirring|ascendant)\b/.test(nameBlob) ||
    /\b(of warning|of slaying|of resistance|dragon's wrath|flame tongue|vorpal|vicious|defender|holy avenger|nine lives stealer|berserker|dancing|wounding|life stealing|sharpness|moon-touched|moon touched|walloping|winged|drow \+)\b/.test(nameBlob) ||
    /\b(requires attunement|attunement|magic weapon|magic armor|artifact)\b/.test(textBlob)
  );
}

function isMundaneWorkshopTemplate(item) {
  const payload = getWorkshopPayload(item);
  const rarity = String(item?.rarity || item?.item_rarity || payload.rarity || payload.item_rarity || "").toLowerCase().trim();

  // Forge Mundane is deliberately stricter than the admin item builder:
  // smiths may only start from true mundane equipment templates. Common magic
  // items, generated magic variants, exalted/dormant artifact states, and any
  // item with magic signals belong to Enchanter work, loot, or admin tooling.
  if (rarity && rarity !== "none" && rarity !== "mundane") return false;
  return !hasWorkshopMagicSignals(item);
}


const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"];
const PHYSICAL_VARIANT_KEYS = new Set(["enhancement", "adamantine", "mithral", "silvered", "ruidium"]);

// Enchanters draw from the core magic variant catalog plus optional focused
// extension packs. The HB armor/shield pack restores the defensive properties
// that are not present in the smaller core catalog while keeping smith Forge
// Mundane isolated from magical traits.
const MAGIC_VARIANT_CATALOG_PATHS = [
  { path: "/items/magicvariants.json", required: true },
  { path: "/items/magicvariants.hb-armor-shield.json", required: false },
];

function normalizeRarityLabel(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("legend")) return "Legendary";
  if (text.includes("very")) return "Very Rare";
  if (text.includes("rare")) return "Rare";
  if (text.includes("uncommon")) return "Uncommon";
  if (text.includes("common")) return "Common";
  return "";
}

function highestRarity(...values) {
  return values
    .map(normalizeRarityLabel)
    .filter(Boolean)
    .reduce((best, current) => {
      const bestIndex = RARITY_ORDER.indexOf(best || "");
      const currentIndex = RARITY_ORDER.indexOf(current || "");
      return currentIndex > bestIndex ? current : best;
    }, "") || "Common";
}

function canonicalKindFromWorkshopTab(tabId) {
  return ["melee", "ranged", "thrown"].includes(tabId) ? "weapon" : tabId;
}

function extractTierFromItem(item) {
  const payload = getWorkshopPayload(item);
  const candidates = [
    item?.crafted_bonus,
    item?.crafted_tier,
    item?.bonus,
    item?.tier,
    payload.crafted_bonus,
    payload.crafted_tier,
    payload.bonus,
    payload.tier,
    payload.enhancement_bonus,
  ];
  for (const value of candidates) {
    const n = parseInt(String(value || "").replace(/[^0-9-]/g, ""), 10);
    if ([1, 2, 3].includes(n)) return n;
  }

  const blob = [item?.item_name, item?.name, payload.item_name, payload.name, payload.bonusWeapon, payload.bonusAc]
    .filter(Boolean)
    .join(" ");
  const match = blob.match(/(?:^|\s)\+(1|2|3)\b/);
  return match ? Number(match[1]) : 0;
}

function getUnlockedEnchantSlots(tier) {
  const n = Number(tier) || 0;
  if (n >= 3) return ["A", "B", "C"];
  if (n >= 2) return ["A", "B"];
  if (n >= 1) return ["A"];
  return [];
}

function getVariantKey(variant) {
  return String(variant?.key || variant?.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeMagicVariant(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim();
  if (!name) return null;
  const key = getVariantKey(raw);
  return {
    ...raw,
    key,
    name,
    appliesTo: Array.isArray(raw.appliesTo) && raw.appliesTo.length
      ? raw.appliesTo.map((value) => String(value).toLowerCase())
      : ["weapon", "armor", "shield", "ammunition"],
    options: Array.isArray(raw.options) ? raw.options : [],
    textByKind: raw.textByKind && typeof raw.textByKind === "object" ? raw.textByKind : {},
    entries: Array.isArray(raw.entries) ? raw.entries : raw.entries ? [String(raw.entries)] : [],
    rarity: normalizeRarityLabel(raw.rarity),
    rarityByValue: raw.rarityByValue && typeof raw.rarityByValue === "object" ? raw.rarityByValue : null,
    requires: raw.requires && typeof raw.requires === "object" ? raw.requires : null,
    attunement: !!raw.attunement,
    cursed: !!raw.cursed,
  };
}

function extractMagicVariantRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.variants)) return data.variants;
  if (Array.isArray(data?.magicvariants)) return data.magicvariants;
  return [];
}

function normalizeMagicVariantCatalog(data) {
  const rows = extractMagicVariantRows(data);
  const seen = new Set();
  const out = [];
  rows.forEach((row) => {
    const variant = normalizeMagicVariant(row);
    if (!variant) return;
    if (PHYSICAL_VARIANT_KEYS.has(variant.key)) return;
    const identity = `${variant.key}:${variant.name}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    out.push(variant);
  });
  return out.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function variantOptionMeta(variant) {
  const key = getVariantKey(variant);
  if (key === "armor_resistance" || key === "shield_resistance") return { label: "Resistance type", namePart: (option) => `${titleCaseText(option)} Resistance` };
  if (key === "armor_vulnerability" || key === "shield_vulnerability") return { label: "Damage type", namePart: (option) => `${titleCaseText(option)} Vulnerability` };
  if (key === "ammunition_slaying") return { label: "Creature type", namePart: (option) => `Slaying (${titleCaseText(option)})` };
  if (key === "enspell_weapon" || key === "enspell_armor") return { label: "Spell level", namePart: (option) => `Level ${option} Spell` };
  if (Array.isArray(variant?.options) && variant.options.length) return { label: "Option", namePart: (option) => titleCaseText(option) };
  return null;
}

function getWorkshopDamageWords(item) {
  const payload = getWorkshopPayload(item);
  const words = new Set();
  const codes = [item?.dmgType, payload.dmgType].filter(Boolean);
  codes.forEach((code) => words.add(String(DAMAGE_TYPES[code] || code || "").toLowerCase()));
  const text = [item?.damageText, payload.damageText].filter(Boolean).join(" ").toLowerCase();
  Object.values(DAMAGE_TYPES).forEach((word) => {
    if (text.includes(word)) words.add(word);
  });
  return words;
}

function getWorkshopFamilyWords(item) {
  const payload = getWorkshopPayload(item);
  const name = [item?.item_name, item?.name, payload.item_name, payload.name, payload.baseItem]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const words = new Set();
  const families = [
    "sword", "axe", "bow", "crossbow", "sling", "blowgun", "dagger", "mace", "staff", "hammer", "spear", "halberd", "glaive", "pike", "trident", "whip", "flail", "club", "maul", "lance", "rapier", "scimitar"
  ];
  families.forEach((family) => {
    if (name.includes(family)) words.add(family);
  });
  if (/longsword|shortsword|greatsword|sword/.test(name)) words.add("sword");
  return words;
}

function getArmorWeightClass(item) {
  const payload = getWorkshopPayload(item);
  const code = stripCatalogTag(item?.type || item?.item_type || payload.type || payload.item_type || "").toUpperCase();
  if (code === "LA") return "light";
  if (code === "MA") return "medium";
  if (code === "HA") return "heavy";

  const blob = [
    item?.item_name,
    item?.name,
    item?.item_type,
    item?.uiType,
    payload.item_name,
    payload.name,
    payload.item_type,
    payload.uiType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(studded leather|leather armor|padded armor|light armor)\b/.test(blob)) return "light";
  if (/\b(hide armor|chain shirt|scale mail|breastplate|half plate|medium armor)\b/.test(blob)) return "medium";
  if (/\b(ring mail|chain mail|splint|plate armor|heavy armor)\b/.test(blob)) return "heavy";
  return "";
}

function magicVariantRequirementFailure(variant, item, tier) {
  if (!variant || !item) return "Choose a base item first.";
  if (/\bvorpal\b/i.test(`${variant.key || ""} ${variant.name || ""}`) && Number(tier) < 3) return "Requires a +3 item.";
  const requires = variant.requires || {};
  const families = Array.isArray(requires.weaponFamily) ? requires.weaponFamily.map((value) => String(value).toLowerCase()) : [];
  if (families.length) {
    const itemFamilies = getWorkshopFamilyWords(item);
    if (!families.some((family) => itemFamilies.has(family) || [...itemFamilies].some((word) => word.includes(family)))) {
      return `Requires ${families.map(titleCaseText).join(" or ")}.`;
    }
  }
  const damageTypes = Array.isArray(requires.damageType) ? requires.damageType.map((value) => String(value).toLowerCase()) : [];
  if (damageTypes.length) {
    const itemDamage = getWorkshopDamageWords(item);
    if (!damageTypes.some((damage) => itemDamage.has(damage))) return `Requires ${damageTypes.map(titleCaseText).join(" or ")} damage.`;
  }

  const armorWeights = Array.isArray(requires.armorWeight)
    ? requires.armorWeight.map((value) => String(value).toLowerCase())
    : [];
  if (armorWeights.length) {
    const armorWeight = getArmorWeightClass(item);
    if (!armorWeight || !armorWeights.includes(armorWeight)) {
      return `Requires ${armorWeights.map(titleCaseText).join(" or ")} armor.`;
    }
  }

  return "";
}

function magicVariantAppliesToItem(variant, item, tier) {
  if (!variant || !item) return false;
  const tab = workshopTabForItem(item);
  const kind = canonicalKindFromWorkshopTab(tab);
  if (!variant.appliesTo?.includes(kind)) return false;
  return !magicVariantRequirementFailure(variant, item, tier);
}

function textForMagicVariant(variant, item, option) {
  if (!variant) return "";
  const kind = canonicalKindFromWorkshopTab(workshopTabForItem(item));
  let body = variant.textByKind?.[kind] || "";
  if (!body || /^\s*as\s+entry\.?\s*$/i.test(body)) body = variant.entries?.join(" ") || "";
  const value = option == null ? "" : String(option);
  return String(body || "")
    .replace(/\{OPTION\}/g, titleCaseText(value))
    .replace(/\{LEVEL\}/g, value)
    .replace(/\{DC\}/g, variant.dcByValue?.[value] || "—")
    .replace(/\{ATK\}/g, variant.attackByValue?.[value] || "—")
    .replace(/\{SCHOOLS\}/g, variant.schools || "—")
    .replace(/\{N\}/g, "");
}

function rarityForMagicVariant(variant, option) {
  if (!variant) return "";
  if (variant.rarityByValue && option !== undefined && option !== null && option !== "") {
    return normalizeRarityLabel(variant.rarityByValue[String(option)] || variant.rarityByValue[Number(option)]);
  }
  return normalizeRarityLabel(variant.rarity);
}

function displayNameForMagicVariant(variant, option) {
  if (!variant) return "";
  const meta = variantOptionMeta(variant);
  if (meta && option) return `${variant.name}: ${meta.namePart(option)}`;
  return variant.name;
}

function namePartsForMagicVariant(variant, option) {
  if (!variant) return { prefix: "", ofPart: "" };
  const meta = variantOptionMeta(variant);
  if (meta && option) return { prefix: "", ofPart: meta.namePart(option) };
  const name = String(variant.name || "").trim();
  if (/\bof\b/i.test(name)) {
    const parts = name.split(/\bof\b/i);
    return { prefix: "", ofPart: (parts.slice(1).join("of") || name).trim() };
  }
  return {
    prefix: name.replace(/\s*(weapon|armor|shield|ammunition|sword)\s*$/i, "").trim(),
    ofPart: "",
  };
}

function composeImbuePreview({ primaryItem, tier, selectedVariants }) {
  if (!primaryItem) return { name: "Choose an item", rarity: "—", entries: [], warnings: [], labels: [] };
  const baseName = String(primaryItem.item_name || primaryItem.name || "Item").replace(/^\+([1-3])\s+/i, "").trim();
  const prefix = `+${tier}`;
  const labels = selectedVariants.map((slot) => displayNameForMagicVariant(slot.variant, slot.option)).filter(Boolean);
  const nameParts = selectedVariants.map((slot) => namePartsForMagicVariant(slot.variant, slot.option));
  const leadingParts = nameParts.map((part) => part.prefix).filter(Boolean);
  const ofParts = [];
  nameParts.map((part) => part.ofPart).filter(Boolean).forEach((part) => {
    if (!ofParts.some((existing) => existing.toLowerCase() === part.toLowerCase())) ofParts.push(part);
  });
  const head = [prefix, ...leadingParts].filter(Boolean).join(" ").trim();
  const name = `${head ? `${head} ` : ""}${baseName}${ofParts.length ? ` of ${ofParts.join(" and ")}` : ""}`.replace(/\s+/g, " ").trim();
  const entries = selectedVariants.map((slot) => textForMagicVariant(slot.variant, primaryItem, slot.option)).filter(Boolean);
  const rarity = highestRarity(primaryItem.item_rarity, primaryItem.card_payload?.rarity, ...selectedVariants.map((slot) => rarityForMagicVariant(slot.variant, slot.option)));
  const warnings = selectedVariants
    .map((slot) => magicVariantRequirementFailure(slot.variant, primaryItem, tier))
    .filter(Boolean);
  return { name, rarity, entries, warnings, labels };
}

function useMagicVariantCatalog(enabled) {
  const [state, setState] = useState({ items: [], status: "idle", message: "" });
  useEffect(() => {
    let dead = false;
    if (!enabled) return;
    setState((prev) => ({ ...prev, status: "loading", message: "" }));
    (async () => {
      try {
        const allRows = [];
        for (const source of MAGIC_VARIANT_CATALOG_PATHS) {
          try {
            const res = await fetch(source.path);
            if (!res.ok) {
              if (source.required) throw new Error(`${source.path} HTTP ${res.status}`);
              console.warn(`Optional magic variant catalog skipped: ${source.path} (${res.status})`);
              continue;
            }
            const data = await res.json();
            allRows.push(...extractMagicVariantRows(data));
          } catch (sourceErr) {
            if (source.required) throw sourceErr;
            console.warn(`Optional magic variant catalog skipped: ${source.path}`, sourceErr);
          }
        }
        const normalized = normalizeMagicVariantCatalog(allRows);
        if (!dead) setState({ items: normalized, status: "ready", message: "" });
      } catch (err) {
        if (!dead) setState({ items: [], status: "error", message: err?.message || "Unable to load magic variant catalog." });
      }
    })();
    return () => { dead = true; };
  }, [enabled]);
  return state;
}

function workshopTabForItem(item) {
  const payload = getWorkshopPayload(item);
  const explicitTab = item?.workshopTab || payload.workshopTab;
  if (WORKSHOP_TABS.some((tab) => tab.id === explicitTab)) return explicitTab;

  const ui = getWorkshopUiType(item).toLowerCase();
  const type = String(item?.type || item?.item_type || payload.type || payload.item_type || "").toUpperCase();

  if (/shield/.test(ui) || type === "S" || type === "SH") return "shield";
  if (/ammunition/.test(ui) || type === "A") return "ammunition";
  if (/armor|armour/.test(ui) || ["LA", "MA", "HA"].includes(type)) return "armor";
  if (isWorkshopThrownWeapon(item)) return "thrown";
  if (isWorkshopRangedWeapon(item)) return "ranged";
  if (isWorkshopMeleeWeapon(item)) return "melee";
  return "gear";
}

function normalizeItemType(item) {
  const tab = workshopTabForItem(item);
  if (tab === "armor") return "armor";
  if (tab === "shield") return "shield";
  if (tab === "ammunition") return "ammunition";
  if (["melee", "ranged", "thrown"].includes(tab)) return "weapon";

  const fields = [
    item?.item_type,
    item?.item_name,
    item?.uiType,
    item?.rawType,
    item?.type,
    item?.card_payload?.item_type,
    item?.card_payload?.type,
    item?.card_payload?.uiType,
    item?.card_payload?.rawType,
    item?.card_payload?.name,
    item?.__cls?.uiType,
    item?.__cls?.rawType,
    item?.name,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  const blob = fields.join(" | ");

  if (/(^|\b)(potion|poison|elixir|brew|philter|consumable)(\b|$)/.test(blob)) return "potion";
  if (/(^|\b)(scroll)(\b|$)/.test(blob)) return "scroll";
  if (/(^|\b)(tool|kit)(\b|$)/.test(blob)) return "tool";
  if (/(^|\b)(book|manual|tome)(\b|$)/.test(blob)) return "book";
  if (/(^|\b)(wondrous|ring|amulet|rod|wand)(\b|$)/.test(blob)) return "wondrous item";
  return "gear";
}

function slugWorkshopId(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function normalizeWorkshopCatalogItem(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;
  if (!isMundaneWorkshopTemplate(raw)) return null;
  if (isWorkshopTradeGood(raw) || isWorkshopFutureItem(raw)) return null;

  // Do not infer forge templates from names alone. The catalog contains mounts,
  // vehicles, tools, spellcasting staves, future weapons, and generated magic
  // items whose names look weapon-like. Smith forging should only accept the
  // canonical physical equipment type codes used by the item catalog.
  const rawTypeCode = stripCatalogTag(raw.type || raw.item_type || raw.rawType || "").toUpperCase();
  const forgeableTypeCodes = new Set(["M", "R", "A", "LA", "MA", "HA", "S"]);
  if (!forgeableTypeCodes.has(rawTypeCode)) return null;

  const tab = workshopTabForItem(raw);
  if (!WORKSHOP_TABS.some((entry) => entry.id === tab)) return null;

  const name = String(raw.item_name || raw.name || "").trim();
  if (!name) return null;

  const itemType = normalizeItemType({ ...raw, workshopTab: tab });
  if (!["weapon", "armor", "shield", "ammunition"].includes(itemType)) return null;

  const rarity = raw.item_rarity || raw.rarity || "Mundane";
  const sourceId = raw.id || raw._id || raw.uid || `${slugWorkshopId(name)}-${raw.source || raw.type || tab}-${index}`;
  const description = raw.item_description || raw.rulesShort || raw.loreShort || raw.entries?.join?.(" ") || "";
  const payload = {
    ...raw,
    id: raw.id || sourceId,
    item_name: name,
    item_type: itemType,
    item_rarity: rarity,
    workshopTab: tab,
    damageText: raw.damageText || buildWorkshopDamageText(raw),
    rangeText: raw.rangeText || buildWorkshopRangeText(raw),
    propertiesText: raw.propertiesText || buildWorkshopPropsText(raw),
  };

  return {
    id: `catalog-${sourceId}`,
    item_id: sourceId,
    item_name: name,
    item_type: itemType,
    item_rarity: rarity,
    item_description: description,
    item_weight: raw.item_weight || raw.weight || null,
    item_cost: raw.item_cost || raw.cost || raw.value || null,
    workshopTab: tab,
    damageText: payload.damageText || "",
    rangeText: payload.rangeText || "",
    propertiesText: payload.propertiesText || "",
    ac: raw.ac ?? raw.armorClass ?? null,
    card_payload: payload,
  };
}

function normalizeWorkshopCatalog(rawData) {
  const rows = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.items)
      ? rawData.items
      : Array.isArray(rawData?.item)
        ? rawData.item
        : [];

  const byId = new Map();
  rows.forEach((raw, index) => {
    const normalized = normalizeWorkshopCatalogItem(raw, index);
    if (!normalized) return;
    byId.set(normalized.id, normalized);
  });
  return Array.from(byId.values()).sort((a, b) => String(a.item_name || "").localeCompare(String(b.item_name || "")));
}

function tabAllowedForService(tabId, service) {
  if (!service) return false;
  const tab = WORKSHOP_TABS.find((entry) => entry.id === tabId);
  if (!tab) return false;
  if (service.id === "forge_mundane") return true;
  if (service.id === "reforge") return tabId !== "ammunition";
  if (!service.allowedTypes?.length) return true;
  return tab.allowedTypes.some((type) => service.allowedTypes.includes(type));
}

function useWorkshopItemCatalog(enabled) {
  const [state, setState] = useState({ items: [], status: "idle", message: "" });
  useEffect(() => {
    let dead = false;
    if (!enabled) return;
    setState((prev) => ({ ...prev, status: "loading", message: "" }));
    (async () => {
      try {
        const res = await fetch("/items/all-items.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const normalized = normalizeWorkshopCatalog(data);
        if (!dead) setState({ items: normalized, status: "ready", message: "" });
      } catch (err) {
        if (!dead) {
          setState({
            items: [],
            status: "error",
            message: err?.message || "Unable to load workshop item catalog.",
          });
        }
      }
    })();
    return () => { dead = true; };
  }, [enabled]);
  return state;
}

function BannerStat({ label, value, tone = "stone" }) {
  return (
    <div className={cls(styles.bannerStat, toneKey(tone))}>
      <div className={styles.eyebrow}>{label}</div>
      <div className={styles.bannerValue}>{value}</div>
    </div>
  );
}

function CompactTeaser({ kicker, title, subtitle, featured, tone, active, onOpen }) {
  return (
    <button
      type="button"
      className={cls(styles.teaserCard, toneKey(tone), active && styles.teaserCardActive)}
      onClick={onOpen}
    >
      <div className={styles.teaserHead}>
        <div>
          <div className={styles.eyebrow}>{kicker}</div>
          <div className={styles.teaserTitle}>{title}</div>
          <div className={styles.muted}>{subtitle}</div>
        </div>
        <div className={styles.teaserMeta}>{active ? "open" : "view"}</div>
      </div>
      {featured ? (
        <div className={cls(styles.teaserFeatured, toneKey(tone))}>
          <div className={styles.drawerItemTitle}>{featured.title}</div>
          <div className={styles.drawerItemText}>{featured.text}</div>
        </div>
      ) : null}
    </button>
  );
}

function DrawerTabs({ openPanel, setOpenPanel }) {
  const tabs = [
    ["stories", "City stories"],
    ["people", "Featured people"],
    ["jobs", "Jobs & quest leads"],
    ["rumors", "Tavern rumors"],
    ["market", "Bazaar / market"],
    ["crafters", "Crafters' quarter"],
  ];

  return (
    <div className={styles.drawerTabs}>
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={cls(styles.drawerTab, openPanel === id && styles.drawerTabActive)}
          onClick={() => setOpenPanel(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SharedDrawerContent({ panel }) {
  return (
    <div className={styles.drawerItems}>
      {(panel.items || []).map((item, idx) => (
        <div key={`${item.title}-${idx}`} className={cls(styles.drawerItem, toneKey(panel.tone))}>
          <div className={styles.drawerItemTitle}>{item.title}</div>
          <div className={styles.drawerItemText}>{item.text}</div>
        </div>
      ))}
    </div>
  );
}

function merchantSubtitle(merchant) {
  return merchant?.storefront_tagline || merchant?.storefront_title || merchant?.role || merchant?.affiliation || "Merchant";
}

function MerchantLinkRow({ merchant }) {
  const profileHref = merchant?.id ? `/npcs#${merchant.id}` : null;
  const shopHref = merchant?.storefront_enabled && merchant?.id ? `/map?merchant=${merchant.id}` : null;
  const badges = [];
  if (merchant?.isPresent) badges.push({ label: "In town", kind: "present" });
  if (merchant?.isResident) badges.push({ label: "Resident", kind: "resident" });
  if (!merchant?.isResident) badges.push({ label: "Traveler", kind: "traveler" });

  return (
    <div className={cls(styles.drawerItem, styles.marketCard, toneKey("amber"))}>
      <div className={styles.marketCardHead}>
        <div>
          <div className={styles.drawerItemTitle}>{merchant?.name || "Unknown Merchant"}</div>
          <div className={styles.drawerItemText}>{merchantSubtitle(merchant)}</div>
        </div>
        <div className={styles.marketBadgeRow}>
          {badges.map((badge) => (
            <span key={badge.label} className={cls(styles.marketBadge, badge.kind === "present" && styles.marketBadgePresent, badge.kind === "resident" && styles.marketBadgeResident)}>{badge.label}</span>
          ))}
        </div>
      </div>
      <div className={styles.marketActionRow}>
        {profileHref ? <a className="btn btn-sm btn-outline-light" href={profileHref}>Open Profile</a> : null}
        {shopHref ? <a className="btn btn-sm btn-warning" href={shopHref}>Browse Wares</a> : <span className={styles.marketMuted}>No storefront enabled</span>}
      </div>
    </div>
  );
}

function MarketDrawer({ marketData, townName }) {
  const present = Array.isArray(marketData?.presentMerchants) ? marketData.presentMerchants : [];
  const resident = Array.isArray(marketData?.residentMerchants) ? marketData.residentMerchants : [];
  const presentIds = new Set(present.map((m) => m.id));
  const enrichedPresent = present.map((m) => ({ ...m, isPresent: true, isResident: resident.some((r) => r.id === m.id) }));
  const enrichedResident = resident.map((m) => ({ ...m, isResident: true, isPresent: presentIds.has(m.id) }));

  return (
    <div className={styles.drawerItems}>
      <div className={cls(styles.drawerItem, styles.marketIntro, toneKey("amber"))}>
        <div className={styles.drawerItemTitle}>Bazaar of {townName || "Town"}</div>
        <div className={styles.drawerItemText}>Browse merchants currently in town and those who call this place home.</div>
      </div>

      <div className={styles.marketSection}>
        <div className={styles.marketSectionTitle}>Merchants in town now</div>
        {enrichedPresent.length ? enrichedPresent.map((merchant) => <MerchantLinkRow key={`present-${merchant.id}`} merchant={merchant} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No merchants are currently set to this town.</div></div>}
      </div>

      <div className={styles.marketSection}>
        <div className={styles.marketSectionTitle}>Resident merchants</div>
        {enrichedResident.length ? enrichedResident.map((merchant) => <MerchantLinkRow key={`resident-${merchant.id}`} merchant={merchant} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No resident merchants are assigned to this town yet.</div></div>}
      </div>
    </div>
  );
}


function CrafterWorkshopModal({ crafter, inventoryItems, onClose, onCraftWorkshop }) {
  const crafterTypes = useMemo(() => inferCrafterTypes(crafter), [crafter]);
  const services = useMemo(() => buildWorkshopServices(crafterTypes), [crafterTypes]);
  const catalogState = useWorkshopItemCatalog(true);
  const workshopCatalog = catalogState.items || [];
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [activeTab, setActiveTab] = useState("melee");
  const [primaryId, setPrimaryId] = useState("");
  const [secondaryId, setSecondaryId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [catalystAId, setCatalystAId] = useState("");
  const [catalystBId, setCatalystBId] = useState("");
  const [catalystCId, setCatalystCId] = useState("");
  const [enchantAKey, setEnchantAKey] = useState("");
  const [enchantAOption, setEnchantAOption] = useState("");
  const [enchantBKey, setEnchantBKey] = useState("");
  const [enchantBOption, setEnchantBOption] = useState("");
  const [enchantCKey, setEnchantCKey] = useState("");
  const [enchantCOption, setEnchantCOption] = useState("");
  const [bonus, setBonus] = useState("");
  const [craftState, setCraftState] = useState({ status: "idle", message: "" });
  const magicVariantState = useMagicVariantCatalog(serviceId === "imbue");
  const magicVariants = magicVariantState.items || [];

  useEffect(() => {
    const first = services[0] || null;
    setServiceId(first?.id || "");
    setPrimaryId("");
    setSecondaryId("");
    setMaterialId("");
    setCatalystAId("");
    setCatalystBId("");
    setCatalystCId("");
    setEnchantAKey("");
    setEnchantAOption("");
    setEnchantBKey("");
    setEnchantBOption("");
    setEnchantCKey("");
    setEnchantCOption("");
    setActiveTab("melee");
    setBonus(first?.requiresTier ? "" : "0");
    setCraftState({ status: "idle", message: "" });
  }, [crafter?.id, services]);

  const selectedService = services.find((service) => service.id === serviceId) || services[0] || null;

  const primarySource = useMemo(() => {
    const rawSource = selectedService?.id === "forge_mundane" ? workshopCatalog : (inventoryItems || []);
    return rawSource.filter((item) => {
      if (selectedService?.id === "forge_mundane" && !isMundaneWorkshopTemplate(item)) return false;
      if (selectedService?.id === "imbue" && extractTierFromItem(item) < 1) return false;
      if (!selectedService?.allowedTypes?.length) return true;
      return selectedService.allowedTypes.includes(normalizeItemType(item));
    });
  }, [selectedService?.id, selectedService?.allowedTypes, workshopCatalog, inventoryItems]);

  const tabCounts = useMemo(() => {
    const counts = Object.fromEntries(WORKSHOP_TABS.map((tab) => [tab.id, 0]));
    primarySource.forEach((item) => {
      const tab = workshopTabForItem(item);
      if (Object.prototype.hasOwnProperty.call(counts, tab)) counts[tab] += 1;
    });
    return counts;
  }, [primarySource]);

  const availableTabs = useMemo(() => {
    return WORKSHOP_TABS.filter((tab) => tabAllowedForService(tab.id, selectedService));
  }, [selectedService]);

  useEffect(() => {
    if (!availableTabs.length) {
      if (activeTab) setActiveTab("");
      return;
    }
    if (!availableTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(availableTabs[0].id);
    }
  }, [availableTabs, activeTab]);

  const filteredPrimary = useMemo(() => {
    if (!activeTab) return primarySource;
    return primarySource.filter((item) => workshopTabForItem(item) === activeTab);
  }, [primarySource, activeTab]);

  useEffect(() => {
    if (primaryId && !filteredPrimary.some((item) => String(item.id || item.item_id || item.name || item.item_name) === String(primaryId))) {
      setPrimaryId("");
    }
  }, [filteredPrimary, primaryId]);

  const secondaryOptions = (inventoryItems || []).filter((item) => {
    if ([primaryId, materialId, catalystAId, catalystBId, catalystCId].includes(item.id)) return false;
    const kind = normalizeItemType(item);
    if (selectedService?.id === "brew") return !["weapon", "armor", "shield"].includes(kind);
    if (selectedService?.id === "socket") return !["weapon", "armor", "shield"].includes(kind);
    return true;
  });

  const materialOptions = (inventoryItems || []).filter((item) => {
    if ([primaryId, secondaryId, catalystAId, catalystBId, catalystCId].includes(item.id)) return false;
    return looksLikeMaterialItem(item);
  });

  const catalystOptions = (inventoryItems || []).filter((item) => {
    if ([primaryId, secondaryId, materialId].includes(item.id)) return false;
    return looksLikeCatalystItem(item);
  });

  const primaryItem = primarySource.find((item) => String(item.id || item.item_id || item._id || item.name || item.item_name) === String(primaryId)) || null;
  const secondaryItem = (inventoryItems || []).find((item) => item.id === secondaryId) || null;
  const materialItem = (inventoryItems || []).find((item) => item.id === materialId) || null;
  const catalystA = (inventoryItems || []).find((item) => item.id === catalystAId) || null;
  const catalystB = (inventoryItems || []).find((item) => item.id === catalystBId) || null;
  const catalystC = (inventoryItems || []).find((item) => item.id === catalystCId) || null;

  const itemEnchantTier = selectedService?.id === "imbue" ? extractTierFromItem(primaryItem) : 0;
  const unlockedEnchantSlots = selectedService?.id === "imbue" ? getUnlockedEnchantSlots(itemEnchantTier) : [];
  const selectedEnchantA = magicVariants.find((variant) => variant.key === enchantAKey) || null;
  const selectedEnchantB = magicVariants.find((variant) => variant.key === enchantBKey) || null;
  const selectedEnchantC = magicVariants.find((variant) => variant.key === enchantCKey) || null;

  const enchantSlotSelections = [
    { slot: "A", variant: selectedEnchantA, option: enchantAOption },
    { slot: "B", variant: selectedEnchantB, option: enchantBOption },
    { slot: "C", variant: selectedEnchantC, option: enchantCOption },
  ].filter((entry) => unlockedEnchantSlots.includes(entry.slot) && entry.variant);

  const imbuePreview = useMemo(() => {
    return composeImbuePreview({ primaryItem, tier: itemEnchantTier, selectedVariants: enchantSlotSelections });
  }, [primaryItem, itemEnchantTier, selectedEnchantA, enchantAOption, selectedEnchantB, enchantBOption, selectedEnchantC, enchantCOption]);

  const selectedEnchantKeys = [enchantAKey, enchantBKey, enchantCKey].filter(Boolean);
  const enchantRequirementWarnings = selectedService?.id === "imbue" ? imbuePreview.warnings : [];

  function enchantChoicesForSlot(slot) {
    const currentKey = slot === "A" ? enchantAKey : slot === "B" ? enchantBKey : enchantCKey;
    return magicVariants.filter((variant) => {
      if (!magicVariantAppliesToItem(variant, primaryItem, itemEnchantTier)) return false;
      if (selectedEnchantKeys.includes(variant.key) && variant.key !== currentKey) return false;
      return true;
    });
  }

  function enchantOptionMissing(variant, option) {
    return !!(variant?.options?.length && !option);
  }

  const enchantInputMissing = selectedService?.id === "imbue" && (
    !enchantSlotSelections.length ||
    enchantSlotSelections.some((entry) => enchantOptionMissing(entry.variant, entry.option))
  );

  useEffect(() => {
    setPrimaryId("");
    setSecondaryId("");
    setMaterialId("");
    setCatalystAId("");
    setCatalystBId("");
    setCatalystCId("");
    setEnchantAKey("");
    setEnchantAOption("");
    setEnchantBKey("");
    setEnchantBOption("");
    setEnchantCKey("");
    setEnchantCOption("");
    setBonus(selectedService?.requiresTier ? "" : "0");
    setCraftState({ status: "idle", message: "" });
  }, [selectedService?.id]);

  useEffect(() => {
    if (!selectedService?.requiresSecondary && secondaryId) setSecondaryId("");
  }, [selectedService?.requiresSecondary, secondaryId]);

  useEffect(() => { setEnchantAOption(""); }, [enchantAKey]);
  useEffect(() => { setEnchantBOption(""); }, [enchantBKey]);
  useEffect(() => { setEnchantCOption(""); }, [enchantCKey]);

  useEffect(() => {
    if (selectedService?.id !== "imbue") return;
    setEnchantAKey("");
    setEnchantAOption("");
    setEnchantBKey("");
    setEnchantBOption("");
    setEnchantCKey("");
    setEnchantCOption("");
  }, [selectedService?.id, primaryId]);

  useEffect(() => {
    if (selectedService?.id !== "imbue") return;
    if (!unlockedEnchantSlots.includes("B") && enchantBKey) setEnchantBKey("");
    if (!unlockedEnchantSlots.includes("C") && enchantCKey) setEnchantCKey("");
  }, [selectedService?.id, unlockedEnchantSlots, enchantBKey, enchantCKey]);

  const previewText = selectedService?.id === "imbue"
    ? (
      primaryItem
        ? `${crafter?.name || "This enchanter"} can bind ${enchantSlotSelections.length || "no"} magical trait${enchantSlotSelections.length === 1 ? "" : "s"} into ${primaryItem.item_name || "the selected item"} at tier +${itemEnchantTier || "?"}. ${imbuePreview.entries.length ? imbuePreview.entries.join(" ") : "Choose at least one enchant slot to preview the runed result."}`
        : "Choose a smith-tiered item to preview arcane imbuement."
    )
    : buildPreviewText({
      service: selectedService,
      primaryItem,
      secondaryItem,
      materialItem,
      catalystA,
      catalystB,
      catalystC,
      bonus: Number(bonus) || 0,
      crafter,
    });

  const selectedTabLabel = availableTabs.find((tab) => tab.id === activeTab)?.label || "Items";
  const sourceLabel = selectedService?.id === "forge_mundane" ? "Catalog forge patterns" : "Owned inventory";
  const noPatternText = selectedService?.id === "forge_mundane"
    ? "No forge patterns found for this family. Check that public/items/all-items.json exists and contains mundane gear rows."
    : selectedService?.id === "imbue"
      ? "No smith-tiered +1, +2, or +3 inventory items match this family. Forge and reforge gear with a smith first."
      : "No owned inventory items match this family and service.";

  async function handleCraft() {
    if (!primaryId) {
      setCraftState({ status: "error", message: "Choose a base item first." });
      return;
    }
    if (selectedService?.requiresSecondary && !secondaryId) {
      setCraftState({ status: "error", message: "Choose the required secondary ingredient." });
      return;
    }
    if (selectedService?.requiresTier && !bonus) {
      setCraftState({ status: "error", message: "Choose a tier before crafting." });
      return;
    }
    if (selectedService?.id === "imbue") {
      if (itemEnchantTier < 1) {
        setCraftState({ status: "error", message: "Enchanters require an item already tiered by a smith (+1, +2, or +3)." });
        return;
      }
      if (!enchantSlotSelections.length) {
        setCraftState({ status: "error", message: "Choose at least one magical trait slot." });
        return;
      }
      if (enchantInputMissing) {
        setCraftState({ status: "error", message: "Choose the required option for each selected enchantment." });
        return;
      }
      if (enchantRequirementWarnings.length) {
        setCraftState({ status: "error", message: enchantRequirementWarnings[0] });
        return;
      }
    }
    if (typeof onCraftWorkshop !== "function") {
      setCraftState({ status: "error", message: "Crafting is not available on this page yet." });
      return;
    }

    setCraftState({ status: "saving", message: "Crafting item..." });
    try {
      await onCraftWorkshop({
        crafter,
        serviceId: selectedService?.id,
        primaryItemId: selectedService?.id === "forge_mundane" ? null : primaryId,
        forgeTemplate: selectedService?.id === "forge_mundane" && primaryItem ? {
          item_id: primaryItem.item_id || primaryItem.id || primaryItem._id || null,
          item_name: primaryItem.item_name || primaryItem.name || "Forged Item",
          item_type: primaryItem.item_type || normalizeItemType(primaryItem),
          item_rarity: primaryItem.item_rarity || primaryItem.rarity || "Mundane",
          item_description: primaryItem.item_description || "",
          item_weight: primaryItem.item_weight || primaryItem.weight || null,
          item_cost: primaryItem.item_cost || primaryItem.cost || primaryItem.value || null,
          card_payload: primaryItem.card_payload || primaryItem,
        } : null,
        secondaryItemId: selectedService?.requiresSecondary ? secondaryId || null : null,
        materialItemId: materialId || null,
        catalystAId: catalystAId || null,
        catalystBId: catalystBId || null,
        catalystCId: catalystCId || null,
        enchantTier: selectedService?.id === "imbue" ? itemEnchantTier : null,
        imbueDraft: selectedService?.id === "imbue" ? {
          name: imbuePreview.name,
          rarity: imbuePreview.rarity,
          entries: imbuePreview.entries,
          labels: imbuePreview.labels,
        } : null,
        magicVariants: selectedService?.id === "imbue" ? enchantSlotSelections.map((entry) => ({
          slot: entry.slot,
          key: entry.variant.key,
          name: entry.variant.name,
          option: entry.option || null,
          label: displayNameForMagicVariant(entry.variant, entry.option),
          text: textForMagicVariant(entry.variant, primaryItem, entry.option),
          rarity: rarityForMagicVariant(entry.variant, entry.option),
          appliesTo: entry.variant.appliesTo,
          attunement: !!entry.variant.attunement,
          cursed: !!entry.variant.cursed,
        })) : [],
        bonus: selectedService?.id === "imbue" ? itemEnchantTier : Number(bonus) || 0,
      });
      setCraftState({ status: "success", message: "Craft completed and added to your inventory." });
    } catch (err) {
      setCraftState({ status: "error", message: err?.message || "Crafting failed." });
    }
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={cls(styles.crafterModal, styles.crafterModalBuilder)} onClick={(e) => e.stopPropagation()}>
        <div className={styles.crafterModalHead}>
          <div>
            <div className={styles.eyebrow}>Workshop</div>
            <div className={styles.crafterModalTitle}>{crafter?.name || "Crafter"}</div>
            <div className={styles.muted}>{(crafterTypes || []).map(humanizeCraftType).join(" • ")}</div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
        </div>

        <section className={cls(styles.drawerItem, styles.builderPanel, toneKey("emerald"))}>
          <div className={styles.builderPanelHeader}>
            <div>
              <div className={styles.drawerItemTitle}>Choose a workshop service</div>
              <div className={styles.drawerItemText}>
                {selectedService?.id === "imbue"
                  ? "Enchanters add magical A/B/C traits to gear already tiered by a smith."
                  : "Smith work stays physical: forge, reforge, materials, tier, and monster-bit catalysts only."}
              </div>
            </div>
            <span className={styles.marketBadge}>{sourceLabel}</span>
          </div>
          <div className={styles.serviceGrid}>
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                className={cls(styles.serviceCard, service.id === selectedService?.id && styles.serviceCardActive)}
                onClick={() => setServiceId(service.id)}
              >
                <div className={styles.drawerItemTitle}>{service.title}</div>
                <div className={styles.muted}>{service.subtitle}</div>
                <div className={styles.drawerItemText}>{service.description}</div>
              </button>
            ))}
          </div>
        </section>

        <div className={styles.builderToolbar}>
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cls(styles.builderPill, activeTab === tab.id && styles.builderPillActive)}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <span className={styles.builderPillCount}>{tabCounts[tab.id] || 0}</span>
            </button>
          ))}
        </div>

        <div className={styles.builderPanelGrid}>
          <section className={cls(styles.drawerItem, styles.builderPanel, toneKey("cyan"))}>
            <div className={styles.builderPanelHeader}>
              <div>
                <div className={styles.builderSectionTitle}>Build inputs</div>
                <div className={styles.drawerItemText}>{selectedTabLabel} • {sourceLabel}</div>
              </div>
              {selectedService?.id === "forge_mundane" && catalogState.status === "loading" ? <span className={styles.marketBadge}>Loading catalog</span> : null}
            </div>

            <div className={styles.builderFieldGrid}>
              <label className={styles.formField}>
                <span>{selectedService?.baseLabel || "Base item"}</span>
                <select className="form-select form-select-sm" value={primaryId} onChange={(e) => setPrimaryId(e.target.value)}>
                  <option value="">{selectedService?.basePlaceholder || "Choose the main item"}</option>
                  {filteredPrimary.map((item) => (
                    <option key={item.id || item.item_id} value={item.id || item.item_id}>
                      {item.item_name || item.name} {item.item_rarity || item.rarity ? `(${item.item_rarity || item.rarity})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.formField}>
                <span>Material item</span>
                <select className="form-select form-select-sm" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                  <option value="">Optional / none</option>
                  {materialOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.item_name}</option>
                  ))}
                </select>
              </label>

              {selectedService?.requiresSecondary ? (
                <label className={styles.formField}>
                  <span>{selectedService?.secondaryLabel || "Secondary ingredient"}</span>
                  <select className="form-select form-select-sm" value={secondaryId} onChange={(e) => setSecondaryId(e.target.value)}>
                    <option value="">{selectedService?.secondaryPlaceholder || "Choose the supporting ingredient"}</option>
                    {secondaryOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.item_name} {item.item_rarity ? `(${item.item_rarity})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {selectedService?.requiresTier ? (
                <label className={styles.formField}>
                  <span>{selectedService?.tierLabel || "Tier"}</span>
                  <select className="form-select form-select-sm" value={bonus} onChange={(e) => setBonus(e.target.value)}>
                    <option value="">Choose a tier</option>
                    <option value="1">Tier I / +1</option>
                    <option value="2">Tier II / +2</option>
                    <option value="3">Tier III / +3</option>
                  </select>
                </label>
              ) : null}

              {selectedService?.id === "imbue" ? (
                <div className={cls(styles.formField, styles.builderWideField)}>
                  <span>Existing smith tier</span>
                  <div className={styles.enchantTierBadge}>
                    {primaryItem
                      ? itemEnchantTier > 0
                        ? `Tier +${itemEnchantTier} unlocks slot${unlockedEnchantSlots.length === 1 ? "" : "s"} ${unlockedEnchantSlots.join(" / ")}`
                        : "This item is not smith-tiered yet."
                      : "Choose a +1, +2, or +3 item."}
                  </div>
                </div>
              ) : null}

              {selectedService?.id === "imbue" ? (
                <div className={styles.enchantSlotGrid}>
                  {[
                    { slot: "A", keyValue: enchantAKey, optionValue: enchantAOption, setKey: setEnchantAKey, setOption: setEnchantAOption, selected: selectedEnchantA },
                    { slot: "B", keyValue: enchantBKey, optionValue: enchantBOption, setKey: setEnchantBKey, setOption: setEnchantBOption, selected: selectedEnchantB },
                    { slot: "C", keyValue: enchantCKey, optionValue: enchantCOption, setKey: setEnchantCKey, setOption: setEnchantCOption, selected: selectedEnchantC },
                  ].map((slotDef) => {
                    const locked = !unlockedEnchantSlots.includes(slotDef.slot);
                    const choices = enchantChoicesForSlot(slotDef.slot);
                    const optionMeta = variantOptionMeta(slotDef.selected);
                    return (
                      <div key={slotDef.slot} className={cls(styles.enchantSlotCard, locked && styles.enchantSlotLocked)}>
                        <div className={styles.enchantSlotHead}>
                          <span>Slot {slotDef.slot}</span>
                          <small>{locked ? "Locked" : `${choices.length} traits`}</small>
                        </div>
                        <select
                          className="form-select form-select-sm"
                          value={slotDef.keyValue}
                          disabled={locked || !primaryItem || !itemEnchantTier}
                          onChange={(e) => slotDef.setKey(e.target.value)}
                        >
                          <option value="">{locked ? "Requires higher tier" : "Choose magical trait"}</option>
                          {choices.map((variant) => (
                            <option key={`${slotDef.slot}-${variant.key}`} value={variant.key}>
                              {variant.name}{variant.rarity ? ` (${variant.rarity})` : ""}
                            </option>
                          ))}
                        </select>
                        {slotDef.selected?.options?.length ? (
                          <select
                            className="form-select form-select-sm mt-2"
                            value={slotDef.optionValue}
                            disabled={locked}
                            onChange={(e) => slotDef.setOption(e.target.value)}
                          >
                            <option value="">{optionMeta?.label || "Choose option"}</option>
                            {slotDef.selected.options.map((option) => (
                              <option key={`${slotDef.slot}-${slotDef.selected.key}-${option}`} value={option}>
                                {optionMeta?.namePart ? optionMeta.namePart(option) : titleCaseText(option)}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <label className={styles.formField}>
                <span>{selectedService?.id === "imbue" ? "Optional catalyst A" : "Physical catalyst A"}</span>
                <select className="form-select form-select-sm" value={catalystAId} onChange={(e) => setCatalystAId(e.target.value)}>
                  <option value="">Optional / none</option>
                  {catalystOptions.filter((item) => ![catalystBId, catalystCId].includes(item.id)).map((item) => (
                    <option key={item.id} value={item.id}>{item.item_name}</option>
                  ))}
                </select>
              </label>

              <label className={styles.formField}>
                <span>{selectedService?.id === "imbue" ? "Optional catalyst B" : "Physical catalyst B"}</span>
                <select className="form-select form-select-sm" value={catalystBId} onChange={(e) => setCatalystBId(e.target.value)}>
                  <option value="">Optional / none</option>
                  {catalystOptions.filter((item) => ![catalystAId, catalystCId].includes(item.id)).map((item) => (
                    <option key={item.id} value={item.id}>{item.item_name}</option>
                  ))}
                </select>
              </label>

              <label className={styles.formField}>
                <span>{selectedService?.id === "imbue" ? "Optional catalyst C" : "Physical catalyst C"}</span>
                <select className="form-select form-select-sm" value={catalystCId} onChange={(e) => setCatalystCId(e.target.value)}>
                  <option value="">Optional / none</option>
                  {catalystOptions.filter((item) => ![catalystAId, catalystBId].includes(item.id)).map((item) => (
                    <option key={item.id} value={item.id}>{item.item_name}</option>
                  ))}
                </select>
              </label>
            </div>

            {!filteredPrimary.length ? (
              <div className={styles.emptyPatternCard}>{noPatternText}</div>
            ) : null}

            {selectedService?.id === "forge_mundane" && catalogState.status === "error" ? (
              <div className={cls(styles.statusBanner, styles.statusError)}>{catalogState.message}</div>
            ) : null}

            <div className={styles.builderHelpText}>
              {selectedService?.id === "imbue"
                ? "Arcane Imbuement consumes the selected tiered item and writes a new enchanted version. +N/tier stays a smith responsibility; enchant slots are separate magical riders."
                : "Forge Mundane chooses a catalog pattern and does not consume a base inventory item. Reforge chooses an owned item and keeps the tested inventory upgrade path intact."}
            </div>

            {craftState?.message ? (
              <div className={cls(
                styles.statusBanner,
                craftState?.status === "error" && styles.statusError,
                craftState?.status === "success" && styles.statusSuccess,
                craftState?.status === "saving" && styles.statusInfo
              )}>
                {craftState.message}
              </div>
            ) : null}
          </section>

          <section className={cls(styles.drawerItem, styles.builderPreview, toneKey("violet"))}>
            <div className={styles.builderPreviewHead}>
              <div>
                <div className={styles.eyebrow}>{selectedService?.resultLabel || "Workshop preview"}</div>
                <div className={styles.builderPreviewTitle}>{selectedService?.id === "imbue" ? imbuePreview.name : (primaryItem?.item_name || primaryItem?.name || "Choose an item")}</div>
              </div>
              {primaryItem ? <span className={styles.marketBadge}>{normalizeItemType(primaryItem)}</span> : null}
            </div>

            <div className={styles.builderPreviewBody}>{previewText}</div>

            {selectedService?.id === "imbue" && imbuePreview.entries.length ? (
              <div className={styles.enchantEntryList}>
                {imbuePreview.entries.map((entry, idx) => (
                  <div key={`entry-${idx}`}>{entry}</div>
                ))}
              </div>
            ) : null}

            {selectedService?.id === "imbue" && enchantRequirementWarnings.length ? (
              <div className={cls(styles.statusBanner, styles.statusError)}>{enchantRequirementWarnings[0]}</div>
            ) : null}

            {selectedService?.id === "imbue" && magicVariantState.status === "error" ? (
              <div className={cls(styles.statusBanner, styles.statusError)}>{magicVariantState.message}</div>
            ) : null}

            <div className={styles.builderMetaGrid}>
              <span>{sourceLabel}</span>
              {activeTab ? <span>{selectedTabLabel}</span> : null}
              {selectedService?.requiresTier && bonus ? <span>Tier +{bonus}</span> : null}
              {selectedService?.id === "imbue" && itemEnchantTier ? <span>Smith tier +{itemEnchantTier}</span> : null}
              {selectedService?.id === "imbue" && imbuePreview.rarity ? <span>{imbuePreview.rarity}</span> : null}
              {selectedService?.id === "imbue" && imbuePreview.labels?.length ? <span>{imbuePreview.labels.join(" • ")}</span> : null}
              {materialItem ? <span>{materialItem.item_name}</span> : null}
              {selectedService?.requiresSecondary && secondaryItem ? <span>{secondaryItem.item_name}</span> : null}
              {catalystA ? <span>{catalystA.item_name}</span> : null}
              {catalystB ? <span>{catalystB.item_name}</span> : null}
              {catalystC ? <span>{catalystC.item_name}</span> : null}
            </div>

            <div className={styles.workshopActionRow}>
              <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn btn-sm btn-success"
                disabled={!primaryId || craftState?.status === "saving" || (selectedService?.requiresSecondary && !secondaryId) || (selectedService?.requiresTier && !bonus) || (selectedService?.id === "imbue" && (!itemEnchantTier || enchantInputMissing || enchantRequirementWarnings.length > 0))}
                onClick={handleCraft}
              >
                {craftState?.status === "saving" ? "Crafting..." : selectedService?.id === "imbue" ? "Imbue Item" : "Craft Item"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function CrafterRow({ crafter, onOpenWorkshop }) {
  const types = inferCrafterTypes(crafter);
  const profileHref = crafter?.id ? `/npcs#${crafter.id}` : null;
  return (
    <div className={cls(styles.drawerItem, styles.marketCard, toneKey("emerald"))}>
      <div className={styles.marketCardHead}>
        <div>
          <div className={styles.drawerItemTitle}>{crafter?.name || "Unknown Crafter"}</div>
          <div className={styles.drawerItemText}>{crafter?.role || crafter?.affiliation || crafter?.storefront_title || "Town crafter"}</div>
        </div>
        <div className={styles.marketBadgeRow}>
          {types.map((type) => <span key={type} className={styles.marketBadge}>{humanizeCraftType(type)}</span>)}
        </div>
      </div>
      <div className={styles.marketActionRow}>
        {profileHref ? <a className="btn btn-sm btn-outline-light" href={profileHref}>Open Profile</a> : null}
        {types.length ? <button type="button" className="btn btn-sm btn-success" onClick={() => onOpenWorkshop(crafter)}>Open Workshop</button> : null}
      </div>
    </div>
  );
}

function CrafterDrawer({ crafters, townName, inventoryItems, onOpenWorkshop }) {
  const rows = Array.isArray(crafters) ? crafters : [];
  return (
    <div className={styles.drawerItems}>
      <div className={cls(styles.drawerItem, toneKey("emerald"))}>
        <div className={styles.drawerItemTitle}>Crafters' Quarter of {townName || "Town"}</div>
        <div className={styles.drawerItemText}>Blacksmiths, alchemists, enchanters, scribes, and jewelers with clear workshop roles are surfaced here. Generic townsfolk no longer open the crafting workflow by default.</div>
      </div>
      <div className={styles.marketSection}>
        <div className={styles.marketSectionTitle}>Available crafters</div>
        {rows.length ? rows.map((crafter) => <CrafterRow key={crafter.id} crafter={crafter} onOpenWorkshop={onOpenWorkshop} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No obvious crafters are surfaced for this town yet.</div></div>}
      </div>
      <div className={cls(styles.drawerItem, toneKey("stone"))}>
        <div className={styles.drawerItemTitle}>Player inventory hook</div>
        <div className={styles.drawerItemText}>{inventoryItems?.length ? `Loaded ${inventoryItems.length} inventory item${inventoryItems.length === 1 ? "" : "s"} for workshop previews.` : "No player inventory items are currently available for workshop previews."}</div>
      </div>
    </div>
  );
}

function AdminDrawer({ dirty, editMode, setEditMode, labels, selectedItem, onSelect, onChangeSelected, onDeleteSelected, onBeginDiscoveryPlacement, onSave, mapToolsOpen, setMapToolsOpen, storedMapImage, fallbackMapImage, onSelectMap, onApplyMap, onClearPendingMap, onDeleteMap, imageMeta, pendingMapFileName, mapApplyState, mapFileInputKey, labelSaveState }) {
  return (
    <div className={styles.adminStack}>
      <section className={styles.adminCard}>
        <div className={styles.adminCardHead}>
          <div>
            <div className={styles.adminCardTitle}>City layout map editor</div>
            <div className={styles.muted}>Map labels and discoveries live in the shared drawer when admin tools are on.</div>
          </div>
          <button type="button" className={cls(styles.toggle, editMode && styles.toggleOn)} onClick={() => setEditMode((v) => !v)} aria-pressed={editMode} title="Toggle edit mode"><span className={styles.toggleKnob} /></button>
        </div>

        <div className={styles.adminActions}>
          <button type="button" className="btn btn-sm btn-outline-warning" onClick={onBeginDiscoveryPlacement}>Add Discovery</button>
          <button type="button" className="btn btn-sm btn-warning" onClick={onSave} disabled={!dirty || labelSaveState?.status === "saving"}>{labelSaveState?.status === "saving" ? "Saving..." : "Save Changes"}</button>
        </div>

        {labelSaveState?.message ? (
          <div className={cls(styles.statusBanner, labelSaveState?.status === "error" && styles.statusError, labelSaveState?.status === "success" && styles.statusSuccess, labelSaveState?.status === "saving" && styles.statusInfo)}>{labelSaveState.message}</div>
        ) : null}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Name</th><th>X</th><th>Y</th><th>Tone</th><th>Type</th></tr></thead>
            <tbody>
              {labels.map((item) => (
                <tr key={item.id} className={selectedItem?.id === item.id ? styles.selectedRow : ""} onClick={() => onSelect(item.id)}>
                  <td>{item.name}</td><td>{Math.round(item.x)}</td><td>{Math.round(item.y)}</td><td>{item.tone}</td><td>{item.labelType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedItem ? (
          <div className={styles.formGrid}>
            <label className={styles.formField}><span>Name</span><input className="form-control form-control-sm" value={selectedItem.name || ""} onChange={(e) => onChangeSelected({ name: e.target.value })} /></label>
            <label className={styles.formField}><span>Tone</span><select className="form-select form-select-sm" value={selectedItem.tone || "stone"} onChange={(e) => onChangeSelected({ tone: e.target.value })}><option value="stone">Stone</option><option value="amber">Amber</option><option value="rose">Rose</option><option value="emerald">Emerald</option><option value="violet">Violet</option><option value="cyan">Cyan</option></select></label>
            <label className={styles.formField}><span>Type</span><select className="form-select form-select-sm" value={selectedItem.labelType || "location"} onChange={(e) => onChangeSelected({ labelType: e.target.value })}><option value="location">Location</option><option value="discovery">Discovery</option></select></label>
            <label className={styles.formField}><span>Drawer target</span><select className="form-select form-select-sm" value={selectedItem.targetPanel || ""} onChange={(e) => onChangeSelected({ targetPanel: e.target.value || null })}><option value="">None</option><option value="stories">City stories</option><option value="people">Featured people</option><option value="jobs">Jobs & quest leads</option><option value="rumors">Tavern rumors</option><option value="market">Bazaar / market</option><option value="crafters">Crafters' quarter</option></select></label>
            <label className={cls(styles.formField, styles.formFieldWide)}><span>Notes</span><input className="form-control form-control-sm" value={selectedItem.notes || ""} onChange={(e) => onChangeSelected({ notes: e.target.value })} /></label>
            <div className={cls(styles.coordText, styles.formFieldWide)}>X {selectedItem.x.toFixed(1)} • Y {selectedItem.y.toFixed(1)}</div>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDeleteSelected}>Delete Label</button>
          </div>
        ) : null}
      </section>

      <section className={styles.adminCard}>
        <div className={styles.adminCardHead}>
          <div><div className={styles.adminCardTitle}>Map tools</div><div className={styles.muted}>Replace or clear the town image without leaving the drawer.</div></div>
          <button type="button" className={cls(styles.toggle, mapToolsOpen && styles.toggleOn)} onClick={() => setMapToolsOpen((v) => !v)} aria-pressed={mapToolsOpen} title="Toggle map tools"><span className={styles.toggleKnob} /></button>
        </div>
        {mapToolsOpen ? (
          <div className={styles.mapTools}>
            <div className={styles.mapActionRow}><button type="button" className="btn btn-sm btn-outline-danger" onClick={onDeleteMap} disabled={mapApplyState?.status === "uploading" || mapApplyState?.status === "deleting"}>{mapApplyState?.status === "deleting" ? "Deleting..." : "Delete Map"}</button><button type="button" className="btn btn-sm btn-success" onClick={onApplyMap} disabled={!pendingMapFileName || mapApplyState?.status === "uploading" || mapApplyState?.status === "deleting"}>{mapApplyState?.status === "uploading" ? "Applying..." : "Apply Map"}</button></div>
            <label className={styles.uploadBox}><span>Choose a new map image, then click Apply Map.</span><input key={mapFileInputKey} type="file" accept="image/png,image/jpeg,image/webp" onChange={onSelectMap} /></label>
            {pendingMapFileName ? <div className={styles.pendingFileRow}><div className={styles.metaText}>Pending file: <strong>{pendingMapFileName}</strong></div><button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClearPendingMap} disabled={mapApplyState?.status === "uploading" || mapApplyState?.status === "deleting"}>Clear Selection</button></div> : null}
            {mapApplyState?.message ? <div className={cls(styles.statusBanner, mapApplyState?.status === "error" && styles.statusError, mapApplyState?.status === "success" && styles.statusSuccess, (mapApplyState?.status === "uploading" || mapApplyState?.status === "deleting" || mapApplyState?.status === "selected") && styles.statusInfo)}>{mapApplyState.message}</div> : null}
            <div className={styles.metaText}>{storedMapImage ? <><div><strong>Active source:</strong> uploaded town map stored in Supabase.</div><div>Natural size: {imageMeta?.width || "?"} × {imageMeta?.height || "?"}</div></> : fallbackMapImage ? <><div><strong>Active source:</strong> built-in fallback map from town data.</div><div>No uploaded map is stored for this town yet.</div></> : <div>No stored or fallback map is available for this town yet.</div>}</div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SharedDrawer({ panel, openPanel, setOpenPanel, adminToolsVisible, adminDrawerProps, marketData, townName, crafterData, playerInventory, onOpenWorkshop }) {
  const title = adminToolsVisible ? "City layout map editor" : panel.drawerTitle;
  const subtitle = adminToolsVisible ? "Editing controls live here so the map and drawer remain two clean equal-height panes." : panel.drawerSubtitle;
  return (
    <div className={cls(styles.drawerPane, adminToolsVisible && styles.drawerPaneAdmin)}>
      <div className={styles.drawerHead}>
        <div><div className={styles.eyebrow}>Shared drawer</div><div className={styles.drawerTitle}>{title}</div><div className={styles.muted}>{subtitle}</div></div>
        <div className={styles.drawerMeta}>{adminToolsVisible ? "admin tools" : "one open at a time"}</div>
      </div>
      {!adminToolsVisible ? <DrawerTabs openPanel={openPanel} setOpenPanel={setOpenPanel} /> : null}
      <div className={styles.drawerScroll}>
        {adminToolsVisible ? (
          <AdminDrawer {...adminDrawerProps} />
        ) : openPanel === "market" ? (
          <MarketDrawer marketData={marketData} townName={townName} />
        ) : openPanel === "crafters" ? (
          <CrafterDrawer crafters={crafterData} townName={townName} inventoryItems={playerInventory} onOpenWorkshop={onOpenWorkshop} />
        ) : (
          <SharedDrawerContent panel={panel} />
        )}
      </div>
    </div>
  );
}

function MapLabel({ item, selected, onPointerDown, onClick }) {
  return (
    <button type="button" className={cls(styles.mapLabel, toneKey(item.tone), selected && styles.mapLabelSelected)} style={{ left: `${item.x}%`, top: `${item.y}%` }} onPointerDown={onPointerDown} onClick={onClick} title={item.notes || item.name}>
      {item.labelType === "discovery" ? <span className={styles.mapLabelFlag}>⚑</span> : null}
      <span>{item.name}</span>
    </button>
  );
}

function TownMapPanel({ mapImage, imageNaturalSize, labels, isAdmin, editMode, placingDiscovery, selectedId, setSelectedId, onMoveItem, onAddDiscovery, onOpenPanel, adminToolsVisible, setAdminToolsVisible, mapSourceLabel }) {
  const surfaceRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    function handleMove(e) {
      if (!dragRef.current || !surfaceRef.current) return;
      const rect = surfaceRef.current.getBoundingClientRect();
      const clientX = e.touches?.[0]?.clientX ?? e.clientX;
      const clientY = e.touches?.[0]?.clientY ?? e.clientY;
      const x = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(2, Math.min(98, ((clientY - rect.top) / rect.height) * 100));
      onMoveItem(dragRef.current.id, { x, y });
    }
    function handleUp() { dragRef.current = null; }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [onMoveItem]);

  function beginDrag(item, e) {
    if (!(isAdmin && editMode)) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { id: item.id };
    setSelectedId(item.id);
  }

  function handleMapClick(e) {
    if (!(isAdmin && placingDiscovery) || !surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100));
    onAddDiscovery({ x, y });
  }

  const backgroundStyle = mapImage ? { backgroundImage: `linear-gradient(180deg, rgba(9,11,16,0.14), rgba(9,11,16,0.28)), url(${mapImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined;

  return (
    <div className={styles.mapPane}>
      <div className={styles.mapHead}>
        <div><div className={styles.eyebrow}>Interactive city layout</div><div className={styles.muted}>Map-first overview with clickable labels and discoveries.</div></div>
        {isAdmin ? <button type="button" className={cls(styles.adminToggle, adminToolsVisible && styles.adminToggleOn)} onClick={() => setAdminToolsVisible((v) => !v)} aria-pressed={adminToolsVisible}><span className={styles.adminToggleLabel}>Show Admin Tools</span><span className={cls(styles.toggle, adminToolsVisible && styles.toggleOn)}><span className={styles.toggleKnob} /></span></button> : null}
      </div>
      <div className={styles.mapBody}>
        <div key={mapImage || "no-town-map"} ref={surfaceRef} className={cls(styles.mapSurface, mapImage && styles.mapSurfaceHasImage, placingDiscovery && styles.mapSurfacePlacing)} style={backgroundStyle} onClick={handleMapClick}>
          {!mapImage ? <div className={styles.emptyText}>No stored town map yet. Upload one from map tools.</div> : null}
          {labels.filter((item) => item.isVisible !== false).map((item) => (
            <MapLabel
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onPointerDown={(e) => beginDrag(item, e)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedId(item.id);
                if (item.labelType === "location" && item.targetPanel) onOpenPanel(item.targetPanel);
              }}
            />
          ))}
        </div>
        <div className={styles.metaStack}>
          {(mapSourceLabel || (imageNaturalSize?.width && imageNaturalSize?.height)) ? <div className={styles.metaText}>{mapSourceLabel || ""}{mapSourceLabel && imageNaturalSize?.width && imageNaturalSize?.height ? " • " : ""}{imageNaturalSize?.width && imageNaturalSize?.height ? `Stored size: ${imageNaturalSize.width} × ${imageNaturalSize.height}` : ""}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function TownSheet({
  location,
  rosterChars,
  quests,
  backHref,
  isAdmin = false,
  storedLabels = [],
  onSaveMapData,
  mapImageUrl,
  imageNaturalSize,
  onSelectMapImage,
  onApplyMapImage,
  onClearPendingMap,
  onDeleteMapImage,
  pendingMapFileName = "",
  mapApplyState = { status: "idle", message: "" },
  labelSaveState = { status: "idle", message: "" },
  mapFileInputKey = 0,
  marketData = { presentMerchants: [], residentMerchants: [] },
  playerInventory = [],
  onCraftWorkshop,
}) {
  const townData = useMemo(() => buildTownData(location, rosterChars, quests), [location, rosterChars, quests]);
  const [openPanel, setOpenPanel] = useState("people");
  const [labels, setLabels] = useState(() => {
    const src = storedLabels?.length ? storedLabels : townData.mapLabels || [];
    return src.map((item) => normalizeOverlayItem(item, item?.labelType || item?.label_type || "location"));
  });
  const [selectedId, setSelectedId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [adminToolsVisible, setAdminToolsVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [placingDiscovery, setPlacingDiscovery] = useState(false);
  const [mapToolsOpen, setMapToolsOpen] = useState(true);
  const [activeWorkshopCrafter, setActiveWorkshopCrafter] = useState(null);
  const prevStoredKey = useMemo(() => JSON.stringify(storedLabels || []), [storedLabels]);

  useEffect(() => {
    const src = storedLabels?.length ? storedLabels : townData.mapLabels || [];
    setLabels(src.map((item) => normalizeOverlayItem(item, item?.labelType || item?.label_type || "location")));
    setDirty(false);
  }, [prevStoredKey, townData.mapLabels]);

  const stats = [
    ["Population", townData.stats.population, "amber"],
    ["Morale", townData.stats.morale, "rose"],
    ["Defenses", townData.stats.defenses, "emerald"],
    ["Mood", townData.stats.mood, "violet"],
    ["Ruler", townData.stats.ruler, "cyan"],
    ["Known for", townData.stats.knownFor, "stone"],
  ];

  const crafterData = useMemo(() => {
    const byId = new Map();
    const seed = [];
    if (Array.isArray(rosterChars)) seed.push(...rosterChars.filter((row) => row?.kind === "npc" || row?.kind === "merchant"));
    if (Array.isArray(marketData?.presentMerchants)) seed.push(...marketData.presentMerchants);
    if (Array.isArray(marketData?.residentMerchants)) seed.push(...marketData.residentMerchants);
    for (const row of seed) {
      if (!row?.id) continue;
      const types = inferCrafterTypes(row);
      if (!types.length) continue;
      if (!["blacksmith", "alchemist", "enchanter", "scribe", "jeweler"].some((type) => types.includes(type))) continue;
      byId.set(row.id, { ...row, crafterTypes: types });
    }
    return Array.from(byId.values()).sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
  }, [rosterChars, marketData]);

  const panels = {
    stories: { tone: "amber", drawerTitle: "City stories", drawerSubtitle: "Rotating city stories that shift every in-game 24 hours.", teaserTitle: "City stories", teaserSubtitle: "Rotating top city story; opens into the broader story feed", items: townData.cityStories },
    people: { tone: "cyan", drawerTitle: "Featured people", drawerSubtitle: "Surfaced NPCs and notable figures players should recognize.", teaserTitle: "Featured people", teaserSubtitle: "Rotating spotlight NPC; opens into the surfaced list", items: townData.people },
    jobs: { tone: "emerald", drawerTitle: "Jobs & quest leads", drawerSubtitle: "Rotating job board with expandable quest hooks.", teaserTitle: "Jobs & quest leads", teaserSubtitle: "Rotating top job; opens into the quest board", items: townData.jobLeads },
    rumors: { tone: "rose", drawerTitle: "Tavern rumors", drawerSubtitle: "Rotating top rumor; opens into the tavern feed.", teaserTitle: "Tavern rumors", teaserSubtitle: "Rotating top rumor; opens into the tavern feed", items: townData.rumors },
    market: { tone: "amber", drawerTitle: "Bazaar / market", drawerSubtitle: "Merchants currently in town and those who live here.", teaserTitle: "Bazaar / market", teaserSubtitle: "Resident and visiting merchants surfaced from town data", items: [] },
    crafters: { tone: "emerald", drawerTitle: "Crafters' quarter", drawerSubtitle: "Town artisans, alchemists, smiths, and enchanters.", teaserTitle: "Crafters' quarter", teaserSubtitle: "Open a workshop modal and preview crafted results", items: [] },
  };

  const activePanel = panels[openPanel] || panels.people;
  const effectiveMapImage = mapImageUrl || townData.mapImage || null;
  const mapSourceLabel = mapImageUrl ? "Showing uploaded town map from storage." : townData.mapImage ? "Showing built-in fallback map for this town." : "No town map is currently available.";
  const featured = { stories: townData.cityStories?.[0], people: townData.people?.[0], jobs: townData.jobLeads?.[0], rumors: townData.rumors?.[0] };
  const selectedItem = labels.find((item) => item.id === selectedId) || null;

  function updateItem(id, patch) {
    setLabels((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setDirty(true);
  }
  function handleChangeSelected(patch) { if (!selectedItem) return; updateItem(selectedItem.id, patch); }
  function handleDeleteSelected() { if (!selectedItem) return; setLabels((prev) => prev.filter((item) => item.id !== selectedItem.id)); setSelectedId(null); setDirty(true); }
  function handleAddDiscovery(pos) {
    const next = normalizeOverlayItem({ id: uid("discovery"), key: uid("discovery-key"), name: "New Discovery", x: pos.x, y: pos.y, tone: "amber", labelType: "discovery", notes: "" }, "discovery");
    setLabels((prev) => [...prev, next]);
    setSelectedId(next.id);
    setDirty(true);
    setPlacingDiscovery(false);
    setEditMode(true);
    setAdminToolsVisible(true);
  }
  async function handleSave() { if (typeof onSaveMapData !== "function") return; await onSaveMapData({ labels }); setDirty(false); }

  const adminDrawerProps = { dirty, editMode, setEditMode, labels, selectedItem, onSelect: setSelectedId, onChangeSelected: handleChangeSelected, onDeleteSelected: handleDeleteSelected, onBeginDiscoveryPlacement: () => setPlacingDiscovery((v) => !v), onSave: handleSave, mapToolsOpen, setMapToolsOpen, storedMapImage: mapImageUrl, fallbackMapImage: townData.mapImage || null, onSelectMap: onSelectMapImage, onApplyMap: onApplyMapImage, onClearPendingMap, onDeleteMap: onDeleteMapImage, imageMeta: imageNaturalSize, pendingMapFileName, mapApplyState, mapFileInputKey, labelSaveState };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}><Link href={backHref || "/map"} className="btn btn-sm btn-outline-light">Back to Map</Link><div><div className={styles.eyebrow}>Town sheet</div><h1 className={styles.pageTitle}>{location?.name || "Town"}</h1></div></div>
      <section className={styles.summaryBanner}><div className={styles.eyebrow}>City summary</div><h2 className={styles.summaryHeadline}>Overview can orient the player visually before it asks them to read</h2><p className={styles.summaryBody}>{townData.summary}</p><div className={styles.summaryStats}>{stats.map(([label, value, tone]) => <BannerStat key={label} label={label} value={value} tone={tone} />)}</div></section>
      <section className={styles.topPaneRow}><SharedDrawer panel={activePanel} openPanel={openPanel} setOpenPanel={setOpenPanel} adminToolsVisible={adminToolsVisible} adminDrawerProps={adminDrawerProps} marketData={marketData} townName={location?.name} crafterData={crafterData} playerInventory={playerInventory} onOpenWorkshop={setActiveWorkshopCrafter} /><TownMapPanel mapImage={effectiveMapImage} imageNaturalSize={imageNaturalSize} labels={labels} isAdmin={isAdmin} editMode={editMode} placingDiscovery={placingDiscovery} selectedId={selectedId} setSelectedId={setSelectedId} onMoveItem={(id, patch) => updateItem(id, patch)} onAddDiscovery={handleAddDiscovery} onOpenPanel={setOpenPanel} adminToolsVisible={adminToolsVisible} setAdminToolsVisible={setAdminToolsVisible} mapSourceLabel={mapSourceLabel} /></section>
      <section className={styles.teaserGrid}><CompactTeaser kicker="City stories" title={panels.stories.teaserTitle} subtitle={panels.stories.teaserSubtitle} featured={featured.stories} tone={panels.stories.tone} active={openPanel === "stories" && !adminToolsVisible} onOpen={() => { setAdminToolsVisible(false); setOpenPanel("stories"); }} /><CompactTeaser kicker="Featured people" title={panels.people.teaserTitle} subtitle={panels.people.teaserSubtitle} featured={featured.people} tone={panels.people.tone} active={openPanel === "people" && !adminToolsVisible} onOpen={() => { setAdminToolsVisible(false); setOpenPanel("people"); }} /><CompactTeaser kicker="Jobs & quest leads" title={panels.jobs.teaserTitle} subtitle={panels.jobs.teaserSubtitle} featured={featured.jobs} tone={panels.jobs.tone} active={openPanel === "jobs" && !adminToolsVisible} onOpen={() => { setAdminToolsVisible(false); setOpenPanel("jobs"); }} /><CompactTeaser kicker="Tavern rumors" title={panels.rumors.teaserTitle} subtitle={panels.rumors.teaserSubtitle} featured={featured.rumors} tone={panels.rumors.tone} active={openPanel === "rumors" && !adminToolsVisible} onOpen={() => { setAdminToolsVisible(false); setOpenPanel("rumors"); }} /></section>
      {activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}
    </div>
  );
}

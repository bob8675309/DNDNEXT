//    components/ItemCard.js
import React, { useEffect, useState } from "react";
import { classifyUi, titleCase } from "../utils/itemsIndex";
import { resolveItemVisual } from "../utils/itemVisuals";
import { loadFlavorIndex } from "../utils/flavorIndex";

/* ---------- helpers ---------- */
const humanRarity = (r) =>
  (String(r || "").toLowerCase() === "none" ? "Mundane" : titleCase(r || "Common"));

function unitToGp(unit) {
  switch ((unit || "").toLowerCase()) {
    case "pp": return 10;
    case "gp": return 1;
    case "sp": return 0.1;
    case "cp": return 0.01;
    default: return 1;
  }
}
function parseValueToGp(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // 5etools-style mundane item rows often store numeric cost in copper pieces.
    // Crafted/admin custom rows that already pass item_cost/value as text/object
    // still use the unit-aware branches below.
    return v >= 100 ? v / 100 : v;
  }
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d+(?:\.\d+)?)\s*(cp|sp|ep|gp|pp)?$/i);
    if (m) return parseFloat(m[1]) * unitToGp(m[2] || "gp");
  }
  if (typeof v === "object") {
    const amount = v.amount ?? v.quantity ?? v.value ?? v.number;
    const unit = v.unit || v.coin || v.currency || "gp";
    if (amount != null) return Number(amount) * unitToGp(unit);
  }
  return null;
}

/** Flatten builder-style entries to plain text (fallback flavor) */
function flattenEntries(entries) {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (typeof node === "string") { out.push(node); return; }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.entries) { walk(node.entries); return; }
    if (node.items) { walk(node.items); return; }
    if (node.entry) { walk(node.entry); return; }
    if (node.name && node.entries) { out.push(`${node.name}. ${[].concat(node.entries).join(" ")}`); return; }
    if (node.name && node.entry) { out.push(`${node.name}. ${[].concat(node.entry).join(" ")}`); return; }
  };
  walk(entries);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function uniqueList(arr) {
  const seen = new Set();
  return arr.filter((value) => {
    const key = String(value || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* --------- stat builders with LOTS of fallbacks --------- */
const DMG_TEXT = { P:"piercing", S:"slashing", B:"bludgeoning", R:"radiant", N:"necrotic", F:"fire", C:"cold", L:"lightning", A:"acid", T:"thunder", Psn:"poison", Psy:"psychic", Frc:"force" };
const PROP_SHORT = { L:"Light", F:"Finesse", H:"Heavy", R:"Reach", T:"Thrown", V:"Versatile", "2H":"Two-Handed", A:"Ammunition", LD:"Loading", S:"Special", RLD:"Reload" };
const stripTag = (s) => String(s || "").split("|")[0];

function coalesce(...vals) {
  for (const v of vals) if (v != null) return v;
  return null;
}

function playerText(value = "") {
  return String(value || "")
    .replace(/\{@dc\s+([^}]+)\}/gi, (_, valueText) => `DC ${stripTag(valueText).trim()}`)
    .replace(/\{@(?:damage|dice)\s+([^}]+)\}/gi, (_, valueText) => stripTag(valueText).trim())
    .replace(/\{#itemEntry\s+([^}]+)\}/gi, (_, valueText) => stripTag(valueText).trim())
    .replace(/\{@(?:spell|condition|skill|item|itemEntry|action|status|sense)\s+([^}]+)\}/gi, (_, valueText) => stripTag(valueText).trim())
    .replace(/\{@[^\s}]+\s+([^}]+)\}/gi, (_, valueText) => stripTag(valueText).trim())
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function craftedByName(item = {}) {
  return coalesce(
    item.crafted_by,
    item.craftedBy,
    item.crafter_name,
    item.crafterName,
    item?.crafter?.name,
    item?.craft?.crafter?.name,
    item?.crafting?.crafter?.name,
    item?.plan_payload?.crafter?.name,
    item?.card_payload?.crafted_by,
    item?.card_payload?.crafter_name,
    item?.card_payload?.crafter?.name
  ) || "";
}

function splitNarrativeLead(text = "") {
  const source = playerText(text);
  const match = source.match(/^(.+?[.!?])(?:\s+|\n+)([\s\S]+)$/);
  if (!match) return { description: "", rules: source };

  const first = match[1].trim();
  const rest = match[2].trim();
  const mechanical = /\b(?:while|when|whenever|you gain|you have|bonus|damage|saving throw|save|resistance|advantage|disadvantage|charges?|cast|spell|attack|armor class|\bac\b|hit points?|speed|immune|immunity|reduce|regain|attunement|requires?)\b/i;

  if (!mechanical.test(first) && mechanical.test(rest)) {
    return { description: first, rules: rest };
  }
  return { description: "", rules: source };
}

function cardFamilyForItem(item = {}, type = "", uiSubKind = "", potionDetails = null, bombDetails = null) {
  const blob = [type, item.item_type, item.type, item.category, item.item_name, item.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (item.recipe_item || /\brecipe\b/.test(blob)) return "recipe";
  if (bombDetails || /\bbomb\b/.test(blob)) return "bomb";
  if (potionDetails) return "consumable";
  if (/\b(armor|shield)\b/.test(blob)) return "armor";
  if (/\b(melee weapon|ranged weapon|ammunition)\b/.test(blob)) return "weapon";
  if (/\b(material|ore \/ metal|reagent|catalyst|alchemy modifier|plant \/ herb|monster part)\b/.test(blob)) return "material";
  if (/\b(rods? & wands?|rod|wand)\b/.test(blob) || (String(type).toLowerCase() === "wondrous item" && Number(item.charges || item.item_charges || 0) > 0)) {
    return "charged-wondrous";
  }
  if (String(type).toLowerCase() === "wondrous item" || uiSubKind) return "wondrous";
  return "general";
}

function armorClassDisplay(item = {}, fallback = "—") {
  const rawType = stripTag(item.type || item.item_type || "");
  const base = Number(coalesce(item.ac, item?.armor?.ac, item?.card_payload?.ac));
  const bonusMatch = String(coalesce(item.bonusAc, item.bonus_ac, item?.card_payload?.bonusAc, "")).match(/[+-]?\d+/);
  const bonus = bonusMatch ? Number(bonusMatch[0]) : 0;
  const total = Number.isFinite(base) ? base + bonus : null;

  if (total == null) return fallback;
  if (rawType === "LA") return `${total} + Dex (no max)`;
  if (rawType === "MA") return `${total} + Dex (max 2)`;
  if (rawType === "HA") return String(total);
  return String(total);
}

function weaponRangeDisplay(item = {}, fallback = "—", propsText = "") {
  if (fallback && fallback !== "—") return playerText(fallback);
  const rawType = stripTag(item.type || item.item_type || "");
  const isMelee = rawType === "M" || /melee weapon/i.test(String(item.item_type || item.uiType || ""));
  if (!isMelee) return fallback || "—";
  return /\breach\b/i.test(String(propsText || "")) ? "10 feet" : "5 feet";
}

function ruleMetrics(text = "") {
  const source = playerText(text);
  const rangeMatch = source.match(/(?:within|range(?: of)?|up to)\s+(\d+)\s*feet/i);
  const saveMatch = source.match(/DC\s*(\d+)\s*(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i)
    || source.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw[^.]{0,48}?DC\s*(\d+)/i);
  const damageMatch = source.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+([A-Za-z]+)\s+damage/i);

  let save = "";
  if (saveMatch) {
    if (/^\d+$/.test(saveMatch[1])) save = `${saveMatch[2]} DC ${saveMatch[1]}`;
    else save = `${saveMatch[1]} DC ${saveMatch[2]}`;
  }

  return {
    range: rangeMatch ? `${rangeMatch[1]} feet` : "",
    save,
    damage: damageMatch ? `${damageMatch[1]} ${damageMatch[2].toLowerCase()}` : "",
  };
}

function ammunitionMechanics(item = {}, ruleText = "") {
  const name = playerText(item.item_name || item.name || "");
  const rules = playerText(ruleText || item.item_description || item.rulesShort || item.rulesText || item.rules || "");
  const masteryMatch = rules.match(/\bworks like (?:an?\s+)?([A-Za-z][A-Za-z -]{1,40}?)\s+Melee weapon\b/i);
  const damageMatch = name.match(/,\s*(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\b/i);

  return {
    mastery: masteryMatch?.[1]?.trim() || "",
    damageType: damageMatch?.[1] ? `${damageMatch[1][0].toUpperCase()}${damageMatch[1].slice(1).toLowerCase()}` : "",
    rangeRule: /maximum range[^.]*halved/i.test(rules) ? "Maximum range halved" : "",
  };
}

function buildDamageText(raw) {
  // MagicVariantBuilder emits damageText. Catalog rows usually emit dmg1/dmgType.
  // Support both so admin-built variants, catalog items, and craft-completed items
  // render the same card fields.
  const direct = coalesce(raw.damageText, raw?.card_payload?.damageText, raw.damage_text, raw?.card_payload?.damage_text);
  if (direct) return String(direct);

  const dmg1 = coalesce(raw.dmg1, raw.damage1, raw.primaryDamage, raw?.damage?.dice, raw?.card_payload?.dmg1);
  const dtypeRaw = coalesce(raw.dmgType, raw.damageType, raw?.damage?.type, raw?.card_payload?.dmgType);
  const dtype = (DMG_TEXT[dtypeRaw] || dtypeRaw || "").toString().trim();

  if (Array.isArray(raw?.damage?.parts) && raw.damage.parts.length) {
    const [d, t] = raw.damage.parts[0];
    return `${d} ${t || ""}`.trim();
  }

  if (typeof raw?.damage === "string") return raw.damage;

  if (dmg1) return `${dmg1} ${dtype}`.trim();
  return "—";
}

function buildRangeText(raw, propsList) {
  const rTxt = coalesce(
    raw.rangeText, raw.range, raw?.card_payload?.range,
    (raw.range_normal && raw.range_long) ? `${raw.range_normal}/${raw.range_long} ft.` : null
  );
  if (rTxt) return String(rTxt).replace(/ft\.?$/i, "ft.");

  if (Array.isArray(propsList) && propsList.includes("T")) return "Thrown";
  return "—";
}

function buildPropsText(raw) {
  let arr = coalesce(raw.properties, raw.property, raw.propertiesText, raw?.card_payload?.properties, raw?.card_payload?.property) || [];
  if (typeof arr === "string") arr = arr.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  if (!Array.isArray(arr)) arr = [];

  const shortCodes = arr
    .map((p) => typeof p === "string" ? stripTag(p) : stripTag(p?.name))
    .filter(Boolean)
    .map((s) => PROP_SHORT[s] || s);

  return uniqueList(shortCodes).join(", ") || "—";
}

function buildACText(raw) {
  const ac = coalesce(raw.ac, raw?.armor?.ac, raw?.card_payload?.ac, raw?.card_payload?.armor?.ac);
  return ac != null && ac !== "" ? String(ac) : "—";
}

function typeFromBuilderCategory(category = "") {
  const c = String(category || "").toLowerCase();
  if (c === "melee") return "Melee Weapon";
  if (c === "ranged") return "Ranged Weapon";
  if (c === "thrown") return "Melee Weapon";
  if (c === "armor") return "Armor";
  if (c === "shield") return "Shield";
  if (c === "ammunition") return "Ammunition";
  return "";
}


function adaptiveItemFields(item = {}, type = "", norm = {}, potionDetails = null, bombDetails = null, family = "general", ruleText = "") {
  const weightValue = norm.weight != null ? `${norm.weight} lbs` : "";
  const chargesValue = coalesce(
    item.charges,
    item.item_charges,
    item.doses,
    item.dose_count,
    item.batch_output,
    item?.alchemy?.doses,
    item?.alchemy_result?.doses,
    item?.merchant_craft?.doses,
    item?.card_payload?.charges,
    item?.card_payload?.doses
  );
  const saveDcValue = coalesce(
    item.save_dc,
    item.saveDc,
    item.saving_throw_dc,
    item?.alchemy?.save_dc,
    item?.alchemy?.saveDc,
    item?.card_payload?.save_dc,
    item?.card_payload?.saveDc
  );
  const saveAbilityValue = coalesce(
    item.save_ability,
    item.saveAbility,
    item.saving_throw_ability,
    item?.alchemy?.save_ability,
    item?.alchemy?.saveAbility,
    item?.card_payload?.save_ability,
    item?.card_payload?.saveAbility
  );
  const attunementValue = coalesce(
    item.attunement,
    item.requires_attunement,
    item.requiresAttunement,
    item?.card_payload?.attunement
  );

  const clean = (label, value, span = 1) => {
    if (value == null || value === "" || value === false || value === "—") return null;
    return { label, value: playerText(value === true ? "Yes" : String(value)), span };
  };

  if (family === "bomb" && bombDetails) {
    const save = bombDetails.saveAbility && bombDetails.saveDc
      ? `${bombDetails.saveAbility} DC ${bombDetails.saveDc}`
      : (bombDetails.saveAbility || "");
    return [
      clean("Use", bombDetails.use),
      clean("Area", bombDetails.area),
      clean("Save", save),
      clean("Damage", bombDetails.damage),
      clean("Duration", bombDetails.duration),
      clean("Charges", chargesValue),
      clean("Condition", bombDetails.conditions?.join(", "), 2),
      clean("Repeat Save", bombDetails.repeatSave, 2),
    ].filter(Boolean);
  }

  if (family === "consumable" && potionDetails) {
    return [
      clean("Use", potionDetails.use),
      clean("Duration", potionDetails.duration),
      clean("Save", saveAbilityValue && saveDcValue ? `${saveAbilityValue} DC ${saveDcValue}` : null),
      clean("Doses / Charges", chargesValue),
      clean("Application", item.application || item.delivery || null, 2),
    ].filter(Boolean);
  }

  if (family === "armor") {
    return [
      clean("Armor Class", armorClassDisplay(item, norm.ac)),
      clean("Weight", weightValue),
    ].filter(Boolean);
  }

  if (family === "weapon") {
    const isAmmunition = /\bammunition\b/i.test([type, item.item_type, item.uiType, item.type].filter(Boolean).join(" "));
    const ammunition = isAmmunition ? ammunitionMechanics(item, ruleText) : null;
    return [
      clean("Damage", norm.dmg),
      clean("Damage Type", ammunition?.damageType),
      clean("Mastery", ammunition?.mastery),
      clean("Range", ammunition?.rangeRule || weaponRangeDisplay(item, norm.rng, norm.props)),
      clean("Weight", weightValue),
      clean("Properties", norm.props),
    ].filter(Boolean);
  }

  if (family === "material") {
    const smithing = item?.smithing && typeof item.smithing === "object" ? item.smithing : {};
    const allowedKinds = Array.isArray(smithing.allowedItemKinds) ? smithing.allowedItemKinds.map(titleCase).join(", ") : "";
    const allowedFamilies = Array.isArray(smithing.allowedWeaponFamilies) ? smithing.allowedWeaponFamilies.map(titleCase).join(", ") : "";
    return [
      clean("Category", item.crafting_category || smithing.materialClass || type),
      clean("Quality", item.quality || smithing.quality),
      clean("Used In", allowedFamilies || allowedKinds),
      clean("Weight", weightValue),
      clean("Trait", smithing.risk || smithing.offensive || smithing.defensive, 2),
      clean("Note", smithing.flavor && normalizedComparableText(smithing.flavor) !== normalizedComparableText(norm.flavor) ? smithing.flavor : null, 2),
    ].filter(Boolean);
  }

  if (family === "recipe") {
    const unlock = item?.recipe_unlock && typeof item.recipe_unlock === "object" ? item.recipe_unlock : {};
    return [
      clean("Craft Type", unlock.discipline ? `${unlock.discipline} Recipe` : "Recipe"),
      clean("Output", unlock.recipe_name || String(norm.name || "").replace(/^Recipe:\s*/i, "")),
      clean("Base DC", unlock.base_dc),
      clean("Recipe Family", unlock.alchemy_group || unlock.alchemy_section || unlock.template_key, 2),
    ].filter(Boolean);
  }

  if (family === "charged-wondrous") {
    const metrics = ruleMetrics(ruleText);
    return [
      clean("Charges", chargesValue),
      clean("Range", metrics.range),
      clean("Save", metrics.save),
      clean("Damage", metrics.damage),
      clean("Weight", weightValue),
    ].filter(Boolean);
  }

  if (family === "wondrous") {
    return [
      clean("Slot", norm.typeHint),
      clean("Attunement", attunementValue),
      clean("Weight", weightValue),
      clean("Charges", chargesValue),
    ].filter(Boolean);
  }

  return [
    clean("Spell Attack Bonus", item.bonusSpellAttack || item.bonus_spell_attack),
    clean("Spell Save DC Bonus", item.bonusSpellSaveDc || item.bonus_spell_save_dc),
    clean("Weight", weightValue),
    clean("Charges", chargesValue),
    clean("Attunement", attunementValue),
    clean("Properties", norm.props && norm.props !== "—" ? norm.props : null, 2),
  ].filter(Boolean);
}

const POTION_DETAIL_OVERRIDES = {
  "Oil of Etherealness": { duration: "1 hour", use: "10 minutes to apply", effect: "One vial can cover one Medium or smaller creature and grants the effect of Etherealness." },
  "Oil of Sharpness": { duration: "1 hour", use: "1 minute to apply", effect: "A coated slashing or piercing weapon or ammunition gains a temporary bonus to attack and damage rolls by DM ruling." },
  "Potion of Healing": { duration: "Instant", use: "Action to drink", effect: "The drinker regains 2d4 + 2 HP." },
  "Potion of Superior Healing": { duration: "Instant", use: "Action to drink", effect: "The drinker regains 8d4 + 8 HP." },
  "Potion of Climbing": { duration: "1 hour", use: "Action to drink", effect: "The drinker gains a climbing speed equal to walking speed and Advantage on climbing checks." },
  "Potion of Speed": { duration: "1 minute", use: "Action to drink", effect: "The drinker gains the effect of Haste." },
  "Potion of Invisibility": { duration: "1 hour", use: "Action to drink", effect: "The drinker becomes invisible until they attack, cast a spell, or the duration ends." },
  "Potion of Flying": { duration: "1 hour", use: "Action to drink", effect: "The drinker gains a flying speed equal to walking speed." },
  "Potion of Water Breathing": { duration: "1 hour", use: "Action to drink", effect: "The drinker can breathe underwater." },
  "Potion of Heroism": { duration: "1 hour", use: "Action to drink", effect: "The drinker gains temporary HP and a blessing-like heroic boost by DM ruling." },
  "Potion of Gaseous Form": { duration: "1 hour", use: "Action to drink", effect: "The drinker gains the effect of Gaseous Form." },
  "Potion of Mind Reading": { duration: "1 hour", use: "Action to drink", effect: "The drinker gains the effect of Detect Thoughts." },
  "Potion of Clairvoyance": { duration: "10 minutes", use: "Action to drink", effect: "The drinker gains the effect of Clairvoyance." },
  "Potion of Storm Giant Strength": { duration: "1 hour", use: "Action to drink", effect: "The drinker's Strength becomes 29 unless already equal or higher." },
  "Potion of Invulnerability": { duration: "1 minute", use: "Action to drink", effect: "The drinker gains resistance to all damage." },
  "Potion of Resistance": { duration: "1 hour", use: "Action to drink", effect: "The drinker gains resistance to one damage type chosen by the formula/reagent." },
  "Purple Worm Poison": { duration: "Until delivered", use: "Action to apply", effect: "A creature exposed to the poison makes a Constitution save or takes heavy poison damage by DM ruling." },
};
function isPotionLikeItem(item = {}, type = "") {
  const blob = [type, item.item_type, item.type, item.name, item.item_name, item.category].filter(Boolean).join(" ").toLowerCase();
  return /\b(potion|oil|poison|elixir|philter|tonic|draught|salve|drops)\b/.test(blob);
}
function extractDuration(text = "") {
  const s = String(text || "");
  const patterns = [
    /(?:for|lasts? for|duration:?\s*)(\d+\s*(?:round|minute|hour|day|week)s?)/i,
    /(?:for|lasts? for|duration:?\s*)(1d4\s*hours?|1d4\s*minutes?)/i,
    /(instant(?:aneous)?)/i,
    /(until delivered|until used|until dispelled)/i,
  ];
  for (const rx of patterns) {
    const m = s.match(rx);
    if (m) return m[1].replace(/^instantaneous$/i, "Instant");
  }
  return "";
}
function alchemyModifierDetailsForItem(item = {}) {
  const alchemy = item?.alchemy && typeof item.alchemy === "object" ? item.alchemy : null;
  if (!alchemy || String(alchemy.kind || "").toLowerCase() !== "modifier") return null;

  const brewTags = Array.isArray(alchemy.brewTags)
    ? uniqueList(alchemy.brewTags.map((value) => String(value || "").trim()).filter(Boolean))
    : [];
  const reduction = Number(alchemy.craftDcReduction || 0);
  const rawSlot = String(alchemy.slot || "").trim();
  const purpose = rawSlot.replace(/^fourth[- ]slot\s*/i, "").trim();

  return {
    slot: /^fourth[- ]slot/i.test(rawSlot) ? "Fourth slot" : (rawSlot || "Modifier slot"),
    purpose: purpose ? titleCase(purpose) : "Recipe modifier",
    family: alchemy.familyLabel || titleCase(alchemy.family || "Enhancer / Catalyst"),
    brewTags,
    brewImpact: alchemy.brewImpact || "Recipe theme component",
    dcReduction: Number.isFinite(reduction) ? reduction : 0,
  };
}

function alchemyIngredientDetailsForItem(item = {}) {
  const alchemy = item?.alchemy && typeof item.alchemy === "object" ? item.alchemy : null;
  if (!alchemy || String(alchemy.kind || "").toLowerCase() !== "ingredient") return null;

  const brewTags = Array.isArray(alchemy.brewTags)
    ? uniqueList(alchemy.brewTags.map((value) => String(value || "").trim()).filter(Boolean))
    : [];
  const reduction = Number(alchemy.craftDcReduction || 0);

  return {
    role: alchemy.slot || "Alchemy ingredient",
    family: alchemy.familyLabel || titleCase(alchemy.family || "Ingredient"),
    brewTags,
    brewImpact: alchemy.brewImpact || "Recipe component",
    dcReduction: Number.isFinite(reduction) ? reduction : 0,
    physicalDescription: alchemy.physicalDescription || "",
  };
}

function bombDetailsForItem(item = {}, type = "", craftedAlchemy = null) {
  const blob = [type, item.item_type, item.type, item.category, item.item_name, item.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!/\bbomb\b/.test(blob)) return null;

  const alchemy = item?.alchemy && typeof item.alchemy === "object" ? item.alchemy : {};
  const saveAbility = craftedAlchemy?.saveAbility || coalesce(item.save_ability, item.saveAbility, alchemy.save_ability, alchemy.saveAbility);
  const saveDc = craftedAlchemy?.saveDc || coalesce(item.save_dc, item.saveDc, alchemy.save_dc, alchemy.saveDc);
  const area = craftedAlchemy?.area || coalesce(item.area_text, item.areaText, alchemy.area_text, alchemy.areaText);
  const duration = craftedAlchemy?.duration || coalesce(item.duration_text, item.duration, alchemy.duration, "Instant");
  const use = craftedAlchemy?.use || coalesce(item.use_text, item.use, alchemy.use, "Use as described");
  const repeatSave = coalesce(item.rider_repeat_save, alchemy.rider_repeat_save);
  const conditions = Array.isArray(alchemy.condition_riders)
    ? uniqueList(alchemy.condition_riders.map((value) => String(value || "").trim()).filter(Boolean))
    : [];
  const count = Number(alchemy.base_dice_count || 0);
  const die = Number(alchemy.base_die_size || 0);
  const theme = craftedAlchemy?.theme || coalesce(alchemy.themeTag, alchemy.tag_label);
  const effectDice = craftedAlchemy?.effectDice || (count > 0 && die > 0 ? `${count}d${die}` : "");
  const damage = effectDice ? `${effectDice}${theme ? ` ${String(theme).toLowerCase()}` : ""}` : "";

  return { saveAbility, saveDc, area, duration, use, repeatSave, conditions, damage };
}

function normalizedComparableText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function merchantCraftedAlchemyDetails(item = {}) {
  const alchemy = item?.alchemy && typeof item.alchemy === "object" ? item.alchemy : {};
  const merchantCraft = item?.merchant_craft && typeof item.merchant_craft === "object" ? item.merchant_craft : {};
  const alchemyResult = item?.alchemy_result && typeof item.alchemy_result === "object" ? item.alchemy_result : {};
  const isCraftedProduct = String(alchemy.kind || "").toLowerCase() === "crafted_product";
  const isMerchantCrafted = Boolean(item.merchant_crafted || item.merchantCrafted || merchantCraft.crafted || alchemy.merchantCrafted);
  if (!isCraftedProduct || !isMerchantCrafted) return null;

  const effect = coalesce(item.effect_text, item.item_description, item.effect, alchemyResult.effect, merchantCraft.effect, alchemy.effect);
  const duration = coalesce(item.duration_text, item.duration, merchantCraft.duration, alchemyResult.duration, alchemy.duration);
  const use = coalesce(item.use_text, item.use, merchantCraft.use, alchemyResult.use, alchemy.use);
  const areaFeet = Number(coalesce(merchantCraft.area_feet, alchemyResult.areaFeet, item.area_feet, alchemy.areaFeet, alchemy.base_area_feet) || 0);
  const areaShape = coalesce(item.area_shape, alchemy.area_shape);
  const area = areaFeet > 0
    ? `${areaFeet}-foot ${String(areaShape || "area").replace(/_/g, " ")}`
    : coalesce(item.area_text, item.areaText, alchemyResult.areaText, merchantCraft.area_text, alchemy.area_text, alchemy.areaText);
  const effectDice = coalesce(item.effect_dice, merchantCraft.effect_dice, alchemyResult.effectDice, alchemy.effectDice);
  const saveAbility = coalesce(merchantCraft.save_ability, alchemyResult?.saveDcPreview?.saveAbility, item.save_ability, item.saveAbility, alchemy.save_ability, alchemy.saveAbility);
  const saveDc = coalesce(merchantCraft.save_dc, alchemyResult?.saveDcPreview?.dc, item.save_dc, item.saveDc, alchemy.save_dc, alchemy.saveDc);
  const theme = coalesce(alchemy.themeTag, alchemy.tag_label);

  return { effect, duration, use, area, effectDice, saveAbility, saveDc, theme };
}

function namedRuleSections(text = "") {
  const source = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!source) return null;

  const blocks = source
    .split(/\n\s*\n+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (blocks.length < 5) return null;

  const looksLikeHeading = (value = "") => {
    const clean = String(value || "").trim();
    if (!clean || clean.length > 64) return false;
    if (clean.split(/\s+/).length > 9) return false;
    if (/[.!?;:]$/.test(clean)) return false;
    if (/^(?:the|this|that|these|those|you|your|when|while|if|as|a|an)\b/i.test(clean)) return false;
    return /^[A-Z0-9][A-Za-z0-9'’/&()\- ]+$/.test(clean);
  };

  const intro = [];
  const traits = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];
    if (looksLikeHeading(block) && index + 1 < blocks.length) {
      const body = [];
      index += 1;
      while (index < blocks.length && !looksLikeHeading(blocks[index])) {
        body.push(blocks[index]);
        index += 1;
      }
      if (body.length) {
        traits.push({ title: block, body: body.join("\n\n") });
        continue;
      }
    }

    if (!traits.length) intro.push(block);
    else traits[traits.length - 1].body += `\n\n${block}`;
    index += 1;
  }

  return traits.length >= 2 ? { intro: intro.join("\n\n"), traits } : null;
}

function potionDetailsForItem(item = {}, type = "", ruleText = "", entriesText = "") {
  if (!isPotionLikeItem(item, type)) return null;
  const name = item.item_name || item.name || "";
  const known = POTION_DETAIL_OVERRIDES[name] || {};
  const sourceText = [ruleText, entriesText, item.effect_text, item.effect, item.rulesText].filter(Boolean).join("\n");
  const duration = item.duration || item.duration_text || item?.alchemy?.duration || known.duration || extractDuration(sourceText) || "By item text / DM ruling";
  const use = item.use || item.use_text || item.activation || item.application || item?.alchemy?.use || known.use || (/oil/i.test(name) ? "Apply as described" : "Action to drink/use");
  const effect = item.effect_detail || item.effect_text || item.effect || item?.alchemy?.effect || known.effect || sourceText || "See item text.";
  return { use, duration, effect };
}

/* ---------- component ---------- */
export default function ItemCard({
  item = {},
  variant = "default",
  detailsCollapsible = false,
  action = null,
}) {
  const mergedItem = {
    ...(item.card_payload && typeof item.card_payload === "object" ? item.card_payload : {}),
    ...item,
  };
  const { uiType, uiSubKind } = classifyUi(mergedItem);
  const visual = resolveItemVisual(mergedItem);

  const [flavorIndex, setFlavorIndex] = useState(null);
  useEffect(() => {
    let ok = true;
    loadFlavorIndex().then((idx) => ok && setFlavorIndex(idx)).catch(() => {});
    return () => { ok = false; };
  }, []);

  const pureStringBullets =
    Array.isArray(mergedItem.entries) && mergedItem.entries.every((e) => typeof e === "string")
      ? uniqueList(mergedItem.entries)
      : null;

  const entriesText = playerText(flattenEntries(mergedItem.entries));
  const overrideFlavor = playerText((flavorIndex && flavorIndex.get(mergedItem.item_name || mergedItem.name)) || "");
  const craftedAlchemy = merchantCraftedAlchemyDetails(mergedItem);
  const sourceRuleText = playerText(craftedAlchemy?.effect || coalesce(mergedItem.item_description, mergedItem.rulesText, mergedItem.rules, ""));
  const sourceFlavorText = playerText(mergedItem.flavor || overrideFlavor || entriesText || "");
  const narrativeLead = splitNarrativeLead(sourceRuleText);
  const itemBlob = [uiType, mergedItem.item_type, mergedItem.type, mergedItem.item_name, mergedItem.name].filter(Boolean).join(" ").toLowerCase();
  const consumableLike = isPotionLikeItem(mergedItem, uiType || mergedItem.item_type || mergedItem.type) || /\bbomb\b/.test(itemBlob);
  const ammunitionLike = /\bammunition\b/.test(itemBlob);
  const duplicateSourceFlavor = Boolean(sourceFlavorText && sourceRuleText && normalizedComparableText(sourceFlavorText) === normalizedComparableText(sourceRuleText));
  const ammunitionRulesOnly = Boolean(
    ammunitionLike &&
    duplicateSourceFlavor &&
    /\b(?:works like|deals?\b[^.]{0,48}\bdamage|maximum range|ammunition)\b/i.test(sourceRuleText)
  );
  const flavorText = narrativeLead.description || (((consumableLike && duplicateSourceFlavor) || ammunitionRulesOnly) ? "" : sourceFlavorText);
  const rawRuleText = narrativeLead.rules || sourceRuleText;
  const hasItemDescription = Boolean(rawRuleText);
  const potionDetails = potionDetailsForItem(mergedItem, uiType || mergedItem.type || mergedItem.item_type, rawRuleText, entriesText);
  const bombDetails = bombDetailsForItem(mergedItem, uiType || mergedItem.type || mergedItem.item_type, craftedAlchemy);
  const alchemyModifierDetails = alchemyModifierDetailsForItem(mergedItem);
  const alchemyIngredientDetails = alchemyIngredientDetailsForItem(mergedItem);
  const isAlchemyComponent = Boolean(alchemyModifierDetails || alchemyIngredientDetails);
  const ruleDuplicatesFlavor = Boolean(
    rawRuleText &&
    flavorText &&
    normalizedComparableText(rawRuleText) === normalizedComparableText(flavorText)
  );
  const structuredRules = !isAlchemyComponent && hasItemDescription && !ruleDuplicatesFlavor
    ? namedRuleSections(rawRuleText)
    : null;

  const gp = parseValueToGp(coalesce(mergedItem.item_cost, mergedItem.cost, mergedItem.value));
  const weight = coalesce(mergedItem.item_weight, mergedItem.weight, mergedItem?.card_payload?.weight, null);
  const rawProps = coalesce(mergedItem.property, mergedItem.properties, mergedItem?.card_payload?.properties, []);
  const dmgText = buildDamageText(mergedItem);
  const rngText = buildRangeText(mergedItem, Array.isArray(rawProps) ? rawProps.map(stripTag) : []);
  const propsTxt = buildPropsText(mergedItem);
  const acText = buildACText(mergedItem);
  const rarityRaw = coalesce(mergedItem.item_rarity, mergedItem.rarity, mergedItem?.card_payload?.rarity);
  const rarity = humanRarity(rarityRaw);

  const norm = {
    image: visual.imageUrl,
    visual,
    name: mergedItem.item_name || mergedItem.name || "Unnamed Item",
    type: uiType || typeFromBuilderCategory(mergedItem.category) || titleCase(stripTag(mergedItem.type || mergedItem.item_type || "Item")),
    typeHint: uiType === "Wondrous Item" ? uiSubKind : null,
    rarity,
    flavor: playerText(flavorText || ""),
    cost: gp,
    weight: weight != null ? weight : null,
    source: playerText(mergedItem.source || mergedItem.item_source || ""),
    charges: mergedItem.charges ?? mergedItem.item_charges ?? null,
    dmg: dmgText,
    rng: rngText,
    props: propsTxt,
    ac: acText,
  };

  const rarityClass = `rarity-${(norm.rarity || "Common").toLowerCase().replace(/\s+/g, "-")}`;
  const cardFamily = cardFamilyForItem(mergedItem, norm.type, norm.typeHint, potionDetails, bombDetails);
  const crafterName = playerText(craftedByName(mergedItem));
  const adaptiveFields = adaptiveItemFields(mergedItem, norm.type, norm, potionDetails, bombDetails, cardFamily, rawRuleText);

  const renderFieldGrid = (fields = adaptiveFields, extraClass = "") => fields.length ? (
    <div className={`sitem-field-grid ${extraClass}`.trim()}>
      {fields.map((field) => (
        <div className={`sitem-field ${field.span === 2 ? "is-wide" : ""}`} key={field.label}>
          <div className="sitem-field__label">{field.label}</div>
          <div className="sitem-field__value">{field.value}</div>
        </div>
      ))}
    </div>
  ) : null;

  const alchemyComponentGrid = alchemyIngredientDetails ? renderFieldGrid([
    { label: "Role", value: alchemyIngredientDetails.role },
    { label: "Family", value: alchemyIngredientDetails.family },
    { label: "Brew Impact", value: alchemyIngredientDetails.brewImpact, span: 2 },
    { label: "Craft DC", value: alchemyIngredientDetails.dcReduction > 0 ? `−${alchemyIngredientDetails.dcReduction}` : "No reduction" },
    { label: "Brew Tags", value: alchemyIngredientDetails.brewTags.join(", ") || "Neutral" },
  ], "sitem-alchemy-ingredient-grid") : alchemyModifierDetails ? renderFieldGrid([
    { label: "Slot", value: alchemyModifierDetails.slot },
    { label: "Purpose", value: alchemyModifierDetails.purpose },
    { label: "Family", value: alchemyModifierDetails.family },
    { label: "Brew Theme", value: alchemyModifierDetails.brewTags.join(", ") || "Neutral" },
    { label: "Craft DC", value: alchemyModifierDetails.dcReduction > 0 ? `−${alchemyModifierDetails.dcReduction}` : "No reduction" },
    { label: "Contribution", value: alchemyModifierDetails.brewImpact },
  ], "sitem-alchemy-modifier-grid") : null;

  const rulesIntro = structuredRules?.intro || (!ruleDuplicatesFlavor ? rawRuleText : "");
  const primaryEffectText = playerText(
    potionDetails?.effect && normalizedComparableText(potionDetails.effect) !== normalizedComparableText(norm.flavor)
      ? potionDetails.effect
      : rulesIntro
  );
  const effectLabel = cardFamily === "recipe" ? "Recipe" : "Effect";
  const effectPanel = primaryEffectText ? (
    <div className="sitem-section sitem-rules sitem-effect-panel">
      <div className="small text-muted mb-1 text-uppercase fw-semibold">{effectLabel}</div>
      <div style={{ whiteSpace: "pre-line" }}>{primaryEffectText}</div>
    </div>
  ) : null;

  const traitList = structuredRules?.traits?.length ? (
    <div className="sitem-rule-traits" aria-label="Item traits">
      {structuredRules.traits.map((trait) => (
        <details className="sitem-rule-trait" key={trait.title}>
          <summary>{playerText(trait.title)}</summary>
          <div className="sitem-rule-trait__body" style={{ whiteSpace: "pre-line" }}>{playerText(trait.body)}</div>
        </details>
      ))}
    </div>
  ) : null;

  let orderedDetails = null;
  if (isAlchemyComponent) {
    orderedDetails = alchemyComponentGrid;
  } else if (cardFamily === "armor") {
    orderedDetails = <>
      {renderFieldGrid()}
      {effectPanel}
      {traitList}
    </>;
  } else if (cardFamily === "material") {
    orderedDetails = <>
      {renderFieldGrid()}
      {effectPanel}
    </>;
  } else {
    orderedDetails = <>
      {effectPanel}
      {traitList}
      {renderFieldGrid()}
    </>;
  }

  const detailContent = <div className={`sitem-detail-stack sitem-detail-stack--${cardFamily}`}>
    {orderedDetails}
    {variant !== "shop" ? <div className="sitem-legacy-footer d-flex justify-content-between align-items-center">
      <div className="d-flex gap-2 flex-wrap">
        {norm.cost != null ? <span className="badge text-bg-dark">{norm.cost} gp</span> : null}
        {norm.weight != null ? <span className="badge text-bg-dark">{norm.weight} lbs</span> : null}
        {norm.source ? <span className="badge text-bg-secondary">{norm.source}</span> : null}
      </div>
    </div> : null}
  </div>;

  return (
    <div className={`card sitem-card mb-4 sitem-family-${cardFamily} ${variant === "shop" ? "is-shop-variant" : ""}`}>
      <div className={`card-header sitem-header d-flex align-items-center justify-content-between ${rarityClass}`}>
        <div className="sitem-title fw-semibold">{norm.name}</div>
        <div className="sitem-type small text-uppercase">
          {norm.type}{norm.typeHint ? ` • ${norm.typeHint}` : ""}
        </div>
      </div>

      <div className="card-body">
        <div className="sitem-meta text-center mb-2">
          <span className="sitem-rarity">{norm.rarity}</span>
          {crafterName ? <span className="sitem-crafted-by"> • Crafted by {crafterName}</span> : null}
          {norm.charges != null && <span className="ms-1 small text-muted">({norm.charges} charges)</span>}
        </div>

        <div className="row g-2 align-items-start">
          {norm.flavor ? <div className="col-8">
            <div className="sitem-section sitem-desc" style={{ whiteSpace: "pre-line" }}>
              {norm.flavor}
            </div>
          </div> : null}
          <div className={norm.flavor ? "col-4" : "col-4 ms-auto"}>
            <div className={`sitem-thumb ratio ratio-1x1 ${!norm.visual.hasImage ? `sitem-thumb-fallback ${norm.visual.className}` : ""}`}>
              {norm.visual.hasImage ? <img
                src={norm.image}
                alt={norm.name}
                className="img-fluid object-fit-cover rounded"
                loading="lazy"
              /> : <span className="sitem-thumb-fallback__icon" title={norm.visual.label} aria-label={norm.visual.label}>{norm.visual.icon}</span>}
            </div>
          </div>
        </div>

        <div className="sitem-rarity-divider" aria-hidden="true"><span className="sitem-rarity-divider__crystal">◆</span></div>

        {detailsCollapsible ? <details className="sitem-game-details mt-2">
          <summary><span>Game Details</span><em>Rules, stats &amp; source</em></summary>
          <div className="sitem-game-details__body">{detailContent}</div>
        </details> : detailContent}

        {action ? <div className="sitem-action">{action}</div> : null}
      </div>
    </div>
  );
}

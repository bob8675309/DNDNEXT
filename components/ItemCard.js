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


function adaptiveItemFields(item = {}, type = "", norm = {}, potionDetails = null, bombDetails = null) {
  const blob = [type, item.item_type, item.type, item.category, item.item_name, item.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const weightValue = norm.weight != null ? `${norm.weight} lbs` : "";
  const chargesValue = coalesce(
    item.charges,
    item.item_charges,
    item.doses,
    item.dose_count,
    item.batch_output,
    item?.card_payload?.charges,
    item?.card_payload?.doses
  );
  const saveDcValue = coalesce(
    item.save_dc,
    item.saveDc,
    item.saving_throw_dc,
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
  const strengthValue = coalesce(
    item.strength_requirement,
    item.strengthRequirement,
    item.strength,
    item?.armor?.strength,
    item?.card_payload?.strength_requirement
  );
  const stealthValue = coalesce(
    item.stealth,
    item.stealth_disadvantage,
    item.stealthDisadvantage,
    item?.armor?.stealth,
    item?.card_payload?.stealth
  );
  const attunementValue = coalesce(
    item.attunement,
    item.requires_attunement,
    item.requiresAttunement,
    item?.card_payload?.attunement
  );

  const clean = (label, value, span = 1) => {
    if (value == null || value === "" || value === false) return null;
    const text = value === true ? "Yes" : String(value);
    return { label, value: text, span };
  };

  if (bombDetails) {
    const save = bombDetails.saveAbility && bombDetails.saveDc
      ? `${bombDetails.saveAbility} DC ${bombDetails.saveDc}`
      : (bombDetails.saveAbility || "");
    return [
      clean("Use", bombDetails.use),
      clean("Area", bombDetails.area),
      clean("Save", save),
      clean("Damage", bombDetails.damage),
      clean("Duration", bombDetails.duration),
      clean("Condition", bombDetails.conditions?.join(", ")),
      clean("Repeat Save", bombDetails.repeatSave),
      clean("Charges", chargesValue),
    ].filter(Boolean);
  }

  if (potionDetails) {
    return [
      clean("Use", potionDetails.use),
      clean("Duration", potionDetails.duration),
      clean("Save", saveAbilityValue && saveDcValue ? `${saveAbilityValue} DC ${saveDcValue}` : null),
      clean("Doses / Charges", chargesValue),
    ].filter(Boolean);
  }

  if (/\b(armor|shield)\b/.test(blob)) {
    return [
      clean("Armor Class", norm.ac || "—"),
      clean("Strength", strengthValue),
      clean("Stealth", stealthValue),
      clean("Weight", weightValue),
      clean("Attunement", attunementValue),
      clean("Properties", norm.props && norm.props !== "—" ? norm.props : null, 2),
    ].filter(Boolean);
  }

  if (/\b(weapon|ammunition|melee|ranged)\b/.test(blob)) {
    return [
      clean("Damage", norm.dmg || "—"),
      clean("Range", norm.rng || "—"),
      clean("Weight", weightValue),
      clean("Attunement", attunementValue),
      clean("Properties", norm.props && norm.props !== "—" ? norm.props : null, 2),
    ].filter(Boolean);
  }

  return [
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
  return {
    role: alchemy.slot || "Alchemy modifier",
    family: alchemy.familyLabel || titleCase(alchemy.family || "Enhancer / Catalyst"),
    brewTags,
    brewImpact: alchemy.brewImpact || "Recipe component",
    dcReduction: Number.isFinite(reduction) ? reduction : 0,
    note: alchemy.mergeNote || "",
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

function bombDetailsForItem(item = {}, type = "") {
  const blob = [type, item.item_type, item.type, item.category, item.item_name, item.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!/\bbomb\b/.test(blob)) return null;

  const alchemy = item?.alchemy && typeof item.alchemy === "object" ? item.alchemy : {};
  const saveAbility = coalesce(item.save_ability, item.saveAbility, alchemy.save_ability, alchemy.saveAbility);
  const saveDc = coalesce(item.save_dc, item.saveDc, alchemy.save_dc, alchemy.saveDc);
  const area = coalesce(item.area_text, item.areaText, alchemy.area_text, alchemy.areaText);
  const duration = coalesce(item.duration, item.duration_text, alchemy.duration, "Instant");
  const use = coalesce(item.use, item.use_text, alchemy.use, "Use as described");
  const repeatSave = coalesce(item.rider_repeat_save, alchemy.rider_repeat_save);
  const conditions = Array.isArray(alchemy.condition_riders)
    ? uniqueList(alchemy.condition_riders.map((value) => String(value || "").trim()).filter(Boolean))
    : [];
  const count = Number(alchemy.base_dice_count || 0);
  const die = Number(alchemy.base_die_size || 0);
  const theme = coalesce(alchemy.themeTag, alchemy.tag_label);
  const damage = count > 0 && die > 0
    ? `${count}d${die}${theme ? ` ${String(theme).toLowerCase()}` : ""}`
    : "";

  return { saveAbility, saveDc, area, duration, use, repeatSave, conditions, damage };
}

function normalizedComparableText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

  const entriesText = flattenEntries(mergedItem.entries);
  const overrideFlavor = (flavorIndex && flavorIndex.get(mergedItem.item_name || mergedItem.name)) || null;
  const flavorText = mergedItem.flavor || overrideFlavor || entriesText || "";
  const rawRuleText = coalesce(mergedItem.item_description, mergedItem.rulesText, mergedItem.rules, "");
  const hasItemDescription = !!rawRuleText;
  const potionDetails = potionDetailsForItem(mergedItem, uiType || mergedItem.type || mergedItem.item_type, rawRuleText, entriesText);
  const bombDetails = bombDetailsForItem(mergedItem, uiType || mergedItem.type || mergedItem.item_type);
  const alchemyModifierDetails = alchemyModifierDetailsForItem(mergedItem);
  const alchemyIngredientDetails = alchemyIngredientDetailsForItem(mergedItem);
  const isAlchemyComponent = Boolean(alchemyModifierDetails || alchemyIngredientDetails);
  const ruleDuplicatesFlavor = Boolean(
    rawRuleText &&
    flavorText &&
    normalizedComparableText(rawRuleText) === normalizedComparableText(flavorText)
  );
  const effectDuplicatesFlavor = Boolean(
    potionDetails?.effect &&
    flavorText &&
    normalizedComparableText(potionDetails.effect) === normalizedComparableText(flavorText)
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
    flavor: flavorText || "—",
    cost: gp,
    weight: weight != null ? weight : null,
    source: mergedItem.source || mergedItem.item_source || "",
    charges: mergedItem.charges ?? mergedItem.item_charges ?? null,
    dmg: dmgText,
    rng: rngText,
    props: propsTxt,
    ac: acText,
  };

  const rarityClass = `rarity-${(norm.rarity || "Common").toLowerCase().replace(/\s+/g, "-")}`;
  const adaptiveFields = adaptiveItemFields(mergedItem, norm.type, norm, potionDetails, bombDetails);

  const detailContent = <>
    {alchemyIngredientDetails ? (
      <div className="sitem-field-grid sitem-alchemy-ingredient-grid mt-2">
        <div className="sitem-field"><div className="sitem-field__label">Role</div><div className="sitem-field__value">{alchemyIngredientDetails.role}</div></div>
        <div className="sitem-field"><div className="sitem-field__label">Family</div><div className="sitem-field__value">{alchemyIngredientDetails.family}</div></div>
        <div className="sitem-field is-wide"><div className="sitem-field__label">Brew Impact</div><div className="sitem-field__value">{alchemyIngredientDetails.brewImpact}</div></div>
        <div className="sitem-field"><div className="sitem-field__label">Craft DC</div><div className="sitem-field__value">{alchemyIngredientDetails.dcReduction > 0 ? `−${alchemyIngredientDetails.dcReduction}` : "No reduction"}</div></div>
        <div className="sitem-field"><div className="sitem-field__label">Brew Tags</div><div className="sitem-field__value">{alchemyIngredientDetails.brewTags.join(", ") || "Neutral"}</div></div>
      </div>
    ) : null}

    {alchemyModifierDetails ? (
      <div className="sitem-section sitem-alchemy-details mt-2">
        <div className="small text-muted mb-1 text-uppercase fw-semibold">Alchemy Modifier</div>
        <div className="row g-2">
          <div className="col-12 col-md-6"><strong>Role:</strong> {alchemyModifierDetails.role}</div>
          <div className="col-12 col-md-6"><strong>Family:</strong> {alchemyModifierDetails.family}</div>
          <div className="col-12 col-md-6"><strong>Brew tag:</strong> {alchemyModifierDetails.brewTags.join(", ") || "—"}</div>
          <div className="col-12 col-md-6"><strong>Craft DC:</strong> {alchemyModifierDetails.dcReduction > 0 ? `−${alchemyModifierDetails.dcReduction}` : "No reduction"}</div>
          <div className="col-12"><strong>Final brew:</strong> The selected recipe determines the finished brew's effect and duration; this modifier contributes its listed brew tag.</div>
        </div>
      </div>
    ) : null}

    {potionDetails && !effectDuplicatesFlavor ? (
      <div className="sitem-section sitem-rules sitem-effect-panel mt-2">
        <div className="small text-muted mb-1 text-uppercase fw-semibold">Effect</div>
        <div>{potionDetails.effect}</div>
      </div>
    ) : null}

    {!isAlchemyComponent && !ruleDuplicatesFlavor ? (
      structuredRules ? <>
        {structuredRules.intro ? <div
          className="sitem-section sitem-rules mt-2"
          style={{ whiteSpace: "pre-line" }}
        >
          {structuredRules.intro}
        </div> : null}
        <div className="sitem-rule-traits mt-2" aria-label="Item traits">
          {structuredRules.traits.map((trait) => (
            <details className="sitem-rule-trait" key={trait.title}>
              <summary>{trait.title}</summary>
              <div className="sitem-rule-trait__body" style={{ whiteSpace: "pre-line" }}>{trait.body}</div>
            </details>
          ))}
        </div>
      </> : <div
        className="sitem-section sitem-rules mt-2"
        style={{ whiteSpace: hasItemDescription ? "pre-line" : (pureStringBullets ? "normal" : "pre-line") }}
      >
        {hasItemDescription ? (
          rawRuleText
        ) : pureStringBullets ? (
          <ul className="mb-0">
            {pureStringBullets.map((ln, i) => <li key={i}>{ln}</li>)}
          </ul>
        ) : (
          "—"
        )}
      </div>
    ) : null}

    {!isAlchemyComponent && adaptiveFields.length ? (
      <div className="sitem-field-grid mt-2">
        {adaptiveFields.map((field) => (
          <div className={`sitem-field ${field.span === 2 ? "is-wide" : ""}`} key={field.label}>
            <div className="sitem-field__label">{field.label}</div>
            <div className="sitem-field__value">{field.value}</div>
          </div>
        ))}
      </div>
    ) : null}

    <div className="d-flex justify-content-between align-items-center mt-2">
      <div className="d-flex gap-2 flex-wrap">
        {variant !== "shop" ? <span className="badge text-bg-dark">{norm.cost != null ? `${norm.cost} gp` : "— gp"}</span> : null}
        <span className="badge text-bg-dark">{norm.weight != null ? `${norm.weight} lbs` : "— lbs"}</span>
        <span className="badge text-bg-dark">{norm.type}{norm.typeHint ? ` • ${norm.typeHint}` : ""}</span>
        {norm.source && <span className="badge text-bg-secondary">{norm.source}</span>}
      </div>
    </div>
  </>;

  return (
    <div className={`card sitem-card mb-4 ${variant === "shop" ? "is-shop-variant" : ""}`}>
      <div className={`card-header sitem-header d-flex align-items-center justify-content-between ${rarityClass}`}>
        <div className="sitem-title fw-semibold">{norm.name}</div>
        <div className="sitem-type small text-uppercase">
          {norm.type}{norm.typeHint ? ` • ${norm.typeHint}` : ""}
        </div>
      </div>

      <div className="card-body">
        <div className="sitem-meta text-center mb-2">
          <span className="sitem-rarity">{norm.rarity}</span>
          {norm.charges != null && <span className="ms-1 small text-muted">({norm.charges} charges)</span>}
        </div>

        <div className="row g-2 align-items-start">
          <div className="col-8">
            <div className="sitem-section sitem-desc" style={{ whiteSpace: "pre-line" }}>
              {norm.flavor}
            </div>
          </div>
          <div className="col-4">
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

        <div className="sitem-rarity-divider" aria-hidden="true" />

        {detailsCollapsible ? <details className="sitem-game-details mt-2">
          <summary><span>Game Details</span><em>Rules, stats &amp; source</em></summary>
          <div className="sitem-game-details__body">{detailContent}</div>
        </details> : detailContent}

        {action ? <div className="sitem-action">{action}</div> : null}
      </div>
    </div>
  );
}

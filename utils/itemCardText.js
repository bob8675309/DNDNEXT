import { formatPlayerFacingText } from "./playerFacingText.js";

const MECHANICAL_TEXT_RE = /\b(?:action|bonus action|reaction|attack|armor class|\bac\b|advantage|disadvantage|bonus|cast|charge|condition|damage|dc\s*\d+|hit points?|immune|immunity|range|resistance|saving throw|save|speed|spell|while|when|whenever|you gain|you have|you can|requires? attunement|until|duration)\b/i;
const LABEL_BLOCK_RE = /^(Ability|Utilize|Craft|Includes|Activation|Use|Range|Duration|Recharge|Save|Saving Throw|Area|Damage|Charges?)\s*:?$/i;

const safe = (value = "") => String(value ?? "").trim();

const ITEM_PROPERTY_LABELS = Object.freeze({
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
});

function sourceDisplay(parts = [], { preferLast = false } = {}) {
  const cleanParts = parts.map((part) => safe(part)).filter((part) => part !== "");
  if (!cleanParts.length) return "";
  if (preferLast && cleanParts.length >= 3) {
    const candidate = cleanParts[cleanParts.length - 1];
    if (candidate && !/^\d+$/.test(candidate)) return candidate;
  }
  return cleanParts[0];
}

function cleanItemSourceTags(value = "") {
  return String(value ?? "")
    // A small number of upstream generic variants carry a malformed item tag
    // with a closing parenthesis instead of "}". Recover the visible label so
    // source markup can never leak onto a player card.
    .replace(/\{@item\s+([^}\n]+)\)/gi, (_, payload) => sourceDisplay(String(payload).split("|"), { preferLast: true }))
    .replace(/\{@itemProperty\s+([^}|]+)(?:\|[^|}]*)?(?:\|([^}]+))?}/gi, (_, code, display) => safe(display) || ITEM_PROPERTY_LABELS[safe(code).toUpperCase()] || safe(code))
    .replace(/\{@dc\s+([^}|]+)(?:\|[^}]*)?}/gi, (_, amount) => `DC ${safe(amount)}`)
    .replace(/\{@(?:damage|dice|hit|chance)\s+([^}|]+)(?:\|[^}]*)?}/gi, (_, amount) => safe(amount))
    .replace(/\{@quickref\s+([^}]+)}/gi, (_, payload) => sourceDisplay(String(payload).split("|"), { preferLast: true }))
    .replace(/\{@(?:variantrule|book|adventure)\s+([^}]+)}/gi, (_, payload) => sourceDisplay(String(payload).split("|"), { preferLast: true }))
    .replace(/\{@(?:spell|item|creature|condition|skill|action|status|sense|language|race|class|subclass|feat|filter|deity|hazard|card|deck|optfeature|table|link)\s+([^}]+)}/gi, (_, payload) => sourceDisplay(String(payload).split("|"), { preferLast: true }))
    .replace(/\{@(?:b|i|italic|u|note|atk|h)\s+([^}]*)}/gi, (_, payload) => safe(payload))
    .replace(/\{@[A-Za-z0-9_-]+\s+([^}]+)}/g, (_, payload) => sourceDisplay(String(payload).split("|"), { preferLast: true }))
    .replace(/\s*\[(?:Area of Effect|Attitude)\]/gi, "")
    .replace(/\.\s+and\s+(you\b)/gi, ", and $1");
}

export function formatItemCardText(value = "") {
  const withoutSharedEntries = cleanItemSourceTags(value).replace(/\{#itemEntry\s+[^}]+\}/gi, "");
  return formatPlayerFacingText(withoutSharedEntries, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const clean = (value = "") => formatItemCardText(value);

export function looksMechanicalItemText(value = "") {
  return MECHANICAL_TEXT_RE.test(clean(value));
}

export function splitItemCardParagraphs(value = "") {
  return clean(value)
    .split(/\n\s*\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function leadingItemEntryReference(value = "") {
  const source = safe(value);
  const match = source.match(/^\s*\{#itemEntry\s+([^}|]+)(?:\|[^}]*)?\}\s*/i);
  return match ? safe(match[1]) : "";
}

export function stripLeadingItemEntryReference(value = "") {
  const source = safe(value);
  return source.replace(/^\s*\{#itemEntry\s+[^}]+\}\s*/i, "").trim();
}

export function parseLabeledItemFields(value = "") {
  const blocks = splitItemCardParagraphs(value);
  const fields = [];
  const remaining = [];

  for (let index = 0; index < blocks.length;) {
    const labelMatch = blocks[index].match(LABEL_BLOCK_RE);
    if (!labelMatch) {
      remaining.push(blocks[index]);
      index += 1;
      continue;
    }

    const label = labelMatch[1].replace(/^Saving Throw$/i, "Save");
    const body = [];
    index += 1;
    while (index < blocks.length && !LABEL_BLOCK_RE.test(blocks[index])) {
      body.push(blocks[index]);
      index += 1;
    }

    const valueText = body.join(label.toLowerCase() === "includes" ? ", " : "\n");
    if (valueText) fields.push({ label, value: valueText, span: /^(Utilize|Craft|Includes)$/i.test(label) ? 2 : 1 });
  }

  return {
    fields,
    remainingText: remaining.join("\n\n"),
  };
}

function nodeText(node) {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") return clean(node);
  if (Array.isArray(node)) return node.map(nodeText).filter(Boolean).join("\n\n");
  if (typeof node !== "object") return "";

  if (node.type === "table") return "";
  if (node.type === "list") {
    return (Array.isArray(node.items) ? node.items : []).map(nodeText).filter(Boolean).join("\n");
  }

  const title = clean(node.name || "");
  const body = nodeText(node.entries ?? node.items ?? node.entry ?? "");
  return [title, body].filter(Boolean).join("\n\n");
}

function tableCellText(cell) {
  if (cell == null) return "";
  if (typeof cell === "string" || typeof cell === "number") return clean(cell);
  if (Array.isArray(cell)) return cell.map(tableCellText).filter(Boolean).join(" / ");
  if (typeof cell === "object") return nodeText(cell);
  return clean(cell);
}

export function extractItemEntryPresentation(entries) {
  const presentation = {
    paragraphs: [],
    sections: [],
    tables: [],
    lists: [],
  };

  const walk = (node) => {
    if (node == null) return;
    if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
      const value = clean(node);
      if (value) presentation.paragraphs.push(value);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== "object") return;

    if (node.type === "table" && Array.isArray(node.rows)) {
      presentation.tables.push({
        title: clean(node.caption || node.name || ""),
        columns: Array.isArray(node.colLabels) ? node.colLabels.map(tableCellText) : [],
        rows: node.rows.map((row) => (Array.isArray(row) ? row.map(tableCellText) : [tableCellText(row)])),
      });
      return;
    }

    if (node.type === "list" && Array.isArray(node.items)) {
      const items = node.items.map((item) => {
        if (item && typeof item === "object") {
          return {
            title: clean(item.name || ""),
            body: nodeText(item.entries ?? item.entry ?? item.items ?? ""),
          };
        }
        return { title: "", body: nodeText(item) };
      }).filter((item) => item.title || item.body);
      if (items.length) presentation.lists.push({ title: clean(node.name || ""), items });
      return;
    }

    if (node.name && (node.entries || node.entry || node.items)) {
      const title = clean(node.name);
      const body = nodeText(node.entries ?? node.entry ?? node.items);
      if (title && body) presentation.sections.push({ title, body });
      return;
    }

    if (node.entries) walk(node.entries);
    else if (node.items) walk(node.items);
    else if (node.entry) walk(node.entry);
  };

  walk(entries);
  return presentation;
}

function looksLikeHeading(value = "") {
  const source = safe(value).replace(/:$/, "").trim();
  if (!source || source.length > 64 || source.split(/\s+/).length > 9) return false;
  if (/[.!?;]$/.test(source)) return false;
  if (/^(?:the|this|that|these|those|you|your|when|while|if|as|a|an)\b/i.test(source)) return false;
  return /^[A-Z0-9][A-Za-z0-9'’/&()\- ]+$/.test(source);
}

export function parseNamedItemSections(value = "") {
  const blocks = splitItemCardParagraphs(value);
  if (blocks.length < 2) return null;

  const intro = [];
  const sections = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];
    if (looksLikeHeading(block) && index + 1 < blocks.length) {
      const body = [];
      const title = block.replace(/:$/, "").trim();
      index += 1;
      while (index < blocks.length && !looksLikeHeading(blocks[index])) {
        body.push(blocks[index]);
        index += 1;
      }
      if (body.length) {
        sections.push({ title, body: body.join("\n\n") });
        continue;
      }
    }

    if (!sections.length) intro.push(block);
    else sections[sections.length - 1].body += `\n\n${block}`;
    index += 1;
  }

  return sections.length ? { intro: intro.join("\n\n"), sections } : null;
}

function arrayish(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  if (typeof value === "string") {
    const source = value.trim();
    if (source.startsWith("[") && source.endsWith("]")) {
      try {
        const parsed = JSON.parse(source);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return source.split(/[,;]+/).map((part) => part.trim()).filter(Boolean);
  }
  return [value];
}

function titleWord(value = "") {
  return safe(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function canonicalItemMechanicFields(item = {}) {
  const fields = [];
  const push = (label, value, span = 1) => {
    const text = safe(value);
    if (!text || text === "—" || /^none$/i.test(text)) return;
    fields.push({ label, value: text, span });
  };

  const resist = arrayish(item.resist ?? item?.card_payload?.resist).map(titleWord);
  const immune = arrayish(item.immune ?? item?.card_payload?.immune).map(titleWord);
  const conditionImmune = arrayish(item.conditionImmune ?? item.condition_immune ?? item?.card_payload?.conditionImmune).map(titleWord);

  if (resist.length) push("Resistance", resist.map((value) => `${value} damage`).join(", "), resist.length > 2 ? 2 : 1);
  if (immune.length) push("Damage Immunity", immune.map((value) => `${value} damage`).join(", "), immune.length > 2 ? 2 : 1);
  if (conditionImmune.length) push("Condition Immunity", conditionImmune.join(", "), conditionImmune.length > 2 ? 2 : 1);

  push("Armor Class Bonus", item.bonusAc ?? item.bonus_ac ?? item?.card_payload?.bonusAc);
  push("Saving Throw Bonus", item.bonusSavingThrow ?? item.bonus_saving_throw ?? item?.card_payload?.bonusSavingThrow);
  push("Spell Attack Bonus", item.bonusSpellAttack ?? item.bonus_spell_attack ?? item?.card_payload?.bonusSpellAttack);
  push("Spell Save DC Bonus", item.bonusSpellSaveDc ?? item.bonus_spell_save_dc ?? item?.card_payload?.bonusSpellSaveDc);
  push("Proficiency Bonus", item.bonusProficiencyBonus ?? item.bonus_proficiency_bonus ?? item?.card_payload?.bonusProficiencyBonus);

  const ability = item.ability ?? item?.card_payload?.ability;
  if (ability && typeof ability === "object" && !Array.isArray(ability)) {
    const labels = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
    for (const [key, amount] of Object.entries(ability)) {
      if (!labels[key] || amount == null || amount === "") continue;
      const numeric = Number(amount);
      const display = Number.isFinite(numeric) && numeric > 0 ? `+${numeric}` : String(amount);
      push(labels[key], display);
    }
  }

  return fields;
}

function itemNameOf(item = {}) {
  return safe(item.item_name || item.name || item.display_name || item?.card_payload?.item_name);
}

function iounStoneSpecificEffect(item = {}) {
  const name = itemNameOf(item);
  const subtype = safe(name.split(",").slice(1).join(",")).toLowerCase();
  const ability = item.ability ?? item?.card_payload?.ability;
  const abilityLabels = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };

  if (ability && typeof ability === "object" && !Array.isArray(ability)) {
    const pair = Object.entries(ability)[0] || [];
    const key = pair[0];
    const amount = pair[1];
    if (abilityLabels[key] && amount != null) return `While orbiting, this stone increases your ${abilityLabels[key]} by ${amount}, to a maximum of 20.`;
  }
  if (/awareness/.test(subtype)) return "While orbiting, you have Advantage on Initiative rolls and Wisdom (Perception) checks.";
  if (/greater absorption/.test(subtype)) return "Reaction: cancel a spell of level 8 or lower cast by a creature you can see. After the stone has canceled 20 total spell levels, it burns out and loses its magic.";
  if (/absorption/.test(subtype)) return "Reaction: cancel a spell of level 4 or lower cast by a creature you can see. After the stone has canceled 20 total spell levels, it burns out and loses its magic.";
  if (/mastery/.test(subtype)) return "While orbiting, your Proficiency Bonus increases by 1.";
  if (/protection/.test(subtype)) return "While orbiting, you gain a +1 bonus to Armor Class.";
  if (/regeneration/.test(subtype)) return "At the end of each hour the stone orbits you, regain 15 Hit Points if you have at least 1 Hit Point.";
  if (/reserve/.test(subtype)) return "Stores up to 4 total spell levels. A creature can store a level 1–4 spell by touching the stone as the spell is cast; while the stone orbits you, you can cast a stored spell using the original caster's slot level, save DC, attack bonus, and spellcasting ability.";
  if (/sustenance/.test(subtype)) return "While orbiting, you don't need to eat or drink.";
  return "";
}

export function deriveReferenceOnlyEffect(item = {}, referenceName = "", { hasOwnRules = false } = {}) {
  if (hasOwnRules) return "";

  const reference = safe(referenceName).toLowerCase();
  const name = itemNameOf(item);
  const resist = arrayish(item.resist ?? item?.card_payload?.resist).map((value) => safe(value).toLowerCase()).filter(Boolean);
  const damageType = resist[0] ? titleWord(resist[0]) : "";

  if (resist.length && /^(ring|potion) of resistance$/.test(reference)) {
    return `Resistance to ${resist.join(", ")} damage.`;
  }

  if (reference === "absorbing tattoo" && damageType) {
    return `While the tattoo is on your skin, you have Resistance to ${damageType} damage. Once per dawn when you take ${damageType} damage, you can use your Reaction to become immune to that instance of damage and regain Hit Points equal to half the damage you otherwise would have taken.`;
  }

  if (reference === "dragon scale mail" && damageType) {
    return `While wearing the armor, you gain +1 Armor Class, have Advantage on saving throws against Dragon breath weapons, and have Resistance to ${damageType} damage. Once per dawn, a Magic action can reveal the distance and direction to the closest dragon within 30 miles that matches the armor's dragon type.`;
  }

  if (reference === "chromatic rose" && damageType) {
    return `While holding the rose, you have Resistance to ${damageType} damage. If one source would deal more than 10 ${damageType} damage to you after Resistance, the rose disintegrates and prevents that remaining damage. You can also destroy the rose as an action to create a 20-foot cone; creatures make a DC 15 Constitution save against 3d10 ${damageType} damage, taking half on a success.`;
  }

  if (reference === "scroll of protection") {
    const match = name.match(/\(([^)]+)\)\s*$/);
    const target = safe(match?.[1] || "the named creature type");
    return `Reading the scroll creates a moving 5-foot-radius, 10-foot-high barrier for 5 minutes that keeps ${target} creatures from entering or affecting creatures inside it. A creature of that type can use an action to make a DC 15 Charisma check to overcome the barrier.`;
  }

  if (reference === "ioun stone") {
    const specific = iounStoneSpecificEffect(item);
    const orbit = "Magic action: toss the stone into orbit 1d3 feet from your head; you can have up to three Ioun Stones orbiting at once. An orbiting stone counts as worn, avoids collisions and attempts to attack or snatch it, and can be stowed with a Utilize action.";
    return [specific, orbit].filter(Boolean).join("\n\n");
  }

  if (reference === "grenade") {
    if (/grenade launcher/i.test(name)) return "As an action, use the launcher to propel a grenade to a point up to 1,000 feet away; the grenade creates its listed effect in a 20-foot-radius Sphere.";
    return "As an action, throw the grenade to a point up to 60 feet away; it explodes there and creates its listed effect in a 20-foot-radius Sphere.";
  }

  return "";
}
export function auditItemCardText(item = {}) {
  const raw = safe(item.item_description || item.rulesText || item.rules || "");
  const cleaned = clean(raw);
  const ref = leadingItemEntryReference(raw);
  const stripped = clean(stripLeadingItemEntryReference(raw));
  const entryPresentation = extractItemEntryPresentation(item.entries);
  const named = parseNamedItemSections(stripped || cleaned);
  const labeled = parseLabeledItemFields(stripped || cleaned);
  const directFields = canonicalItemMechanicFields(item);
  const derivedReferenceEffect = deriveReferenceOnlyEffect(item, ref, { hasOwnRules: Boolean(stripped) });
  const problems = [];

  if (!cleaned && !directFields.length && !safe(item.damageText) && !safe(item.ac)) problems.push("missing-player-facing-text");
  if (raw.includes("{@") && cleaned.includes("{@")) problems.push("raw-source-tag-remains");
  if (ref && !stripped && !directFields.length && !derivedReferenceEffect) problems.push("reference-only-without-direct-mechanics");
  if (cleaned.length > 900 && !named?.sections?.length && !entryPresentation.sections.length && !entryPresentation.lists.length && !entryPresentation.tables.length && splitItemCardParagraphs(cleaned).length < 2) {
    problems.push("long-unstructured-wall");
  }

  return {
    name: safe(item.item_name || item.name),
    reference: ref,
    descriptionLength: cleaned.length,
    paragraphCount: splitItemCardParagraphs(stripped || cleaned).length,
    namedSectionCount: named?.sections?.length || 0,
    entrySectionCount: entryPresentation.sections.length,
    tableCount: entryPresentation.tables.length,
    listCount: entryPresentation.lists.length,
    labeledFieldCount: labeled.fields.length,
    directFieldCount: directFields.length,
    problems,
  };
}

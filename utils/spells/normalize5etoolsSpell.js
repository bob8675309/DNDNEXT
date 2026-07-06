const SCHOOL_NAMES = {
  A: "Abjuration",
  C: "Conjuration",
  D: "Divination",
  E: "Enchantment",
  V: "Evocation",
  I: "Illusion",
  N: "Necromancy",
  T: "Transmutation",
};

const ABILITY_NAMES = {
  strength: "Strength",
  dexterity: "Dexterity",
  constitution: "Constitution",
  intelligence: "Intelligence",
  wisdom: "Wisdom",
  charisma: "Charisma",
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export function slugifySpellName(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "spell";
}

export function spellKey(name, source) {
  return `${slugifySpellName(name)}|${String(source || "UNK").toUpperCase()}`;
}

export function clean5eText(value) {
  if (value == null) return "";
  let text = typeof value === "string" ? value : JSON.stringify(value);
  text = text.replace(/\{@(damage|dice|hit|chance) ([^}|]+)(?:\|[^}]*)?}/gi, "$2");
  text = text.replace(/\{@(spell|item|creature|condition|skill|action|sense|language|race|class|filter|book|adventure) ([^}|]+)(?:\|[^}]*)?}/gi, "$2");
  text = text.replace(/\{@(b|i|u|note|atk|h|dc) ([^}]*)}/gi, "$2");
  text = text.replace(/\{@[a-zA-Z]+ ([^}]*)}/g, "$1");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

export function flatten5eEntries(entries = []) {
  const out = [];

  function walk(node) {
    if (node == null) return;
    if (typeof node === "string") {
      out.push(clean5eText(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object") {
      if (node.name && node.entries) out.push(`${clean5eText(node.name)}.`);
      if (node.entry) walk(node.entry);
      if (node.entries) walk(node.entries);
      if (node.items) walk(node.items);
      if (node.rows) walk(node.rows);
      if (node.caption) out.push(clean5eText(node.caption));
    }
  }

  walk(entries);
  return out.filter(Boolean).join("\n\n");
}

function formatTime(time = []) {
  return (time || []).map((entry) => {
    const number = entry?.number ?? 1;
    const unit = entry?.unit || "action";
    const condition = entry?.condition ? `, ${clean5eText(entry.condition)}` : "";
    return `${number} ${unit}${number === 1 ? "" : "s"}${condition}`;
  }).join(" or ");
}

function formatRange(range = {}) {
  if (!range || typeof range !== "object") return "";
  const distance = range.distance || {};
  if (distance.type === "self") return "Self";
  if (distance.type === "touch") return "Touch";
  if (distance.type === "sight") return "Sight";
  if (distance.type === "unlimited") return "Unlimited";
  if (distance.amount != null && distance.type) return `${distance.amount} ${distance.type}`;
  return range.type || "";
}

function formatDuration(duration = []) {
  return (duration || []).map((entry) => {
    const prefix = entry?.concentration ? "Concentration, up to " : "";
    if (entry?.type === "instant") return "Instantaneous";
    if (entry?.type === "permanent") return "Until dispelled";
    if (entry?.type === "special") return "Special";
    const amount = entry?.duration?.amount;
    const type = entry?.duration?.type;
    if (amount && type) return `${prefix}${amount} ${type}${amount === 1 ? "" : "s"}`;
    return prefix + (entry?.type || "");
  }).filter(Boolean).join(" or ");
}

function formatComponents(components = {}) {
  const parts = [];
  if (components.v) parts.push("V");
  if (components.s) parts.push("S");
  if (components.m) parts.push(`M${typeof components.m === "string" ? ` (${clean5eText(components.m)})` : ""}`);
  return parts.join(", ");
}

function classesForSpell(spell = {}) {
  const classes = new Set();
  const fromClassList = spell?.classes?.fromClassList || [];
  const fromClassListVariant = spell?.classes?.fromClassListVariant || [];
  [...fromClassList, ...fromClassListVariant].forEach((entry) => {
    if (entry?.name) classes.add(entry.name);
  });
  return [...classes].sort();
}

function subclassesForSpell(spell = {}) {
  const subclasses = new Set();
  const fromSubclass = spell?.classes?.fromSubclass || [];
  fromSubclass.forEach((entry) => {
    const className = entry?.class?.name;
    const subName = entry?.subclass?.name;
    if (className && subName) subclasses.add(`${className}: ${subName}`);
    else if (subName) subclasses.add(subName);
  });
  return [...subclasses].sort();
}

function concentrationForSpell(spell = {}) {
  return Boolean((spell.duration || []).some((entry) => entry?.concentration));
}

function ritualForSpell(spell = {}) {
  return Boolean(spell?.meta?.ritual);
}

function rangeDistance(range = {}) {
  const distance = range?.distance || {};
  if (typeof distance.amount === "number") return distance.amount;
  return null;
}

function rangeUnit(range = {}) {
  return range?.distance?.type || null;
}

function primaryArea(spell = {}) {
  const range = spell.range || {};
  const distance = range.distance || {};
  if (range.type && !["point", "special"].includes(range.type)) {
    return { area_type: range.type, area_size: distance.amount || null, area_unit: distance.type || null };
  }
  return { area_type: null, area_size: null, area_unit: null };
}

function inferDice(text = "") {
  const match = String(text).match(/\b\d+d\d+(?:\s*[+-]\s*\d+)?\b/i);
  return match?.[0] || null;
}

function inferHealingDice(spell = {}, description = "") {
  if ((spell.miscTags || []).includes("HL")) return inferDice(description);
  if (/hit points?|healing|regain/i.test(description)) return inferDice(description);
  return null;
}

function inferAttackType(spell = {}) {
  const tags = spell.spellAttack || [];
  if (tags.includes("M")) return "Melee Spell Attack";
  if (tags.includes("R")) return "Ranged Spell Attack";
  if (tags.length) return "Spell Attack";
  return null;
}

function normalizeAbilities(values = []) {
  return [...new Set((values || []).map((value) => ABILITY_NAMES[String(value).toLowerCase()] || String(value)).filter(Boolean))];
}

function allTags(spell = {}) {
  return [...new Set([
    ...(spell.miscTags || []),
    ...(spell.areaTags || []),
    ...(spell.damageInflict || []),
    ...(spell.conditionInflict || []),
    ...(spell.savingThrow || []),
    ...(spell.spellAttack || []),
  ].map(String))];
}

function effectKind(spell = {}, description = "") {
  if ((spell.damageInflict || []).length) return "damage";
  if (/heal|healing|regain|hit point maximum/i.test(description)) return "healing";
  if ((spell.conditionInflict || []).length) return "condition";
  if ((spell.savingThrow || []).length) return "control";
  if (/summon|conjure/i.test(spell.name || "")) return "summon";
  if (/resistance|armor|shield|protection/i.test(description)) return "defense";
  return "utility";
}

export function normalize5etoolsSpell(spell = {}, options = {}) {
  const sourceFile = options.sourceFile || null;
  const slug = slugifySpellName(spell.name);
  const key = spellKey(spell.name, spell.source);
  const description = flatten5eEntries(spell.entries || []);
  const higherLevelText = flatten5eEntries(spell.entriesHigherLevel || []);
  const area = primaryArea(spell);
  const damageDice = spell.scalingLevelDice?.scaling ? Object.values(spell.scalingLevelDice.scaling)[0] : inferDice(description);
  const healingDice = inferHealingDice(spell, description);

  const row = {
    spell_key: key,
    slug,
    name: spell.name || "Unknown Spell",
    source: spell.source || "UNK",
    source_file: sourceFile,
    page: spell.page || null,
    level: Number.isFinite(spell.level) ? spell.level : 0,
    school_code: spell.school || null,
    school: SCHOOL_NAMES[spell.school] || spell.school || null,
    classes: classesForSpell(spell),
    subclasses: subclassesForSpell(spell),
    ritual: ritualForSpell(spell),
    concentration: concentrationForSpell(spell),
    casting_time: formatTime(spell.time || []),
    casting_time_json: spell.time || [],
    range_text: formatRange(spell.range || {}),
    range_type: spell.range?.type || null,
    range_distance: rangeDistance(spell.range || {}),
    range_unit: rangeUnit(spell.range || {}),
    range_json: spell.range || {},
    ...area,
    components_v: Boolean(spell.components?.v),
    components_s: Boolean(spell.components?.s),
    components_m: Boolean(spell.components?.m),
    material_text: typeof spell.components?.m === "string" ? clean5eText(spell.components.m) : null,
    components_json: spell.components || {},
    duration_text: formatDuration(spell.duration || []),
    duration_json: spell.duration || [],
    saving_throw_abilities: normalizeAbilities(spell.savingThrow || []),
    attack_type: inferAttackType(spell),
    damage_dice: damageDice || null,
    damage_types: spell.damageInflict || [],
    healing_dice: healingDice || null,
    scaling_text: spell.scalingLevelDice ? clean5eText(JSON.stringify(spell.scalingLevelDice)) : higherLevelText || null,
    scaling_json: spell.scalingLevelDice || {},
    description,
    higher_level_text: higherLevelText || null,
    tags: allTags(spell),
    misc_tags: spell.miscTags || [],
    area_tags: spell.areaTags || [],
    raw_payload: spell,
  };

  const effect = {
    spell_key: key,
    effect_index: 0,
    effect_kind: effectKind(spell, description),
    damage_type: (spell.damageInflict || [])[0] || null,
    dice_formula: damageDice || healingDice || null,
    save_ability: normalizeAbilities(spell.savingThrow || [])[0] || null,
    save_effect: (spell.savingThrow || []).length ? "see description" : null,
    condition: (spell.conditionInflict || [])[0] || null,
    duration_text: row.duration_text || null,
    area_type: row.area_type,
    area_size: row.area_size,
    area_unit: row.area_unit,
    targeting_text: row.range_text,
    scaling_formula: row.scaling_text,
    effect_text: description,
    tags: row.tags,
    raw_payload: spell,
  };

  return { row, effects: [effect] };
}

export { SCHOOL_NAMES };

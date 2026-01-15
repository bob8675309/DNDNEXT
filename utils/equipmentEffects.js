// Utilities for deriving display-only effects from equipped inventory rows.
//
// Goals:
// - Keep backwards compatibility with existing numeric bonus shapes.
// - Add opt-in support for advantage/disadvantage (skills/saves) without persisting into sheet JSON.
// - Detect armor/shield for AC math (Dex cap inferred from armor category).
// - Keep parsing conservative: auto-apply only explicit wearer effects ("you have Advantage/Disadvantage on …").

const ABIL_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

const ABIL_NAME_TO_KEY = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

const SKILL_NAME_TO_KEY = {
  acrobatics: "acrobatics",
  "animal handling": "animalHandling",
  arcana: "arcana",
  athletics: "athletics",
  deception: "deception",
  history: "history",
  insight: "insight",
  intimidation: "intimidation",
  investigation: "investigation",
  medicine: "medicine",
  nature: "nature",
  perception: "perception",
  performance: "performance",
  persuasion: "persuasion",
  religion: "religion",
  "sleight of hand": "sleightOfHand",
  stealth: "stealth",
  survival: "survival",
};

function safeStr(v) {
  return String(v ?? "").trim();
}

function pickNameFromRow(row) {
  const p = row?.card_payload || {};
  return safeStr(p.item_name || p.name || row?.item_name || row?.name || "");
}

function normalizeText(s) {
  return safeStr(s)
    .replace(/\s+/g, " ")
    .replace(/\u2019/g, "'")
    .trim();
}

function skillKeyFromName(name) {
  const k = normalizeText(name).toLowerCase();
  return SKILL_NAME_TO_KEY[k] || null;
}

function abilKeyFromName(name) {
  const k = normalizeText(name).toLowerCase();
  return ABIL_NAME_TO_KEY[k] || null;
}

function toPlainRulesText(p) {
  const parts = [];

  const push = (v) => {
    if (!v) return;
    if (Array.isArray(v)) {
      for (const x of v) push(x);
      return;
    }
    if (typeof v === "string") {
      const s = safeStr(v);
      if (s) parts.push(s);
      return;
    }
  };

  push(p.rulesShort);
  push(p.rules);
  push(p.item_description);
  push(p.entries);

  return parts.join("\n");
}

function getTypeCode(p) {
  const t = safeStr(p.type);
  if (!t) return "";
  // examples: "HA|XPHB", "MA|XPHB", "LA|XPHB", "S|XPHB"
  return t.split("|")[0];
}

function isShieldPayload(p, name) {
  const typeCode = getTypeCode(p);
  if (typeCode === "S") return true;
  if (safeStr(p.uiSubKind).toLowerCase() === "shield") return true;
  if (safeStr(p.uiType).toLowerCase() === "armor" && normalizeText(name).toLowerCase() === "shield") return true;
  return false;
}

function isArmorPayload(p) {
  if (p.armor === true) return true;
  const typeCode = getTypeCode(p);
  if (typeCode === "LA" || typeCode === "MA" || typeCode === "HA") return true;
  if (safeStr(p.uiType).toLowerCase() === "armor") return true;
  return false;
}

function armorCategoryFromPayload(p, name) {
  const typeCode = getTypeCode(p);
  if (typeCode === "LA") return "light";
  if (typeCode === "MA") return "medium";
  if (typeCode === "HA") return "heavy";

  // Fallback heuristics
  const n = normalizeText(name).toLowerCase();
  if (n.includes("padded") || n.includes("leather") || n.includes("studded")) return "light";
  if (n.includes("hide") || n.includes("chain shirt") || n.includes("scale") || n.includes("breastplate") || n.includes("half plate"))
    return "medium";
  if (n.includes("ring mail") || n.includes("chain mail") || n.includes("splint") || n.includes("plate")) return "heavy";

  return null;
}

function ensureEffectsShape() {
  return {
    // backwards-compatible numeric bonuses
    ac: 0,
    savesAll: 0,
    saves: {},
    skillsAll: 0,
    skills: {},

    // future-proof: ability score bonuses
    abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },

    // advantage / disadvantage (applies to wearer unless otherwise noted)
    advantage: { savesAll: false, saves: {}, skillsAll: false, skills: {} },
    disadvantage: { savesAll: false, saves: {}, skillsAll: false, skills: {} },

    // equipment info for AC math
    equipment: {
      armor: null, // { name, category, baseAc, stealthDisadvantage, strengthRequirement }
      shield: null, // { name, bonusAc }
      warnings: [],
      reminders: [],
    },
  };
}

function mergeNumericBonuses(out, p) {
  const bonusAc = Number(p.bonusAc ?? p.acBonus ?? p.bonus_ac ?? 0) || 0;
  const bonusSavingThrow = Number(p.bonusSavingThrow ?? p.saveBonus ?? p.bonus_saving_throw ?? 0) || 0;

  out.ac += bonusAc;
  out.savesAll += bonusSavingThrow;

  const mods = p.modifiers || {};

  if (mods.saves && typeof mods.saves === "object") {
    for (const k of Object.keys(mods.saves)) {
      const val = Number(mods.saves[k]) || 0;
      if (!val) continue;
      if (k === "all") out.savesAll += val;
      else out.saves[k] = (Number(out.saves[k]) || 0) + val;
    }
  }

  if (mods.checks && typeof mods.checks === "object") {
    for (const k of Object.keys(mods.checks)) {
      const val = Number(mods.checks[k]) || 0;
      if (!val) continue;
      if (k === "all") out.skillsAll += val;
      else out.skills[k] = (Number(out.skills[k]) || 0) + val;
    }
  }

  // ability score bonuses (optional)
  const abilMods = mods.abilities || mods.abilityScores || null;
  if (abilMods && typeof abilMods === "object") {
    for (const k of Object.keys(abilMods)) {
      const key = String(k).toLowerCase();
      const val = Number(abilMods[k]) || 0;
      if (!val) continue;
      if (ABIL_KEYS.includes(key)) out.abilities[key] = (Number(out.abilities[key]) || 0) + val;
    }
  }
}

function mergeStructuredAdvDis(out, p) {
  const mods = p.modifiers || {};

  const apply = (bucket, kind, key, val) => {
    if (!val) return;
    if (key === "all") bucket[kind + "All"] = true;
    else bucket[kind][key] = true;
  };

  const adv = mods.advantage || null;
  const dis = mods.disadvantage || null;

  const handle = (src, bucket) => {
    if (!src || typeof src !== "object") return;

    // saves
    if (src.saves && typeof src.saves === "object") {
      for (const k of Object.keys(src.saves)) {
        const key = String(k).toLowerCase();
        apply(bucket, "saves", key, !!src.saves[k]);
      }
    }

    // skills or checks
    const skObj = src.skills || src.checks;
    if (skObj && typeof skObj === "object") {
      for (const k of Object.keys(skObj)) {
        const raw = String(k);
        const key = raw === "all" ? "all" : skillKeyFromName(raw) || raw;
        apply(bucket, "skills", key.toLowerCase(), !!skObj[k]);
      }
    }
  };

  handle(adv, out.advantage);
  handle(dis, out.disadvantage);
}

function extractWearerSkillAdvDis(text, out, mode) {
  // mode: "advantage" | "disadvantage"
  const word = mode === "advantage" ? "Advantage" : "Disadvantage";

  // Explicit wearer phrasing only: "you have Advantage ... {@skill X|...}"
  const re = new RegExp(`you have[^.]{0,160}?${word}[^.]{0,160}?\\{@skill\\s+([^|}]+)\\|`, "gi");
  let m;
  while ((m = re.exec(text))) {
    const skillName = m[1];
    const key = skillKeyFromName(skillName);
    if (!key) continue;
    out[mode].skills[key] = true;
  }

  // "you have Advantage on ... checks" (no tag) – conservative: match known skill names
  const plain = normalizeText(text).toLowerCase();
  const plainRe = new RegExp(`you have[^.]{0,160}?${word.toLowerCase()}[^.]{0,160}?on[^.]{0,160}?([a-z ]+) checks`, "i");
  const pm = plainRe.exec(plain);
  if (pm && pm[1]) {
    const seg = pm[1];
    for (const skillName of Object.keys(SKILL_NAME_TO_KEY)) {
      if (seg.includes(skillName)) {
        const key = SKILL_NAME_TO_KEY[skillName];
        out[mode].skills[key] = true;
      }
    }
  }
}

function extractWearerSaveAdvDis(text, out, mode) {
  const word = mode === "advantage" ? "Advantage" : "Disadvantage";
  const plain = normalizeText(text);

  // "you have Advantage on saving throws"
  const allRe = new RegExp(`you have[^.]{0,160}?${word}[^.]{0,160}?on saving throws`, "i");
  if (allRe.test(plain)) out[mode].savesAll = true;

  // "you have Advantage on Dexterity saving throws"
  const abilRe = new RegExp(
    `you have[^.]{0,160}?${word}[^.]{0,160}?on (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throws`,
    "gi"
  );
  let m;
  while ((m = abilRe.exec(plain))) {
    const k = abilKeyFromName(m[1]);
    if (!k) continue;
    out[mode].saves[k] = true;
  }
}

function extractReminderAgainstYou(text, reminders) {
  // Example (Cloak of Elvenkind): "Wisdom (Perception) checks made to perceive you have Disadvantage"
  // This affects others, not the wearer. Surface as reminder, do not apply.
  const t = text || "";
  const re = /\{@skill\s+([^|}]+)\|[^}]*\}[^.]{0,120}?checks[^.]{0,120}?perceive you[^.]{0,120}?(Advantage|Disadvantage)/gi;
  let m;
  while ((m = re.exec(t))) {
    const skillName = m[1];
    const advWord = m[2];
    const key = skillKeyFromName(skillName);
    const label = key ? skillName : "a";
    const phr = `Creatures have ${advWord} on ${skillName} checks to perceive you.`;
    reminders.push(phr);
  }

  // Conditional save text e.g. "Advantage on saving throws against poison" -> reminder
  const condSave = /(Advantage|Disadvantage)[^.]{0,80}?saving throws[^.]{0,120}?against\s+[^.]+/gi;
  while ((m = condSave.exec(t))) {
    const phrase = normalizeText(m[0]);
    if (phrase) reminders.push(phrase);
  }
}

function itemEffectPartsForBreakdown(p, name) {
  const parts = [];

  const bonusAc = Number(p.bonusAc ?? p.acBonus ?? p.bonus_ac ?? 0) || 0;
  const bonusSavingThrow = Number(p.bonusSavingThrow ?? p.saveBonus ?? p.bonus_saving_throw ?? 0) || 0;
  if (bonusAc) parts.push(`${bonusAc >= 0 ? "+" : ""}${bonusAc} AC`);
  if (bonusSavingThrow) parts.push(`${bonusSavingThrow >= 0 ? "+" : ""}${bonusSavingThrow} all saves`);

  const mods = p.modifiers || {};
  if (mods.saves && typeof mods.saves === "object") {
    for (const k of Object.keys(mods.saves)) {
      const val = Number(mods.saves[k]) || 0;
      if (!val) continue;
      if (k === "all") parts.push(`${val >= 0 ? "+" : ""}${val} all saves`);
      else parts.push(`${val >= 0 ? "+" : ""}${val} ${String(k).toUpperCase()} saves`);
    }
  }

  if (mods.checks && typeof mods.checks === "object") {
    for (const k of Object.keys(mods.checks)) {
      const val = Number(mods.checks[k]) || 0;
      if (!val) continue;
      if (k === "all") parts.push(`${val >= 0 ? "+" : ""}${val} all checks`);
      else parts.push(`${val >= 0 ? "+" : ""}${val} ${k} checks`);
    }
  }

  const abilMods = mods.abilities || mods.abilityScores || null;
  if (abilMods && typeof abilMods === "object") {
    for (const k of Object.keys(abilMods)) {
      const key = String(k).toLowerCase();
      const val = Number(abilMods[k]) || 0;
      if (!val) continue;
      if (ABIL_KEYS.includes(key)) parts.push(`${val >= 0 ? "+" : ""}${val} ${key.toUpperCase()}`);
    }
  }

  const reminders = [];
  const text = toPlainRulesText(p);
  extractReminderAgainstYou(text, reminders);

  // Wearer advantage/disadvantage (explicit only)
  const tmp = ensureEffectsShape();
  extractWearerSkillAdvDis(text, tmp, "advantage");
  extractWearerSkillAdvDis(text, tmp, "disadvantage");
  extractWearerSaveAdvDis(text, tmp, "advantage");
  extractWearerSaveAdvDis(text, tmp, "disadvantage");

  const skAdv = Object.keys(tmp.advantage.skills || {});
  const skDis = Object.keys(tmp.disadvantage.skills || {});
  const svAdv = Object.keys(tmp.advantage.saves || {});
  const svDis = Object.keys(tmp.disadvantage.saves || {});

  if (tmp.advantage.savesAll) parts.push("Advantage on all saves");
  for (const k of svAdv) parts.push(`Advantage on ${k.toUpperCase()} saves`);
  if (tmp.disadvantage.savesAll) parts.push("Disadvantage on all saves");
  for (const k of svDis) parts.push(`Disadvantage on ${k.toUpperCase()} saves`);

  for (const k of skAdv) parts.push(`Advantage on ${k} checks`);
  for (const k of skDis) parts.push(`Disadvantage on ${k} checks`);

  // Armor stealth disadvantage (wearer)
  if (isArmorPayload(p) && !isShieldPayload(p, name) && p.stealth === true) {
    parts.push("Disadvantage on Stealth checks (armor)");
  }

  for (const r of reminders) parts.push(`Reminder: ${r}`);

  return parts;
}

export function deriveEquippedItemEffects(rows) {
  const out = ensureEffectsShape();
  const breakdown = [];

  const armors = [];
  const shields = [];

  for (const row of rows || []) {
    const p = row?.card_payload || {};
    const name = pickNameFromRow(row) || "Unnamed item";

    // numeric bonuses + structured adv/dis
    mergeNumericBonuses(out, p);
    mergeStructuredAdvDis(out, p);

    // text-derived (conservative)
    const txt = toPlainRulesText(p);
    if (txt) {
      extractWearerSkillAdvDis(txt, out, "advantage");
      extractWearerSkillAdvDis(txt, out, "disadvantage");
      extractWearerSaveAdvDis(txt, out, "advantage");
      extractWearerSaveAdvDis(txt, out, "disadvantage");

      extractReminderAgainstYou(txt, out.equipment.reminders);
    }

    // armor/shield detection
    if (isArmorPayload(p)) {
      if (isShieldPayload(p, name)) {
        shields.push({
          name,
          bonusAc: Number(p.ac ?? p.bonusAc ?? 0) || 0,
          row,
        });
      } else {
        armors.push({
          name,
          category: armorCategoryFromPayload(p, name),
          baseAc: Number(p.ac ?? 0) || 0,
          stealthDisadvantage: p.stealth === true,
          strengthRequirement: p.strength ?? p.str ?? null,
          row,
        });

        // armor stealth disadvantage applies to wearer
        if (p.stealth === true) out.disadvantage.skills.stealth = true;
      }
    }

    // breakdown line
    const parts = itemEffectPartsForBreakdown(p, name);
    if (parts.length) breakdown.push(`${name}: ${parts.join(", ")}`);
  }

  // pick best armor/shield deterministically
  if (armors.length > 1) out.equipment.warnings.push("Multiple armors are equipped. Using the highest base AC for math.");
  if (shields.length > 1) out.equipment.warnings.push("Multiple shields are equipped. Using the highest shield bonus for math.");

  const bestArmor = armors.sort((a, b) => (b.baseAc || 0) - (a.baseAc || 0))[0] || null;
  const bestShield = shields.sort((a, b) => (b.bonusAc || 0) - (a.bonusAc || 0))[0] || null;

  if (bestArmor) {
    out.equipment.armor = {
      name: bestArmor.name,
      category: bestArmor.category,
      baseAc: bestArmor.baseAc,
      stealthDisadvantage: !!bestArmor.stealthDisadvantage,
      strengthRequirement: bestArmor.strengthRequirement,
    };
  }

  if (bestShield) {
    out.equipment.shield = {
      name: bestShield.name,
      bonusAc: bestShield.bonusAc,
    };
  }

  // normalize keys: ensure skills/saves keys are lowercase
  const normObjKeys = (obj) => {
    const outObj = {};
    for (const k of Object.keys(obj || {})) outObj[String(k).toLowerCase()] = obj[k];
    return outObj;
  };

  out.saves = normObjKeys(out.saves);
  out.skills = normObjKeys(out.skills);
  out.advantage.saves = normObjKeys(out.advantage.saves);
  out.advantage.skills = normObjKeys(out.advantage.skills);
  out.disadvantage.saves = normObjKeys(out.disadvantage.saves);
  out.disadvantage.skills = normObjKeys(out.disadvantage.skills);

  return { effects: out, breakdown };
}

export function hashEquippedRowsForKey(rows) {
  const ids = (rows || []).map((r) => String(r?.id || "").trim()).filter(Boolean).sort();
  return ids.join(",");
}

// /components/CharacterSheet5e.js
// Simplified character sheet for DnD 5e. Supports abilities, saving throws, skills, AC computation and equipped items.

import { useState } from "react";

// Map skills to their associated abilities
const SKILL_TO_ABILITY = {
  Acrobatics: "dex",
  "Animal Handling": "wis",
  Arcana: "int",
  Athletics: "str",
  Deception: "cha",
  History: "int",
  Insight: "wis",
  Intimidation: "cha",
  Investigation: "int",
  Medicine: "wis",
  Nature: "int",
  Perception: "wis",
  Performance: "cha",
  Persuasion: "cha",
  Religion: "int",
  "Sleight of Hand": "dex",
  Stealth: "dex",
  Survival: "wis",
};

const ABILITIES = [
  { key: "str", name: "Strength" },
  { key: "dex", name: "Dexterity" },
  { key: "con", name: "Constitution" },
  { key: "int", name: "Intelligence" },
  { key: "wis", name: "Wisdom" },
  { key: "cha", name: "Charisma" },
];

// Compute ability modifier from score
function abilityMod(score) {
  const s = Number(score || 10);
  return Math.floor((s - 10) / 2);
}

// Parse numeric bonus values from strings/numbers
function parseBonus(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const m = v.match(/-?\d+/);
    return m ? parseInt(m[0], 10) : 0;
  }
  return 0;
}

// Aggregate bonuses from equipped items
function computeEquippedBonuses(equippedItems) {
  const out = {
    ac: 0,
    savesAll: 0,
    checksAll: 0,
    saves: {},
    skills: {},
  };
  for (const row of equippedItems || []) {
    const p = row.card_payload || row;
    out.ac += parseBonus(p.bonusAc);
    out.savesAll += parseBonus(p.bonusSavingThrow);
    out.checksAll += parseBonus(p.bonusAbilityCheck);
    if (p.modifiers) {
      const m = p.modifiers;
      if (m.ac) out.ac += parseBonus(m.ac);
      if (m.saves && m.saves.all) out.savesAll += parseBonus(m.saves.all);
      if (m.checks && m.checks.all) out.checksAll += parseBonus(m.checks.all);
      if (m.saves) {
        for (const k of Object.keys(m.saves)) {
          if (k === "all") continue;
          out.saves[k] = (out.saves[k] || 0) + parseBonus(m.saves[k]);
        }
      }
      if (m.skills) {
        for (const k of Object.keys(m.skills)) {
          out.skills[k] = (out.skills[k] || 0) + parseBonus(m.skills[k]);
        }
      }
    }
  }
  return out;
}

// Determine if an item is a shield
function isShield(p) {
  const t = (p.uiType || p.type || "").toLowerCase();
  const sk = (p.uiSubKind || "").toLowerCase();
  const nm = (p.name || "").toLowerCase();
  return t.includes("shield") || sk.includes("shield") || nm.includes("shield");
}

// Determine if an item is armor
function isArmor(p) {
  const t = (p.uiType || p.type || "").toLowerCase();
  const sk = (p.uiSubKind || "").toLowerCase();
  return t.includes("armor") || sk.includes("armor");
}

// Compute AC from abilities and equipped items
function computeAC(sheet, equippedItems, bonuses) {
  const dexScore = Number(sheet?.abilities?.dex?.score || 10);
  const dexMod = abilityMod(dexScore);
  const items = (equippedItems || []).map((r) => r.card_payload || r);
  const armor = items.find((p) => isArmor(p));
  const shield = items.find((p) => isShield(p));
  let ac = 10 + dexMod;
  if (armor) {
    // Determine base AC: use p.ac or p.armor.ac
    let base = parseBonus(armor.ac ?? armor.armor?.ac);
    if (!base || isNaN(base)) base = 10;
    // Determine dex part: heavy/medium armor restricts
    const name = (armor.name || "").toLowerCase();
    const heavy = ["plate", "chain mail", "ring mail", "splint"].some((x) => name.includes(x));
    const medium = ["breastplate", "half plate", "scale mail", "chain shirt", "hide"].some((x) => name.includes(x));
    const dexPart = heavy ? 0 : medium ? Math.min(2, dexMod) : dexMod;
    ac = base + dexPart;
  }
  if (shield) {
    let shieldVal = parseBonus(shield.ac ?? shield.armor?.ac);
    if (!shieldVal) shieldVal = 2;
    ac += shieldVal;
  }
  // Add magic bonuses
  ac += bonuses.ac;
  return ac;
}

export default function CharacterSheet5e({ sheet = {}, onChange, editMode = false, onRoll, equippedItems = [], inventoryLinkBase = "" }) {
  // Track AC override (not persisted)
  const [acOverride, setAcOverride] = useState(null);
  const [acEditing, setAcEditing] = useState(false);
  const bonuses = computeEquippedBonuses(equippedItems);
  const pb = Number(sheet.proficiencyBonus || 2);

  // Get ability score; default to 10
  function getAbilityScore(key) {
    return Number(sheet?.abilities?.[key]?.score || 10);
  }

  // Update ability score (only in edit mode)
  function setAbilityScore(key, val) {
    if (!editMode) return;
    onChange((prev) => {
      const next = { ...(prev || {}) };
      next.abilities = { ...(next.abilities || {}) };
      next.abilities[key] = { ...(next.abilities[key] || {}), score: Number(val) };
      return next;
    });
  }

  // Get saving throw proficiency status (0=off,1=proficient)
  function getSaveProf(key) {
    return sheet?.proficiencies?.saves?.[key]?.proficient ? 1 : 0;
  }

  function toggleSaveProf(key) {
    if (!editMode) return;
    onChange((prev) => {
      const next = { ...(prev || {}) };
      if (!next.proficiencies) next.proficiencies = {};
      if (!next.proficiencies.saves) next.proficiencies.saves = {};
      const curr = next.proficiencies.saves[key]?.proficient ? true : false;
      next.proficiencies.saves[key] = { proficient: !curr };
      return next;
    });
  }

  // Get skill proficiency status (0=off,1=proficient,2=expertise)
  function getSkillProf(skill) {
    const obj = sheet?.proficiencies?.skills?.[skill] || {};
    if (obj.expertise) return 2;
    return obj.proficient ? 1 : 0;
  }

  function cycleSkillProf(skill) {
    if (!editMode) return;
    onChange((prev) => {
      const next = { ...(prev || {}) };
      if (!next.proficiencies) next.proficiencies = {};
      if (!next.proficiencies.skills) next.proficiencies.skills = {};
      const curr = getSkillProf(skill);
      let newProf = 0;
      if (curr === 0) newProf = 1;
      else if (curr === 1) newProf = 2;
      else newProf = 0;
      if (newProf === 0) next.proficiencies.skills[skill] = { proficient: false, expertise: false };
      else if (newProf === 1) next.proficiencies.skills[skill] = { proficient: true, expertise: false };
      else next.proficiencies.skills[skill] = { proficient: true, expertise: true };
      return next;
    });
  }

  // Handle roll for a save or skill
  function roll(label, totalMod) {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const result = d20 + totalMod;
    onRoll({ label, roll: d20, mod: totalMod, total: result });
  }

  // Compute AC
  const computedAc = computeAC(sheet, equippedItems, bonuses);
  const acShown = acOverride != null ? acOverride : computedAc;

  return (
    <div className="csheet-body">
      {/* Top: Proficiency bonus and passive perception */}
      <div className="d-flex gap-3 mb-3 flex-wrap align-items-center">
        <div>
          <span className="fw-semibold">PB</span>: {pb >= 0 && "+"}{pb}
        </div>
        <div>
          <span className="fw-semibold">Passive Perception</span>: {10 + abilityMod(getAbilityScore("wis")) + pb}
        </div>
        {editMode && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary ms-auto"
            onClick={() => {
              // Roll 4d6 drop lowest for each ability
              const roll4d6 = () => {
                const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
                rolls.sort((a, b) => a - b);
                return rolls.slice(1).reduce((a, b) => a + b, 0);
              };
              const abilities = {};
              for (const { key } of ABILITIES) abilities[key] = { score: roll4d6() };
              onChange((prev) => ({ ...prev, abilities }));
            }}
          >
            Roll Stats (4d6 drop low)
          </button>
        )}
      </div>

      {/* Abilities */}
      <div className="row row-cols-3 row-cols-md-6 g-2 mb-3">
        {ABILITIES.map(({ key, name }) => {
          const score = getAbilityScore(key);
          const mod = abilityMod(score);
          return (
            <div key={key} className="col text-center">
              <div className="border rounded p-2">
                <div className="small text-uppercase fw-bold">{name}</div>
                {editMode ? (
                  <input
                    type="number"
                    className="form-control form-control-sm text-center mt-1"
                    value={score}
                    onChange={(e) => setAbilityScore(key, e.target.value)}
                  />
                ) : (
                  <div className="h5 mb-0">{score}</div>
                )}
                <div className="small text-muted">{mod >= 0 ? "+" : ""}{mod}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Saving throws */}
      <div className="mb-3">
        <div className="fw-semibold mb-1">Saving Throws</div>
        {ABILITIES.map(({ key, name }) => {
          const base = abilityMod(getAbilityScore(key));
          const prof = getSaveProf(key) ? pb : 0;
          const itemBonus = bonuses.savesAll + (bonuses.saves[key] || 0);
          const total = base + prof + itemBonus;
          return (
            <div key={key} className="d-flex align-items-center mb-1">
              <input
                type="checkbox"
                className="form-check-input me-2"
                checked={!!getSaveProf(key)}
                onChange={() => toggleSaveProf(key)}
                disabled={!editMode}
              />
              <button
                type="button"
                className="btn btn-sm btn-dark flex-grow-1 d-flex justify-content-between align-items-center"
                onClick={() => roll(name + " Save", total)}
              >
                <span>{name}</span>
                <span>{total >= 0 ? "+" : ""}{total}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Skills */}
      <div className="mb-3">
        <div className="fw-semibold mb-1">Skills</div>
        {Object.keys(SKILL_TO_ABILITY).map((skill) => {
          const abilKey = SKILL_TO_ABILITY[skill];
          const base = abilityMod(getAbilityScore(abilKey));
          const profState = getSkillProf(skill);
          const profMod = profState === 0 ? 0 : profState === 1 ? pb : pb * 2;
          const itemBonus = bonuses.checksAll + (bonuses.skills[skill] || 0);
          const total = base + profMod + itemBonus;
          return (
            <div key={skill} className="d-flex align-items-center mb-1">
              <input
                type="checkbox"
                className="form-check-input me-1"
                checked={profState > 0}
                onChange={() => cycleSkillProf(skill)}
                disabled={!editMode}
                title={profState === 2 ? "Expertise" : profState === 1 ? "Proficient" : "Not proficient"}
              />
              {editMode && profState > 0 && (
                <span
                  className="badge bg-info me-1"
                  style={{ cursor: "pointer" }}
                  onClick={() => cycleSkillProf(skill)}
                >
                  {profState === 1 ? "P" : "E"}
                </span>
              )}
              <button
                type="button"
                className="btn btn-sm btn-dark flex-grow-1 d-flex justify-content-between align-items-center"
                onClick={() => roll(skill, total)}
              >
                <span>{skill}</span>
                <span>{total >= 0 ? "+" : ""}{total}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Combat section: AC display */}
      <div className="mb-3">
        <div className="fw-semibold mb-1">Combat</div>
        <div className="d-flex align-items-center gap-2 mb-2">
          <div className="flex-grow-1">
            <div className="small text-uppercase fw-bold">AC</div>
            {!acEditing ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-light w-100"
                onClick={() => setAcEditing(true)}
                title="Click to temporarily override"
              >
                {acShown}
              </button>
            ) : (
              <input
                type="number"
                className="form-control form-control-sm"
                value={acOverride ?? computedAc}
                onChange={(e) => setAcOverride(parseInt(e.target.value || "0", 10))}
                onBlur={() => setAcEditing(false)}
              />
            )}
            <div className="small text-muted">(Base {computedAc})</div>
          </div>
          <div>
            <div className="small text-uppercase fw-bold">Initiative</div>
            <div>{abilityMod(getAbilityScore("dex"))}</div>
          </div>
          <div>
            <div className="small text-uppercase fw-bold">Speed</div>
            <div>{sheet.speed || "—"}</div>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <div className="flex-grow-1">
            <div className="small text-uppercase fw-bold">HP (Max / Current / Temp)</div>
            <div>
              {sheet.maxHp || "—"} / {sheet.hp || "—"} / {sheet.tempHp || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Equipment list (equipped only) */}
      <div className="mb-3">
        <div className="fw-semibold mb-1">Equipment</div>
        {(equippedItems || []).length === 0 ? (
          <div className="text-muted">—</div>
        ) : (
          <ul className="list-unstyled">
            {(equippedItems || []).map((row) => {
              const p = row.card_payload || row;
              const name = p.name || "Item";
              const href = inventoryLinkBase
                ? `${inventoryLinkBase}&focus=${encodeURIComponent(row.id)}`
                : "/inventory";
              return (
                <li key={row.id}>
                  <a href={href}>{name}</a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
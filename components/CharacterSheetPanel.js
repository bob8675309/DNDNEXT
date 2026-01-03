// components/CharacterSheetPanel.js
import { useEffect, useMemo, useState } from "react";

const ABILITIES = [
  { id: "str", name: "Strength", abbr: "STR" },
  { id: "dex", name: "Dexterity", abbr: "DEX" },
  { id: "con", name: "Constitution", abbr: "CON" },
  { id: "int", name: "Intelligence", abbr: "INT" },
  { id: "wis", name: "Wisdom", abbr: "WIS" },
  { id: "cha", name: "Charisma", abbr: "CHA" },
];

const SKILLS = [
  { id: "acrobatics", name: "Acrobatics", ability: "dex" },
  { id: "animal_handling", name: "Animal Handling", ability: "wis" },
  { id: "arcana", name: "Arcana", ability: "int" },
  { id: "athletics", name: "Athletics", ability: "str" },
  { id: "deception", name: "Deception", ability: "cha" },
  { id: "history", name: "History", ability: "int" },
  { id: "insight", name: "Insight", ability: "wis" },
  { id: "intimidation", name: "Intimidation", ability: "cha" },
  { id: "investigation", name: "Investigation", ability: "int" },
  { id: "medicine", name: "Medicine", ability: "wis" },
  { id: "nature", name: "Nature", ability: "int" },
  { id: "perception", name: "Perception", ability: "wis" },
  { id: "performance", name: "Performance", ability: "cha" },
  { id: "persuasion", name: "Persuasion", ability: "cha" },
  { id: "religion", name: "Religion", ability: "int" },
  { id: "sleight_of_hand", name: "Sleight of Hand", ability: "dex" },
  { id: "stealth", name: "Stealth", ability: "dex" },
  { id: "survival", name: "Survival", ability: "wis" },
];

function deepClone(v) {
  // structuredClone is great, but this works everywhere you’re deploying
  try {
    return structuredClone(v);
  } catch {
    return JSON.parse(JSON.stringify(v ?? {}));
  }
}

function clampScore(n) {
  const x = Number.isFinite(Number(n)) ? Number(n) : 10;
  return Math.max(1, Math.min(30, Math.round(x)));
}

function modFromScore(score) {
  const s = clampScore(score);
  return Math.floor((s - 10) / 2);
}

function fmtMod(n) {
  const x = Number(n) || 0;
  return x >= 0 ? `+${x}` : `${x}`;
}

function d(sides) {
  return 1 + Math.floor(Math.random() * sides);
}

function roll4d6DropLowest() {
  const dice = [d(6), d(6), d(6), d(6)].sort((a, b) => a - b);
  return dice[1] + dice[2] + dice[3];
}

function getScore(sheet, abilityId) {
  return clampScore(sheet?.abilities?.[abilityId]?.score ?? 10);
}

function setScore(sheet, abilityId, score) {
  if (!sheet.abilities) sheet.abilities = {};
  if (!sheet.abilities[abilityId]) sheet.abilities[abilityId] = {};
  sheet.abilities[abilityId].score = clampScore(score);
}

function getPB(sheet) {
  const pb = Number(sheet?.proficiencyBonus);
  return Number.isFinite(pb) ? pb : 2;
}

function isProf(sheet, kind, id) {
  return !!sheet?.proficiencies?.[kind]?.[id]?.proficient;
}

function toggleProf(sheet, kind, id) {
  if (!sheet.proficiencies) sheet.proficiencies = {};
  if (!sheet.proficiencies[kind]) sheet.proficiencies[kind] = {};
  if (!sheet.proficiencies[kind][id]) sheet.proficiencies[kind][id] = {};
  const cur = !!sheet.proficiencies[kind][id].proficient;
  sheet.proficiencies[kind][id].proficient = !cur;
}

function isExpert(sheet, skillId) {
  return !!sheet?.proficiencies?.skills?.[skillId]?.expertise;
}

export default function CharacterSheetPanel({
  sheet,
  characterName = "Character",
  editable = false,
  onRoll,
  onSave, // async (nextSheet) => boolean
}) {
  const [draft, setDraft] = useState(() => deepClone(sheet || {}));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(deepClone(sheet || {}));
    setDirty(false);
  }, [sheet]);

  const pb = useMemo(() => getPB(draft), [draft]);

  const abilityMods = useMemo(() => {
    const m = {};
    for (const a of ABILITIES) {
      m[a.id] = modFromScore(getScore(draft, a.id));
    }
    return m;
  }, [draft]);

  const skillBonus = useMemo(() => {
    const m = {};
    for (const s of SKILLS) {
      const base = abilityMods[s.ability] ?? 0;
      const prof = isProf(draft, "skills", s.id) ? pb : 0;
      const exp = isExpert(draft, s.id) ? pb : 0;
      m[s.id] = base + prof + exp;
    }
    return m;
  }, [draft, abilityMods, pb]);

  const passivePerception = 10 + (skillBonus.perception ?? 0);

  function mutate(fn) {
    setDraft((prev) => {
      const next = deepClone(prev || {});
      fn(next);
      return next;
    });
    setDirty(true);
  }

  function emitRoll(label, mod) {
    const roll = d(20);
    const total = roll + (Number(mod) || 0);
    onRoll?.({ label, roll, mod: Number(mod) || 0, total });
  }

  function rollAbility(abilityId) {
    const a = ABILITIES.find((x) => x.id === abilityId);
    emitRoll(`${a?.name || abilityId} check`, abilityMods[abilityId] ?? 0);
  }

  function rollSave(abilityId) {
    const a = ABILITIES.find((x) => x.id === abilityId);
    const mod = (abilityMods[abilityId] ?? 0) + (isProf(draft, "saves", abilityId) ? pb : 0);
    emitRoll(`${a?.name || abilityId} save`, mod);
  }

  function rollSkill(skillId) {
    const s = SKILLS.find((x) => x.id === skillId);
    emitRoll(`${s?.name || skillId} (${(s?.ability || "").toUpperCase()})`, skillBonus[skillId] ?? 0);
  }

  async function handleSave() {
    if (!editable || !onSave) return;
    setSaving(true);
    try {
      const ok = await onSave(draft);
      if (ok !== false) setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  function handleRollStats() {
    if (!editable) return;
    const rolls = Array.from({ length: 6 }, () => roll4d6DropLowest());
    mutate((s) => {
      for (let i = 0; i < ABILITIES.length; i++) {
        setScore(s, ABILITIES[i].id, rolls[i]);
      }
      // default PB if missing
      if (s.proficiencyBonus == null) s.proficiencyBonus = 2;
    });
  }

  return (
    <div className="csheet">
      <div className="csheet-head">
        <div className="csheet-headLeft">
          <div className="csheet-name">{characterName}</div>
          <div className="csheet-sub">
            PB {fmtMod(pb)} • Passive Perception <span className="csheet-bright">{passivePerception}</span>
          </div>
        </div>

        <div className="csheet-headRight">
          {editable && (
            <button type="button" className="csheet-btn csheet-btnGhost" onClick={handleRollStats}>
              Roll stats (4d6 drop low)
            </button>
          )}
          {editable && (
            <button
              type="button"
              className="csheet-btn csheet-btnPrimary"
              onClick={handleSave}
              disabled={!dirty || saving}
              title={!dirty ? "No changes to save" : "Save sheet"}
            >
              {saving ? "Saving..." : "Save sheet"}
            </button>
          )}
        </div>
      </div>

      <div className="csheet-body">
        {/* LEFT COLUMN */}
        <div className="csheet-left">
          <div className="csheet-abilities">
            {ABILITIES.map((a) => {
              const score = getScore(draft, a.id);
              const mod = abilityMods[a.id] ?? 0;

              return (
                <div key={a.id} className="csheet-abilityRow">
                  <button
                    type="button"
                    className="csheet-abilityBtn"
                    onClick={() => rollAbility(a.id)}
                    title={`Roll: d20 ${fmtMod(mod)}`}
                  >
                    <div className="csheet-abilityAbbr">{a.abbr}</div>
                    <div className="csheet-abilityNums">
                      <div className="csheet-abilityScore">{score}</div>
                      <div className="csheet-abilityMod">{fmtMod(mod)}</div>
                    </div>
                  </button>

                  {editable ? (
                    <input
                      className="csheet-scoreInput"
                      type="number"
                      value={score}
                      onChange={(e) => mutate((s) => setScore(s, a.id, e.target.value))}
                      onClick={(e) => e.stopPropagation()}
                      min={1}
                      max={30}
                    />
                  ) : (
                    <div className="csheet-scorePill">{score}</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="csheet-card">
            <div className="csheet-cardTitle">Saving Throws</div>
            <div className="csheet-saves">
              {ABILITIES.map((a) => {
                const base = abilityMods[a.id] ?? 0;
                const prof = isProf(draft, "saves", a.id);
                const total = base + (prof ? pb : 0);

                return (
                  <div key={a.id} className="csheet-saveRow">
                    <label className="csheet-check">
                      <input
                        type="checkbox"
                        checked={prof}
                        disabled={!editable}
                        onChange={() => mutate((s) => toggleProf(s, "saves", a.id))}
                      />
                      <span>{a.name}</span>
                    </label>

                    <button
                      type="button"
                      className="csheet-miniRoll"
                      onClick={() => rollSave(a.id)}
                      title={`Roll: d20 ${fmtMod(total)}`}
                    >
                      {fmtMod(total)}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="csheet-right">
          <div className="csheet-card">
            <div className="csheet-cardTitle">Skills</div>
            <div className="csheet-skills">
              {SKILLS.map((s) => {
                const prof = isProf(draft, "skills", s.id);
                const bonus = skillBonus[s.id] ?? 0;

                return (
                  <div key={s.id} className="csheet-skillRow">
                    <label className="csheet-check">
                      <input
                        type="checkbox"
                        checked={prof}
                        disabled={!editable}
                        onChange={() => mutate((x) => toggleProf(x, "skills", s.id))}
                      />
                      <span className="csheet-skillName">
                        {s.name} <span className="csheet-dim">({s.ability.toUpperCase()})</span>
                      </span>
                    </label>

                    <button
                      type="button"
                      className="csheet-skillBtn"
                      onClick={() => rollSkill(s.id)}
                      title={`Roll: d20 ${fmtMod(bonus)}`}
                    >
                      {fmtMod(bonus)}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="csheet-footnote">
              Click a skill/save/ability to roll <span className="csheet-dim">(d20 + mod + PB if proficient)</span>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

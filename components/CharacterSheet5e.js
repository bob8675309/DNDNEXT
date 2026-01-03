// components/CharacterSheet5e.js
import { useMemo } from "react";

const ABILITIES = [
  { key: "str", name: "Strength" },
  { key: "dex", name: "Dexterity" },
  { key: "con", name: "Constitution" },
  { key: "int", name: "Intelligence" },
  { key: "wis", name: "Wisdom" },
  { key: "cha", name: "Charisma" },
];

const SKILLS = [
  { key: "acrobatics", name: "Acrobatics", ability: "dex" },
  { key: "animalHandling", name: "Animal Handling", ability: "wis" },
  { key: "arcana", name: "Arcana", ability: "int" },
  { key: "athletics", name: "Athletics", ability: "str" },
  { key: "deception", name: "Deception", ability: "cha" },
  { key: "history", name: "History", ability: "int" },
  { key: "insight", name: "Insight", ability: "wis" },
  { key: "intimidation", name: "Intimidation", ability: "cha" },
  { key: "investigation", name: "Investigation", ability: "int" },
  { key: "medicine", name: "Medicine", ability: "wis" },
  { key: "nature", name: "Nature", ability: "int" },
  { key: "perception", name: "Perception", ability: "wis" },
  { key: "performance", name: "Performance", ability: "cha" },
  { key: "persuasion", name: "Persuasion", ability: "cha" },
  { key: "religion", name: "Religion", ability: "int" },
  { key: "sleightOfHand", name: "Sleight of Hand", ability: "dex" },
  { key: "stealth", name: "Stealth", ability: "dex" },
  { key: "survival", name: "Survival", ability: "wis" },
];

function clampScore(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 10;
  return Math.max(1, Math.min(30, Math.round(v)));
}

function modFromScore(score) {
  return Math.floor((Number(score) - 10) / 2);
}

function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function fmtMod(n) {
  const v = Number(n) || 0;
  return v >= 0 ? `+${v}` : `${v}`;
}

function ensureSheetShape(sheet) {
  const s = sheet || {};
  const abilities = s.abilities || {};
  const prof = s.proficiencies || {};
  return {
    ...s,
    proficiencyBonus: Number.isFinite(Number(s.proficiencyBonus)) ? Number(s.proficiencyBonus) : 2,
    abilities: {
      str: { score: clampScore(abilities.str?.score ?? 10) },
      dex: { score: clampScore(abilities.dex?.score ?? 10) },
      con: { score: clampScore(abilities.con?.score ?? 10) },
      int: { score: clampScore(abilities.int?.score ?? 10) },
      wis: { score: clampScore(abilities.wis?.score ?? 10) },
      cha: { score: clampScore(abilities.cha?.score ?? 10) },
    },
    proficiencies: {
      saves: { ...(prof.saves || {}) },   // { str: { proficient: true }, ... }
      skills: { ...(prof.skills || {}) }, // { stealth: { proficient: true, expertise: false }, ... }
    },
  };
}

export default function CharacterSheet5e({ sheet, editable = false, onChange, onRoll }) {
  const s = useMemo(() => ensureSheetShape(sheet), [sheet]);

  const abilityMods = useMemo(() => {
    const out = {};
    for (const a of ABILITIES) out[a.key] = modFromScore(s.abilities[a.key]?.score ?? 10);
    return out;
  }, [s]);

  const pb = Number(s.proficiencyBonus) || 0;

  function patch(next) {
    onChange?.(next);
  }

  function setAbilityScore(key, score) {
    const next = ensureSheetShape(s);
    next.abilities[key].score = clampScore(score);
    patch(next);
  }

  function setSaveProficient(abilKey, proficient) {
    const next = ensureSheetShape(s);
    next.proficiencies.saves[abilKey] = { ...(next.proficiencies.saves[abilKey] || {}), proficient: !!proficient };
    patch(next);
  }

  function setSkillFlags(skillKey, updates) {
    const next = ensureSheetShape(s);
    next.proficiencies.skills[skillKey] = { ...(next.proficiencies.skills[skillKey] || {}), ...updates };
    patch(next);
  }

  function getSaveMod(abilKey) {
    const isProf = !!s.proficiencies.saves?.[abilKey]?.proficient;
    return (abilityMods[abilKey] || 0) + (isProf ? pb : 0);
  }

  function getSkillMod(skillKey) {
    const meta = SKILLS.find((x) => x.key === skillKey);
    const abil = meta?.ability || "str";
    const flags = s.proficiencies.skills?.[skillKey] || {};
    const isProf = !!flags.proficient;
    const isExp = !!flags.expertise;
    const profPart = isProf ? pb * (isExp ? 2 : 1) : 0;
    return (abilityMods[abil] || 0) + profPart;
  }

  function doRoll(label, mod) {
    const roll = rollD20();
    const total = roll + (Number(mod) || 0);
    onRoll?.({ label, roll, mod: Number(mod) || 0, total });
  }

  // Passive Perception = 10 + Perception modifier
  const passivePerception = 10 + getSkillMod("perception");

  return (
    <div className="csheet-body">
      <div className="csheet-mini-top">
        <div className="csheet-pill">
          <span className="csheet-pill-lbl">PB</span>
          <span className="csheet-pill-val">{fmtMod(pb)}</span>
        </div>

        <div className="csheet-pill">
          <span className="csheet-pill-lbl">Passive Perception</span>
          <span className="csheet-pill-val">{passivePerception}</span>
        </div>
      </div>

      <div className="csheet-grid">
        {/* Abilities column */}
        <div className="csheet-col">
          {ABILITIES.map((a) => {
            const score = s.abilities[a.key]?.score ?? 10;
            const mod = abilityMods[a.key] ?? 0;

            return (
              <div key={a.key} className="csheet-ability">
                <div className="csheet-ability-hdr">
                  <span className="csheet-ability-name">{a.name}</span>
                </div>

                <div className="csheet-ability-row">
                  {editable ? (
                    <input
                      className="csheet-score"
                      type="number"
                      value={score}
                      min={1}
                      max={30}
                      onChange={(e) => setAbilityScore(a.key, e.target.value)}
                    />
                  ) : (
                    <div className="csheet-score csheet-score-readonly">{score}</div>
                  )}

                  <button
                    type="button"
                    className="csheet-mod"
                    onClick={() => doRoll(`${a.name} check`, mod)}
                    title="Roll ability check (d20 + mod)"
                  >
                    {fmtMod(mod)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Saves + Skills column */}
        <div className="csheet-col">
          <div className="csheet-section">
            <div className="csheet-section-title">Saving Throws</div>

            <div className="csheet-list">
              {ABILITIES.map((a) => {
                const isProf = !!s.proficiencies.saves?.[a.key]?.proficient;
                const mod = getSaveMod(a.key);

                return (
                  <div key={a.key} className="csheet-row">
                    <label className="csheet-check">
                      <input
                        type="checkbox"
                        checked={isProf}
                        disabled={!editable}
                        onChange={(e) => setSaveProficient(a.key, e.target.checked)}
                      />
                    </label>

                    <button
                      type="button"
                      className="csheet-rollbtn"
                      onClick={() => doRoll(`${a.name} save`, mod)}
                      title="Roll save (d20 + mod + PB if proficient)"
                    >
                      <span className="csheet-rollname">{a.name}</span>
                      <span className="csheet-rollmod">{fmtMod(mod)}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="csheet-section">
            <div className="csheet-section-title">Skills</div>

            <div className="csheet-list">
              {SKILLS.map((sk) => {
                const flags = s.proficiencies.skills?.[sk.key] || {};
                const isProf = !!flags.proficient;
                const isExp = !!flags.expertise;
                const mod = getSkillMod(sk.key);

                return (
                  <div key={sk.key} className="csheet-row">
                    <label className="csheet-check" title="Proficient">
                      <input
                        type="checkbox"
                        checked={isProf}
                        disabled={!editable}
                        onChange={(e) => setSkillFlags(sk.key, { proficient: e.target.checked, expertise: e.target.checked ? isExp : false })}
                      />
                    </label>

                    <label className="csheet-check csheet-check-exp" title="Expertise (double PB)">
                      <input
                        type="checkbox"
                        checked={isExp}
                        disabled={!editable || !isProf}
                        onChange={(e) => setSkillFlags(sk.key, { expertise: e.target.checked })}
                      />
                      <span className="csheet-exp-tag">x2</span>
                    </label>

                    <button
                      type="button"
                      className="csheet-rollbtn"
                      onClick={() => doRoll(`${sk.name} (${sk.ability.toUpperCase()})`, mod)}
                      title="Roll skill (d20 + ability mod + PB if proficient; double PB if expertise)"
                    >
                      <span className="csheet-rollname">
                        {sk.name} <span className="csheet-sub">({sk.ability.toUpperCase()})</span>
                      </span>
                      <span className="csheet-rollmod">{fmtMod(mod)}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="csheet-hint">
        Click any mod button to roll. Skills/Saves use: <b>d20 + mod + proficiency</b> (if proficient).
      </div>
    </div>
  );
}

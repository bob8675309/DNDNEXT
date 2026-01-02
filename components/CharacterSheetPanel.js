// /components/CharacterSheetPanel.js
import { useMemo } from "react";

const ABILITIES = [
  { key: "str", label: "Strength" },
  { key: "dex", label: "Dexterity" },
  { key: "con", label: "Constitution" },
  { key: "int", label: "Intelligence" },
  { key: "wis", label: "Wisdom" },
  { key: "cha", label: "Charisma" },
];

const SKILLS = [
  { key: "acrobatics", label: "Acrobatics", ability: "dex" },
  { key: "animal_handling", label: "Animal Handling", ability: "wis" },
  { key: "arcana", label: "Arcana", ability: "int" },
  { key: "athletics", label: "Athletics", ability: "str" },
  { key: "deception", label: "Deception", ability: "cha" },
  { key: "history", label: "History", ability: "int" },
  { key: "insight", label: "Insight", ability: "wis" },
  { key: "intimidation", label: "Intimidation", ability: "cha" },
  { key: "investigation", label: "Investigation", ability: "int" },
  { key: "medicine", label: "Medicine", ability: "wis" },
  { key: "nature", label: "Nature", ability: "int" },
  { key: "perception", label: "Perception", ability: "wis" },
  { key: "performance", label: "Performance", ability: "cha" },
  { key: "persuasion", label: "Persuasion", ability: "cha" },
  { key: "religion", label: "Religion", ability: "int" },
  { key: "sleight_of_hand", label: "Sleight of Hand", ability: "dex" },
  { key: "stealth", label: "Stealth", ability: "dex" },
  { key: "survival", label: "Survival", ability: "wis" },
];

function d20() {
  return Math.floor(Math.random() * 20) + 1;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function modFromScore(score) {
  const s = toNum(score);
  if (s == null) return null;
  return Math.floor((s - 10) / 2);
}

function fmtSigned(n) {
  if (n == null) return "—";
  return n >= 0 ? `+${n}` : `${n}`;
}

function readAbilityScore(sheet, abilityKey) {
  const s = sheet || {};
  const aliases = {
    str: ["str", "strength"],
    dex: ["dex", "dexterity"],
    con: ["con", "constitution"],
    int: ["int", "intelligence"],
    wis: ["wis", "wisdom"],
    cha: ["cha", "charisma"],
  }[abilityKey] || [abilityKey];

  // common nesting patterns
  const buckets = [
    s.abilities,
    s.ability_scores,
    s.abilityScores,
    s.stats,
    s.scores,
    s,
  ].filter(Boolean);

  for (const bucket of buckets) {
    for (const a of aliases) {
      const v = bucket?.[a];
      const n = toNum(v);
      if (n != null) return n;
    }
  }

  return null;
}

function readPB(sheet) {
  const s = sheet || {};
  return (
    toNum(s.proficiency_bonus) ??
    toNum(s.proficiencyBonus) ??
    toNum(s.pb) ??
    toNum(s.prof_bonus) ??
    0
  );
}

function isSkillProficient(sheet, key) {
  const s = sheet || {};
  if (s?.proficiencies?.skills?.[key] === true) return true;
  if (s?.skill_proficiencies?.[key] === true) return true;
  if (s?.skills?.[key]?.proficient === true) return true;

  const arrs = [
    s.proficient_skills,
    s.skill_proficiencies_list,
    s.skills_proficient,
  ].filter(Array.isArray);

  return arrs.some((arr) => arr.map(String).includes(String(key)));
}

function isSkillExpertise(sheet, key) {
  const s = sheet || {};
  if (s?.expertise?.skills?.[key] === true) return true;
  if (s?.expertise_skills?.[key] === true) return true;
  if (s?.skills?.[key]?.expertise === true) return true;

  const arrs = [s.expertise_skills, s.skills_expertise].filter(Array.isArray);
  return arrs.some((arr) => arr.map(String).includes(String(key)));
}

function isSaveProficient(sheet, abilityKey) {
  const s = sheet || {};
  if (s?.saving_throw_proficiencies?.[abilityKey] === true) return true;
  if (s?.save_proficiencies?.[abilityKey] === true) return true;
  if (s?.saves?.[abilityKey]?.proficient === true) return true;

  const arrs = [s.proficient_saves, s.save_proficiencies_list].filter(Array.isArray);
  return arrs.some((arr) => arr.map(String).includes(String(abilityKey)));
}

function readSkillOverride(sheet, key) {
  const s = sheet || {};
  // if you already store final mods, we respect them
  return (
    toNum(s?.skill_mods?.[key]) ??
    toNum(s?.skills?.[key]) ??
    toNum(s?.skills?.[key]?.mod) ??
    null
  );
}

function readMiscSkillBonus(sheet, key) {
  const s = sheet || {};
  return toNum(s?.skill_bonuses?.[key]) ?? toNum(s?.skills?.[key]?.bonus) ?? 0;
}

export default function CharacterSheetPanel({
  sheet,
  characterName,
  onRoll,
  className = "",
}) {
  const pb = useMemo(() => readPB(sheet), [sheet]);

  const abilityScores = useMemo(() => {
    const m = {};
    for (const a of ABILITIES) m[a.key] = readAbilityScore(sheet, a.key);
    return m;
  }, [sheet]);

  const abilityMods = useMemo(() => {
    const m = {};
    for (const a of ABILITIES) m[a.key] = modFromScore(abilityScores[a.key]);
    return m;
  }, [abilityScores]);

  const skillMods = useMemo(() => {
    const out = {};
    for (const sk of SKILLS) {
      const override = readSkillOverride(sheet, sk.key);
      if (override != null) {
        out[sk.key] = override;
        continue;
      }

      const base = abilityMods[sk.ability];
      if (base == null) {
        out[sk.key] = null;
        continue;
      }

      const proficient = isSkillProficient(sheet, sk.key);
      const expertise = isSkillExpertise(sheet, sk.key);
      const profAdd = proficient ? pb * (expertise ? 2 : 1) : 0;
      const misc = readMiscSkillBonus(sheet, sk.key) || 0;

      out[sk.key] = base + profAdd + misc;
    }
    return out;
  }, [sheet, abilityMods, pb]);

  const passivePerception = useMemo(() => {
    const p = skillMods.perception;
    return p == null ? null : 10 + p;
  }, [skillMods]);

  function doRoll(label, mod) {
    if (mod == null) return;
    const roll = d20();
    const total = roll + mod;
    onRoll?.({ label, roll, mod, total });
  }

  function rollSave(abilityKey, label) {
    const base = abilityMods[abilityKey];
    if (base == null) return;

    const saveProf = isSaveProficient(sheet, abilityKey);
    const mod = base + (saveProf ? pb : 0);

    doRoll(label, mod);
  }

  return (
    <div className={`csheet ${className}`}>
      {/* Header row (keeps “sheet vibe” but uses site theme) */}
      <div className="csheet-top csheet-box">
        <div className="csheet-top-grid">
          <div className="csheet-field csheet-field-wide">
            <div className="csheet-field-label">Character Name</div>
            <div className="csheet-field-value">{characterName || sheet?.name || "—"}</div>
          </div>

          <div className="csheet-field">
            <div className="csheet-field-label">Class & Level</div>
            <div className="csheet-field-value">{sheet?.class_level || sheet?.classLevel || "—"}</div>
          </div>

          <div className="csheet-field">
            <div className="csheet-field-label">Background</div>
            <div className="csheet-field-value">{sheet?.background || "—"}</div>
          </div>

          <div className="csheet-field">
            <div className="csheet-field-label">Player</div>
            <div className="csheet-field-value">{sheet?.player_name || sheet?.playerName || "—"}</div>
          </div>

          <div className="csheet-field">
            <div className="csheet-field-label">Race</div>
            <div className="csheet-field-value">{sheet?.race || "—"}</div>
          </div>

          <div className="csheet-field">
            <div className="csheet-field-label">Alignment</div>
            <div className="csheet-field-value">{sheet?.alignment || "—"}</div>
          </div>

          <div className="csheet-field">
            <div className="csheet-field-label">XP</div>
            <div className="csheet-field-value">{sheet?.xp ?? sheet?.experience_points ?? "—"}</div>
          </div>
        </div>
      </div>

      {/* Main sheet rows */}
      <div className="csheet-main">
        {/* Left column: Abilities + Skills (what you asked to resize/reposition) */}
        <div className="csheet-left csheet-box">
          <div className="csheet-left-grid">
            <div className="csheet-abilities">
              {ABILITIES.map((a) => {
                const score = abilityScores[a.key];
                const mod = abilityMods[a.key];
                const saveProf = isSaveProficient(sheet, a.key);
                return (
                  <button
                    key={a.key}
                    type="button"
                    className="csheet-ability-btn"
                    onClick={() => rollSave(a.key, `${a.label} Save`)}
                    title={`Roll: d20 ${fmtSigned(mod)}${saveProf ? ` + PB(${pb})` : ""}`}
                    disabled={mod == null}
                  >
                    <div className="csheet-ability-name">
                      {a.label}
                      {saveProf ? <span className="csheet-dot" title="Save proficient" /> : null}
                    </div>
                    <div className="csheet-ability-score">{score ?? "—"}</div>
                    <div className="csheet-ability-mod">{fmtSigned(mod)}</div>
                  </button>
                );
              })}
            </div>

            <div className="csheet-skills">
              <div className="csheet-subtitle">
                <span>Skills</span>
                <span className="csheet-subhint">click to roll d20 + mod</span>
              </div>

              <div className="csheet-skill-grid">
                {SKILLS.map((sk) => {
                  const mod = skillMods[sk.key];
                  return (
                    <button
                      key={sk.key}
                      type="button"
                      className="csheet-skill-btn"
                      onClick={() => doRoll(sk.label, mod)}
                      disabled={mod == null}
                      title={mod == null ? "No data yet" : `Roll: d20 ${fmtSigned(mod)}`}
                    >
                      <span className="csheet-skill-name">{sk.label}</span>
                      <span className="csheet-skill-mod">{fmtSigned(mod)}</span>
                    </button>
                  );
                })}
              </div>

              <div className="csheet-minirow">
                <div className="csheet-mini">
                  <div className="csheet-mini-label">Prof. Bonus</div>
                  <div className="csheet-mini-value">{fmtSigned(pb)}</div>
                </div>
                <div className="csheet-mini">
                  <div className="csheet-mini-label">Passive Perception</div>
                  <div className="csheet-mini-value">{passivePerception ?? "—"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle + Right columns are “layout-preserving” placeholders for now */}
        <div className="csheet-mid csheet-box">
          <div className="csheet-subtitle">Combat</div>
          <div className="csheet-combat-grid">
            <div className="csheet-combat-box">
              <div className="csheet-mini-label">AC</div>
              <div className="csheet-combat-value">{sheet?.ac ?? "—"}</div>
            </div>
            <div className="csheet-combat-box">
              <div className="csheet-mini-label">Initiative</div>
              <div className="csheet-combat-value">{sheet?.initiative ?? "—"}</div>
            </div>
            <div className="csheet-combat-box">
              <div className="csheet-mini-label">Speed</div>
              <div className="csheet-combat-value">{sheet?.speed ?? "—"}</div>
            </div>

            <div className="csheet-combat-box csheet-combat-box-wide">
              <div className="csheet-mini-label">HP (Max / Current / Temp)</div>
              <div className="csheet-combat-value">
                {(sheet?.hp_max ?? "—")} / {(sheet?.hp_current ?? "—")} / {(sheet?.hp_temp ?? "—")}
              </div>
            </div>
          </div>
        </div>

        <div className="csheet-right csheet-box">
          <div className="csheet-subtitle">Personality</div>
          <div className="csheet-lines">
            <div className="csheet-line">
              <div className="csheet-mini-label">Traits</div>
              <div className="csheet-line-value">{sheet?.personality_traits || "—"}</div>
            </div>
            <div className="csheet-line">
              <div className="csheet-mini-label">Ideals</div>
              <div className="csheet-line-value">{sheet?.ideals || "—"}</div>
            </div>
            <div className="csheet-line">
              <div className="csheet-mini-label">Bonds</div>
              <div className="csheet-line-value">{sheet?.bonds || "—"}</div>
            </div>
            <div className="csheet-line">
              <div className="csheet-mini-label">Flaws</div>
              <div className="csheet-line-value">{sheet?.flaws || "—"}</div>
            </div>
          </div>
        </div>

        {/* Bottom row “boxes” to preserve the familiar sheet feel */}
        <div className="csheet-bottom-left csheet-box">
          <div className="csheet-subtitle">Attacks & Spellcasting</div>
          <div className="csheet-muted-lines">{sheet?.attacks_summary || "—"}</div>
        </div>

        <div className="csheet-bottom-mid csheet-box">
          <div className="csheet-subtitle">Equipment</div>
          <div className="csheet-muted-lines">{sheet?.equipment_summary || "—"}</div>
        </div>

        <div className="csheet-bottom-right csheet-box">
          <div className="csheet-subtitle">Features & Traits</div>
          <div className="csheet-muted-lines">{sheet?.features_summary || "—"}</div>
        </div>
      </div>
    </div>
  );
}

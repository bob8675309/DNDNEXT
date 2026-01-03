// components/CharacterSheetPanel.js
import { useEffect, useMemo, useState } from "react";

const ABILS = [
  { id: "str", name: "Strength" },
  { id: "dex", name: "Dexterity" },
  { id: "con", name: "Constitution" },
  { id: "int", name: "Intelligence" },
  { id: "wis", name: "Wisdom" },
  { id: "cha", name: "Charisma" },
];

const SKILLS = [
  { id: "acrobatics", name: "Acrobatics", abil: "dex" },
  { id: "animalHandling", name: "Animal Handling", abil: "wis" },
  { id: "arcana", name: "Arcana", abil: "int" },
  { id: "athletics", name: "Athletics", abil: "str" },
  { id: "deception", name: "Deception", abil: "cha" },
  { id: "history", name: "History", abil: "int" },
  { id: "insight", name: "Insight", abil: "wis" },
  { id: "intimidation", name: "Intimidation", abil: "cha" },
  { id: "investigation", name: "Investigation", abil: "int" },
  { id: "medicine", name: "Medicine", abil: "wis" },
  { id: "nature", name: "Nature", abil: "int" },
  { id: "perception", name: "Perception", abil: "wis" },
  { id: "performance", name: "Performance", abil: "cha" },
  { id: "persuasion", name: "Persuasion", abil: "cha" },
  { id: "religion", name: "Religion", abil: "int" },
  { id: "sleightOfHand", name: "Sleight of Hand", abil: "dex" },
  { id: "stealth", name: "Stealth", abil: "dex" },
  { id: "survival", name: "Survival", abil: "wis" },
];

function clampInt(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function abilityMod(score) {
  const s = clampInt(score, 10);
  return Math.floor((s - 10) / 2);
}

function rollDie(sides) {
  return 1 + Math.floor(Math.random() * sides);
}

// 4d6 drop lowest (for player sheet later, but useful for admin too)
function roll4d6DropLowest() {
  const rolls = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)].sort((a, b) => a - b);
  const dropped = rolls[0];
  const kept = rolls.slice(1);
  return { total: kept.reduce((a, b) => a + b, 0), rolls, dropped };
}

function ensureSheet(base) {
  const sheet = base && typeof base === "object" ? base : {};
  const next = structuredClone(sheet);

  next.proficiencyBonus = clampInt(next.proficiencyBonus, 2);

  next.abilities = next.abilities && typeof next.abilities === "object" ? next.abilities : {};
  for (const a of ABILS) {
    const cur = next.abilities[a.id] || {};
    const score = clampInt(cur.score, 10);
    next.abilities[a.id] = { ...cur, score };
  }

  next.proficiencies = next.proficiencies && typeof next.proficiencies === "object" ? next.proficiencies : {};
  next.proficiencies.skills =
    next.proficiencies.skills && typeof next.proficiencies.skills === "object" ? next.proficiencies.skills : {};
  next.proficiencies.saves =
    next.proficiencies.saves && typeof next.proficiencies.saves === "object" ? next.proficiencies.saves : {};

  // Optional basics (safe defaults)
  next.ac = clampInt(next.ac, 0);
  next.maxHp = clampInt(next.maxHp, 0);
  next.hp = clampInt(next.hp, next.maxHp);
  next.speed = clampInt(next.speed, 0);
  next.initiative = clampInt(next.initiative, 0);

  return next;
}

export default function CharacterSheetPanel({
  sheet,
  characterName,
  editable = false,
  onChangeSheet,
  onSaveSheet,
  onRoll,
}) {
  // If parent doesn’t control sheet edits, we can still function locally.
  const [local, setLocal] = useState(() => ensureSheet(sheet));
  useEffect(() => {
    if (!onChangeSheet) setLocal(ensureSheet(sheet));
  }, [sheet, onChangeSheet]);

  const s = useMemo(() => ensureSheet(onChangeSheet ? sheet : local), [sheet, local, onChangeSheet]);

  const setSheet = (next) => {
    const safe = ensureSheet(next);
    if (onChangeSheet) onChangeSheet(safe);
    else setLocal(safe);
  };

  const pb = clampInt(s.proficiencyBonus, 2);

  function doRoll(label, mod) {
    const d20 = rollDie(20);
    const total = d20 + mod;
    onRoll?.({ label, roll: d20, mod, total });
  }

  function toggleSaveProf(abilId) {
    const next = structuredClone(s);
    next.proficiencies ??= {};
    next.proficiencies.saves ??= {};
    const cur = !!next.proficiencies.saves?.[abilId]?.proficient;
    next.proficiencies.saves[abilId] = { ...(next.proficiencies.saves[abilId] || {}), proficient: !cur };
    setSheet(next);
  }

  function toggleSkillProf(skillId) {
    const next = structuredClone(s);
    next.proficiencies ??= {};
    next.proficiencies.skills ??= {};
    const cur = !!next.proficiencies.skills?.[skillId]?.proficient;
    next.proficiencies.skills[skillId] = { ...(next.proficiencies.skills[skillId] || {}), proficient: !cur };
    setSheet(next);
  }

  function toggleSkillExpertise(skillId) {
    const next = structuredClone(s);
    next.proficiencies ??= {};
    next.proficiencies.skills ??= {};
    const cur = !!next.proficiencies.skills?.[skillId]?.expertise;
    next.proficiencies.skills[skillId] = { ...(next.proficiencies.skills[skillId] || {}), expertise: !cur };
    setSheet(next);
  }

  function setAbilityScore(abilId, score) {
    const next = structuredClone(s);
    next.abilities ??= {};
    next.abilities[abilId] = { ...(next.abilities[abilId] || {}), score: clampInt(score, 10) };
    setSheet(next);
  }

  function rollAllStats() {
    const next = structuredClone(s);
    next.abilities ??= {};
    // roll 6 scores in STR/DEX/CON/INT/WIS/CHA order
    for (const a of ABILS) {
      const r = roll4d6DropLowest();
      next.abilities[a.id] = { ...(next.abilities[a.id] || {}), score: r.total };
    }
    setSheet(next);
  }

  return (
    <div className="csheet">
      <div className="csheet-head">
        <div className="csheet-title">
          <div className="csheet-name">{characterName || "Character"}</div>
          <div className="csheet-sub">PB: {pb >= 0 ? `+${pb}` : pb}</div>
        </div>

        <div className="csheet-head-actions">
          {editable && (
            <button type="button" className="btn btn-sm btn-outline-light" onClick={rollAllStats}>
              Roll stats (4d6 drop)
            </button>
          )}
          {onSaveSheet && (
            <button
              type="button"
              className="btn btn-sm btn-success"
              onClick={() => onSaveSheet(s)}
              title="Persist sheet JSON to Supabase"
            >
              Save sheet
            </button>
          )}
        </div>
      </div>

      <div className="csheet-body">
        {/* Left column: Abilities + Saves + Skills (compact) */}
        <div className="csheet-left">
          <div className="csheet-block">
            <div className="csheet-block-title">Ability Scores</div>

            <div className="cs-abil-grid">
              {ABILS.map((a) => {
                const score = s.abilities?.[a.id]?.score ?? 10;
                const mod = abilityMod(score);

                return (
                  <div key={a.id} className="cs-abil-row">
                    <button
                      type="button"
                      className="cs-mini-btn"
                      onClick={() => doRoll(`${a.name} check`, mod)}
                      title={`Roll d20 + ${mod}`}
                    >
                      <span className="cs-mini-l">{a.name}</span>
                      <span className="cs-mini-r">
                        {score} / {mod >= 0 ? `+${mod}` : mod}
                      </span>
                    </button>

                    {editable ? (
                      <input
                        className="form-control form-control-sm cs-score-input"
                        type="number"
                        value={score}
                        onChange={(e) => setAbilityScore(a.id, e.target.value)}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="csheet-block">
            <div className="csheet-block-title">Saving Throws</div>

            <div className="cs-save-grid">
              {ABILS.map((a) => {
                const score = s.abilities?.[a.id]?.score ?? 10;
                const base = abilityMod(score);
                const prof = !!s.proficiencies?.saves?.[a.id]?.proficient;
                const mod = base + (prof ? pb : 0);

                return (
                  <div key={a.id} className="cs-save-row">
                    <label className="cs-check-wrap" title="Proficient">
                      <input
                        type="checkbox"
                        className="form-check-input cs-check"
                        checked={prof}
                        disabled={!editable}
                        onChange={() => toggleSaveProf(a.id)}
                      />
                    </label>

                    <button
                      type="button"
                      className="cs-mini-btn cs-mini-btn-ghost"
                      onClick={() => doRoll(`${a.name} save`, mod)}
                      title={`Roll d20 + ${mod}${prof ? ` (includes PB ${pb})` : ""}`}
                    >
                      <span className="cs-mini-l">{a.name}</span>
                      <span className="cs-mini-r">{mod >= 0 ? `+${mod}` : mod}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="csheet-block">
            <div className="csheet-block-title">Skills</div>

            <div className="cs-skill-grid">
              {SKILLS.map((sk) => {
                const score = s.abilities?.[sk.abil]?.score ?? 10;
                const base = abilityMod(score);

                const prof = !!s.proficiencies?.skills?.[sk.id]?.proficient;
                const exp = !!s.proficiencies?.skills?.[sk.id]?.expertise;

                const mod = base + (prof ? pb : 0) + (exp ? pb : 0);

                return (
                  <div key={sk.id} className="cs-skill-row">
                    <label className="cs-check-wrap" title="Proficient">
                      <input
                        type="checkbox"
                        className="form-check-input cs-check"
                        checked={prof}
                        disabled={!editable}
                        onChange={() => toggleSkillProf(sk.id)}
                      />
                    </label>

                    <button
                      type="button"
                      className="cs-mini-btn cs-mini-btn-skill"
                      onClick={() => doRoll(`${sk.name} (${sk.abil.toUpperCase()})`, mod)}
                      title={`Roll d20 + ${mod}${prof ? ` (includes PB ${pb})` : ""}${exp ? " (expertise)" : ""}`}
                    >
                      <span className="cs-mini-l">
                        {sk.name} <span className="cs-mini-tag">({sk.abil.toUpperCase()})</span>
                      </span>
                      <span className="cs-mini-r">{mod >= 0 ? `+${mod}` : mod}</span>
                    </button>

                    {/* optional expertise toggle (admin/player edit only) */}
                    {editable ? (
                      <button
                        type="button"
                        className={`cs-xp-btn ${exp ? "on" : ""}`}
                        onClick={() => toggleSkillExpertise(sk.id)}
                        title="Toggle expertise (adds PB again)"
                      >
                        x2
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column: snapshot (kept simple for now; we’ll expand later) */}
        <div className="csheet-right">
          <div className="csheet-block">
            <div className="csheet-block-title">Sheet snapshot</div>

            <div className="cs-snap-grid">
              <div className="cs-snap-row">
                <span className="cs-snap-l">AC</span>
                <span className="cs-snap-r">{clampInt(s.ac, 0)}</span>
              </div>
              <div className="cs-snap-row">
                <span className="cs-snap-l">HP</span>
                <span className="cs-snap-r">
                  {clampInt(s.hp, 0)} / {clampInt(s.maxHp, 0)}
                </span>
              </div>
              <div className="cs-snap-row">
                <span className="cs-snap-l">Speed</span>
                <span className="cs-snap-r">{clampInt(s.speed, 0)}</span>
              </div>
              <div className="cs-snap-row">
                <span className="cs-snap-l">Initiative</span>
                <span className="cs-snap-r">{clampInt(s.initiative, 0)}</span>
              </div>
            </div>

            <div className="csheet-hint">
              Next step (after it looks right): wire AC/HP/Speed/Init + attacks/spells/features into the grid layout
              to match the official sheet boxes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

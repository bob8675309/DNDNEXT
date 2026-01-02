// /components/CharacterSheetPanel.js
import { useEffect, useMemo, useState } from "react";

const ABILITIES = [
  { key: "str", abbr: "STR", name: "Strength" },
  { key: "dex", abbr: "DEX", name: "Dexterity" },
  { key: "con", abbr: "CON", name: "Constitution" },
  { key: "int", abbr: "INT", name: "Intelligence" },
  { key: "wis", abbr: "WIS", name: "Wisdom" },
  { key: "cha", abbr: "CHA", name: "Charisma" },
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

function clampNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function scoreToMod(score) {
  const s = clampNum(score, 10);
  return Math.floor((s - 10) / 2);
}

function d20() {
  return Math.floor(Math.random() * 20) + 1;
}

function cloneJson(obj) {
  try {
    return JSON.parse(JSON.stringify(obj ?? {}));
  } catch {
    return {};
  }
}

function getPB(sheet) {
  return clampNum(
    sheet?.proficiencyBonus ??
      sheet?.proficiency_bonus ??
      sheet?.pb ??
      sheet?.proficiency ??
      2,
    2
  );
}

function getAbilityScore(sheet, abKey) {
  // supports a few possible shapes
  const v =
    sheet?.abilities?.[abKey]?.score ??
    sheet?.abilityScores?.[abKey] ??
    sheet?.stats?.[abKey]?.score ??
    sheet?.stats?.[abKey] ??
    sheet?.[abKey]?.score ??
    sheet?.[abKey] ??
    10;
  return clampNum(v, 10);
}

function getAbilityMod(sheet, abKey) {
  const explicit =
    sheet?.abilities?.[abKey]?.mod ??
    sheet?.abilityMods?.[abKey] ??
    sheet?.stats?.[abKey]?.mod ??
    null;

  if (explicit != null && Number.isFinite(Number(explicit))) return Number(explicit);
  return scoreToMod(getAbilityScore(sheet, abKey));
}

// Skill proficiency state (supports both object-map and arrays)
function getSkillFlags(sheet, skillKey) {
  const obj = sheet?.proficiencies?.skills?.[skillKey];
  const proficientFromObj = !!obj?.proficient;
  const expertiseFromObj = !!obj?.expertise;

  const profArr = sheet?.skill_proficiencies;
  const expArr = sheet?.skill_expertise;

  const proficientFromArr =
    Array.isArray(profArr) && profArr.some((k) => String(k) === String(skillKey));
  const expertiseFromArr =
    Array.isArray(expArr) && expArr.some((k) => String(k) === String(skillKey));

  return {
    proficient: proficientFromObj || proficientFromArr,
    expertise: expertiseFromObj || expertiseFromArr,
  };
}

function setSkillFlag(next, skillKey, flag, value) {
  next.proficiencies = next.proficiencies || {};
  next.proficiencies.skills = next.proficiencies.skills || {};
  next.proficiencies.skills[skillKey] = next.proficiencies.skills[skillKey] || {};
  next.proficiencies.skills[skillKey][flag] = !!value;
  return next;
}

function getMiscSkillBonus(sheet, skillKey) {
  return clampNum(sheet?.skillBonuses?.[skillKey] ?? sheet?.skill_bonuses?.[skillKey] ?? 0, 0);
}

export default function CharacterSheetPanel({
  sheet,
  characterName,
  editable = false,
  onSheetChange,
  onRoll,
}) {
  const [localSheet, setLocalSheet] = useState(() => cloneJson(sheet || {}));

  // keep local in sync when selection changes
  useEffect(() => {
    setLocalSheet(cloneJson(sheet || {}));
  }, [sheet]);

  const s = editable ? localSheet : (sheet || {});

  const pb = useMemo(() => getPB(s), [s]);

  const core = useMemo(() => {
    const dexMod = getAbilityMod(s, "dex");
    return {
      ac: s?.ac ?? s?.armorClass ?? 10,
      hp: s?.hp ?? s?.hitPoints ?? 0,
      maxHp: s?.maxHp ?? s?.max_hit_points ?? null,
      speed: s?.speed ?? s?.movement ?? 30,
      initiative: clampNum(s?.initiative ?? dexMod, dexMod),
      passivePerception:
        clampNum(s?.passivePerception ?? s?.passive_perception ?? 10, 10),
    };
  }, [s]);

  function emitSheetChange(next) {
    setLocalSheet(next);
    if (typeof onSheetChange === "function") onSheetChange(next);
  }

  function rollSkill(skillKey, label, abilityKey) {
    const roll = d20();
    const abMod = getAbilityMod(s, abilityKey);
    const flags = getSkillFlags(s, skillKey);
    const misc = getMiscSkillBonus(s, skillKey);

    const pbAdd = flags.proficient ? pb : 0;
    const expAdd = flags.expertise ? pb : 0;

    const mod = abMod + pbAdd + expAdd + misc;
    const total = roll + mod;

    onRoll?.({
      kind: "skill",
      key: skillKey,
      label,
      roll,
      mod,
      total,
      breakdown: { ability: abilityKey, abMod, pb: pbAdd, expertise: expAdd, misc },
    });
  }

  function rollAbility(abilityKey) {
    const roll = d20();
    const abMod = getAbilityMod(s, abilityKey);

    // If later you add save profs, we’ll automatically include PB when sheet says so.
    const saveProf =
      !!s?.proficiencies?.saves?.[abilityKey] ||
      (Array.isArray(s?.save_proficiencies) &&
        s.save_proficiencies.some((k) => String(k) === String(abilityKey)));

    const pbAdd = saveProf ? pb : 0;
    const mod = abMod + pbAdd;
    const total = roll + mod;

    onRoll?.({
      kind: "ability",
      key: abilityKey,
      label: `${abilityKey.toUpperCase()} Check`,
      roll,
      mod,
      total,
      breakdown: { abMod, pb: pbAdd },
    });
  }

  return (
    <div className="csheet">
      <div className="csheet-head">
        <div className="csheet-title">
          <div className="csheet-name">{characterName || "Character"}</div>
          <div className="csheet-sub">PB {pb >= 0 ? `+${pb}` : pb}</div>
        </div>

        <div className="csheet-core">
          <div className="csheet-coreCell">
            <div className="csheet-coreLbl">AC</div>
            <div className="csheet-coreVal">{core.ac}</div>
          </div>
          <div className="csheet-coreCell">
            <div className="csheet-coreLbl">HP</div>
            <div className="csheet-coreVal">
              {core.hp}
              {core.maxHp != null ? <span className="csheet-dim"> / {core.maxHp}</span> : null}
            </div>
          </div>
          <div className="csheet-coreCell">
            <div className="csheet-coreLbl">Speed</div>
            <div className="csheet-coreVal">{core.speed}</div>
          </div>
          <div className="csheet-coreCell">
            <div className="csheet-coreLbl">Init</div>
            <div className="csheet-coreVal">{core.initiative >= 0 ? `+${core.initiative}` : core.initiative}</div>
          </div>
        </div>
      </div>

      <div className="csheet-body">
        {/* Abilities + Skills (side-by-side, compact) */}
        <div className="csheet-card">
          <div className="csheet-cardHead">Abilities & Skills</div>

          <div className="csheet-as">
            {/* Ability column */}
            <div className="csheet-abilities">
              {ABILITIES.map((ab) => {
                const score = getAbilityScore(s, ab.key);
                const mod = getAbilityMod(s, ab.key);
                return (
                  <button
                    key={ab.key}
                    type="button"
                    className="csheet-abBtn"
                    onClick={() => rollAbility(ab.key)}
                    title="Roll d20 + ability mod (and PB if proficient in saving throws later)"
                  >
                    <div className="csheet-abTop">
                      <span className="csheet-abbr">{ab.abbr}</span>
                      <span className="csheet-score">{score}</span>
                    </div>
                    <div className="csheet-mod">{mod >= 0 ? `+${mod}` : mod}</div>
                  </button>
                );
              })}
            </div>

            {/* Skills list */}
            <div className="csheet-skills">
              <div className="csheet-skHead">
                <span>Skills</span>
                <span className="csheet-dim">click to roll</span>
              </div>

              <div className="csheet-sList">
                {SKILLS.map((sk) => {
                  const flags = getSkillFlags(s, sk.key);
                  const abMod = getAbilityMod(s, sk.ability);
                  const misc = getMiscSkillBonus(s, sk.key);
                  const totalMod =
                    abMod +
                    (flags.proficient ? pb : 0) +
                    (flags.expertise ? pb : 0) +
                    misc;

                  return (
                    <div key={sk.key} className="csheet-sRow">
                      <label className="csheet-chk" title="Proficient (adds PB)">
                        <input
                          type="checkbox"
                          checked={flags.proficient}
                          disabled={!editable}
                          onChange={(e) => {
                            const next = setSkillFlag(cloneJson(s), sk.key, "proficient", e.target.checked);
                            // if you uncheck proficient, also clear expertise
                            if (!e.target.checked) setSkillFlag(next, sk.key, "expertise", false);
                            emitSheetChange(next);
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        className="csheet-sBtn"
                        onClick={() => rollSkill(sk.key, sk.label, sk.ability)}
                        title={`Roll d20 + ${sk.ability.toUpperCase()} mod + PB (if proficient)`}
                      >
                        <span className="csheet-sName">{sk.label}</span>
                        <span className="csheet-sMod">
                          {totalMod >= 0 ? `+${totalMod}` : totalMod}
                        </span>
                      </button>

                      {/* Optional expertise toggle (tiny) */}
                      <label className="csheet-chk csheet-chkE" title="Expertise (adds PB again)">
                        <input
                          type="checkbox"
                          checked={flags.expertise}
                          disabled={!editable || !flags.proficient}
                          onChange={(e) => {
                            const next = setSkillFlag(cloneJson(s), sk.key, "expertise", e.target.checked);
                            emitSheetChange(next);
                          }}
                        />
                        <span className="csheet-eTxt">E</span>
                      </label>

                      <div className="csheet-sAbbr" title={`Uses ${sk.ability.toUpperCase()}`}>
                        {sk.ability.toUpperCase()}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="csheet-sFoot">
                <div className="csheet-dim">
                  Passive Perception: <span className="csheet-bright">{core.passivePerception}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="csheet-card">
          <div className="csheet-cardHead">Notes</div>
          <div className="csheet-notes">
            {s?.notes ? (
              <div style={{ whiteSpace: "pre-wrap" }}>{String(s.notes)}</div>
            ) : (
              <div className="csheet-dim">—</div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .csheet {
          width: 100%;
        }

        .csheet-head {
          display: flex;
          gap: 10px;
          align-items: stretch;
          margin-bottom: 10px;
        }

        .csheet-title {
          flex: 1 1 auto;
          border-radius: 14px;
          padding: 10px 12px;
          background: linear-gradient(90deg, rgba(34, 23, 51, 0.92), rgba(62, 40, 95, 0.92));
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35);
        }

        .csheet-name {
          font-weight: 800;
          letter-spacing: 0.2px;
          color: rgba(255, 255, 255, 0.95);
          line-height: 1.1;
        }

        .csheet-sub {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          font-weight: 700;
        }

        .csheet-core {
          flex: 0 0 auto;
          display: grid;
          grid-template-columns: repeat(4, minmax(56px, 1fr));
          gap: 8px;
          border-radius: 14px;
          padding: 10px;
          background: rgba(8, 10, 16, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(3px);
        }

        .csheet-coreCell {
          border-radius: 12px;
          padding: 6px 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          text-align: center;
        }

        .csheet-coreLbl {
          font-size: 11px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.62);
          letter-spacing: 0.2px;
        }

        .csheet-coreVal {
          font-size: 14px;
          font-weight: 900;
          color: rgba(255, 255, 255, 0.92);
          line-height: 1.1;
        }

        .csheet-body {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .csheet-card {
          border-radius: 14px;
          background: rgba(8, 10, 16, 0.62);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.32);
          overflow: hidden;
        }

        .csheet-cardHead {
          padding: 8px 12px;
          font-weight: 900;
          letter-spacing: 0.2px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.9);
          background: rgba(24, 16, 40, 0.75);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .csheet-as {
          display: grid;
          grid-template-columns: 92px 1fr;
          gap: 10px;
          padding: 10px;
          min-height: 0;
        }

        .csheet-abilities {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .csheet-abBtn {
          width: 100%;
          text-align: left;
          border-radius: 12px;
          padding: 6px 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.92);
          cursor: pointer;
          transition: transform 0.08s ease, border-color 0.12s ease, background 0.12s ease;
        }

        .csheet-abBtn:hover {
          background: rgba(126, 88, 255, 0.12);
          border-color: rgba(126, 88, 255, 0.35);
          transform: translateY(-1px);
        }

        .csheet-abTop {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
        }

        .csheet-abbr {
          font-size: 11px;
          font-weight: 900;
          color: rgba(255, 255, 255, 0.72);
          letter-spacing: 0.3px;
        }

        .csheet-score {
          font-size: 13px;
          font-weight: 900;
        }

        .csheet-mod {
          margin-top: 2px;
          font-size: 13px;
          font-weight: 900;
        }

        .csheet-skills {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .csheet-skHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 900;
          color: rgba(255, 255, 255, 0.88);
        }

        .csheet-sList {
          display: grid;
          grid-template-columns: 1fr;
          gap: 6px;
          max-height: 420px;
          overflow: auto;
          padding-right: 4px;
        }

        .csheet-sRow {
          display: grid;
          grid-template-columns: 18px 1fr 22px 44px;
          gap: 6px;
          align-items: center;
        }

        .csheet-chk {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin: 0;
        }

        .csheet-chk input {
          width: 14px;
          height: 14px;
          accent-color: #7e58ff;
          cursor: pointer;
        }

        .csheet-chkE {
          position: relative;
          justify-content: flex-start;
          gap: 4px;
        }

        .csheet-eTxt {
          font-size: 11px;
          font-weight: 900;
          color: rgba(255, 255, 255, 0.7);
          user-select: none;
        }

        .csheet-sBtn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border-radius: 12px;
          padding: 5px 8px; /* smaller buttons */
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.92);
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease, transform 0.08s ease;
          min-width: 0;
        }

        .csheet-sBtn:hover {
          background: rgba(126, 88, 255, 0.10);
          border-color: rgba(126, 88, 255, 0.30);
          transform: translateY(-1px);
        }

        .csheet-sName {
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .csheet-sMod {
          font-size: 12px;
          font-weight: 900;
          opacity: 0.95;
          flex: 0 0 auto;
        }

        .csheet-sAbbr {
          font-size: 11px;
          font-weight: 900;
          text-align: center;
          color: rgba(255, 255, 255, 0.7);
          border-radius: 10px;
          padding: 3px 6px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .csheet-sFoot {
          padding-top: 2px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .csheet-notes {
          padding: 10px 12px;
          color: rgba(255, 255, 255, 0.88);
          font-size: 13px;
          line-height: 1.45;
          background: rgba(255, 255, 255, 0.02);
        }

        .csheet-dim {
          color: rgba(255, 255, 255, 0.62);
          font-weight: 700;
        }

        .csheet-bright {
          color: rgba(255, 255, 255, 0.92);
          font-weight: 900;
        }

        @media (max-width: 768px) {
          .csheet-head {
            flex-direction: column;
          }
          .csheet-core {
            grid-template-columns: repeat(4, 1fr);
          }
          .csheet-as {
            grid-template-columns: 92px 1fr;
          }
          .csheet-sList {
            max-height: 360px;
          }
        }
      `}</style>
    </div>
  );
}

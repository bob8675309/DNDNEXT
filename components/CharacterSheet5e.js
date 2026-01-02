// /components/CharacterSheet5e.js
import React from "react";

const BORDER = "rgba(255,255,255,0.12)";
const DIM = "rgba(255,255,255,0.62)";
const MUTED = "rgba(255,255,255,0.72)";

const ABILITIES = [
  { key: "str", label: "Strength" },
  { key: "dex", label: "Dexterity" },
  { key: "con", label: "Constitution" },
  { key: "int", label: "Intelligence" },
  { key: "wis", label: "Wisdom" },
  { key: "cha", label: "Charisma" },
];

const SKILLS = [
  { id: "acrobatics", label: "Acrobatics (Dex)", aliases: ["acrobatics"], ability: "dex" },
  { id: "animalHandling", label: "Animal Handling (Wis)", aliases: ["animalHandling", "animal_handling", "animalhandling"], ability: "wis" },
  { id: "arcana", label: "Arcana (Int)", aliases: ["arcana"], ability: "int" },
  { id: "athletics", label: "Athletics (Str)", aliases: ["athletics"], ability: "str" },
  { id: "deception", label: "Deception (Cha)", aliases: ["deception"], ability: "cha" },
  { id: "history", label: "History (Int)", aliases: ["history"], ability: "int" },
  { id: "insight", label: "Insight (Wis)", aliases: ["insight"], ability: "wis" },
  { id: "intimidation", label: "Intimidation (Cha)", aliases: ["intimidation"], ability: "cha" },
  { id: "investigation", label: "Investigation (Int)", aliases: ["investigation"], ability: "int" },
  { id: "medicine", label: "Medicine (Wis)", aliases: ["medicine"], ability: "wis" },
  { id: "nature", label: "Nature (Int)", aliases: ["nature"], ability: "int" },
  { id: "perception", label: "Perception (Wis)", aliases: ["perception"], ability: "wis" },
  { id: "performance", label: "Performance (Cha)", aliases: ["performance"], ability: "cha" },
  { id: "persuasion", label: "Persuasion (Cha)", aliases: ["persuasion"], ability: "cha" },
  { id: "religion", label: "Religion (Int)", aliases: ["religion"], ability: "int" },
  { id: "sleightOfHand", label: "Sleight of Hand (Dex)", aliases: ["sleightOfHand", "sleight_of_hand", "sleightofhand"], ability: "dex" },
  { id: "stealth", label: "Stealth (Dex)", aliases: ["stealth"], ability: "dex" },
  { id: "survival", label: "Survival (Wis)", aliases: ["survival"], ability: "wis" },
];

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmtMod(n) {
  const v = toNum(n, 0);
  return v >= 0 ? `+${v}` : `${v}`;
}

function getAny(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function abilityModFromScore(score) {
  const s = toNum(score, 10);
  return Math.floor((s - 10) / 2);
}

export default function CharacterSheet5e({ selectedName, sheet, onRollSkill, lastRoll }) {
  const s = sheet || {};
  const meta = s.meta || {};

  const prof = getAny(s, ["proficiency_bonus", "prof_bonus", "profBonus"]) ?? 0;

  const abilities = s.abilities || {};
  const abilityMods = s.ability_mods || s.abilityMods || {};

  const combat = s.combat || {};
  const personality = s.personality || {};
  const attacks = Array.isArray(s.attacks) ? s.attacks : [];

  // skills can live in skills or skill_mods
  const skillsBag = s.skills || {};
  const skillModsBag = s.skill_mods || s.skillMods || {};

  function getSkillMod(def) {
    for (const a of def.aliases) {
      const v = getAny(skillsBag, [a]) ?? getAny(skillModsBag, [a]) ?? getAny(s, [a]);
      if (v !== null) return toNum(v, 0);
    }
    return 0;
  }

  const perceptionDef = SKILLS.find((k) => k.id === "perception");
  const perceptionMod = perceptionDef ? getSkillMod(perceptionDef) : 0;
  const passivePerception = 10 + perceptionMod;

  const boxStyle = {
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    padding: "10px 10px",
  };

  const sheetStyle = {
    background: "rgba(8, 10, 16, 0.70)",
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.40)",
    backdropFilter: "blur(2px)",
    overflow: "hidden",
  };

  const headerStyle = {
    background: "linear-gradient(90deg, rgba(34,23,51,0.92), rgba(62,40,95,0.92))",
    borderBottom: `1px solid ${BORDER}`,
    padding: "10px 12px",
  };

  const labelStyle = {
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: DIM,
    fontWeight: 700,
  };

  return (
    <div style={sheetStyle}>
      {/* Top header: name + meta fields (roughly matches 5e header layout) */}
      <div style={headerStyle}>
        <div className="d-flex flex-wrap gap-2 align-items-end">
          <div style={{ minWidth: 220, flex: "1 1 260px" }}>
            <div style={labelStyle}>Character Name</div>
            <div className="fw-semibold" style={{ color: "rgba(255,255,255,0.95)", fontSize: 18 }}>
              {selectedName || meta.character_name || "—"}
            </div>
          </div>

          <div style={{ flex: "2 1 380px" }}>
            <div className="row g-2">
              <div className="col-6 col-md-4">
                <div style={labelStyle}>Class & Level</div>
                <div style={{ color: MUTED }}>{meta.class_level || "—"}</div>
              </div>
              <div className="col-6 col-md-4">
                <div style={labelStyle}>Background</div>
                <div style={{ color: MUTED }}>{meta.background || s.background || "—"}</div>
              </div>
              <div className="col-6 col-md-4">
                <div style={labelStyle}>Player Name</div>
                <div style={{ color: MUTED }}>{meta.player_name || "—"}</div>
              </div>
              <div className="col-6 col-md-4">
                <div style={labelStyle}>Race</div>
                <div style={{ color: MUTED }}>{meta.race || "—"}</div>
              </div>
              <div className="col-6 col-md-4">
                <div style={labelStyle}>Alignment</div>
                <div style={{ color: MUTED }}>{meta.alignment || "—"}</div>
              </div>
              <div className="col-6 col-md-4">
                <div style={labelStyle}>Experience Points</div>
                <div style={{ color: MUTED }}>{meta.experience_points || "—"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body: three columns (left stats/skills, middle combat, right personality) */}
      <div className="p-2">
        <div className="row g-2">
          {/* LEFT */}
          <div className="col-12 col-lg-4">
            {/* Abilities */}
            <div className="d-grid gap-2">
              {ABILITIES.map((a) => {
                const score = getAny(abilities, [a.key]) ?? 10;
                const mod = getAny(abilityMods, [a.key]) ?? abilityModFromScore(score);
                return (
                  <div key={a.key} style={boxStyle}>
                    <div className="d-flex align-items-center">
                      <div>
                        <div style={labelStyle}>{a.label}</div>
                        <div className="fw-semibold" style={{ color: "rgba(255,255,255,0.95)" }}>
                          {toNum(score, 10)}
                        </div>
                      </div>
                      <div className="ms-auto text-center" style={{ minWidth: 64 }}>
                        <div style={labelStyle}>Mod</div>
                        <div className="fw-semibold" style={{ color: "rgba(255,255,255,0.95)" }}>
                          {fmtMod(mod)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Proficiency + Passive Perception */}
              <div style={boxStyle}>
                <div className="d-flex justify-content-between">
                  <div>
                    <div style={labelStyle}>Proficiency Bonus</div>
                    <div className="fw-semibold" style={{ color: "rgba(255,255,255,0.95)" }}>
                      {fmtMod(prof)}
                    </div>
                  </div>
                  <div className="text-end">
                    <div style={labelStyle}>Passive Perception</div>
                    <div className="fw-semibold" style={{ color: "rgba(255,255,255,0.95)" }}>
                      {passivePerception}
                    </div>
                  </div>
                </div>
              </div>

              {/* Skills */}
              <div style={boxStyle}>
                <div className="d-flex align-items-center mb-2">
                  <div className="fw-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>
                    Skills
                  </div>
                  <div className="ms-auto small" style={{ color: DIM }}>
                    Click to roll d20 + mod
                  </div>
                </div>

                <div className="row g-2">
                  {SKILLS.map((def) => {
                    const mod = getSkillMod(def);
                    return (
                      <div key={def.id} className="col-12 col-md-6">
                        <button
                          type="button"
                          className="btn btn-sm w-100 text-start"
                          style={{
                            border: "1px solid rgba(255, 184, 77, 0.75)",
                            background: "rgba(0,0,0,0.20)",
                            color: "rgba(255,255,255,0.92)",
                          }}
                          onClick={() => onRollSkill?.(def.label, mod)}
                          title={`Roll ${def.label}`}
                        >
                          <div className="d-flex align-items-center">
                            <span>{def.label}</span>
                            <span className="ms-auto fw-semibold">{fmtMod(mod)}</span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {lastRoll && (
                  <div className="mt-2 p-2 rounded" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
                    <div className="small" style={{ color: "rgba(255,255,255,0.92)" }}>
                      <span className="fw-semibold">{lastRoll.type}</span>: d20 {lastRoll.roll} {lastRoll.mod >= 0 ? "+" : "-"}{" "}
                      {Math.abs(lastRoll.mod)} = <span className="fw-semibold">{lastRoll.total}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* MIDDLE */}
          <div className="col-12 col-lg-4">
            <div className="d-grid gap-2">
              <div style={boxStyle}>
                <div className="row g-2">
                  <div className="col-4">
                    <div style={labelStyle}>Armor Class</div>
                    <div className="fw-semibold">{toNum(getAny(combat, ["ac"]), 0)}</div>
                  </div>
                  <div className="col-4">
                    <div style={labelStyle}>Initiative</div>
                    <div className="fw-semibold">{fmtMod(toNum(getAny(combat, ["initiative"]), 0))}</div>
                  </div>
                  <div className="col-4">
                    <div style={labelStyle}>Speed</div>
                    <div className="fw-semibold">{toNum(getAny(combat, ["speed"]), 0)}</div>
                  </div>
                </div>
              </div>

              <div style={boxStyle}>
                <div style={labelStyle}>Hit Points</div>
                <div className="row g-2">
                  <div className="col-4">
                    <div className="small" style={{ color: DIM }}>Max</div>
                    <div className="fw-semibold">{toNum(getAny(combat, ["hp_max", "hpMax"]), 0)}</div>
                  </div>
                  <div className="col-4">
                    <div className="small" style={{ color: DIM }}>Current</div>
                    <div className="fw-semibold">{toNum(getAny(combat, ["hp_current", "hpCurrent"]), 0)}</div>
                  </div>
                  <div className="col-4">
                    <div className="small" style={{ color: DIM }}>Temp</div>
                    <div className="fw-semibold">{toNum(getAny(combat, ["hp_temp", "hpTemp"]), 0)}</div>
                  </div>
                </div>
              </div>

              <div style={boxStyle}>
                <div className="row g-2">
                  <div className="col-6">
                    <div style={labelStyle}>Hit Dice</div>
                    <div className="fw-semibold" style={{ color: MUTED }}>{getAny(combat, ["hit_dice", "hitDice"]) || "—"}</div>
                  </div>
                  <div className="col-6">
                    <div style={labelStyle}>Death Saves</div>
                    <div className="small" style={{ color: DIM }}>
                      (wire later)
                    </div>
                  </div>
                </div>
              </div>

              <div style={boxStyle}>
                <div className="d-flex align-items-center">
                  <div className="fw-semibold">Attacks & Spellcasting</div>
                </div>
                <div className="mt-2 d-grid gap-2">
                  {[0, 1, 2].map((i) => {
                    const atk = attacks[i] || {};
                    return (
                      <div key={i} className="p-2 rounded" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
                        <div className="d-flex">
                          <div className="fw-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>{atk.name || "—"}</div>
                          <div className="ms-auto small" style={{ color: DIM }}>{atk.atk || ""}</div>
                        </div>
                        <div className="small" style={{ color: DIM }}>
                          {(atk.dmg || "").trim()} {atk.type ? `(${atk.type})` : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="col-12 col-lg-4">
            <div className="d-grid gap-2">
              <div style={boxStyle}>
                <div style={labelStyle}>Personality Traits</div>
                <div style={{ color: MUTED, whiteSpace: "pre-wrap" }}>{personality.traits || "—"}</div>
              </div>
              <div style={boxStyle}>
                <div style={labelStyle}>Ideals</div>
                <div style={{ color: MUTED, whiteSpace: "pre-wrap" }}>{personality.ideals || "—"}</div>
              </div>
              <div style={boxStyle}>
                <div style={labelStyle}>Bonds</div>
                <div style={{ color: MUTED, whiteSpace: "pre-wrap" }}>{personality.bonds || "—"}</div>
              </div>
              <div style={boxStyle}>
                <div style={labelStyle}>Flaws</div>
                <div style={{ color: MUTED, whiteSpace: "pre-wrap" }}>{personality.flaws || "—"}</div>
              </div>

              <div style={boxStyle}>
                <div style={labelStyle}>Sheet JSON (debug)</div>
                <details>
                  <summary className="small" style={{ color: DIM, cursor: "pointer" }}>View raw sheet JSON</summary>
                  <pre className="mt-2 mb-0" style={{ fontSize: 12, color: "rgba(255,255,255,0.88)" }}>
{JSON.stringify(s, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="row g-2 mt-2">
          <div className="col-12 col-lg-4">
            <div style={boxStyle}>
              <div style={labelStyle}>Other Proficiencies & Languages</div>
              <div style={{ color: MUTED, whiteSpace: "pre-wrap" }}>{s.proficiencies_languages || s.proficienciesLanguages || "—"}</div>
            </div>
          </div>
          <div className="col-12 col-lg-4">
            <div style={boxStyle}>
              <div style={labelStyle}>Equipment</div>
              <div style={{ color: MUTED, whiteSpace: "pre-wrap" }}>{s.equipment || "—"}</div>
            </div>
          </div>
          <div className="col-12 col-lg-4">
            <div style={boxStyle}>
              <div style={labelStyle}>Features & Traits</div>
              <div style={{ color: MUTED, whiteSpace: "pre-wrap" }}>{s.features_traits || s.featuresTraits || "—"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

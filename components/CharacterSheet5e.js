import { useEffect, useMemo, useState } from "react";

const ABILITIES = [
  { key: "str", name: "Strength" },
  { key: "dex", name: "Dexterity" },
  { key: "con", name: "Constitution" },
  { key: "int", name: "Intelligence" },
  { key: "wis", name: "Wisdom" },
  { key: "cha", name: "Charisma" },
];

const ABIL_ORDER = ABILITIES.map((a) => a.key);

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

function clampInt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.round(v));
}

function modFromScore(score) {
  return Math.floor((Number(score) - 10) / 2);
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function roll4d6DropLowest() {
  const rolls = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)].sort((a, b) => a - b);
  return rolls[1] + rolls[2] + rolls[3];
}

function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function fmtMod(n) {
  const v = Number(n) || 0;
  return v >= 0 ? `+${v}` : `${v}`;
}

function safeStr(v) {
  return String(v ?? "").trim();
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
      saves: { ...(prof.saves || {}) },
      skills: { ...(prof.skills || {}) },
    },

    // Stored AC is treated as a "base/unarmored AC" input. If armor is equipped, AC is computed from gear.
    ac: s.ac ?? null,

    initiative: s.initiative ?? null,
    speed: s.speed ?? null,
    hp: s.hp ?? null,
    maxHp: s.maxHp ?? null,
    tempHp: s.tempHp ?? null,
  };
}

function truthy(obj, key) {
  return !!(obj && typeof obj === "object" && obj[key]);
}

function getRollMode({ advantage = false, disadvantage = false }) {
  if (advantage && disadvantage) return "normal";
  if (advantage) return "adv";
  if (disadvantage) return "dis";
  return "normal";
}

/**
 * CharacterSheet5e
 *
 * NOTE: Equipped items and their bonuses are NOT stored in the sheet JSON.
 * They are computed from inventory rows and passed in as `itemBonuses`.
 */
export default function CharacterSheet5e({
  sheet,
  editable = false,
  onChange,
  onRoll,

  // computed / display-only overlays
  itemBonuses = null,
  equipmentOverride = null,
  equipmentBreakdown = null,
  effectsKey = null,
}) {
  const s = useMemo(() => ensureSheetShape(sheet), [sheet]);

  // prefer computed bonuses, fallback to any stored legacy field
  const bonuses = itemBonuses || s.itemBonuses || {};

  const bonusAc = Number(bonuses.ac || 0);

  const abilityScoreBonuses = bonuses.abilities && typeof bonuses.abilities === "object" ? bonuses.abilities : {};

  const effectiveAbilityScores = useMemo(() => {
    const out = {};
    for (const a of ABILITIES) {
      const base = Number(s.abilities[a.key]?.score ?? 10);
      const add = Number(abilityScoreBonuses[a.key] ?? 0) || 0;
      out[a.key] = clampScore(base + add);
    }
    return out;
  }, [s, abilityScoreBonuses]);

  const abilityMods = useMemo(() => {
    const out = {};
    for (const a of ABILITIES) out[a.key] = modFromScore(effectiveAbilityScores[a.key] ?? 10);
    return out;
  }, [effectiveAbilityScores]);

  const pb = Number(s.proficiencyBonus) || 0;

  const adv = bonuses.advantage && typeof bonuses.advantage === "object" ? bonuses.advantage : {};
  const dis = bonuses.disadvantage && typeof bonuses.disadvantage === "object" ? bonuses.disadvantage : {};

  const equipment = bonuses.equipment && typeof bonuses.equipment === "object" ? bonuses.equipment : {};
  const armor = equipment.armor && typeof equipment.armor === "object" ? equipment.armor : null;
  const shield = equipment.shield && typeof equipment.shield === "object" ? equipment.shield : null;

  const [acOverride, setAcOverride] = useState(null);
  const [acEditing, setAcEditing] = useState(false);

  // Reset transient AC override when gear/selection changes.
  useEffect(() => {
    setAcOverride(null);
    setAcEditing(false);
  }, [effectsKey]);

  function patch(next) {
    onChange?.(next);
  }

  function setAbilityScore(key, score) {
    const next = ensureSheetShape(s);
    next.abilities[key].score = clampScore(score);
    patch(next);
  }

  function rollAllStats() {
    const next = ensureSheetShape(s);
    next.abilities = next.abilities || {};
    for (const k of ABIL_ORDER) {
      next.abilities[k] = next.abilities[k] || {};
      next.abilities[k].score = roll4d6DropLowest();
    }
    if (next.proficiencyBonus == null) next.proficiencyBonus = 2;
    patch(next);
  }

  function setSaveProficient(abilKey, nextState) {
    const next = ensureSheetShape(s);
    next.proficiencies.saves[abilKey] = {
      ...(next.proficiencies.saves[abilKey] || {}),
      proficient: !!nextState,
    };
    patch(next);
  }

  function cycleSkillTier(skillKey) {
    const next = ensureSheetShape(s);
    const flags = next.proficiencies.skills?.[skillKey] || {};
    const tier = flags.proficient ? (flags.expertise ? 2 : 1) : 0;
    const nextTier = (tier + 1) % 3;

    next.proficiencies.skills[skillKey] = {
      ...(flags || {}),
      proficient: nextTier > 0,
      expertise: nextTier === 2,
    };
    patch(next);
  }

  function getSaveMod(abilKey) {
    const isProf = !!s.proficiencies.saves?.[abilKey]?.proficient;
    const base = (abilityMods[abilKey] || 0) + (isProf ? pb : 0);

    const bonusAll = Number(bonuses.savesAll || 0);
    const bonusAbility = Number((bonuses.saves && bonuses.saves[abilKey]) || 0);

    return base + bonusAll + bonusAbility;
  }

  function getSkillMod(skillKey) {
    const meta = SKILLS.find((x) => x.key === skillKey);
    const abil = meta?.ability || "str";
    const flags = s.proficiencies.skills?.[skillKey] || {};
    const isProf = !!flags.proficient;
    const isExp = !!flags.expertise;
    const profPart = isProf ? pb * (isExp ? 2 : 1) : 0;

    const base = (abilityMods[abil] || 0) + profPart;

    const bonusAll = Number(bonuses.skillsAll || 0);
    const bonusSkill = Number((bonuses.skills && bonuses.skills[skillKey]) || 0);

    return base + bonusAll + bonusSkill;
  }

  function getSaveRollMode(abilKey) {
    const advantage = !!adv.savesAll || truthy(adv.saves, abilKey);
    const disadvantage = !!dis.savesAll || truthy(dis.saves, abilKey);
    return getRollMode({ advantage, disadvantage });
  }

  function getSkillRollMode(skillKey) {
    const advantage = !!adv.skillsAll || truthy(adv.skills, skillKey);
    const disadvantage = !!dis.skillsAll || truthy(dis.skills, skillKey);
    return getRollMode({ advantage, disadvantage });
  }

  function doRoll(label, mod, mode = "normal") {
    const m = Number(mod) || 0;

    if (mode === "adv" || mode === "dis") {
      const r1 = rollD20();
      const r2 = rollD20();
      const chosen = mode === "adv" ? Math.max(r1, r2) : Math.min(r1, r2);
      const total = chosen + m;
      onRoll?.({ label, roll: chosen, rolls: [r1, r2], chosen, mode, mod: m, total });
      return;
    }

    const roll = rollD20();
    const total = roll + m;
    onRoll?.({ label, roll, mod: m, total, mode: "normal" });
  }

  const passivePerception = 10 + getSkillMod("perception");

  function setField(key, value, isNumber = false) {
    const next = ensureSheetShape(s);
    next[key] = isNumber ? clampInt(value) : value;
    patch(next);
  }

  function ProfToggle({ state, onCycle, title, ariaLabel }) {
    const cls = state === 2 ? "is-exp" : state === 1 ? "is-prof" : "is-off";
    const spacer = !editable && state === 0;

    const content = (
      <>
        <span className="csheet-prof-mark">✓</span>
        <span className="csheet-prof-exp">x2</span>
      </>
    );

    if (!editable) {
      return (
        <div className={`csheet-prof ${cls} ${spacer ? "is-spacer" : ""}`} title={title} aria-label={ariaLabel}>
          {content}
        </div>
      );
    }

    return (
      <button type="button" className={`csheet-prof ${cls}`} onClick={onCycle} title={title} aria-label={ariaLabel}>
        {content}
      </button>
    );
  }

  const displayEquipment = editable ? (s.equipment || "") : (equipmentOverride ?? s.equipment ?? "");

  const computedAc = useMemo(() => {
    const dexMod = Number(abilityMods.dex || 0);

    const shieldBonus = Number(shield?.bonusAc || 0) || 0;

    const warnings = Array.isArray(equipment.warnings) ? equipment.warnings : [];

    if (armor) {
      const baseArmor = Number(armor.baseAc ?? armor.ac ?? 0) || 0;
      const cat = safeStr(armor.category).toLowerCase();

      let dexApplied = 0;
      if (cat === "light") dexApplied = dexMod;
      else if (cat === "medium") dexApplied = Math.min(dexMod, 2);
      else dexApplied = 0; // heavy or unknown => no Dex

      const base = baseArmor + dexApplied;
      const total = base + shieldBonus + bonusAc;

      const lines = [
        `Armor: ${safeStr(armor.name) || "(unknown)"} (base ${baseArmor}${cat === "medium" ? ", Dex max +2" : cat === "light" ? ", Dex" : ", no Dex"})`,
        `Dex applied: ${fmtMod(dexApplied)}`,
        shieldBonus ? `Shield: ${safeStr(shield?.name) || "Shield"} (+${shieldBonus})` : null,
        bonusAc ? `Magic/other AC bonus: ${fmtMod(bonusAc)}` : null,
        warnings.length ? `Warnings: ${warnings.join(" | ")}` : null,
      ].filter(Boolean);

      return { total, base, dexApplied, shieldBonus, source: "armor", tooltip: lines.join("\n") };
    }

    // No armor equipped: default to stored base AC (if any), otherwise 10 + Dex.
    const stored = s.ac;
    const storedNum = Number(stored);
    const base = Number.isFinite(storedNum) && String(stored).trim() !== "" ? storedNum : 10 + dexMod;

    const total = base + shieldBonus + bonusAc;

    const lines = [
      `Base AC: ${base}${Number.isFinite(storedNum) && String(stored).trim() !== "" ? " (from sheet)" : " (10 + Dex)"}`,
      shieldBonus ? `Shield: ${safeStr(shield?.name) || "Shield"} (+${shieldBonus})` : null,
      bonusAc ? `Magic/other AC bonus: ${fmtMod(bonusAc)}` : null,
    ].filter(Boolean);

    return { total, base, dexApplied: 0, shieldBonus, source: "base", tooltip: lines.join("\n") };
  }, [armor, shield, equipment, abilityMods, s.ac, bonusAc]);

  const displayedAc = useMemo(() => {
    if (acOverride == null || String(acOverride).trim() === "") return computedAc.total;
    const n = Number(acOverride);
    if (!Number.isFinite(n)) return computedAc.total;
    return Math.round(n);
  }, [acOverride, computedAc.total]);

  const acTitle = useMemo(() => {
    const parts = [computedAc.tooltip];
    if (acOverride != null && String(acOverride).trim() !== "") parts.push(`(Override active: ${displayedAc})`);
    return parts.filter(Boolean).join("\n\n");
  }, [computedAc.tooltip, acOverride, displayedAc]);

  const gearNotes = useMemo(() => {
    const out = [];
    const reminders = Array.isArray(equipment.reminders) ? equipment.reminders : [];
    const warnings = Array.isArray(equipment.warnings) ? equipment.warnings : [];
    if (warnings.length) out.push(`Warnings: ${warnings.join("\n")}`);
    if (reminders.length) out.push(`Notes: ${reminders.join("\n")}`);
    return out;
  }, [equipment]);

  const abilityBonusHint = useMemo(() => {
    const parts = [];
    for (const a of ABILITIES) {
      const v = Number(abilityScoreBonuses[a.key] ?? 0) || 0;
      if (!v) continue;
      parts.push(`${a.name}: ${v >= 0 ? "+" : ""}${v}`);
    }
    return parts.join(" • ");
  }, [abilityScoreBonuses]);

  return (
    <div className="csheet-body">
      <div className="csheet-grid">
        {/* Column 1 */}
        <div className="csheet-col csheet-col--abilities">
          <div className="csheet-left-top">
            <div className="csheet-pill" title="Proficiency Bonus">
              <span className="csheet-pill-lbl">PB</span>
              <span className="csheet-pill-val">{fmtMod(pb)}</span>
            </div>
          </div>

          <div className="csheet-abilities">
            {ABILITIES.map((a) => {
              const score = s.abilities[a.key]?.score ?? 10;
              const effectiveScore = effectiveAbilityScores[a.key] ?? score;
              const mod = abilityMods[a.key] ?? 0;
              const delta = (Number(effectiveScore) || 0) - (Number(score) || 0);

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
                      <div className="csheet-score csheet-score-readonly" title={delta ? `Effective score: ${effectiveScore}` : ""}>
                        {score}
                        {delta ? (
                          <span className="ms-1 small text-muted" style={{ fontWeight: 600 }}>
                            ({delta >= 0 ? "+" : ""}
                            {delta})
                          </span>
                        ) : null}
                      </div>
                    )}

                    <div
                      className="csheet-mod csheet-mod-readonly"
                      title={
                        delta
                          ? `Includes ability score bonus (effective score ${effectiveScore})`
                          : "Ability modifier"
                      }
                    >
                      {fmtMod(mod)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="csheet-left-bottom">
            <div className="csheet-pill" title="Passive Perception">
              <span className="csheet-pill-lbl">Passive Perception</span>
              <span className="csheet-pill-val">{passivePerception}</span>
            </div>

            {abilityBonusHint && !editable ? (
              <div className="small mt-2" style={{ color: "rgba(255,255,255,0.72)" }} title="Ability bonuses from equipped items">
                {abilityBonusHint}
              </div>
            ) : null}

            {editable ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-light csheet-rollstats"
                onClick={rollAllStats}
                title="Roll 4d6 drop lowest for each ability"
              >
                Roll Stats (4d6 drop low)
              </button>
            ) : null}
          </div>
        </div>

        {/* Column 2 */}
        <div className="csheet-col csheet-col--checks">
          <div className="csheet-section">
            <div className="csheet-section-title">Saving Throws</div>

            <div className="csheet-list">
              {ABILITIES.map((a) => {
                const isProf = !!s.proficiencies.saves?.[a.key]?.proficient;
                const mod = getSaveMod(a.key);
                const mode = getSaveRollMode(a.key);

                return (
                  <div key={a.key} className="csheet-row">
                    <ProfToggle
                      state={isProf ? 1 : 0}
                      onCycle={() => setSaveProficient(a.key, !isProf)}
                      title={
                        editable
                          ? isProf
                            ? "Proficient (click to turn off)"
                            : "Not proficient (click to turn on)"
                          : ""
                      }
                      ariaLabel={`${a.name} save proficiency`}
                    />

                    <button
                      type="button"
                      className="csheet-rollbtn"
                      onClick={() => doRoll(`${a.name} save`, mod, mode)}
                      title={
                        mode === "adv"
                          ? "Roll with Advantage"
                          : mode === "dis"
                          ? "Roll with Disadvantage"
                          : "Roll save (d20 + mod + PB if proficient)"
                      }
                    >
                      <span className="csheet-rollname">
                        {a.name}
                        {mode === "adv" ? <span className="badge bg-success ms-2">ADV</span> : null}
                        {mode === "dis" ? <span className="badge bg-danger ms-2">DIS</span> : null}
                      </span>
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
                const tier = flags.proficient ? (flags.expertise ? 2 : 1) : 0;
                const mod = getSkillMod(sk.key);
                const mode = getSkillRollMode(sk.key);

                return (
                  <div key={sk.key} className="csheet-row">
                    <ProfToggle
                      state={tier}
                      onCycle={() => cycleSkillTier(sk.key)}
                      title={editable ? "Cycle: proficient → expertise → off" : ""}
                      ariaLabel={`${sk.name} proficiency`}
                    />

                    <button
                      type="button"
                      className="csheet-rollbtn"
                      onClick={() => doRoll(`${sk.name} (${sk.ability.toUpperCase()})`, mod, mode)}
                      title={
                        mode === "adv"
                          ? "Roll with Advantage"
                          : mode === "dis"
                          ? "Roll with Disadvantage"
                          : "Roll skill (d20 + ability mod + PB if proficient; double PB if expertise)"
                      }
                    >
                      <span className="csheet-rollname">
                        {sk.name} <span className="csheet-sub">({sk.ability.toUpperCase()})</span>
                        {mode === "adv" ? <span className="badge bg-success ms-2">ADV</span> : null}
                        {mode === "dis" ? <span className="badge bg-danger ms-2">DIS</span> : null}
                      </span>
                      <span className="csheet-rollmod">{fmtMod(mod)}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Column 3 */}
        <div className="csheet-col csheet-col--combat">
          <div className="csheet-section">
            <div className="csheet-section-title">Combat</div>

            <div className="csheet-combat-grid">
              <div className="csheet-mini">
                <div className="csheet-mini-lbl">AC</div>

                {acEditing ? (
                  <input
                    className="csheet-mini-inp"
                    type="number"
                    value={acOverride == null ? String(computedAc.total) : String(acOverride)}
                    onChange={(e) => setAcOverride(e.target.value)}
                    onBlur={() => setAcEditing(false)}
                    autoFocus
                  />
                ) : (
                  <div
                    className="csheet-mini-val"
                    title={acTitle}
                    style={{ cursor: "pointer" }}
                    onClick={() => setAcEditing(true)}
                  >
                    {displayedAc}
                    {acOverride != null && String(acOverride).trim() !== "" ? (
                      <span className="ms-2 small" style={{ color: "rgba(255,255,255,0.72)" }}>
                        (override)
                      </span>
                    ) : null}
                  </div>
                )}

                {acOverride != null && String(acOverride).trim() !== "" ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-light mt-2"
                    onClick={() => setAcOverride(null)}
                    title="Reset to computed AC"
                  >
                    Reset
                  </button>
                ) : null}

                {editable ? (
                  <div className="mt-2">
                    <div className="small" style={{ color: "rgba(255,255,255,0.72)" }}>
                      Base AC (no armor)
                    </div>
                    <input
                      className="csheet-mini-inp"
                      type="number"
                      value={s.ac ?? ""}
                      onChange={(e) => setField("ac", e.target.value, true)}
                      placeholder="10 + Dex"
                      title="Used only when no armor is equipped. For special cases (Monk/Barbarian), set the base here."
                    />
                  </div>
                ) : null}
              </div>

              <div className="csheet-mini">
                <div className="csheet-mini-lbl">Initiative</div>
                {editable ? (
                  <input
                    className="csheet-mini-inp"
                    type="number"
                    value={s.initiative ?? ""}
                    onChange={(e) => setField("initiative", e.target.value, true)}
                  />
                ) : (
                  <div className="csheet-mini-val">{s.initiative ?? "—"}</div>
                )}
              </div>

              <div className="csheet-mini">
                <div className="csheet-mini-lbl">Speed</div>
                {editable ? (
                  <input
                    className="csheet-mini-inp"
                    type="number"
                    value={s.speed ?? ""}
                    onChange={(e) => setField("speed", e.target.value, true)}
                  />
                ) : (
                  <div className="csheet-mini-val">{s.speed ?? "—"}</div>
                )}
              </div>
            </div>

            <div className="csheet-hp">
              <div className="csheet-hp-lbl">HP (Max / Current / Temp)</div>
              {editable ? (
                <div className="csheet-hp-row">
                  <input
                    className="csheet-hp-inp"
                    type="number"
                    value={s.maxHp ?? ""}
                    onChange={(e) => setField("maxHp", e.target.value, true)}
                    placeholder="Max"
                  />
                  <input
                    className="csheet-hp-inp"
                    type="number"
                    value={s.hp ?? ""}
                    onChange={(e) => setField("hp", e.target.value, true)}
                    placeholder="Current"
                  />
                  <input
                    className="csheet-hp-inp"
                    type="number"
                    value={s.tempHp ?? ""}
                    onChange={(e) => setField("tempHp", e.target.value, true)}
                    placeholder="Temp"
                  />
                </div>
              ) : (
                <div className="csheet-hp-read">
                  {String(s.maxHp ?? "—")} / {String(s.hp ?? "—")} / {String(s.tempHp ?? "—")}
                </div>
              )}
            </div>
          </div>

          <div className="csheet-section">
            <div className="csheet-section-title">Attacks &amp; Spellcasting</div>
            {editable ? (
              <textarea
                className="csheet-textarea"
                rows={4}
                value={s.attacks || ""}
                onChange={(e) => setField("attacks", e.target.value)}
                placeholder="—"
              />
            ) : (
              <div className="csheet-text" style={{ whiteSpace: "pre-wrap" }}>
                {s.attacks || "—"}
              </div>
            )}
          </div>

          <div className="csheet-section">
            <div className="csheet-section-title">Equipment</div>

            {editable ? (
              <textarea
                className="csheet-textarea"
                rows={4}
                value={s.equipment || ""}
                onChange={(e) => setField("equipment", e.target.value)}
                placeholder="—"
              />
            ) : (
              <>
                <div className="csheet-text" style={{ whiteSpace: "pre-wrap" }}>
                  {displayEquipment ? displayEquipment : "—"}
                </div>

                {Array.isArray(gearNotes) && gearNotes.length ? (
                  <div className="small mt-2" style={{ whiteSpace: "pre-wrap", color: "rgba(255,255,255,0.72)" }}>
                    {gearNotes.join("\n\n")}
                  </div>
                ) : null}

                {Array.isArray(equipmentBreakdown) && equipmentBreakdown.length > 0 ? (
                  <details className="mt-2">
                    <summary style={{ cursor: "pointer" }}>Bonuses / effects from equipped items</summary>
                    <div className="mt-2" style={{ whiteSpace: "pre-wrap" }}>
                      {equipmentBreakdown.join("\n")}
                    </div>
                  </details>
                ) : null}
              </>
            )}
          </div>

          <div className="csheet-section">
            <div className="csheet-section-title">Feats &amp; Traits</div>
            {editable ? (
              <textarea
                className="csheet-textarea"
                rows={6}
                value={s.featsTraits || ""}
                onChange={(e) => setField("featsTraits", e.target.value)}
                placeholder="—"
              />
            ) : (
              <div className="csheet-text" style={{ whiteSpace: "pre-wrap" }}>
                {s.featsTraits || "—"}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="csheet-hint">
        Click any Saving Throw or Skill to roll. Rolls use: <b>d20 + mod + proficiency</b> (if proficient). Advantage/disadvantage is applied when granted by equipped gear.
      </div>
    </div>
  );
}

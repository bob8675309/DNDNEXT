import { useEffect, useId, useMemo, useState } from "react";
import {
  calculateArmorClass,
  calculateInitiativeModifier,
  calculatePassivePerception,
  hasStoredBaseAc,
  resolveClassUnarmoredDefense,
} from "../utils/characterSheetRules";
import {
  buildCharacterSheetActions,
  resolveCharacterSheetActionMode,
  rollCharacterSheetDamage,
} from "../utils/characterSheetActions";
import { formatCharacterSheetFeatureText } from "../utils/characterSheetFeatures";

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

    // Stored AC is an optional complete alternative unarmored base calculation.
    // Missing, blank, or zero values fall back to the standard 10 + Dexterity modifier.
    ac: (s.ac === 0 || (typeof s.ac === "string" && s.ac.trim() === "0")) ? null : (s.ac ?? null),

    // Initiative here is an optional extra initiative bonus, not the full modifier.
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

function CollapsibleSheetSection({ title, className = "", children }) {
  const [expanded, setExpanded] = useState(true);
  const bodyId = useId();

  return (
    <section className={`csheet-section ${className} ${expanded ? "" : "is-collapsed"}`.trim()}>
      <button
        type="button"
        className="csheet-section-title csheet-section-toggle"
        aria-controls={bodyId}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        title={`${expanded ? "Collapse" : "Expand"} ${title}`}
      >
        <span>{title}</span>
        <span className="csheet-section-chevron" aria-hidden="true" />
      </button>
      <div id={bodyId} className="csheet-section-body" hidden={!expanded}>
        {children}
      </div>
    </section>
  );
}

function CollapsibleActionGroup({ title, children }) {
  const [expanded, setExpanded] = useState(true);
  const bodyId = useId();

  return (
    <div className={`csheet-action-group ${expanded ? "" : "is-collapsed"}`.trim()}>
      <button
        type="button"
        className="csheet-action-group__label"
        aria-controls={bodyId}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        title={`${expanded ? "Collapse" : "Expand"} ${title}`}
      >
        <span>{title}</span>
        <span className="csheet-action-group__chevron" aria-hidden="true" />
      </button>
      <div id={bodyId} className="csheet-action-group__body" hidden={!expanded}>
        {children}
      </div>
    </div>
  );
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
  effectsKey = null,
  inventoryItems = [],
  spellActions = [],
  featureRows = [],
  actionsLoading = false,
  onActionCommand = null,
  actionBusyKey = "",
}) {
  const s = useMemo(() => ensureSheetShape(sheet), [sheet]);

  // prefer computed bonuses, fallback to any stored legacy field
  const bonuses = itemBonuses || s.itemBonuses || {};

  const bonusAc = Number(bonuses.ac || 0);

  const abilityScoreBonuses = bonuses.abilities && typeof bonuses.abilities === "object" ? bonuses.abilities : {};
  const abilityModBonuses = bonuses.abilityMods && typeof bonuses.abilityMods === "object" ? bonuses.abilityMods : {};

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
    for (const a of ABILITIES) {
      const base = modFromScore(effectiveAbilityScores[a.key] ?? 10);
      const add = Number(abilityModBonuses[a.key] ?? 0) || 0;
      out[a.key] = base + add;
    }
    return out;
  }, [effectiveAbilityScores, abilityModBonuses]);

  const pb = Number(s.proficiencyBonus) || 0;

  const adv = bonuses.advantage && typeof bonuses.advantage === "object" ? bonuses.advantage : {};
  const dis = bonuses.disadvantage && typeof bonuses.disadvantage === "object" ? bonuses.disadvantage : {};

  const equipment = bonuses.equipment && typeof bonuses.equipment === "object" ? bonuses.equipment : {};
  const armor = equipment.armor && typeof equipment.armor === "object" ? equipment.armor : null;
  const shield = equipment.shield && typeof equipment.shield === "object" ? equipment.shield : null;

  // Initiative is a Dexterity check: effective Dex modifier plus initiative-only bonuses.
  // Dexterity saving-throw proficiency and save bonuses do not apply.
  const initiativeBonusFromGear = Number(bonuses.initiative || 0) || 0;
  const initiativeBonusFromSheet = Number(s.initiative || 0) || 0;
  const computedInitiativeMod = calculateInitiativeModifier({
    dexterityModifier: abilityMods.dex,
    gearBonus: initiativeBonusFromGear,
    sheetBonus: initiativeBonusFromSheet,
  });

  const initiativeTitle = useMemo(() => {
    const parts = [
      `Initiative roll: d20 + Dexterity modifier + initiative-only bonuses`,
      `Dexterity modifier: ${fmtMod(abilityMods.dex || 0)}`,
      initiativeBonusFromGear ? `Initiative-only gear bonus: ${fmtMod(initiativeBonusFromGear)}` : null,
      initiativeBonusFromSheet ? `Initiative-only sheet bonus: ${fmtMod(initiativeBonusFromSheet)}` : null,
      `Total initiative modifier: ${fmtMod(computedInitiativeMod)}`,
    ].filter(Boolean);
    return parts.join("\n");
  }, [abilityMods.dex, initiativeBonusFromGear, initiativeBonusFromSheet, computedInitiativeMod]);

  const [acOverride, setAcOverride] = useState(null);
  const [acEditing, setAcEditing] = useState(false);
  const [oneOffAdvantage, setOneOffAdvantage] = useState(false);
  const [expandedActionId, setExpandedActionId] = useState("");
  const [actionModeById, setActionModeById] = useState({});

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

  function doRoll(label, mod, mode = "normal", extra = {}) {
    const m = Number(mod) || 0;

    const useOneOff = oneOffAdvantage;
    const finalMode = getRollMode({
      advantage: mode === "adv" || useOneOff,
      disadvantage: mode === "dis",
    });

    if (useOneOff) setOneOffAdvantage(false);

    if (finalMode === "adv" || finalMode === "dis") {
      const r1 = rollD20();
      const r2 = rollD20();
      const chosen = finalMode === "adv" ? Math.max(r1, r2) : Math.min(r1, r2);
      const total = chosen + m;
      onRoll?.({ label, roll: chosen, rolls: [r1, r2], chosen, mode: finalMode, mod: m, total, oneOffAdvantageUsed: useOneOff, ...extra });
      return;
    }

    const roll = rollD20();
    const total = roll + m;
    onRoll?.({ label, roll, mod: m, total, mode: "normal", oneOffAdvantageUsed: useOneOff, ...extra });
  }

  const perceptionCheckBonus = getSkillMod("perception");
  const perceptionRollMode = getSkillRollMode("perception");
  const passivePerception = calculatePassivePerception(perceptionCheckBonus, perceptionRollMode);
  const passivePerceptionTitle = [
    `Passive Perception: 10 + Wisdom (Perception) check bonus`,
    `Perception check bonus: ${fmtMod(perceptionCheckBonus)}`,
    perceptionRollMode === "adv" ? `Advantage adjustment: +5` : null,
    perceptionRollMode === "dis" ? `Disadvantage adjustment: -5` : null,
    `Total: ${passivePerception}`,
  ].filter(Boolean).join("\n");

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

  const unarmoredDefense = useMemo(
    () => resolveClassUnarmoredDefense(s, abilityMods),
    [s, abilityMods]
  );

  const sheetActions = useMemo(() => buildCharacterSheetActions({
    sheet: s,
    inventoryRows: inventoryItems,
    spellRows: spellActions,
    featureRows,
    abilityModifiers: abilityMods,
    proficiencyBonus: pb,
  }), [abilityMods, featureRows, inventoryItems, pb, s, spellActions]);

  const groupedSheetActions = useMemo(() => {
    const groups = new Map();
    for (const action of sheetActions) {
      if (!groups.has(action.group)) groups.set(action.group, []);
      groups.get(action.group).push(action);
    }
    return [...groups.entries()];
  }, [sheetActions]);

  function resolveSheetAction(action) {
    if (action?.kind === "feature-toggle") {
      onActionCommand?.(action, action.active ? "deactivate" : "activate");
      return;
    }
    if (
      action?.attackBonus !== null &&
      action?.attackBonus !== undefined &&
      Number.isFinite(Number(action.attackBonus))
    ) {
      const damageRoll = rollCharacterSheetDamage(action.damageFormula);
      doRoll(`${action.rollLabel || action.label} attack`, Number(action.attackBonus), "normal", {
        kind: "attack",
        actionKind: action.kind,
        actionMode: action.mode || null,
        damage: damageRoll ? { ...damageRoll, type: action.damageType || "" } : null,
      });
      return;
    }
    onRoll?.({
      label: action?.label || "Action",
      kind: action?.kind || "action",
      summary: action?.resolutionText || `${action?.label || "Action"}: ${action?.detail || "Resolve this action."}`,
    });
  }

  function cycleActionMode(action) {
    const modes = Array.isArray(action?.modes) ? action.modes : [];
    if (modes.length < 2) return;
    const currentMode = actionModeById[action.id] || action.defaultMode || modes[0].mode;
    const currentIndex = Math.max(0, modes.findIndex((entry) => entry.mode === currentMode));
    const nextMode = modes[(currentIndex + 1) % modes.length]?.mode || modes[0].mode;
    setActionModeById((current) => ({ ...current, [action.id]: nextMode }));
  }

  const displayFeatureText = useMemo(
    () => formatCharacterSheetFeatureText(featureRows, s.featsTraits),
    [featureRows, s.featsTraits]
  );

  const computedAc = useMemo(() => {
    const dexMod = Number(abilityMods.dex || 0);
    const shieldBonus = Number(shield?.bonusAc || 0) || 0;
    const warnings = Array.isArray(equipment.warnings) ? equipment.warnings : [];
    const result = calculateArmorClass({
      storedBaseAc: s.ac,
      dexterityModifier: dexMod,
      unarmoredDefenseModifier: unarmoredDefense.modifier,
      unarmoredDefenseLabel: unarmoredDefense.label,
      armor,
      shieldBonus,
      otherBonus: bonusAc,
    });

    if (armor) {
      const baseArmor = Number(armor.baseAc ?? armor.ac ?? 0) || 0;
      const cat = safeStr(armor.category).toLowerCase();
      const lines = [
        `Armor: ${safeStr(armor.name) || "(unknown)"} (base ${baseArmor}${cat === "medium" ? ", Dex max +2" : cat === "light" ? ", Dex" : ", no Dex"})`,
        `Dex applied: ${fmtMod(result.dexApplied)}`,
        shieldBonus ? `Shield: ${safeStr(shield?.name) || "Shield"} (${fmtMod(shieldBonus)})` : null,
        bonusAc ? `Magic/other AC bonus: ${fmtMod(bonusAc)}` : null,
        warnings.length ? `Warnings: ${warnings.join(" | ")}` : null,
      ].filter(Boolean);
      return { ...result, tooltip: lines.join("\n") };
    }

    const lines = [
      `Base AC: ${result.base}${result.usedStoredBaseAc ? " (alternative base from sheet)" : result.unarmoredDefenseLabel ? ` (${result.unarmoredDefenseLabel})` : " (10 + Dex)"}`,
      !result.usedStoredBaseAc ? `Dex applied: ${fmtMod(result.dexApplied)}` : null,
      result.unarmoredDefenseModifier ? `${String(unarmoredDefense.ability || "").toUpperCase()} applied: ${fmtMod(result.unarmoredDefenseModifier)}` : null,
      shieldBonus ? `Shield: ${safeStr(shield?.name) || "Shield"} (${fmtMod(shieldBonus)})` : null,
      bonusAc ? `Magic/other AC bonus: ${fmtMod(bonusAc)}` : null,
    ].filter(Boolean);
    return { ...result, tooltip: lines.join("\n") };
  }, [armor, shield, equipment, abilityMods, s.ac, bonusAc, unarmoredDefense]);

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

  const abilityBonusHint = useMemo(() => {
    const parts = [];
    for (const a of ABILITIES) {
      const scoreBonus = Number(abilityScoreBonuses[a.key] ?? 0) || 0;
      const modBonus = Number(abilityModBonuses[a.key] ?? 0) || 0;
      if (!scoreBonus && !modBonus) continue;

      const seg = [];
      if (scoreBonus) seg.push(`${scoreBonus >= 0 ? "+" : ""}${scoreBonus} score`);
      if (modBonus) seg.push(`${modBonus >= 0 ? "+" : ""}${modBonus} mod`);
      parts.push(`${a.name}: ${seg.join(", ")}`);
    }
    return parts.join(" • ");
  }, [abilityScoreBonuses, abilityModBonuses]);

  return (
    <div className="csheet-body">
      <div className="csheet-grid">
        <div className="csheet-left-workspace">
          {/* Abilities */}
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
              const deltaScore = (Number(effectiveScore) || 0) - (Number(score) || 0);
              const deltaMod = Number(abilityModBonuses[a.key] ?? 0) || 0;

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
                      <div
                        className="csheet-score csheet-score-readonly"
                        title={deltaScore ? `Effective score: ${effectiveScore}` : ""}
                      >
                        {score}
                        {deltaScore ? (
                          <span className="ms-1 small text-muted" style={{ fontWeight: 600 }}>
                            ({deltaScore >= 0 ? "+" : ""}
                            {deltaScore})
                          </span>
                        ) : null}
                      </div>
                    )}

                    <div
                      className="csheet-mod csheet-mod-readonly"
                      title={deltaMod ? `Includes ability mod bonus: ${fmtMod(deltaMod)}` : "Ability modifier"}
                    >
                      {fmtMod(mod)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="csheet-left-bottom">
            <div className="csheet-pill" title={passivePerceptionTitle}>
              <span className="csheet-pill-lbl">Passive Perception</span>
              <span className="csheet-pill-val">{passivePerception}</span>
            </div>

            {!editable ? (
              <button
                type="button"
                className={`csheet-pill csheet-pill--toggle mt-2 ${oneOffAdvantage ? "is-on" : ""}`}
                onClick={() => setOneOffAdvantage((v) => !v)}
                aria-pressed={oneOffAdvantage ? "true" : "false"}
                title="Toggle advantage for the next d20 roll you click (skills, saves, initiative). Consumes after 1 roll."
              >
                <span className="csheet-pill-lbl">Advantage</span>
                <span className="csheet-pill-val">Next Roll</span>
              </button>
            ) : null}

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

          {/* Saves and skills */}
          <div className="csheet-col csheet-col--checks">
          <CollapsibleSheetSection title="Saving Throws">
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
          </CollapsibleSheetSection>

          <CollapsibleSheetSection title="Skills">
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
          </CollapsibleSheetSection>

          </div>

          <CollapsibleSheetSection title="Description" className="csheet-section--description">
            <div className="csheet-description-slot" aria-label="Pinned sheet description" />
          </CollapsibleSheetSection>
        </div>

        {/* Combat and actions */}
        <div className="csheet-col csheet-col--combat">
          <CollapsibleSheetSection title="Combat">
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
                      Alternative AC (no armor)
                    </div>
                    <input
                      className="csheet-mini-inp"
                      type="number"
                      value={s.ac ?? ""}
                      onChange={(e) => setField("ac", e.target.value, true)}
                      placeholder="10 + Dex"
                      title="Leave blank for 10 + Dexterity. Set only when a feature provides a different complete unarmored AC calculation."
                    />
                  </div>
                ) : null}
              </div>

              <div className="csheet-mini">
                <div className="csheet-mini-lbl">Initiative</div>

                {editable ? (
                  <div>
                    <div className="csheet-mini-val" title={initiativeTitle}>
                      {fmtMod(computedInitiativeMod)}
                    </div>
                    <div className="small mt-2" style={{ color: "rgba(255,255,255,0.72)" }}>
                      Extra init bonus
                    </div>
                    <input
                      className="csheet-mini-inp"
                      type="number"
                      value={s.initiative ?? ""}
                      onChange={(e) => setField("initiative", e.target.value, true)}
                      placeholder="0"
                      title="Optional extra initiative bonus added to the effective Dexterity modifier."
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="csheet-mini-val"
                    style={{ cursor: "pointer", width: "100%", border: "none", background: "transparent", padding: 0, textAlign: "center" }}
                    title={initiativeTitle}
                    onClick={() => doRoll("Initiative", computedInitiativeMod, "normal")}
                  >
                    {fmtMod(computedInitiativeMod)}
                  </button>
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
          </CollapsibleSheetSection>

          <CollapsibleSheetSection title="Attacks & Spellcasting">
            {actionsLoading ? (
              <div className="csheet-text text-muted">Loading combat actions…</div>
            ) : groupedSheetActions.length ? (
              <div className="csheet-action-list" aria-label="Available attacks, spells, and combat abilities">
                {groupedSheetActions.map(([group, actions]) => (
                  <CollapsibleActionGroup key={group} title={group}>
                    {actions.map((action) => {
                      const expanded = expandedActionId === action.id;
                      const busy = actionBusyKey === action.id;
                      const needsCommandAdapter = action.kind === "feature-toggle";
                      const selectedMode = actionModeById[action.id] || action.defaultMode || action.modes?.[0]?.mode || "";
                      const resolvedAction = resolveCharacterSheetActionMode(action, selectedMode);
                      const hasModeToggle = Array.isArray(action.modes) && action.modes.length > 1;
                      const nextMode = hasModeToggle
                        ? action.modes[(Math.max(0, action.modes.findIndex((entry) => entry.mode === resolvedAction.mode)) + 1) % action.modes.length]
                        : null;
                      return (
                        <div className={`csheet-action-item ${action.active ? "is-active" : ""}`} key={action.id}>
                          <div className="csheet-action-row">
                            <button
                              type="button"
                              className="csheet-action-button"
                              onClick={() => resolveSheetAction(resolvedAction)}
                              disabled={busy || (needsCommandAdapter && typeof onActionCommand !== "function")}
                              title={needsCommandAdapter
                                ? action.primaryLabel
                                : resolvedAction.attackBonus !== null && resolvedAction.attackBonus !== undefined && Number.isFinite(Number(resolvedAction.attackBonus))
                                  ? `Roll ${resolvedAction.rollLabel || action.label} attack and damage`
                                  : `Show ${action.label} resolution`}
                            >
                              <span className="csheet-action-button__name">{action.label}</span>
                              <span className="csheet-action-button__detail">{resolvedAction.summary || resolvedAction.detail}</span>
                            </button>
                            <div className="csheet-action-controls">
                              {hasModeToggle ? (
                                <button
                                  type="button"
                                  className={`csheet-action-mode-pill is-${resolvedAction.mode}`}
                                  onClick={() => cycleActionMode(action)}
                                  aria-label={`Switch ${action.label} to ${nextMode?.modeLabel || "next"} mode`}
                                  title={`Currently ${resolvedAction.modeLabel}. Switch to ${nextMode?.modeLabel || "the next mode"}.`}
                                >
                                  {resolvedAction.modeLabel}
                                </button>
                              ) : null}
                              <span className="csheet-action-button__tag">{action.statusLabel || (action.equipped ? "Equipped" : "Carried")}</span>
                              <button
                                type="button"
                                className="csheet-action-details-button"
                                aria-expanded={expanded}
                                onClick={() => setExpandedActionId(expanded ? "" : action.id)}
                              >
                                Details
                              </button>
                            </div>
                          </div>
                          {expanded ? (
                            <div className="csheet-action-details">
                              {resolvedAction.description ? <p>{resolvedAction.description}</p> : null}
                              {Array.isArray(resolvedAction.details) && resolvedAction.details.length ? (
                                <ul>{resolvedAction.details.map((line, index) => <li key={`${action.id}-detail-${index}`}>{line}</li>)}</ul>
                              ) : null}
                              {action.resettable && typeof onActionCommand === "function" ? (
                                <button type="button" disabled={busy} onClick={() => onActionCommand(action, "reset")}>Reset uses</button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </CollapsibleActionGroup>
                ))}
              </div>
            ) : (
              <div className="csheet-text text-muted">No weapon, cantrip, prepared-spell, or activatable-feature actions are available.</div>
            )}
          </CollapsibleSheetSection>

          <CollapsibleSheetSection title="Feats & Traits" className="csheet-section--traits">
            <div className="csheet-traits-scroll">
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
                  {displayFeatureText || "—"}
                </div>
              )}
            </div>
          </CollapsibleSheetSection>
        </div>
      </div>
    </div>
  );
}

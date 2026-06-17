import { useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { PROFESSION_DEFINITIONS, PROFESSION_KEYS } from "../utils/craftingProfessions";
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  BACKGROUND_DEFINITIONS,
  BACKGROUND_KEYS,
  CLASS_DEFINITIONS,
  CLASS_KEYS,
  FEAT_OPTIONS,
  SKILL_DEFINITIONS,
  SPECIES_DEFINITIONS,
  SPECIES_KEYS,
  applyBackgroundAbilityBoosts,
  buildCharacterCreatePayload,
  buildCharacterSheetFromDraft,
  defaultBackgroundBoosts,
  rollAbilitySet,
  standardAbilityScores,
  validateCharacterDraft,
} from "../utils/characterCreation";

const STEP_LABELS = Object.freeze([
  "Identity",
  "Origin",
  "Class",
  "Abilities",
  "Training",
  "Story & Shop",
  "Review",
]);

const EMPTY_PROFESSIONS = Object.freeze(Object.fromEntries(PROFESSION_KEYS.map((key) => [key, {
  rank: 0,
  ability: PROFESSION_DEFINITIONS[key].abilities[0],
  offersService: false,
}])));

function initialDraft() {
  return {
    name: "",
    kind: "npc",
    role: "",
    affiliation: "",
    speciesKey: "",
    customSpecies: "",
    lineage: "",
    backgroundKey: "",
    customBackground: "",
    classKey: "civilian",
    level: 1,
    abilityMethod: "standard",
    baseAbilities: standardAbilityScores("civilian"),
    backgroundBoosts: defaultBackgroundBoosts("custom", "civilian"),
    selectedClassSkills: [],
    expertiseSkills: [],
    professions: JSON.parse(JSON.stringify(EMPTY_PROFESSIONS)),
    additionalFeats: [],
    extraTraits: [],
    preparedSpellsText: "",
    attacks: "",
    description: "",
    backgroundNarrative: "",
    motivation: "",
    personalityTraits: "",
    ideals: "",
    bonds: "",
    flaws: "",
    quirk: "",
    mannerism: "",
    voice: "",
    secret: "",
    tags: [],
    locationId: "",
    storefrontEnabled: true,
    storefrontTitle: "",
    storefrontTagline: "",
  };
}

function titleForSkill(key) {
  return SKILL_DEFINITIONS.find((skill) => skill.key === key)?.label || key;
}

function classSkillSelectionError(draft) {
  const definition = CLASS_DEFINITIONS[draft.classKey] || CLASS_DEFINITIONS.civilian;
  const selected = Array.from(new Set(draft.selectedClassSkills || []));
  return selected.length === definition.skillCount
    ? ""
    : `Choose ${definition.skillCount} class skill${definition.skillCount === 1 ? "" : "s"}.`;
}

function stepErrors(step, draft) {
  if (step === 0) {
    const errors = [];
    if (!String(draft.name || "").trim()) errors.push("Enter a name.");
    if (!String(draft.role || "").trim()) errors.push("Enter a role or title so the roster remains useful.");
    return errors;
  }
  if (step === 1) {
    const errors = [];
    if (!SPECIES_DEFINITIONS[draft.speciesKey]) errors.push("Choose a species.");
    if (draft.speciesKey === "custom" && !String(draft.customSpecies || "").trim()) errors.push("Enter the custom species name.");
    if (!BACKGROUND_DEFINITIONS[draft.backgroundKey]) errors.push("Choose a background.");
    if (draft.backgroundKey === "custom" && !String(draft.customBackground || "").trim()) errors.push("Enter the custom background name.");
    return errors;
  }
  if (step === 2) {
    return CLASS_DEFINITIONS[draft.classKey] ? [] : ["Choose a class or No Adventuring Class."];
  }
  if (step === 3) {
    const background = BACKGROUND_DEFINITIONS[draft.backgroundKey] || BACKGROUND_DEFINITIONS.custom;
    const boosts = draft.backgroundBoosts || {};
    if (boosts.mode === "three") {
      const selected = Array.from(new Set(boosts.plusOnes || [])).filter((key) => background.abilities.includes(key));
      return selected.length === 3 ? [] : ["Choose three different eligible +1 abilities."];
    }
    return background.abilities.includes(boosts.plusTwo)
      && background.abilities.includes(boosts.plusOne)
      && boosts.plusTwo !== boosts.plusOne
      ? []
      : ["Choose different eligible abilities for the +2 and +1 increases."];
  }
  if (step === 4) {
    const errors = [];
    const skillError = classSkillSelectionError(draft);
    if (skillError) errors.push(skillError);
    PROFESSION_KEYS.forEach((key) => {
      const profession = draft.professions?.[key] || {};
      if (profession.offersService && Number(profession.rank || 0) === 0) {
        errors.push(`${PROFESSION_DEFINITIONS[key].label} must be trained before this NPC can offer it as a service.`);
      }
    });
    return errors;
  }
  return [];
}

function ChoiceCard({ active, title, body, badge, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className={`npc-forge-choice ${active ? "is-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active ? "true" : "false"}
    >
      <span className="npc-forge-choice-head">
        <strong>{title}</strong>
        {badge ? <span className="npc-forge-choice-badge">{badge}</span> : null}
      </span>
      {body ? <span className="npc-forge-choice-body">{body}</span> : null}
    </button>
  );
}

export default function NewNpcModal({ show, onClose, onCreated, locations = [] }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => initialDraft());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [featToAdd, setFeatToAdd] = useState("");
  const [tagInput, setTagInput] = useState("");

  const classDefinition = CLASS_DEFINITIONS[draft.classKey] || CLASS_DEFINITIONS.civilian;
  const backgroundDefinition = BACKGROUND_DEFINITIONS[draft.backgroundKey] || BACKGROUND_DEFINITIONS.custom;
  const speciesDefinition = SPECIES_DEFINITIONS[draft.speciesKey] || null;
  const sheetPreview = useMemo(() => buildCharacterSheetFromDraft(draft), [draft]);
  const createPayload = useMemo(() => buildCharacterCreatePayload(draft), [draft]);
  const finalAbilities = useMemo(
    () => applyBackgroundAbilityBoosts(draft.baseAbilities, draft.backgroundKey, draft.backgroundBoosts),
    [draft.baseAbilities, draft.backgroundKey, draft.backgroundBoosts]
  );
  const availableFeats = useMemo(() => FEAT_OPTIONS.filter((feat) => feat.minimumLevel <= Number(draft.level || 1)), [draft.level]);

  function patch(patchValue) {
    setDraft((current) => ({ ...current, ...patchValue }));
    setError("");
  }

  function resetForm() {
    setStep(0);
    setDraft(initialDraft());
    setCreating(false);
    setError("");
    setFeatToAdd("");
    setTagInput("");
  }

  function handleClose() {
    if (creating) return;
    resetForm();
    onClose?.();
  }

  function chooseClass(classKey) {
    const backgroundKey = draft.backgroundKey || "custom";
    patch({
      classKey,
      baseAbilities: standardAbilityScores(classKey),
      abilityMethod: "standard",
      selectedClassSkills: [],
      expertiseSkills: [],
      backgroundBoosts: defaultBackgroundBoosts(backgroundKey, classKey),
    });
  }

  function chooseBackground(backgroundKey) {
    patch({
      backgroundKey,
      customBackground: backgroundKey === "custom" ? draft.customBackground : "",
      backgroundBoosts: defaultBackgroundBoosts(backgroundKey, draft.classKey),
    });
  }

  function setAbility(key, value) {
    setDraft((current) => ({
      ...current,
      baseAbilities: {
        ...(current.baseAbilities || {}),
        [key]: Math.max(1, Math.min(30, Number(value) || 1)),
      },
    }));
    setError("");
  }

  function setBackgroundBoost(field, value) {
    setDraft((current) => ({
      ...current,
      backgroundBoosts: {
        ...(current.backgroundBoosts || {}),
        [field]: value,
      },
    }));
    setError("");
  }

  function togglePlusOne(ability) {
    setDraft((current) => {
      const currentValues = Array.from(new Set(current.backgroundBoosts?.plusOnes || []));
      const nextValues = currentValues.includes(ability)
        ? currentValues.filter((value) => value !== ability)
        : currentValues.length < 3
          ? [...currentValues, ability]
          : currentValues;
      return {
        ...current,
        backgroundBoosts: { ...(current.backgroundBoosts || {}), mode: "three", plusOnes: nextValues },
      };
    });
    setError("");
  }

  function toggleClassSkill(skillKey) {
    setDraft((current) => {
      const selected = Array.from(new Set(current.selectedClassSkills || []));
      const next = selected.includes(skillKey)
        ? selected.filter((value) => value !== skillKey)
        : selected.length < classDefinition.skillCount
          ? [...selected, skillKey]
          : selected;
      return { ...current, selectedClassSkills: next };
    });
    setError("");
  }

  function toggleExpertise(skillKey) {
    setDraft((current) => {
      const selected = new Set(current.expertiseSkills || []);
      if (selected.has(skillKey)) selected.delete(skillKey);
      else selected.add(skillKey);
      return { ...current, expertiseSkills: Array.from(selected) };
    });
  }

  function setProfession(professionKey, field, value) {
    setDraft((current) => ({
      ...current,
      professions: {
        ...(current.professions || {}),
        [professionKey]: {
          ...(current.professions?.[professionKey] || {}),
          [field]: value,
          ...(field === "rank" && Number(value) === 0 ? { offersService: false } : {}),
        },
      },
    }));
    setError("");
  }

  function addFeat() {
    if (!featToAdd) return;
    patch({ additionalFeats: Array.from(new Set([...(draft.additionalFeats || []), featToAdd])) });
    setFeatToAdd("");
  }

  function addTag() {
    const value = String(tagInput || "").trim().toLowerCase();
    if (!value) return;
    patch({ tags: Array.from(new Set([...(draft.tags || []), value])) });
    setTagInput("");
  }

  function handleNext() {
    const errors = stepErrors(step, draft);
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    setStep((current) => Math.min(STEP_LABELS.length - 1, current + 1));
  }

  function handleBack() {
    setError("");
    setStep((current) => Math.max(0, current - 1));
  }

  async function handleCreate() {
    if (creating) return;
    const errors = validateCharacterDraft(draft);
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }

    setCreating(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("create_character_v1", {
        p_payload: createPayload,
      });
      if (rpcError) throw rpcError;
      const createdId = typeof data === "string" ? data : data?.id || data?.character_id || null;
      const created = { id: createdId, kind: createPayload.kind, name: createPayload.name };
      resetForm();
      await onCreated?.(created);
    } catch (err) {
      setCreating(false);
      setError(String(err?.message || err || "Failed to create character."));
    }
  }

  if (!show) return null;

  const originFeat = backgroundDefinition.feat || "None selected";
  const selectedSkillKeys = Array.from(new Set([...(backgroundDefinition.skills || []), ...(draft.selectedClassSkills || [])]));
  const selectedProfessionServices = PROFESSION_KEYS.filter((key) => draft.professions?.[key]?.offersService);

  return (
    <div className="npc-forge-backdrop" role="presentation">
      <div className="npc-forge-modal" role="dialog" aria-modal="true" aria-labelledby="npc-forge-title">
        <header className="npc-forge-header">
          <div>
            <div className="npc-forge-kicker">Canonical character system</div>
            <h2 id="npc-forge-title">NPC Forge</h2>
            <p>Create an NPC, merchant, or workshop provider with a complete sheet. New characters start off-map.</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={handleClose} disabled={creating}>Close</button>
        </header>

        <nav className="npc-forge-steps" aria-label="NPC creation steps">
          {STEP_LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              className={`${index === step ? "is-current" : ""} ${index < step ? "is-complete" : ""}`}
              onClick={() => { if (index <= step) { setStep(index); setError(""); } }}
              disabled={creating || index > step}
            >
              <span>{index + 1}</span>{label}
            </button>
          ))}
        </nav>

        <div className="npc-forge-body">
          <section className="npc-forge-workspace">
            {step === 0 ? (
              <div className="npc-forge-section">
                <div className="npc-forge-section-heading">
                  <div><span>Identity</span><h3>Who is this character?</h3></div>
                  <p>Role is the in-world title. Class is chosen separately later.</p>
                </div>
                <div className="npc-forge-choice-grid two">
                  <ChoiceCard active={draft.kind === "npc"} title="NPC" body="Resident, guard, ruler, quest giver, enemy, ally, or other character." onClick={() => patch({ kind: "npc", storefrontEnabled: false })} />
                  <ChoiceCard active={draft.kind === "merchant"} title="Merchant" body="The same character model with optional storefront and stock capabilities." onClick={() => patch({ kind: "merchant", storefrontEnabled: true })} />
                </div>
                <div className="npc-forge-form-grid mt-3">
                  <label className="wide"><span>Name *</span><input value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Marta Ironroot" autoFocus /></label>
                  <label><span>Role / title *</span><input value={draft.role} onChange={(event) => patch({ role: event.target.value })} placeholder="Master Armorer" /></label>
                  <label><span>Affiliation</span><input value={draft.affiliation} onChange={(event) => patch({ affiliation: event.target.value })} placeholder="Gray Hall Smiths' Guild" /></label>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="npc-forge-section">
                <div className="npc-forge-section-heading"><div><span>Origin</span><h3>Species and formative background</h3></div><p>Core 2024 options are available, with custom campaign species and backgrounds supported.</p></div>
                <div className="npc-forge-subheading">Species</div>
                <div className="npc-forge-choice-grid three">
                  {SPECIES_KEYS.map((key) => {
                    const option = SPECIES_DEFINITIONS[key];
                    return <ChoiceCard key={key} active={draft.speciesKey === key} title={option.label} body={option.traits.slice(0, 3).join(" • ") || "Campaign-defined traits"} badge={`${option.speed} ft.`} onClick={() => patch({ speciesKey: key, lineage: "", customSpecies: key === "custom" ? draft.customSpecies : "" })} />;
                  })}
                </div>
                {draft.speciesKey === "custom" ? <label className="npc-forge-inline-field mt-3"><span>Custom species name</span><input value={draft.customSpecies} onChange={(event) => patch({ customSpecies: event.target.value })} /></label> : null}
                {speciesDefinition?.lineages?.length ? (
                  <label className="npc-forge-inline-field mt-3"><span>Lineage / ancestry</span><select value={draft.lineage} onChange={(event) => patch({ lineage: event.target.value })}><option value="">Choose lineage</option>{speciesDefinition.lineages.map((lineage) => <option key={lineage} value={lineage}>{lineage}</option>)}</select></label>
                ) : null}

                <div className="npc-forge-subheading mt-4">Background</div>
                <div className="npc-forge-choice-grid three">
                  {BACKGROUND_KEYS.map((key) => {
                    const option = BACKGROUND_DEFINITIONS[key];
                    return <ChoiceCard key={key} active={draft.backgroundKey === key} title={option.label} body={option.skills.length ? `${option.skills.map(titleForSkill).join(" & ")} • ${option.tool}` : "Campaign-defined origin"} badge={option.feat || "Custom"} onClick={() => chooseBackground(key)} />;
                  })}
                </div>
                {draft.backgroundKey === "custom" ? <label className="npc-forge-inline-field mt-3"><span>Custom background name</span><input value={draft.customBackground} onChange={(event) => patch({ customBackground: event.target.value })} /></label> : null}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="npc-forge-section">
                <div className="npc-forge-section-heading"><div><span>Class</span><h3>Adventuring training</h3></div><p>Class does not overwrite the in-world role or Profession skills.</p></div>
                <div className="npc-forge-level-row">
                  <label><span>Level</span><input type="number" min="1" max="20" value={draft.level} onChange={(event) => patch({ level: Math.max(1, Math.min(20, Number(event.target.value) || 1)) })} /></label>
                  <div><span>Proficiency bonus</span><strong>+{sheetPreview.proficiencyBonus}</strong></div>
                  <div><span>Hit Dice</span><strong>{sheetPreview.hitDice}</strong></div>
                  <div><span>Expected HP</span><strong>{sheetPreview.maxHp}</strong></div>
                </div>
                <div className="npc-forge-choice-grid three mt-3">
                  {CLASS_KEYS.map((key) => {
                    const option = CLASS_DEFINITIONS[key];
                    return <ChoiceCard key={key} active={draft.classKey === key} title={option.label} body={option.summary} badge={`d${option.hitDie}`} onClick={() => chooseClass(key)} />;
                  })}
                </div>
                {classDefinition.spellcastingAbility ? <div className="npc-forge-callout mt-3"><strong>Spellcasting foundation</strong><span>{ABILITY_LABELS[classDefinition.spellcastingAbility]} is configured as the class spellcasting ability. Spell selection remains manual until the campaign spell catalog is imported.</span></div> : null}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="npc-forge-section">
                <div className="npc-forge-section-heading"><div><span>Abilities</span><h3>Generate and adjust ability scores</h3></div><p>Background increases are applied after the base scores and cannot raise a score above 20.</p></div>
                <div className="npc-forge-segmented">
                  <button type="button" className={draft.abilityMethod === "standard" ? "is-active" : ""} onClick={() => patch({ abilityMethod: "standard", baseAbilities: standardAbilityScores(draft.classKey) })}>Class Standard Array</button>
                  <button type="button" className={draft.abilityMethod === "rolled" ? "is-active" : ""} onClick={() => patch({ abilityMethod: "rolled", baseAbilities: rollAbilitySet() })}>Roll 4d6 Drop Lowest</button>
                  <button type="button" className={draft.abilityMethod === "manual" ? "is-active" : ""} onClick={() => patch({ abilityMethod: "manual" })}>Manual</button>
                </div>
                <div className="npc-forge-ability-grid mt-3">
                  {ABILITY_KEYS.map((key) => (
                    <label key={key}>
                      <span>{ABILITY_LABELS[key]}</span>
                      <input type="number" min="1" max="30" value={draft.baseAbilities?.[key] ?? 10} onChange={(event) => { patch({ abilityMethod: "manual" }); setAbility(key, event.target.value); }} />
                      <small>Final {finalAbilities[key]}</small>
                    </label>
                  ))}
                </div>
                <div className="npc-forge-subheading mt-4">{backgroundDefinition.label} ability increases</div>
                <div className="npc-forge-segmented compact">
                  <button type="button" className={draft.backgroundBoosts?.mode !== "three" ? "is-active" : ""} onClick={() => setBackgroundBoost("mode", "twoOne")}>+2 and +1</button>
                  <button type="button" className={draft.backgroundBoosts?.mode === "three" ? "is-active" : ""} onClick={() => setBackgroundBoost("mode", "three")}>Three +1s</button>
                </div>
                {draft.backgroundBoosts?.mode === "three" ? (
                  <div className="npc-forge-choice-grid three mt-2">
                    {backgroundDefinition.abilities.map((key) => <ChoiceCard key={key} active={(draft.backgroundBoosts?.plusOnes || []).includes(key)} title={ABILITY_LABELS[key]} badge="+1" onClick={() => togglePlusOne(key)} />)}
                  </div>
                ) : (
                  <div className="npc-forge-form-grid mt-2">
                    <label><span>Increase by 2</span><select value={draft.backgroundBoosts?.plusTwo || ""} onChange={(event) => setBackgroundBoost("plusTwo", event.target.value)}>{backgroundDefinition.abilities.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}</option>)}</select></label>
                    <label><span>Increase by 1</span><select value={draft.backgroundBoosts?.plusOne || ""} onChange={(event) => setBackgroundBoost("plusOne", event.target.value)}>{backgroundDefinition.abilities.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}</option>)}</select></label>
                  </div>
                )}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="npc-forge-section">
                <div className="npc-forge-section-heading"><div><span>Training</span><h3>Skills and Professions</h3></div><p>Professions are real sheet checks. Workshop access is separate and explicit.</p></div>
                <div className="npc-forge-subheading">Class skills <small>{(draft.selectedClassSkills || []).length}/{classDefinition.skillCount}</small></div>
                <div className="npc-forge-skill-grid">
                  {classDefinition.skillOptions.map((key) => {
                    const selected = (draft.selectedClassSkills || []).includes(key);
                    const backgroundGranted = backgroundDefinition.skills.includes(key);
                    return (
                      <button key={key} type="button" className={`${selected ? "is-active" : ""} ${backgroundGranted ? "is-background" : ""}`} onClick={() => toggleClassSkill(key)} disabled={backgroundGranted}>
                        <span>{titleForSkill(key)}</span><small>{backgroundGranted ? "Background" : selected ? "Selected" : "Available"}</small>
                      </button>
                    );
                  })}
                </div>
                <div className="npc-forge-subheading mt-4">Expertise <small>optional</small></div>
                <div className="npc-forge-chip-row">
                  {selectedSkillKeys.map((key) => <button key={key} type="button" className={(draft.expertiseSkills || []).includes(key) ? "is-active" : ""} onClick={() => toggleExpertise(key)}>{titleForSkill(key)}</button>)}
                </div>

                <div className="npc-forge-subheading mt-4">Professions</div>
                <div className="npc-forge-profession-list">
                  {PROFESSION_KEYS.map((key) => {
                    const definition = PROFESSION_DEFINITIONS[key];
                    const profession = draft.professions?.[key] || EMPTY_PROFESSIONS[key];
                    return (
                      <div key={key} className={`npc-forge-profession ${profession.offersService ? "is-provider" : ""}`}>
                        <div><strong>{definition.label}</strong><small>{definition.tool}</small></div>
                        <label><span>Rank</span><select value={profession.rank} onChange={(event) => setProfession(key, "rank", Number(event.target.value))}><option value={0}>Untrained</option><option value={1}>Proficient</option><option value={2}>Expertise</option></select></label>
                        <label><span>Ability</span><select value={profession.ability} onChange={(event) => setProfession(key, "ability", event.target.value)}>{definition.abilities.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]}</option>)}</select></label>
                        <label className="npc-forge-service-toggle"><input type="checkbox" checked={Boolean(profession.offersService)} disabled={Number(profession.rank || 0) === 0} onChange={(event) => setProfession(key, "offersService", event.target.checked)} /><span>Offers workshop service</span></label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="npc-forge-section">
                <div className="npc-forge-section-heading"><div><span>Story & Shop</span><h3>Campaign hooks and placement</h3></div><p>These fields remain editable from the NPC page after creation.</p></div>
                <div className="npc-forge-form-grid">
                  <label className="wide"><span>Description</span><textarea rows={2} value={draft.description} onChange={(event) => patch({ description: event.target.value })} /></label>
                  <label className="wide"><span>Background narrative</span><textarea rows={2} value={draft.backgroundNarrative} onChange={(event) => patch({ backgroundNarrative: event.target.value })} /></label>
                  <label><span>Motivation / want</span><textarea rows={2} value={draft.motivation} onChange={(event) => patch({ motivation: event.target.value })} /></label>
                  <label><span>Personality traits</span><textarea rows={2} value={draft.personalityTraits} onChange={(event) => patch({ personalityTraits: event.target.value })} /></label>
                  <label><span>Ideals</span><textarea rows={2} value={draft.ideals} onChange={(event) => patch({ ideals: event.target.value })} /></label>
                  <label><span>Bonds</span><textarea rows={2} value={draft.bonds} onChange={(event) => patch({ bonds: event.target.value })} /></label>
                  <label><span>Flaws</span><textarea rows={2} value={draft.flaws} onChange={(event) => patch({ flaws: event.target.value })} /></label>
                  <label><span>Quirk</span><textarea rows={2} value={draft.quirk} onChange={(event) => patch({ quirk: event.target.value })} /></label>
                  <label><span>Mannerism</span><textarea rows={2} value={draft.mannerism} onChange={(event) => patch({ mannerism: event.target.value })} /></label>
                  <label><span>Voice</span><textarea rows={2} value={draft.voice} onChange={(event) => patch({ voice: event.target.value })} /></label>
                  <label className="wide"><span>Secret</span><textarea rows={2} value={draft.secret} onChange={(event) => patch({ secret: event.target.value })} /></label>
                  <label className="wide"><span>Attacks & actions</span><textarea rows={3} value={draft.attacks} onChange={(event) => patch({ attacks: event.target.value })} placeholder="Add concise attacks, actions, reactions, or combat notes." /></label>
                  {classDefinition.spellcastingAbility ? <label className="wide"><span>Prepared spells (manual placeholder)</span><textarea rows={3} value={draft.preparedSpellsText} onChange={(event) => patch({ preparedSpellsText: event.target.value })} placeholder="Spell catalog import will replace this free-text bridge." /></label> : null}
                </div>

                <div className="npc-forge-subheading mt-4">Additional feats</div>
                <div className="npc-forge-add-row"><select value={featToAdd} onChange={(event) => setFeatToAdd(event.target.value)}><option value="">Choose feat</option>{availableFeats.map((feat) => <option key={`${feat.category}:${feat.name}`} value={feat.name}>{feat.name} ({feat.category})</option>)}</select><button type="button" onClick={addFeat} disabled={!featToAdd}>Add</button></div>
                <div className="npc-forge-chip-row mt-2"><span className="is-fixed">{originFeat}</span>{(draft.additionalFeats || []).map((feat) => <button key={feat} type="button" onClick={() => patch({ additionalFeats: draft.additionalFeats.filter((value) => value !== feat) })}>{feat} ×</button>)}</div>

                <div className="npc-forge-subheading mt-4">Roster tags</div>
                <div className="npc-forge-add-row"><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} placeholder="guild, guard, ally, villain..." /><button type="button" onClick={addTag}>Add</button></div>
                <div className="npc-forge-chip-row mt-2">{(draft.tags || []).map((tag) => <button key={tag} type="button" onClick={() => patch({ tags: draft.tags.filter((value) => value !== tag) })}>{tag} ×</button>)}</div>

                <div className="npc-forge-subheading mt-4">Placement</div>
                <div className="npc-forge-form-grid">
                  <label><span>Starting location</span><select value={draft.locationId} onChange={(event) => patch({ locationId: event.target.value })}><option value="">Not listed</option>{(locations || []).map((location) => <option key={String(location.id)} value={String(location.id)}>{location.name}</option>)}</select></label>
                  <div className="npc-forge-callout"><strong>Off-map by default</strong><span>The creator assigns identity and location only. It does not alter routes, movement, sprites, or world-map behavior.</span></div>
                </div>

                {draft.kind === "merchant" ? (
                  <div className="npc-forge-merchant-box mt-4">
                    <label className="npc-forge-service-toggle"><input type="checkbox" checked={Boolean(draft.storefrontEnabled)} onChange={(event) => patch({ storefrontEnabled: event.target.checked })} /><span>Enable storefront</span></label>
                    {draft.storefrontEnabled ? <div className="npc-forge-form-grid mt-2"><label><span>Store title</span><input value={draft.storefrontTitle} onChange={(event) => patch({ storefrontTitle: event.target.value })} placeholder={`${draft.name || "Merchant"}'s Shop`} /></label><label><span>Store tagline</span><input value={draft.storefrontTagline} onChange={(event) => patch({ storefrontTagline: event.target.value })} placeholder="A concise shop description" /></label></div> : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 6 ? (
              <div className="npc-forge-section">
                <div className="npc-forge-section-heading"><div><span>Review</span><h3>Confirm the canonical character</h3></div><p>The character and sheet are created atomically. A partial NPC cannot be left behind.</p></div>
                <div className="npc-forge-review-grid">
                  <article><span>Identity</span><strong>{createPayload.name}</strong><p>{createPayload.race} • {createPayload.role}{createPayload.affiliation ? ` • ${createPayload.affiliation}` : ""}</p></article>
                  <article><span>Origin</span><strong>{sheetPreview.background}</strong><p>{sheetPreview.lineage ? `${sheetPreview.species} (${sheetPreview.lineage})` : sheetPreview.species} • {originFeat}</p></article>
                  <article><span>Class</span><strong>{sheetPreview.className} level {sheetPreview.level}</strong><p>PB +{sheetPreview.proficiencyBonus} • {sheetPreview.maxHp} HP • {sheetPreview.hitDice}</p></article>
                  <article><span>Training</span><strong>{selectedSkillKeys.length} trained skills</strong><p>{selectedSkillKeys.map(titleForSkill).join(", ") || "None"}</p></article>
                  <article><span>Workshops</span><strong>{selectedProfessionServices.length ? selectedProfessionServices.map((key) => PROFESSION_DEFINITIONS[key].label).join(", ") : "No services"}</strong><p>Only explicitly enabled services appear as workshop providers.</p></article>
                  <article><span>Placement</span><strong>{(locations || []).find((location) => String(location.id) === String(draft.locationId))?.name || "Not listed"}</strong><p>Created off-map. {draft.kind === "merchant" && draft.storefrontEnabled ? "Storefront enabled." : "No storefront."}</p></article>
                </div>
                <div className="npc-forge-final-abilities mt-3">{ABILITY_KEYS.map((key) => <div key={key}><span>{key.toUpperCase()}</span><strong>{finalAbilities[key]}</strong><small>{Math.floor((finalAbilities[key] - 10) / 2) >= 0 ? "+" : ""}{Math.floor((finalAbilities[key] - 10) / 2)}</small></div>)}</div>
                <details className="npc-forge-json mt-3"><summary>Review generated sheet JSON</summary><pre>{JSON.stringify(sheetPreview, null, 2)}</pre></details>
              </div>
            ) : null}
          </section>

          <aside className="npc-forge-preview">
            <div className="npc-forge-preview-label">Live sheet summary</div>
            <h3>{draft.name || "Unnamed Character"}</h3>
            <p>{createPayload.race || "Species"} • {draft.role || "Role"}</p>
            <div className="npc-forge-preview-stats"><div><span>Level</span><strong>{sheetPreview.level}</strong></div><div><span>PB</span><strong>+{sheetPreview.proficiencyBonus}</strong></div><div><span>AC</span><strong>{sheetPreview.ac || "—"}</strong></div><div><span>HP</span><strong>{sheetPreview.maxHp}</strong></div></div>
            <div className="npc-forge-preview-abilities">{ABILITY_KEYS.map((key) => <div key={key}><span>{key.toUpperCase()}</span><strong>{finalAbilities[key]}</strong></div>)}</div>
            <div className="npc-forge-preview-block"><span>Class</span><strong>{sheetPreview.className}</strong><small>{classDefinition.summary}</small></div>
            <div className="npc-forge-preview-block"><span>Background</span><strong>{sheetPreview.background}</strong><small>{originFeat}</small></div>
            <div className="npc-forge-preview-block"><span>Professions</span>{PROFESSION_KEYS.map((key) => { const profession = draft.professions?.[key]; return Number(profession?.rank || 0) > 0 ? <small key={key}>{PROFESSION_DEFINITIONS[key].label}: {Number(profession.rank) === 2 ? "Expertise" : "Proficient"} ({String(profession.ability || "").toUpperCase()}){profession.offersService ? " • Provider" : ""}</small> : null; })}</div>
          </aside>
        </div>

        {error ? <div className="npc-forge-error" role="alert">{error}</div> : null}

        <footer className="npc-forge-footer">
          <button type="button" className="btn btn-outline-light" onClick={handleClose} disabled={creating}>Cancel</button>
          <div>
            {step > 0 ? <button type="button" className="btn btn-outline-light" onClick={handleBack} disabled={creating}>Back</button> : null}
            {step < STEP_LABELS.length - 1 ? <button type="button" className="btn btn-primary" onClick={handleNext} disabled={creating}>Continue</button> : <button type="button" className="btn btn-success" onClick={handleCreate} disabled={creating}>{creating ? "Forging Character..." : `Create ${draft.kind === "merchant" ? "Merchant" : "NPC"}`}</button>}
          </div>
        </footer>
      </div>
    </div>
  );
}

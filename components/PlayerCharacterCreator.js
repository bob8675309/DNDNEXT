import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  BACKGROUND_DEFINITIONS,
  BACKGROUND_KEYS,
  CLASS_DEFINITIONS,
  CLASS_KEYS,
  SKILL_DEFINITIONS,
  SPECIES_DEFINITIONS,
  SPECIES_KEYS,
  buildCharacterCreatePayload,
  defaultBackgroundBoosts,
  standardAbilityScores,
  validateCharacterDraft,
} from "../utils/characterCreation";
import { spellMatchesClass, spellLevelLabel } from "../utils/spells/classSpellbookRules";

const STEPS = ["Identity", "Origin", "Class", "Abilities", "Spells", "Review"];
const STARTING_SPELL_REQUIREMENTS = Object.freeze({
  bard: { cantrips: 2, leveled: 4, prepared: 4 },
  cleric: { cantrips: 3, leveled: 4, prepared: 4 },
  druid: { cantrips: 2, leveled: 4, prepared: 4 },
  paladin: { cantrips: 0, leveled: 2, prepared: 2 },
  ranger: { cantrips: 0, leveled: 2, prepared: 2 },
  sorcerer: { cantrips: 4, leveled: 2, prepared: 2 },
  warlock: { cantrips: 2, leveled: 2, prepared: 2 },
  wizard: { cantrips: 3, leveled: 6, prepared: 4 },
});

function initialDraft(defaultName = "") {
  return {
    name: String(defaultName || "").trim(),
    kind: "npc",
    role: "",
    affiliation: "",
    speciesKey: "",
    customSpecies: "",
    lineage: "",
    size: "",
    alignment: "N",
    languagesText: "Common",
    appearance: "",
    backgroundKey: "",
    customBackground: "",
    classKey: "",
    level: 1,
    abilityMethod: "standard",
    baseAbilities: standardAbilityScores("civilian"),
    backgroundBoosts: defaultBackgroundBoosts("custom", "civilian"),
    selectedClassSkills: [],
    expertiseSkills: [],
    additionalFeats: [],
    extraTraits: [],
    preparedSpellsText: "",
    attacks: "",
    equipment: "",
    treasure: "",
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
    tags: ["player-character"],
    storefrontEnabled: false,
  };
}

function safeText(value) {
  return String(value ?? "").trim();
}

function skillLabel(key) {
  return SKILL_DEFINITIONS.find((entry) => entry.key === key)?.label || key;
}

function spellSort(a, b) {
  return Number(a?.level || 0) - Number(b?.level || 0)
    || safeText(a?.name).localeCompare(safeText(b?.name));
}

function requirementForClass(classKey) {
  return STARTING_SPELL_REQUIREMENTS[classKey] || { cantrips: 0, leveled: 0, prepared: 0 };
}

function selectedCounts(spells, selections) {
  let cantrips = 0;
  let leveled = 0;
  let prepared = 0;
  for (const spell of spells) {
    const selected = selections[spell.id];
    if (!selected) continue;
    if (Number(spell.level || 0) === 0) cantrips += 1;
    else {
      leveled += 1;
      if (selected.prepared) prepared += 1;
    }
  }
  return { cantrips, leveled, prepared };
}

function stepError(step, draft, classDefinition, spells, selections) {
  if (step === 0) {
    if (safeText(draft.name).length < 2) return "Enter a character name with at least 2 characters.";
    if (safeText(draft.name).length > 120) return "Character names must be 120 characters or fewer.";
  }
  if (step === 1) {
    if (!SPECIES_DEFINITIONS[draft.speciesKey]) return "Choose a species.";
    if (draft.speciesKey === "custom" && !safeText(draft.customSpecies)) return "Enter the custom species name.";
    if (!BACKGROUND_DEFINITIONS[draft.backgroundKey]) return "Choose a background.";
    if (draft.backgroundKey === "custom" && !safeText(draft.customBackground)) return "Enter the custom background name.";
  }
  if (step === 2) {
    if (!classDefinition || draft.classKey === "civilian") return "Choose a 2024 adventuring class.";
    const selected = Array.from(new Set(draft.selectedClassSkills || []));
    if (selected.length !== classDefinition.skillCount) return `Choose exactly ${classDefinition.skillCount} class skill${classDefinition.skillCount === 1 ? "" : "s"}.`;
  }
  if (step === 3) {
    const background = BACKGROUND_DEFINITIONS[draft.backgroundKey] || BACKGROUND_DEFINITIONS.custom;
    const boosts = draft.backgroundBoosts || {};
    if (boosts.mode === "three") {
      const selected = Array.from(new Set(boosts.plusOnes || [])).filter((key) => background.abilities.includes(key));
      if (selected.length !== 3) return "Choose three different eligible +1 ability increases.";
    } else if (!background.abilities.includes(boosts.plusTwo) || !background.abilities.includes(boosts.plusOne) || boosts.plusTwo === boosts.plusOne) {
      return "Choose different eligible abilities for the +2 and +1 increases.";
    }
  }
  if (step === 4) {
    const required = requirementForClass(draft.classKey);
    const counts = selectedCounts(spells, selections);
    if (counts.cantrips !== required.cantrips) return `Choose exactly ${required.cantrips} cantrip${required.cantrips === 1 ? "" : "s"}.`;
    if (counts.leveled !== required.leveled) return `Choose exactly ${required.leveled} level-one spell${required.leveled === 1 ? "" : "s"}.`;
    if (counts.prepared !== required.prepared) return `Mark exactly ${required.prepared} level-one spell${required.prepared === 1 ? "" : "s"} as prepared.`;
  }
  return "";
}

export default function PlayerCharacterCreator({ defaultName = "", onCreated = null, onCancel = null }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => initialDraft(defaultName));
  const [spells, setSpells] = useState([]);
  const [spellSelections, setSpellSelections] = useState({});
  const [spellQuery, setSpellQuery] = useState("");
  const [loadingSpells, setLoadingSpells] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const classDefinition = CLASS_DEFINITIONS[draft.classKey] || null;
  const backgroundDefinition = BACKGROUND_DEFINITIONS[draft.backgroundKey] || BACKGROUND_DEFINITIONS.custom;
  const requirement = requirementForClass(draft.classKey);
  const className = classDefinition?.label || "";

  const classSpells = useMemo(() => spells
    .filter((spell) => spellMatchesClass(spell, draft.classKey))
    .filter((spell) => Number(spell.level || 0) <= 1)
    .filter((spell) => {
      const q = safeText(spellQuery).toLowerCase();
      if (!q) return true;
      return [spell.name, spell.school, spell.description].filter(Boolean).join(" ").toLowerCase().includes(q);
    })
    .sort(spellSort), [draft.classKey, spellQuery, spells]);

  const counts = useMemo(() => selectedCounts(spells, spellSelections), [spellSelections, spells]);
  const selectedSpellRows = useMemo(() => spells.filter((spell) => spellSelections[spell.id]).sort(spellSort), [spellSelections, spells]);

  useEffect(() => {
    let active = true;
    async function loadSpells() {
      setLoadingSpells(true);
      const { data, error: loadError } = await supabase
        .from("spells_catalog")
        .select("id,name,source,level,school,classes,description")
        .eq("source", "XPHB")
        .in("level", [0, 1])
        .order("level", { ascending: true })
        .order("name", { ascending: true })
        .limit(500);
      if (!active) return;
      if (loadError) setError(loadError.message || "Could not load the 2024 spell catalog.");
      setSpells(data || []);
      setLoadingSpells(false);
    }
    loadSpells();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!defaultName || safeText(draft.name)) return;
    setDraft((current) => ({ ...current, name: safeText(defaultName) }));
  }, [defaultName, draft.name]);

  function patch(values) {
    setDraft((current) => ({ ...current, ...values }));
    setError("");
  }

  function chooseClass(classKey) {
    const backgroundKey = draft.backgroundKey || "custom";
    setDraft((current) => ({
      ...current,
      classKey,
      role: CLASS_DEFINITIONS[classKey]?.label || "Adventurer",
      baseAbilities: standardAbilityScores(classKey),
      backgroundBoosts: defaultBackgroundBoosts(backgroundKey, classKey),
      selectedClassSkills: [],
    }));
    setSpellSelections({});
    setError("");
  }

  function chooseBackground(backgroundKey) {
    setDraft((current) => ({
      ...current,
      backgroundKey,
      customBackground: backgroundKey === "custom" ? current.customBackground : "",
      backgroundBoosts: defaultBackgroundBoosts(backgroundKey, current.classKey || "civilian"),
    }));
    setError("");
  }

  function toggleClassSkill(skillKey) {
    if (!classDefinition) return;
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

  function setAbility(key, value) {
    setDraft((current) => ({
      ...current,
      baseAbilities: {
        ...(current.baseAbilities || {}),
        [key]: Math.max(1, Math.min(20, Number(value) || 1)),
      },
    }));
  }

  function setBoost(field, value) {
    setDraft((current) => ({
      ...current,
      backgroundBoosts: { ...(current.backgroundBoosts || {}), [field]: value },
    }));
    setError("");
  }

  function togglePlusOne(key) {
    setDraft((current) => {
      const selected = Array.from(new Set(current.backgroundBoosts?.plusOnes || []));
      const next = selected.includes(key)
        ? selected.filter((value) => value !== key)
        : selected.length < 3 ? [...selected, key] : selected;
      return { ...current, backgroundBoosts: { ...(current.backgroundBoosts || {}), mode: "three", plusOnes: next } };
    });
    setError("");
  }

  function toggleSpell(spell) {
    setSpellSelections((current) => {
      if (current[spell.id]) {
        const next = { ...current };
        delete next[spell.id];
        return next;
      }
      const isCantrip = Number(spell.level || 0) === 0;
      if (isCantrip && counts.cantrips >= requirement.cantrips) return current;
      if (!isCantrip && counts.leveled >= requirement.leveled) return current;
      const prepared = isCantrip || draft.classKey !== "wizard" || counts.prepared < requirement.prepared;
      return { ...current, [spell.id]: { prepared } };
    });
    setError("");
  }

  function togglePrepared(spellId) {
    setSpellSelections((current) => {
      const selected = current[spellId];
      if (!selected) return current;
      if (!selected.prepared && counts.prepared >= requirement.prepared) return current;
      return { ...current, [spellId]: { ...selected, prepared: !selected.prepared } };
    });
    setError("");
  }

  function nextStep() {
    const message = stepError(step, draft, classDefinition, spells, spellSelections);
    if (message) {
      setError(message);
      return;
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
    setError("");
  }

  function previousStep() {
    setStep((current) => Math.max(0, current - 1));
    setError("");
  }

  async function createCharacter() {
    const validationErrors = validateCharacterDraft(draft);
    const spellError = stepError(4, draft, classDefinition, spells, spellSelections);
    if (validationErrors.length || spellError) {
      setError([...validationErrors, spellError].filter(Boolean).join(" "));
      return;
    }

    setCreating(true);
    setError("");
    const payload = buildCharacterCreatePayload({ ...draft, level: 1, kind: "npc" });
    payload.role = className || payload.role;
    payload.tags = Array.from(new Set([...(payload.tags || []), "player-character"]));
    const spellChoices = selectedSpellRows.map((spell) => ({
      spell_id: spell.id,
      prepared: Number(spell.level || 0) === 0 ? true : Boolean(spellSelections[spell.id]?.prepared),
    }));

    const { data, error: createError } = await supabase.rpc("create_player_character_v1", {
      p_payload: payload,
      p_spell_choices: spellChoices,
    });

    if (createError) {
      setError(createError.message || "Could not create the player character.");
      setCreating(false);
      return;
    }

    await onCreated?.({ id: data, name: draft.name, kind: "npc" });
    setCreating(false);
  }

  return (
    <div className="player-character-creator">
      <div className="npc-card mb-3">
        <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
          <div>
            <div className="spell-admin-kicker">2024 Character Creation</div>
            <h2 className="h4 mb-1">Create your player character</h2>
            <div className="text-muted small">Build a level-one character, choose legal starting spells, and link it directly to this account.</div>
          </div>
          {typeof onCancel === "function" ? <button type="button" className="btn btn-sm btn-outline-light" onClick={onCancel}>Close</button> : null}
        </div>
      </div>

      <div className="creator-step-strip mb-3">
        {STEPS.map((label, index) => <span key={label} className={index === step ? "active" : index < step ? "complete" : ""}>{index + 1}. {label}</span>)}
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      {step === 0 ? (
        <section className="npc-card">
          <div className="npc-card-title">Identity</div>
          <div className="row g-3">
            <div className="col-12 col-lg-6"><label className="form-label">Character name</label><input className="form-control" value={draft.name} onChange={(event) => patch({ name: event.target.value })} maxLength={120} /></div>
            <div className="col-12 col-lg-6"><label className="form-label">Alignment</label><select className="form-select" value={draft.alignment} onChange={(event) => patch({ alignment: event.target.value })}>{["LG","NG","CG","LN","N","CN","LE","NE","CE"].map((value) => <option key={value}>{value}</option>)}</select></div>
            <div className="col-12"><label className="form-label">Appearance</label><textarea className="form-control" rows={3} value={draft.appearance} onChange={(event) => patch({ appearance: event.target.value })} placeholder="A concise physical description." /></div>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="npc-card">
          <div className="npc-card-title">Origin</div>
          <div className="row g-3">
            <div className="col-12 col-lg-6"><label className="form-label">Species</label><select className="form-select" value={draft.speciesKey} onChange={(event) => patch({ speciesKey: event.target.value, customSpecies: event.target.value === "custom" ? draft.customSpecies : "" })}><option value="">Choose species…</option>{SPECIES_KEYS.map((key) => <option key={key} value={key}>{SPECIES_DEFINITIONS[key].label}</option>)}</select></div>
            <div className="col-12 col-lg-6"><label className="form-label">Background</label><select className="form-select" value={draft.backgroundKey} onChange={(event) => chooseBackground(event.target.value)}><option value="">Choose background…</option>{BACKGROUND_KEYS.map((key) => <option key={key} value={key}>{BACKGROUND_DEFINITIONS[key].label}</option>)}</select></div>
            {draft.speciesKey === "custom" ? <div className="col-12 col-lg-6"><label className="form-label">Custom species</label><input className="form-control" value={draft.customSpecies} onChange={(event) => patch({ customSpecies: event.target.value })} /></div> : null}
            {draft.backgroundKey === "custom" ? <div className="col-12 col-lg-6"><label className="form-label">Custom background</label><input className="form-control" value={draft.customBackground} onChange={(event) => patch({ customBackground: event.target.value })} /></div> : null}
            <div className="col-12 col-lg-6"><label className="form-label">Languages</label><input className="form-control" value={draft.languagesText} onChange={(event) => patch({ languagesText: event.target.value })} placeholder="Common, Elvish" /></div>
            <div className="col-12"><div className="small text-muted">Origin feat: <strong>{backgroundDefinition.feat || "None"}</strong> • Skills: {(backgroundDefinition.skills || []).map(skillLabel).join(", ") || "Custom"}</div></div>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="npc-card">
          <div className="npc-card-title">Class and training</div>
          <div className="row g-3">
            <div className="col-12 col-lg-5"><label className="form-label">2024 class</label><select className="form-select" value={draft.classKey} onChange={(event) => chooseClass(event.target.value)}><option value="">Choose class…</option>{CLASS_KEYS.filter((key) => key !== "civilian").map((key) => <option key={key} value={key}>{CLASS_DEFINITIONS[key].label}</option>)}</select>{classDefinition ? <div className="form-text">{classDefinition.summary}</div> : null}</div>
            <div className="col-12 col-lg-7">
              <label className="form-label">Class skills {classDefinition ? `(${(draft.selectedClassSkills || []).length}/${classDefinition.skillCount})` : ""}</label>
              <div className="creator-choice-grid">
                {(classDefinition?.skillOptions || []).map((skillKey) => <button key={skillKey} type="button" className={`creator-choice ${draft.selectedClassSkills.includes(skillKey) ? "active" : ""}`} onClick={() => toggleClassSkill(skillKey)}>{skillLabel(skillKey)}</button>)}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="npc-card">
          <div className="npc-card-title">Ability scores</div>
          <div className="creator-ability-grid mb-3">
            {ABILITY_KEYS.map((key) => <label key={key}><span>{ABILITY_LABELS[key]}</span><input className="form-control" type="number" min="1" max="20" value={draft.baseAbilities[key] ?? 10} onChange={(event) => setAbility(key, event.target.value)} /></label>)}
          </div>
          <div className="row g-3">
            <div className="col-12"><label className="form-label">Background increase method</label><div className="d-flex gap-2 flex-wrap"><button type="button" className={`btn btn-sm ${draft.backgroundBoosts.mode !== "three" ? "btn-warning" : "btn-outline-light"}`} onClick={() => setBoost("mode", "twoOne")}>+2 and +1</button><button type="button" className={`btn btn-sm ${draft.backgroundBoosts.mode === "three" ? "btn-warning" : "btn-outline-light"}`} onClick={() => setBoost("mode", "three")}>Three +1s</button></div></div>
            {draft.backgroundBoosts.mode === "three" ? (
              <div className="col-12"><div className="creator-choice-grid">{backgroundDefinition.abilities.map((key) => <button key={key} type="button" className={`creator-choice ${(draft.backgroundBoosts.plusOnes || []).includes(key) ? "active" : ""}`} onClick={() => togglePlusOne(key)}>{ABILITY_LABELS[key]} +1</button>)}</div></div>
            ) : (
              <><div className="col-6"><label className="form-label">+2 ability</label><select className="form-select" value={draft.backgroundBoosts.plusTwo || ""} onChange={(event) => setBoost("plusTwo", event.target.value)}>{backgroundDefinition.abilities.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}</option>)}</select></div><div className="col-6"><label className="form-label">+1 ability</label><select className="form-select" value={draft.backgroundBoosts.plusOne || ""} onChange={(event) => setBoost("plusOne", event.target.value)}>{backgroundDefinition.abilities.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}</option>)}</select></div></>
            )}
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="npc-card">
          <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-3">
            <div><div className="npc-card-title mb-0">Starting spells</div><div className="small text-muted">{className ? `${className}: ${counts.cantrips}/${requirement.cantrips} cantrips • ${counts.leveled}/${requirement.leveled} level-one spells • ${counts.prepared}/${requirement.prepared} prepared` : "Choose a class first."}</div></div>
            <input className="form-control form-control-sm creator-spell-search" value={spellQuery} onChange={(event) => setSpellQuery(event.target.value)} placeholder="Search spells…" />
          </div>
          {loadingSpells ? <div className="text-muted">Loading 2024 spells…</div> : null}
          {!loadingSpells && requirement.cantrips === 0 && requirement.leveled === 0 ? <div className="alert alert-secondary py-2 mb-0">This class does not select class spells at level one.</div> : null}
          <div className="creator-spell-list">
            {classSpells.map((spell) => {
              const selected = spellSelections[spell.id];
              const isCantrip = Number(spell.level || 0) === 0;
              return <div key={spell.id} className={`creator-spell-row ${selected ? "selected" : ""}`}><button type="button" className="creator-spell-main" onClick={() => toggleSpell(spell)}><strong>{spell.name}</strong><small>{spellLevelLabel(spell.level)} • {spell.school || "Spell"}</small></button>{selected && !isCantrip && draft.classKey === "wizard" ? <label className="form-check form-switch mb-0"><input className="form-check-input" type="checkbox" checked={!!selected.prepared} onChange={() => togglePrepared(spell.id)} /><span className="form-check-label small">Prepared</span></label> : selected ? <span className="badge text-bg-success">Selected</span> : null}</div>;
            })}
          </div>
        </section>
      ) : null}

      {step === 5 ? (
        <section className="npc-card">
          <div className="npc-card-title">Review character</div>
          <div className="row g-3">
            <div className="col-12 col-lg-6"><div className="creator-review"><span>Name</span><strong>{draft.name}</strong></div><div className="creator-review"><span>Species</span><strong>{draft.speciesKey === "custom" ? draft.customSpecies : SPECIES_DEFINITIONS[draft.speciesKey]?.label}</strong></div><div className="creator-review"><span>Background</span><strong>{draft.backgroundKey === "custom" ? draft.customBackground : BACKGROUND_DEFINITIONS[draft.backgroundKey]?.label}</strong></div><div className="creator-review"><span>Class</span><strong>{className} • Level 1 • 2024</strong></div></div>
            <div className="col-12 col-lg-6"><div className="small fw-semibold mb-2">Starting spellbook</div>{selectedSpellRows.length ? <div className="creator-selected-spells">{selectedSpellRows.map((spell) => <span key={spell.id}>{spell.name}{Number(spell.level || 0) > 0 && spellSelections[spell.id]?.prepared ? " • prepared" : ""}</span>)}</div> : <div className="text-muted">No class spells at level one.</div>}</div>
          </div>
          <button type="button" className="btn btn-warning mt-3" disabled={creating} onClick={createCharacter}>{creating ? "Creating character…" : "Create and link character"}</button>
        </section>
      ) : null}

      <div className="d-flex justify-content-between gap-2 mt-3">
        <button type="button" className="btn btn-outline-light" disabled={step === 0 || creating} onClick={previousStep}>Back</button>
        {step < STEPS.length - 1 ? <button type="button" className="btn btn-warning" disabled={creating} onClick={nextStep}>Continue</button> : null}
      </div>

      <style jsx>{`
        .creator-step-strip { display:flex; gap:.45rem; flex-wrap:wrap; }
        .creator-step-strip span { padding:.35rem .6rem; border-radius:999px; border:1px solid rgba(255,255,255,.12); color:rgba(255,255,255,.58); font-size:.78rem; }
        .creator-step-strip span.active { border-color:rgba(245,190,75,.75); background:rgba(245,190,75,.15); color:#ffe4a1; }
        .creator-step-strip span.complete { color:#b8e6c3; }
        .creator-choice-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:.45rem; }
        .creator-choice { padding:.5rem .6rem; border-radius:.65rem; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.035); color:inherit; text-align:left; }
        .creator-choice.active { border-color:rgba(245,190,75,.7); background:rgba(245,190,75,.13); }
        .creator-ability-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:.55rem; }
        .creator-ability-grid label { display:grid; gap:.25rem; }
        .creator-ability-grid span { font-size:.75rem; color:rgba(255,255,255,.65); }
        .creator-spell-search { max-width:260px; }
        .creator-spell-list { display:grid; gap:.45rem; max-height:48vh; overflow:auto; padding-right:.2rem; }
        .creator-spell-row { display:flex; align-items:center; justify-content:space-between; gap:.65rem; padding:.55rem .65rem; border:1px solid rgba(255,255,255,.1); border-radius:.7rem; background:rgba(255,255,255,.035); }
        .creator-spell-row.selected { border-color:rgba(245,190,75,.65); background:rgba(245,190,75,.1); }
        .creator-spell-main { display:grid; flex:1; min-width:0; border:0; background:transparent; color:inherit; text-align:left; padding:0; }
        .creator-spell-main small { color:rgba(255,255,255,.6); }
        .creator-review { display:flex; justify-content:space-between; gap:1rem; padding:.5rem 0; border-bottom:1px solid rgba(255,255,255,.08); }
        .creator-review span { color:rgba(255,255,255,.58); }
        .creator-selected-spells { display:flex; flex-wrap:wrap; gap:.4rem; }
        .creator-selected-spells span { padding:.3rem .55rem; border-radius:999px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.04); font-size:.8rem; }
        @media (max-width:800px) { .creator-ability-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .creator-spell-search { max-width:none; width:100%; } }
      `}</style>
    </div>
  );
}

import { useMemo, useState } from "react";
import { ABILITY_KEYS, ABILITY_LABELS, ALIGNMENT_OPTIONS, SKILL_DEFINITIONS, SIZE_OPTIONS } from "../utils/characterCreation";
import { ABILITY_DESCRIPTIONS, FALLBACK_SKILL_DESCRIPTIONS } from "../utils/characterCreationGuidance";
import { optionMatchesQuery, safeText } from "../utils/npcForgeCatalog";
import { spellLevelLabel } from "../utils/spells/classSpellbookRules";
import { CharacterForgeCatalogList, CharacterForgeDiceSummary, characterForgeSourceLabel } from "./CharacterForgeControls";
import NpcForgeContextPanel from "./NpcForgeContextPanel";

function skillLabel(key) {
  return SKILL_DEFINITIONS.find((skill) => skill.key === key)?.label || key;
}

function modifierLabel(score) {
  const value = Math.floor((Number(score || 10) - 10) / 2);
  return value >= 0 ? `+${value}` : String(value);
}

export default function PlayerCharacterForgeView({
  steps,
  step,
  setStep,
  error,
  loadingCatalogs,
  creating,
  onCancel,
  nextStep,
  previousStep,
  createCharacter,
  draft,
  patch,
  speciesOptions,
  selectedSpecies,
  chooseSpecies,
  backgroundOptions,
  selectedBackground,
  chooseBackground,
  backgroundMechanicDetails,
  backgroundFeatChoices,
  selectedBackgroundFeat,
  selectedBackgroundFeatRule,
  toggleBackgroundSkill,
  selectBackgroundFeat,
  classes,
  selectedClass,
  chooseClass,
  classSourceLabel,
  skillConfig,
  skillDescriptions,
  toggleSkill,
  rolls,
  allocation,
  allocateRoll,
  rerollScores,
  baseScores,
  finalScores,
  setBoost,
  togglePlusOne,
  selectedBackgroundRecommended,
  humanSpecies,
  originFeatOptions,
  selectedHumanFeat,
  selectedCampaignFeat,
  featOptions,
  requirements,
  spellCounts,
  classSpells,
  spellSelections,
  toggleSpell,
  togglePrepared,
  spellQuery,
  setSpellQuery,
  backgroundExpandedSpells,
  selectedSpellRows,
}) {
  const [speciesQuery, setSpeciesQuery] = useState("");
  const [backgroundQuery, setBackgroundQuery] = useState("");
  const [classQuery, setClassQuery] = useState("");
  const [detail, setDetail] = useState(null);
  const [selectedRollId, setSelectedRollId] = useState("");

  const filteredSpecies = useMemo(
    () => speciesOptions.filter((row) => optionMatchesQuery(row, speciesQuery)),
    [speciesOptions, speciesQuery]
  );
  const filteredBackgrounds = useMemo(
    () => backgroundOptions.filter((row) => optionMatchesQuery(row, backgroundQuery)),
    [backgroundOptions, backgroundQuery]
  );
  const filteredClasses = useMemo(
    () => classes.filter((row) => optionMatchesQuery({ ...row, name: row.class_name, description: row.summary }, classQuery)),
    [classQuery, classes]
  );
  const allocatedAbilityByRoll = useMemo(
    () => Object.fromEntries(Object.entries(allocation).map(([ability, rollId]) => [rollId, ability])),
    [allocation]
  );
  const selectedSkill = detail?.type === "skill"
    ? {
        key: detail.key,
        label: skillLabel(detail.key),
        ability: SKILL_DEFINITIONS.find((skill) => skill.key === detail.key)?.ability,
        description: skillDescriptions[detail.key] || FALLBACK_SKILL_DESCRIPTIONS[detail.key],
        source: "XPHB",
      }
    : null;

  function chooseStep(index) {
    if (index > step || creating) return;
    setStep(index);
    setDetail(null);
  }

  function chooseSpeciesRow(option) {
    chooseSpecies(option);
    setDetail({ type: "species", option });
  }

  function chooseBackgroundRow(option) {
    chooseBackground(option);
    setDetail({ type: "background", option });
  }

  function chooseClassRow(option) {
    chooseClass(option.id);
    setDetail({ type: "class", option });
  }

  function assignRoll(ability, rollId) {
    if (!rollId) return;
    allocateRoll(ability, rollId);
    setSelectedRollId("");
    setDetail({ type: "ability", key: ability });
  }

  return (
    <div className="npc-forge-modal npc-forge-modal-v2 player-character-forge" role="dialog" aria-modal="true" aria-labelledby="player-forge-title">
      <header className="npc-forge-header">
        <div>
          <div className="npc-forge-kicker">Canonical player character system</div>
          <h2 id="player-forge-title">Player Character Forge</h2>
          <p>Build the rules first, then finish identity and story. The right column explains the choice currently being made.</p>
        </div>
        {typeof onCancel === "function" ? <button type="button" className="btn btn-sm btn-outline-light" onClick={onCancel} disabled={creating}>Close</button> : null}
      </header>

      <nav className="npc-forge-steps" aria-label="Player character creation steps">
        {steps.map((label, index) => (
          <button key={label} type="button" className={`${index === step ? "is-current" : ""} ${index < step ? "is-complete" : ""}`} onClick={() => chooseStep(index)} disabled={creating || index > step}>
            <span>{index + 1}</span>{label}
          </button>
        ))}
      </nav>

      <div className="npc-forge-body">
        <section className="npc-forge-workspace">
          {loadingCatalogs ? <div className="npc-forge-catalog-warning">Loading preferred species, backgrounds, classes, feats, and spells…</div> : null}

          {step === 0 ? (
            <div className="npc-forge-section">
              <div className="npc-forge-section-heading"><div><span>Species</span><h3>Choose ancestry and innate traits</h3></div><p>{speciesOptions.length} species available.</p></div>
              <CharacterForgeCatalogList label="Species" query={speciesQuery} onQuery={setSpeciesQuery} rows={filteredSpecies} selectedId={selectedSpecies?.id || ""} onSelect={chooseSpeciesRow} emptyText="No species match this search." />
              <div className="npc-forge-form-grid mt-3">
                {selectedSpecies?.lineages?.length ? <label><span>Lineage / ancestry</span><select value={draft.lineage} onChange={(event) => patch({ lineage: event.target.value })}><option value="">Choose lineage</option>{selectedSpecies.lineages.map((lineage) => <option key={lineage} value={lineage}>{lineage}</option>)}</select></label> : null}
                <label><span>Gender presentation</span><select value={draft.gender} onChange={(event) => patch({ gender: event.target.value })}><option value="female">Female</option><option value="male">Male</option><option value="neutral">Nonbinary / neutral</option></select></label>
                <label><span>Size</span><select value={draft.size} onChange={(event) => patch({ size: event.target.value })}><option value="">Species default</option>{SIZE_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
                <label><span>Alignment</span><select value={draft.alignment} onChange={(event) => patch({ alignment: event.target.value })}>{ALIGNMENT_OPTIONS.filter((option) => option.key !== "U").map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
                <label className="wide"><span>Languages</span><input value={draft.languagesText} onChange={(event) => patch({ languagesText: event.target.value })} placeholder="Common, Gnomish, Celestial" /></label>
                {selectedSpecies?.key === "custom" ? <label className="wide"><span>Campaign species name</span><input value={draft.customSpecies} onChange={(event) => patch({ customSpecies: event.target.value })} /></label> : null}
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="npc-forge-section">
              <div className="npc-forge-section-heading"><div><span>Background</span><h3>Choose a formative background</h3></div><p>{backgroundOptions.length} backgrounds available.</p></div>
              <CharacterForgeCatalogList label="Backgrounds" query={backgroundQuery} onQuery={setBackgroundQuery} rows={filteredBackgrounds} selectedId={selectedBackground?.id || ""} onSelect={chooseBackgroundRow} emptyText="No backgrounds match this search." />
              <div className="npc-forge-workspace-note mt-3">Background story, source features, required skills or feats, and expanded spells are completed in the information panel.</div>
              {selectedBackground?.key === "custom" ? <div className="npc-forge-form-grid mt-3"><label className="wide"><span>Campaign background name</span><input value={draft.customBackground} onChange={(event) => patch({ customBackground: event.target.value })} /></label></div> : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="npc-forge-section">
              <div className="npc-forge-section-heading"><div><span>Class &amp; skills</span><h3>Choose level-one adventuring training</h3></div><p>Preferred 2024 classes appear in place of 2014 duplicates.</p></div>
              <CharacterForgeCatalogList label="Classes" query={classQuery} onQuery={setClassQuery} rows={filteredClasses} selectedId={selectedClass?.id || ""} onSelect={chooseClassRow} emptyText="No classes match this search." />
              {selectedClass ? <div className="npc-forge-level-row mt-3"><div><span>Starting level</span><strong>1</strong></div><div><span>Hit Die</span><strong>d{selectedClass.hit_die || 8}</strong></div><div><span>Source</span><strong>{classSourceLabel}</strong></div></div> : null}
              <div className="npc-forge-subheading mt-4">Class skills <small>{(draft.selectedClassSkills || []).length}/{skillConfig.count}</small></div>
              <div className="npc-forge-skill-grid">
                {skillConfig.options.map((key) => <button key={key} type="button" className={(draft.selectedClassSkills || []).includes(key) ? "is-active" : ""} onClick={() => { toggleSkill(key); setDetail({ type: "skill", key }); }}><span>{skillLabel(key)}</span><small>{(draft.selectedClassSkills || []).includes(key) ? "Selected" : ABILITY_LABELS[SKILL_DEFINITIONS.find((skill) => skill.key === key)?.ability] || "Available"}</small></button>)}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="npc-forge-section">
              <div className="npc-forge-section-heading"><div><span>Abilities</span><h3>Roll and allocate ability scores</h3></div><p>Each score rolls 4d6, drops the lowest die, and is assigned exactly once.</p></div>
              <div className="npc-forge-segmented"><button type="button" className="is-active">4d6 drop lowest</button><button type="button" onClick={rerollScores}>Reroll all six</button></div>
              <div className="npc-forge-roll-pool mt-3">{rolls.map((roll, index) => <CharacterForgeDiceSummary key={roll.id} roll={roll} index={index} assignedAbility={allocatedAbilityByRoll[roll.id]} selected={selectedRollId === roll.id} onSelect={(rollId) => setSelectedRollId((current) => current === rollId ? "" : rollId)} />)}</div>
              <div className="npc-forge-allocation-instruction">{selectedRollId ? `Die Roll ${rolls.findIndex((roll) => roll.id === selectedRollId) + 1} selected — choose an ability.` : "Drag a Die Roll card onto an ability, or click the roll and then the ability."}</div>
              <div className="npc-forge-ability-drop-grid">
                {ABILITY_KEYS.map((key) => { const roll = rolls.find((entry) => entry.id === allocation[key]); const rollIndex = rolls.findIndex((entry) => entry.id === allocation[key]); return <button key={key} type="button" className={selectedRollId ? "is-ready" : ""} onClick={() => assignRoll(key, selectedRollId)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => { event.preventDefault(); assignRoll(key, event.dataTransfer.getData("text/npc-forge-roll")); }} onMouseEnter={() => setDetail({ type: "ability", key })}><span>{ABILITY_LABELS[key]}</span><strong>{roll?.total ?? "—"}</strong><small>{roll ? `Die Roll ${rollIndex + 1}` : "Choose a roll"}</small><em>{roll ? `Final ${finalScores[key]} (${modifierLabel(finalScores[key])})` : ABILITY_DESCRIPTIONS[key]}</em></button>; })}
              </div>
              <div className="npc-forge-subheading mt-4">Background ability increases</div>
              <div className="npc-forge-segmented compact"><button type="button" className={draft.backgroundBoosts.mode !== "three" ? "is-active" : ""} onClick={() => setBoost("mode", "twoOne")}>+2 and +1</button><button type="button" className={draft.backgroundBoosts.mode === "three" ? "is-active" : ""} onClick={() => setBoost("mode", "three")}>Three +1s</button></div>
              {draft.backgroundBoosts.mode === "three" ? <div className="npc-forge-choice-grid three mt-2">{ABILITY_KEYS.map((ability) => <button type="button" key={ability} className={`npc-forge-ability-choice ${(draft.backgroundBoosts.plusOnes || []).includes(ability) ? "is-active" : ""} ${selectedBackgroundRecommended.has(ability) ? "is-recommended" : ""}`} onClick={() => togglePlusOne(ability)}><strong>{ABILITY_LABELS[ability]}</strong><span>+1</span></button>)}</div> : <div className="npc-forge-form-grid mt-2"><label><span>Increase by 2</span><select value={draft.backgroundBoosts.plusTwo} onChange={(event) => setBoost("plusTwo", event.target.value)}><option value="">Choose ability</option>{ABILITY_KEYS.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]}</option>)}</select></label><label><span>Increase by 1</span><select value={draft.backgroundBoosts.plusOne} onChange={(event) => setBoost("plusOne", event.target.value)}><option value="">Choose ability</option>{ABILITY_KEYS.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]}</option>)}</select></label></div>}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="npc-forge-section">
              <div className="npc-forge-section-heading"><div><span>Feats</span><h3>Complete starting feat choices</h3></div><p>Background, Human, and campaign grants remain distinct.</p></div>
              {selectedBackgroundFeatRule.requiresChoice ? <label className="npc-forge-field"><span>{selectedBackground?.name}: background feat</span><select value={draft.backgroundOriginFeatId} onChange={(event) => selectBackgroundFeat(event.target.value)}><option value="">Choose background feat</option>{backgroundFeatChoices.map((feat) => <option key={feat.id} value={feat.id}>{feat.name} • {characterForgeSourceLabel(feat.source)}</option>)}</select></label> : <div className="npc-forge-workspace-note">Background feat: <strong>{selectedBackgroundFeat?.name || selectedBackground?.originFeat || "None listed"}</strong></div>}
              <div className="npc-forge-form-grid mt-3">
                {humanSpecies ? <label><span>Human Versatile: Origin feat</span><select value={draft.humanOriginFeatId} onChange={(event) => patch({ humanOriginFeatId: event.target.value })}><option value="">Choose Origin feat</option>{originFeatOptions.map((feat) => <option key={feat.id} value={feat.id}>{feat.name} • {characterForgeSourceLabel(feat.source)}</option>)}</select></label> : null}
                <label><span>Campaign bonus feat</span><select value={draft.campaignBonusFeatId} onChange={(event) => patch({ campaignBonusFeatId: event.target.value })}><option value="">Choose bonus feat</option>{featOptions.map((feat) => <option key={feat.id} value={feat.id}>{feat.name} • {characterForgeSourceLabel(feat.source)}</option>)}</select></label>
              </div>
              <div className="npc-forge-review-grid mt-3"><article><span>Background</span><strong>{selectedBackgroundFeat?.name || selectedBackground?.originFeat || "None"}</strong><p>{selectedBackgroundFeat?.description || "Granted by the selected background."}</p></article>{humanSpecies ? <article><span>Human</span><strong>{selectedHumanFeat?.name || "Choice required"}</strong><p>{selectedHumanFeat?.description || "Granted by Human Versatile."}</p></article> : null}<article><span>Campaign</span><strong>{selectedCampaignFeat?.name || "Choice required"}</strong><p>{selectedCampaignFeat?.description || "Every player receives one campaign bonus feat at level 1."}</p></article></div>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="npc-forge-section">
              <div className="npc-forge-section-heading"><div><span>Spells</span><h3>Choose the level-one spellbook</h3></div><p>{selectedClass ? `${spellCounts.cantrips}/${requirements.cantrips} cantrips • ${spellCounts.leveled}/${requirements.leveled} level-one spells • ${spellCounts.prepared}/${requirements.prepared} prepared` : "Choose a class first."}</p></div>
              {backgroundExpandedSpells.length ? <div className="npc-forge-workspace-note">{selectedBackground?.name} adds {backgroundExpandedSpells.join(", ")} to the class list as their spell levels become available.</div> : null}
              <input className="npc-forge-search mt-3" value={spellQuery} onChange={(event) => setSpellQuery(event.target.value)} placeholder="Search preferred spells…" />
              <div className="creator-spell-list mt-3">{classSpells.map((spell) => { const selected = spellSelections[spell.id]; const cantrip = Number(spell.level || 0) === 0; return <div key={spell.id} className={`creator-spell-row ${selected ? "selected" : ""}`}><button type="button" className="creator-spell-main" onClick={() => toggleSpell(spell)}><strong>{spell.name}</strong><small>{spellLevelLabel(spell.level)} • {spell.school || "Spell"} • {characterForgeSourceLabel(spell.source)}</small><span>{safeText(spell.description).slice(0, 220)}{safeText(spell.description).length > 220 ? "…" : ""}</span></button>{selected && !cantrip && selectedClass?.class_key === "wizard" ? <label className="form-check form-switch mb-0"><input className="form-check-input" type="checkbox" checked={Boolean(selected.prepared)} onChange={() => togglePrepared(spell.id)} /><span className="form-check-label small">Prepared</span></label> : selected ? <span className="badge text-bg-success">Selected</span> : null}</div>; })}</div>
            </div>
          ) : null}

          {step === 6 ? (
            <div className="npc-forge-section">
              <div className="npc-forge-section-heading"><div><span>Identity &amp; review</span><h3>Name the finished adventurer</h3></div><p>The account, character, progression, feats, and spellbook are committed together.</p></div>
              <div className="npc-forge-form-grid">
                <label className="wide"><span>Character name *</span><input value={draft.name} onChange={(event) => patch({ name: event.target.value })} maxLength={120} /></label>
                <label><span>Title</span><input value={draft.title} onChange={(event) => patch({ title: event.target.value })} placeholder="The Starbound Blade" /></label>
                <label><span>Affiliation</span><input value={draft.affiliation} onChange={(event) => patch({ affiliation: event.target.value })} placeholder="Arena company, guild, temple…" /></label>
                <label className="wide"><span>Appearance</span><textarea rows={2} value={draft.appearance} onChange={(event) => patch({ appearance: event.target.value })} /></label>
                <label className="wide"><span>Short description</span><textarea rows={2} value={draft.description} onChange={(event) => patch({ description: event.target.value })} /></label>
                <label className="wide"><span>Backstory</span><textarea rows={5} value={draft.backgroundNarrative} onChange={(event) => patch({ backgroundNarrative: event.target.value })} /></label>
                <label><span>Motivation</span><textarea rows={2} value={draft.motivation} onChange={(event) => patch({ motivation: event.target.value })} /></label>
                <label><span>Personality traits</span><textarea rows={2} value={draft.personalityTraits} onChange={(event) => patch({ personalityTraits: event.target.value })} /></label>
                <label><span>Ideals</span><textarea rows={2} value={draft.ideals} onChange={(event) => patch({ ideals: event.target.value })} /></label>
                <label><span>Bonds</span><textarea rows={2} value={draft.bonds} onChange={(event) => patch({ bonds: event.target.value })} /></label>
                <label><span>Flaws</span><textarea rows={2} value={draft.flaws} onChange={(event) => patch({ flaws: event.target.value })} /></label>
                <label><span>Quirk</span><textarea rows={2} value={draft.quirk} onChange={(event) => patch({ quirk: event.target.value })} /></label>
              </div>
              <div className="npc-forge-review-hero mt-4"><div><span>Player character</span><h3>{draft.name || "Unnamed adventurer"}</h3><p>{selectedSpecies?.name || "Species"} • {selectedBackground?.name || "Background"} • {selectedClass?.class_name || "Class"}</p></div><div><strong>Level 1</strong><span>{classSourceLabel}</span></div></div>
              <div className="npc-forge-final-abilities mt-3">{ABILITY_KEYS.map((key) => <div key={key}><span>{key.toUpperCase()}</span><strong>{finalScores[key]}</strong><small>{modifierLabel(finalScores[key])}</small></div>)}</div>
              <div className="npc-forge-review-grid mt-3"><article><span>Class skills</span><strong>{(draft.selectedClassSkills || []).map(skillLabel).join(", ") || "None"}</strong></article><article><span>Feats</span><strong>{[selectedBackgroundFeat?.name, selectedHumanFeat?.name, selectedCampaignFeat?.name].filter(Boolean).join(", ") || "None"}</strong></article><article><span>Starting spells</span><strong>{selectedSpellRows.map((spell) => spell.name).join(", ") || "None"}</strong></article></div>
            </div>
          ) : null}
        </section>

        <aside className="npc-forge-preview npc-forge-context-panel">
          <NpcForgeContextPanel
            step={step}
            detail={detail}
            selectedSpecies={selectedSpecies}
            selectedBackground={selectedBackground}
            backgroundMechanicDetails={backgroundMechanicDetails}
            selectedBackgroundFeat={selectedBackgroundFeat}
            backgroundFeatOptions={backgroundFeatChoices}
            backgroundSkillSelections={draft.backgroundSkillChoices || {}}
            onToggleBackgroundSkill={toggleBackgroundSkill}
            onSelectBackgroundFeat={selectBackgroundFeat}
            selectedClass={selectedClass}
            selectedSkill={selectedSkill}
            rolls={rolls}
            allocation={allocation}
            finalAbilities={finalScores}
            draft={{ ...draft, baseAbilities: baseScores }}
          />
        </aside>
      </div>

      {error ? <div className="npc-forge-error" role="alert">{error}</div> : null}
      <footer className="npc-forge-footer">
        {typeof onCancel === "function" ? <button type="button" className="btn btn-outline-light" onClick={onCancel} disabled={creating}>Cancel</button> : <span />}
        <div>{step > 0 ? <button type="button" className="btn btn-outline-light" onClick={previousStep} disabled={creating}>Back</button> : null}{step < steps.length - 1 ? <button type="button" className="btn btn-primary" onClick={nextStep} disabled={creating || loadingCatalogs}>Continue</button> : <button type="button" className="btn btn-success" onClick={createCharacter} disabled={creating}>{creating ? "Forging Character…" : "Create and link character"}</button>}</div>
      </footer>
    </div>
  );
}

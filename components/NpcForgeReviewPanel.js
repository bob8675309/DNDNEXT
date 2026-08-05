import { ABILITY_KEYS, ABILITY_LABELS } from "../utils/characterCreation";
import { PROFESSION_DEFINITIONS } from "../utils/craftingProfessions";
import { countStartingSpellSelections } from "../utils/playerForgeRules";

function modifier(score) {
  const value = Math.floor((Number(score || 10) - 10) / 2);
  return value >= 0 ? `+${value}` : String(value);
}

function ReviewSection({ title, stepKey, onEdit, children }) {
  return <section className="npc-forge-review-section"><header><span>{title}</span><button type="button" onClick={() => onEdit?.(stepKey)}>Edit</button></header>{children}</section>;
}

export default function NpcForgeReviewPanel({
  playerMode,
  draft,
  createPayload,
  selectedSpecies,
  selectedBackground,
  selectedClass,
  selectedSubclass,
  selectedBackgroundFeat,
  speciesBonusFeat,
  selectedSkillKeys,
  selectedClassSkills,
  backgroundSkills,
  selectedTrainedProfessions,
  spellRows,
  spellSelections,
  spellModel,
  finalAbilities,
  proficiencyBonus,
  dynamicHp,
  classHitDie,
  titleForSkill,
  sourceLabel,
  assetSummary,
  onEdit,
}) {
  const spellCounts = countStartingSpellSelections(spellRows, spellSelections);
  const selectedSpells = spellRows.filter((spell) => spellSelections?.[spell.id]);
  const feats = [selectedBackgroundFeat?.name, speciesBonusFeat?.name, ...(draft.additionalFeats || [])].filter(Boolean);
  return <div className="npc-forge-section npc-forge-review-dossier">
    <div className="npc-forge-section-heading"><div><span>Review</span><h3>{playerMode ? "Confirm your player character" : "Confirm the canonical character"}</h3></div><p>Review every rules source before creation. Use Edit to return directly to the owning step.</p></div>

    <section className="npc-forge-review-banner">
      {draft.portraitUrl ? <img src={draft.portraitUrl} alt="Selected character portrait" /> : <div className="npc-forge-review-banner__empty">Portrait required</div>}
      <div><span>{playerMode ? "Player Character" : draft.kind === "merchant" ? "Merchant" : "NPC"}</span><h2>{createPayload.name || "Unnamed Character"}</h2><p>{selectedSpecies?.name || "Species"} • {selectedBackground?.name || "Background"} • {selectedClass?.class_name || "Class"} level {draft.level}{selectedSubclass?.name ? ` • ${selectedSubclass.name}` : ""}</p><div><b>PB +{proficiencyBonus}</b><b>{dynamicHp} HP</b><b>{draft.level}d{classHitDie}</b>{selectedClass?.spellcasting_ability ? <b>Spellcaster</b> : null}</div></div>
    </section>

    <div className="npc-forge-review-dossier__grid">
      <ReviewSection title="Origin & Identity" stepKey="identity" onEdit={onEdit}><div className="npc-forge-review-copy"><strong>{draft.name}</strong><p>{draft.role || selectedClass?.class_name}{draft.affiliation ? ` • ${draft.affiliation}` : ""}</p><p>{draft.description || "No immediate description entered."}</p></div><dl><div><dt>Species</dt><dd>{selectedSpecies?.name || "—"}</dd></div><div><dt>Background</dt><dd>{selectedBackground?.name || "—"}</dd></div><div><dt>Alignment</dt><dd>{draft.alignment || "—"}</dd></div><div><dt>Languages</dt><dd>{draft.languagesText || "—"}</dd></div></dl></ReviewSection>

      <ReviewSection title="Class Progression" stepKey="class" onEdit={onEdit}><div className="npc-forge-review-copy"><strong>{selectedClass?.class_name || "—"} {draft.level}</strong><p>{selectedSubclass?.name ? `${selectedSubclass.name} • ${selectedSubclass.source}` : "No subclass selected at this level."}</p><p>{selectedClass?.summary}</p></div><dl><div><dt>Hit Die</dt><dd>d{classHitDie}</dd></div><div><dt>Primary</dt><dd>{(selectedClass?.primary_abilities || []).map((key) => ABILITY_LABELS[key]).join(", ") || "Varies"}</dd></div><div><dt>Saves</dt><dd>{(selectedClass?.saving_throws || []).map((key) => ABILITY_LABELS[key]).join(", ") || "Varies"}</dd></div></dl></ReviewSection>

      <ReviewSection title="Ability Scores" stepKey="abilities" onEdit={onEdit}><div className="npc-forge-review-abilities">{ABILITY_KEYS.map((key) => <div key={key}><span>{ABILITY_LABELS[key]}</span><strong>{finalAbilities[key]}</strong><small>{modifier(finalAbilities[key])}</small></div>)}</div><p className="npc-forge-review-note">Generation method: {draft.abilityMethod}. Species Bonus: {draft.speciesBonus?.mode === "feat" ? speciesBonusFeat?.name || "feat not chosen" : draft.speciesBonus?.mode === "three" ? "+1 to three abilities" : "+2 and +1"}.</p></ReviewSection>

      <ReviewSection title="Training & Professions" stepKey="training" onEdit={onEdit}><dl><div><dt>Background skills</dt><dd>{backgroundSkills.map(titleForSkill).join(", ") || "None"}</dd></div><div><dt>Class choices</dt><dd>{selectedClassSkills.map(titleForSkill).join(", ") || "None"}</dd></div><div><dt>All trained skills</dt><dd>{selectedSkillKeys.map(titleForSkill).join(", ") || "None"}</dd></div><div><dt>Professions</dt><dd>{selectedTrainedProfessions.map((key) => PROFESSION_DEFINITIONS[key]?.label || key).join(", ") || "None"}</dd></div></dl></ReviewSection>

      <ReviewSection title="Feats & Features" stepKey="abilities" onEdit={onEdit}><div className="npc-forge-review-chip-list">{feats.length ? feats.map((feat) => <span key={feat}>{feat}</span>) : <em>No starting feats listed.</em>}</div><p className="npc-forge-review-note">Background and Species Bonus feats remain distinct sources on the generated sheet.</p></ReviewSection>

      <ReviewSection title="Starting Magic" stepKey="spells" onEdit={onEdit}><div className="npc-forge-review-copy"><strong>{selectedClass?.spellcasting_ability ? `${selectedClass.class_name} spellcasting` : "No base-class spell selection"}</strong>{spellModel?.mode !== "none" ? <p>{spellCounts.cantrips} cantrips • {spellCounts.leveled} leveled spells{spellModel?.mode === "spellbook" ? ` • ${spellCounts.prepared - spellCounts.cantrips} prepared` : ""}</p> : <p>Species, feat, background, or subclass features can still grant magic.</p>}</div>{selectedSpells.length ? <div className="npc-forge-review-spells">{selectedSpells.map((spell) => <span key={spell.id}>{spell.name}{spellSelections[spell.id]?.prepared && Number(spell.level) > 0 ? " • prepared" : ""}</span>)}</div> : null}</ReviewSection>

      <ReviewSection title="Story & Campaign Hooks" stepKey="story" onEdit={onEdit}><dl><div><dt>Motivation</dt><dd>{draft.motivation || "Not entered"}</dd></div><div><dt>Personality</dt><dd>{draft.personalityTraits || "Not entered"}</dd></div><div><dt>Ideal</dt><dd>{draft.ideals || "Not entered"}</dd></div><div><dt>Bond</dt><dd>{draft.bonds || "Not entered"}</dd></div><div><dt>Flaw</dt><dd>{draft.flaws || "Not entered"}</dd></div></dl></ReviewSection>

      <ReviewSection title="Campaign Status" stepKey="identity" onEdit={onEdit}><dl><div><dt>Ownership</dt><dd>{playerMode ? "Player-owned" : "Campaign NPC"}</dd></div><div><dt>Map placement</dt><dd>{playerMode ? "Off-map at creation" : draft.locationId || "Not listed"}</dd></div><div><dt>Portrait</dt><dd>{draft.portraitName || "Not selected"}</dd></div><div><dt>Visual asset</dt><dd>{assetSummary(draft.spriteAsset)}</dd></div></dl></ReviewSection>
    </div>

    <details className="npc-forge-json mt-3"><summary>Review generated sheet JSON</summary><pre>{JSON.stringify(createPayload.sheet, null, 2)}</pre></details>

    <style jsx global>{`
      .npc-forge-review-banner{display:grid;grid-template-columns:130px minmax(0,1fr);gap:18px;align-items:center;padding:18px;border:1px solid rgba(168,108,255,.38);border-radius:15px;background:linear-gradient(110deg,rgba(62,31,95,.72),rgba(12,29,39,.88))}.npc-forge-review-banner img,.npc-forge-review-banner__empty{width:130px;height:170px;border-radius:10px;object-fit:cover;border:1px solid rgba(255,255,255,.14);background:#090b12}.npc-forge-review-banner__empty{display:grid;place-items:center;color:rgba(255,255,255,.5);text-align:center}.npc-forge-review-banner>div:last-child{display:grid;gap:7px}.npc-forge-review-banner span,.npc-forge-review-section>header>span{color:#d7bfff;font-size:.64rem;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.npc-forge-review-banner h2{margin:0;color:#fff;font-size:clamp(1.7rem,3vw,2.5rem)}.npc-forge-review-banner p{margin:0;color:rgba(255,255,255,.75)}.npc-forge-review-banner>div>div{display:flex;gap:7px;flex-wrap:wrap}.npc-forge-review-banner b{padding:4px 8px;border-radius:999px;background:rgba(88,214,199,.16);color:#c6fff7;font-size:.68rem}.npc-forge-review-dossier__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.npc-forge-review-section{display:grid;align-content:start;gap:11px;padding:14px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:linear-gradient(145deg,rgba(28,22,39,.88),rgba(11,14,22,.94))}.npc-forge-review-section>header{display:flex;justify-content:space-between;gap:10px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.08)}.npc-forge-review-section>header button{padding:3px 8px;border:1px solid rgba(168,108,255,.38);border-radius:6px;color:#eadfff;background:rgba(126,72,199,.1);font-size:.63rem}.npc-forge-review-section dl{display:grid;gap:7px;margin:0}.npc-forge-review-section dl>div{display:grid;grid-template-columns:110px minmax(0,1fr);gap:8px}.npc-forge-review-section dt{color:rgba(255,255,255,.48);font-size:.65rem;text-transform:uppercase}.npc-forge-review-section dd{margin:0;color:#fff;font-size:.74rem}.npc-forge-review-copy{display:grid;gap:5px}.npc-forge-review-copy strong{color:#fff}.npc-forge-review-copy p,.npc-forge-review-note{margin:0;color:rgba(255,255,255,.68);font-size:.73rem;line-height:1.5}.npc-forge-review-abilities{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.npc-forge-review-abilities>div{display:grid;grid-template-columns:1fr auto;gap:2px 7px;padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:8px}.npc-forge-review-abilities span{color:rgba(255,255,255,.55);font-size:.58rem;text-transform:uppercase}.npc-forge-review-abilities strong{grid-row:1/3;grid-column:2;color:#fff;font-size:1.1rem}.npc-forge-review-abilities small{color:#cfb4f7}.npc-forge-review-chip-list,.npc-forge-review-spells{display:flex;flex-wrap:wrap;gap:6px}.npc-forge-review-chip-list span,.npc-forge-review-spells span{padding:5px 8px;border:1px solid rgba(168,108,255,.3);border-radius:999px;color:#eadfff;background:rgba(126,72,199,.1);font-size:.66rem}@media(max-width:900px){.npc-forge-review-dossier__grid{grid-template-columns:1fr}}@media(max-width:620px){.npc-forge-review-banner{grid-template-columns:1fr}.npc-forge-review-banner img,.npc-forge-review-banner__empty{width:96px;height:128px}.npc-forge-review-abilities{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `}</style>
  </div>;
}

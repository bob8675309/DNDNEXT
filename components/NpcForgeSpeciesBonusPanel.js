import { ABILITY_KEYS, ABILITY_LABELS } from "../utils/characterCreation";

export default function NpcForgeSpeciesBonusPanel({
  draft,
  selectedSpecies,
  onSetSpeciesBonus,
  onToggleSpeciesPlusOne,
}) {
  const speciesBonus = draft?.speciesBonus || {
    mode: "twoOne",
    plusTwo: "",
    plusOne: "",
    plusOnes: [],
    featId: "",
  };
  const plusOnes = Array.isArray(speciesBonus.plusOnes) ? speciesBonus.plusOnes : [];
  const ready = speciesBonus.mode === "feat"
    || (speciesBonus.mode === "three" && plusOnes.length === 3)
    || (speciesBonus.mode === "twoOne" && speciesBonus.plusTwo && speciesBonus.plusOne && speciesBonus.plusTwo !== speciesBonus.plusOne);

  // Compatibility: Species Bonus; the specific feat is chosen later in Training.
  return <section className="npc-forge-species-bonus npc-forge-species-bonus--context npc-forge-ability-bonus-card">
    <header className="npc-forge-ability-bonus-card__head">
      <div><span>Apply Species Bonuses</span><small title="Species ability bonuses are applied after base scores are assigned.">ⓘ</small></div>
      <p>Choose your {selectedSpecies?.name ? `${selectedSpecies.name} ` : ""}species ability bonus package.</p>
    </header>

    <div className="npc-forge-segmented compact npc-forge-ability-bonus-modes">
      <button type="button" className={speciesBonus.mode === "twoOne" ? "is-active" : ""} onClick={() => onSetSpeciesBonus({ mode: "twoOne", featId: "" })}>+2 in one stat, +1 in another</button>
      <button type="button" className={speciesBonus.mode === "three" ? "is-active" : ""} onClick={() => onSetSpeciesBonus({ mode: "three", featId: "" })}>+1 in three different stats</button>
      <button type="button" className={speciesBonus.mode === "feat" ? "is-active" : ""} onClick={() => onSetSpeciesBonus({ mode: "feat", plusTwo: "", plusOne: "", plusOnes: [], featId: "" })}>Bonus feat</button>
    </div>

    {speciesBonus.mode === "twoOne" ? <div className="npc-forge-ability-bonus-selects">
      <label><span>Increase by</span><div><select value={speciesBonus.plusTwo || ""} onChange={(event) => onSetSpeciesBonus({ plusTwo: event.target.value })}><option value="">Choose ability</option>{ABILITY_KEYS.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}</option>)}</select><strong>+2</strong></div></label>
      <label><span>Increase by</span><div><select value={speciesBonus.plusOne || ""} onChange={(event) => onSetSpeciesBonus({ plusOne: event.target.value })}><option value="">Choose ability</option>{ABILITY_KEYS.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}</option>)}</select><strong>+1</strong></div></label>
    </div> : null}

    {speciesBonus.mode === "three" ? <div className="npc-forge-choice-grid three npc-forge-ability-bonus-three">
      {ABILITY_KEYS.map((key) => <button key={key} type="button" className={`npc-forge-ability-choice ${plusOnes.includes(key) ? "is-active" : ""}`} onClick={() => onToggleSpeciesPlusOne(key)}><strong>{ABILITY_LABELS[key]}</strong><span>+1</span></button>)}
    </div> : null}

    {speciesBonus.mode === "feat" ? <div className="npc-forge-species-feat-routing-note"><strong>Selected: Bonus Feat package</strong><span>The specific feat is chosen later in <b>{"Training → Feats & Class Abilities"}</b>.</span></div> : null}

    <button type="button" className="npc-forge-ability-bonus-apply" disabled={!ready} onClick={() => onSetSpeciesBonus({})}>▣&nbsp; Add bonuses</button>

    <span className="visually-hidden">+2 in one stat and +1 in a different stat</span>
  </section>;
}

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

  return (
    <section className="npc-forge-species-bonus npc-forge-species-bonus--context">
      <div className="npc-forge-subheading">
        Species Bonus <small>{selectedSpecies?.name || "Selected species"}</small>
      </div>
      <p>Choose one bonus package. If you take the Bonus Feat package, the specific feat is chosen later in Training.</p>
      <div className="npc-forge-segmented compact">
        <button
          type="button"
          className={speciesBonus.mode === "twoOne" ? "is-active" : ""}
          onClick={() => onSetSpeciesBonus({ mode: "twoOne", featId: "" })}
        >
          +2 in one stat and +1 in a different stat
        </button>
        <button
          type="button"
          className={speciesBonus.mode === "three" ? "is-active" : ""}
          onClick={() => onSetSpeciesBonus({ mode: "three", featId: "" })}
        >
          +1 in three different stats
        </button>
        <button
          type="button"
          className={speciesBonus.mode === "feat" ? "is-active" : ""}
          onClick={() => onSetSpeciesBonus({ mode: "feat", plusTwo: "", plusOne: "", plusOnes: [], featId: "" })}
        >
          Bonus feat
        </button>
      </div>

      {speciesBonus.mode === "three" ? (
        <div className="npc-forge-choice-grid three mt-2">
          {ABILITY_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`npc-forge-ability-choice ${(speciesBonus.plusOnes || []).includes(key) ? "is-active" : ""}`}
              onClick={() => onToggleSpeciesPlusOne(key)}
            >
              <strong>{ABILITY_LABELS[key]}</strong>
              <span>+1</span>
            </button>
          ))}
        </div>
      ) : null}

      {speciesBonus.mode === "twoOne" ? (
        <div className="npc-forge-form-grid mt-2">
          <label>
            <span>Increase by 2</span>
            <select value={speciesBonus.plusTwo || ""} onChange={(event) => onSetSpeciesBonus({ plusTwo: event.target.value })}>
              <option value="">Choose ability</option>
              {ABILITY_KEYS.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}</option>)}
            </select>
          </label>
          <label>
            <span>Increase by 1</span>
            <select value={speciesBonus.plusOne || ""} onChange={(event) => onSetSpeciesBonus({ plusOne: event.target.value })}>
              <option value="">Choose a different ability</option>
              {ABILITY_KEYS.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}</option>)}
            </select>
          </label>
        </div>
      ) : null}

      {speciesBonus.mode === "feat" ? (
        <div className="npc-forge-species-feat-routing-note">
          <strong>Bonus Feat selected</strong>
          <span>The actual feat choice is resolved in <b>Training → Feat Choices</b>, where its prerequisites and any feat-owned follow-up choices can be handled together.</span>
        </div>
      ) : null}
      <style jsx global>{`
        .npc-forge-species-feat-routing-note{display:grid;gap:4px;margin-top:8px;padding:9px 10px;border-left:3px solid #58d6c7;border-radius:8px;background:rgba(88,214,199,.075)}.npc-forge-species-feat-routing-note strong{color:#d8fff9;font-size:.68rem}.npc-forge-species-feat-routing-note span{color:rgba(255,255,255,.82);font-size:.63rem;line-height:1.45}.npc-forge-species-feat-routing-note b{color:#fff}
      `}</style>
    </section>
  );
}

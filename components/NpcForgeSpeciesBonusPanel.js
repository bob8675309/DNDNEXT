import { ABILITY_KEYS, ABILITY_LABELS } from "../utils/characterCreation";

export default function NpcForgeSpeciesBonusPanel({
  draft,
  selectedSpecies,
  featOptions = [],
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
      <p>Choose one bonus package. A feat replaces the ability increases rather than stacking with them.</p>
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
          onClick={() => onSetSpeciesBonus({ mode: "feat", plusTwo: "", plusOne: "", plusOnes: [] })}
        >
          Choose a feat
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
        <label className="npc-forge-species-feat-select mt-2">
          <span>Species bonus feat</span>
          <select value={speciesBonus.featId || ""} onChange={(event) => onSetSpeciesBonus({ featId: event.target.value })}>
            <option value="">Choose feat</option>
            {featOptions.map((feat) => (
              <option key={feat.id} value={feat.id}>{feat.name} • {feat.category || feat.source || "Feat"}</option>
            ))}
          </select>
          <small>Origin feats are included. Normal prerequisites still apply.</small>
        </label>
      ) : null}
    </section>
  );
}

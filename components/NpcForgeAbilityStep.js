import { ABILITY_KEYS, ABILITY_LABELS } from "../utils/characterCreation";
import {
  POINT_BUY_BUDGET,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  canSetPointBuyScore,
  pointBuyRemaining,
} from "../utils/playerForgeRules";

function modifier(score) {
  const value = Math.floor((Number(score || 10) - 10) / 2);
  return value >= 0 ? `+${value}` : String(value);
}

export default function NpcForgeAbilityStep({
  draft,
  selectedClass,
  selectedSpecies,
  rolls,
  allocation,
  selectedRollId,
  finalAbilities,
  featOptions = [],
  onPatch,
  onMethod,
  onReroll,
  onAllocate,
  onSelectRoll,
  onSetAbility,
  onSetSpeciesBonus,
  onToggleSpeciesPlusOne,
  onDetail,
}) {
  const rolled = draft.abilityMethod === "3d6" || draft.abilityMethod === "4d6";
  const pointBuy = draft.abilityMethod === "pointBuy";
  const speciesBonus = draft.speciesBonus || { mode: "twoOne", plusTwo: "", plusOne: "", plusOnes: [], featId: "" };
  const remaining = pointBuy ? pointBuyRemaining(draft.baseAbilities) : null;

  return <div className="npc-forge-section npc-forge-abilities-step">
    <div className="npc-forge-section-heading">
      <div><span>Abilities</span><h3>Generate and allocate ability scores</h3></div>
      <p>Choose a generation method, then assign the six base scores before applying the Species Bonus.</p>
    </div>

    <div className="npc-forge-subheading ability-method-heading">Ability Score Generation Method</div>
    <div className="npc-forge-segmented npc-forge-ability-methods">
      <button type="button" className={draft.abilityMethod === "3d6" ? "is-active" : ""} onClick={() => onMethod("3d6")}>Standard 3d6</button>
      <button type="button" className={draft.abilityMethod === "4d6" ? "is-active" : ""} onClick={() => onMethod("4d6")}>4d6 drop lowest die</button>
      <button type="button" className={pointBuy ? "is-active" : ""} onClick={() => onMethod("pointBuy")}>Point Buy</button>
      <button type="button" className={draft.abilityMethod === "standard" ? "is-active" : ""} onClick={() => onMethod("standard")}>Standard Class Array</button>
      <button type="button" className={draft.abilityMethod === "manual" ? "is-active" : ""} onClick={() => onMethod("manual")}>Manual Assign</button>
    </div>

    {rolled ? <>
      <div className="npc-forge-ability-drop-grid mt-3">
        {ABILITY_KEYS.map((key) => {
          const roll = rolls.find((entry) => entry.id === allocation[key]);
          const rollIndex = rolls.findIndex((entry) => entry.id === allocation[key]);
          return <button key={key} type="button" className={selectedRollId ? "is-ready" : ""} onClick={() => onAllocate(key, selectedRollId)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onAllocate(key, event.dataTransfer.getData("text/npc-forge-roll") || selectedRollId); }} onMouseEnter={() => onDetail({ type: "ability", key })}>
            <span>{ABILITY_LABELS[key]}</span><strong>{roll?.total ?? "—"}</strong>
            <small>{roll ? `Die Roll ${rollIndex + 1}` : "Drag a roll here"}</small>
            <em>{roll ? `Final ${finalAbilities[key]} (${modifier(finalAbilities[key])})` : "No roll assigned"}</em>
          </button>;
        })}
      </div>
      <div className="npc-forge-allocation-instruction">{selectedRollId ? "Choose an ability above for the selected roll." : "Drag a Die Roll card onto an ability above, or select a roll and then an ability."}</div>
      <div className="npc-forge-roll-toolbar"><div><strong>Six generated totals</strong><span>{draft.abilityMethod === "3d6" ? "Each total is the sum of three dice." : "Each total discards its lowest die."}</span></div><button type="button" onClick={onReroll}>Reroll All Six</button></div>
      <div className="npc-forge-roll-pool mt-2">
        {rolls.map((roll, index) => {
          const assigned = Object.entries(allocation).find(([, id]) => id === roll.id)?.[0];
          return <button key={roll.id} type="button" draggable className={`npc-forge-roll-card refined ${selectedRollId === roll.id ? "is-selected" : ""}`} onClick={() => onSelectRoll(selectedRollId === roll.id ? "" : roll.id)} onDragStart={(event) => { event.dataTransfer.setData("text/npc-forge-roll", roll.id); onSelectRoll(roll.id); }}>
            <small>Die Roll {index + 1}</small><strong>{roll.total}</strong><div>{roll.dice.map((die, dieIndex) => <span key={dieIndex} className={dieIndex === roll.droppedIndex ? "is-dropped" : ""}>{die}</span>)}</div><em>{assigned ? `Assigned to ${ABILITY_LABELS[assigned]}` : "Drag or select to assign"}</em>
          </button>;
        })}
      </div>
    </> : <>
      {pointBuy ? <div className={`npc-forge-point-buy-budget ${remaining < 0 ? "is-invalid" : ""}`}><div><span>Point Buy Budget</span><strong>{Math.max(0, remaining)} / {POINT_BUY_BUDGET} remaining</strong></div><p>Scores begin at {POINT_BUY_MIN} and cannot exceed {POINT_BUY_MAX} before the Species Bonus.</p></div> : null}
      <div className="npc-forge-ability-grid mt-3">
        {ABILITY_KEYS.map((key) => <label key={key} onMouseEnter={() => onDetail({ type: "ability", key })}><span>{ABILITY_LABELS[key]}</span><input type="number" min={pointBuy ? POINT_BUY_MIN : 1} max={pointBuy ? POINT_BUY_MAX : 30} value={draft.baseAbilities?.[key] ?? 10} readOnly={draft.abilityMethod === "standard"} onChange={(event) => {
          const value = Number(event.target.value);
          if (!pointBuy || canSetPointBuyScore(draft.baseAbilities, key, value)) onSetAbility(key, value);
        }} /><small>Final {finalAbilities[key]} ({modifier(finalAbilities[key])})</small></label>)}
      </div>
    </>}

    <div className="npc-forge-species-bonus mt-4">
      <div className="npc-forge-subheading">Species Bonus <small>{selectedSpecies?.name || "Selected species"}</small></div>
      <p>Choose one bonus package. A feat replaces the ability increases rather than stacking with them.</p>
      <div className="npc-forge-segmented compact">
        <button type="button" className={speciesBonus.mode === "twoOne" ? "is-active" : ""} onClick={() => onSetSpeciesBonus({ mode: "twoOne", featId: "" })}>+2 in one stat and +1 in a different stat</button>
        <button type="button" className={speciesBonus.mode === "three" ? "is-active" : ""} onClick={() => onSetSpeciesBonus({ mode: "three", featId: "" })}>+1 in three different stats</button>
        <button type="button" className={speciesBonus.mode === "feat" ? "is-active" : ""} onClick={() => onSetSpeciesBonus({ mode: "feat", plusTwo: "", plusOne: "", plusOnes: [] })}>Choose a feat</button>
      </div>
      {speciesBonus.mode === "three" ? <div className="npc-forge-choice-grid three mt-2">{ABILITY_KEYS.map((key) => <button key={key} type="button" className={`npc-forge-ability-choice ${(speciesBonus.plusOnes || []).includes(key) ? "is-active" : ""}`} onClick={() => onToggleSpeciesPlusOne(key)}><strong>{ABILITY_LABELS[key]}</strong><span>+1</span></button>)}</div> : null}
      {speciesBonus.mode === "twoOne" ? <div className="npc-forge-form-grid mt-2"><label><span>Increase by 2</span><select value={speciesBonus.plusTwo || ""} onChange={(event) => onSetSpeciesBonus({ plusTwo: event.target.value })}><option value="">Choose ability</option>{ABILITY_KEYS.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}</option>)}</select></label><label><span>Increase by 1</span><select value={speciesBonus.plusOne || ""} onChange={(event) => onSetSpeciesBonus({ plusOne: event.target.value })}><option value="">Choose a different ability</option>{ABILITY_KEYS.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}</option>)}</select></label></div> : null}
      {speciesBonus.mode === "feat" ? <label className="npc-forge-species-feat-select mt-2"><span>Species bonus feat</span><select value={speciesBonus.featId || ""} onChange={(event) => onSetSpeciesBonus({ featId: event.target.value })}><option value="">Choose feat</option>{featOptions.map((feat) => <option key={feat.id} value={feat.id}>{feat.name} • {feat.category || feat.source || "Feat"}</option>)}</select><small>Origin feats are included. Normal prerequisites still apply.</small></label> : null}
    </div>

    <style jsx global>{`
      .npc-forge-ability-methods{flex-wrap:wrap}.npc-forge-ability-methods button{flex:1 1 150px}.ability-method-heading{margin-top:2px}.npc-forge-roll-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:10px 12px;border:1px solid rgba(168,108,255,.25);border-radius:10px;background:rgba(126,72,199,.08)}.npc-forge-roll-toolbar>div{display:grid}.npc-forge-roll-toolbar strong{color:#fff}.npc-forge-roll-toolbar span{color:rgba(255,255,255,.6);font-size:.7rem}.npc-forge-roll-toolbar button{padding:7px 11px;border:1px solid rgba(168,108,255,.55);border-radius:8px;color:#fff;background:rgba(126,72,199,.2)}.npc-forge-point-buy-budget{display:flex;justify-content:space-between;gap:16px;margin-top:14px;padding:12px 14px;border:1px solid rgba(88,214,199,.3);border-radius:10px;background:rgba(88,214,199,.07)}.npc-forge-point-buy-budget div{display:grid}.npc-forge-point-buy-budget span{color:#9cece2;font-size:.64rem;text-transform:uppercase}.npc-forge-point-buy-budget strong{color:#fff;font-size:1rem}.npc-forge-point-buy-budget p{margin:0;color:rgba(255,255,255,.65);font-size:.72rem}.npc-forge-species-bonus{padding:14px;border:1px solid rgba(168,108,255,.28);border-radius:12px;background:linear-gradient(135deg,rgba(126,72,199,.12),rgba(88,214,199,.045))}.npc-forge-species-bonus>p{margin:4px 0 10px;color:rgba(255,255,255,.68);font-size:.75rem}.npc-forge-species-feat-select{display:grid;gap:6px}.npc-forge-species-feat-select span{color:#eadfff;font-size:.7rem;font-weight:800;text-transform:uppercase}.npc-forge-species-feat-select select{width:100%;padding:9px;border:1px solid rgba(255,255,255,.16);border-radius:8px;background:#111522;color:#fff}.npc-forge-species-feat-select small{color:rgba(255,255,255,.55)}@media(max-width:720px){.npc-forge-roll-toolbar,.npc-forge-point-buy-budget{align-items:stretch;flex-direction:column}}
    `}</style>
  </div>;
}

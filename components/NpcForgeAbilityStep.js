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

function methodHelp(method) {
  if (method === "3d6") return "Roll three d6 for each total, then drag the six results into your abilities.";
  if (method === "4d6") return "Roll four d6, discard the lowest die from each set, then drag the six totals into place.";
  if (method === "pointBuy") return `Spend ${POINT_BUY_BUDGET} points. Scores range from ${POINT_BUY_MIN} to ${POINT_BUY_MAX} before Species Bonus.`;
  if (method === "standard") return "Use the class-guided standard array. The suggested scores remain editable only by changing methods.";
  return "Enter each base score directly on the Ability wall.";
}

export default function NpcForgeAbilityStep({
  draft,
  rolls,
  allocation,
  selectedRollId,
  finalAbilities,
  onMethod,
  onReroll,
  onAllocate,
  onSelectRoll,
  onSetAbility,
  onDetail,
}) {
  const rolled = draft.abilityMethod === "3d6" || draft.abilityMethod === "4d6";
  const pointBuy = draft.abilityMethod === "pointBuy";
  const remaining = pointBuy ? pointBuyRemaining(draft.baseAbilities) : null;

  const abilityWall = <aside className="npc-forge-ability-wall" aria-label="Ability score assignment wall">
    <header>
      <span>2 • Assign</span>
      <h4>Ability Scores</h4>
      <p>{rolled ? "Drag a generated total into each slot." : "Set or review each base score here."}</p>
    </header>
    {rolled ? <div className="npc-forge-ability-drop-grid npc-forge-ability-wall__slots">
      {ABILITY_KEYS.map((key) => {
        const roll = rolls.find((entry) => entry.id === allocation[key]);
        const rollIndex = rolls.findIndex((entry) => entry.id === allocation[key]);
        return <button key={key} type="button" className={`npc-forge-ability-wall__slot${selectedRollId ? " is-ready" : ""}${roll ? " is-filled" : ""}`} onClick={() => onAllocate(key, selectedRollId)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onAllocate(key, event.dataTransfer.getData("text/npc-forge-roll") || selectedRollId); }} onMouseEnter={() => onDetail({ type: "ability", key })}>
          <span>{ABILITY_LABELS[key]}</span>
          <strong>{roll?.total ?? "—"}</strong>
          <small>{roll ? `Die Roll ${rollIndex + 1}` : "Drop roll here"}</small>
          <em>{roll ? `Final ${finalAbilities[key]} (${modifier(finalAbilities[key])})` : "Unassigned"}</em>
        </button>;
      })}
    </div> : <div className="npc-forge-ability-wall__manual">
      {ABILITY_KEYS.map((key) => <label key={key} onMouseEnter={() => onDetail({ type: "ability", key })}>
        <span>{ABILITY_LABELS[key]}</span>
        <input type="number" min={pointBuy ? POINT_BUY_MIN : 1} max={pointBuy ? POINT_BUY_MAX : 30} value={draft.baseAbilities?.[key] ?? 10} readOnly={draft.abilityMethod === "standard"} onChange={(event) => {
          const value = Number(event.target.value);
          if (!pointBuy || canSetPointBuyScore(draft.baseAbilities, key, value)) onSetAbility(key, value);
        }} />
        <strong>{modifier(finalAbilities[key])}</strong>
        <small>Final {finalAbilities[key]}</small>
      </label>)}
    </div>}
  </aside>;

  return <div className="npc-forge-section npc-forge-abilities-step npc-forge-abilities-forge">
    <div className="npc-forge-abilities-forge__intro">
      <span>Abilities</span>
      <div><h3>Generate, place, then finalize your scores</h3><p>Choose a generation method in the center, assign the six base scores on the left, then finish the Species Bonus in the right information panel. Feats and persistent class choices are completed later in Training. Species Bonus stays in the right information panel.</p></div>
    </div>

    <div className="npc-forge-abilities-forge__layout">
      {abilityWall}
      <section className="npc-forge-ability-bench" aria-label="Ability score generation bench">
        <header className="npc-forge-ability-bench__head">
          <span>1 • Generate</span>
          <div><h4>Build your six base scores</h4><p>{methodHelp(draft.abilityMethod)}</p></div>
        </header>

        <div className="npc-forge-subheading ability-method-heading">Ability Score Generation Method</div>
        <div className="npc-forge-segmented npc-forge-ability-methods">
          <button type="button" className={draft.abilityMethod === "3d6" ? "is-active" : ""} onClick={() => onMethod("3d6")}>Standard 3d6</button>
          <button type="button" className={draft.abilityMethod === "4d6" ? "is-active" : ""} onClick={() => onMethod("4d6")}>4d6 drop lowest die</button>
          <button type="button" className={pointBuy ? "is-active" : ""} onClick={() => onMethod("pointBuy")}>Point Buy</button>
          <button type="button" className={draft.abilityMethod === "standard" ? "is-active" : ""} onClick={() => onMethod("standard")}>Standard Class Array</button>
          <button type="button" className={draft.abilityMethod === "manual" ? "is-active" : ""} onClick={() => onMethod("manual")}>Manual Assign</button>
        </div>

        {rolled ? <>
          <div className="npc-forge-roll-toolbar"><div><strong>Six generated totals</strong><span>{draft.abilityMethod === "3d6" ? "Each total is the sum of three dice." : "Each total discards its lowest die."}</span></div><button type="button" onClick={onReroll}>Reroll All Six</button></div>
          <div className="npc-forge-roll-pool npc-forge-ability-bench__rolls">
            {rolls.map((roll, index) => {
              const assigned = Object.entries(allocation).find(([, id]) => id === roll.id)?.[0];
              return <button key={roll.id} type="button" draggable className={`npc-forge-roll-card refined ${selectedRollId === roll.id ? "is-selected" : ""}`} onClick={() => onSelectRoll(selectedRollId === roll.id ? "" : roll.id)} onDragStart={(event) => { event.dataTransfer.setData("text/npc-forge-roll", roll.id); onSelectRoll(roll.id); }}>
                <small>Die Roll {index + 1}</small>
                <strong>{roll.total}</strong>
                <div>{roll.dice.map((die, dieIndex) => <span key={dieIndex} className={dieIndex === roll.droppedIndex ? "is-dropped" : ""}>{die}</span>)}</div>
                <em>{assigned ? `Assigned to ${ABILITY_LABELS[assigned]}` : "Drag to the Ability wall"}</em>
              </button>;
            })}
          </div>
          <div className="npc-forge-allocation-instruction">{selectedRollId ? "Selected roll is ready. Drop it onto an ability on the left, or click an ability slot." : "Drag a Die Roll card directly onto the Ability wall. You can also click a roll, then click an ability."}</div>
        </> : <>
          {pointBuy ? <div className={`npc-forge-point-buy-budget ${remaining < 0 ? "is-invalid" : ""}`}><div><span>Point Buy Budget</span><strong>{Math.max(0, remaining)} / {POINT_BUY_BUDGET} remaining</strong></div><p>Spend points by changing the scores on the Ability wall. Species Bonus is applied afterward.</p></div> : null}
          <div className="npc-forge-ability-bench__method-note">
            <span>{draft.abilityMethod === "standard" ? "Class-guided array" : draft.abilityMethod === "manual" ? "Direct assignment" : "Point allocation"}</span>
            <strong>{draft.abilityMethod === "standard" ? "Review the suggested spread on the left." : draft.abilityMethod === "manual" ? "Enter the exact base scores you want on the left." : "Adjust the six scores on the left while the budget updates here."}</strong>
            <small>Final totals, modifiers, and Species Bonus are summarized in the right-hand Finalize panel.</small>
          </div>
        </>}

        <div className="npc-forge-ability-bench__finalize-cue"><span>3 • Finalize</span><strong>Review modifiers and apply the Species Bonus on the right.</strong></div>
      </section>
    </div>

    <style jsx global>{`
      .npc-forge-abilities-forge{display:grid;gap:10px}.npc-forge-abilities-forge__intro{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:0 1px}.npc-forge-abilities-forge__intro>span{padding-top:2px;color:#b99cff;font-size:.55rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.npc-forge-abilities-forge__intro>div{max-width:640px;text-align:right}.npc-forge-abilities-forge__intro h3{margin:0;color:#fff;font-size:1rem}.npc-forge-abilities-forge__intro p{margin:3px 0 0;color:rgba(255,255,255,.5);font-size:.58rem;line-height:1.4}.npc-forge-abilities-forge__layout{display:grid;grid-template-columns:minmax(205px,24%) minmax(0,1fr);gap:10px;align-items:stretch;min-height:510px}.npc-forge-ability-wall,.npc-forge-ability-bench{min-width:0;border:1px solid rgba(168,108,255,.24);border-radius:11px;background:linear-gradient(160deg,rgba(22,18,35,.96),rgba(10,15,25,.94));box-shadow:inset 0 1px rgba(255,255,255,.025)}.npc-forge-ability-wall{display:grid;grid-template-rows:auto minmax(0,1fr);gap:7px;padding:10px}.npc-forge-ability-wall>header,.npc-forge-ability-bench__head{display:grid;gap:2px}.npc-forge-ability-wall>header>span,.npc-forge-ability-bench__head>span,.npc-forge-ability-bench__finalize-cue>span{color:#8de9de;font-size:.48rem;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.npc-forge-ability-wall>header h4,.npc-forge-ability-bench__head h4{margin:0;color:#fff;font-size:.84rem}.npc-forge-ability-wall>header p,.npc-forge-ability-bench__head p{margin:0;color:rgba(255,255,255,.5);font-size:.52rem;line-height:1.35}.npc-forge-ability-wall__slots{display:grid!important;grid-template-columns:1fr!important;gap:6px!important;margin:0!important}.npc-forge-ability-wall__slot{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-rows:auto auto auto!important;gap:1px 8px!important;min-height:62px!important;padding:7px 8px!important;border:1px solid rgba(255,255,255,.085)!important;border-radius:8px!important;color:rgba(255,255,255,.72)!important;background:rgba(255,255,255,.026)!important;text-align:left!important}.npc-forge-ability-wall__slot:hover,.npc-forge-ability-wall__slot.is-ready{border-color:rgba(168,108,255,.5)!important;background:rgba(126,72,199,.08)!important}.npc-forge-ability-wall__slot.is-filled{border-color:rgba(88,214,199,.34)!important}.npc-forge-ability-wall__slot>span{font-size:.58rem;font-weight:800}.npc-forge-ability-wall__slot>strong{grid-column:2;grid-row:1/3;color:#fff3ce;font-size:1.15rem;line-height:1}.npc-forge-ability-wall__slot>small{color:rgba(255,255,255,.42);font-size:.46rem}.npc-forge-ability-wall__slot>em{grid-column:1/-1;color:#8de9de;font-size:.45rem;font-style:normal}.npc-forge-ability-wall__manual{display:grid;gap:6px}.npc-forge-ability-wall__manual label{display:grid;grid-template-columns:minmax(0,1fr) 58px auto;align-items:center;gap:3px 6px;min-height:58px;padding:7px 8px;border:1px solid rgba(255,255,255,.085);border-radius:8px;background:rgba(255,255,255,.026)}.npc-forge-ability-wall__manual label>span{color:#fff;font-size:.57rem;font-weight:800}.npc-forge-ability-wall__manual input{width:58px;min-height:30px;padding:4px 5px;text-align:center}.npc-forge-ability-wall__manual strong{color:#8de9de;font-size:.54rem}.npc-forge-ability-wall__manual small{grid-column:1/-1;color:rgba(255,255,255,.42);font-size:.45rem}.npc-forge-ability-bench{display:flex;flex-direction:column;gap:9px;padding:11px 12px}.npc-forge-ability-bench__head{grid-template-columns:auto minmax(0,1fr);gap:3px 10px;padding-bottom:2px}.npc-forge-ability-bench__head>span{grid-row:1/3;padding-top:2px}.ability-method-heading{margin:0!important;color:rgba(255,255,255,.55)!important;font-size:.48rem!important}.npc-forge-ability-methods{display:grid!important;grid-template-columns:repeat(5,minmax(110px,1fr));gap:5px!important}.npc-forge-ability-methods button{min-height:34px!important;padding:5px 7px!important;font-size:.52rem!important;line-height:1.15!important}.npc-forge-roll-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:2px;padding:8px 10px;border:1px solid rgba(168,108,255,.25);border-radius:9px;background:rgba(126,72,199,.08)}.npc-forge-roll-toolbar>div{display:grid}.npc-forge-roll-toolbar strong{color:#fff;font-size:.65rem}.npc-forge-roll-toolbar span{color:rgba(255,255,255,.5);font-size:.5rem}.npc-forge-roll-toolbar button{padding:6px 9px;border:1px solid rgba(168,108,255,.55);border-radius:7px;color:#fff;background:rgba(126,72,199,.2);font-size:.52rem}.npc-forge-ability-bench__rolls{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important;margin:0!important}.npc-forge-ability-bench__rolls .npc-forge-roll-card.refined{min-height:118px!important;padding:9px 7px!important;border-radius:9px!important}.npc-forge-ability-bench__rolls .npc-forge-roll-card.refined>small{font-size:.46rem!important}.npc-forge-ability-bench__rolls .npc-forge-roll-card.refined>strong{font-size:1.35rem!important}.npc-forge-ability-bench__rolls .npc-forge-roll-card.refined>em{font-size:.47rem!important}.npc-forge-roll-card.refined{appearance:none;width:100%;cursor:grab;text-align:center}.npc-forge-roll-card.refined.is-selected{border-color:#a86cff!important;box-shadow:0 0 0 3px rgba(168,108,255,.18)}.npc-forge-allocation-instruction{margin:0;padding:8px 9px;border-radius:7px;color:#d9c5fa;background:rgba(126,72,199,.1);font-size:.54rem;line-height:1.35}.npc-forge-point-buy-budget{display:flex;justify-content:space-between;gap:16px;margin-top:2px;padding:10px 11px;border:1px solid rgba(88,214,199,.3);border-radius:9px;background:rgba(88,214,199,.07)}.npc-forge-point-buy-budget div{display:grid}.npc-forge-point-buy-budget span{color:#9cece2;font-size:.5rem;text-transform:uppercase}.npc-forge-point-buy-budget strong{color:#fff;font-size:.82rem}.npc-forge-point-buy-budget p{margin:0;max-width:360px;color:rgba(255,255,255,.58);font-size:.54rem}.npc-forge-ability-bench__method-note{display:grid;gap:7px;min-height:180px;padding:18px;border:1px dashed rgba(168,108,255,.25);border-radius:10px;background:rgba(126,72,199,.035);align-content:center;text-align:center}.npc-forge-ability-bench__method-note>span{color:#bda8df;font-size:.52rem;font-weight:900;text-transform:uppercase}.npc-forge-ability-bench__method-note>strong{color:#fff;font-size:.78rem}.npc-forge-ability-bench__method-note>small{color:rgba(255,255,255,.5);font-size:.55rem;line-height:1.4}.npc-forge-ability-bench__finalize-cue{display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:8px;border-top:1px solid rgba(255,255,255,.07)}.npc-forge-ability-bench__finalize-cue strong{color:rgba(255,255,255,.58);font-size:.53rem;font-weight:600}@media(max-width:1180px){.npc-forge-ability-methods{grid-template-columns:repeat(3,minmax(120px,1fr))}.npc-forge-ability-bench__rolls{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:900px){.npc-forge-abilities-forge__layout{grid-template-columns:1fr;min-height:0}.npc-forge-ability-wall{order:2}.npc-forge-ability-bench{order:1}.npc-forge-ability-wall__slots,.npc-forge-ability-wall__manual{grid-template-columns:repeat(2,minmax(0,1fr))!important}.npc-forge-abilities-forge__intro{display:grid}.npc-forge-abilities-forge__intro>div{text-align:left}}@media(max-width:620px){.npc-forge-ability-methods{grid-template-columns:1fr 1fr}.npc-forge-ability-bench__rolls{grid-template-columns:1fr 1fr!important}.npc-forge-ability-wall__slots,.npc-forge-ability-wall__manual{grid-template-columns:1fr!important}.npc-forge-point-buy-budget{align-items:stretch;flex-direction:column}}
    `}</style>
  </div>;
}

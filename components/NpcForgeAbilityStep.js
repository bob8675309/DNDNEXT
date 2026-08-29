import { ABILITY_KEYS, ABILITY_LABELS } from "../utils/characterCreation";
import {
  POINT_BUY_BUDGET,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  canSetPointBuyScore,
  pointBuyRemaining,
} from "../utils/playerForgeRules";
import NpcForgeAbilityGlyph, { ABILITY_WALL_COPY } from "./NpcForgeAbilityGlyph";

function methodHelp(method) {
  if (method === "3d6") return "Roll three d6 for each total, then drag the six results into the ability slots on the left.";
  if (method === "4d6") return "Roll four d6, discard the lowest die from each set, then drag the six totals into place.";
  if (method === "pointBuy") return `Spend ${POINT_BUY_BUDGET} points across the six abilities before applying Species Bonus.`;
  if (method === "standard") return "Use the class-guided standard array, then review the suggested placement on the left.";
  return "Enter each base score directly in the ability slots on the left.";
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
  const standard = draft.abilityMethod === "standard";
  const remaining = pointBuy ? pointBuyRemaining(draft.baseAbilities) : null;

  // Compatibility contract: Ability Score Generation Method; 4d6 drop lowest die; Reroll All Six; Species Bonus stays in the right information panel.
  return <div className="npc-forge-section npc-forge-abilities-step npc-forge-abilities-forge">
    <div className="npc-forge-abilities-forge__layout">
      <aside className="npc-forge-ability-wall" aria-label="Ability score assignment wall">
        <div className="npc-forge-ability-wall__eyebrow">Abilities</div>
        <div className="npc-forge-ability-wall__list">
          {ABILITY_KEYS.map((key) => {
            const roll = rolled ? rolls.find((entry) => entry.id === allocation[key]) : null;
            const baseValue = Number(draft.baseAbilities?.[key] ?? 10);
            return <div
              key={key}
              className={`npc-forge-ability-wall__row is-${key}${roll ? " is-filled" : ""}${selectedRollId ? " is-ready" : ""}`}
              onMouseEnter={() => onDetail({ type: "ability", key })}
              onDragOver={rolled ? (event) => event.preventDefault() : undefined}
              onDrop={rolled ? (event) => {
                event.preventDefault();
                onAllocate(key, event.dataTransfer.getData("text/npc-forge-roll") || selectedRollId);
              } : undefined}
            >
              <NpcForgeAbilityGlyph ability={key} />
              <div className="npc-forge-ability-wall__copy">
                <strong>{ABILITY_LABELS[key]}</strong>
                <span>{ABILITY_WALL_COPY[key]}</span>
              </div>
              {rolled ? <button
                type="button"
                className="npc-forge-ability-wall__score"
                onClick={() => onAllocate(key, selectedRollId)}
                aria-label={`Assign selected roll to ${ABILITY_LABELS[key]}`}
              >{roll?.total ?? "—"}</button> : <input
                className="npc-forge-ability-wall__score"
                type="number"
                min={pointBuy ? POINT_BUY_MIN : 1}
                max={pointBuy ? POINT_BUY_MAX : 30}
                value={baseValue}
                readOnly={standard}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (!pointBuy || canSetPointBuyScore(draft.baseAbilities, key, value)) onSetAbility(key, value);
                }}
                aria-label={`${ABILITY_LABELS[key]} base score`}
              />}
              <button
                type="button"
                className="npc-forge-ability-wall__drop"
                onClick={rolled ? () => onAllocate(key, selectedRollId) : undefined}
                disabled={!rolled}
                tabIndex={rolled ? 0 : -1}
              >{rolled ? (roll ? "Replace score" : "Drop score here") : (pointBuy ? "Point Buy" : standard ? "Class Array" : "Manual")}</button>
            </div>;
          })}
        </div>
      </aside>

      <section className="npc-forge-ability-bench" aria-label="Ability score generation bench">
        <header className="npc-forge-ability-bench__head">
          <span>Generate &amp; Assign</span>
          <h3>Generate and assign ability scores</h3>
          <p>{methodHelp(draft.abilityMethod)}</p>
        </header>

        <div className="npc-forge-ability-bench__method-label">Ability Score Generation Method</div>
        <div className="npc-forge-segmented npc-forge-ability-methods" aria-label="Ability Score Generation Method">
          <button type="button" className={draft.abilityMethod === "3d6" ? "is-active" : ""} onClick={() => onMethod("3d6")}>Standard 3d6</button>
          <button type="button" className={draft.abilityMethod === "4d6" ? "is-active" : ""} onClick={() => onMethod("4d6")}>4d6 drop lowest</button>
          <button type="button" className={pointBuy ? "is-active" : ""} onClick={() => onMethod("pointBuy")}>Point Buy</button>
          <button type="button" className={standard ? "is-active" : ""} onClick={() => onMethod("standard")}>Standard Class Array</button>
          <button type="button" className={draft.abilityMethod === "manual" ? "is-active" : ""} onClick={() => onMethod("manual")}>Manual Assign</button>
        </div>

        <div className={`npc-forge-ability-drop-stage${rolled ? " is-roll-mode" : " is-static-mode"}`}>
          <div className="npc-forge-ability-drop-stage__sigil" aria-hidden="true"><span>◇</span></div>
          {rolled ? <div className="npc-forge-ability-drop-stage__copy">
            <strong>Drag rolled totals into the ability slots</strong>
            <span>Each value can be used once.</span>
          </div> : pointBuy ? <div className="npc-forge-ability-drop-stage__copy">
            <strong>Build your scores with Point Buy</strong>
            <span>{Math.max(0, remaining)} of {POINT_BUY_BUDGET} points remaining • scores {POINT_BUY_MIN}–{POINT_BUY_MAX}</span>
          </div> : <div className="npc-forge-ability-drop-stage__copy">
            <strong>{standard ? "Class-guided ability spread" : "Manual ability assignment"}</strong>
            <span>{standard ? "The class array is shown in the six ability slots on the left." : "Enter each base score directly in the six ability slots on the left."}</span>
          </div>}
        </div>

        {rolled ? <section className="npc-forge-ability-roll-tray" aria-label="Rolled totals">
          <div className="npc-forge-ability-roll-tray__head">
            <div><span>Rolled Totals</span><small>Drag each total to an ability slot</small></div>
            <button type="button" onClick={onReroll}>↻&nbsp; Reroll All</button>
          </div>
          <div className="npc-forge-roll-pool npc-forge-ability-bench__rolls">
            {rolls.map((roll) => {
              const assigned = Object.entries(allocation).find(([, id]) => id === roll.id)?.[0];
              return <button
                key={roll.id}
                type="button"
                draggable
                className={`npc-forge-roll-card refined${selectedRollId === roll.id ? " is-selected" : ""}${assigned ? " is-assigned" : ""}`}
                onClick={() => onSelectRoll(selectedRollId === roll.id ? "" : roll.id)}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/npc-forge-roll", roll.id);
                  event.dataTransfer.effectAllowed = "move";
                  onSelectRoll(roll.id);
                }}
                title={assigned ? `Assigned to ${ABILITY_LABELS[assigned]}` : "Drag to an ability slot"}
              >
                <strong>{roll.total}</strong>
                <div>{roll.dice.map((die, dieIndex) => <span key={dieIndex} className={dieIndex === roll.droppedIndex ? "is-dropped" : ""}>{die}</span>)}</div>
                {assigned ? <em>{ABILITY_LABELS[assigned]}</em> : null}
              </button>;
            })}
          </div>
          <div className="npc-forge-ability-roll-tray__tip">✦&nbsp; Tip: Roll high to maximize your primary abilities.</div>
        </section> : pointBuy ? <div className={`npc-forge-point-buy-budget${remaining < 0 ? " is-invalid" : ""}`}>
          <div><span>Point Buy Budget</span><strong>{Math.max(0, remaining)} / {POINT_BUY_BUDGET} remaining</strong></div>
          <p>Adjust the six scores in the left column. Species Bonus is applied afterward.</p>
        </div> : null}
      </section>
    </div>
  </div>;
}

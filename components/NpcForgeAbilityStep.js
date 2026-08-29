import { useEffect, useRef, useState } from "react";
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

function rollDetail(roll = {}) {
  const dice = Array.isArray(roll.dice) ? roll.dice : [];
  const droppedIndex = Number.isInteger(roll.droppedIndex) ? roll.droppedIndex : -1;
  const dropped = droppedIndex >= 0 ? dice[droppedIndex] : null;
  const kept = dice.filter((_, index) => index !== droppedIndex);
  const rule = roll.method === "3d6" || droppedIndex < 0 ? "3d6" : "4d6 drop lowest";
  const equation = `${kept.join(" + ")} = ${Number(roll.total || 0)}`;
  return { rule, dice, dropped, equation };
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
  const [hasRolled, setHasRolled] = useState(() => rolled && Object.values(allocation || {}).some(Boolean));
  const [isRolling, setIsRolling] = useState(false);
  const rollAnimationTimer = useRef(null);

  useEffect(() => () => {
    if (rollAnimationTimer.current) clearTimeout(rollAnimationTimer.current);
  }, []);

  useEffect(() => {
    if (!rolled) {
      setHasRolled(false);
      setIsRolling(false);
      return;
    }
    setHasRolled(Object.values(allocation || {}).some(Boolean));
    setIsRolling(false);
  }, [draft.abilityMethod]);

  function chooseMethod(method) {
    if (method === draft.abilityMethod) return;
    onMethod(method);
  }

  function rollDice() {
    if (!rolled) return;
    if (rollAnimationTimer.current) clearTimeout(rollAnimationTimer.current);
    setIsRolling(true);
    onReroll();
    setHasRolled(true);
    rollAnimationTimer.current = setTimeout(() => setIsRolling(false), 1150);
  }

  // Compatibility contract: Ability Score Generation Method; 4d6 drop lowest die; Reroll All Six; Species Bonus stays in the right information panel.
  return <div className="npc-forge-section npc-forge-abilities-step npc-forge-abilities-forge">
    <div className="npc-forge-abilities-forge__layout">
      <aside className="npc-forge-ability-wall" aria-label="Ability score assignment wall">
        <div className="npc-forge-ability-wall__eyebrow">Abilities</div>
        <div className="npc-forge-ability-wall__list">
          {ABILITY_KEYS.map((key) => {
            const roll = rolled && hasRolled ? rolls.find((entry) => entry.id === allocation[key]) : null;
            const baseValue = Number(draft.baseAbilities?.[key] ?? 10);
            return <div
              key={key}
              className={`npc-forge-ability-wall__row is-${key}${roll ? " is-filled" : ""}${selectedRollId && hasRolled ? " is-ready" : ""}`}
              onMouseEnter={() => onDetail({ type: "ability", key })}
              onDragOver={rolled && hasRolled ? (event) => event.preventDefault() : undefined}
              onDrop={rolled && hasRolled ? (event) => {
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
                onClick={() => hasRolled && onAllocate(key, selectedRollId)}
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
                onClick={rolled && hasRolled ? () => onAllocate(key, selectedRollId) : undefined}
                disabled={!rolled || !hasRolled}
                tabIndex={rolled && hasRolled ? 0 : -1}
              >{rolled ? (roll ? "Replace score" : hasRolled ? "Drop score here" : "Roll dice first") : (pointBuy ? "Point Buy" : standard ? "Class Array" : "Manual")}</button>
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
          <button type="button" className={draft.abilityMethod === "3d6" ? "is-active" : ""} onClick={() => chooseMethod("3d6")}>Standard 3d6</button>
          <button type="button" className={draft.abilityMethod === "4d6" ? "is-active" : ""} onClick={() => chooseMethod("4d6")}>4d6 drop lowest</button>
          <button type="button" className={pointBuy ? "is-active" : ""} onClick={() => chooseMethod("pointBuy")}>Point Buy</button>
          <button type="button" className={standard ? "is-active" : ""} onClick={() => chooseMethod("standard")}>Standard Class Array</button>
          <button type="button" className={draft.abilityMethod === "manual" ? "is-active" : ""} onClick={() => chooseMethod("manual")}>Manual Assign</button>
        </div>

        {rolled ? <section className={`npc-forge-ability-dice-tray${hasRolled ? " has-results" : " is-empty"}${isRolling ? " is-rolling" : ""}`} aria-label="Ability dice tray">
          <div className="npc-forge-ability-dice-tray__head">
            <div>
              <span>Dice Tray</span>
              <small>{draft.abilityMethod === "3d6" ? "Six 3d6 totals" : "Six 4d6-drop-lowest totals"}</small>
            </div>
            {hasRolled ? <button type="button" className="npc-forge-ability-dice-tray__reroll" onClick={rollDice}>↻&nbsp; Roll Again</button> : null}
          </div>

          <div className="npc-forge-ability-dice-tray__surface">
            <div className="npc-forge-ability-dice-tray__sigil" aria-hidden="true"><span>◇</span></div>
            {!hasRolled ? <div className="npc-forge-ability-dice-tray__empty">
              <strong>Ready your ability dice</strong>
              <span>No totals are revealed until you roll.</span>
              <button type="button" onClick={rollDice}>Roll Dice</button>
            </div> : <div className="npc-forge-roll-pool npc-forge-ability-bench__rolls">
              {rolls.map((roll, index) => {
                const assigned = Object.entries(allocation).find(([, id]) => id === roll.id)?.[0];
                const detail = rollDetail(roll);
                return <button
                  key={roll.id}
                  type="button"
                  draggable
                  className={`npc-forge-result-die npc-forge-roll-card refined${selectedRollId === roll.id ? " is-selected" : ""}${assigned ? " is-assigned" : ""}`}
                  onClick={() => onSelectRoll(selectedRollId === roll.id ? "" : roll.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/npc-forge-roll", roll.id);
                    event.dataTransfer.effectAllowed = "move";
                    onSelectRoll(roll.id);
                  }}
                  aria-label={`Rolled total ${roll.total}. ${assigned ? `Assigned to ${ABILITY_LABELS[assigned]}.` : "Unassigned."}`}
                >
                  <span className="npc-forge-result-die__index">{index + 1}</span>
                  <strong>{roll.total}</strong>
                  <span className="npc-forge-result-die__rule">{detail.rule}</span>
                  <span className="npc-forge-result-die__drag">Drag</span>
                  <span className="npc-forge-result-die__detail" role="tooltip">
                    <b>{detail.rule}</b>
                    <span>Dice: {detail.dice.join(", ")}</span>
                    {detail.dropped !== null ? <span>Dropped: {detail.dropped}</span> : null}
                    <strong>{detail.equation}</strong>
                    <em>{assigned ? `Assigned to ${ABILITY_LABELS[assigned]}` : "Not assigned yet"}</em>
                  </span>
                </button>;
              })}
            </div>}
          </div>
          <div className="npc-forge-ability-dice-tray__tip">✦&nbsp; Hover a result die for the dice math. Drag the final total into an ability slot.</div>
        </section> : pointBuy ? <div className={`npc-forge-point-buy-budget${remaining < 0 ? " is-invalid" : ""}`}>
          <div><span>Point Buy Budget</span><strong>{Math.max(0, remaining)} / {POINT_BUY_BUDGET} remaining</strong></div>
          <p>Adjust the six scores in the left column. Species Bonus is applied afterward.</p>
        </div> : <div className="npc-forge-ability-drop-stage is-static-mode">
          <div className="npc-forge-ability-drop-stage__sigil" aria-hidden="true"><span>◇</span></div>
          <div className="npc-forge-ability-drop-stage__copy">
            <strong>{standard ? "Class-guided ability spread" : "Manual ability assignment"}</strong>
            <span>{standard ? "The class array is shown in the six ability slots on the left." : "Enter each base score directly in the six ability slots on the left."}</span>
          </div>
        </div>}
      </section>
    </div>
  </div>;
}

import { useEffect, useState } from "react";
import { ABILITY_KEYS, ABILITY_LABELS, abilityModifierForScore } from "../utils/characterCreation";
import {
  POINT_BUY_BUDGET,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  canSetPointBuyScore,
  pointBuyRemaining,
} from "../utils/playerForgeRules";
import ForgeAbilityDiceTray, { ForgeAssignedAbilityDie } from "./dice/adapters/ForgeAbilityDiceTray";
import NpcForgeAbilityGlyph, { ABILITY_WALL_COPY } from "./NpcForgeAbilityGlyph";

function methodHelp(method) {
  if (method === "3d6") return "Roll three d6 for each total, then drag the six results into the ability slots on the left.";
  if (method === "4d6") return "Roll four d6, discard the lowest die from each set, then drag the six totals into place.";
  if (method === "pointBuy") return `Spend ${POINT_BUY_BUDGET} points across the six abilities before applying Species Bonus.`;
  if (method === "standard") return "Use the class-guided standard array, then review the suggested placement on the left.";
  return "Enter each base score directly in the ability slots on the left.";
}

function modifierLabel(score) {
  const modifier = abilityModifierForScore(score);
  return modifier >= 0 ? `+${modifier}` : String(modifier);
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
  const [rollSequence, setRollSequence] = useState(0);

  useEffect(() => {
    if (!rolled) {
      setHasRolled(false);
      return;
    }
    setHasRolled(Object.values(allocation || {}).some(Boolean));
  }, [draft.abilityMethod]);

  function chooseMethod(method) {
    if (method === draft.abilityMethod) return;
    onMethod(method);
  }

  function rollDice() {
    if (!rolled) return;
    onReroll();
    setHasRolled(true);
    setRollSequence((current) => current + 1);
  }

  // Compatibility contract: Ability Score Generation Method; 4d6 drop lowest die; Reroll All Six; Species Bonus stays in the right information panel.
  return <div className="npc-forge-section npc-forge-abilities-step npc-forge-abilities-forge">
    <div className="npc-forge-abilities-forge__layout">
      <aside className="npc-forge-ability-wall" aria-label="Ability score assignment wall">
        <div className="npc-forge-ability-wall__eyebrow">Abilities</div>
        <div className="npc-forge-ability-wall__list">
          {ABILITY_KEYS.map((key) => {
            const roll = rolled && hasRolled ? rolls.find((entry) => entry.id === allocation[key]) : null;
            const rollIndex = roll ? rolls.findIndex((entry) => entry.id === roll.id) : -1;
            const baseValue = Number(draft.baseAbilities?.[key] ?? 10);
            const showAbilityDetail = () => onDetail({ type: "ability", key });
            return <div
              key={key}
              className={`npc-forge-ability-wall__row is-${key}${roll ? " is-filled" : ""}${selectedRollId && hasRolled && !roll ? " is-ready" : ""}`}
              onMouseEnter={showAbilityDetail}
              onClick={showAbilityDetail}
              onFocusCapture={showAbilityDetail}
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
              {rolled ? (roll ? <div style={{ gridColumn: "3 / 5", justifySelf: "center" }}>
                <ForgeAssignedAbilityDie
                  roll={roll}
                  rollIndex={Math.max(0, rollIndex)}
                  ability={key}
                  modifier={modifierLabel(finalAbilities?.[key] ?? roll.total)}
                  allocation={allocation}
                  selectedRollId={selectedRollId}
                  onSelectRoll={onSelectRoll}
                  onReturnRoll={(ability) => onAllocate(ability, "")}
                />
              </div> : <button
                type="button"
                className="npc-forge-ability-wall__drop"
                style={{ gridColumn: "3 / 5", width: "100%" }}
                onClick={hasRolled ? () => onAllocate(key, selectedRollId) : undefined}
                disabled={!hasRolled}
                tabIndex={hasRolled ? 0 : -1}
              >{hasRolled ? (selectedRollId ? "Place selected die" : "Drop die here") : "Roll dice first"}</button>) : <>
                <input
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
                />
                <button
                  type="button"
                  className="npc-forge-ability-wall__drop"
                  disabled
                  tabIndex={-1}
                >{pointBuy ? "Point Buy" : standard ? "Class Array" : "Manual"}</button>
              </>}
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

        {rolled ? <section className={`npc-forge-ability-dice-tray${hasRolled ? " has-results" : " is-empty"}`} aria-label="Ability dice tray">
          <div className="npc-forge-ability-dice-tray__head">
            <div>
              <span>Dice Tray</span>
              <small>{draft.abilityMethod === "3d6" ? "Six 3d6 totals" : "Six 4d6-drop-lowest totals"}</small>
            </div>
            {hasRolled ? <button type="button" className="npc-forge-ability-dice-tray__reroll" onClick={rollDice}>↻&nbsp; Roll Again</button> : null}
          </div>

          <div className="npc-forge-ability-dice-tray__surface">
            {!hasRolled ? <div className="npc-forge-ability-dice-tray__empty">
              <strong>Ready your ability dice</strong>
              <span>No totals are revealed until you roll.</span>
              <button type="button" onClick={rollDice}>Roll Dice</button>
            </div> : <ForgeAbilityDiceTray
              rolls={rolls}
              allocation={allocation}
              selectedRollId={selectedRollId}
              rollKey={rollSequence}
              onSelectRoll={onSelectRoll}
              onReturnRoll={(ability) => onAllocate(ability, "")}
            />}
          </div>
          <div className="npc-forge-ability-dice-tray__tip">✦&nbsp; Hover for the dice math. Drag a settled die anywhere in the tray to arrange it, or drag it into an ability slot to assign it.</div>
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

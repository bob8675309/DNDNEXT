import { ABILITY_LABELS } from "../../../utils/characterCreation";
import RealisticDiceTray from "../RealisticDiceTray";

const ACCENTS = ["crimson", "gold", "emerald", "azure", "violet", "magenta"];

function rollDetail(roll = {}) {
  const dice = Array.isArray(roll.dice) ? roll.dice : [];
  const droppedIndex = Number.isInteger(roll.droppedIndex) ? roll.droppedIndex : -1;
  const dropped = droppedIndex >= 0 ? dice[droppedIndex] : null;
  const kept = dice.filter((_, index) => index !== droppedIndex);
  const rule = roll.method === "3d6" || droppedIndex < 0 ? "3d6" : "4d6 drop lowest";
  return {
    rule,
    dice,
    dropped,
    equation: `${kept.join(" + ")} = ${Number(roll.total || 0)}`,
  };
}

export default function ForgeAbilityDiceTray({
  rolls = [],
  allocation = {},
  selectedRollId = "",
  rollKey = 0,
  onSelectRoll,
}) {
  const visualDice = rolls.map((roll, index) => {
    const assigned = Object.entries(allocation).find(([, id]) => id === roll.id)?.[0] || "";
    return {
      id: roll.id,
      type: "resultCube",
      result: roll.total,
      accent: ACCENTS[index % ACCENTS.length],
      label: `Rolled total ${roll.total}. ${assigned ? `Assigned to ${ABILITY_LABELS[assigned]}.` : "Unassigned."}`,
      detail: { ...rollDetail(roll), assigned },
    };
  });

  return <RealisticDiceTray
    dice={visualDice}
    rollKey={rollKey}
    className="forge-ability-realistic-dice"
    ariaLabel="Ability score result dice"
    onDieClick={(die) => onSelectRoll?.(selectedRollId === die.id ? "" : die.id)}
    onDieDragStart={(die, event) => {
      event.dataTransfer.setData("text/npc-forge-roll", die.id);
      event.dataTransfer.effectAllowed = "move";
      onSelectRoll?.(die.id);
    }}
    renderTooltip={(die, tooltipClassName) => {
      const detail = die.detail || {};
      return <span className={tooltipClassName} role="tooltip">
        <b>{detail.rule}</b>
        <span>Dice: {(detail.dice || []).join(", ")}</span>
        {detail.dropped !== null && detail.dropped !== undefined ? <span>Dropped: {detail.dropped}</span> : null}
        <strong>{detail.equation}</strong>
        <em>{detail.assigned ? `Assigned to ${ABILITY_LABELS[detail.assigned]}` : "Not assigned yet"}</em>
      </span>;
    }}
  />;
}

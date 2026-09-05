import { ABILITY_LABELS } from "../../../utils/characterCreation";
import RealisticDiceTray, { ResultCubeDie } from "../RealisticDiceTray";
import styles from "../RealisticDiceTray.module.css";

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

export function forgeAbilityVisualDie(roll, index, allocation = {}, selectedRollId = "") {
  if (!roll) return null;
  const assigned = Object.entries(allocation).find(([, id]) => id === roll.id)?.[0] || "";
  return {
    id: roll.id,
    type: "resultCube",
    result: roll.total,
    accent: ACCENTS[index % ACCENTS.length],
    label: `Rolled total ${roll.total}. ${assigned ? `Assigned to ${ABILITY_LABELS[assigned]}.` : "Unassigned."}`,
    detail: {
      ...rollDetail(roll),
      assigned,
      selected: selectedRollId === roll.id,
    },
  };
}

function ForgeRollTooltip({ die, tooltipClassName }) {
  const detail = die?.detail || {};
  return <span className={tooltipClassName} role="tooltip">
    <b>{detail.rule}</b>
    <span>Dice: {(detail.dice || []).join(", ")}</span>
    {detail.dropped !== null && detail.dropped !== undefined ? <span>Dropped: {detail.dropped}</span> : null}
    <strong>{detail.equation}</strong>
    <em>{detail.assigned ? `Assigned to ${ABILITY_LABELS[detail.assigned]}` : "Not assigned yet"}</em>
  </span>;
}

function writeForgeDrag(event, rollId) {
  event.dataTransfer.setData("text/npc-forge-roll", rollId);
  event.dataTransfer.effectAllowed = "move";
}

export function ForgeAssignedAbilityDie({
  roll,
  rollIndex = 0,
  ability,
  modifier = "+0",
  allocation = {},
  selectedRollId = "",
  onSelectRoll,
  onReturnRoll,
}) {
  const die = forgeAbilityVisualDie(roll, rollIndex, allocation, selectedRollId);
  if (!die) return null;

  return <div className={`${styles.slotDieWrap} ${styles[`accent_${die.accent}`] || styles.accent_violet}`} data-forge-assigned-roll={die.id}>
    <ResultCubeDie
      die={die}
      settled
      staticPlacement
      draggable
      onClick={() => onSelectRoll?.(selectedRollId === die.id ? "" : die.id)}
      onDragStart={(event) => {
        writeForgeDrag(event, die.id);
        onSelectRoll?.(die.id);
      }}
      renderTooltip={(tooltipDie, tooltipClassName) => <ForgeRollTooltip die={tooltipDie} tooltipClassName={tooltipClassName} />}
      ariaLabel={`${die.label} Drag to another ability or back to the dice tray.`}
    />
    <span className={styles.modifierBadge} aria-label={`${ABILITY_LABELS[ability]} modifier ${modifier}`}>{modifier}</span>
    <button
      type="button"
      className={styles.returnButton}
      onClick={(event) => {
        event.stopPropagation();
        onReturnRoll?.(ability);
      }}
      title={`Return ${roll.total} to the dice tray`}
      aria-label={`Return rolled total ${roll.total} from ${ABILITY_LABELS[ability]} to the dice tray`}
    >↩</button>
  </div>;
}

export default function ForgeAbilityDiceTray({
  rolls = [],
  allocation = {},
  selectedRollId = "",
  rollKey = 0,
  onSelectRoll,
  onReturnRoll,
}) {
  const visualDice = rolls.map((roll, index) => forgeAbilityVisualDie(roll, index, allocation, selectedRollId)).filter(Boolean);
  const assignedRollIds = Object.values(allocation).filter(Boolean).map(String);

  return <RealisticDiceTray
    dice={visualDice}
    hiddenDieIds={assignedRollIds}
    rollKey={rollKey}
    className="forge-ability-realistic-dice"
    ariaLabel="Ability score result dice"
    onDieClick={(die) => onSelectRoll?.(selectedRollId === die.id ? "" : die.id)}
    onDieDragStart={(die, event) => {
      writeForgeDrag(event, die.id);
      onSelectRoll?.(die.id);
    }}
    onTrayDrop={(event) => {
      const rollId = event.dataTransfer.getData("text/npc-forge-roll");
      const assignedAbility = Object.entries(allocation).find(([, id]) => id === rollId)?.[0] || "";
      if (assignedAbility) onReturnRoll?.(assignedAbility);
    }}
    renderTooltip={(die, tooltipClassName) => <ForgeRollTooltip die={die} tooltipClassName={tooltipClassName} />}
  />;
}

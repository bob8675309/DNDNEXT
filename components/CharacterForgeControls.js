import { ABILITY_LABELS } from "../utils/characterCreation";

function sourceLabel(source = "") {
  if (source === "XPHB") return "2024";
  if (source === "PHB") return "2014";
  if (source === "CAMPAIGN") return "Campaign";
  return source || "Unknown";
}

export function CharacterForgeCatalogList({
  label,
  query,
  onQuery,
  rows,
  selectedId,
  onSelect,
  emptyText,
}) {
  return (
    <div className="npc-forge-catalog">
      <div className="npc-forge-catalog-head"><span>{label}</span><strong>{rows.length}</strong></div>
      <input className="npc-forge-search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}…`} />
      <div className="npc-forge-catalog-list">
        {rows.map((row) => (
          <button key={row.id} type="button" className={selectedId === row.id ? "is-active" : ""} onClick={() => onSelect(row)}>
            <span><strong>{row.name || row.class_name}</strong><small>{sourceLabel(row.source)}</small></span><b>›</b>
          </button>
        ))}
        {!rows.length ? <div className="npc-forge-empty-list">{emptyText}</div> : null}
      </div>
    </div>
  );
}

export function CharacterForgeDiceSummary({ roll, index, assignedAbility, selected, onSelect }) {
  return (
    <button
      type="button"
      draggable
      className={`npc-forge-roll-card refined ${selected ? "is-selected" : ""}`}
      onClick={() => onSelect(roll.id)}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/npc-forge-roll", roll.id);
        onSelect(roll.id);
      }}
      aria-pressed={selected}
    >
      <small>Die Roll {index + 1}</small><strong>{roll.total}</strong>
      <div>{roll.dice.map((die, dieIndex) => <span key={`${roll.id}-${dieIndex}`} className={dieIndex === roll.droppedIndex ? "is-dropped" : ""}>{die}</span>)}</div>
      <em>{assignedAbility ? `Assigned to ${ABILITY_LABELS[assignedAbility]}` : "Drag or select to assign"}</em>
    </button>
  );
}

export { sourceLabel as characterForgeSourceLabel };

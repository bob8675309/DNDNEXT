import { sourceChoiceFieldComplete, sourceChoiceFieldIsActive } from "../utils/playerForgeSourceChoices";

const safeText = (value) => String(value ?? "").trim();

function selectedKeys(selections = {}, groupId = "", fieldId = "") {
  return Array.isArray(selections?.[groupId]?.[fieldId]) ? selections[groupId][fieldId] : [];
}

function activeChoiceFields(group = {}, selections = {}) {
  return (group.fields || []).filter((field) => !field.autoSelect && sourceChoiceFieldIsActive(field, selections));
}

export function sourceChoiceGroupsHaveChoices(groups = [], selections = {}) {
  return (groups || []).some((group) => activeChoiceFields(group, selections).length > 0);
}

export function sourceChoiceGroupsNeedInput(groups = [], selections = {}) {
  return (groups || []).some((group) => activeChoiceFields(group, selections).some((field) => !sourceChoiceFieldComplete(group, field, selections)));
}

export function sourceChoiceDisplayValue(groups = [], selections = {}, fallback = "Choice required") {
  const labels = [];
  const activeFields = [];
  for (const group of groups || []) {
    for (const field of activeChoiceFields(group, selections)) {
      activeFields.push(field);
      for (const key of selectedKeys(selections, group.id, field.id)) {
        const option = (field.options || []).find((entry) => entry.key === key);
        if (option?.label && !labels.includes(option.label)) labels.push(option.label);
      }
    }
  }
  if (labels.length) return labels.join(", ");
  if (!activeFields.length) return fallback;
  const total = activeFields.reduce((sum, field) => sum + Number(field.count || 1), 0);
  const kinds = new Set(activeFields.map((field) => field.kind));
  if (kinds.size === 1 && kinds.has("language")) return `Choose ${total === 1 ? "a language" : `${total} languages`}`;
  if (kinds.size === 1 && kinds.has("tool")) return `Choose ${total === 1 ? "a tool" : `${total} tools`}`;
  if (total === 1) return "Choose an option";
  return `Choose ${total} options`;
}

export function sourceChoiceGroupHasKind(group = {}, kind = "") {
  return (group.fields || []).some((field) => field.kind === kind);
}

function DropdownField({ group, field, selections, onSet }) {
  const selected = selectedKeys(selections, group.id, field.id);
  const count = Math.max(1, Number(field.count || 1));
  const slots = Array.from({ length: count }, (_, index) => selected[index] || "");
  const distinctFrom = field.distinctFromFieldId ? selectedKeys(selections, group.id, field.distinctFromFieldId) : [];
  return <div className="npc-forge-embedded-choice__slots">{slots.map((value, index) => <label key={`${group.id}-${field.id}-${index}`}><span>{count > 1 ? `${field.label} ${index + 1}` : field.label}</span><select value={value} onChange={(event) => {
    const next = [...slots];
    next[index] = event.target.value;
    onSet?.(group.id, field.id, next.filter(Boolean));
  }}><option value="">Choose…</option>{(field.options || []).filter((option) => option.key === value || (!slots.includes(option.key) && !distinctFrom.includes(option.key))).map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>)}</div>;
}

function ButtonField({ group, field, selections, onToggle }) {
  const selected = selectedKeys(selections, group.id, field.id);
  const distinctFrom = field.distinctFromFieldId ? selectedKeys(selections, group.id, field.distinctFromFieldId) : [];
  return <div className="npc-forge-embedded-choice__buttons">{(field.options || []).filter((option) => selected.includes(option.key) || !distinctFrom.includes(option.key)).map((option) => <button key={option.key} type="button" className={selected.includes(option.key) ? "is-selected" : ""} onClick={() => onToggle?.(group.id, field.id, option.key)}><strong>{option.label}</strong>{option.description ? <small>{option.description}</small> : null}</button>)}</div>;
}

function EmbeddedField({ group, field, selections, onToggle, onSet }) {
  if (field.autoSelect || !sourceChoiceFieldIsActive(field, selections)) return null;
  const count = Math.max(1, Number(field.count || 1));
  const dropdownKinds = new Set(["tool", "language", "item", "weapon", "size", "ability", "ancestry", "lineage", "legacy", "subtype", "damage-type", "enum"]);
  const useDropdown = count > 1 || dropdownKinds.has(field.kind) || (field.options || []).length > 8;
  return <div className="npc-forge-embedded-choice__field">{useDropdown
    ? <DropdownField group={group} field={field} selections={selections} onSet={onSet} />
    : <><span>{field.label}</span><ButtonField group={group} field={field} selections={selections} onToggle={onToggle} /></>}{field.helper ? <small>{field.helper}</small> : null}{field.replacementCadence ? <small>May be replaced: {String(field.replacementCadence).replace(/-/g, " ")}.</small> : null}</div>;
}

export default function NpcForgeEmbeddedSourceChoices({ groups = [], selections = {}, onToggle = null, onSet = null, compact = false }) {
  const visibleGroups = (groups || []).filter((group) => activeChoiceFields(group, selections).length > 0);
  if (!visibleGroups.length) return null;
  return <div className={`npc-forge-embedded-choice${compact ? " is-compact" : ""}`}>{visibleGroups.map((group) => {
    const complete = activeChoiceFields(group, selections).every((field) => sourceChoiceFieldComplete(group, field, selections));
    return <section key={group.id} className={complete ? "is-complete" : "is-required"}>{!compact ? <header><div><strong>{group.label}</strong>{group.helper ? <small>{group.helper}</small> : null}</div><em>{complete ? "Selected" : "Required"}</em></header> : null}{activeChoiceFields(group, selections).map((field) => <EmbeddedField key={field.id} group={group} field={field} selections={selections} onToggle={onToggle} onSet={onSet} />)}</section>;
  })}<style jsx global>{`
    .npc-forge-embedded-choice{display:grid;gap:8px;margin-top:8px}.npc-forge-embedded-choice>section{display:grid;gap:8px;padding:9px 10px;border:1px solid rgba(168,108,255,.3);border-radius:9px;background:linear-gradient(120deg,rgba(126,72,199,.12),rgba(88,214,199,.035))}.npc-forge-embedded-choice>section.is-required{border-color:rgba(168,108,255,.52);box-shadow:inset 3px 0 rgba(168,108,255,.72)}.npc-forge-embedded-choice.is-compact>section{padding:8px 9px;background:rgba(126,72,199,.08)}.npc-forge-embedded-choice header{display:flex;align-items:start;justify-content:space-between;gap:10px}.npc-forge-embedded-choice header>div{display:grid;gap:2px}.npc-forge-embedded-choice header strong{color:#fff;font-size:.7rem}.npc-forge-embedded-choice header small,.npc-forge-embedded-choice__field>small{color:rgba(255,255,255,.74);font-size:.59rem;line-height:1.45}.npc-forge-embedded-choice header em{padding:3px 6px;border-radius:999px;color:#d8fff9;background:rgba(88,214,199,.1);font-size:.54rem;font-style:normal}.npc-forge-embedded-choice__field{display:grid;gap:5px}.npc-forge-embedded-choice__field>span,.npc-forge-embedded-choice__slots label>span{color:#eadfff;font-size:.61rem;font-weight:800}.npc-forge-embedded-choice__slots{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px}.npc-forge-embedded-choice__slots label{display:grid;gap:3px;min-width:0}.npc-forge-embedded-choice__slots select{min-width:0;width:100%;padding:7px 8px;border:1px solid rgba(168,108,255,.3);border-radius:7px;color:#fff;background:#111522}.npc-forge-embedded-choice__buttons{display:flex;flex-wrap:wrap;gap:6px}.npc-forge-embedded-choice__buttons button{display:grid;gap:2px;padding:6px 8px;border:1px solid rgba(255,255,255,.12);border-radius:7px;color:#fff;background:rgba(255,255,255,.025);text-align:left}.npc-forge-embedded-choice__buttons button.is-selected{border-color:#a86cff;background:rgba(126,72,199,.22)}.npc-forge-embedded-choice__buttons small{color:rgba(255,255,255,.72);font-size:.57rem;line-height:1.35}
  `}</style></div>;
}

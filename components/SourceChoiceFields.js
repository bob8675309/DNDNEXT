import { sourceChoiceFieldComplete, sourceChoiceFieldIsActive } from "../utils/playerForgeSourceChoices";

function selectedKeys(selections, groupId, fieldId) {
  return Array.isArray(selections?.[groupId]?.[fieldId]) ? selections[groupId][fieldId] : [];
}

function DropdownField({ group, field, selected, blocked = [], onSet }) {
  const slots = Array.from({ length: Number(field.count || 1) }, (_, index) => selected[index] || "");
  return <div className="npc-forge-source-choice-slots">{slots.map((value, index) => <label key={`${field.id}-${index}`}><span>{Number(field.count || 1) > 1 ? `${field.label} ${index + 1}` : field.label}</span><select value={value} onChange={(event) => {
    const next = [...slots];
    next[index] = event.target.value;
    onSet?.(group.id, field.id, next.filter(Boolean));
  }}><option value="">Choose…</option>{(field.options || []).filter((option) => option.key === value || (!slots.includes(option.key) && !blocked.includes(option.key))).map((option) => <option key={option.key} value={option.key}>{option.label}{option.source ? ` • ${option.source}` : ""}</option>)}</select></label>)}</div>;
}

function ButtonField({ group, field, selected, blocked = [], onToggle }) {
  return <div className="npc-forge-source-choice-buttons">{(field.options || []).filter((option) => selected.includes(option.key) || !blocked.includes(option.key)).map((option) => <button key={option.key} type="button" className={selected.includes(option.key) ? "is-selected" : ""} onClick={() => onToggle?.(group.id, field.id, option.key)}><strong>{option.label}</strong>{option.description ? <small>{option.description}</small> : null}</button>)}</div>;
}

export default function SourceChoiceFields({
  groups = [],
  selections = {},
  title = "Required source choices",
  kicker = "Source choices",
  empty = null,
  onToggle = null,
  onSet = null,
}) {
  if (!groups.length) return empty;
  return <div className="npc-forge-source-choices"><div className="npc-forge-source-choices__heading"><span>{kicker}</span><strong>{title}</strong></div>{groups.map((group) => {
    const complete = (group.fields || []).every((field) => sourceChoiceFieldComplete(group, field, selections));
    const activeFields = (group.fields || []).filter((field) => sourceChoiceFieldIsActive(field, selections));
    return <section key={group.id} className={`npc-forge-source-choice-group ${complete ? "is-complete" : "is-required"}`}><header><div><strong>{group.label}</strong><small>{group.source || "Campaign"}{group.helper ? ` • ${group.helper}` : ""}</small></div><em>{complete ? "Complete" : "Required"}</em></header>{activeFields.map((field) => {
      const selected = selectedKeys(selections, group.id, field.id);
      const blocked = field.distinctFromFieldId ? selectedKeys(selections, group.id, field.distinctFromFieldId) : [];
      const useDropdowns = ["tool", "language", "spell", "item", "weapon", "feat", "boon", "boon-or-feat"].includes(field.kind) || (field.options || []).length > 8 || Number(field.count || 1) > 1;
      return <div key={field.id} className="npc-forge-source-choice-field">{useDropdowns ? <DropdownField group={group} field={field} selected={selected} blocked={blocked} onSet={onSet} /> : <><span>{field.label}</span><ButtonField group={group} field={field} selected={selected} blocked={blocked} onToggle={onToggle} /></>}{field.replacementCadence ? <small className="npc-forge-source-choice-note">May be replaced: {String(field.replacementCadence).replace(/-/g, " ")}.</small> : null}</div>;
    })}</section>;
  })}<style jsx global>{`
    .npc-forge-source-choices{display:grid;gap:10px;margin-top:14px}.npc-forge-source-choices__heading{display:grid;gap:2px}.npc-forge-source-choices__heading>span{color:#9cece2;font-size:.6rem;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.npc-forge-source-choices__heading>strong{color:#fff;font-size:.82rem}.npc-forge-source-choice-group{display:grid;gap:10px;padding:11px 12px;border:1px solid rgba(168,108,255,.26);border-radius:10px;background:rgba(126,72,199,.06)}.npc-forge-source-choice-group.is-required{border-color:rgba(246,190,90,.46);background:rgba(246,190,90,.055)}.npc-forge-source-choice-group>header{display:flex;justify-content:space-between;gap:12px;align-items:start}.npc-forge-source-choice-group>header>div{display:grid;gap:2px}.npc-forge-source-choice-group>header strong{color:#fff;font-size:.78rem}.npc-forge-source-choice-group>header small{color:rgba(255,255,255,.54);font-size:.62rem;line-height:1.45}.npc-forge-source-choice-group>header em{padding:3px 7px;border-radius:999px;color:#aaf3e9;background:rgba(88,214,199,.1);font-size:.56rem;font-style:normal}.npc-forge-source-choice-group.is-required>header em{color:#ffe0a0;background:rgba(246,190,90,.11)}.npc-forge-source-choice-field{display:grid;gap:7px}.npc-forge-source-choice-field>span,.npc-forge-source-choice-slots label>span{color:rgba(255,255,255,.68);font-size:.64rem}.npc-forge-source-choice-slots{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:7px}.npc-forge-source-choice-slots label{display:grid;gap:4px}.npc-forge-source-choice-slots select{min-width:0}.npc-forge-source-choice-buttons{display:flex;flex-wrap:wrap;gap:6px}.npc-forge-source-choice-buttons button{display:grid;gap:2px;padding:7px 9px;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#fff;background:rgba(255,255,255,.025);text-align:left}.npc-forge-source-choice-buttons button.is-selected{border-color:#a86cff;background:rgba(126,72,199,.18)}.npc-forge-source-choice-buttons small,.npc-forge-source-choice-note{color:rgba(255,255,255,.48);font-size:.58rem}
  `}</style></div>;
}

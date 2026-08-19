import { formatPlayerFacingText } from "../utils/playerFacingText";
import { sourceChoiceFieldComplete, sourceChoiceFieldIsActive } from "../utils/playerForgeSourceChoices";
import NpcForgeHeritageTraitPicker from "./NpcForgeHeritageTraitPicker";

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

function sourceChoicePrompt(fields = []) {
  const total = fields.reduce((sum, field) => sum + Number(field.count || 1), 0);
  const kinds = new Set(fields.map((field) => field.kind));
  if (kinds.size === 1 && kinds.has("language")) return `Choose ${total === 1 ? "a language" : `${total} languages`}`;
  if (kinds.size === 1 && kinds.has("tool")) return `Choose ${total === 1 ? "a tool" : `${total} tools`}`;
  if (total === 1) return "Choose an option";
  return `Choose ${total} options`;
}

export function sourceChoiceDisplayValue(groups = [], selections = {}, fallback = "Choice required") {
  const labels = [];
  const manualFields = [];
  const incompleteFields = [];
  for (const group of groups || []) {
    for (const field of group.fields || []) {
      if (!sourceChoiceFieldIsActive(field, selections)) continue;
      for (const key of selectedKeys(selections, group.id, field.id)) {
        const option = (field.options || []).find((entry) => entry.key === key);
        if (option?.label && !labels.includes(option.label)) labels.push(option.label);
      }
      if (field.autoSelect) continue;
      manualFields.push(field);
      if (!sourceChoiceFieldComplete(group, field, selections)) incompleteFields.push(field);
    }
  }
  if (incompleteFields.length) return [...labels, sourceChoicePrompt(incompleteFields)].filter(Boolean).join(" • ");
  if (labels.length) return labels.join(", ");
  if (!manualFields.length) return fallback;
  return sourceChoicePrompt(manualFields);
}

export function sourceChoiceGroupHasKind(group = {}, kind = "") {
  return (group.fields || []).some((field) => field.kind === kind);
}

function selectedOptions(group, field, selections) {
  return selectedKeys(selections, group.id, field.id).map((key) => (field.options || []).find((entry) => entry.key === key)).filter(Boolean);
}

function hasRichOptionDetail(option = {}) {
  const metadata = option.metadata || {};
  return Boolean(
    metadata.sourceItem
    || metadata.ruleFamily
    || metadata.speciesVariant
    || Array.isArray(metadata.row)
    || (Array.isArray(metadata.facts) && metadata.facts.length)
    || (Array.isArray(metadata.traits) && metadata.traits.length)
  );
}

function choiceButtonSummary(option = {}) {
  const metadata = option.metadata || {};
  if (!hasRichOptionDetail(option)) return formatPlayerFacingText(option.description || (metadata.hideSource ? "" : option.source));
  if (metadata.damageType) return [metadata.damageType, metadata.ruleFamily || (metadata.hideSource ? "" : option.source)].filter(Boolean).join(" • ");
  if (/fiendish legac/i.test(safeText(metadata.caption))) return [metadata.hideSource ? "" : option.source, "View level 1 / 3 / 5 benefits"].filter(Boolean).join(" • ");
  if (metadata.ruleFamily) return metadata.ruleFamily;
  if (metadata.speciesVariant) return [metadata.hideSource ? "" : option.source, "Select to view lineage traits"].filter(Boolean).join(" • ");
  return [metadata.hideSource ? "" : option.source, "Select to view benefits"].filter(Boolean).join(" • ");
}

function SelectedOptionDetail({ group, field, selections }) {
  const options = selectedOptions(group, field, selections);
  if (!options.length) return null;
  return <div className="npc-forge-embedded-choice__selected">{options.map((option) => {
    const metadata = option.metadata || {};
    const columns = Array.isArray(metadata.columns) ? metadata.columns : [];
    const row = Array.isArray(metadata.row) ? metadata.row : [];
    const facts = Array.isArray(metadata.facts) ? metadata.facts : [];
    const traits = Array.isArray(metadata.traits) ? metadata.traits : [];
    const structuredCells = row.slice(1).map((value, index) => ({ label: safeText(columns[index + 1]) || `Detail ${index + 1}`, value: safeText(value) })).filter((entry) => entry.value);
    return <article key={option.key}><div className="npc-forge-embedded-choice__selected-head"><div><strong>{option.label}</strong>{metadata.ruleFamily ? <small>{metadata.ruleFamily}</small> : option.source && !metadata.hideSource ? <small>{option.source}</small> : null}</div>{metadata.damageType ? <em>{metadata.damageType}</em> : null}</div>{facts.length ? <div className="npc-forge-embedded-choice__facts">{facts.map((fact) => <span key={`${option.key}-${fact.label}`}><small>{fact.label}</small><b>{fact.value}</b></span>)}</div> : null}{structuredCells.length ? <div className="npc-forge-embedded-choice__details">{structuredCells.map((entry) => <div key={`${option.key}-${entry.label}`}><small>{entry.label}</small><span>{entry.value}</span></div>)}</div> : option.description ? <p>{formatPlayerFacingText(option.description)}</p> : null}{traits.length ? <div className="npc-forge-embedded-choice__traits">{traits.map((trait) => <div key={`${option.key}-${trait.name}`}><strong>{trait.name}</strong><p>{formatPlayerFacingText(trait.description)}</p></div>)}</div> : null}</article>;
  })}</div>;
}

function DropdownField({ group, field, selections, onSet }) {
  const selected = selectedKeys(selections, group.id, field.id);
  const count = Math.max(1, Number(field.count || 1));
  const slots = Array.from({ length: count }, (_, index) => selected[index] || "");
  const distinctFrom = field.distinctFromFieldId ? selectedKeys(selections, group.id, field.distinctFromFieldId) : [];
  return <><div className="npc-forge-embedded-choice__slots">{slots.map((value, index) => <label key={`${group.id}-${field.id}-${index}`}><span>{count > 1 ? `${field.label} ${index + 1}` : field.label}</span><select value={value} onChange={(event) => {
    const next = [...slots];
    next[index] = event.target.value;
    onSet?.(group.id, field.id, next.filter(Boolean));
  }}><option value="">Choose…</option>{(field.options || []).filter((option) => option.key === value || (!slots.includes(option.key) && !distinctFrom.includes(option.key))).map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>)}</div><SelectedOptionDetail group={group} field={field} selections={selections} /></>;
}

function ButtonField({ group, field, selections, onToggle }) {
  const selected = selectedKeys(selections, group.id, field.id);
  const distinctFrom = field.distinctFromFieldId ? selectedKeys(selections, group.id, field.distinctFromFieldId) : [];
  const descriptiveOptions = field.presentation === "descriptive-options" && !(field.options || []).every((option) => hasRichOptionDetail(option));
  return <><div className={`npc-forge-embedded-choice__buttons${descriptiveOptions ? " is-descriptive" : ""}`}>{(field.options || []).filter((option) => selected.includes(option.key) || !distinctFrom.includes(option.key)).map((option) => {
    const summary = choiceButtonSummary(option);
    const isSelected = selected.includes(option.key);
    return <button key={option.key} type="button" className={isSelected ? "is-selected" : ""} aria-pressed={isSelected} onClick={() => onToggle?.(group.id, field.id, option.key)}><strong>{option.label}</strong>{summary ? <small>{summary}</small> : null}</button>;
  })}</div>{descriptiveOptions ? null : <SelectedOptionDetail group={group} field={field} selections={selections} />}</>;
}

function EmbeddedField({ group, field, selections, onToggle, onSet }) {
  if (field.autoSelect || !sourceChoiceFieldIsActive(field, selections)) return null;
  const count = Math.max(1, Number(field.count || 1));
  const dropdownKinds = new Set(["tool", "language", "item", "weapon", "size", "ability", "damage-type", "enum"]);
  const useDropdown = count > 1 || dropdownKinds.has(field.kind) || (field.options || []).length > 8;
  return <div className="npc-forge-embedded-choice__field">{useDropdown
    ? <DropdownField group={group} field={field} selections={selections} onSet={onSet} />
    : <><span>{field.label}</span><ButtonField group={group} field={field} selections={selections} onToggle={onToggle} /></>}{field.helper ? <small>{field.helper}</small> : null}{field.replacementCadence ? <small>May be replaced: {String(field.replacementCadence).replace(/-/g, " ")}.</small> : null}</div>;
}

export default function NpcForgeEmbeddedSourceChoices({ groups = [], selections = {}, onToggle = null, onSet = null, compact = false }) {
  const visibleGroups = (groups || []).filter((group) => activeChoiceFields(group, selections).length > 0);
  if (!visibleGroups.length) return null;
  return <div className={`npc-forge-embedded-choice${compact ? " is-compact" : ""}`}>{visibleGroups.map((group) => {
    if (group?.metadata?.heritageTraitGroup) return <NpcForgeHeritageTraitPicker key={group.id} group={group} selections={selections} onSet={onSet} />;
    const complete = activeChoiceFields(group, selections).every((field) => sourceChoiceFieldComplete(group, field, selections));
    return <section key={group.id} className={complete ? "is-complete" : "is-required"}>{!compact ? <header><div><strong>{group.label}</strong>{group.helper ? <small>{group.helper}</small> : null}</div><em>{complete ? "Selected" : "Required"}</em></header> : null}{activeChoiceFields(group, selections).map((field) => <EmbeddedField key={field.id} group={group} field={field} selections={selections} onToggle={onToggle} onSet={onSet} />)}</section>;
  })}<style jsx global>{`
    .npc-forge-embedded-choice{display:grid;gap:8px;margin-top:8px}.npc-forge-embedded-choice>section{display:grid;gap:8px;padding:9px 10px;border:1px solid rgba(168,108,255,.3);border-radius:9px;background:linear-gradient(120deg,rgba(126,72,199,.12),rgba(88,214,199,.035))}.npc-forge-embedded-choice>section.is-required{border-color:rgba(168,108,255,.52);box-shadow:inset 3px 0 rgba(168,108,255,.72)}.npc-forge-embedded-choice.is-compact>section{padding:8px 9px;background:rgba(126,72,199,.08)}.npc-forge-embedded-choice header{display:flex;align-items:start;justify-content:space-between;gap:10px}.npc-forge-embedded-choice header>div{display:grid;gap:2px}.npc-forge-embedded-choice header strong{color:#fff;font-size:.7rem}.npc-forge-embedded-choice header small,.npc-forge-embedded-choice__field>small{color:rgba(255,255,255,.74);font-size:.59rem;line-height:1.45}.npc-forge-embedded-choice header em{padding:3px 6px;border-radius:999px;color:#d8fff9;background:rgba(88,214,199,.1);font-size:.54rem;font-style:normal}.npc-forge-embedded-choice__field{display:grid;gap:7px}.npc-forge-embedded-choice__field>span,.npc-forge-embedded-choice__slots label>span{color:#eadfff;font-size:.61rem;font-weight:800}.npc-forge-embedded-choice__slots{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px}.npc-forge-embedded-choice__slots label{display:grid;gap:3px;min-width:0}.npc-forge-embedded-choice__slots select{min-width:0;width:100%;padding:7px 8px;border:1px solid rgba(168,108,255,.3);border-radius:7px;color:#fff;background:#111522}.npc-forge-embedded-choice__buttons{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:7px}.npc-forge-embedded-choice__buttons button{display:grid;align-content:start;gap:4px;min-height:58px;padding:8px 9px;border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#fff;background:rgba(255,255,255,.025);text-align:left}.npc-forge-embedded-choice__buttons.is-descriptive button{min-height:84px;padding:10px 11px}.npc-forge-embedded-choice__buttons button:hover{border-color:rgba(168,108,255,.55);background:rgba(126,72,199,.1)}.npc-forge-embedded-choice__buttons button.is-selected{border-color:#a86cff;background:rgba(126,72,199,.22);box-shadow:inset 3px 0 #a86cff}.npc-forge-embedded-choice__buttons small{color:rgba(255,255,255,.72);font-size:.57rem;line-height:1.42}.npc-forge-embedded-choice__buttons.is-descriptive small{font-size:.6rem;line-height:1.5}.npc-forge-embedded-choice__selected{display:grid;gap:7px}.npc-forge-embedded-choice__selected>article{display:grid;gap:8px;padding:9px 10px;border:1px solid rgba(88,214,199,.26);border-radius:8px;background:rgba(88,214,199,.055)}.npc-forge-embedded-choice__selected-head{display:flex;align-items:start;justify-content:space-between;gap:10px}.npc-forge-embedded-choice__selected-head>div{display:grid;gap:1px}.npc-forge-embedded-choice__selected-head strong{font-size:.68rem}.npc-forge-embedded-choice__selected-head small{color:#9cece2;font-size:.53rem}.npc-forge-embedded-choice__selected-head em{padding:3px 6px;border-radius:999px;color:#fff3ce;background:rgba(255,204,91,.09);font-size:.54rem;font-style:normal}.npc-forge-embedded-choice__selected p{margin:0;color:rgba(255,255,255,.8);font-size:.62rem;line-height:1.55}.npc-forge-embedded-choice__details,.npc-forge-embedded-choice__facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:6px}.npc-forge-embedded-choice__details>div,.npc-forge-embedded-choice__facts>span{display:grid;gap:2px;padding:6px 7px;border:1px solid rgba(255,255,255,.09);border-radius:7px;background:rgba(0,0,0,.14)}.npc-forge-embedded-choice__details small,.npc-forge-embedded-choice__facts small{color:rgba(255,255,255,.48);font-size:.49rem;font-weight:800;text-transform:uppercase}.npc-forge-embedded-choice__details span,.npc-forge-embedded-choice__facts b{color:#fff;font-size:.59rem;line-height:1.42}.npc-forge-embedded-choice__traits{display:grid;gap:6px}.npc-forge-embedded-choice__traits>div{padding:7px 8px;border-left:2px solid rgba(168,108,255,.65);background:rgba(126,72,199,.06)}.npc-forge-embedded-choice__traits strong{font-size:.61rem}.npc-forge-embedded-choice__traits p{margin-top:3px}
  `}</style></div>;
}

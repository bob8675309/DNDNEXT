import { useMemo, useState } from "react";
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

function FixedField({ field, selected = [] }) {
  const values = (field.options || []).filter((option) => selected.includes(option.key));
  return <div className="npc-forge-source-choice-fixed"><span>{field.label}</span><div>{values.map((option) => <strong key={option.key}>{option.label}</strong>)}</div><small>Granted automatically by the selected source. No choice is required.</small></div>;
}

function prerequisiteText(option = {}) {
  const direct = option.metadata?.prerequisiteText || option.prerequisite || option.requires || "";
  if (direct) return String(direct);
  const prerequisites = option.metadata?.prerequisites || option.metadata?.prerequisiteResult || option.metadata?.prerequisite || null;
  if (!prerequisites) return "";
  if (typeof prerequisites === "string") return prerequisites;
  if (Array.isArray(prerequisites)) return prerequisites.map((entry) => typeof entry === "string" ? entry : JSON.stringify(entry)).join(" • ");
  if (typeof prerequisites === "object") return Object.entries(prerequisites).map(([key, value]) => {
    if (key === "minClassLevel") return `Artificer level ${value}+`;
    return `${key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}: ${Array.isArray(value) ? value.join(", ") : String(value)}`;
  }).join(" • ");
  return "";
}

function optionMeta(option = {}) {
  const parts = [];
  if (option.source) parts.push(option.source);
  if (option.metadata?.level != null) parts.push(Number(option.metadata.level) === 0 ? "Cantrip" : `Level ${option.metadata.level}`);
  if (option.metadata?.minClassLevel) parts.push(`Artificer ${option.metadata.minClassLevel}+`);
  if (option.metadata?.acquisitionLevel) parts.push(`gained at ${option.metadata.acquisitionLevel}`);
  if (option.metadata?.rarity) parts.push(String(option.metadata.rarity));
  if (option.metadata?.itemType) parts.push(String(option.metadata.itemType));
  if (option.metadata?.category) parts.push(option.metadata.category);
  return parts.join(" • ");
}

function ArtificerPlanCatalogueStatus({ summary = null }) {
  if (!summary) return null;
  const future = Array.isArray(summary.futureUnlocks) ? summary.futureUnlocks : [];
  return <aside className="npc-forge-plan-catalogue-status" aria-label="Artificer Magic Item Plan availability">
    <div><span>Magic Item Plan catalogue</span><strong>{Number(summary.availableCount || 0)} of {Number(summary.totalCount || 0)} plans available at Artificer level {Number(summary.startingLevel || 1)}</strong></div>
    {future.length ? <details><summary>Show plans that unlock at later Artificer levels</summary><div>{future.map((entry) => <section key={entry.unlockLevel}><header><strong>Level {entry.unlockLevel}</strong><span>{entry.count} plan{entry.count === 1 ? "" : "s"}</span></header><p>{(entry.names || []).join(" • ")}</p></section>)}</div></details> : <small>All imported EFA plans are available at this starting level.</small>}
    <p>Locked plans are shown here for progression planning only. They do not enter the selectable plan list until the character reaches their required Artificer level.</p>
  </aside>;
}

function RichField({ group, field, selected = [], blocked = [], onToggle }) {
  const [query, setQuery] = useState("");
  const [focusedKey, setFocusedKey] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const options = useMemo(() => (field.options || []).filter((option) => selectedSet.has(option.key) || !blocked.includes(option.key)), [blocked, field.options, selectedSet]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => [option.label, option.source, option.description, prerequisiteText(option), optionMeta(option)].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [options, query]);
  const focused = options.find((option) => option.key === focusedKey)
    || options.find((option) => selectedSet.has(option.key))
    || filtered[0]
    || options[0]
    || null;
  const count = Math.max(1, Number(field.count || 1));
  const complete = selected.length === count;

  return <div className="npc-forge-rich-choice">
    <div className="npc-forge-rich-choice__head"><div><span>{field.label}</span><strong>{selected.length}/{count} selected{field.metadata?.canonicalPoolCount ? ` • ${field.metadata.canonicalPoolCount} canonical items in this legal pool` : ""}</strong></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${field.label.toLowerCase()}…`} /></div>
    <div className="npc-forge-rich-choice__grid">
      <div className="npc-forge-rich-choice__list">{filtered.map((option) => {
        const isSelected = selectedSet.has(option.key);
        return <button key={option.key} type="button" className={`${focused?.key === option.key ? "is-focused" : ""} ${isSelected ? "is-selected" : ""}`} onClick={() => setFocusedKey(option.key)}><span><strong>{option.label}</strong><small>{optionMeta(option) || option.kind || field.kind}</small></span><em>{isSelected ? "Selected" : "View"}</em></button>;
      })}{!filtered.length ? <div className="npc-forge-rich-choice__empty">No options match this search.</div> : null}</div>
      <article className="npc-forge-rich-choice__detail">{focused ? <><header><div><span>{field.kind.replace(/-/g, " ")}</span><h4>{focused.label}</h4><small>{optionMeta(focused)}</small></div><button type="button" className={selectedSet.has(focused.key) ? "is-selected" : ""} onClick={() => onToggle?.(group.id, field.id, focused.key)} disabled={!selectedSet.has(focused.key) && complete}>{selectedSet.has(focused.key) ? "Remove" : complete ? "Selection complete" : "Choose"}</button></header>{prerequisiteText(focused) ? <div className="npc-forge-rich-choice__prerequisite"><strong>Prerequisite</strong><span>{prerequisiteText(focused)}</span></div> : null}<p>{focused.description || "This source-backed option has no additional imported description."}</p>{focused.metadata?.rangeText || focused.metadata?.damageDice || focused.metadata?.attunement ? <div className="npc-forge-rich-choice__facts">{focused.metadata?.rangeText ? <span>Range <b>{focused.metadata.rangeText}</b></span> : null}{focused.metadata?.damageDice ? <span>Damage <b>{focused.metadata.damageDice}{focused.metadata?.damageTypes?.length ? ` ${focused.metadata.damageTypes.join("/")}` : ""}</b></span> : null}{focused.metadata?.attunement ? <span>Attunement <b>{String(focused.metadata.attunement)}</b></span> : null}</div> : null}</> : <p>Select an option from the catalogue.</p>}</article>
    </div>
  </div>;
}

function prefersRichField(field = {}) {
  return ["spell", "feat", "boon", "boon-or-feat", "eldritch-invocation", "artificer-plan"].includes(field.kind)
    || ((field.options || []).length > 12 && !["language", "tool"].includes(field.kind));
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
    return <section key={group.id} className={`npc-forge-source-choice-group ${complete ? "is-complete" : "is-required"}`}><header><div><strong>{group.label}</strong><small>{group.source || "Campaign"}{group.helper ? ` • ${group.helper}` : ""}</small></div><em>{complete ? "Complete" : "Required"}</em></header><ArtificerPlanCatalogueStatus summary={group.metadata?.catalogueSummary} />{activeFields.map((field) => {
      const selected = selectedKeys(selections, group.id, field.id);
      const blocked = field.distinctFromFieldId ? selectedKeys(selections, group.id, field.distinctFromFieldId) : [];
      const useDropdowns = ["tool", "language", "item", "weapon"].includes(field.kind) || Number(field.count || 1) > 1;
      return <div key={field.id} className="npc-forge-source-choice-field">{field.autoSelect ? <FixedField field={field} selected={selected} /> : prefersRichField(field) ? <RichField group={group} field={field} selected={selected} blocked={blocked} onToggle={onToggle} /> : useDropdowns ? <DropdownField group={group} field={field} selected={selected} blocked={blocked} onSet={onSet} /> : <><span>{field.label}</span><ButtonField group={group} field={field} selected={selected} blocked={blocked} onToggle={onToggle} /></>}{field.replacementCadence ? <small className="npc-forge-source-choice-note">May be replaced: {String(field.replacementCadence).replace(/-/g, " ")}.</small> : null}</div>;
    })}</section>;
  })}<style jsx global>{`
    .npc-forge-source-choices{display:grid;gap:10px;margin-top:14px}.npc-forge-source-choices__heading{display:grid;gap:2px}.npc-forge-source-choices__heading>span{color:#9cece2;font-size:.6rem;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.npc-forge-source-choices__heading>strong{color:#fff;font-size:.82rem}.npc-forge-source-choice-group{display:grid;gap:10px;padding:11px 12px;border:1px solid rgba(168,108,255,.26);border-radius:10px;background:rgba(126,72,199,.06)}.npc-forge-source-choice-group.is-required{border-color:rgba(246,190,90,.46);background:rgba(246,190,90,.055)}.npc-forge-source-choice-group>header{display:flex;justify-content:space-between;gap:12px;align-items:start}.npc-forge-source-choice-group>header>div{display:grid;gap:2px}.npc-forge-source-choice-group>header strong{color:#fff;font-size:.78rem}.npc-forge-source-choice-group>header small{color:rgba(255,255,255,.72);font-size:.62rem;line-height:1.45}.npc-forge-source-choice-group>header em{padding:3px 7px;border-radius:999px;color:#aaf3e9;background:rgba(88,214,199,.1);font-size:.56rem;font-style:normal}.npc-forge-source-choice-group.is-required>header em{color:#ffe0a0;background:rgba(246,190,90,.11)}.npc-forge-source-choice-field{display:grid;gap:7px}.npc-forge-source-choice-field>span,.npc-forge-source-choice-slots label>span{color:rgba(255,255,255,.78);font-size:.64rem}.npc-forge-source-choice-slots{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:7px}.npc-forge-source-choice-slots label{display:grid;gap:4px}.npc-forge-source-choice-slots select{min-width:0}.npc-forge-source-choice-buttons{display:flex;flex-wrap:wrap;gap:6px}.npc-forge-source-choice-buttons button{display:grid;gap:2px;padding:7px 9px;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#fff;background:rgba(255,255,255,.025);text-align:left}.npc-forge-source-choice-buttons button.is-selected{border-color:#a86cff;background:rgba(126,72,199,.18)}.npc-forge-source-choice-buttons small,.npc-forge-source-choice-note{color:rgba(255,255,255,.72);font-size:.58rem}.npc-forge-source-choice-fixed{display:grid;gap:5px;padding:9px 10px;border:1px solid rgba(88,214,199,.24);border-radius:9px;background:rgba(88,214,199,.055)}.npc-forge-source-choice-fixed>span{color:#9cece2;font-size:.61rem;font-weight:800;text-transform:uppercase}.npc-forge-source-choice-fixed>div{display:flex;flex-wrap:wrap;gap:6px}.npc-forge-source-choice-fixed strong{padding:5px 8px;border:1px solid rgba(88,214,199,.28);border-radius:999px;color:#d8fff9;background:rgba(88,214,199,.08);font-size:.68rem}.npc-forge-source-choice-fixed small{color:rgba(255,255,255,.72);font-size:.59rem}.npc-forge-plan-catalogue-status{display:grid;gap:8px;padding:10px 11px;border:1px solid rgba(88,214,199,.24);border-radius:9px;background:rgba(88,214,199,.055)}.npc-forge-plan-catalogue-status>div{display:grid;gap:2px}.npc-forge-plan-catalogue-status>div>span{color:#9cece2;font-size:.57rem;font-weight:900;letter-spacing:.07em;text-transform:uppercase}.npc-forge-plan-catalogue-status>div>strong{color:#fff;font-size:.72rem}.npc-forge-plan-catalogue-status details{padding:7px 8px;border-radius:7px;background:rgba(0,0,0,.16)}.npc-forge-plan-catalogue-status summary{cursor:pointer;color:#dfc8ff;font-size:.64rem;font-weight:800}.npc-forge-plan-catalogue-status details>div{display:grid;gap:7px;margin-top:8px}.npc-forge-plan-catalogue-status section{display:grid;gap:3px;padding-top:6px;border-top:1px solid rgba(255,255,255,.07)}.npc-forge-plan-catalogue-status section:first-child{padding-top:0;border-top:0}.npc-forge-plan-catalogue-status section header{display:flex;justify-content:space-between;gap:8px}.npc-forge-plan-catalogue-status section header strong{color:#fff;font-size:.64rem}.npc-forge-plan-catalogue-status section header span{color:#9cece2;font-size:.58rem}.npc-forge-plan-catalogue-status p,.npc-forge-plan-catalogue-status small{margin:0;color:rgba(255,255,255,.76);font-size:.6rem;line-height:1.5}.npc-forge-rich-choice{display:grid;gap:8px}.npc-forge-rich-choice__head{display:flex;align-items:end;justify-content:space-between;gap:10px}.npc-forge-rich-choice__head>div{display:grid;gap:2px}.npc-forge-rich-choice__head span{color:rgba(255,255,255,.78);font-size:.61rem;text-transform:uppercase}.npc-forge-rich-choice__head strong{color:#fff;font-size:.75rem}.npc-forge-rich-choice__head input{min-width:240px;max-width:420px;flex:1;padding:7px 9px;border:1px solid rgba(168,108,255,.34);border-radius:8px;color:#fff;background:#0c0e17}.npc-forge-rich-choice__grid{display:grid;grid-template-columns:minmax(220px,38%) minmax(0,62%);min-height:280px;overflow:hidden;border:1px solid rgba(168,108,255,.25);border-radius:10px;background:#0a0c14}.npc-forge-rich-choice__list{max-height:390px;overflow:auto;border-right:1px solid rgba(255,255,255,.08)}.npc-forge-rich-choice__list>button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border:0;border-bottom:1px solid rgba(255,255,255,.06);color:#fff;background:transparent;text-align:left}.npc-forge-rich-choice__list>button.is-focused{background:rgba(126,72,199,.17);box-shadow:inset 3px 0 #a86cff}.npc-forge-rich-choice__list>button.is-selected{background:rgba(88,214,199,.08)}.npc-forge-rich-choice__list>button span{display:grid;gap:2px}.npc-forge-rich-choice__list strong{font-size:.71rem}.npc-forge-rich-choice__list small{color:rgba(255,255,255,.72);font-size:.57rem}.npc-forge-rich-choice__list em{color:#cdb5ff;font-size:.56rem;font-style:normal}.npc-forge-rich-choice__empty{padding:12px;color:rgba(255,255,255,.72);font-size:.65rem}.npc-forge-rich-choice__detail{display:grid;align-content:start;gap:10px;padding:14px}.npc-forge-rich-choice__detail header{display:flex;align-items:start;justify-content:space-between;gap:12px}.npc-forge-rich-choice__detail header>div{display:grid;gap:2px}.npc-forge-rich-choice__detail header span{color:#9cece2;font-size:.55rem;font-weight:900;text-transform:uppercase}.npc-forge-rich-choice__detail h4{margin:0;color:#fff;font-size:1rem}.npc-forge-rich-choice__detail header small{color:rgba(255,255,255,.72);font-size:.61rem}.npc-forge-rich-choice__detail header button{padding:7px 10px;border:1px solid rgba(168,108,255,.5);border-radius:8px;color:#fff;background:rgba(126,72,199,.18);font-size:.65rem}.npc-forge-rich-choice__detail header button.is-selected{border-color:rgba(255,143,122,.45);background:rgba(255,143,122,.08)}.npc-forge-rich-choice__detail header button:disabled{opacity:.55}.npc-forge-rich-choice__detail p{margin:0;color:rgba(255,255,255,.86);font-size:.72rem;line-height:1.58;white-space:pre-line}.npc-forge-rich-choice__prerequisite{display:grid;gap:2px;padding:8px 10px;border-left:3px solid #f6be5a;border-radius:7px;background:rgba(246,190,90,.07)}.npc-forge-rich-choice__prerequisite strong{color:#ffe0a0;font-size:.58rem;text-transform:uppercase}.npc-forge-rich-choice__prerequisite span{color:rgba(255,255,255,.86);font-size:.66rem}.npc-forge-rich-choice__facts{display:flex;flex-wrap:wrap;gap:7px}.npc-forge-rich-choice__facts span{display:grid;gap:1px;padding:6px 8px;border:1px solid rgba(88,214,199,.2);border-radius:7px;color:rgba(255,255,255,.72);font-size:.55rem}.npc-forge-rich-choice__facts b{color:#d8fff9;font-size:.65rem}@media(max-width:850px){.npc-forge-rich-choice__head{align-items:stretch;flex-direction:column}.npc-forge-rich-choice__head input{width:100%;max-width:none}.npc-forge-rich-choice__grid{grid-template-columns:1fr}.npc-forge-rich-choice__list{max-height:260px;border-right:0;border-bottom:1px solid rgba(255,255,255,.08)}}
  `}</style></div>;
}

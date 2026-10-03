import { useMemo, useState } from "react";
import { sourceChoiceFieldIsActive } from "../utils/playerForgeSourceChoices";

function selectedKeys(selections = {}, groupId = "", fieldId = "") {
  return Array.isArray(selections?.[groupId]?.[fieldId]) ? selections[groupId][fieldId] : [];
}

function optionMeta(option = {}, field = {}, group = {}) {
  const parts = [];
  if (option.source || group.source) parts.push(option.source || group.source);
  const minimum = Number(option.metadata?.prerequisites?.minClassLevel || option.metadata?.minClassLevel || 0);
  if (minimum > 0) parts.push(`Level ${minimum}+`);
  if (field.replacementCadence) parts.push(`Replace on ${String(field.replacementCadence).replace(/-/g, " ")}`);
  return parts.join(" • ");
}

export default function NpcForgeClassOptionBrowser({ groups = [], selections = {}, onDetail = null }) {
  const [queries, setQueries] = useState({});
  const visibleGroups = useMemo(
    () => (groups || []).filter((group) => group?.ownerType === "class-option"),
    [groups]
  );

  if (!visibleGroups.length) {
    return <section className="npc-forge-class-option-browser is-empty">
      <header><span>Source-backed class options</span><strong>No additional class-option slots are active at this level.</strong></header>
    </section>;
  }

  return <section className="npc-forge-class-option-browser" aria-label="Source-backed class choices">
    <header>
      <div><span>Source-backed class options</span><strong>Choose from the class catalogue</strong></div>
      <p>Click an option to inspect it on the right. Selection is confirmed from Current Selection.</p>
    </header>

    <div className="npc-forge-class-option-browser__groups">
      {visibleGroups.map((group) => {
        const activeFields = (group.fields || []).filter((field) => sourceChoiceFieldIsActive(field, selections));
        const requiredFields = activeFields.filter((field) => field.required !== false);
        const groupTarget = requiredFields.reduce((sum, field) => sum + Math.max(1, Number(field.count || 1)), 0);
        const groupDone = requiredFields.reduce((sum, field) => sum + Math.min(Math.max(1, Number(field.count || 1)), selectedKeys(selections, group.id, field.id).length), 0);
        return <section key={group.id} className={`npc-forge-class-option-group ${groupDone >= groupTarget ? "is-complete" : "is-required"}`}>
          <header>
            <span><strong>{group.label}</strong><small>{group.source || "Campaign"}{group.level ? ` • gained at level ${group.level}` : ""}</small></span>
            <em>{groupTarget ? `${groupDone}/${groupTarget}` : "Ready"}</em>
          </header>

          {activeFields.map((field) => {
            const selected = selectedKeys(selections, group.id, field.id);
            const queryKey = `${group.id}:${field.id}`;
            const query = queries[queryKey] || "";
            const options = field.options || [];
            const filtered = options.filter((option) => !query || [option.label, option.description, option.source, optionMeta(option, field, group)].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase()));
            return <div key={field.id} className="npc-forge-class-option-field">
              <div className="npc-forge-class-option-field__head">
                <span><strong>{field.label}</strong><small>{selected.length}/{Math.max(1, Number(field.count || 1))} selected</small></span>
                {options.length > 8 ? <input value={query} onChange={(event) => setQueries((current) => ({ ...current, [queryKey]: event.target.value }))} placeholder={`Search ${field.label.toLowerCase()}…`} /> : null}
              </div>
              <div className="npc-forge-class-option-list">
                {filtered.map((option) => {
                  const isSelected = selected.includes(option.key);
                  return <button key={option.key} type="button" className={isSelected ? "is-selected" : ""} onClick={() => onDetail?.({
                    type: "classSourceOption",
                    groupId: group.id,
                    fieldId: field.id,
                    optionKey: option.key,
                    group,
                    field,
                    option,
                  })}>
                    <span><strong>{option.label}</strong><small>{optionMeta(option, field, group) || field.kind || "Class option"}</small></span>
                    <em>{isSelected ? "Selected" : "View"}</em>
                  </button>;
                })}
                {!filtered.length ? <div className="npc-forge-class-option-list__empty">No options match this search.</div> : null}
              </div>
            </div>;
          })}
        </section>;
      })}
    </div>

    <style jsx global>{`
      .npc-forge-class-option-browser{display:grid;gap:8px;margin:0;padding:9px 0;border-top:1px solid rgba(255,255,255,.06)}
      .npc-forge-class-option-browser>header{display:flex;align-items:end;justify-content:space-between;gap:12px;padding:0 1px}
      .npc-forge-class-option-browser>header>div{display:grid;gap:2px}
      .npc-forge-class-option-browser>header span{color:#9cece2;font-size:.52rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
      .npc-forge-class-option-browser>header strong{color:#fff;font-size:.7rem}
      .npc-forge-class-option-browser>header p{max-width:260px;margin:0;color:rgba(255,255,255,.48);font-size:.48rem;line-height:1.4}
      .npc-forge-class-option-browser.is-empty{padding:12px 1px}
      .npc-forge-class-option-browser__groups{display:grid;gap:7px}
      .npc-forge-class-option-group{display:grid;gap:7px;padding:8px;border-left:2px solid rgba(168,108,255,.34);background:linear-gradient(90deg,rgba(126,72,199,.045),transparent)}
      .npc-forge-class-option-group.is-required{border-left-color:rgba(243,191,99,.65)}
      .npc-forge-class-option-group.is-complete{border-left-color:rgba(88,214,199,.65)}
      .npc-forge-class-option-group>header{display:flex;justify-content:space-between;gap:10px;align-items:start}
      .npc-forge-class-option-group>header>span{display:grid;gap:1px}
      .npc-forge-class-option-group>header strong{color:#f7f0ff;font-size:.64rem}
      .npc-forge-class-option-group>header small{color:rgba(255,255,255,.44);font-size:.46rem}
      .npc-forge-class-option-group>header em{padding:2px 6px;border-radius:999px;color:#d8c2fb;background:rgba(126,72,199,.09);font-size:.44rem;font-style:normal}
      .npc-forge-class-option-field{display:grid;gap:5px}
      .npc-forge-class-option-field__head{display:grid;grid-template-columns:minmax(0,1fr) minmax(120px,42%);gap:7px;align-items:center}
      .npc-forge-class-option-field__head>span{display:flex;align-items:baseline;gap:7px}
      .npc-forge-class-option-field__head strong{color:#c9fff7;font-size:.55rem}
      .npc-forge-class-option-field__head small{color:rgba(255,255,255,.42);font-size:.44rem}
      .npc-forge-class-option-field__head input{min-width:0;width:100%;padding:5px 7px;border:1px solid rgba(168,108,255,.22);border-radius:6px;color:#fff;background:#080b12;font-size:.5rem}
      .npc-forge-class-option-list{display:grid;gap:3px;max-height:330px;overflow:auto;padding-right:2px;scrollbar-width:thin;scrollbar-color:rgba(168,108,255,.32) rgba(255,255,255,.025)}
      .npc-forge-class-option-list>button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 7px;border:1px solid rgba(255,255,255,.08);border-radius:6px;color:#fff;background:rgba(4,7,13,.38);text-align:left}
      .npc-forge-class-option-list>button:hover,.npc-forge-class-option-list>button:focus-visible{border-color:rgba(168,108,255,.48);background:rgba(126,72,199,.075);outline:none}
      .npc-forge-class-option-list>button.is-selected{border-color:rgba(88,214,199,.5);background:linear-gradient(90deg,rgba(88,214,199,.09),rgba(126,72,199,.035))}
      .npc-forge-class-option-list>button>span{display:grid;gap:1px;min-width:0}
      .npc-forge-class-option-list>button strong{overflow:hidden;color:#fff;font-size:.58rem;white-space:nowrap;text-overflow:ellipsis}
      .npc-forge-class-option-list>button small{overflow:hidden;color:rgba(255,255,255,.43);font-size:.43rem;white-space:nowrap;text-overflow:ellipsis}
      .npc-forge-class-option-list>button em{color:rgba(255,255,255,.46);font-size:.44rem;font-style:normal}
      .npc-forge-class-option-list>button.is-selected em{color:#9cece2}
      .npc-forge-class-option-list__empty{padding:8px;color:rgba(255,255,255,.48);font-size:.5rem;text-align:center}
      @media(max-width:900px){.npc-forge-class-option-browser>header{align-items:start;flex-direction:column}.npc-forge-class-option-field__head{grid-template-columns:1fr}}
    `}</style>
  </section>;
}

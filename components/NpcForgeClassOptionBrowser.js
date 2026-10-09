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

  if (!visibleGroups.length) return null;

  return <section className="npc-forge-class-option-browser" aria-label="Source-backed class choices">
    <header>
      <div><span>Class choice catalogue</span><strong>Open a choice slot, then inspect an option</strong></div>
      <p>Descriptions and selection stay in Current Selection on the right.</p>
    </header>

    <div className="npc-forge-class-option-browser__groups">
      {visibleGroups.map((group) => {
        const activeFields = (group.fields || []).filter((field) => sourceChoiceFieldIsActive(field, selections));
        const requiredFields = activeFields.filter((field) => field.required !== false);
        const groupTarget = requiredFields.reduce((sum, field) => sum + Math.max(1, Number(field.count || 1)), 0);
        const groupDone = requiredFields.reduce((sum, field) => sum + Math.min(Math.max(1, Number(field.count || 1)), selectedKeys(selections, group.id, field.id).length), 0);
        const selectedLabels = activeFields.flatMap((field) => {
          const selected = new Set(selectedKeys(selections, group.id, field.id));
          return (field.options || []).filter((option) => selected.has(option.key)).map((option) => option.label);
        });

        return <details key={group.id} className={`npc-forge-class-option-group ${groupDone >= groupTarget ? "is-complete" : "is-required"}`}>
          <summary>
            <span className="npc-forge-class-option-group__chevron" aria-hidden="true">›</span>
            <span className="npc-forge-class-option-group__title">
              <strong>{group.label}</strong>
              <small>{selectedLabels.length ? selectedLabels.join(" • ") : `${group.source || "Campaign"}${group.level ? ` • gained at level ${group.level}` : ""}`}</small>
            </span>
            <em>{groupTarget ? `${groupDone}/${groupTarget}` : "Ready"}</em>
          </summary>

          <div className="npc-forge-class-option-group__body">
            {activeFields.map((field) => {
              const selected = selectedKeys(selections, group.id, field.id);
              const queryKey = `${group.id}:${field.id}`;
              const query = queries[queryKey] || "";
              const options = field.options || [];
              const filtered = options.filter((option) => !query || [option.label, option.source, optionMeta(option, field, group)].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase()));

              return <section key={field.id} className="npc-forge-class-option-field">
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
                      <span><strong>{option.label}</strong><small>{optionMeta(option, field, group) || String(field.kind || "Class option").replace(/-/g, " ")}</small></span>
                      <em>{isSelected ? "Selected" : "View"}</em>
                    </button>;
                  })}
                  {!filtered.length ? <div className="npc-forge-class-option-list__empty">No options match this search.</div> : null}
                </div>
              </section>;
            })}
          </div>
        </details>;
      })}
    </div>

    <style jsx global>{`
      .npc-forge-class-option-browser{display:grid;gap:6px;margin:0;padding:6px 0 2px;border-top:1px solid rgba(255,255,255,.06)}
      .npc-forge-class-option-browser>header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 1px}
      .npc-forge-class-option-browser>header>div{display:grid;gap:2px}
      .npc-forge-class-option-browser>header span{color:#9cece2;font-size:.52rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
      .npc-forge-class-option-browser>header strong{color:#fff;font-size:.64rem}
      .npc-forge-class-option-browser>header p{max-width:250px;margin:0;color:rgba(255,255,255,.48);font-size:.45rem;line-height:1.3}
      
      .npc-forge-class-option-browser__groups{display:grid;gap:6px}
      .npc-forge-class-option-group{border:1px solid rgba(168,108,255,.24);border-left:3px solid rgba(168,108,255,.42);border-radius:9px;background:linear-gradient(120deg,rgba(126,72,199,.075),rgba(4,7,13,.45));overflow:hidden}
      .npc-forge-class-option-group.is-required{border-left-color:rgba(243,191,99,.78)}
      .npc-forge-class-option-group.is-complete{border-left-color:rgba(88,214,199,.72)}
      .npc-forge-class-option-group>summary{display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:46px;padding:8px 10px;list-style:none;cursor:pointer}
      .npc-forge-class-option-group>summary::-webkit-details-marker{display:none}
      .npc-forge-class-option-group>summary:hover{background:rgba(126,72,199,.06)}
      .npc-forge-class-option-group__chevron{color:#c8a9ff;font-size:1rem;line-height:1;transition:transform .16s ease}
      .npc-forge-class-option-group[open] .npc-forge-class-option-group__chevron{transform:rotate(90deg)}
      .npc-forge-class-option-group__title{display:grid;gap:2px;min-width:0}
      .npc-forge-class-option-group__title strong{color:#f7f0ff;font-size:.68rem}
      .npc-forge-class-option-group__title small{overflow:hidden;color:rgba(255,255,255,.45);font-size:.46rem;white-space:nowrap;text-overflow:ellipsis}
      .npc-forge-class-option-group>summary>em{padding:3px 7px;border-radius:999px;color:#d8c2fb;background:rgba(126,72,199,.09);font-size:.45rem;font-style:normal}
      .npc-forge-class-option-group.is-complete>summary>em{color:#a7f5ea;background:rgba(88,214,199,.09)}
      .npc-forge-class-option-group__body{display:grid;gap:8px;margin:0 8px 8px 22px;padding:8px 0 0 10px;border-top:1px solid rgba(255,255,255,.055);border-left:1px solid rgba(168,108,255,.18)}
      .npc-forge-class-option-field{display:grid;gap:5px;padding-right:8px}
      .npc-forge-class-option-field+.npc-forge-class-option-field{padding-top:7px;border-top:1px solid rgba(255,255,255,.045)}
      .npc-forge-class-option-field__head{display:grid;grid-template-columns:minmax(0,1fr) minmax(110px,40%);gap:7px;align-items:center}
      .npc-forge-class-option-field__head>span{display:flex;align-items:baseline;gap:7px}
      .npc-forge-class-option-field__head strong{color:#c9fff7;font-size:.53rem}
      .npc-forge-class-option-field__head small{color:rgba(255,255,255,.4);font-size:.42rem}
      .npc-forge-class-option-field__head input{min-width:0;width:100%;padding:5px 7px;border:1px solid rgba(168,108,255,.22);border-radius:6px;color:#fff;background:#080b12;font-size:.49rem}
      .npc-forge-class-option-list{display:grid;gap:3px;max-height:300px;overflow:auto;padding-right:2px;scrollbar-width:thin;scrollbar-color:rgba(168,108,255,.32) rgba(255,255,255,.025)}
      .npc-forge-class-option-list>button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;min-height:31px;padding:5px 7px;border:1px solid rgba(255,255,255,.075);border-radius:6px;color:#fff;background:rgba(4,7,13,.34);text-align:left}
      .npc-forge-class-option-list>button:hover,.npc-forge-class-option-list>button:focus-visible{border-color:rgba(168,108,255,.48);background:rgba(126,72,199,.075);outline:none}
      .npc-forge-class-option-list>button.is-selected{border-color:rgba(88,214,199,.5);background:linear-gradient(90deg,rgba(88,214,199,.08),rgba(126,72,199,.03))}
      .npc-forge-class-option-list>button>span{display:grid;gap:1px;min-width:0}
      .npc-forge-class-option-list>button strong{overflow:hidden;color:#fff;font-size:.55rem;white-space:nowrap;text-overflow:ellipsis}
      .npc-forge-class-option-list>button small{overflow:hidden;color:rgba(255,255,255,.41);font-size:.41rem;white-space:nowrap;text-overflow:ellipsis}
      .npc-forge-class-option-list>button em{color:rgba(255,255,255,.43);font-size:.42rem;font-style:normal}
      .npc-forge-class-option-list>button.is-selected em{color:#9cece2}
      .npc-forge-class-option-list__empty{padding:8px;color:rgba(255,255,255,.48);font-size:.49rem;text-align:center}
      @media(max-width:900px){.npc-forge-class-option-browser>header{align-items:start;flex-direction:column}.npc-forge-class-option-field__head{grid-template-columns:1fr}.npc-forge-class-option-group__body{margin-left:12px}}
    `}</style>
  </section>;
}

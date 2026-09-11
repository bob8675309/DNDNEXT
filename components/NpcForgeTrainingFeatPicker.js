import { useEffect, useMemo, useState } from "react";
import { formatPrerequisiteText } from "../utils/formatPrerequisiteText";

const text = (value) => String(value ?? "").trim();
const normalized = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const unique = (values = []) => [...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))];

export default function NpcForgeTrainingFeatPicker({
  options = [],
  selectedId = "",
  onSelect = null,
  onDetail = null,
  label = "Bonus Feat",
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(() => ["All", ...unique(options.map((option) => option.category)).sort()], [options]);
  const filtered = useMemo(() => {
    const q = normalized(query);
    return options.filter((option) => {
      if (category !== "All" && text(option.category) !== category) return false;
      if (!q) return true;
      return normalized([
        option.name,
        option.source,
        option.category,
        option.description,
        formatPrerequisiteText(option.prerequisite_text || option.prerequisiteText || ""),
      ].filter(Boolean).join(" ")).includes(q);
    }).sort((a, b) => text(a.name).localeCompare(text(b.name)));
  }, [category, options, query]);

  const selected = useMemo(() => options.find((option) => String(option.id) === String(selectedId)) || null, [options, selectedId]);

  useEffect(() => {
    if (category !== "All" && !categories.includes(category)) setCategory("All");
  }, [categories, category]);

  function publish(option) {
    if (!option) return;
    onDetail?.({ type: "feat", option });
  }

  return <section className="npc-forge-training-feat-picker" aria-label={`${label} catalogue`}>
    <header>
      <div><span>{label}</span><strong>{selected?.name || "Choose a feat"}</strong></div>
      <em>{filtered.length}/{options.length}</em>
    </header>
    <div className="npc-forge-training-feat-toolbar">
      <label><span>Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, prerequisite, description…" /></label>
      <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
    </div>
    <div className="npc-forge-training-feat-list" role="listbox" aria-label={label}>
      {filtered.map((feat) => {
        const isSelected = String(feat.id) === String(selectedId);
        const prerequisite = formatPrerequisiteText(feat.prerequisite_text || feat.prerequisiteText || "");
        return <button
          key={feat.id}
          type="button"
          role="option"
          aria-selected={isSelected}
          className={isSelected ? "is-selected" : ""}
          onMouseEnter={() => publish(feat)}
          onFocus={() => publish(feat)}
          onClick={() => { onSelect?.(feat.id); publish(feat); }}
        >
          <span><strong>{feat.name}</strong><small>{[feat.category, feat.source].filter(Boolean).join(" • ") || "Feat"}</small>{prerequisite ? <i>Prerequisite: {prerequisite}</i> : null}</span>
          <em>{isSelected ? "✓" : "○"}</em>
        </button>;
      })}
      {!filtered.length ? <p>No feats match these filters.</p> : null}
    </div>
    <small className="npc-forge-training-feat-help">Inspect a feat in Current Selection on the right. Selecting it here resolves this feat grant; any feat-owned follow-up choices remain directly below.</small>
    <style jsx global>{`
      .npc-forge-training-feat-picker{display:grid;gap:8px;padding:9px;border:1px solid rgba(243,191,99,.24);border-radius:8px;background:linear-gradient(135deg,rgba(243,191,99,.045),rgba(126,72,199,.035))}.npc-forge-training-feat-picker>header{display:flex;align-items:center;justify-content:space-between;gap:10px}.npc-forge-training-feat-picker>header>div{display:grid;gap:2px}.npc-forge-training-feat-picker>header span,.npc-forge-training-feat-toolbar label>span{color:rgba(255,255,255,.46);font-size:.48rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.npc-forge-training-feat-picker>header strong{color:#fff;font-size:.68rem}.npc-forge-training-feat-picker>header>em{padding:2px 6px;border-radius:999px;color:#ffe5ae;background:rgba(243,191,99,.1);font-size:.48rem;font-style:normal}.npc-forge-training-feat-toolbar{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(120px,.8fr);gap:6px}.npc-forge-training-feat-toolbar label{display:grid;gap:3px}.npc-forge-training-feat-toolbar input,.npc-forge-training-feat-toolbar select{width:100%;min-width:0;padding:6px 7px;border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#fff;background:#090b12;font-size:.57rem}.npc-forge-training-feat-list{display:grid;gap:3px;max-height:228px;padding-right:3px;overflow:auto}.npc-forge-training-feat-list>button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 8px;border:1px solid rgba(255,255,255,.085);border-radius:6px;color:rgba(255,255,255,.78);background:rgba(3,5,10,.34);text-align:left}.npc-forge-training-feat-list>button>span{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;min-width:0}.npc-forge-training-feat-list strong{overflow:hidden;color:#fff;font-size:.61rem;white-space:nowrap;text-overflow:ellipsis}.npc-forge-training-feat-list small{color:rgba(255,255,255,.43);font-size:.47rem;white-space:nowrap}.npc-forge-training-feat-list i{grid-column:1/-1;overflow:hidden;color:rgba(255,230,174,.62);font-size:.45rem;font-style:normal;white-space:nowrap;text-overflow:ellipsis}.npc-forge-training-feat-list>button>em{display:grid;place-items:center;width:17px;height:17px;border:1px solid rgba(255,255,255,.18);border-radius:50%;color:rgba(255,255,255,.4);font-size:.5rem;font-style:normal}.npc-forge-training-feat-list>button:hover,.npc-forge-training-feat-list>button:focus-visible{border-color:rgba(168,108,255,.4);background:rgba(126,72,199,.08)}.npc-forge-training-feat-list>button.is-selected{border-color:rgba(88,214,199,.58);background:linear-gradient(90deg,rgba(88,214,199,.1),rgba(126,72,199,.04))}.npc-forge-training-feat-list>button.is-selected>em{border-color:#58d6c7;color:#07110f;background:#58d6c7}.npc-forge-training-feat-list>p{margin:4px 0;color:rgba(255,255,255,.5);font-size:.56rem}.npc-forge-training-feat-help{color:rgba(255,255,255,.48);font-size:.49rem;line-height:1.45}@media(max-width:720px){.npc-forge-training-feat-toolbar{grid-template-columns:1fr}}
    `}</style>
  </section>;
}

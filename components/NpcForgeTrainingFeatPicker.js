import { useEffect, useMemo, useState } from "react";
import { formatPlayerFacingPrerequisiteText } from "../utils/formatPrerequisiteText";

const text = (value) => String(value ?? "").trim();
const normalized = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const unique = (values = []) => [...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))];
const FEAT_CATEGORY_LABELS = Object.freeze({
  O: "Origin",
  G: "General",
  FS: "Fighting Style",
  "FS:P": "Paladin Fighting Style",
  "FS:R": "Ranger Fighting Style",
  D: "Dragonmark",
  DG: "Dark Gift",
});
const categoryKey = (option = {}) => text(option.category) || "__other__";
const categoryLabel = (value) => value === "__other__" ? "Other" : FEAT_CATEGORY_LABELS[value] || value;
const prerequisiteText = (option = {}) => formatPlayerFacingPrerequisiteText(option.prerequisite_text || option.prerequisiteText || "");
function prerequisiteLevel(option = {}) {
  const match = prerequisiteText(option).match(/\blevel\s+(\d+)\b/i);
  return match ? Number(match[1]) : 0;
}

export default function NpcForgeTrainingFeatPicker({
  options = [],
  selectedId = "",
  onDetail = null,
  label = "Bonus Feat",
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [prerequisiteFilter, setPrerequisiteFilter] = useState("all");
  const [sortMode, setSortMode] = useState("name");

  const categories = useMemo(() => ["All", ...unique(options.map(categoryKey)).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)))], [options]);
  const filtered = useMemo(() => {
    const q = normalized(query);
    const rows = options.filter((option) => {
      const prerequisite = prerequisiteText(option);
      if (category !== "All" && categoryKey(option) !== category) return false;
      if (prerequisiteFilter === "none" && prerequisite) return false;
      if (prerequisiteFilter === "required" && !prerequisite) return false;
      if (!q) return true;
      return normalized([
        option.name,
        option.source,
        categoryLabel(categoryKey(option)),
        option.description,
        prerequisite,
      ].filter(Boolean).join(" ")).includes(q);
    });
    return rows.sort((a, b) => {
      if (sortMode === "category") {
        return categoryLabel(categoryKey(a)).localeCompare(categoryLabel(categoryKey(b))) || text(a.name).localeCompare(text(b.name));
      }
      if (sortMode === "level") {
        return prerequisiteLevel(a) - prerequisiteLevel(b) || text(a.name).localeCompare(text(b.name));
      }
      if (sortMode === "source") {
        return text(a.source).localeCompare(text(b.source)) || text(a.name).localeCompare(text(b.name));
      }
      return text(a.name).localeCompare(text(b.name));
    });
  }, [category, options, prerequisiteFilter, query, sortMode]);

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
      <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value} value={value}>{value === "All" ? "All categories" : categoryLabel(value)}</option>)}</select></label>
      <label><span>Prerequisite</span><select value={prerequisiteFilter} onChange={(event) => setPrerequisiteFilter(event.target.value)}><option value="all">Any</option><option value="none">None</option><option value="required">Has prerequisite</option></select></label>
      <label><span>Sort</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value)}><option value="name">Name A–Z</option><option value="category">Category</option><option value="level">Required level</option><option value="source">Source</option></select></label>
    </div>
    <div className="npc-forge-training-feat-list" role="listbox" aria-label={label}>
      {filtered.map((feat) => {
        const isSelected = String(feat.id) === String(selectedId);
        const prerequisite = prerequisiteText(feat);
        return <button
          key={feat.id}
          type="button"
          role="option"
          aria-selected={isSelected}
          className={isSelected ? "is-selected" : ""}
          onClick={() => publish(feat)}
        >
          <span><strong>{feat.name}</strong><small className="npc-forge-training-feat-meta"><b>{categoryLabel(categoryKey(feat))}</b>{feat.source ? <span>{feat.source}</span> : null}</small>{prerequisite ? <i><b>Prerequisite:</b> {prerequisite}</i> : <i className="has-none">No prerequisite</i>}</span>
          <em>{isSelected ? "Selected" : "View"}</em>
        </button>;
      })}
      {!filtered.length ? <p>No feats match these filters.</p> : null}
    </div>
    <small className="npc-forge-training-feat-help">Click a feat to inspect it on the right, then use the Select Feat button in Current Selection to confirm it. Any feat-owned follow-up choices remain directly below.</small>
    <style jsx global>{`
      .npc-forge-training-feat-picker{display:grid;gap:8px;padding:9px;border:1px solid rgba(243,191,99,.24);border-radius:8px;background:linear-gradient(135deg,rgba(243,191,99,.045),rgba(126,72,199,.035))}.npc-forge-training-feat-picker>header{display:flex;align-items:center;justify-content:space-between;gap:10px}.npc-forge-training-feat-picker>header>div{display:grid;gap:2px}.npc-forge-training-feat-picker>header span,.npc-forge-training-feat-toolbar label>span{color:rgba(255,255,255,.46);font-size:.48rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.npc-forge-training-feat-picker>header strong{color:#fff;font-size:.68rem}.npc-forge-training-feat-picker>header>em{padding:2px 6px;border-radius:999px;color:#ffe5ae;background:rgba(243,191,99,.1);font-size:.48rem;font-style:normal}.npc-forge-training-feat-toolbar{display:grid;grid-template-columns:minmax(0,1.75fr) repeat(3,minmax(105px,.72fr));gap:6px}.npc-forge-training-feat-toolbar label{display:grid;gap:3px}.npc-forge-training-feat-toolbar input,.npc-forge-training-feat-toolbar select{width:100%;min-width:0;padding:6px 7px;border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#fff;background:#090b12;font-size:.57rem}.npc-forge-training-feat-list{display:grid;gap:3px;max-height:228px;padding-right:3px;overflow:auto}.npc-forge-training-feat-list>button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 8px;border:1px solid rgba(255,255,255,.085);border-radius:6px;color:rgba(255,255,255,.78);background:rgba(3,5,10,.34);text-align:left}.npc-forge-training-feat-list>button>span{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 8px;min-width:0}.npc-forge-training-feat-list strong{overflow:hidden;color:#fff;font-size:.61rem;white-space:nowrap;text-overflow:ellipsis}.npc-forge-training-feat-list small{color:rgba(255,255,255,.43);font-size:.47rem;white-space:nowrap}.npc-forge-training-feat-meta{display:flex;align-items:center;justify-content:flex-end;gap:5px}.npc-forge-training-feat-meta>b{padding:2px 5px;border:1px solid rgba(168,108,255,.22);border-radius:999px;color:#dbc5ff;background:rgba(126,72,199,.08);font-size:.45rem;font-weight:700}.npc-forge-training-feat-meta>span{color:rgba(255,255,255,.38)}.npc-forge-training-feat-list i{grid-column:1/-1;overflow:visible;color:rgba(255,230,174,.68);font-size:.46rem;font-style:normal;line-height:1.35;white-space:normal}.npc-forge-training-feat-list i>b{color:inherit;font-weight:900}.npc-forge-training-feat-list i.has-none{color:rgba(255,255,255,.35)}.npc-forge-training-feat-list>button>em{color:rgba(255,255,255,.4);font-size:.47rem;font-style:normal;white-space:nowrap}.npc-forge-training-feat-list>button:hover,.npc-forge-training-feat-list>button:focus-visible{border-color:rgba(168,108,255,.4);background:rgba(126,72,199,.08)}.npc-forge-training-feat-list>button.is-selected{border-color:rgba(88,214,199,.58);background:linear-gradient(90deg,rgba(88,214,199,.1),rgba(126,72,199,.04))}.npc-forge-training-feat-list>button.is-selected>em{color:#9cece2;font-weight:700}.npc-forge-training-feat-list>p{margin:4px 0;color:rgba(255,255,255,.5);font-size:.56rem}.npc-forge-training-feat-help{color:rgba(255,255,255,.48);font-size:.49rem;line-height:1.45}@media(max-width:1180px){.npc-forge-training-feat-toolbar{grid-template-columns:minmax(0,1fr) minmax(120px,.72fr)}}@media(max-width:720px){.npc-forge-training-feat-toolbar{grid-template-columns:1fr}}
    `}</style>
  </section>;
}

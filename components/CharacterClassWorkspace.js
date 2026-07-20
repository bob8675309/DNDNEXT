import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CharacterClassPanel from "./CharacterClassPanel";
import { supabase } from "../utils/supabaseClient";

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeName(value) {
  return safeText(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function featureName(feature) {
  if (typeof feature === "string") return safeText(feature.split("|")[0]);
  return safeText(feature?.name || feature?.label || feature?.title || "Class feature");
}

function sourceLabel(source) {
  if (source === "XPHB") return "2024 Player's Handbook";
  if (source === "PHB") return "2014 Player's Handbook";
  return source || "Campaign";
}

function slotSummary(slots) {
  if (!slots) return "—";
  if (Array.isArray(slots)) {
    const populated = slots.map((count, index) => Number(count || 0) > 0 ? `${index + 1}:${Number(count)}` : "").filter(Boolean);
    return populated.length ? populated.join("  ") : "—";
  }
  const pactSlots = Number(slots.pactSlots || 0);
  const pactLevel = Number(slots.pactSlotLevel || 0);
  return pactSlots ? `${pactSlots} pact slot${pactSlots === 1 ? "" : "s"} at level ${pactLevel}` : "—";
}

function subclassMatches(row, selectedSubclass) {
  const target = normalizeName(selectedSubclass);
  if (!target) return false;
  return [row.subclass_name, row.subclass_short_name]
    .map(normalizeName)
    .filter(Boolean)
    .some((name) => name === target || name.includes(target) || target.includes(name));
}

function featureLookup(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = normalizeName(row.name);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function descriptionFor(name, level, lookup) {
  const rows = lookup.get(normalizeName(name)) || [];
  const exact = rows.find((row) => Number(row.level) === Number(level));
  return safeText(exact?.description || rows[0]?.description) || "No imported description is available for this feature yet.";
}

function FeatureDescription({ feature, onClear = null, heading = "Feature Description" }) {
  return (
    <section className="npc-card class-feature-pinned-detail">
      <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
        <div>
          <div className="spell-admin-kicker">{heading}</div>
          {feature ? <h3 className="h5 mb-1">{feature.subclassName ? `${feature.subclassName}: ${feature.name}` : feature.name}</h3> : null}
        </div>
        <div className="d-flex gap-2 align-items-center">
          {feature?.level ? <span className={`badge ${feature.type === "subclass" ? "text-bg-info" : "text-bg-secondary"}`}>Level {feature.level}{feature.type === "subclass" ? " subclass" : ""}</span> : null}
          {feature && onClear ? <button type="button" className="btn btn-sm btn-outline-light" onClick={onClear}>Clear</button> : null}
        </div>
      </div>
      {feature ? <p className="small mt-2 mb-0 class-level-guide__description">{feature.description}</p> : <div className="text-muted">Hover over a class feature for a quick description, or click it to keep the description here.</div>}
    </section>
  );
}

function OverviewFeatureHover({ rootRef, featureRows, onSelect }) {
  const lookup = useMemo(() => featureLookup(featureRows), [featureRows]);
  const apply = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll(".class-feature-list > div").forEach((node) => {
      const name = safeText(node.textContent);
      if (!name) return;
      const rows = lookup.get(normalizeName(name)) || [];
      const row = rows[0] || null;
      const description = safeText(row?.description) || "No imported description is available for this class feature yet.";
      node.title = description;
      node.classList.add("class-feature-hover-row");
      node.setAttribute("role", "button");
      node.setAttribute("tabindex", "0");
      node.onclick = () => onSelect?.({ name, description, level: row?.level || null, type: row?.feature_type || "class" });
      node.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.({ name, description, level: row?.level || null, type: row?.feature_type || "class" });
        }
      };
    });
  }, [lookup, onSelect, rootRef]);

  useEffect(() => {
    apply();
    const root = rootRef.current;
    if (!root) return undefined;
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [apply, rootRef]);
  return null;
}

function LevelGuide({ payload, levels, featureRows }) {
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [pinnedFeature, setPinnedFeature] = useState(null);
  const [includeSubclassFeatures, setIncludeSubclassFeatures] = useState(true);
  const [subclassFilter, setSubclassFilter] = useState("All");
  const progression = payload?.progression || null;
  const classRow = payload?.class || null;
  const currentLevel = Number(progression?.class_level || 1);
  const selectedSubclass = safeText(progression?.subclass_name);
  const lookup = useMemo(() => featureLookup(featureRows), [featureRows]);
  const subclassOptions = useMemo(() => [...new Set(featureRows
    .filter((row) => row.feature_type === "subclass")
    .map((row) => safeText(row.subclass_name || row.subclass_short_name))
    .filter(Boolean))].sort((a, b) => a.localeCompare(b)), [featureRows]);
  const subclassRows = useMemo(() => {
    if (!includeSubclassFeatures) return [];
    return featureRows.filter((row) => row.feature_type === "subclass" && (subclassFilter === "All" || subclassMatches(row, subclassFilter)));
  }, [featureRows, includeSubclassFeatures, subclassFilter]);
  const visibleFeature = pinnedFeature || hoveredFeature;

  useEffect(() => {
    if (subclassFilter !== "All" && !subclassOptions.includes(subclassFilter)) setSubclassFilter("All");
  }, [subclassFilter, subclassOptions]);

  useEffect(() => {
    setHoveredFeature(null);
    setPinnedFeature(null);
  }, [includeSubclassFeatures, subclassFilter]);

  const rows = useMemo(() => levels.map((levelRow) => {
    const baseNames = (Array.isArray(levelRow.features) ? levelRow.features : []).map(featureName).filter(Boolean);
    const subclassAtLevel = subclassRows.filter((row) => Number(row.level) === Number(levelRow.class_level));
    const combined = [
      ...baseNames.map((name) => ({ name, level: levelRow.class_level, type: "class", description: descriptionFor(name, levelRow.class_level, lookup) })),
      ...subclassAtLevel.map((row) => ({
        name: row.name,
        subclassName: safeText(row.subclass_name || row.subclass_short_name) || "Subclass",
        level: row.level,
        type: "subclass",
        description: safeText(row.description) || "No imported description is available for this subclass feature yet.",
      })),
    ];
    return { ...levelRow, guideFeatures: combined };
  }), [levels, lookup, subclassRows]);

  return (
    <div className="class-level-guide">
      <section className="npc-card mb-3 class-level-guide__intro">
        <div>
          <div className="spell-admin-kicker">Level 1–20 Guide</div>
          <h2 className="h5 mb-1">{classRow?.class_name || "Class"} Progression</h2>
          <div className="small text-muted">{sourceLabel(classRow?.source)} • {includeSubclassFeatures ? subclassFilter === "All" ? `Comparing ${subclassOptions.length} subclass options` : `Showing ${subclassFilter}` : "Base class features only"}</div>
        </div>
        <div className="class-level-guide__controls">
          <label className="form-check form-switch mb-0">
            <input className="form-check-input" type="checkbox" checked={includeSubclassFeatures} onChange={(event) => setIncludeSubclassFeatures(event.target.checked)} />
            <span className="form-check-label">Show subclass features</span>
          </label>
          <select className="form-select form-select-sm" aria-label="Subclass features to include" value={subclassFilter} disabled={!includeSubclassFeatures || !subclassOptions.length} onChange={(event) => setSubclassFilter(event.target.value)}>
            <option value="All">All subclasses</option>
            {subclassOptions.map((name) => <option key={name} value={name}>{name}{selectedSubclass && subclassMatches({ subclass_name: name }, selectedSubclass) ? " • current" : ""}</option>)}
          </select>
          <span className="badge text-bg-success">Current level {currentLevel}</span>
        </div>
      </section>

      <section className="npc-card class-level-guide__table-card">
        <div className="class-level-guide__table" role="table" aria-label={`${classRow?.class_name || "Class"} level progression`}>
          <div className="class-level-guide__row is-head" role="row">
            <div>Level</div><div>PB</div><div>Features</div><div>Cantrips</div><div>Known / Prepared</div><div>Spell Slots</div>
          </div>
          {rows.map((row) => (
            <div key={row.class_level} className={`class-level-guide__row ${Number(row.class_level) === currentLevel ? "is-current" : ""}`} role="row">
              <div><strong>{row.class_level}</strong>{Number(row.class_level) === currentLevel ? <span>Current</span> : null}</div>
              <div>+{Number(row.proficiency_bonus || 2)}</div>
              <div className="class-level-guide__features">
                {row.guideFeatures.length ? row.guideFeatures.map((feature, index) => (
                  <button
                    key={`${feature.type}-${feature.subclassName || "base"}-${feature.name}-${index}`}
                    type="button"
                    className={`${feature.type === "subclass" ? "is-subclass" : ""} ${pinnedFeature?.name === feature.name && pinnedFeature?.subclassName === feature.subclassName && Number(pinnedFeature?.level) === Number(feature.level) ? "is-pinned" : ""}`}
                    title={feature.description}
                    onMouseEnter={() => setHoveredFeature(feature)}
                    onMouseLeave={() => setHoveredFeature(null)}
                    onFocus={() => setHoveredFeature(feature)}
                    onBlur={() => setHoveredFeature(null)}
                    onClick={() => setPinnedFeature((current) => current?.name === feature.name && current?.subclassName === feature.subclassName && Number(current?.level) === Number(feature.level) ? null : feature)}
                  >
                    {feature.subclassName ? `${feature.subclassName}: ${feature.name}` : feature.name}
                  </button>
                )) : <span className="text-muted">—</span>}
              </div>
              <div>{row.cantrips_known ?? "—"}</div>
              <div>{row.spells_known ?? "—"}</div>
              <div className="class-level-guide__slots">{slotSummary(row.spell_slots)}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-3">
        <FeatureDescription feature={visibleFeature} onClear={pinnedFeature ? () => setPinnedFeature(null) : null} />
      </div>
    </div>
  );
}

export default function CharacterClassWorkspace({ character = null, isAdmin = false }) {
  const [view, setView] = useState("overview");
  const [payload, setPayload] = useState(null);
  const [levels, setLevels] = useState([]);
  const [featureRows, setFeatureRows] = useState([]);
  const [overviewFeature, setOverviewFeature] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const overviewRef = useRef(null);
  const characterId = character?.id || null;

  const loadGuide = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    setError("");
    const progressionResult = await supabase.rpc("get_character_progression_v1", { p_character_id: characterId });
    if (progressionResult.error) {
      setError(progressionResult.error.message || "Could not load class progression.");
      setLoading(false);
      return;
    }
    const nextPayload = progressionResult.data || null;
    const classRow = nextPayload?.class || null;
    setPayload(nextPayload);
    if (!classRow?.id) {
      setLevels([]);
      setFeatureRows([]);
      setLoading(false);
      return;
    }
    const [levelResult, featureResult] = await Promise.all([
      supabase
        .from("class_level_progression")
        .select("class_level,proficiency_bonus,xp_threshold,cantrips_known,spells_known,spell_slots,features")
        .eq("class_id", classRow.id)
        .order("class_level", { ascending: true }),
      supabase
        .from("class_feature_catalog")
        .select("id,feature_key,feature_type,name,source,class_key,class_name,class_source,subclass_name,subclass_short_name,level,description")
        .eq("class_key", classRow.class_key)
        .eq("class_source", classRow.source)
        .order("level", { ascending: true })
        .order("name", { ascending: true })
        .limit(3000),
    ]);
    if (levelResult.error || featureResult.error) setError(levelResult.error?.message || featureResult.error?.message || "Could not load the full class guide.");
    setLevels(levelResult.data || []);
    setFeatureRows(featureResult.data || []);
    setLoading(false);
  }, [characterId]);

  useEffect(() => {
    loadGuide();
  }, [loadGuide]);

  return (
    <div className="character-class-workspace">
      <div className="npc-card mb-3 character-class-workspace__switcher">
        <div>
          <div className="npc-card-title mb-0">Class View</div>
          <div className="small text-muted">Use the overview during play or inspect the complete level progression.</div>
        </div>
        <div className="btn-group btn-group-sm" role="tablist" aria-label="Class information views">
          <button type="button" className={`btn ${view === "overview" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setView("overview")}>Class Overview</button>
          <button type="button" className={`btn ${view === "guide" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setView("guide")}>Level 1–20 Guide</button>
        </div>
      </div>

      {error ? <div className="alert alert-warning py-2">{error}</div> : null}
      {view === "overview" ? (
        <div ref={overviewRef}>
          <CharacterClassPanel character={character} isAdmin={isAdmin} />
          <OverviewFeatureHover rootRef={overviewRef} featureRows={featureRows} onSelect={setOverviewFeature} />
          <div className="mt-3"><FeatureDescription feature={overviewFeature} onClear={overviewFeature ? () => setOverviewFeature(null) : null} heading="Pinned Class Feature" /></div>
        </div>
      ) : loading ? <div className="npc-card"><div className="text-muted">Loading level 1–20 progression…</div></div> : payload?.class ? (
        <LevelGuide payload={payload} levels={levels} featureRows={featureRows} />
      ) : <div className="npc-card"><div className="text-muted">Class progression has not been initialized for this character.</div></div>}
    </div>
  );
}

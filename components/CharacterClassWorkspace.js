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

function OverviewFeatureHover({ rootRef, featureRows }) {
  const lookup = useMemo(() => featureLookup(featureRows), [featureRows]);
  const apply = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll(".class-feature-list > div").forEach((node) => {
      const name = safeText(node.textContent);
      if (!name) return;
      const rows = lookup.get(normalizeName(name)) || [];
      const description = safeText(rows[0]?.description);
      node.title = description || "No imported description is available for this class feature yet.";
      node.classList.add("class-feature-hover-row");
    });
  }, [lookup, rootRef]);

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
  const [selectedFeature, setSelectedFeature] = useState(null);
  const progression = payload?.progression || null;
  const classRow = payload?.class || null;
  const currentLevel = Number(progression?.class_level || 1);
  const selectedSubclass = safeText(progression?.subclass_name);
  const lookup = useMemo(() => featureLookup(featureRows), [featureRows]);
  const subclassRows = useMemo(() => featureRows.filter((row) => row.feature_type === "subclass" && subclassMatches(row, selectedSubclass)), [featureRows, selectedSubclass]);

  const rows = useMemo(() => levels.map((levelRow) => {
    const baseNames = (Array.isArray(levelRow.features) ? levelRow.features : []).map(featureName).filter(Boolean);
    const subclassAtLevel = subclassRows.filter((row) => Number(row.level) === Number(levelRow.class_level));
    const combined = [
      ...baseNames.map((name) => ({ name, level: levelRow.class_level, type: "class", description: descriptionFor(name, levelRow.class_level, lookup) })),
      ...subclassAtLevel.map((row) => ({ name: row.name, level: row.level, type: "subclass", description: safeText(row.description) || "No imported description is available for this subclass feature yet." })),
    ];
    return { ...levelRow, guideFeatures: combined };
  }), [levels, lookup, subclassRows]);

  return (
    <div className="class-level-guide">
      <section className="npc-card mb-3 class-level-guide__intro">
        <div>
          <div className="spell-admin-kicker">Level 1–20 Guide</div>
          <h2 className="h5 mb-1">{classRow?.class_name || "Class"} Progression</h2>
          <div className="small text-muted">
            {sourceLabel(classRow?.source)}{selectedSubclass ? ` • ${selectedSubclass} features only` : " • Choose a subclass at the appropriate level to include its features"}
          </div>
        </div>
        <span className="badge text-bg-success">Current level {currentLevel}</span>
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
                    key={`${feature.type}-${feature.name}-${index}`}
                    type="button"
                    className={feature.type === "subclass" ? "is-subclass" : ""}
                    title={feature.description}
                    onMouseEnter={() => setSelectedFeature(feature)}
                    onFocus={() => setSelectedFeature(feature)}
                    onClick={() => setSelectedFeature(feature)}
                  >
                    {feature.name}
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

      <section className="npc-card mt-3 class-level-guide__detail">
        <div className="spell-admin-kicker">Feature Description</div>
        {selectedFeature ? (
          <>
            <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
              <h3 className="h5 mb-1">{selectedFeature.name}</h3>
              <span className={`badge ${selectedFeature.type === "subclass" ? "text-bg-info" : "text-bg-secondary"}`}>Level {selectedFeature.level}{selectedFeature.type === "subclass" ? " subclass" : ""}</span>
            </div>
            <p className="small mt-2 mb-0 class-level-guide__description">{selectedFeature.description}</p>
          </>
        ) : <div className="text-muted">Hover over or select a class feature to read its imported description.</div>}
      </section>
    </div>
  );
}

export default function CharacterClassWorkspace({ character = null, isAdmin = false }) {
  const [view, setView] = useState("overview");
  const [payload, setPayload] = useState(null);
  const [levels, setLevels] = useState([]);
  const [featureRows, setFeatureRows] = useState([]);
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
          <OverviewFeatureHover rootRef={overviewRef} featureRows={featureRows} />
        </div>
      ) : loading ? <div className="npc-card"><div className="text-muted">Loading level 1–20 progression…</div></div> : payload?.class ? (
        <LevelGuide payload={payload} levels={levels} featureRows={featureRows} />
      ) : <div className="npc-card"><div className="text-muted">Class progression has not been initialized for this character.</div></div>}

      <style jsx>{`
        .character-class-workspace__switcher { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
        :global(.class-feature-hover-row) { cursor:help; }
        .class-level-guide__intro { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
        .class-level-guide__table-card { overflow:hidden; padding:0; }
        .class-level-guide__table { min-width:900px; }
        .class-level-guide__row { display:grid; grid-template-columns:64px 56px minmax(300px,1.5fr) 82px 120px minmax(180px,.8fr); gap:.55rem; align-items:center; padding:.58rem .7rem; border-bottom:1px solid rgba(255,255,255,.075); }
        .class-level-guide__row:last-child { border-bottom:0; }
        .class-level-guide__row.is-head { position:sticky; top:0; z-index:2; color:rgba(255,255,255,.62); background:rgba(12,10,20,.98); font-size:.68rem; font-weight:800; letter-spacing:.05em; text-transform:uppercase; }
        .class-level-guide__row.is-current { background:linear-gradient(90deg,rgba(126,75,202,.23),rgba(245,190,75,.08)); box-shadow:inset 3px 0 #a970ff; }
        .class-level-guide__row > div:first-child { display:grid; }
        .class-level-guide__row > div:first-child span { color:#d4b7ff; font-size:.58rem; text-transform:uppercase; }
        .class-level-guide__features { display:flex; flex-wrap:wrap; gap:.32rem; }
        .class-level-guide__features button { padding:.24rem .45rem; border:1px solid rgba(255,255,255,.12); border-radius:999px; color:rgba(255,255,255,.9); background:rgba(255,255,255,.04); font-size:.68rem; text-align:left; }
        .class-level-guide__features button:hover, .class-level-guide__features button:focus { border-color:rgba(190,148,255,.72); background:rgba(142,82,231,.2); outline:none; }
        .class-level-guide__features button.is-subclass { border-color:rgba(58,188,220,.48); background:rgba(28,128,151,.15); }
        .class-level-guide__slots { color:rgba(255,255,255,.68); font-size:.68rem; white-space:pre-wrap; }
        .class-level-guide__description { white-space:pre-line; line-height:1.55; }
        @media (max-width:1000px) { .class-level-guide__table-card { overflow:auto; } }
      `}</style>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import {
  countStartingSpellSelections,
  preferSpellRows,
  spellChoicesForRpc,
  startingSpellSelectionModel,
  validateStartingSpellSelections,
} from "../utils/playerForgeRules";

function safeText(value) {
  return String(value ?? "").trim();
}

function sourceLabel(source = "") {
  if (source === "XPHB") return "2024 Player's Handbook";
  if (source === "PHB") return "2014 Player's Handbook";
  return source || "Campaign";
}

function spellLevelLabel(level) {
  const value = Number(level || 0);
  if (value === 0) return "Cantrip";
  const suffix = value === 1 ? "st" : value === 2 ? "nd" : value === 3 ? "rd" : "th";
  return `${value}${suffix}-level`;
}

function classMatchesSpell(spell, selectedClass) {
  const className = safeText(selectedClass?.class_name).toLowerCase();
  const classKey = safeText(selectedClass?.class_key).toLowerCase();
  return (Array.isArray(spell?.classes) ? spell.classes : []).some((entry) => {
    const value = safeText(entry).toLowerCase();
    return value === className || value === classKey;
  });
}

function selectionLabel(model) {
  if (model.mode === "spellbook") return "Spellbook";
  if (model.mode === "prepared") return "Prepared spells";
  if (model.mode === "known") return "Known spells";
  return "Spells";
}

export default function NpcForgeSpellStep({
  selectedClass = null,
  level = 1,
  selections = {},
  onChange = null,
  onModelChange = null,
  onSpellRowsChange = null,
}) {
  const [levelRow, setLevelRow] = useState(null);
  const [spells, setSpells] = useState([]);
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [expandedId, setExpandedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const model = useMemo(
    () => startingSpellSelectionModel(selectedClass, levelRow, level),
    [level, levelRow, selectedClass]
  );
  const counts = useMemo(
    () => countStartingSpellSelections(spells, selections),
    [selections, spells]
  );
  const errors = useMemo(
    () => validateStartingSpellSelections(model, spells, selections),
    [model, selections, spells]
  );

  useEffect(() => {
    onModelChange?.({ ...model, loading, error, catalogReady: !loading && !error && (model.mode === "none" || Boolean(levelRow)) });
  }, [error, levelRow, loading, model, onModelChange]);

  useEffect(() => {
    onSpellRowsChange?.(spells);
  }, [onSpellRowsChange, spells]);

  useEffect(() => {
    if (!selectedClass?.id) {
      setLevelRow(null);
      setSpells([]);
      setError("");
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      supabase
        .from("class_level_progression")
        .select("class_level,cantrips_known,spells_known,spell_slots,choices")
        .eq("class_id", selectedClass.id)
        .eq("class_level", Math.max(1, Math.min(20, Number(level || 1))))
        .maybeSingle(),
      supabase
        .from("spells_catalog")
        .select("id,spell_key,slug,name,source,level,school,classes,ritual,concentration,casting_time,range_text,duration_text,components_v,components_s,components_m,material_text,description,higher_level_text")
        .order("level", { ascending: true })
        .order("name", { ascending: true })
        .limit(5000),
    ]).then(([progressionResult, spellResult]) => {
      if (!active) return;
      const loadError = progressionResult.error || spellResult.error;
      if (loadError) {
        setError(loadError.message || "Could not load starting spell choices.");
        setLevelRow(progressionResult.data || null);
        setSpells([]);
      } else {
        const progression = progressionResult.data || null;
        const provisionalModel = startingSpellSelectionModel(selectedClass, progression, level);
        const filtered = preferSpellRows(spellResult.data || [])
          .filter((spell) => classMatchesSpell(spell, selectedClass))
          .filter((spell) => Number(spell.level || 0) === 0 || Number(spell.level || 0) <= provisionalModel.maximumSpellLevel);
        setLevelRow(progression);
        setSpells(filtered);
      }
      setLoading(false);
    }).catch((cause) => {
      if (!active) return;
      setError(String(cause?.message || cause || "Could not load starting spell choices."));
      setLevelRow(null);
      setSpells([]);
      setLoading(false);
    });
    return () => { active = false; };
  }, [level, selectedClass?.class_key, selectedClass?.id, selectedClass?.class_name]);

  useEffect(() => {
    const validIds = new Set(spells.map((spell) => String(spell.id)));
    const next = Object.fromEntries(
      Object.entries(selections || {}).filter(([id]) => validIds.has(String(id)))
    );
    if (Object.keys(next).length !== Object.keys(selections || {}).length) onChange?.(next);
  }, [onChange, selections, spells]);

  const schools = useMemo(
    () => [...new Set(spells.map((spell) => safeText(spell.school)).filter(Boolean))].sort(),
    [spells]
  );

  const visibleSpells = useMemo(() => {
    const normalizedQuery = safeText(query).toLowerCase();
    return spells.filter((spell) => {
      if (selectedOnly && !selections?.[spell.id]) return false;
      if (levelFilter !== "all" && Number(spell.level || 0) !== Number(levelFilter)) return false;
      if (schoolFilter !== "all" && safeText(spell.school) !== schoolFilter) return false;
      if (!normalizedQuery) return true;
      return [
        spell.name,
        spell.school,
        spell.description,
        spell.higher_level_text,
        spell.source,
      ].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery);
    });
  }, [levelFilter, query, schoolFilter, selectedOnly, selections, spells]);

  function updateChoice(spell, nextSelected) {
    const current = { ...(selections || {}) };
    if (!nextSelected) {
      delete current[spell.id];
      onChange?.(current);
      return;
    }

    const isCantrip = Number(spell.level || 0) === 0;
    if (isCantrip && counts.cantrips >= model.cantrips) return;
    if (!isCantrip && counts.leveled >= model.leveled) return;

    const prepared = isCantrip
      || model.mode !== "spellbook"
      || counts.prepared - counts.cantrips < model.prepared;
    current[spell.id] = { prepared };
    onChange?.(current);
  }

  function togglePrepared(spell) {
    if (Number(spell.level || 0) === 0 || model.mode !== "spellbook" || !selections?.[spell.id]) return;
    const currentlyPrepared = Boolean(selections[spell.id]?.prepared);
    const preparedLeveled = counts.prepared - counts.cantrips;
    if (!currentlyPrepared && preparedLeveled >= model.prepared) return;
    onChange?.({
      ...(selections || {}),
      [spell.id]: { ...selections[spell.id], prepared: !currentlyPrepared },
    });
  }

  if (!selectedClass) {
    return <div className="npc-forge-spell-empty">
      <h3>Choose a class first</h3>
      <p>The Forge determines spell access from the selected class and starting level.</p>
    </div>;
  }

  if (loading) {
    return <div className="npc-forge-spell-empty"><h3>Loading spell choices…</h3></div>;
  }

  if (model.mode === "none") {
    return <div className="npc-forge-spell-empty is-complete">
      <span>Spells</span>
      <h3>{selectedClass.class_name} has no base-class spell selection at level {level}</h3>
      <p>Continue to Identity. Species, background, subclass, feat, or later class features can still grant magic.</p>
    </div>;
  }

  return <div className="npc-forge-spell-step">
    <section className="npc-forge-spell-summary">
      <div>
        <span>Starting magic</span>
        <h3>{selectedClass.class_name} level {level}</h3>
        <p>
          Choose legal spells from the preferred class list. Cantrips are always available.
          {model.mode === "spellbook" ? " Add the required spells to the spellbook, then mark the prepared subset." : ""}
        </p>
      </div>
      <div className="npc-forge-spell-counters">
        <div className={counts.cantrips === model.cantrips ? "is-complete" : ""}>
          <span>Cantrips</span><strong>{counts.cantrips}/{model.cantrips}</strong>
        </div>
        <div className={counts.leveled === model.leveled ? "is-complete" : ""}>
          <span>{selectionLabel(model)}</span><strong>{counts.leveled}/{model.leveled}</strong>
        </div>
        {model.mode === "spellbook" ? <div className={counts.prepared - counts.cantrips === model.prepared ? "is-complete" : ""}>
          <span>Prepared</span><strong>{counts.prepared - counts.cantrips}/{model.prepared}</strong>
        </div> : null}
        <div><span>Highest spell level</span><strong>{model.maximumSpellLevel}</strong></div>
      </div>
    </section>

    {error ? <div className="npc-forge-catalog-warning">{error}</div> : null}
    {errors.length ? <div className="npc-forge-spell-requirements">{errors.map((message) => <span key={message}>{message}</span>)}</div> : <div className="npc-forge-spell-ready">Starting spell requirements complete.</div>}

    <div className="npc-forge-spell-filters">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search spells, schools, or descriptions…" />
      <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
        <option value="all">All spell levels</option>
        <option value="0">Cantrips</option>
        {Array.from({ length: model.maximumSpellLevel }, (_unused, index) => <option key={index + 1} value={index + 1}>Level {index + 1}</option>)}
      </select>
      <select value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)}>
        <option value="all">All schools</option>
        {schools.map((school) => <option key={school} value={school}>{school}</option>)}
      </select>
      <label><input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)} /> Selected only</label>
    </div>

    <div className="npc-forge-spell-list">
      {visibleSpells.map((spell) => {
        const selected = Boolean(selections?.[spell.id]);
        const prepared = Boolean(selections?.[spell.id]?.prepared);
        const isCantrip = Number(spell.level || 0) === 0;
        return <article key={spell.id} className={`npc-forge-spell-card ${selected ? "is-selected" : ""}`}>
          <button type="button" className="npc-forge-spell-card__main" onClick={() => updateChoice(spell, !selected)}>
            <span>
              <strong>{spell.name}</strong>
              <small>{spellLevelLabel(spell.level)} {spell.school ? `• ${spell.school}` : ""} • {sourceLabel(spell.source)}</small>
            </span>
            <b>{selected ? "Selected" : "Choose"}</b>
          </button>
          <div className="npc-forge-spell-card__tags">
            {spell.ritual ? <span>Ritual</span> : null}
            {spell.concentration ? <span>Concentration</span> : null}
            {spell.casting_time ? <span>{spell.casting_time}</span> : null}
            {spell.range_text ? <span>{spell.range_text}</span> : null}
            {selected && model.mode === "spellbook" && !isCantrip ? <button type="button" className={prepared ? "is-prepared" : ""} onClick={() => togglePrepared(spell)}>{prepared ? "Prepared" : "Prepare"}</button> : null}
            <button type="button" onClick={() => setExpandedId((current) => current === spell.id ? "" : spell.id)}>{expandedId === spell.id ? "Hide details" : "Details"}</button>
          </div>
          {expandedId === spell.id ? <div className="npc-forge-spell-card__details">
            <dl>
              <div><dt>Duration</dt><dd>{spell.duration_text || "Instantaneous"}</dd></div>
              <div><dt>Components</dt><dd>{[spell.components_v ? "V" : "", spell.components_s ? "S" : "", spell.components_m ? "M" : ""].filter(Boolean).join(", ") || "None"}{spell.material_text ? ` — ${spell.material_text}` : ""}</dd></div>
            </dl>
            <p>{spell.description || "No imported description is available."}</p>
            {spell.higher_level_text ? <p><strong>At Higher Levels.</strong> {spell.higher_level_text}</p> : null}
          </div> : null}
        </article>;
      })}
      {!visibleSpells.length ? <div className="npc-forge-spell-empty"><p>No spells match the current filters.</p></div> : null}
    </div>

    <input type="hidden" value={JSON.stringify(spellChoicesForRpc(spells, selections))} readOnly />

    <style jsx global>{`
      .npc-forge-spell-step{display:grid;gap:14px}
      .npc-forge-spell-summary{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;padding:16px;border:1px solid rgba(168,108,255,.3);border-radius:14px;background:linear-gradient(135deg,rgba(52,28,82,.62),rgba(8,20,31,.9))}
      .npc-forge-spell-summary>div:first-child>span{color:#d7bfff;font-size:.65rem;font-weight:900;letter-spacing:.09em;text-transform:uppercase}
      .npc-forge-spell-summary h3{margin:4px 0;color:#fff}.npc-forge-spell-summary p{max-width:72ch;margin:0;color:rgba(255,255,255,.72);line-height:1.58}
      .npc-forge-spell-counters{display:grid;grid-template-columns:repeat(2,minmax(112px,1fr));gap:8px}
      .npc-forge-spell-counters>div{display:grid;padding:9px 11px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.035)}
      .npc-forge-spell-counters>div.is-complete{border-color:rgba(88,214,199,.55);background:rgba(38,132,121,.12)}
      .npc-forge-spell-counters span{color:rgba(255,255,255,.54);font-size:.6rem;text-transform:uppercase}.npc-forge-spell-counters strong{color:#fff}
      .npc-forge-spell-requirements,.npc-forge-spell-ready{display:flex;gap:8px;flex-wrap:wrap;padding:9px 11px;border-radius:9px;font-size:.72rem}
      .npc-forge-spell-requirements{border:1px solid rgba(255,121,121,.38);color:#ffd0d0;background:rgba(132,28,39,.12)}
      .npc-forge-spell-ready{border:1px solid rgba(88,214,199,.35);color:#c7fff7;background:rgba(31,126,116,.1)}
      .npc-forge-spell-filters{display:grid;grid-template-columns:minmax(220px,1fr) auto auto auto;gap:8px;align-items:center}
      .npc-forge-spell-filters input,.npc-forge-spell-filters select{min-width:0;padding:9px 10px;border:1px solid rgba(255,255,255,.13);border-radius:8px;color:#fff;background:#0d111c}
      .npc-forge-spell-filters label{display:flex;align-items:center;gap:6px;color:rgba(255,255,255,.72);font-size:.72rem;white-space:nowrap}
      .npc-forge-spell-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .npc-forge-spell-card{min-width:0;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:rgba(255,255,255,.025);overflow:hidden}
      .npc-forge-spell-card.is-selected{border-color:#a86cff;box-shadow:inset 3px 0 #a86cff;background:rgba(126,72,199,.1)}
      .npc-forge-spell-card__main{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px;border:0;color:inherit;background:none;text-align:left}
      .npc-forge-spell-card__main span{display:grid;gap:3px;min-width:0}.npc-forge-spell-card__main strong{color:#fff}.npc-forge-spell-card__main small{color:rgba(255,255,255,.56);font-size:.64rem}
      .npc-forge-spell-card__main b{flex:0 0 auto;padding:3px 7px;border-radius:999px;color:#e8dbff;background:rgba(126,72,199,.22);font-size:.6rem}
      .npc-forge-spell-card__tags{display:flex;gap:5px;flex-wrap:wrap;padding:0 11px 10px}
      .npc-forge-spell-card__tags span,.npc-forge-spell-card__tags button{padding:3px 6px;border:1px solid rgba(255,255,255,.12);border-radius:999px;color:rgba(255,255,255,.68);background:rgba(255,255,255,.035);font-size:.58rem}
      .npc-forge-spell-card__tags button.is-prepared{border-color:#58d6c7;color:#bffcf4;background:rgba(41,143,132,.14)}
      .npc-forge-spell-card__details{display:grid;gap:8px;padding:11px;border-top:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.75);font-size:.7rem;line-height:1.58}
      .npc-forge-spell-card__details dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:0}.npc-forge-spell-card__details dl>div{display:grid}.npc-forge-spell-card__details dt{color:rgba(255,255,255,.48);font-size:.58rem;text-transform:uppercase}.npc-forge-spell-card__details dd,.npc-forge-spell-card__details p{margin:0}
      .npc-forge-spell-empty{display:grid;place-items:center;min-height:260px;padding:24px;border:1px dashed rgba(168,108,255,.3);border-radius:14px;color:rgba(255,255,255,.7);text-align:center}
      .npc-forge-spell-empty h3{color:#fff}.npc-forge-spell-empty.is-complete{border-color:rgba(88,214,199,.4)}
      @media(max-width:1050px){.npc-forge-spell-summary{grid-template-columns:1fr}.npc-forge-spell-filters{grid-template-columns:1fr 1fr}.npc-forge-spell-list{grid-template-columns:1fr}}
      @media(max-width:640px){.npc-forge-spell-filters{grid-template-columns:1fr}.npc-forge-spell-counters{grid-template-columns:1fr 1fr}}
    `}</style>
  </div>;
}

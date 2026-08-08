import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { countStartingSpellSelections, preferSpellRows, startingSpellSelectionModel, validateStartingSpellSelections } from "../utils/playerForgeRules";
import { spellAllowedForStartingModel, startingSpellSourceForRow, subclassStartingSpellSelectionModel } from "../utils/playerForgeSpellSources";
import NpcForgeClassFeatureChoices from "./NpcForgeClassFeatureChoices";
import { useNpcForgeClassChoice } from "./NpcForgeClassChoiceContext";

function groupByLevel(spells = []) {
  const groups = new Map();
  spells.forEach((spell) => {
    const level = Number(spell.level || 0);
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level).push(spell);
  });
  return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}

function levelLabel(level) { return Number(level) === 0 ? "Cantrips" : `Level ${level}`; }
function safeText(value) { return String(value ?? "").trim(); }

export default function NpcForgeSpellStep({ selectedClass, selectedSubclass = null, level = 1, selections = {}, expandedSpellNames = [], onChange, onModelChange, onSpellRowsChange }) {
  const { state: classChoiceState, toggleFeatureOption } = useNpcForgeClassChoice();
  const [levelRow, setLevelRow] = useState(null);
  const [spells, setSpells] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [openSpellId, setOpenSpellId] = useState("");
  const subclassModel = useMemo(() => subclassStartingSpellSelectionModel(selectedClass, selectedSubclass, level), [level, selectedClass, selectedSubclass]);
  const model = useMemo(() => subclassModel || startingSpellSelectionModel(selectedClass, levelRow, level), [level, levelRow, selectedClass, subclassModel]);
  const savantSpellIds = useMemo(() => {
    const ids = new Set();
    for (const group of classChoiceState?.featureGroups || []) {
      if (!/ savant$/i.test(safeText(group?.sourceFeature))) continue;
      for (const key of classChoiceState?.featureSelections?.[group.id] || []) {
        const option = (group.options || []).find((candidate) => candidate.key === key);
        if (option?.spell?.id) ids.add(String(option.spell.id));
      }
    }
    return ids;
  }, [classChoiceState?.featureGroups, classChoiceState?.featureSelections]);

  useEffect(() => { onModelChange?.(model); }, [model, onModelChange]);
  useEffect(() => { onSpellRowsChange?.(spells); }, [onSpellRowsChange, spells]);

  useEffect(() => {
    let active = true;
    if (!selectedClass?.id) { setLevelRow(null); return () => { active = false; }; }
    supabase.from("class_level_progression")
      .select("class_level,proficiency_bonus,features,cantrips_known,spells_known,spell_slots")
      .eq("class_id", selectedClass.id)
      .eq("class_level", Number(level || 1))
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) setError(loadError.message || "Could not load class spell progression.");
        setLevelRow(data || null);
      });
    return () => { active = false; };
  }, [level, selectedClass?.id]);

  useEffect(() => {
    let active = true;
    if (!selectedClass?.class_name || model.mode === "none") { setSpells([]); setLoading(false); return () => { active = false; }; }
    setLoading(true); setError("");
    const maximumLevel = Math.max(0, Number(model.maximumSpellLevel || 0));
    supabase.from("spells_catalog")
      .select("id,spell_key,name,source,level,school,school_code,classes,casting_time,range_text,duration_text,ritual,concentration,components_v,components_s,components_m,components_text,material_text,description,damage_dice,damage_types")
      .lte("level", maximumLevel)
      .order("level", { ascending: true })
      .order("name", { ascending: true })
      .limit(10000)
      .then(({ data, error: spellError }) => {
        if (!active) return;
        if (spellError) { setError(spellError.message || "Could not load the canonical spell catalogue."); setSpells([]); setLoading(false); return; }
        setSpells(preferSpellRows(data || []).filter((spell) => spellAllowedForStartingModel(spell, model, selectedClass, expandedSpellNames)));
        setLoading(false);
      });
    return () => { active = false; };
  }, [expandedSpellNames, model, selectedClass?.class_name]);

  useEffect(() => {
    const duplicates = Object.keys(selections || {}).filter((spellId) => savantSpellIds.has(String(spellId)));
    if (!duplicates.length) return;
    const next = { ...(selections || {}) };
    duplicates.forEach((spellId) => { delete next[spellId]; });
    onChange?.(next);
  }, [onChange, savantSpellIds, selections]);

  const selectableSpells = useMemo(() => spells.filter((spell) => !savantSpellIds.has(String(spell.id))), [savantSpellIds, spells]);
  const signatureSpellbookIds = useMemo(() => {
    const ids = new Set();
    const byId = new Map(spells.map((spell) => [String(spell.id), spell]));
    for (const spellId of Object.keys(selections || {})) {
      if (Number(byId.get(String(spellId))?.level || 0) === 3) ids.add(String(spellId));
    }
    for (const group of classChoiceState?.featureGroups || []) {
      if (!/ savant$/i.test(safeText(group?.sourceFeature))) continue;
      for (const key of classChoiceState?.featureSelections?.[group.id] || []) {
        const option = (group.options || []).find((candidate) => candidate.key === key);
        if (Number(option?.spell?.level || 0) === 3 && option?.spell?.id) ids.add(String(option.spell.id));
      }
    }
    return ids;
  }, [classChoiceState?.featureGroups, classChoiceState?.featureSelections, selections, spells]);
  const spellPlacementGroups = useMemo(() => (classChoiceState?.featureGroups || [])
    .filter((group) => (group.placement || "class") === "spells")
    .map((group) => group.id !== "wizard-signature-spells" ? group : {
      ...group,
      options: (group.options || []).filter((option) => option?.spell?.id && signatureSpellbookIds.has(String(option.spell.id))),
    }), [classChoiceState?.featureGroups, signatureSpellbookIds]);

  useEffect(() => {
    const signature = spellPlacementGroups.find((group) => group.id === "wizard-signature-spells");
    if (!signature) return;
    const allowed = new Set((signature.options || []).map((option) => option.key));
    for (const selectedKey of classChoiceState?.featureSelections?.[signature.id] || []) {
      if (!allowed.has(selectedKey)) toggleFeatureOption?.(signature.id, selectedKey);
    }
  }, [classChoiceState?.featureSelections, spellPlacementGroups, toggleFeatureOption]);

  const counts = countStartingSpellSelections(selectableSpells, selections);
  const validation = model.mode === "none" ? [] : validateStartingSpellSelections(model, selectableSpells, selections);
  const groups = useMemo(() => groupByLevel(selectableSpells.filter((spell) => {
    if (selectedOnly && !selections?.[spell.id]) return false;
    const needle = query.trim().toLowerCase();
    return !needle || [spell.name, spell.school, spell.description, ...(spell.classes || [])].filter(Boolean).join(" ").toLowerCase().includes(needle);
  })), [query, selectableSpells, selectedOnly, selections]);

  function toggleSpell(spell) {
    const next = { ...(selections || {}) };
    if (next[spell.id]) delete next[spell.id];
    else {
      const source = startingSpellSourceForRow(spell, model, expandedSpellNames);
      next[spell.id] = { prepared: model.mode !== "spellbook" || Number(spell.level) === 0, sourceType: source.sourceType, sourceKey: source.sourceKey, accessType: source.accessType };
    }
    onChange?.(next);
  }
  function togglePrepared(spell) {
    const current = selections?.[spell.id];
    if (!current || Number(spell.level) === 0 || model.mode !== "spellbook") return;
    onChange?.({ ...selections, [spell.id]: { ...current, prepared: !current.prepared } });
  }

  if (!selectedClass) return <div className="npc-forge-section"><div className="npc-forge-section-heading"><div><span>Spells</span><h3>Choose a class first</h3></div></div></div>;
  if (model.mode === "none") return <div className="npc-forge-section"><div className="npc-forge-section-heading"><div><span>Spells</span><h3>No starting spell selection for this class</h3></div><p>{selectedSubclass ? `${selectedSubclass.name} does not add a starting spell-selection progression at level ${level}.` : `${selectedClass.class_name} does not select base-class spells at level ${level}.`}</p></div><div className="npc-forge-workspace-note">Species, feats, backgrounds, subclasses, and class features can still grant spells through their own source-owned choices.</div></div>;

  const sourceLabel = model.sourceLabel || `${selectedClass.class_name} spellcasting`;
  return <div className="npc-forge-section npc-forge-spell-step">
    <div className="npc-forge-section-heading"><div><span>Spells</span><h3>{sourceLabel}</h3></div><p>{loading ? "Loading canonical spell catalogue…" : `${selectableSpells.length} eligible spells • highest spell level ${model.maximumSpellLevel}`}</p></div>
    {error ? <div className="npc-forge-catalog-warning">{error}</div> : null}
    <div className="npc-forge-spell-summary"><div><span>Cantrips</span><strong>{counts.cantrips}/{model.cantrips}</strong></div><div><span>{model.mode === "spellbook" ? "Spellbook" : model.mode === "prepared" ? "Prepared" : "Known spells"}</span><strong>{counts.leveled}/{model.leveled}</strong></div>{model.mode === "spellbook" ? <div><span>Prepared leveled</span><strong>{Math.max(0, counts.prepared - counts.cantrips)}/{model.prepared}</strong></div> : null}<div><span>Highest spell level</span><strong>{model.maximumSpellLevel}</strong></div></div>
    {model.fixedSpells?.length ? <div className="npc-forge-spell-fixed"><strong>Automatic from {sourceLabel}</strong><span>{model.fixedSpells.map((spell) => spell.name).join(", ")}</span></div> : null}
    {savantSpellIds.size ? <div className="npc-forge-spell-access-note"><strong>Savant spellbook additions</strong><span>{savantSpellIds.size} source-owned spell{savantSpellIds.size === 1 ? "" : "s"} already added through the Class step.</span><small>Those free Savant additions are kept separate from the Wizard's normal spellbook choices and cannot be selected twice.</small></div> : null}
    {expandedSpellNames?.length && model.sourceType !== "subclass" ? <div className="npc-forge-spell-access-note"><strong>Background-expanded access</strong><span>{expandedSpellNames.join(", ")}</span><small>These spells join the selected class list; they are not automatically known or prepared.</small></div> : null}
    <div className="npc-forge-spell-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search spell name, school, class, or rules text…" /><button type="button" className={selectedOnly ? "is-active" : ""} onClick={() => setSelectedOnly((value) => !value)}>Selected only</button></div>
    <div className="npc-forge-spell-groups">{groups.map(([spellLevel, rows]) => <section key={spellLevel}><header><strong>{levelLabel(spellLevel)}</strong><span>{rows.length}</span></header><div className="npc-forge-spell-list">{rows.map((spell) => {
      const selected = Boolean(selections?.[spell.id]);
      const prepared = Boolean(selections?.[spell.id]?.prepared);
      const open = openSpellId === String(spell.id);
      const expanded = expandedSpellNames.some((name) => name.toLowerCase() === spell.name.toLowerCase());
      return <article key={spell.id} className={`npc-forge-spell-row ${selected ? "is-selected" : ""}`}><button type="button" className="npc-forge-spell-select" onClick={() => toggleSpell(spell)}><span className="npc-forge-spell-check">{selected ? "✓" : "+"}</span><span><strong>{spell.name}</strong><small>{spell.school || spell.school_code || "Spell"} • {spell.source}{expanded ? " • Background access" : ""}</small></span></button>{selected && model.mode === "spellbook" && Number(spell.level) > 0 ? <button type="button" className={`npc-forge-spell-prepared ${prepared ? "is-active" : ""}`} onClick={() => togglePrepared(spell)}>{prepared ? "Prepared" : "Spellbook only"}</button> : null}<button type="button" className="npc-forge-spell-info" onClick={() => setOpenSpellId(open ? "" : String(spell.id))}>Details</button>{open ? <div className="npc-forge-spell-details"><div><b>{spell.casting_time || "—"}</b><span>Casting time</span></div><div><b>{spell.range_text || "—"}</b><span>Range</span></div><div><b>{spell.duration_text || "—"}</b><span>Duration</span></div><div><b>{[spell.components_v ? "V" : "", spell.components_s ? "S" : "", spell.components_m ? "M" : ""].filter(Boolean).join(", ") || "—"}</b><span>Components</span></div><p>{safeText(spell.description) || "No imported spell description is available."}</p></div> : null}</article>;
    })}</div></section>)}</div>
    {spellPlacementGroups.length ? <NpcForgeClassFeatureChoices groups={spellPlacementGroups} selections={classChoiceState?.featureSelections || {}} level={level} placement="spells" onToggle={toggleFeatureOption} heading="Finish spellbook-dependent class choices" description="These choices are permanent, but their eligible options come from the spellbook you are building on this step." /> : null}
    <div className={`npc-forge-spell-validation ${validation.length ? "is-incomplete" : "is-complete"}`}>{validation.length ? validation.join(" ") : "Starting spell requirements complete."}</div>
    <style jsx global>{`
      .npc-forge-spell-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.npc-forge-spell-summary>div{display:grid;gap:2px;padding:9px 10px;border:1px solid rgba(88,214,199,.22);border-radius:9px;background:rgba(88,214,199,.055)}.npc-forge-spell-summary span{color:rgba(255,255,255,.55);font-size:.58rem;text-transform:uppercase}.npc-forge-spell-summary strong{color:#dcfff9}.npc-forge-spell-fixed,.npc-forge-spell-access-note{display:grid;gap:3px;margin-top:10px;padding:9px 11px;border:1px solid rgba(168,108,255,.25);border-radius:9px;background:rgba(126,72,199,.07)}.npc-forge-spell-fixed strong,.npc-forge-spell-access-note strong{color:#eadfff;font-size:.68rem}.npc-forge-spell-fixed span,.npc-forge-spell-access-note span{color:#fff;font-size:.72rem}.npc-forge-spell-access-note small{color:rgba(255,255,255,.5);font-size:.61rem}.npc-forge-spell-toolbar{display:flex;gap:7px;margin:11px 0}.npc-forge-spell-toolbar input{flex:1}.npc-forge-spell-toolbar button{padding:6px 9px;border:1px solid rgba(255,255,255,.12);border-radius:7px;color:#fff;background:rgba(255,255,255,.04)}.npc-forge-spell-toolbar button.is-active{border-color:#a86cff;background:rgba(126,72,199,.17)}.npc-forge-spell-groups{display:grid;gap:10px}.npc-forge-spell-groups>section>header{display:flex;justify-content:space-between;padding:5px 2px;color:#d7bfff}.npc-forge-spell-list{display:grid;gap:5px}.npc-forge-spell-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.025);overflow:hidden}.npc-forge-spell-row.is-selected{border-color:rgba(88,214,199,.36);background:rgba(88,214,199,.05)}.npc-forge-spell-select{display:flex;align-items:center;gap:8px;padding:8px;border:0;color:#fff;background:none;text-align:left}.npc-forge-spell-select>span:last-child{display:grid}.npc-forge-spell-select small{color:rgba(255,255,255,.48);font-size:.58rem}.npc-forge-spell-check{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:rgba(126,72,199,.16);color:#e5d5ff}.npc-forge-spell-prepared,.npc-forge-spell-info{border:0;border-left:1px solid rgba(255,255,255,.08);padding:7px 9px;color:rgba(255,255,255,.66);background:rgba(255,255,255,.025);font-size:.61rem}.npc-forge-spell-prepared.is-active{color:#9ff8ec}.npc-forge-spell-details{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;padding:9px;border-top:1px solid rgba(255,255,255,.08)}.npc-forge-spell-details>div{display:grid}.npc-forge-spell-details span{color:rgba(255,255,255,.45);font-size:.54rem}.npc-forge-spell-details p{grid-column:1/-1;margin:0;color:rgba(255,255,255,.7);font-size:.68rem;line-height:1.5}.npc-forge-spell-validation{margin-top:10px;padding:8px 10px;border-radius:8px;font-size:.68rem}.npc-forge-spell-validation.is-complete{color:#bafff4;background:rgba(88,214,199,.08)}.npc-forge-spell-validation.is-incomplete{color:#ffe0a0;background:rgba(246,190,90,.08)}@media(max-width:720px){.npc-forge-spell-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.npc-forge-spell-row{grid-template-columns:1fr}.npc-forge-spell-prepared,.npc-forge-spell-info{border-left:0;border-top:1px solid rgba(255,255,255,.08)}.npc-forge-spell-details{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `}</style>
  </div>;
}
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { countStartingSpellSelections, preferSpellRows, startingSpellSelectionModel, validateStartingSpellSelections } from "../utils/playerForgeRules";
import { spellAllowedForStartingModel, startingSpellSourceForRow, subclassStartingSpellSelectionModel } from "../utils/playerForgeSpellSources";
import { sourceChoiceGroupComplete } from "../utils/playerForgeSourceChoices";
import NpcForgeClassFeatureChoices from "./NpcForgeClassFeatureChoices";
import NpcForgeSourceChoiceFields from "./NpcForgeSourceChoiceFields";
import SpellCard from "./SpellCard";
import { useNpcForgeClassChoice } from "./NpcForgeClassChoiceContext";
import { sourceChoiceGroupsForResolverPlacement, useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";

function levelLabel(level) { return Number(level) === 0 ? "Cantrip" : `Level ${level}`; }
function safeText(value) { return String(value ?? "").trim(); }
function schoolLabel(spell = {}) { return spell.school || spell.school_code || "Spell"; }
function spellStatus(spell, selections = {}) {
  const selected = Boolean(selections?.[spell.id]);
  if (!selected) return "Available";
  if (selections?.[spell.id]?.prepared && Number(spell.level || 0) > 0) return "Prepared";
  return "Selected";
}
function compareText(a, b) { return String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base", numeric: true }); }

export default function NpcForgeSpellStep({ selectedClass, selectedSubclass = null, level = 1, selections = {}, expandedSpellNames = [], onChange, onModelChange, onSpellRowsChange }) {
  const { state: classChoiceState, toggleFeatureOption } = useNpcForgeClassChoice();
  const { state: sourceChoiceState } = useNpcForgeSourceChoices();
  const [levelRow, setLevelRow] = useState(null);
  const [spells, setSpells] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectionNotice, setSelectionNotice] = useState("");
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [sortKey, setSortKey] = useState("level");
  const [sortDirection, setSortDirection] = useState("asc");
  const [inspectedSpellId, setInspectedSpellId] = useState("");
  const subclassModel = useMemo(() => subclassStartingSpellSelectionModel(selectedClass, selectedSubclass, level), [level, selectedClass, selectedSubclass]);
  const model = useMemo(() => subclassModel || startingSpellSelectionModel(selectedClass, levelRow, level), [level, levelRow, selectedClass, subclassModel]);
  const hasClassSpellSelection = Boolean(selectedClass && model.mode !== "none");
  const sourceSpellGroups = useMemo(() => sourceChoiceGroupsForResolverPlacement(sourceChoiceState, "spells"), [sourceChoiceState]);
  const incompleteSourceSpellGroups = useMemo(() => sourceSpellGroups.filter((group) => !sourceChoiceGroupComplete(group, sourceChoiceState.selections || {})), [sourceChoiceState.selections, sourceSpellGroups]);
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
      .select("id,spell_key,name,source,page,level,school,school_code,classes,casting_time,range_text,duration_text,ritual,concentration,components_v,components_s,components_m,material_text,description,higher_level_text,scaling_text,scaling_json,raw_payload,area_type,area_size,area_unit,saving_throw_abilities,attack_type,damage_dice,damage_types")
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

  useEffect(() => {
    if (!incompleteSourceSpellGroups.length || typeof document === "undefined") return undefined;
    function blockIncompleteSourceMagic(event) {
      const button = event.target?.closest?.("button");
      if (!button || button.textContent?.trim() !== "Continue") return;
      const modal = button.closest(".npc-forge-modal-v2");
      const currentStep = modal?.querySelector(".npc-forge-steps button.is-current")?.textContent || "";
      if (!/Spells/i.test(currentStep)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      modal?.querySelector(".npc-forge-source-choice-group.is-required")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
    document.addEventListener("click", blockIncompleteSourceMagic, true);
    return () => document.removeEventListener("click", blockIncompleteSourceMagic, true);
  }, [incompleteSourceSpellGroups.length]);

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
  const validation = hasClassSpellSelection ? validateStartingSpellSelections(model, selectableSpells, selections) : [];

  function selectionLimitFor(spell) {
    return Number(spell?.level || 0) === 0 ? Number(model.cantrips || 0) : Number(model.leveled || 0);
  }

  function selectionCountFor(spell) {
    return Number(spell?.level || 0) === 0 ? counts.cantrips : counts.leveled;
  }

  function canAddSpell(spell) {
    if (!hasClassSpellSelection || !spell) return false;
    if (selections?.[spell.id]) return true;
    return selectionCountFor(spell) < selectionLimitFor(spell);
  }

  function selectionLimitMessage(spell) {
    const cantrip = Number(spell?.level || 0) === 0;
    const limit = selectionLimitFor(spell);
    if (cantrip) return `Cantrip limit reached (${limit}/${limit}). Remove a selected cantrip before choosing another.`;
    const noun = model.mode === "spellbook" ? "spellbook spell" : model.mode === "prepared" ? "prepared spell" : "known spell";
    return `${noun[0].toUpperCase() + noun.slice(1)} limit reached (${limit}/${limit}). Remove one before choosing another.`;
  }

  function sortableValue(spell, key) {
    if (key === "name") return spell.name;
    if (key === "level") return Number(spell.level || 0);
    if (key === "school") return schoolLabel(spell);
    if (key === "source") return spell.source;
    if (key === "status") {
      const status = spellStatus(spell, selections);
      return status === "Prepared" ? 0 : status === "Selected" ? 1 : 2;
    }
    return spell.name;
  }

  function changeSort(nextKey) {
    if (sortKey === nextKey) {
      setSortDirection((value) => value === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  }

  const filteredSpells = useMemo(() => selectableSpells.filter((spell) => {
    if (selectedOnly && !selections?.[spell.id]) return false;
    const needle = query.trim().toLowerCase();
    return !needle || [spell.name, spell.school, spell.source, spell.description, spell.higher_level_text, ...(spell.classes || [])].filter(Boolean).join(" ").toLowerCase().includes(needle);
  }), [query, selectableSpells, selectedOnly, selections]);

  const displaySpells = useMemo(() => [...filteredSpells].sort((a, b) => {
    const left = sortableValue(a, sortKey);
    const right = sortableValue(b, sortKey);
    const primary = typeof left === "number" && typeof right === "number" ? left - right : compareText(left, right);
    const directed = sortDirection === "asc" ? primary : -primary;
    return directed || Number(a.level || 0) - Number(b.level || 0) || compareText(a.name, b.name);
  }), [filteredSpells, selections, sortDirection, sortKey]);

  const inspectedSpell = useMemo(
    () => displaySpells.find((spell) => String(spell.id) === String(inspectedSpellId)) || displaySpells[0] || null,
    [displaySpells, inspectedSpellId]
  );

  useEffect(() => {
    if (!displaySpells.length) {
      if (inspectedSpellId) setInspectedSpellId("");
      return;
    }
    if (displaySpells.some((spell) => String(spell.id) === String(inspectedSpellId))) return;
    const selectedMatch = displaySpells.find((spell) => Boolean(selections?.[spell.id]));
    setInspectedSpellId(String(selectedMatch?.id || displaySpells[0].id));
  }, [displaySpells, inspectedSpellId, selections]);

  function toggleSpell(spell) {
    if (!hasClassSpellSelection) return;
    const next = { ...(selections || {}) };
    if (next[spell.id]) {
      delete next[spell.id];
      setSelectionNotice("");
    } else {
      if (!canAddSpell(spell)) {
        setSelectionNotice(selectionLimitMessage(spell));
        return;
      }
      const source = startingSpellSourceForRow(spell, model, expandedSpellNames);
      next[spell.id] = { prepared: model.mode !== "spellbook" || Number(spell.level) === 0, sourceType: source.sourceType, sourceKey: source.sourceKey, accessType: source.accessType };
      setSelectionNotice("");
    }
    onChange?.(next);
  }

  function togglePrepared(spell) {
    const current = selections?.[spell.id];
    if (!current || Number(spell.level) === 0 || model.mode !== "spellbook") return;
    onChange?.({ ...selections, [spell.id]: { ...current, prepared: !current.prepared } });
  }

  const classSourceLabel = hasClassSpellSelection ? model.sourceLabel || `${selectedClass?.class_name || "Class"} spellcasting` : "Source-owned magic";
  const hasAnyMagic = hasClassSpellSelection || sourceSpellGroups.length || spellPlacementGroups.length;
  const inspectedSelected = Boolean(inspectedSpell && selections?.[inspectedSpell.id]);
  const inspectedCanAdd = Boolean(inspectedSpell && canAddSpell(inspectedSpell));
  const inspectedSelectLabel = inspectedSelected
    ? "Remove"
    : inspectedCanAdd
      ? "Select"
      : Number(inspectedSpell?.level || 0) === 0 ? "Cantrips full" : "Spells full";

  return <div className="npc-forge-section npc-forge-spell-step">
    <div className="npc-forge-section-heading"><div><span>Spells</span><h3>{classSourceLabel}</h3></div><p>{loading ? "Loading canonical spell catalogue…" : hasClassSpellSelection ? `${selectableSpells.length} eligible class spells • highest spell level ${model.maximumSpellLevel}` : hasAnyMagic ? "Resolve species, feat, background, and class-feature magic below." : "This character has no starting spell decisions at this level."}</p></div>
    {error ? <div className="npc-forge-catalog-warning">{error}</div> : null}

    {sourceSpellGroups.length ? <section className="npc-forge-source-magic"><header><div><span>Source-owned magic</span><h3>Feat, background, species & feature spells</h3></div><p>These spells come from another part of your character and do not use your class spell picks.</p></header><NpcForgeSourceChoiceFields placement="spells" inline compact groupsOverride={sourceSpellGroups} title="Source-owned spell choices" /></section> : null}

    {hasClassSpellSelection ? <>
      <div className="npc-forge-spell-summary"><div><span>Cantrips</span><strong>{counts.cantrips}/{model.cantrips}</strong></div><div><span>{model.mode === "spellbook" ? "Spellbook" : model.mode === "prepared" ? "Prepared" : "Known spells"}</span><strong>{counts.leveled}/{model.leveled}</strong></div>{model.mode === "spellbook" ? <div><span>Prepared leveled</span><strong>{Math.max(0, counts.prepared - counts.cantrips)}/{model.prepared}</strong></div> : null}<div><span>Highest spell level</span><strong>{model.maximumSpellLevel}</strong></div></div>
      {selectionNotice ? <div className="npc-forge-spell-selection-notice">{selectionNotice}</div> : null}
      {model.fixedSpells?.length ? <div className="npc-forge-spell-fixed"><strong>Automatic from {classSourceLabel}</strong><span>{model.fixedSpells.map((spell) => spell.name).join(", ")}</span></div> : null}
      {savantSpellIds.size ? <div className="npc-forge-spell-access-note"><strong>Savant spellbook additions</strong><span>{savantSpellIds.size} source-owned spell{savantSpellIds.size === 1 ? "" : "s"} already added through class progression.</span><small>Those free Savant additions are kept separate from the Wizard's normal spellbook choices and cannot be selected twice.</small></div> : null}
      {expandedSpellNames?.length && model.sourceType !== "subclass" ? <div className="npc-forge-spell-access-note"><strong>Background-expanded access</strong><span>{expandedSpellNames.join(", ")}</span><small>These spells join the selected class list; they are not automatically known or prepared.</small></div> : null}
      <div className="npc-forge-spell-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search spell name, school, class, source, or rules text…" /><button type="button" className={selectedOnly ? "is-active" : ""} onClick={() => setSelectedOnly((value) => !value)}>Selected only</button></div>
      <div className="npc-forge-spell-catalogue-workspace profile-catalogue-workspace">
        <section className="profile-catalogue npc-forge-spell-catalogue" aria-label="Eligible starting spells">
          <div className="npc-forge-spell-table-head" role="row">
            {[
              ["name", "Spell"],
              ["level", "Level"],
              ["school", "School"],
              ["source", "Source"],
              ["status", "Status"],
            ].map(([key, label]) => <button key={key} type="button" className={sortKey === key ? "is-sorted" : ""} onClick={() => changeSort(key)} title={`Sort by ${label}`}><span>{label}</span><em aria-hidden="true">{sortKey === key ? sortDirection === "asc" ? "▲" : "▼" : "↕"}</em></button>)}
          </div>
          <div className="profile-catalogue__list npc-forge-spell-catalogue__list">
            {displaySpells.map((spell) => {
              const selected = Boolean(selections?.[spell.id]);
              const prepared = Boolean(selections?.[spell.id]?.prepared);
              const inspected = String(inspectedSpell?.id || "") === String(spell.id);
              const expanded = expandedSpellNames.some((name) => name.toLowerCase() === spell.name.toLowerCase());
              const atLimit = !selected && !canAddSpell(spell);
              const status = prepared && Number(spell.level || 0) > 0 ? "Prepared" : selected ? "Selected" : atLimit ? "Full" : "Available";
              const flags = [spell.concentration ? "Concentration" : "", spell.ritual ? "Ritual" : "", expanded ? "Background access" : ""].filter(Boolean);
              return <button key={spell.id} type="button" aria-pressed={inspected} className={`profile-catalogue__row npc-forge-spell-table-row ${inspected ? "active" : ""} ${selected ? "is-selected" : ""}`} onClick={() => setInspectedSpellId(String(spell.id))} title={flags.length ? `${spell.name} • ${flags.join(" • ")}` : spell.name}>
                <span className="profile-catalogue__row-name">{spell.name}{flags.length ? <small>{flags.map((flag) => flag[0]).join(" ")}</small> : null}</span>
                <span>{levelLabel(spell.level)}</span>
                <span>{schoolLabel(spell)}</span>
                <span>{spell.source || "—"}</span>
                <span className={`npc-forge-spell-row-status is-${status.toLowerCase()}`}>{status}</span>
              </button>;
            })}
            {!displaySpells.length ? <div className="profile-catalogue__empty">No eligible spells match these filters.</div> : null}
          </div>
        </section>
        <section className="profile-catalogue__preview npc-forge-spell-preview" aria-label="Selected spell details">
          <div className="npc-card-title">Spell Details</div>
          {inspectedSpell ? <>
            <SpellCard
              spell={inspectedSpell}
              compact
              compressed
              headerAction={<button type="button" disabled={!inspectedSelected && !inspectedCanAdd} title={!inspectedSelected && !inspectedCanAdd ? selectionLimitMessage(inspectedSpell) : undefined} className={`npc-forge-spell-card-select ${inspectedSelected ? "is-selected" : ""}`} onClick={() => toggleSpell(inspectedSpell)}>{inspectedSelectLabel}</button>}
            />
            {selections?.[inspectedSpell.id] && model.mode === "spellbook" && Number(inspectedSpell.level) > 0 ? <div className="npc-forge-spell-preview__actions"><button type="button" className={selections?.[inspectedSpell.id]?.prepared ? "is-prepared" : ""} onClick={() => togglePrepared(inspectedSpell)}>{selections?.[inspectedSpell.id]?.prepared ? "Prepared" : "Spellbook only"}</button></div> : null}
          </> : <div className="profile-catalogue__empty">Select a spell from the catalogue to inspect its card.</div>}
        </section>
      </div>
    </> : <div className="npc-forge-workspace-note">No base-class spell catalogue selection is required. Source-owned spells above still become part of the character's Known spell authority.</div>}

    {spellPlacementGroups.length ? <NpcForgeClassFeatureChoices groups={spellPlacementGroups} selections={classChoiceState?.featureSelections || {}} level={level} placement="spells" onToggle={toggleFeatureOption} heading="Finish spellbook-dependent class choices" description="These choices are permanent, but their eligible options come from the spellbook you are building on this step." /> : null}
    <div className={`npc-forge-spell-validation ${validation.length || incompleteSourceSpellGroups.length ? "is-incomplete" : "is-complete"}`}>{validation.length ? validation.join(" ") : incompleteSourceSpellGroups.length ? `Complete ${incompleteSourceSpellGroups.length} source-owned spell choice${incompleteSourceSpellGroups.length === 1 ? "" : "s"} above: ${incompleteSourceSpellGroups.map((group) => group.label).join(", ")}.` : "Starting spell requirements complete."}</div>
    <style jsx global>{`
      .npc-forge-source-magic{display:grid;gap:6px;margin-bottom:10px;padding:9px 10px;border:1px solid rgba(168,108,255,.28);border-radius:10px;background:linear-gradient(145deg,rgba(26,18,41,.72),rgba(10,20,27,.76))}.npc-forge-source-magic>header{display:flex;align-items:center;justify-content:space-between;gap:12px}.npc-forge-source-magic>header>div{display:flex;align-items:baseline;gap:8px;min-width:0}.npc-forge-source-magic>header span{color:#d7bfff;font-size:.6rem;font-weight:900;text-transform:uppercase;white-space:nowrap}.npc-forge-source-magic>header h3{margin:0;color:#fff;font-size:.82rem}.npc-forge-source-magic>header p{max-width:500px;margin:0;color:rgba(255,255,255,.64);font-size:.66rem;line-height:1.42}.npc-forge-source-magic .npc-forge-source-choice-group.is-compact-group>summary strong{font-size:.77rem}.npc-forge-source-magic .npc-forge-source-choice-group.is-compact-group>summary small{font-size:.63rem}.npc-forge-spell-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.npc-forge-spell-summary>div{display:grid;gap:2px;padding:8px 10px;border:1px solid rgba(88,214,199,.22);border-radius:9px;background:rgba(88,214,199,.055)}.npc-forge-spell-summary span{color:rgba(255,255,255,.6);font-size:.63rem;text-transform:uppercase}.npc-forge-spell-summary strong{color:#dcfff9;font-size:.92rem}.npc-forge-spell-selection-notice{margin-top:7px;padding:7px 9px;border:1px solid rgba(246,190,90,.28);border-radius:8px;color:#ffe0a0;background:rgba(246,190,90,.07);font-size:.72rem;line-height:1.45}.npc-forge-spell-fixed,.npc-forge-spell-access-note{display:grid;gap:3px;margin-top:10px;padding:8px 10px;border:1px solid rgba(168,108,255,.25);border-radius:9px;background:rgba(126,72,199,.07)}.npc-forge-spell-fixed strong,.npc-forge-spell-access-note strong{color:#eadfff;font-size:.72rem}.npc-forge-spell-fixed span,.npc-forge-spell-access-note span{color:#fff;font-size:.76rem}.npc-forge-spell-access-note small{color:rgba(255,255,255,.6);font-size:.66rem}.npc-forge-spell-toolbar{display:flex;gap:7px;margin:10px 0}.npc-forge-spell-toolbar input{flex:1;font-size:.8rem}.npc-forge-spell-toolbar button{padding:6px 9px;border:1px solid rgba(255,255,255,.12);border-radius:7px;color:#fff;background:rgba(255,255,255,.04);font-size:.72rem}.npc-forge-spell-toolbar button.is-active{border-color:#a86cff;background:rgba(126,72,199,.17)}.npc-forge-spell-catalogue-workspace{grid-template-columns:minmax(470px,.98fr) minmax(430px,1.02fr);margin-top:0}.npc-forge-spell-catalogue{overflow:hidden}.npc-forge-spell-table-head,.npc-forge-spell-table-row{display:grid!important;grid-template-columns:minmax(145px,1.55fr) 68px minmax(82px,.9fr) 92px 88px;gap:8px;align-items:center}.npc-forge-spell-table-head{position:sticky;top:0;z-index:3;padding:0 9px;border-bottom:1px solid rgba(168,108,255,.22);background:rgba(12,10,20,.98)}.npc-forge-spell-table-head>button{display:flex;align-items:center;justify-content:space-between;gap:4px;min-width:0;padding:7px 2px;border:0;color:rgba(255,255,255,.62);background:transparent;font-size:.6rem;font-weight:850;letter-spacing:.04em;text-align:left;text-transform:uppercase}.npc-forge-spell-table-head>button.is-sorted{color:#e3ceff}.npc-forge-spell-table-head>button em{color:rgba(168,108,255,.75);font-size:.48rem;font-style:normal}.npc-forge-spell-catalogue__list{max-height:min(56vh,620px);overflow:auto}.npc-forge-spell-table-row{min-height:37px!important;padding:6px 9px!important}.npc-forge-spell-table-row>span{min-width:0;overflow:hidden;color:rgba(255,255,255,.69);font-size:.64rem;line-height:1.15;text-overflow:ellipsis;white-space:nowrap}.npc-forge-spell-table-row .profile-catalogue__row-name{display:flex;align-items:center;gap:5px;color:#fff;font-size:.75rem;font-weight:800}.npc-forge-spell-table-row .profile-catalogue__row-name small{flex:0 0 auto;color:#cdb5ff;font-size:.48rem;font-weight:900;letter-spacing:.04em}.npc-forge-spell-row-status{justify-self:start;padding:2px 6px;border:1px solid rgba(255,255,255,.1);border-radius:999px;font-size:.55rem!important;font-weight:800}.npc-forge-spell-row-status.is-selected{border-color:rgba(88,214,199,.34);color:#bafff4!important;background:rgba(88,214,199,.08)}.npc-forge-spell-row-status.is-prepared{border-color:rgba(246,190,90,.42);color:#ffe0a0!important;background:rgba(246,190,90,.08)}.npc-forge-spell-row-status.is-full{color:rgba(255,255,255,.45)!important}.npc-forge-spell-preview{display:grid;align-content:start;gap:7px}.npc-forge-spell-preview>.npc-card-title{margin:0;color:#fff;font-size:.86rem;font-weight:800}.npc-forge-spell-card-select{padding:5px 9px;border:1px solid rgba(88,214,199,.48);border-radius:7px;color:#d8fff9;background:rgba(88,214,199,.1);font-size:.64rem;font-weight:900;letter-spacing:.02em}.npc-forge-spell-card-select:hover:not(:disabled){border-color:#58d6c7;background:rgba(88,214,199,.17)}.npc-forge-spell-card-select.is-selected{border-color:rgba(255,143,122,.48);color:#ffd9d2;background:rgba(255,143,122,.09)}.npc-forge-spell-card-select:disabled{cursor:not-allowed;opacity:.48}.npc-forge-spell-preview__actions{display:flex;flex-wrap:wrap;gap:7px;padding-top:7px;border-top:1px solid rgba(255,255,255,.09)}.npc-forge-spell-preview__actions button{padding:6px 9px;border:1px solid rgba(168,108,255,.42);border-radius:8px;color:#fff;background:rgba(126,72,199,.16);font-size:.68rem}.npc-forge-spell-preview__actions button.is-prepared{border-color:rgba(88,214,199,.46);color:#bafff4;background:rgba(88,214,199,.09)}.npc-forge-spell-validation{margin-top:10px;padding:8px 10px;border-radius:8px;font-size:.72rem;line-height:1.42}.npc-forge-spell-validation.is-complete{color:#bafff4;background:rgba(88,214,199,.08)}.npc-forge-spell-validation.is-incomplete{color:#ffe0a0;background:rgba(246,190,90,.08)}@media(max-width:1180px){.npc-forge-spell-catalogue-workspace{grid-template-columns:minmax(420px,.94fr) minmax(380px,1.06fr)}.npc-forge-spell-table-head,.npc-forge-spell-table-row{grid-template-columns:minmax(130px,1.45fr) 62px minmax(74px,.8fr) 80px 78px;gap:6px}}@media(max-width:900px){.npc-forge-spell-catalogue-workspace{grid-template-columns:1fr}.npc-forge-spell-preview{position:static}.npc-forge-spell-table-head,.npc-forge-spell-table-row{grid-template-columns:minmax(145px,1.55fr) 68px minmax(82px,.9fr) 92px 88px}}@media(max-width:720px){.npc-forge-source-magic>header{align-items:stretch;flex-direction:column}.npc-forge-spell-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.npc-forge-spell-table-head,.npc-forge-spell-table-row{grid-template-columns:minmax(130px,1.4fr) 62px minmax(78px,.85fr) 74px}.npc-forge-spell-table-head>button:nth-child(4),.npc-forge-spell-table-row>span:nth-child(4){display:none}}
    `}</style>
  </div>;
}

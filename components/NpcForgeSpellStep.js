import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { countStartingSpellSelections, preferSpellRows, startingSpellSelectionModel, validateStartingSpellSelections } from "../utils/playerForgeRules";
import { spellAllowedForStartingModel, startingSpellSourceForRow, subclassStartingSpellSelectionModel } from "../utils/playerForgeSpellSources";
import { automaticCastingAbilityLabel, bestEligibleCastingAbility } from "../utils/playerForgeAutomaticCasting";
import { sourceChoiceGroupComplete } from "../utils/playerForgeSourceChoices";
import NpcForgeClassFeatureChoices from "./NpcForgeClassFeatureChoices";
import NpcForgeSourceChoiceFields from "./NpcForgeSourceChoiceFields";
import SpellCard from "./SpellCard";
import { useNpcForgeClassChoice } from "./NpcForgeClassChoiceContext";
import { sourceChoiceGroupsForResolverPlacement, useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";

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
function automaticAbilitiesForGroup(group = {}) {
  const groupAllowed = group.metadata?.allowedCastingAbilities;
  if (Array.isArray(groupAllowed) && groupAllowed.length) return groupAllowed;
  for (const field of group.fields || []) {
    if (Array.isArray(field.metadata?.allowedCastingAbilities) && field.metadata.allowedCastingAbilities.length) return field.metadata.allowedCastingAbilities;
  }
  return [];
}
function automaticCastingForGroup(group = {}, abilities = {}, selectedClass = null) {
  const allowed = automaticAbilitiesForGroup(group);
  if (!allowed.length) return null;
  return bestEligibleCastingAbility(abilities, allowed, selectedClass?.spellcasting_ability || "");
}

export default function NpcForgeSpellStep({ selectedClass, selectedSubclass = null, level = 1, selections = {}, expandedSpellNames = [], finalAbilities = {}, onChange, onModelChange, onSpellRowsChange }) {
  const { state: classChoiceState, toggleFeatureOption } = useNpcForgeClassChoice();
  const { state: sourceChoiceState } = useNpcForgeSourceChoices();
  const [levelRow, setLevelRow] = useState(null);
  const [spells, setSpells] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [inspectedSpellId, setInspectedSpellId] = useState("");
  const subclassModel = useMemo(() => subclassStartingSpellSelectionModel(selectedClass, selectedSubclass, level), [level, selectedClass, selectedSubclass]);
  const model = useMemo(() => subclassModel || startingSpellSelectionModel(selectedClass, levelRow, level), [level, levelRow, selectedClass, subclassModel]);
  const hasClassSpellSelection = Boolean(selectedClass && model.mode !== "none");
  const sourceSpellGroups = useMemo(() => sourceChoiceGroupsForResolverPlacement(sourceChoiceState, "spells"), [sourceChoiceState]);
  const incompleteSourceSpellGroups = useMemo(() => sourceSpellGroups.filter((group) => !sourceChoiceGroupComplete(group, sourceChoiceState.selections || {})), [sourceChoiceState.selections, sourceSpellGroups]);
  const automaticCastingGroups = useMemo(() => sourceSpellGroups.map((group) => ({ group, result: automaticCastingForGroup(group, finalAbilities, selectedClass) })).filter((entry) => entry.result), [finalAbilities, selectedClass, sourceSpellGroups]);
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
      .select("id,spell_key,name,source,page,level,school,school_code,classes,casting_time,range_text,duration_text,ritual,concentration,components_v,components_s,components_m,material_text,description,higher_level_text,area_type,area_size,area_unit,saving_throw_abilities,attack_type,damage_dice,damage_types")
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
  const filteredSpells = useMemo(() => selectableSpells.filter((spell) => {
    if (selectedOnly && !selections?.[spell.id]) return false;
    const needle = query.trim().toLowerCase();
    return !needle || [spell.name, spell.school, spell.description, ...(spell.classes || [])].filter(Boolean).join(" ").toLowerCase().includes(needle);
  }), [query, selectableSpells, selectedOnly, selections]);
  const groups = useMemo(() => groupByLevel(filteredSpells), [filteredSpells]);
  const inspectedSpell = useMemo(
    () => filteredSpells.find((spell) => String(spell.id) === String(inspectedSpellId)) || filteredSpells[0] || null,
    [filteredSpells, inspectedSpellId]
  );

  useEffect(() => {
    if (!filteredSpells.length) {
      if (inspectedSpellId) setInspectedSpellId("");
      return;
    }
    if (filteredSpells.some((spell) => String(spell.id) === String(inspectedSpellId))) return;
    const selectedMatch = filteredSpells.find((spell) => Boolean(selections?.[spell.id]));
    setInspectedSpellId(String(selectedMatch?.id || filteredSpells[0].id));
  }, [filteredSpells, inspectedSpellId, selections]);

  function toggleSpell(spell) {
    if (!hasClassSpellSelection) return;
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

  const classSourceLabel = hasClassSpellSelection ? model.sourceLabel || `${selectedClass?.class_name || "Class"} spellcasting` : "Source-owned magic";
  const hasAnyMagic = hasClassSpellSelection || sourceSpellGroups.length || spellPlacementGroups.length;

  return <div className="npc-forge-section npc-forge-spell-step">
    <div className="npc-forge-section-heading"><div><span>Spells</span><h3>{classSourceLabel}</h3></div><p>{loading ? "Loading canonical spell catalogue…" : hasClassSpellSelection ? `${selectableSpells.length} eligible class spells • highest spell level ${model.maximumSpellLevel}` : hasAnyMagic ? "Resolve species, feat, background, and class-feature magic below." : "This character has no starting spell decisions at this level."}</p></div>
    {error ? <div className="npc-forge-catalog-warning">{error}</div> : null}

    {sourceSpellGroups.length ? <section className="npc-forge-source-magic"><header><div><span>Source-owned magic</span><h3>Species, feat, and feature spells</h3></div><p>These grants are separate from normal class spell selection and keep their own source provenance.</p></header>{automaticCastingGroups.length ? <div className="npc-forge-auto-casting-list">{automaticCastingGroups.map(({ group, result }) => <div key={group.id}><span>{group.label}</span><strong>{automaticCastingAbilityLabel(result)}</strong><small>Automatically selected from {automaticAbilitiesForGroup(group).map((key) => key.toUpperCase()).join(" / ")} using final ability scores.</small></div>)}</div> : null}<NpcForgeSourceChoiceFields placement="spells" inline groupsOverride={sourceSpellGroups} title="Resolve source-owned spell choices" /></section> : null}

    {hasClassSpellSelection ? <>
      <div className="npc-forge-spell-summary"><div><span>Cantrips</span><strong>{counts.cantrips}/{model.cantrips}</strong></div><div><span>{model.mode === "spellbook" ? "Spellbook" : model.mode === "prepared" ? "Prepared" : "Known spells"}</span><strong>{counts.leveled}/{model.leveled}</strong></div>{model.mode === "spellbook" ? <div><span>Prepared leveled</span><strong>{Math.max(0, counts.prepared - counts.cantrips)}/{model.prepared}</strong></div> : null}<div><span>Highest spell level</span><strong>{model.maximumSpellLevel}</strong></div></div>
      {model.fixedSpells?.length ? <div className="npc-forge-spell-fixed"><strong>Automatic from {classSourceLabel}</strong><span>{model.fixedSpells.map((spell) => spell.name).join(", ")}</span></div> : null}
      {savantSpellIds.size ? <div className="npc-forge-spell-access-note"><strong>Savant spellbook additions</strong><span>{savantSpellIds.size} source-owned spell{savantSpellIds.size === 1 ? "" : "s"} already added through class progression.</span><small>Those free Savant additions are kept separate from the Wizard's normal spellbook choices and cannot be selected twice.</small></div> : null}
      {expandedSpellNames?.length && model.sourceType !== "subclass" ? <div className="npc-forge-spell-access-note"><strong>Background-expanded access</strong><span>{expandedSpellNames.join(", ")}</span><small>These spells join the selected class list; they are not automatically known or prepared.</small></div> : null}
      <div className="npc-forge-spell-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search spell name, school, class, or rules text…" /><button type="button" className={selectedOnly ? "is-active" : ""} onClick={() => setSelectedOnly((value) => !value)}>Selected only</button></div>
      <div className="npc-forge-spell-catalogue-workspace profile-catalogue-workspace">
        <section className="profile-catalogue npc-forge-spell-catalogue" aria-label="Eligible starting spells">
          <div className="profile-catalogue__list npc-forge-spell-catalogue__list">
            {groups.map(([spellLevel, rows]) => <section key={spellLevel} className="npc-forge-spell-catalogue-level">
              <header><strong>{levelLabel(spellLevel)}</strong><span>{rows.length}</span></header>
              {rows.map((spell) => {
                const selected = Boolean(selections?.[spell.id]);
                const prepared = Boolean(selections?.[spell.id]?.prepared);
                const inspected = String(inspectedSpell?.id || "") === String(spell.id);
                const expanded = expandedSpellNames.some((name) => name.toLowerCase() === spell.name.toLowerCase());
                return <button key={spell.id} type="button" aria-pressed={inspected} className={`profile-catalogue__row ${inspected ? "active" : ""}`} onClick={() => setInspectedSpellId(String(spell.id))}>
                  <span className="profile-catalogue__row-name">{spell.name}</span>
                  <span className="profile-catalogue__row-meta">{Number(spell.level || 0) === 0 ? "Cantrip" : `Level ${spell.level}`} • {spell.school || spell.school_code || "Spell"} • {spell.source}</span>
                  <span className="profile-catalogue__tags">
                    {spell.concentration ? <span>Concentration</span> : null}
                    {spell.ritual ? <span>Ritual</span> : null}
                    {expanded ? <span>Background access</span> : null}
                    {prepared ? <span className="is-prepared">Prepared</span> : null}
                    {selected ? <span className="is-known">Selected</span> : <span>Available</span>}
                  </span>
                </button>;
              })}
            </section>)}
            {!filteredSpells.length ? <div className="profile-catalogue__empty">No eligible spells match these filters.</div> : null}
          </div>
        </section>
        <section className="profile-catalogue__preview npc-forge-spell-preview" aria-label="Selected spell details">
          <div className="npc-card-title">Spell Details</div>
          {inspectedSpell ? <>
            <SpellCard
              spell={inspectedSpell}
              compact
              headerAction={<button type="button" className={`npc-forge-spell-card-select ${selections?.[inspectedSpell.id] ? "is-selected" : ""}`} onClick={() => toggleSpell(inspectedSpell)}>{selections?.[inspectedSpell.id] ? "Remove" : "Select"}</button>}
            />
            {selections?.[inspectedSpell.id] && model.mode === "spellbook" && Number(inspectedSpell.level) > 0 ? <div className="npc-forge-spell-preview__actions"><button type="button" className={selections?.[inspectedSpell.id]?.prepared ? "is-prepared" : ""} onClick={() => togglePrepared(inspectedSpell)}>{selections?.[inspectedSpell.id]?.prepared ? "Prepared" : "Spellbook only"}</button></div> : null}
          </> : <div className="profile-catalogue__empty">Select a spell from the catalogue to inspect its card.</div>}
        </section>
      </div>
    </> : <div className="npc-forge-workspace-note">No base-class spell catalogue selection is required. Source-owned spells above still become part of the character's Known spell authority.</div>}

    {spellPlacementGroups.length ? <NpcForgeClassFeatureChoices groups={spellPlacementGroups} selections={classChoiceState?.featureSelections || {}} level={level} placement="spells" onToggle={toggleFeatureOption} heading="Finish spellbook-dependent class choices" description="These choices are permanent, but their eligible options come from the spellbook you are building on this step." /> : null}
    <div className={`npc-forge-spell-validation ${validation.length || incompleteSourceSpellGroups.length ? "is-incomplete" : "is-complete"}`}>{validation.length ? validation.join(" ") : incompleteSourceSpellGroups.length ? `Complete ${incompleteSourceSpellGroups.length} source-owned spell choice${incompleteSourceSpellGroups.length === 1 ? "" : "s"} above: ${incompleteSourceSpellGroups.map((group) => group.label).join(", ")}.` : "Starting spell requirements complete."}</div>
    <style jsx global>{`
      .npc-forge-source-magic{display:grid;gap:10px;margin-bottom:16px;padding:14px;border:1px solid rgba(168,108,255,.32);border-radius:13px;background:linear-gradient(145deg,rgba(26,18,41,.82),rgba(10,20,27,.85))}.npc-forge-source-magic>header{display:flex;align-items:end;justify-content:space-between;gap:14px}.npc-forge-source-magic>header span{color:#d7bfff;font-size:.59rem;font-weight:900;text-transform:uppercase}.npc-forge-source-magic>header h3{margin:2px 0 0;color:#fff;font-size:.9rem}.npc-forge-source-magic>header p{max-width:420px;margin:0;color:rgba(255,255,255,.6);font-size:.66rem;line-height:1.45}.npc-forge-auto-casting-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:7px}.npc-forge-auto-casting-list>div{display:grid;gap:2px;padding:9px 10px;border:1px solid rgba(88,214,199,.24);border-radius:8px;background:rgba(88,214,199,.055)}.npc-forge-auto-casting-list span{color:rgba(255,255,255,.52);font-size:.57rem;text-transform:uppercase}.npc-forge-auto-casting-list strong{color:#d8fff9;font-size:.74rem}.npc-forge-auto-casting-list small{color:rgba(255,255,255,.48);font-size:.57rem;line-height:1.4}.npc-forge-spell-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.npc-forge-spell-summary>div{display:grid;gap:2px;padding:9px 10px;border:1px solid rgba(88,214,199,.22);border-radius:9px;background:rgba(88,214,199,.055)}.npc-forge-spell-summary span{color:rgba(255,255,255,.55);font-size:.58rem;text-transform:uppercase}.npc-forge-spell-summary strong{color:#dcfff9}.npc-forge-spell-fixed,.npc-forge-spell-access-note{display:grid;gap:3px;margin-top:10px;padding:9px 11px;border:1px solid rgba(168,108,255,.25);border-radius:9px;background:rgba(126,72,199,.07)}.npc-forge-spell-fixed strong,.npc-forge-spell-access-note strong{color:#eadfff;font-size:.68rem}.npc-forge-spell-fixed span,.npc-forge-spell-access-note span{color:#fff;font-size:.72rem}.npc-forge-spell-access-note small{color:rgba(255,255,255,.5);font-size:.61rem}.npc-forge-spell-toolbar{display:flex;gap:7px;margin:11px 0}.npc-forge-spell-toolbar input{flex:1}.npc-forge-spell-toolbar button{padding:6px 9px;border:1px solid rgba(255,255,255,.12);border-radius:7px;color:#fff;background:rgba(255,255,255,.04)}.npc-forge-spell-toolbar button.is-active{border-color:#a86cff;background:rgba(126,72,199,.17)}.npc-forge-spell-catalogue-workspace{margin-top:0}.npc-forge-spell-catalogue__list{max-height:min(56vh,620px)}.npc-forge-spell-catalogue-level>header{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:10px;padding:6px 10px;border-bottom:1px solid rgba(168,108,255,.18);color:#d7bfff;background:rgba(12,10,20,.97);font-size:.68rem}.npc-forge-spell-catalogue-level+.npc-forge-spell-catalogue-level>header{border-top:1px solid rgba(168,108,255,.2)}.npc-forge-spell-preview{display:grid;align-content:start;gap:9px}.npc-forge-spell-preview>.npc-card-title{margin:0;color:#fff;font-weight:800}.npc-forge-spell-card-select{padding:5px 9px;border:1px solid rgba(88,214,199,.48);border-radius:7px;color:#d8fff9;background:rgba(88,214,199,.1);font-size:.61rem;font-weight:900;letter-spacing:.02em}.npc-forge-spell-card-select:hover{border-color:#58d6c7;background:rgba(88,214,199,.17)}.npc-forge-spell-card-select.is-selected{border-color:rgba(255,143,122,.48);color:#ffd9d2;background:rgba(255,143,122,.09)}.npc-forge-spell-preview__actions{display:flex;flex-wrap:wrap;gap:7px;padding-top:9px;border-top:1px solid rgba(255,255,255,.09)}.npc-forge-spell-preview__actions button{padding:7px 10px;border:1px solid rgba(168,108,255,.42);border-radius:8px;color:#fff;background:rgba(126,72,199,.16);font-size:.66rem}.npc-forge-spell-preview__actions button.is-prepared{border-color:rgba(88,214,199,.46);color:#bafff4;background:rgba(88,214,199,.09)}.npc-forge-spell-validation{margin-top:10px;padding:8px 10px;border-radius:8px;font-size:.68rem}.npc-forge-spell-validation.is-complete{color:#bafff4;background:rgba(88,214,199,.08)}.npc-forge-spell-validation.is-incomplete{color:#ffe0a0;background:rgba(246,190,90,.08)}@media(max-width:900px){.npc-forge-spell-catalogue-workspace{grid-template-columns:1fr}.npc-forge-spell-preview{position:static}}@media(max-width:720px){.npc-forge-source-magic>header{align-items:stretch;flex-direction:column}.npc-forge-spell-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `}</style>
  </div>;
}

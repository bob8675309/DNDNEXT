import { useEffect, useMemo, useState } from "react";
import useSubclassCatalog from "../hooks/useSubclassCatalog";
import { supabase } from "../utils/supabaseClient";
import { spellLevelLabel, spellMatchesClass } from "../utils/spells/classSpellbookRules";
import { spellMatchesExpandedList } from "../utils/backgroundMechanics";
import { buildRuntimeAdvancementChoiceModel } from "../utils/characterLevelUpPlan";
import {
  setSourceChoiceSelection,
  sourceChoiceGroupsComplete,
  toggleSourceChoiceSelection,
} from "../utils/playerForgeSourceChoices";
import SourceChoiceFields from "./SourceChoiceFields";

function safeText(value) {
  return String(value ?? "").trim();
}

function requiredChoice(review, key) {
  const choices = Array.isArray(review?.preview?.choices) ? review.preview.choices : [];
  return choices.find((choice) => choice?.key === key) || null;
}

function sortSpells(a, b) {
  return Number(a?.level || 0) - Number(b?.level || 0)
    || safeText(a?.name).localeCompare(safeText(b?.name));
}

function selectionCounts(spells, selected) {
  let cantrips = 0;
  let leveled = 0;
  for (const spell of spells) {
    if (!selected[spell.id]) continue;
    if (Number(spell.level || 0) === 0) cantrips += 1;
    else leveled += 1;
  }
  return { cantrips, leveled };
}

function uniqueText(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(safeText).filter(Boolean))];
}

export default function CharacterLevelUpChoices({ character = null, review = null, onCompleted = null }) {
  const characterId = character?.id || null;
  const preview = review?.preview || {};
  const metadataReady = Boolean(review?.metadataReady && review?.canComplete);
  const spellChoice = requiredChoice(review, "spell_choices");
  const subclassChoice = requiredChoice(review, "subclass_name");
  const advancementChoice = requiredChoice(review, "advancement");
  const requiredCantrips = Number(spellChoice?.cantrips || preview?.newCantrips || 0);
  const requiredLeveled = Number(spellChoice?.leveled || preview?.newLeveledSpells || 0);
  const highestSpellLevel = Number(spellChoice?.highestSpellLevel || preview?.highestSpellLevel || 0);

  const [hpMethod, setHpMethod] = useState("fixed");
  const [subclassOptionKey, setSubclassOptionKey] = useState("");
  const [catalogSpells, setCatalogSpells] = useState([]);
  const [assignedClassSpellIds, setAssignedClassSpellIds] = useState(() => new Set());
  const [toolRows, setToolRows] = useState([]);
  const [backgroundExpandedSpells, setBackgroundExpandedSpells] = useState([]);
  const [selectedSpells, setSelectedSpells] = useState({});
  const [spellQuery, setSpellQuery] = useState("");
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [advancement, setAdvancement] = useState(null);
  const [loadingAdvancement, setLoadingAdvancement] = useState(false);
  const [advancementError, setAdvancementError] = useState("");
  const [sourceSelections, setSourceSelections] = useState({});
  const [classChoiceGroups, setClassChoiceGroups] = useState([]);
  const [classChoiceSelections, setClassChoiceSelections] = useState({});
  const [loadingClassChoices, setLoadingClassChoices] = useState(false);
  const [classChoiceError, setClassChoiceError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { options: subclassOptions, loading: loadingSubclasses, error: subclassError } = useSubclassCatalog(
    preview?.classKey,
    preview?.source || "XPHB",
    Boolean(metadataReady && subclassChoice)
  );
  const selectedSubclass = useMemo(
    () => subclassOptions.find((option) => option.key === subclassOptionKey) || null,
    [subclassOptionKey, subclassOptions]
  );

  const classSpellCatalog = useMemo(
    () => catalogSpells.filter((spell) => !assignedClassSpellIds.has(spell.id)),
    [assignedClassSpellIds, catalogSpells]
  );
  const counts = useMemo(() => selectionCounts(classSpellCatalog, selectedSpells), [classSpellCatalog, selectedSpells]);
  const classChoicesComplete = useMemo(
    () => sourceChoiceGroupsComplete(classChoiceGroups, classChoiceSelections),
    [classChoiceGroups, classChoiceSelections]
  );

  const eligibleSpells = useMemo(() => classSpellCatalog
    .filter((spell) => spellMatchesClass(spell, preview?.classKey) || spellMatchesExpandedList(spell, backgroundExpandedSpells))
    .filter((spell) => Number(spell.level || 0) === 0 || Number(spell.level || 0) <= highestSpellLevel)
    .filter((spell) => {
      const q = safeText(spellQuery).toLowerCase();
      if (!q) return true;
      return [spell.name, spell.school, spell.description, spell.source].filter(Boolean).join(" ").toLowerCase().includes(q);
    })
    .sort(sortSpells), [backgroundExpandedSpells, classSpellCatalog, highestSpellLevel, preview?.classKey, spellQuery]);

  const advancementModel = useMemo(() => buildRuntimeAdvancementChoiceModel({
    classKey: preview?.classKey || "class",
    toLevel: Number(preview?.toLevel || 1),
    advancement,
    selections: sourceSelections,
    toolRows,
    spells: catalogSpells,
  }), [advancement, catalogSpells, preview?.classKey, preview?.toLevel, sourceSelections, toolRows]);

  useEffect(() => {
    setHpMethod("fixed");
    setSubclassOptionKey("");
    setSelectedSpells({});
    setBackgroundExpandedSpells([]);
    setSpellQuery("");
    setAdvancement(null);
    setAdvancementError("");
    setSourceSelections({});
    setClassChoiceGroups([]);
    setClassChoiceSelections({});
    setClassChoiceError("");
    setError("");
  }, [review?.session?.id]);

  useEffect(() => {
    if (!subclassChoice || !subclassOptions.length) return;
    if (subclassOptions.some((option) => option.key === subclassOptionKey)) return;
    setSubclassOptionKey(subclassOptions[0].key);
  }, [subclassChoice, subclassOptionKey, subclassOptions]);

  useEffect(() => {
    let active = true;
    async function loadAdvancement() {
      if (!metadataReady || !characterId || !advancementChoice) {
        setAdvancement(null);
        setAdvancementError("");
        return;
      }
      setLoadingAdvancement(true);
      setAdvancementError("");
      const { data, error: loadError } = await supabase.rpc("get_character_level_advancement_options_v1", {
        p_character_id: characterId,
      });
      if (!active) return;
      if (loadError) {
        setAdvancement(null);
        setAdvancementError(loadError.message || "Could not load source-legal advancement options.");
      } else {
        setAdvancement(data || null);
      }
      setLoadingAdvancement(false);
    }
    loadAdvancement();
    return () => { active = false; };
  }, [advancementChoice, characterId, metadataReady, review?.session?.id]);

  useEffect(() => {
    let active = true;
    async function loadClassChoices() {
      if (!metadataReady || !characterId) {
        setClassChoiceGroups([]);
        setClassChoiceSelections({});
        setClassChoiceError("");
        return;
      }
      setLoadingClassChoices(true);
      setClassChoiceError("");
      const { data, error: loadError } = await supabase.rpc("get_character_level_class_choice_options_v1", {
        p_character_id: characterId,
      });
      if (!active) return;
      if (loadError) {
        setClassChoiceGroups([]);
        setClassChoiceSelections({});
        setClassChoiceError(loadError.message || "Could not load source-legal class choices for this level.");
      } else {
        setClassChoiceGroups(Array.isArray(data?.groups) ? data.groups : []);
        setClassChoiceSelections({});
      }
      setLoadingClassChoices(false);
    }
    loadClassChoices();
    return () => { active = false; };
  }, [characterId, metadataReady, review?.session?.id]);

  useEffect(() => {
    let active = true;
    async function loadChoiceCatalogs() {
      const needsCatalogs = Boolean(metadataReady && characterId && (advancementChoice || requiredCantrips || requiredLeveled));
      if (!needsCatalogs) {
        setCatalogSpells([]);
        setAssignedClassSpellIds(new Set());
        setToolRows([]);
        setBackgroundExpandedSpells([]);
        return;
      }
      setLoadingCatalogs(true);
      const [catalogResult, assignmentResult, sheetResult, toolsResult] = await Promise.all([
        supabase
          .from("spells_catalog_preferred")
          .select("id,spell_key,name,source,level,school,school_code,classes,ritual,casting_time,description")
          .order("level", { ascending: true })
          .order("name", { ascending: true })
          .limit(5000),
        supabase.from("character_spells").select("spell_id,source_type").eq("character_id", characterId),
        supabase.from("character_sheets").select("sheet").eq("character_id", characterId).maybeSingle(),
        supabase
          .from("items_catalog")
          .select("item_name,item_key,item_type,item_rarity,payload")
          .eq("item_rarity", "mundane")
          .in("item_type", ["Tools", "Instrument"])
          .order("item_name", { ascending: true })
          .limit(2000),
      ]);
      if (!active) return;
      const loadError = catalogResult.error || assignmentResult.error || sheetResult.error || toolsResult.error;
      if (loadError) {
        setError(loadError.message || "Could not load level-up choice catalogues.");
        setCatalogSpells([]);
        setAssignedClassSpellIds(new Set());
        setToolRows([]);
        setBackgroundExpandedSpells([]);
      } else {
        setCatalogSpells(catalogResult.data || []);
        setAssignedClassSpellIds(new Set((assignmentResult.data || []).filter((row) => row.source_type === "class").map((row) => row.spell_id)));
        setToolRows(toolsResult.data || []);
        const sheet = sheetResult.data?.sheet || {};
        const meta = sheet?.meta || {};
        setBackgroundExpandedSpells(uniqueText([
          ...(Array.isArray(sheet.backgroundExpandedSpells) ? sheet.backgroundExpandedSpells : []),
          ...(Array.isArray(sheet?.spellcasting?.backgroundExpandedSpells) ? sheet.spellcasting.backgroundExpandedSpells : []),
          ...(Array.isArray(meta.backgroundExpandedSpells) ? meta.backgroundExpandedSpells : []),
        ]));
      }
      setLoadingCatalogs(false);
    }
    loadChoiceCatalogs();
    return () => { active = false; };
  }, [advancementChoice, characterId, metadataReady, requiredCantrips, requiredLeveled, review?.session?.id]);

  function toggleAdvancementChoice(groupId, fieldId, optionKey) {
    setSourceSelections((current) => toggleSourceChoiceSelection(advancementModel.groups, current, groupId, fieldId, optionKey));
    setError("");
  }

  function setAdvancementChoice(groupId, fieldId, optionKeys) {
    setSourceSelections((current) => setSourceChoiceSelection(advancementModel.groups, current, groupId, fieldId, optionKeys));
    setError("");
  }

  function toggleClassChoice(groupId, fieldId, optionKey) {
    setClassChoiceSelections((current) => toggleSourceChoiceSelection(classChoiceGroups, current, groupId, fieldId, optionKey));
    setError("");
  }

  function setClassChoice(groupId, fieldId, optionKeys) {
    setClassChoiceSelections((current) => setSourceChoiceSelection(classChoiceGroups, current, groupId, fieldId, optionKeys));
    setError("");
  }

  function toggleSpell(spell) {
    setSelectedSpells((current) => {
      if (current[spell.id]) {
        const next = { ...current };
        delete next[spell.id];
        return next;
      }
      const isCantrip = Number(spell.level || 0) === 0;
      if (isCantrip && counts.cantrips >= requiredCantrips) return current;
      if (!isCantrip && counts.leveled >= requiredLeveled) return current;
      return { ...current, [spell.id]: { prepared: true } };
    });
    setError("");
  }

  function togglePrepared(spellId) {
    setSelectedSpells((current) => {
      const selected = current[spellId];
      if (!selected) return current;
      return { ...current, [spellId]: { ...selected, prepared: !selected.prepared } };
    });
  }

  function validate() {
    if (!metadataReady) return review?.message || preview?.blockedReason || "This level cannot be applied yet.";
    if (!hpMethod) return "Choose a hit point method.";
    if (subclassChoice && loadingSubclasses) return "Wait for the source-backed subclass list to finish loading.";
    if (subclassChoice && subclassError) return subclassError;
    if (subclassChoice && !selectedSubclass) return "Choose a source-backed subclass.";
    if ((advancementChoice || requiredCantrips || requiredLeveled) && loadingCatalogs) return "Wait for the source catalogues to finish loading.";
    if (advancementChoice && loadingAdvancement) return "Wait for server-validated advancement options to finish loading.";
    if (advancementChoice && advancementError) return advancementError;
    if (advancementChoice && !advancement?.required) return "The server did not return the required advancement options for this level.";
    if (advancementChoice && !advancementModel.complete) return "Complete every source-owned feat or Epic Boon choice for this level.";
    if (advancementChoice && !advancementModel.instance) return "Choose the feat or Epic Boon gained at this level.";
    if (loadingClassChoices) return "Wait for source-backed class choices to finish loading.";
    if (classChoiceError) return classChoiceError;
    if (classChoiceGroups.length && !classChoicesComplete) return "Complete every permanent class choice gained at this level.";
    if (counts.cantrips !== requiredCantrips) return `Choose exactly ${requiredCantrips} new cantrip${requiredCantrips === 1 ? "" : "s"}.`;
    if (counts.leveled !== requiredLeveled) return `Choose exactly ${requiredLeveled} new leveled spell${requiredLeveled === 1 ? "" : "s"}.`;
    return "";
  }

  async function applyLevel() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError("");
    const spellChoices = classSpellCatalog
      .filter((spell) => selectedSpells[spell.id])
      .map((spell) => ({
        spell_id: spell.id,
        prepared: Number(spell.level || 0) === 0 ? true : Boolean(selectedSpells[spell.id]?.prepared),
      }));
    const selections = {
      hp_method: hpMethod,
      subclass_name: subclassChoice ? selectedSubclass?.name || null : null,
      subclass_source: subclassChoice ? selectedSubclass?.source || null : null,
      spell_choices: spellChoices,
      class_choice_selections: classChoiceSelections,
      ...(advancementChoice ? { advancement_instance: advancementModel.instance } : {}),
    };

    const { data, error: completeError } = await supabase.rpc("complete_character_level_up_v3", {
      p_character_id: characterId,
      p_selections: selections,
    });
    if (completeError) {
      setError(completeError.message || "Could not apply this level.");
    } else {
      await onCompleted?.(data || null);
    }
    setBusy(false);
  }

  if (!metadataReady) {
    return <div className="alert alert-warning py-2 mb-0">{review?.message || preview?.blockedReason || "This level contains choices that are not modeled yet."}</div>;
  }

  return (
    <div className="level-up-choice-form">
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {advancementError ? <div className="alert alert-danger py-2">{advancementError}</div> : null}
      {classChoiceError ? <div className="alert alert-danger py-2">{classChoiceError}</div> : null}

      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label small fw-semibold">Hit Point Increase</label>
          <select className="form-select form-select-sm" value={hpMethod} onChange={(event) => setHpMethod(event.target.value)}>
            <option value="fixed">Use the fixed average</option>
            <option value="roll">Roll the class Hit Die</option>
          </select>
        </div>

        {subclassChoice ? (
          <div className="col-12 col-md-6">
            <label className="form-label small fw-semibold">Subclass</label>
            <select className="form-select form-select-sm" value={subclassOptionKey} disabled={loadingSubclasses || !subclassOptions.length} onChange={(event) => setSubclassOptionKey(event.target.value)}>
              {loadingSubclasses ? <option value="">Loading subclasses…</option> : null}
              {!loadingSubclasses && !subclassOptions.length ? <option value="">No validated subclasses available</option> : null}
              {subclassOptions.map((option) => <option key={option.key} value={option.key}>{option.name} • {option.source}</option>)}
            </select>
            {selectedSubclass?.isLegacyCompatibility ? <div className="small text-muted mt-1">Published supplemental features will be aligned to the 2024 subclass entry level where needed.</div> : null}
            {subclassError ? <div className="small text-danger mt-1">{subclassError}</div> : null}
          </div>
        ) : null}

        {classChoiceGroups.length || loadingClassChoices ? (
          <div className="col-12">
            {loadingClassChoices ? <div className="small text-muted mb-2">Loading source-legal class choices…</div> : null}
            <SourceChoiceFields
              groups={classChoiceGroups}
              selections={classChoiceSelections}
              kicker="Class progression"
              title="Permanent choices gained at this level"
              onToggle={toggleClassChoice}
              onSet={setClassChoice}
            />
          </div>
        ) : null}

        {advancementChoice ? (
          <div className="col-12">
            {loadingAdvancement || loadingCatalogs ? <div className="small text-muted mb-2">Loading source-legal advancement choices…</div> : null}
            <SourceChoiceFields
              groups={advancementModel.groups}
              selections={advancementModel.selections}
              kicker="Level advancement"
              title={advancement?.kind === "epic-boon" ? "Epic Boon or qualifying General feat" : "Ability Score Improvement or qualifying General feat"}
              onToggle={toggleAdvancementChoice}
              onSet={setAdvancementChoice}
            />
          </div>
        ) : null}

        {requiredCantrips || requiredLeveled ? (
          <div className="col-12">
            <div className="d-flex align-items-end justify-content-between gap-2 flex-wrap mb-2">
              <div>
                <label className="form-label small fw-semibold mb-0">New Class Spells</label>
                <div className="small text-muted">{counts.cantrips}/{requiredCantrips} cantrips • {counts.leveled}/{requiredLeveled} leveled spells • up to level {highestSpellLevel}</div>
              </div>
              <input className="form-control form-control-sm level-up-spell-search" value={spellQuery} onChange={(event) => setSpellQuery(event.target.value)} placeholder="Search eligible spells…" />
            </div>
            {loadingCatalogs ? <div className="text-muted">Loading eligible spells from all sources…</div> : null}
            <div className="level-up-spell-list">
              {eligibleSpells.map((spell) => {
                const selected = selectedSpells[spell.id];
                const isCantrip = Number(spell.level || 0) === 0;
                return (
                  <div key={spell.id} className={`level-up-spell-row ${selected ? "selected" : ""}`}>
                    <button type="button" className="level-up-spell-main" onClick={() => toggleSpell(spell)}>
                      <strong>{spell.name}</strong>
                      <small>{spellLevelLabel(spell.level)} • {spell.school || "Spell"} • {spell.source}</small>
                    </button>
                    {selected && !isCantrip ? (
                      <label className="form-check form-switch mb-0" title="Prepared immediately">
                        <input className="form-check-input" type="checkbox" checked={!!selected.prepared} onChange={() => togglePrepared(spell.id)} />
                        <span className="form-check-label small">Prepared</span>
                      </label>
                    ) : selected ? <span className="badge text-bg-success">Selected</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <button type="button" className="btn btn-warning btn-sm mt-3" disabled={busy || loadingCatalogs || loadingAdvancement || loadingClassChoices} onClick={applyLevel}>{busy ? "Applying level…" : `Apply Level ${preview?.toLevel || ""}`}</button>
      <div className="small text-muted mt-2">XP unlocks this one level. HP, source-owned choices, spell grants, sheet values, and progression history are committed together or not at all. If the character still has enough XP afterward, the next level opens as a separate review against the newly updated character.</div>

      <style jsx>{`
        .level-up-spell-search { max-width:260px; }
        .level-up-spell-list { display:grid; gap:.4rem; max-height:38vh; overflow:auto; padding-right:.2rem; }
        .level-up-spell-row { display:flex; align-items:center; justify-content:space-between; gap:.55rem; padding:.5rem .6rem; border-radius:.65rem; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.035); }
        .level-up-spell-row.selected { border-color:rgba(245,190,75,.65); background:rgba(245,190,75,.1); }
        .level-up-spell-main { flex:1; min-width:0; display:grid; border:0; background:transparent; color:inherit; text-align:left; padding:0; }
        .level-up-spell-main small { color:rgba(255,255,255,.6); }
        @media (max-width:800px) { .level-up-spell-search { max-width:none; width:100%; } }
      `}</style>
    </div>
  );
}

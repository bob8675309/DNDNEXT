import { useEffect, useMemo, useState } from "react";
import useSubclassCatalog from "../hooks/useSubclassCatalog";
import { ABILITY_KEYS, ABILITY_LABELS, FEAT_OPTIONS } from "../utils/characterCreation";
import { supabase } from "../utils/supabaseClient";
import { spellLevelLabel, spellMatchesClass } from "../utils/spells/classSpellbookRules";
import { spellMatchesExpandedList } from "../utils/backgroundMechanics";

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
  const [advancementType, setAdvancementType] = useState("asi");
  const [abilityIncreases, setAbilityIncreases] = useState({});
  const [featName, setFeatName] = useState("");
  const [spells, setSpells] = useState([]);
  const [backgroundExpandedSpells, setBackgroundExpandedSpells] = useState([]);
  const [selectedSpells, setSelectedSpells] = useState({});
  const [spellQuery, setSpellQuery] = useState("");
  const [loadingSpells, setLoadingSpells] = useState(false);
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

  const generalFeats = useMemo(() => FEAT_OPTIONS
    .filter((feat) => feat.category === "General" && safeText(feat.name) !== "Ability Score Improvement")
    .map((feat) => feat.name), []);

  const counts = useMemo(() => selectionCounts(spells, selectedSpells), [selectedSpells, spells]);
  const totalAbilityIncrease = useMemo(
    () => Object.values(abilityIncreases).reduce((total, value) => total + Number(value || 0), 0),
    [abilityIncreases]
  );

  const eligibleSpells = useMemo(() => spells
    .filter((spell) => spellMatchesClass(spell, preview?.classKey) || spellMatchesExpandedList(spell, backgroundExpandedSpells))
    .filter((spell) => Number(spell.level || 0) === 0 || Number(spell.level || 0) <= highestSpellLevel)
    .filter((spell) => {
      const q = safeText(spellQuery).toLowerCase();
      if (!q) return true;
      return [spell.name, spell.school, spell.description, spell.source].filter(Boolean).join(" ").toLowerCase().includes(q);
    })
    .sort(sortSpells), [backgroundExpandedSpells, highestSpellLevel, preview?.classKey, spellQuery, spells]);

  useEffect(() => {
    setHpMethod("fixed");
    setSubclassOptionKey("");
    setAdvancementType("asi");
    setAbilityIncreases({});
    setFeatName(generalFeats[0] || "");
    setSelectedSpells({});
    setBackgroundExpandedSpells([]);
    setSpellQuery("");
    setError("");
  }, [generalFeats, review?.session?.id]);

  useEffect(() => {
    if (!subclassChoice || !subclassOptions.length) return;
    if (subclassOptions.some((option) => option.key === subclassOptionKey)) return;
    setSubclassOptionKey(subclassOptions[0].key);
  }, [subclassChoice, subclassOptionKey, subclassOptions]);

  useEffect(() => {
    let active = true;
    async function loadEligibleSpells() {
      if (!metadataReady || !characterId || (!requiredCantrips && !requiredLeveled)) {
        setSpells([]);
        setBackgroundExpandedSpells([]);
        return;
      }
      setLoadingSpells(true);
      const [catalogResult, assignmentResult, sheetResult] = await Promise.all([
        supabase
          .from("spells_catalog_preferred")
          .select("id,name,source,level,school,classes,description")
          .lte("level", Math.max(0, highestSpellLevel))
          .order("level", { ascending: true })
          .order("name", { ascending: true })
          .limit(2000),
        supabase.from("character_spells").select("spell_id").eq("character_id", characterId),
        supabase.from("character_sheets").select("sheet").eq("character_id", characterId).maybeSingle(),
      ]);
      if (!active) return;
      if (catalogResult.error || assignmentResult.error || sheetResult.error) {
        setError(catalogResult.error?.message || assignmentResult.error?.message || sheetResult.error?.message || "Could not load level-up spells.");
        setSpells([]);
        setBackgroundExpandedSpells([]);
      } else {
        const assignedIds = new Set((assignmentResult.data || []).map((row) => row.spell_id));
        setSpells((catalogResult.data || []).filter((spell) => !assignedIds.has(spell.id)));
        const sheet = sheetResult.data?.sheet || {};
        const meta = sheet?.meta || {};
        setBackgroundExpandedSpells([
          ...(Array.isArray(sheet.backgroundExpandedSpells) ? sheet.backgroundExpandedSpells : []),
          ...(Array.isArray(sheet?.spellcasting?.backgroundExpandedSpells) ? sheet.spellcasting.backgroundExpandedSpells : []),
          ...(Array.isArray(meta.backgroundExpandedSpells) ? meta.backgroundExpandedSpells : []),
        ]);
      }
      setLoadingSpells(false);
    }
    loadEligibleSpells();
    return () => { active = false; };
  }, [characterId, highestSpellLevel, metadataReady, requiredCantrips, requiredLeveled, review?.session?.id]);

  function setAbilityIncrease(key, value) {
    const numeric = Number(value || 0);
    setAbilityIncreases((current) => {
      const next = { ...current };
      if (!numeric) delete next[key];
      else next[key] = numeric;
      return next;
    });
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
    if (advancementChoice) {
      if (advancementType === "asi" && totalAbilityIncrease !== 2) return "Assign exactly two Ability Score Improvement points.";
      if (advancementType === "feat" && !safeText(featName)) return "Choose a feat.";
    }
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
    const spellChoices = spells
      .filter((spell) => selectedSpells[spell.id])
      .map((spell) => ({
        spell_id: spell.id,
        prepared: Number(spell.level || 0) === 0 ? true : Boolean(selectedSpells[spell.id]?.prepared),
      }));
    const selections = {
      hp_method: hpMethod,
      subclass_name: subclassChoice ? selectedSubclass?.name || null : null,
      subclass_source: subclassChoice ? selectedSubclass?.source || null : null,
      advancement_type: advancementChoice ? advancementType : null,
      ability_increases: advancementChoice && advancementType === "asi" ? abilityIncreases : {},
      feat_name: advancementChoice && advancementType === "feat" ? featName : null,
      spell_choices: spellChoices,
    };

    const { data, error: completeError } = await supabase.rpc("complete_character_level_up_v2", {
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

        {advancementChoice ? (
          <div className="col-12">
            <label className="form-label small fw-semibold">Ability Score Improvement or Feat</label>
            <div className="d-flex gap-2 flex-wrap mb-2">
              <button type="button" className={`btn btn-sm ${advancementType === "asi" ? "btn-warning" : "btn-outline-light"}`} onClick={() => setAdvancementType("asi")}>Ability scores</button>
              <button type="button" className={`btn btn-sm ${advancementType === "feat" ? "btn-warning" : "btn-outline-light"}`} onClick={() => setAdvancementType("feat")}>General feat</button>
            </div>
            {advancementType === "asi" ? (
              <div className="level-up-ability-grid">
                {ABILITY_KEYS.map((key) => (
                  <label key={key}>
                    <span>{ABILITY_LABELS[key]}</span>
                    <select className="form-select form-select-sm" value={abilityIncreases[key] || 0} onChange={(event) => setAbilityIncrease(key, event.target.value)}>
                      <option value="0">+0</option>
                      <option value="1">+1</option>
                      <option value="2">+2</option>
                    </select>
                  </label>
                ))}
                <div className={`level-up-ability-total ${totalAbilityIncrease === 2 ? "ready" : ""}`}>{totalAbilityIncrease}/2 points</div>
              </div>
            ) : (
              <select className="form-select form-select-sm" value={featName} onChange={(event) => setFeatName(event.target.value)}>
                {generalFeats.map((feat) => <option key={feat} value={feat}>{feat}</option>)}
              </select>
            )}
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
            {loadingSpells ? <div className="text-muted">Loading eligible spells from all sources…</div> : null}
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

      <button type="button" className="btn btn-warning btn-sm mt-3" disabled={busy} onClick={applyLevel}>{busy ? "Applying level…" : `Apply Level ${preview?.toLevel || ""}`}</button>
      <div className="small text-muted mt-2">The level, HP, class choices, sheet values, spellbook, and progression history are committed together or not at all.</div>

      <style jsx>{`
        .level-up-ability-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:.45rem; align-items:end; }
        .level-up-ability-grid label { display:grid; gap:.2rem; }
        .level-up-ability-grid label span { color:rgba(255,255,255,.6); font-size:.72rem; }
        .level-up-ability-total { padding:.45rem .55rem; border-radius:.55rem; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); text-align:center; }
        .level-up-ability-total.ready { border-color:rgba(50,190,100,.6); color:#b8e6c3; }
        .level-up-spell-search { max-width:260px; }
        .level-up-spell-list { display:grid; gap:.4rem; max-height:38vh; overflow:auto; padding-right:.2rem; }
        .level-up-spell-row { display:flex; align-items:center; justify-content:space-between; gap:.55rem; padding:.5rem .6rem; border-radius:.65rem; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.035); }
        .level-up-spell-row.selected { border-color:rgba(245,190,75,.65); background:rgba(245,190,75,.1); }
        .level-up-spell-main { flex:1; min-width:0; display:grid; border:0; background:transparent; color:inherit; text-align:left; padding:0; }
        .level-up-spell-main small { color:rgba(255,255,255,.6); }
        @media (max-width:800px) { .level-up-ability-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .level-up-spell-search { max-width:none; width:100%; } }
      `}</style>
    </div>
  );
}

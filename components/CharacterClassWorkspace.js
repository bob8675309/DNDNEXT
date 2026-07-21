import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CharacterClassPanel from "./CharacterClassPanel";
import { classArtworkFor, handleClassArtworkError } from "../utils/classes/classArtwork";
import {
  findSubclassOption,
  guideSubclassFeatures,
  resolveSubclassCatalog,
  subclassIntroduction,
} from "../utils/classes/subclassCompatibility";
import { formatPlayerFacingText } from "../utils/playerFacingText";
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
  return formatPlayerFacingText(exact?.description || rows[0]?.description, "No imported description is available for this feature yet.");
}

function isGenericSubclassFeature(name) {
  const normalized = normalizeName(name);
  return normalized === "subclass feature" || normalized === "subclass" || normalized.endsWith(" subclass feature");
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
      const description = formatPlayerFacingText(row?.description, "No imported description is available for this class feature yet.");
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

function GuideFeatureButton({ feature, pinnedFeature, onHover, onPin }) {
  const isPinned = pinnedFeature?.name === feature.name
    && pinnedFeature?.subclassName === feature.subclassName
    && Number(pinnedFeature?.level) === Number(feature.level);
  return (
    <button
      type="button"
      className={`${feature.type === "subclass" ? "is-subclass" : ""} ${isPinned ? "is-pinned" : ""}`}
      title={feature.description}
      onMouseEnter={() => onHover(feature)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(feature)}
      onBlur={() => onHover(null)}
      onClick={() => onPin(isPinned ? null : feature)}
      aria-pressed={isPinned}
    >
      {feature.subclassName ? `${feature.subclassName}: ${feature.name}` : feature.name}
    </button>
  );
}

function SubclassGuideControls({
  includeSubclassFeatures,
  setIncludeSubclassFeatures,
  compareAllSubclasses,
  setCompareAllSubclasses,
  selectedOptionKey,
  setSelectedOptionKey,
  subclassOptions,
  currentOption,
  currentLevel,
  allowCompare = false,
}) {
  return (
    <div className="class-level-guide__controls">
      <label className="form-check form-switch mb-0">
        <input className="form-check-input" type="checkbox" checked={includeSubclassFeatures} onChange={(event) => setIncludeSubclassFeatures(event.target.checked)} />
        <span className="form-check-label">Show subclass</span>
      </label>
      <select className="form-select form-select-sm" aria-label="Subclass to include" value={selectedOptionKey} disabled={!includeSubclassFeatures || !subclassOptions.length} onChange={(event) => setSelectedOptionKey(event.target.value)}>
        {subclassOptions.map((option) => (
          <option key={option.key} value={option.key}>{option.name} • {option.source}{currentOption?.key === option.key ? " • current" : ""}</option>
        ))}
      </select>
      {allowCompare ? (
        <label className="form-check form-switch mb-0">
          <input className="form-check-input" type="checkbox" checked={compareAllSubclasses} disabled={!includeSubclassFeatures} onChange={(event) => setCompareAllSubclasses(event.target.checked)} />
          <span className="form-check-label">Compare all</span>
        </label>
      ) : null}
      <span className="badge text-bg-success">Current level {currentLevel}</span>
    </div>
  );
}

function useGuideRows({ levels, baseFeatureRows, visibleSubclassOptions, includeSubclassFeatures }) {
  const lookup = useMemo(() => featureLookup(baseFeatureRows), [baseFeatureRows]);
  return useMemo(() => levels.map((levelRow) => {
    const baseNames = (Array.isArray(levelRow.features) ? levelRow.features : [])
      .map(featureName)
      .filter(Boolean)
      .filter((name) => !(includeSubclassFeatures && visibleSubclassOptions.length && isGenericSubclassFeature(name)));
    const subclassAtLevel = visibleSubclassOptions.flatMap((option) => guideSubclassFeatures(option)
      .filter((row) => Number(row.level) === Number(levelRow.class_level))
      .map((row) => ({
        name: row.name,
        subclassName: option.name,
        source: option.source,
        level: row.level,
        type: "subclass",
        description: formatPlayerFacingText(row.description, "No imported description is available for this subclass feature yet."),
      })));
    return {
      ...levelRow,
      guideFeatures: [
        ...baseNames.map((name) => ({ name, level: levelRow.class_level, type: "class", description: descriptionFor(name, levelRow.class_level, lookup) })),
        ...subclassAtLevel,
      ],
    };
  }), [includeSubclassFeatures, levels, lookup, visibleSubclassOptions]);
}

function CompactTableGuide({ classRow, levels, baseFeatureRows, visibleSubclassOptions, includeSubclassFeatures, onExpand }) {
  const rows = useGuideRows({ levels, baseFeatureRows, visibleSubclassOptions, includeSubclassFeatures });
  const currentLevel = Number(classRow?.currentLevel || 1);

  function handleKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onExpand?.();
  }

  return (
    <section
      className="npc-card class-level-guide-preview"
      role="button"
      tabIndex={0}
      aria-label={`Expand ${classRow?.class_name || "class"} level 1 through 20 table`}
      title="Double-click to expand the level 1–20 table"
      onDoubleClick={onExpand}
      onKeyDown={handleKeyDown}
    >
      <div className="class-level-guide-preview__heading">
        <div>
          <div className="npc-card-title mb-0">Level 1–20 at a Glance</div>
          <div className="small text-muted">Double-click to expand</div>
        </div>
        <span aria-hidden="true">↗</span>
      </div>
      <div className="class-level-guide-preview__table" role="table" aria-label={`${classRow?.class_name || "Class"} compact level progression`}>
        <div className="class-level-guide-preview__row is-head" role="row">
          <div>Lvl</div><div>PB</div><div>Features</div><div>C</div><div>K/P</div><div>Slots</div>
        </div>
        {rows.map((row) => (
          <div key={row.class_level} className={`class-level-guide-preview__row ${Number(row.class_level) === currentLevel ? "is-current" : ""}`} role="row">
            <div>{row.class_level}</div>
            <div>+{Number(row.proficiency_bonus || 2)}</div>
            <div className="class-level-guide-preview__features">
              {row.guideFeatures.length ? row.guideFeatures.map((feature, index) => (
                <span key={`${feature.type}-${feature.subclassName || "base"}-${feature.name}-${index}`} className={feature.type === "subclass" ? "is-subclass" : ""}>{feature.subclassName ? `${feature.subclassName}: ` : ""}{feature.name}</span>
              )) : <span>—</span>}
            </div>
            <div>{row.cantrips_known ?? "—"}</div>
            <div>{row.spells_known ?? "—"}</div>
            <div>{slotSummary(row.spell_slots)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TableGuide({ classRow, levels, baseFeatureRows, visibleSubclassOptions, includeSubclassFeatures }) {
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [pinnedFeature, setPinnedFeature] = useState(null);
  const currentLevel = Number(classRow?.currentLevel || 1);
  const rows = useGuideRows({ levels, baseFeatureRows, visibleSubclassOptions, includeSubclassFeatures });

  useEffect(() => {
    setHoveredFeature(null);
    setPinnedFeature(null);
  }, [includeSubclassFeatures, visibleSubclassOptions]);

  return (
    <>
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
                  <GuideFeatureButton
                    key={`${feature.type}-${feature.subclassName || "base"}-${feature.name}-${index}`}
                    feature={feature}
                    pinnedFeature={pinnedFeature}
                    onHover={setHoveredFeature}
                    onPin={setPinnedFeature}
                  />
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
        <FeatureDescription feature={pinnedFeature || hoveredFeature} onClear={pinnedFeature ? () => setPinnedFeature(null) : null} />
      </div>
    </>
  );
}

function DetailedGuide({ classRow, levels, baseFeatureRows, selectedOption, includeSubclassFeatures, currentLevel }) {
  const lookup = useMemo(() => featureLookup(baseFeatureRows), [baseFeatureRows]);
  const selectedFeatures = useMemo(() => includeSubclassFeatures ? guideSubclassFeatures(selectedOption) : [], [includeSubclassFeatures, selectedOption]);
  const introduction = includeSubclassFeatures ? subclassIntroduction(selectedOption) : null;
  const sections = useMemo(() => levels.map((levelRow) => {
    const baseNames = (Array.isArray(levelRow.features) ? levelRow.features : [])
      .map(featureName)
      .filter(Boolean)
      .filter((name) => !(includeSubclassFeatures && selectedOption && isGenericSubclassFeature(name)));
    const features = [
      ...baseNames.map((name) => ({ name, type: "class", source: classRow?.source, description: descriptionFor(name, levelRow.class_level, lookup) })),
      ...selectedFeatures.filter((feature) => Number(feature.level) === Number(levelRow.class_level)).map((feature) => ({
        name: feature.name,
        type: "subclass",
        source: selectedOption?.source,
        description: formatPlayerFacingText(feature.description, "No imported description is available for this subclass feature yet."),
      })),
    ];
    return { ...levelRow, guideFeatures: features };
  }).filter((row) => row.guideFeatures.length), [classRow?.source, includeSubclassFeatures, levels, lookup, selectedFeatures, selectedOption]);

  return (
    <div className="class-book-guide">
      <aside className="npc-card class-book-guide__outline" aria-label="Guide outline">
        <div className="spell-admin-kicker">Guide Outline</div>
        <a href="#class-guide-introduction">{classRow?.class_name || "Class"}</a>
        {includeSubclassFeatures && selectedOption ? <a href="#class-guide-subclass">{selectedOption.name}</a> : null}
        <div className="class-book-guide__outline-levels">
          {sections.map((section) => <a key={section.class_level} href={`#class-guide-level-${section.class_level}`}>Level {section.class_level}</a>)}
        </div>
      </aside>

      <article className="npc-card class-book-guide__content">
        <header id="class-guide-introduction" className="class-book-guide__hero">
          <div>
            <div className="spell-admin-kicker">{sourceLabel(classRow?.source)}</div>
            <h2>{classRow?.class_name || "Class"}</h2>
            <p>{formatPlayerFacingText(classRow?.summary, `A complete level-by-level guide to the ${classRow?.class_name || "class"}.`)}</p>
            <div className="d-flex gap-2 flex-wrap">
              <span className="badge text-bg-secondary">Hit Die d{classRow?.hit_die || "—"}</span>
              <span className="badge text-bg-success">Current level {currentLevel}</span>
            </div>
          </div>
          <img src={classArtworkFor(classRow?.class_key)} onError={handleClassArtworkError} alt={`Original ${classRow?.class_name || "adventurer"} class artwork`} />
        </header>

        {includeSubclassFeatures && selectedOption ? (
          <section id="class-guide-subclass" className="class-book-guide__subclass-intro">
            <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
              <div>
                <div className="spell-admin-kicker">Selected Subclass</div>
                <h3>{selectedOption.name}</h3>
              </div>
              <span className="badge text-bg-info">{selectedOption.source}</span>
            </div>
            {introduction?.description ? <p>{formatPlayerFacingText(introduction.description)}</p> : <p className="text-muted">Its source-backed features are included at the applicable class levels below.</p>}
            {selectedOption.isLegacyCompatibility ? <div className="class-book-guide__compatibility-note">This supplemental subclass uses its published feature text with its entry level aligned to the 2024 level-3 subclass slot.</div> : null}
          </section>
        ) : null}

        <div className="class-book-guide__levels">
          {sections.map((section) => (
            <section key={section.class_level} id={`class-guide-level-${section.class_level}`} className={Number(section.class_level) === Number(currentLevel) ? "is-current" : ""}>
              <div className="class-book-guide__level-heading">
                <div>
                  <div className="spell-admin-kicker">Level {section.class_level}</div>
                  <h3>{classRow?.class_name} {section.class_level}</h3>
                </div>
                <div className="class-book-guide__level-stats">
                  <span>PB +{Number(section.proficiency_bonus || 2)}</span>
                  {section.cantrips_known != null ? <span>{section.cantrips_known} cantrips</span> : null}
                  {section.spells_known != null ? <span>{section.spells_known} known/prepared</span> : null}
                </div>
              </div>
              {section.guideFeatures.map((feature, index) => (
                <div key={`${feature.type}-${feature.name}-${index}`} className={`class-book-guide__feature ${feature.type === "subclass" ? "is-subclass" : ""}`}>
                  <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                    <h4>{feature.type === "subclass" ? `${selectedOption?.name}: ` : ""}{feature.name}</h4>
                    <span>{feature.source || "Campaign"}</span>
                  </div>
                  <p>{feature.description}</p>
                </div>
              ))}
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}

function useClassGuideModel(payload, featureRows) {
  const [includeSubclassFeatures, setIncludeSubclassFeatures] = useState(true);
  const [compareAllSubclasses, setCompareAllSubclasses] = useState(false);
  const [selectedOptionKey, setSelectedOptionKey] = useState("");
  const progression = payload?.progression || null;
  const classRow = payload?.class || null;
  const currentLevel = Number(progression?.class_level || 1);
  const baseFeatureRows = useMemo(() => featureRows.filter((row) => row.feature_type === "class" && row.class_source === classRow?.source), [classRow?.source, featureRows]);
  const subclassOptions = useMemo(() => resolveSubclassCatalog(featureRows, classRow?.source), [classRow?.source, featureRows]);
  const currentOption = useMemo(() => findSubclassOption(subclassOptions, progression?.subclass_name, progression?.subclass_source), [progression?.subclass_name, progression?.subclass_source, subclassOptions]);
  const selectedOption = useMemo(() => subclassOptions.find((option) => option.key === selectedOptionKey) || currentOption || subclassOptions[0] || null, [currentOption, selectedOptionKey, subclassOptions]);

  useEffect(() => {
    if (!subclassOptions.length) {
      setSelectedOptionKey("");
      return;
    }
    if (subclassOptions.some((option) => option.key === selectedOptionKey)) return;
    setSelectedOptionKey((currentOption || subclassOptions[0]).key);
  }, [currentOption, selectedOptionKey, subclassOptions]);

  const selectedSubclassOptions = useMemo(
    () => includeSubclassFeatures && selectedOption ? [selectedOption] : [],
    [includeSubclassFeatures, selectedOption]
  );
  const tableSubclassOptions = useMemo(
    () => includeSubclassFeatures ? compareAllSubclasses ? subclassOptions : selectedSubclassOptions : [],
    [compareAllSubclasses, includeSubclassFeatures, selectedSubclassOptions, subclassOptions]
  );

  return {
    classRow,
    currentLevel,
    baseFeatureRows,
    subclassOptions,
    currentOption,
    selectedOption,
    selectedOptionKey: selectedOption?.key || "",
    setSelectedOptionKey,
    includeSubclassFeatures,
    setIncludeSubclassFeatures,
    compareAllSubclasses,
    setCompareAllSubclasses,
    selectedSubclassOptions,
    tableSubclassOptions,
  };
}

function DetailedLevelGuide({ guideModel, levels }) {
  const {
    classRow,
    currentLevel,
    subclassOptions,
    currentOption,
    selectedOption,
    selectedOptionKey,
    setSelectedOptionKey,
    includeSubclassFeatures,
    setIncludeSubclassFeatures,
    compareAllSubclasses,
    setCompareAllSubclasses,
    baseFeatureRows,
  } = guideModel;

  return (
    <div className="class-level-guide">
      <section className="npc-card mb-3 class-level-guide__intro">
        <div>
          <div className="spell-admin-kicker">Detailed Guide</div>
          <h2 className="h5 mb-1">Read the complete class progression</h2>
          <div className="small text-muted">Class and selected-subclass features are placed at the levels where they become available.</div>
        </div>
        <SubclassGuideControls
          includeSubclassFeatures={includeSubclassFeatures}
          setIncludeSubclassFeatures={setIncludeSubclassFeatures}
          compareAllSubclasses={compareAllSubclasses}
          setCompareAllSubclasses={setCompareAllSubclasses}
          selectedOptionKey={selectedOptionKey}
          setSelectedOptionKey={setSelectedOptionKey}
          subclassOptions={subclassOptions}
          currentOption={currentOption}
          currentLevel={currentLevel}
        />
      </section>
      <DetailedGuide
        classRow={classRow}
        levels={levels}
        baseFeatureRows={baseFeatureRows}
        selectedOption={selectedOption}
        includeSubclassFeatures={includeSubclassFeatures}
        currentLevel={currentLevel}
      />
    </div>
  );
}

function ExpandedTableGuide({ guideModel, levels, onClose }) {
  const {
    classRow,
    currentLevel,
    subclassOptions,
    currentOption,
    selectedOptionKey,
    setSelectedOptionKey,
    includeSubclassFeatures,
    setIncludeSubclassFeatures,
    compareAllSubclasses,
    setCompareAllSubclasses,
    baseFeatureRows,
    tableSubclassOptions,
  } = guideModel;

  return (
    <div className="class-level-guide class-expanded-guide">
      <section className="npc-card mb-3 class-level-guide__intro class-expanded-guide__header">
        <div>
          <div className="spell-admin-kicker">Level 1–20 Table</div>
          <h2 className="h5 mb-1">{classRow?.class_name || "Class"} progression at a glance</h2>
          <div className="small text-muted">Hover for a quick description or click a feature to pin it below the table.</div>
        </div>
        <div className="class-expanded-guide__actions">
          <SubclassGuideControls
            includeSubclassFeatures={includeSubclassFeatures}
            setIncludeSubclassFeatures={setIncludeSubclassFeatures}
            compareAllSubclasses={compareAllSubclasses}
            setCompareAllSubclasses={setCompareAllSubclasses}
            selectedOptionKey={selectedOptionKey}
            setSelectedOptionKey={setSelectedOptionKey}
            subclassOptions={subclassOptions}
            currentOption={currentOption}
            currentLevel={currentLevel}
            allowCompare
          />
          <button type="button" className="btn btn-sm btn-outline-light class-expanded-guide__close" aria-label="Close expanded level table" title="Close level table" onClick={onClose}>×</button>
        </div>
      </section>
      <TableGuide
        classRow={{ ...classRow, currentLevel }}
        levels={levels}
        baseFeatureRows={baseFeatureRows}
        visibleSubclassOptions={tableSubclassOptions}
        includeSubclassFeatures={includeSubclassFeatures}
      />
    </div>
  );
}

export default function CharacterClassWorkspace({ character = null, isAdmin = false }) {
  const [view, setView] = useState("overview");
  const [tableExpanded, setTableExpanded] = useState(false);
  const [payload, setPayload] = useState(null);
  const [levels, setLevels] = useState([]);
  const [featureRows, setFeatureRows] = useState([]);
  const [overviewFeature, setOverviewFeature] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const overviewRef = useRef(null);
  const characterId = character?.id || null;
  const guideModel = useClassGuideModel(payload, featureRows);

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
        .select("id,feature_key,feature_type,name,source,class_key,class_name,class_source,subclass_name,subclass_short_name,level,description,raw_payload")
        .eq("class_key", classRow.class_key)
        .order("level", { ascending: true })
        .order("name", { ascending: true })
        .limit(5000),
    ]);
    if (levelResult.error || featureResult.error) setError(levelResult.error?.message || featureResult.error?.message || "Could not load the full class guide.");
    setLevels(levelResult.data || []);
    setFeatureRows(featureResult.data || []);
    setLoading(false);
  }, [characterId]);

  useEffect(() => {
    loadGuide();
  }, [loadGuide]);

  useEffect(() => {
    if (!tableExpanded) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setTableExpanded(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [tableExpanded]);

  const overviewFeatureRows = useMemo(() => {
    const classRow = payload?.class;
    if (!classRow) return [];
    const baseRows = featureRows.filter((row) => row.feature_type === "class" && row.class_source === classRow.source);
    const options = resolveSubclassCatalog(featureRows, classRow.source);
    const selected = findSubclassOption(options, payload?.progression?.subclass_name, payload?.progression?.subclass_source);
    return selected ? [...baseRows, ...guideSubclassFeatures(selected)] : baseRows;
  }, [featureRows, payload]);

  if (tableExpanded && payload?.class) {
    return (
      <div className="character-class-workspace">
        {error ? <div className="alert alert-warning py-2">{error}</div> : null}
        <ExpandedTableGuide guideModel={guideModel} levels={levels} onClose={() => setTableExpanded(false)} />
      </div>
    );
  }

  return (
    <div className="character-class-workspace">
      <div className="npc-card mb-3 character-class-workspace__switcher">
        <div>
          <div className="npc-card-title mb-0">Class View</div>
          <div className="small text-muted">Use the overview during play or read the complete descriptive guide.</div>
        </div>
        <div className="btn-group btn-group-sm" role="tablist" aria-label="Class information views">
          <button type="button" className={`btn ${view === "overview" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setView("overview")}>Class Overview</button>
          <button type="button" className={`btn ${view === "detailed" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setView("detailed")}>Detailed Guide</button>
        </div>
      </div>

      {error ? <div className="alert alert-warning py-2">{error}</div> : null}
      {view === "overview" ? (
        <div ref={overviewRef}>
          <CharacterClassPanel
            character={character}
            isAdmin={isAdmin}
            progressionPreview={loading ? (
              <section className="npc-card class-level-guide-preview is-loading"><div className="text-muted">Loading level 1–20 table…</div></section>
            ) : payload?.class ? (
              <CompactTableGuide
                classRow={{ ...guideModel.classRow, currentLevel: guideModel.currentLevel }}
                levels={levels}
                baseFeatureRows={guideModel.baseFeatureRows}
                visibleSubclassOptions={guideModel.selectedSubclassOptions}
                includeSubclassFeatures={guideModel.includeSubclassFeatures}
                onExpand={() => setTableExpanded(true)}
              />
            ) : null}
          />
          <OverviewFeatureHover rootRef={overviewRef} featureRows={overviewFeatureRows} onSelect={setOverviewFeature} />
          <div className="mt-3"><FeatureDescription feature={overviewFeature} onClear={overviewFeature ? () => setOverviewFeature(null) : null} heading="Pinned Class Feature" /></div>
        </div>
      ) : loading ? <div className="npc-card"><div className="text-muted">Loading detailed class progression…</div></div> : payload?.class ? (
        <DetailedLevelGuide guideModel={guideModel} levels={levels} />
      ) : <div className="npc-card"><div className="text-muted">Class progression has not been initialized for this character.</div></div>}
    </div>
  );
}

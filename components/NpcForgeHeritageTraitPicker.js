import { useEffect, useMemo, useState } from "react";
import { buildHeritageTraitSubchoiceGroups } from "../utils/playerForgeHeritageSubchoices";
import { formatPlayerFacingText } from "../utils/playerFacingText";
import { sourceChoiceFieldIsActive } from "../utils/playerForgeSourceChoices";
import { supabase } from "../utils/supabaseClient";
import SourceChoiceFields from "./SourceChoiceFields";
import { useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";

const safeText = (value) => String(value ?? "").trim();
const CATEGORY_ORDER = ["C", "E", "R"];
const CATEGORY_LABELS = Object.freeze({ C: "Combat", E: "Exploration", R: "Roleplaying" });
const CUSTOM_LINEAGE_DESCRIPTION = "Custom Lineage is built entirely from Heritage Traits. Choose eight Heritage Traits, some traits may be chosen more then once.";

function selectedKeys(selections = {}, groupId = "", fieldId = "") {
  return Array.isArray(selections?.[groupId]?.[fieldId]) ? selections[groupId][fieldId] : [];
}

function heritageText(value = "") {
  return formatPlayerFacingText(value)
    .replace(/\s*\(This is an? (?:Combat|Exploration|Roleplaying) trait\.\)/gi, "")
    .replace(/\s*\(see[^)]*page\s+\d+\)\.?/gi, "")
    .replace(/\bGM's\b/g, "Game Master's")
    .replace(/\bEtharis\b/g, "the world")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function categoryFor(option = {}) {
  const key = safeText(option?.metadata?.category).toUpperCase();
  return CATEGORY_LABELS[key] ? key : "R";
}

function repeatLimit(group = {}, option = {}) {
  const fromGroup = Number(group?.metadata?.repeatLimits?.[option.key] || 0);
  const fromOption = Number(option?.metadata?.repeatLimit || 0);
  return Math.max(1, fromGroup || fromOption || 1);
}

function heritageFields(group = {}) {
  return (group.fields || []).filter((field) => field.kind === "heritage-trait" && !field.autoSelect);
}

function selectedRows(group = {}, selections = {}) {
  return heritageFields(group).flatMap((field) => {
    if (!sourceChoiceFieldIsActive(field, selections)) return [];
    const key = selectedKeys(selections, group.id, field.id)[0];
    if (!key) return [];
    const option = (field.options || []).find((entry) => entry.key === key);
    return option ? [{ field, option }] : [];
  });
}

export default function NpcForgeHeritageTraitPicker({ group, selections = {}, onSet = null }) {
  const { registerGroups, toggleChoice, setChoice } = useNpcForgeSourceChoices();
  const [category, setCategory] = useState("C");
  const [query, setQuery] = useState("");
  const [focusedKey, setFocusedKey] = useState("");
  const [catalogs, setCatalogs] = useState({ spells: [], items: [], ready: false, error: "" });
  const fields = heritageFields(group);
  const catalog = fields[0]?.options || [];
  const primaryIdentity = `${group.id}|${fields.length}|${catalog.length}`;
  const stablePrimaryGroup = useMemo(() => group, [primaryIdentity]);
  const picks = selectedRows(group, selections);
  const maxPicks = Math.max(1, Number(group?.metadata?.totalPicks || fields.length || 8));
  const counts = new Map();
  for (const row of picks) counts.set(row.option.key, Number(counts.get(row.option.key) || 0) + 1);
  const scope = `heritage-subchoices-${group.id}`;
  const selectionSignature = JSON.stringify([selections?.[group.id] || {}, selections?.[scope] || {}]);
  const relevantSelections = useMemo(() => ({
    [stablePrimaryGroup.id]: selections?.[stablePrimaryGroup.id] || {},
    [scope]: selections?.[scope] || {},
  }), [selectionSignature, scope, stablePrimaryGroup.id]);

  useEffect(() => {
    let active = true;
    setCatalogs({ spells: [], items: [], ready: false, error: "" });
    Promise.all([
      supabase.from("spells_catalog")
        .select("id,spell_key,name,source,level,classes,description")
        .lte("level", 1)
        .order("level", { ascending: true })
        .order("name", { ascending: true })
        .limit(5000),
      supabase.from("items_catalog")
        .select("id,item_name,item_key,item_type,item_rarity,payload")
        .eq("item_rarity", "mundane")
        .in("item_type", ["Melee Weapon", "Ranged Weapon", "Tools", "Instrument"])
        .order("item_name", { ascending: true })
        .limit(5000),
    ]).then(([spellResult, itemResult]) => {
      if (!active) return;
      const error = spellResult.error || itemResult.error;
      if (error) {
        setCatalogs({ spells: [], items: [], ready: false, error: error.message || "Could not load the Heritage Trait choice catalogues." });
        return;
      }
      setCatalogs({ spells: spellResult.data || [], items: itemResult.data || [], ready: true, error: "" });
    });
    return () => { active = false; };
  }, []);

  const subchoiceGroups = useMemo(() => buildHeritageTraitSubchoiceGroups({
    primaryGroup: stablePrimaryGroup,
    selections: relevantSelections,
    spells: catalogs.spells,
    itemRows: catalogs.items,
  }), [catalogs.items, catalogs.spells, relevantSelections, stablePrimaryGroup]);

  useEffect(() => {
    registerGroups(subchoiceGroups, catalogs.ready, scope);
  }, [catalogs.ready, registerGroups, scope, subchoiceGroups]);

  useEffect(() => () => registerGroups([], true, scope), [registerGroups, scope]);

  const visible = catalog.filter((option) => {
    if (categoryFor(option) !== category) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${option.label} ${heritageText(option.description)}`.toLowerCase().includes(needle);
  }).sort((a, b) => a.label.localeCompare(b.label));

  useEffect(() => {
    if (visible.some((option) => option.key === focusedKey)) return;
    setFocusedKey(visible[0]?.key || "");
  }, [category, focusedKey, query, visible.map((option) => option.key).join("|")]);

  const focused = visible.find((option) => option.key === focusedKey) || visible[0] || null;
  const focusedCount = focused ? Number(counts.get(focused.key) || 0) : 0;
  const focusedLimit = focused ? repeatLimit(group, focused) : 1;
  const full = picks.length >= maxPicks;
  const capped = focused ? focusedCount >= focusedLimit : true;

  const addTrait = (option) => {
    if (!option || picks.length >= maxPicks) return;
    const currentCount = Number(counts.get(option.key) || 0);
    if (currentCount >= repeatLimit(group, option)) return;
    const emptyField = fields.find((field) => selectedKeys(selections, group.id, field.id).length === 0);
    if (!emptyField) return;
    onSet?.(group.id, emptyField.id, [option.key]);
    setFocusedKey(option.key);
  };

  const removeTrait = (optionKey) => {
    const row = [...picks].reverse().find((entry) => entry.option.key === optionKey);
    if (!row) return;
    onSet?.(group.id, row.field.id, []);
  };

  const selectedOptions = [...counts.entries()].map(([key, count]) => ({
    option: catalog.find((entry) => entry.key === key),
    count,
  })).filter((entry) => entry.option);

  const focusedSubchoiceGroups = focused ? subchoiceGroups.flatMap((subGroup) => {
    const matchingFields = (subGroup.fields || []).filter((field) => field.metadata?.heritageTraitKey === focused.key);
    return matchingFields.length ? [{ ...subGroup, fields: matchingFields }] : [];
  }) : [];

  const focusedParagraphs = heritageText(focused?.description).split(/\n\s*\n/).filter(Boolean);

  return <section className={`npc-forge-heritage-picker ${picks.length === maxPicks ? "is-complete" : "is-required"}`}>
    <header className="npc-forge-heritage-picker__head">
      <div><strong>Heritage Traits</strong><small>{CUSTOM_LINEAGE_DESCRIPTION}</small></div>
      <em aria-live="polite">{picks.length} / {maxPicks}</em>
    </header>

    {catalogs.error ? <p className="npc-forge-heritage-picker__error">{catalogs.error}</p> : !catalogs.ready ? <p className="npc-forge-heritage-picker__loading">Loading Heritage Trait choices…</p> : null}

    {selectedOptions.length ? <div className="npc-forge-heritage-picker__selected"><span>Selected</span><div>{selectedOptions.map(({ option, count }) => <button key={option.key} type="button" className={focused?.key === option.key ? "is-focused" : ""} onClick={() => setFocusedKey(option.key)}><strong>{option.label}</strong><small>{count > 1 ? `×${count}` : "×1"}</small></button>)}</div></div> : null}

    <div className="npc-forge-heritage-picker__controls">
      <div role="group" aria-label="Heritage Trait category">
        {CATEGORY_ORDER.map((key) => <button key={key} type="button" className={category === key ? "is-selected" : ""} onClick={() => setCategory(key)}>{CATEGORY_LABELS[key]}</button>)}
      </div>
      <label><span>Find a trait</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${CATEGORY_LABELS[category]} traits…`} /></label>
    </div>

    <div className="npc-forge-heritage-picker__browser">
      <div className="npc-forge-heritage-picker__list" role="list" aria-label={`${CATEGORY_LABELS[category]} Heritage Traits`}>
        {visible.map((option) => {
          const count = Number(counts.get(option.key) || 0);
          return <button key={option.key} type="button" role="listitem" className={`${focused?.key === option.key ? "is-focused" : ""} ${count ? "is-selected" : ""}`} onClick={() => setFocusedKey(option.key)}><span><strong>{option.label}</strong><small>{CATEGORY_LABELS[categoryFor(option)]}</small></span>{count ? <em>{count} pick{count === 1 ? "" : "s"}</em> : <em>View</em>}</button>;
        })}
        {!visible.length ? <p className="npc-forge-heritage-picker__empty">No {CATEGORY_LABELS[category]} traits match this search.</p> : null}
      </div>

      <article className="npc-forge-heritage-picker__detail">
        {focused ? <>
          <header><div><span>{CATEGORY_LABELS[categoryFor(focused)]}</span><h4>{focused.label}</h4></div><em>{focusedCount ? `${focusedCount} / ${focusedLimit} picks` : `Up to ${focusedLimit}`}</em></header>
          <div className="npc-forge-heritage-picker__copy">{focusedParagraphs.map((paragraph, index) => <p key={`${focused.key}-${index}`}>{paragraph}</p>)}</div>
          <div className="npc-forge-heritage-picker__actions">
            <button type="button" disabled={full || capped || !catalogs.ready} onClick={() => addTrait(focused)}>{focusedCount ? "Take again" : "Select trait"}</button>
            {focusedCount ? <button type="button" className="is-remove" onClick={() => removeTrait(focused.key)}>Remove one pick</button> : null}
            <small>{focusedLimit > 1 ? `May be selected up to ${focusedLimit} times. A repeat spends another Heritage pick and activates the trait's improved or repeated benefit.` : "This trait can be selected once."}</small>
          </div>
          {focusedSubchoiceGroups.length ? <div className="npc-forge-heritage-picker__subchoices"><SourceChoiceFields groups={focusedSubchoiceGroups} selections={selections} kicker="Trait choices" title="Complete this Heritage Trait" onToggle={toggleChoice} onSet={setChoice} /></div> : null}
        </> : <p>Select a Heritage Trait from the list.</p>}
      </article>
    </div>

    <style jsx global>{`
      .npc-forge-species-feature-list>details:has(.npc-forge-heritage-picker){grid-column:1/-1}.npc-forge-species-feature-list>details:has(.npc-forge-heritage-picker)>.npc-forge-rule-copy{display:none}.npc-forge-species-feature-list>details:has(.npc-forge-heritage-picker) .npc-forge-embedded-choice{margin-top:4px}.npc-forge-heritage-picker{display:grid;gap:8px;padding:5px 1px 1px;border:0;background:transparent}.npc-forge-heritage-picker__head{display:flex;align-items:start;justify-content:space-between;gap:12px;padding:2px 2px 4px}.npc-forge-heritage-picker__head>div{display:grid;gap:3px}.npc-forge-heritage-picker__head strong{color:#fff;font-size:.78rem}.npc-forge-heritage-picker__head small{max-width:850px;color:rgba(255,255,255,.76);font-size:.63rem;line-height:1.45}.npc-forge-heritage-picker__head em{min-width:58px;padding:5px 8px;border-radius:999px;color:#d8fff9;background:rgba(88,214,199,.1);font-size:.59rem;font-style:normal;text-align:center}.npc-forge-heritage-picker__loading,.npc-forge-heritage-picker__error{margin:0;padding:7px 8px;border-radius:7px;font-size:.57rem;line-height:1.4}.npc-forge-heritage-picker__loading{color:#d8fff9;background:rgba(88,214,199,.07)}.npc-forge-heritage-picker__error{color:#ffd0d0;background:rgba(214,88,88,.09);border:1px solid rgba(214,88,88,.25)}.npc-forge-heritage-picker__selected{display:grid;gap:4px}.npc-forge-heritage-picker__selected>span{color:#eadfff;font-size:.53rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.npc-forge-heritage-picker__selected>div{display:flex;flex-wrap:wrap;gap:4px}.npc-forge-heritage-picker__selected button{display:flex;align-items:center;gap:5px;padding:4px 6px;border:1px solid rgba(168,108,255,.28);border-radius:999px;color:#fff;background:rgba(126,72,199,.08)}.npc-forge-heritage-picker__selected button.is-focused{border-color:#a86cff;background:rgba(126,72,199,.18)}.npc-forge-heritage-picker__selected strong{font-size:.54rem}.npc-forge-heritage-picker__selected small{color:#9cece2;font-size:.49rem}.npc-forge-heritage-picker__controls{display:grid;grid-template-columns:auto minmax(220px,1fr);gap:8px;align-items:end}.npc-forge-heritage-picker__controls>div{display:flex;gap:5px}.npc-forge-heritage-picker__controls button{padding:6px 9px;border:1px solid rgba(255,255,255,.12);border-radius:999px;color:#fff;background:rgba(255,255,255,.025);font-size:.57rem}.npc-forge-heritage-picker__controls button.is-selected{border-color:#a86cff;background:rgba(126,72,199,.22)}.npc-forge-heritage-picker__controls label{display:grid;gap:3px}.npc-forge-heritage-picker__controls label span{color:#eadfff;font-size:.53rem;font-weight:800}.npc-forge-heritage-picker__controls input{width:100%;padding:7px 8px;border:1px solid rgba(168,108,255,.3);border-radius:7px;color:#fff;background:#111522}.npc-forge-heritage-picker__browser{display:grid;grid-template-columns:minmax(230px,34%) minmax(0,1fr);min-height:390px;max-height:540px;overflow:hidden;border:1px solid rgba(168,108,255,.25);border-radius:9px;background:rgba(0,0,0,.12)}.npc-forge-heritage-picker__list{display:grid;align-content:start;gap:3px;overflow:auto;padding:6px;border-right:1px solid rgba(255,255,255,.08)}.npc-forge-heritage-picker__list>button{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:7px 8px;border:1px solid transparent;border-radius:7px;color:#fff;background:transparent;text-align:left}.npc-forge-heritage-picker__list>button:hover,.npc-forge-heritage-picker__list>button.is-focused{border-color:rgba(168,108,255,.42);background:rgba(126,72,199,.12)}.npc-forge-heritage-picker__list>button.is-selected{box-shadow:inset 2px 0 #58d6c7}.npc-forge-heritage-picker__list>button>span{display:grid;gap:1px}.npc-forge-heritage-picker__list strong{font-size:.61rem}.npc-forge-heritage-picker__list small{color:rgba(255,255,255,.46);font-size:.47rem;text-transform:uppercase}.npc-forge-heritage-picker__list em{color:#9cece2;font-size:.49rem;font-style:normal;white-space:nowrap}.npc-forge-heritage-picker__detail{display:grid;align-content:start;gap:10px;overflow:auto;padding:13px 15px;background:linear-gradient(120deg,rgba(126,72,199,.08),rgba(88,214,199,.025))}.npc-forge-heritage-picker__detail>header{display:flex;align-items:start;justify-content:space-between;gap:10px}.npc-forge-heritage-picker__detail>header>div{display:grid;gap:2px}.npc-forge-heritage-picker__detail>header span{color:#9cece2;font-size:.5rem;font-weight:900;text-transform:uppercase;letter-spacing:.07em}.npc-forge-heritage-picker__detail h4{margin:0;color:#fff;font-size:.82rem}.npc-forge-heritage-picker__detail>header em{padding:3px 6px;border-radius:999px;color:#eadfff;background:rgba(168,108,255,.12);font-size:.5rem;font-style:normal}.npc-forge-heritage-picker__copy{display:grid;gap:7px}.npc-forge-heritage-picker__copy p{margin:0;color:rgba(255,255,255,.82);font-size:.64rem;line-height:1.55}.npc-forge-heritage-picker__actions{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.npc-forge-heritage-picker__actions>button{padding:7px 10px;border:1px solid rgba(88,214,199,.34);border-radius:7px;color:#d8fff9;background:rgba(88,214,199,.08);font-size:.58rem;font-weight:800}.npc-forge-heritage-picker__actions>button:hover:not(:disabled){border-color:#58d6c7;background:rgba(88,214,199,.14)}.npc-forge-heritage-picker__actions>button.is-remove{border-color:rgba(255,255,255,.12);color:rgba(255,255,255,.72);background:rgba(255,255,255,.025)}.npc-forge-heritage-picker__actions>button:disabled{cursor:not-allowed;opacity:.38}.npc-forge-heritage-picker__actions>small{flex-basis:100%;color:rgba(255,255,255,.5);font-size:.5rem;line-height:1.4}.npc-forge-heritage-picker__subchoices .npc-forge-source-choices{margin-top:2px}.npc-forge-heritage-picker__subchoices .npc-forge-source-choice-group{padding:9px 10px}.npc-forge-heritage-picker__empty{margin:0;padding:12px;color:rgba(255,255,255,.58);font-size:.58rem;text-align:center}@media(max-width:850px){.npc-forge-heritage-picker__controls{grid-template-columns:1fr}.npc-forge-heritage-picker__browser{grid-template-columns:1fr;max-height:none}.npc-forge-heritage-picker__list{max-height:260px;border-right:0;border-bottom:1px solid rgba(255,255,255,.08)}.npc-forge-heritage-picker__detail{overflow:visible}}
    `}</style>
  </section>;
}

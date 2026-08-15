import { useEffect, useMemo, useState } from "react";
import { buildHeritageTraitSubchoiceGroups } from "../utils/playerForgeHeritageSubchoices";
import { formatPlayerFacingText } from "../utils/playerFacingText";
import { sourceChoiceFieldIsActive } from "../utils/playerForgeSourceChoices";
import { supabase } from "../utils/supabaseClient";
import { useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";

const safeText = (value) => String(value ?? "").trim();
const CATEGORY_ORDER = ["C", "E", "R"];
const CATEGORY_LABELS = Object.freeze({ C: "Combat", E: "Exploration", R: "Roleplaying" });

function selectedKeys(selections = {}, groupId = "", fieldId = "") {
  return Array.isArray(selections?.[groupId]?.[fieldId]) ? selections[groupId][fieldId] : [];
}

function heritageText(value = "") {
  return formatPlayerFacingText(value)
    .replace(/\s*\(This is an? (?:Combat|Exploration|Roleplaying) trait\.\)/gi, "")
    .replace(/\bEtharis\b/g, "the world")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstParagraph(value = "") {
  return heritageText(value).split(/\n\s*\n/)[0] || "";
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
  const { registerGroups } = useNpcForgeSourceChoices();
  const [category, setCategory] = useState("ALL");
  const [query, setQuery] = useState("");
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
  const selectionSignature = JSON.stringify([
    selections?.[group.id] || {},
    selections?.[scope] || {},
  ]);
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
    const optionCategory = categoryFor(option);
    if (category !== "ALL" && optionCategory !== category) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${option.label} ${heritageText(option.description)}`.toLowerCase().includes(needle);
  }).sort((a, b) => {
    const categoryDelta = CATEGORY_ORDER.indexOf(categoryFor(a)) - CATEGORY_ORDER.indexOf(categoryFor(b));
    return categoryDelta || a.label.localeCompare(b.label);
  });

  const addTrait = (option) => {
    if (!option || picks.length >= maxPicks) return;
    const currentCount = Number(counts.get(option.key) || 0);
    if (currentCount >= repeatLimit(group, option)) return;
    const emptyField = fields.find((field) => selectedKeys(selections, group.id, field.id).length === 0);
    if (!emptyField) return;
    onSet?.(group.id, emptyField.id, [option.key]);
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

  return <section className={`npc-forge-heritage-picker ${picks.length === maxPicks ? "is-complete" : "is-required"}`}>
    <header className="npc-forge-heritage-picker__head">
      <div><strong>Heritage Traits</strong><small>Build the lineage with exactly eight Heritage Trait picks. Combat, Exploration, and Roleplaying organize the catalogue; they are not quotas. Taking an eligible trait again spends another pick and activates its improved or repeated benefit.</small></div>
      <em aria-live="polite">{picks.length} / {maxPicks}</em>
    </header>

    {catalogs.error ? <p className="npc-forge-heritage-picker__error">{catalogs.error}</p> : !catalogs.ready ? <p className="npc-forge-heritage-picker__loading">Loading the spell, weapon, tool, and instrument choices used by Heritage Traits…</p> : null}

    <div className="npc-forge-heritage-picker__selected">
      <span>Selected heritage</span>
      {selectedOptions.length ? <div>{selectedOptions.map(({ option, count }) => <button key={option.key} type="button" onClick={() => removeTrait(option.key)} title={`Remove one ${option.label} pick`}><strong>{option.label}</strong><small>{count > 1 ? `×${count} • improved benefit active` : "×1"}</small><b aria-hidden="true">×</b></button>)}</div> : <p>No Heritage Traits selected yet.</p>}
    </div>

    <div className="npc-forge-heritage-picker__controls">
      <div role="group" aria-label="Heritage Trait category">
        {[{ key: "ALL", label: "All" }, ...CATEGORY_ORDER.map((key) => ({ key, label: CATEGORY_LABELS[key] }))].map((entry) => <button key={entry.key} type="button" className={category === entry.key ? "is-selected" : ""} onClick={() => setCategory(entry.key)}>{entry.label}</button>)}
      </div>
      <label><span>Find a trait</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Heritage Traits…" /></label>
    </div>

    <div className="npc-forge-heritage-picker__grid">
      {visible.map((option) => {
        const currentCount = Number(counts.get(option.key) || 0);
        const limit = repeatLimit(group, option);
        const full = picks.length >= maxPicks;
        const capped = currentCount >= limit;
        const description = heritageText(option.description);
        const paragraphs = description.split(/\n\s*\n/).filter(Boolean);
        return <article key={option.key} className={currentCount ? "is-selected" : ""}>
          <div className="npc-forge-heritage-picker__card-head"><div><small>{CATEGORY_LABELS[categoryFor(option)]}</small><strong>{option.label}</strong></div>{currentCount ? <em>{currentCount} pick{currentCount === 1 ? "" : "s"}</em> : null}</div>
          <p>{firstParagraph(description)}</p>
          {paragraphs.length > 1 ? <details><summary>Read full trait</summary><div>{paragraphs.map((paragraph, index) => <p key={`${option.key}-${index}`}>{paragraph}</p>)}</div></details> : null}
          <div className="npc-forge-heritage-picker__actions">
            <button type="button" disabled={full || capped || !catalogs.ready} onClick={() => addTrait(option)}>{currentCount ? "Take again" : "Select trait"}</button>
            <small>{limit > 1 ? `May be selected up to ${limit} times` : "One pick maximum"}{currentCount > 1 ? " • improved benefit active" : ""}</small>
          </div>
        </article>;
      })}
      {!visible.length ? <p className="npc-forge-heritage-picker__empty">No Heritage Traits match this filter.</p> : null}
    </div>

    <style jsx global>{`
      .npc-forge-heritage-picker{display:grid;gap:10px;padding:10px;border:1px solid rgba(168,108,255,.38);border-radius:10px;background:linear-gradient(120deg,rgba(126,72,199,.12),rgba(88,214,199,.035))}.npc-forge-heritage-picker.is-required{box-shadow:inset 3px 0 rgba(168,108,255,.72)}.npc-forge-heritage-picker.is-complete{border-color:rgba(88,214,199,.42);box-shadow:inset 3px 0 rgba(88,214,199,.68)}.npc-forge-heritage-picker__head{display:flex;align-items:start;justify-content:space-between;gap:10px}.npc-forge-heritage-picker__head>div{display:grid;gap:3px}.npc-forge-heritage-picker__head strong{color:#fff;font-size:.74rem}.npc-forge-heritage-picker__head small{max-width:760px;color:rgba(255,255,255,.68);font-size:.59rem;line-height:1.45}.npc-forge-heritage-picker__head em{min-width:54px;padding:5px 8px;border-radius:999px;color:#d8fff9;background:rgba(88,214,199,.1);font-size:.58rem;font-style:normal;text-align:center}.npc-forge-heritage-picker__loading,.npc-forge-heritage-picker__error{margin:0;padding:7px 8px;border-radius:7px;font-size:.56rem;line-height:1.45}.npc-forge-heritage-picker__loading{color:#d8fff9;background:rgba(88,214,199,.07)}.npc-forge-heritage-picker__error{color:#ffd0d0;background:rgba(214,88,88,.09);border:1px solid rgba(214,88,88,.25)}.npc-forge-heritage-picker__selected{display:grid;gap:5px}.npc-forge-heritage-picker__selected>span{color:#eadfff;font-size:.59rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em}.npc-forge-heritage-picker__selected>div{display:flex;flex-wrap:wrap;gap:5px}.npc-forge-heritage-picker__selected button{display:grid;grid-template-columns:auto auto;column-gap:6px;align-items:center;padding:5px 7px;border:1px solid rgba(168,108,255,.38);border-radius:7px;color:#fff;background:rgba(126,72,199,.12);text-align:left}.npc-forge-heritage-picker__selected button strong{font-size:.58rem}.npc-forge-heritage-picker__selected button small{grid-column:1;color:rgba(255,255,255,.62);font-size:.49rem}.npc-forge-heritage-picker__selected button b{grid-column:2;grid-row:1/3;color:#d8fff9;font-size:.7rem}.npc-forge-heritage-picker__selected>p{margin:0;color:rgba(255,255,255,.55);font-size:.58rem}.npc-forge-heritage-picker__controls{display:grid;grid-template-columns:auto minmax(190px,1fr);gap:8px;align-items:end}.npc-forge-heritage-picker__controls>div{display:flex;flex-wrap:wrap;gap:5px}.npc-forge-heritage-picker__controls button{padding:6px 8px;border:1px solid rgba(255,255,255,.12);border-radius:7px;color:#fff;background:rgba(255,255,255,.025);font-size:.56rem}.npc-forge-heritage-picker__controls button.is-selected{border-color:#a86cff;background:rgba(126,72,199,.22)}.npc-forge-heritage-picker__controls label{display:grid;gap:3px}.npc-forge-heritage-picker__controls label span{color:#eadfff;font-size:.54rem;font-weight:800}.npc-forge-heritage-picker__controls input{width:100%;padding:7px 8px;border:1px solid rgba(168,108,255,.3);border-radius:7px;color:#fff;background:#111522}.npc-forge-heritage-picker__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:7px;max-height:600px;overflow:auto;padding-right:2px}.npc-forge-heritage-picker__grid>article{display:grid;align-content:start;gap:7px;padding:9px 10px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.025)}.npc-forge-heritage-picker__grid>article.is-selected{border-color:rgba(168,108,255,.62);background:rgba(126,72,199,.12)}.npc-forge-heritage-picker__card-head{display:flex;align-items:start;justify-content:space-between;gap:8px}.npc-forge-heritage-picker__card-head>div{display:grid;gap:1px}.npc-forge-heritage-picker__card-head small{color:#9cece2;font-size:.48rem;font-weight:900;text-transform:uppercase}.npc-forge-heritage-picker__card-head strong{color:#fff;font-size:.66rem}.npc-forge-heritage-picker__card-head em{padding:3px 5px;border-radius:999px;color:#eadfff;background:rgba(168,108,255,.13);font-size:.5rem;font-style:normal}.npc-forge-heritage-picker__grid>article>p,.npc-forge-heritage-picker__grid details p{margin:0;color:rgba(255,255,255,.76);font-size:.58rem;line-height:1.52}.npc-forge-heritage-picker__grid details{display:grid;gap:5px}.npc-forge-heritage-picker__grid details summary{cursor:pointer;color:#c9fff7;font-size:.55rem;font-weight:800}.npc-forge-heritage-picker__grid details>div{display:grid;gap:6px;padding-top:5px}.npc-forge-heritage-picker__actions{display:grid;gap:4px;margin-top:auto}.npc-forge-heritage-picker__actions>button{padding:6px 8px;border:1px solid rgba(88,214,199,.34);border-radius:7px;color:#d8fff9;background:rgba(88,214,199,.08);font-size:.56rem;font-weight:800}.npc-forge-heritage-picker__actions>button:hover:not(:disabled){border-color:#58d6c7;background:rgba(88,214,199,.14)}.npc-forge-heritage-picker__actions>button:disabled{cursor:not-allowed;opacity:.38}.npc-forge-heritage-picker__actions>small{color:rgba(255,255,255,.48);font-size:.49rem;line-height:1.4}.npc-forge-heritage-picker__empty{grid-column:1/-1;margin:0;padding:12px;color:rgba(255,255,255,.6);font-size:.6rem;text-align:center}@media(max-width:850px){.npc-forge-heritage-picker__controls{grid-template-columns:1fr}.npc-forge-heritage-picker__grid{grid-template-columns:1fr;max-height:none}}
    `}</style>
  </section>;
}

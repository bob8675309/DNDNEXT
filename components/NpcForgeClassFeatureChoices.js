import { useMemo, useState } from "react";
import { activeClassFeatureGroups } from "../utils/classFeatureChoices";
import { formatPlayerFacingText } from "../utils/playerFacingText";
import NpcForgeSourceChoiceFields from "./NpcForgeSourceChoiceFields";

const normalized = (value) => String(value ?? "").trim().toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function selectedNames(groups, selections) {
  return new Set(activeClassFeatureGroups(groups, selections).flatMap((group) => (selections?.[group.id] || []).map((key) => group.options.find((option) => option.key === key)?.name)).filter(Boolean).map(normalized));
}

function conciseChoiceHelper(value = "") {
  const cleaned = formatPlayerFacingText(value, "");
  if (!cleaned) return "";
  const blocks = cleaned.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  if (cleaned.length <= 700 && blocks.length <= 5) return cleaned;
  const preview = blocks.slice(0, 3).join("\n\n");
  return `${preview}\n\nFull feature rules remain available in the class guide.`;
}

function SpellChoiceCard({ option }) {
  const spell = option.spell || {};
  return (
    <div className="npc-forge-class-choice-spellcard" aria-label={`${option.name} spell details`}>
      <div><span>Level</span><strong>{Number(spell.level || 0) === 0 ? "Cantrip" : spell.level}</strong></div>
      <div><span>School</span><strong>{spell.school || "—"}</strong></div>
      <div><span>Casting time</span><strong>{spell.castingTime || "—"}</strong></div>
      <div><span>Range</span><strong>{spell.range || "—"}</strong></div>
      <div><span>Components</span><strong>{spell.components || "—"}</strong></div>
      <div><span>Duration</span><strong>{spell.duration || "—"}</strong></div>
      {spell.ritual ? <em>Ritual</em> : null}
      {spell.concentration ? <em>Concentration</em> : null}
      {spell.damage ? <em>{spell.damage}{spell.damageTypes?.length ? ` ${spell.damageTypes.join("/")}` : ""}</em> : null}
    </div>
  );
}

function ChoiceDetails({ option }) {
  if (!option) return null;
  return <details className="npc-forge-class-choice-selected-detail"><summary>{option.cardType === "spell" ? "Spell details" : "Read selected option"}</summary>{option.cardType === "spell" ? <SpellChoiceCard option={option} /> : null}<p>{option.description}</p>{option.followup ? <small className="npc-forge-class-choice-option__followup">Follow-up: {option.followup}</small> : null}</details>;
}

function ClassChoiceOption({ option, selected, eligible, requirement, onToggle }) {
  return (
    <article className={`npc-forge-class-choice-option ${selected ? "is-selected" : ""} ${eligible ? "" : "is-locked"}`}>
      <div className="npc-forge-class-choice-option__head">
        <div><strong>{option.name}</strong><small>{option.source || "Campaign"}{Number(option.minLevel || 1) > 1 ? ` • level ${option.minLevel}+` : ""}</small></div>
        <button type="button" disabled={!eligible} onClick={onToggle}>{selected ? "Selected" : eligible ? "Choose" : "Locked"}</button>
      </div>
      <details>
        <summary>{option.cardType === "spell" ? "Spell details" : "Read option"}</summary>
        {option.cardType === "spell" ? <SpellChoiceCard option={option} /> : null}
        <p>{option.description}</p>
        {requirement ? <small className="npc-forge-class-choice-option__requirement">Requires {requirement}.</small> : null}
        {option.followup ? <small className="npc-forge-class-choice-option__followup">Follow-up: {option.followup}</small> : null}
      </details>
    </article>
  );
}

function CompactChoicePicker({ group, selected, options, onToggle }) {
  const selectedOptions = selected.map((key) => group.options.find((option) => option.key === key)).filter(Boolean);
  const remaining = Math.max(0, Number(group.count || 0) - selectedOptions.length);
  const unselectedOptions = options.filter((option) => !selected.includes(option.key));
  const complete = remaining === 0;

  return <div className="npc-forge-class-choice-picker">
    <label>
      <span>{complete ? "Selection complete" : `Choose ${remaining} more`}</span>
      <select value="" disabled={complete || !unselectedOptions.length} onChange={(event) => { const next = event.target.value; if (next) onToggle?.(group.id, next); }}>
        <option value="">{complete ? `${selectedOptions.length}/${group.count} selected` : "Choose an option…"}</option>
        {unselectedOptions.map((option) => <option key={option.key} value={option.key}>{option.name}{option.source ? ` • ${option.source}` : ""}</option>)}
      </select>
    </label>
    {selectedOptions.length ? <div className="npc-forge-class-choice-picker__selected">{selectedOptions.map((option) => <div key={option.key} className="npc-forge-class-choice-picker__selection"><div><strong>{option.name}</strong><button type="button" onClick={() => onToggle?.(group.id, option.key)}>Remove</button></div><ChoiceDetails option={option} /></div>)}</div> : <div className="npc-forge-class-choice-picker__empty">No selections yet.</div>}
  </div>;
}

export default function NpcForgeClassFeatureChoices({
  groups = [], selections = {}, level = 1, onToggle, placement = "class", eligibleOptionNames = null,
  heading = "Complete permanent choices granted by this starting level",
  description = "Only choices earned by the selected class, subclass, and level appear here. Dependent choices open after their parent feature is selected.",
}) {
  const [queries, setQueries] = useState({});
  const visibleGroups = useMemo(() => activeClassFeatureGroups(groups, selections).filter((group) => (group.placement || "class") === placement), [groups, placement, selections]);
  const chosenNames = useMemo(() => selectedNames(groups, selections), [groups, selections]);
  const eligibleNames = useMemo(() => eligibleOptionNames ? new Set(eligibleOptionNames.map(normalized)) : null, [eligibleOptionNames]);
  const sourceClassChoices = placement === "class" ? <NpcForgeSourceChoiceFields placement="class" ownerType="class-option" title="Source-owned class option instances" /> : null;
  if (!visibleGroups.length) return sourceClassChoices;

  return (
    <>
    <section className={`npc-forge-class-choices is-placement-${placement}`} aria-label={placement === "training" ? "Required Training feature choices" : "Required class feature choices"}>
      <header>
        <div><span>{placement === "training" ? "Training feature choices" : "Class feature choices"}</span><h3>{heading}</h3></div>
        <p>{description}</p>
      </header>
      <div className="npc-forge-class-choices__groups">
        {visibleGroups.map((group) => {
          const selected = selections?.[group.id] || [];
          const query = queries[group.id] || "";
          const proficiencyEligible = (option) => group.kind !== "expertise" || !eligibleNames || eligibleNames.has(normalized(option.name)) || selected.includes(option.key);
          const optionEligible = (option) => {
            const isSelected = selected.includes(option.key);
            const levelEligible = Number(option.minLevel || 1) <= Number(level || 1);
            const dependencyEligible = !option.requires || chosenNames.has(normalized(option.requires)) || isSelected;
            const uniqueEligible = group.allowRepeatAcrossGroups || !chosenNames.has(normalized(option.name)) || isSelected;
            return levelEligible && dependencyEligible && uniqueEligible && proficiencyEligible(option);
          };
          const availableOptions = group.options.filter((option) => proficiencyEligible(option) && (Number(option.minLevel || 1) <= Number(level || 1) || selected.includes(option.key)));
          const pickerOptions = availableOptions.filter(optionEligible);
          const filtered = availableOptions.filter((option) => !query || `${option.name} ${option.description} ${option.spell?.school || ""}`.toLowerCase().includes(query.toLowerCase()));
          const complete = selected.length === Number(group.count || 0);
          const compactPicker = group.kind !== "spell" && Number(group.count || 0) <= 6 && availableOptions.length <= 36 && !availableOptions.some((option) => option.requires || option.followup);
          const helperCopy = conciseChoiceHelper(group.helper);
          return (
            <details key={group.id} className={`npc-forge-class-choice-group ${complete ? "is-complete" : "is-required"}`} open={!complete}>
              <summary><div><span>Level {group.level} • {group.sourceFeature || group.label}</span><strong>{group.label}</strong></div><em>{selected.length}/{group.count} selected</em></summary>
              <div className="npc-forge-class-choice-group__body">
                {helperCopy ? <p>{helperCopy}</p> : null}
                {group.kind === "expertise" && eligibleNames ? <div className="npc-forge-class-choice-training-note">Only skills already granted by your Background or selected from your class Training pool are eligible for Expertise.</div> : null}
                {compactPicker ? <CompactChoicePicker group={group} selected={selected} options={pickerOptions} onToggle={onToggle} /> : <>
                  {availableOptions.length > 8 ? <input value={query} onChange={(event) => setQueries((current) => ({ ...current, [group.id]: event.target.value }))} placeholder={`Search ${group.label.toLowerCase()}…`} /> : null}
                  <div className="npc-forge-class-choice-group__options">
                    {filtered.map((option) => {
                      const isSelected = selected.includes(option.key);
                      const dependencyEligible = !option.requires || chosenNames.has(normalized(option.requires)) || isSelected;
                      const uniqueEligible = group.allowRepeatAcrossGroups || !chosenNames.has(normalized(option.name)) || isSelected;
                      const trainingEligible = proficiencyEligible(option);
                      const levelEligible = Number(option.minLevel || 1) <= Number(level || 1);
                      const requirement = !trainingEligible ? "proficiency in this skill" : !dependencyEligible ? option.requires : !uniqueEligible ? "already selected in another choice group" : "";
                      return <ClassChoiceOption key={option.key} option={option} selected={isSelected} eligible={levelEligible && dependencyEligible && uniqueEligible && trainingEligible} requirement={requirement} onToggle={() => onToggle?.(group.id, option.key)} />;
                    })}
                  </div>
                  {!filtered.length ? <div className="npc-forge-class-choice-group__empty">{group.kind === "expertise" ? "Choose your skill proficiencies above before assigning Expertise." : "No options match this search."}</div> : null}
                </>}
              </div>
            </details>
          );
        })}
      </div>
      <style jsx global>{`
        .npc-forge-class-choices{display:grid;gap:12px;margin:16px 0;padding:15px;border:1px solid rgba(88,214,199,.32);border-radius:14px;background:linear-gradient(145deg,rgba(13,28,36,.9),rgba(27,18,40,.92))}.npc-forge-class-choices>header{display:flex;justify-content:space-between;gap:18px;align-items:end}.npc-forge-class-choices>header span{color:#8df5e7;font-size:.62rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.npc-forge-class-choices>header h3{margin:3px 0 0;color:#fff;font-size:1rem}.npc-forge-class-choices>header p{max-width:460px;margin:0;color:rgba(255,255,255,.7);font-size:.72rem;line-height:1.5}.npc-forge-class-choices__groups{display:grid;gap:9px}.npc-forge-class-choice-group{border:1px solid rgba(168,108,255,.34);border-radius:11px;background:rgba(15,16,27,.8);overflow:hidden}.npc-forge-class-choice-group.is-required{border-color:rgba(255,143,122,.6)}.npc-forge-class-choice-group.is-complete{border-color:rgba(88,214,199,.5)}.npc-forge-class-choice-group>summary{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:11px 13px;cursor:pointer;list-style:none}.npc-forge-class-choice-group>summary::-webkit-details-marker{display:none}.npc-forge-class-choice-group>summary div{display:grid;gap:2px}.npc-forge-class-choice-group>summary span{color:rgba(255,255,255,.5);font-size:.57rem;text-transform:uppercase}.npc-forge-class-choice-group>summary strong{color:#fff;font-size:.82rem}.npc-forge-class-choice-group>summary em{padding:4px 8px;border-radius:999px;background:rgba(168,108,255,.16);color:#eadfff;font-size:.62rem;font-style:normal}.npc-forge-class-choice-group.is-complete>summary em{background:rgba(88,214,199,.15);color:#c9fff7}.npc-forge-class-choice-group__body{display:grid;gap:10px;padding:0 12px 12px}.npc-forge-class-choice-group__body>p{margin:0;color:rgba(255,255,255,.76);font-size:.74rem;line-height:1.58;white-space:pre-line}.npc-forge-class-choice-group__body>input{width:100%;padding:8px 10px;border:1px solid rgba(255,255,255,.13);border-radius:8px;color:#fff;background:#0c0e17}.npc-forge-class-choice-training-note{padding:8px 10px;border-left:3px solid #58d6c7;border-radius:7px;background:rgba(88,214,199,.07);color:rgba(255,255,255,.72);font-size:.69rem;line-height:1.5}.npc-forge-class-choice-picker{display:grid;gap:8px}.npc-forge-class-choice-picker>label{display:grid;gap:5px}.npc-forge-class-choice-picker>label>span{color:rgba(255,255,255,.62);font-size:.62rem;font-weight:800;text-transform:uppercase}.npc-forge-class-choice-picker select{width:100%;padding:9px 10px;border:1px solid rgba(168,108,255,.45);border-radius:8px;color:#fff;background:#0c0e17}.npc-forge-class-choice-picker__selected{display:grid;gap:7px}.npc-forge-class-choice-picker__selection{padding:7px 9px;border:1px solid rgba(88,214,199,.22);border-radius:8px;background:rgba(88,214,199,.045)}.npc-forge-class-choice-picker__selection>div:first-child{display:flex;align-items:center;justify-content:space-between;gap:8px}.npc-forge-class-choice-picker__selection strong{color:#fff;font-size:.72rem}.npc-forge-class-choice-picker__selection button{padding:3px 7px;border:1px solid rgba(255,255,255,.16);border-radius:6px;color:#ffd9d1;background:rgba(255,143,122,.08);font-size:.58rem}.npc-forge-class-choice-picker__empty{padding:7px 9px;color:rgba(255,255,255,.5);font-size:.65rem}.npc-forge-class-choice-selected-detail{margin-top:6px;padding:6px 8px;border-top:1px solid rgba(255,255,255,.07)}.npc-forge-class-choice-selected-detail summary{cursor:pointer;color:#d7bfff;font-size:.64rem}.npc-forge-class-choice-selected-detail p{margin:7px 0 0;color:rgba(255,255,255,.8);font-size:.7rem;line-height:1.55}.npc-forge-class-choice-group__options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.npc-forge-class-choice-option{display:grid;gap:7px;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.025)}.npc-forge-class-choice-option.is-selected{border-color:#a86cff;background:rgba(126,72,199,.16)}.npc-forge-class-choice-option.is-locked{opacity:.58}.npc-forge-class-choice-option__head{display:flex;justify-content:space-between;gap:9px;align-items:start}.npc-forge-class-choice-option__head>div{display:grid;gap:2px}.npc-forge-class-choice-option__head strong{color:#fff;font-size:.76rem}.npc-forge-class-choice-option__head small{color:rgba(255,255,255,.5);font-size:.58rem}.npc-forge-class-choice-option__head button{padding:4px 8px;border:1px solid rgba(168,108,255,.55);border-radius:7px;color:#fff;background:rgba(126,72,199,.22);font-size:.6rem}.npc-forge-class-choice-option.is-selected .npc-forge-class-choice-option__head button{border-color:#58d6c7;background:rgba(88,214,199,.16);color:#d5fff9}.npc-forge-class-choice-option details{border-top:1px solid rgba(255,255,255,.07);padding-top:6px}.npc-forge-class-choice-option summary{cursor:pointer;color:#d7bfff;font-size:.64rem}.npc-forge-class-choice-option p{margin:7px 0 0;color:rgba(255,255,255,.8);font-size:.7rem;line-height:1.55}.npc-forge-class-choice-option__requirement,.npc-forge-class-choice-option__followup{display:block;margin-top:6px;color:#ffd38a;font-size:.62rem;line-height:1.45}.npc-forge-class-choice-spellcard{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px}.npc-forge-class-choice-spellcard>div{display:grid;gap:2px;padding:6px 7px;border:1px solid rgba(255,255,255,.09);border-radius:7px;background:rgba(9,12,22,.62)}.npc-forge-class-choice-spellcard span{color:#9fd7ff;font-size:.52rem;font-weight:800;text-transform:uppercase}.npc-forge-class-choice-spellcard strong{color:#fff;font-size:.64rem}.npc-forge-class-choice-spellcard em{padding:4px 7px;border-radius:999px;background:rgba(88,214,199,.12);color:#bffdf4;font-size:.56rem;font-style:normal;text-align:center}.npc-forge-class-choice-group__empty{padding:12px;color:rgba(255,255,255,.5);text-align:center}@media(max-width:900px){.npc-forge-class-choice-group__options{grid-template-columns:1fr}.npc-forge-class-choices>header{align-items:start;flex-direction:column}.npc-forge-class-choice-spellcard{grid-template-columns:repeat(2,minmax(0,1fr))}}
      `}</style>
    </section>
    {sourceClassChoices}
    </>
  );
}

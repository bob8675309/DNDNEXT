import { useState } from "react";
import { classMenuArtworkFor, handleClassArtworkError } from "../utils/classes/classArtwork";
import { classPresentationSummary, isSidekickClass } from "../utils/classes/classPresentation";
import { sourceLabel } from "./NpcForgeCoreSupport";

const classNameFor = (row = {}) => String(row.class_name || row.name || "Class").trim();

function ClassPortrait({ classKey, name }) {
  return <span className="npc-forge-class-catalog-portrait" aria-hidden="true"><img src={classMenuArtworkFor(classKey)} onError={handleClassArtworkError} alt="" /></span>;
}

function ClassChoiceRow({ row, selectedId = "", onSelect = null, child = false }) {
  const active = String(selectedId) === String(row?.id || "");
  const name = classNameFor(row);
  return <button type="button" data-class-key={String(row?.class_key || "").trim().toLowerCase()} className={`npc-forge-class-catalog-row${child ? " is-child" : ""}${active ? " is-active" : ""}`} onClick={() => onSelect?.(row)}>
    <ClassPortrait classKey={row?.class_key} name={name} />
    <span className="npc-forge-class-catalog-copy"><strong>{name}</strong><small>{classPresentationSummary(row, "Open the class guide for its complete progression.")}</small><em>{sourceLabel(row?.source)}</em></span>
    {active ? <b className="npc-forge-class-catalog-check" aria-label="Selected">✓</b> : null}
  </button>;
}

export default function NpcForgeClassCatalog({ query = "", onQuery = null, rows = [], selectedId = "", onSelect = null, emptyText = "No classes match this search." }) {
  const [sidekicksOpen, setSidekicksOpen] = useState(false);
  const sidekicks = rows.filter(isSidekickClass);
  const regular = rows.filter((row) => !isSidekickClass(row));
  const selectedSidekick = sidekicks.some((row) => String(row.id) === String(selectedId));
  const searchActive = Boolean(String(query || "").trim());
  const sidekickExpanded = sidekicksOpen || selectedSidekick || searchActive;
  const beforeSidekick = regular.filter((row) => classNameFor(row).localeCompare("Sidekick") < 0);
  const afterSidekick = regular.filter((row) => classNameFor(row).localeCompare("Sidekick") >= 0);

  const sidekickFamily = sidekicks.length ? <section className={`npc-forge-class-family${sidekickExpanded ? " is-open" : ""}`} aria-label="Sidekick classes">
    <button type="button" className="npc-forge-class-family-row" aria-expanded={sidekickExpanded} onClick={() => setSidekicksOpen((value) => !value)}>
      <ClassPortrait classKey="sidekick" name="Sidekick" />
      <span className="npc-forge-class-catalog-copy"><strong>Sidekick</strong><small>Expand to choose Expert, Warrior, or Spellcaster.</small><em>{sidekicks.length} available path{sidekicks.length === 1 ? "" : "s"}</em></span>
      <b className="npc-forge-class-family-chevron" aria-hidden="true">{sidekickExpanded ? "⌄" : "›"}</b>
    </button>
    {sidekickExpanded ? <div className="npc-forge-class-family-children">{sidekicks.map((row) => <ClassChoiceRow key={row.id} row={row} selectedId={selectedId} onSelect={onSelect} child />)}</div> : null}
  </section> : null;

  return <div className="npc-forge-catalog npc-forge-class-catalog">
    <input className="npc-forge-search" value={query} onChange={(event) => onQuery?.(event.target.value)} placeholder="Search classes…" aria-label={`Search ${rows.length} classes`} />
    <div className="npc-forge-catalog-list npc-forge-class-catalog-list">
      {beforeSidekick.map((row) => <ClassChoiceRow key={row.id} row={row} selectedId={selectedId} onSelect={onSelect} />)}
      {sidekickFamily}
      {afterSidekick.map((row) => <ClassChoiceRow key={row.id} row={row} selectedId={selectedId} onSelect={onSelect} />)}
      {!rows.length ? <div className="npc-forge-empty-list">{emptyText}</div> : null}
    </div>
    <style jsx global>{`
      .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-class-selection>.npc-forge-section-heading{display:none!important}
      .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-preview>.npc-forge-context-card:not(.npc-forge-class-guide)>p{display:none!important}
      .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-preview>.npc-forge-context-card:not(.npc-forge-class-guide){min-height:0!important;padding:8px 10px!important}
      .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-class-selection{grid-template-rows:auto minmax(390px,1fr) 0!important;gap:7px!important}
      .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-level-row{margin:0!important;gap:5px!important}
      .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-level-row>label,.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-level-row>div{min-height:44px!important;padding:5px 7px!important}
      .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-level-row span{font-size:.47rem!important}.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-level-row strong{font-size:.72rem!important}.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-level-row input{min-height:27px!important;padding:3px 5px!important}
      .unified-player-character-forge .npc-forge-class-catalog{display:grid;grid-template-rows:auto minmax(260px,1fr);gap:6px;min-height:0}.unified-player-character-forge .npc-forge-class-catalog .npc-forge-search{min-height:36px!important;padding:7px 10px!important;font-size:.62rem!important}
      .unified-player-character-forge .npc-forge-class-catalog-list{align-content:start;min-height:0;overflow:auto;overscroll-behavior:contain;padding-right:4px;gap:4px!important}
      .unified-player-character-forge .npc-forge-class-catalog-row,.unified-player-character-forge .npc-forge-class-family-row{display:grid!important;grid-template-columns:43px minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;width:100%!important;min-height:57px!important;padding:5px 7px!important;border:1px solid rgba(255,255,255,.09)!important;border-radius:7px!important;color:#fff!important;background:linear-gradient(90deg,rgba(15,21,34,.97),rgba(8,14,24,.95))!important;text-align:left!important}
      .unified-player-character-forge .npc-forge-class-catalog-row:hover,.unified-player-character-forge .npc-forge-class-family-row:hover{border-color:rgba(168,108,255,.48)!important;background:linear-gradient(90deg,rgba(33,25,49,.98),rgba(10,18,29,.96))!important}
      .unified-player-character-forge .npc-forge-class-catalog-row.is-active{border-color:#a86cff!important;background:linear-gradient(90deg,rgba(95,49,145,.27),rgba(25,25,49,.95) 62%,rgba(22,49,55,.18))!important;box-shadow:inset 3px 0 #a86cff,0 0 17px rgba(126,72,199,.08)!important}
      .unified-player-character-forge .npc-forge-class-catalog-portrait{display:block;width:41px;height:47px;overflow:hidden;border:1px solid rgba(168,108,255,.26);border-radius:6px;background:#111522;box-shadow:0 2px 9px rgba(0,0,0,.28)}.unified-player-character-forge .npc-forge-class-catalog-portrait img{display:block;width:100%;height:100%;object-fit:cover;object-position:center 22%}
      .unified-player-character-forge .npc-forge-class-catalog-copy{display:grid;align-content:center;gap:2px;min-width:0}.unified-player-character-forge .npc-forge-class-catalog-copy strong{color:#f0e5f7;font-family:Georgia,"Times New Roman",serif;font-size:.67rem;font-weight:600;line-height:1.14}.unified-player-character-forge .npc-forge-class-catalog-copy small{display:-webkit-box;overflow:hidden;color:rgba(255,255,255,.56)!important;font-family:Georgia,"Times New Roman",serif;font-size:.46rem!important;line-height:1.25;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal}.unified-player-character-forge .npc-forge-class-catalog-copy em{display:none!important}
      .unified-player-character-forge .npc-forge-class-catalog-check{display:grid;place-items:center;width:19px;height:19px;border:1px solid #58d6c7;border-radius:50%;color:#07110f!important;background:#58d6c7;font-size:.55rem}.unified-player-character-forge .npc-forge-class-family{display:grid;gap:3px;margin:2px 0}.unified-player-character-forge .npc-forge-class-family-row{border-color:rgba(168,108,255,.25)!important;background:linear-gradient(90deg,rgba(43,26,64,.48),rgba(9,15,25,.96))!important}.unified-player-character-forge .npc-forge-class-family-chevron{display:grid;place-items:center;width:21px;height:21px;border:1px solid rgba(168,108,255,.32);border-radius:50%;color:#e8dfff!important;background:rgba(126,72,199,.1);font-size:.74rem}.unified-player-character-forge .npc-forge-class-family-children{display:grid;gap:3px;margin-left:13px;padding-left:8px;border-left:1px solid rgba(168,108,255,.32)}.unified-player-character-forge .npc-forge-class-catalog-row.is-child{min-height:52px!important;background:rgba(9,14,24,.9)!important}.unified-player-character-forge .npc-forge-class-catalog-row.is-child .npc-forge-class-catalog-portrait{width:37px;height:43px}
      @media(max-width:900px){.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-class-selection{grid-template-rows:auto auto!important}.unified-player-character-forge .npc-forge-class-catalog{grid-template-rows:auto auto}.unified-player-character-forge .npc-forge-class-catalog-list{max-height:440px}.unified-player-character-forge .npc-forge-class-family-children{margin-left:9px}}
    `}</style>
  </div>;
}

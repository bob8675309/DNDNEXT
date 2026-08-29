import { useState } from "react";
import { classArtworkFor, handleClassArtworkError } from "../utils/classes/classArtwork";
import { classPresentationSummary, isSidekickClass } from "../utils/classes/classPresentation";
import { sourceLabel } from "./NpcForgeCoreSupport";

const classNameFor = (row = {}) => String(row.class_name || row.name || "Class").trim();

function ClassPortrait({ classKey, name }) {
  return <span className="npc-forge-class-catalog-portrait" aria-hidden="true"><img src={classArtworkFor(classKey)} onError={handleClassArtworkError} alt="" /></span>;
}

function ClassChoiceRow({ row, selectedId = "", onSelect = null, child = false }) {
  const active = String(selectedId) === String(row?.id || "");
  const name = classNameFor(row);
  return <button type="button" className={`npc-forge-class-catalog-row${child ? " is-child" : ""}${active ? " is-active" : ""}`} onClick={() => onSelect?.(row)}>
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
      .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-class-selection>.npc-forge-section-heading{display:none!important}.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-preview>.npc-forge-context-card:not(.npc-forge-class-guide)>p{display:none!important}.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-preview>.npc-forge-context-card:not(.npc-forge-class-guide){min-height:0!important;padding:10px 12px!important}.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-class-selection{grid-template-rows:auto minmax(390px,1fr) 0!important;gap:8px!important}.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-level-row{margin:0!important;gap:6px!important}.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-level-row>label,.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-level-row>div{min-height:52px!important;padding:7px 9px!important}.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-level-row span{font-size:.5rem!important}.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-level-row strong{font-size:.78rem!important}.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-level-row input{min-height:30px!important;padding:4px 6px!important}.unified-player-character-forge .npc-forge-class-catalog{display:grid;grid-template-rows:auto minmax(260px,1fr);gap:6px;min-height:0}.unified-player-character-forge .npc-forge-class-catalog .npc-forge-search{min-height:34px!important;padding:6px 9px!important;font-size:.62rem!important}.unified-player-character-forge .npc-forge-class-catalog-list{align-content:start;min-height:0;overflow:auto;overscroll-behavior:contain;padding-right:3px}.unified-player-character-forge .npc-forge-class-catalog-row,.unified-player-character-forge .npc-forge-class-family-row{display:grid!important;grid-template-columns:34px minmax(0,1fr) auto!important;align-items:center!important;gap:7px!important;width:100%!important;min-height:46px!important;padding:4px 7px!important;border:1px solid rgba(255,255,255,.085)!important;border-radius:7px!important;color:#fff!important;background:linear-gradient(90deg,rgba(19,25,39,.96),rgba(13,18,29,.92))!important;text-align:left!important}.unified-player-character-forge .npc-forge-class-catalog-row:hover,.unified-player-character-forge .npc-forge-class-family-row:hover{border-color:rgba(168,108,255,.45)!important;background:linear-gradient(90deg,rgba(35,27,53,.98),rgba(15,21,32,.94))!important}.unified-player-character-forge .npc-forge-class-catalog-row.is-active{border-color:#a86cff!important;background:linear-gradient(90deg,rgba(126,72,199,.22),rgba(88,214,199,.045))!important;box-shadow:inset 3px 0 #a86cff}.unified-player-character-forge .npc-forge-class-catalog-portrait{display:block;width:32px;height:36px;overflow:hidden;border:1px solid rgba(168,108,255,.28);border-radius:6px;background:#111522}.unified-player-character-forge .npc-forge-class-catalog-portrait img{display:block;width:100%;height:100%;object-fit:cover;object-position:center 22%}.unified-player-character-forge .npc-forge-class-catalog-copy{display:grid;gap:1px;min-width:0}.unified-player-character-forge .npc-forge-class-catalog-copy strong{color:#fff;font-size:.59rem;line-height:1.14}.unified-player-character-forge .npc-forge-class-catalog-copy small{display:block;overflow:hidden;color:rgba(255,255,255,.56)!important;font-size:.43rem!important;line-height:1.2;white-space:nowrap;text-overflow:ellipsis}.unified-player-character-forge .npc-forge-class-catalog-copy em{color:rgba(119,225,211,.66);font-size:.4rem;font-style:normal;font-weight:800;letter-spacing:.025em}.unified-player-character-forge .npc-forge-class-catalog-check{display:grid;place-items:center;width:18px;height:18px;border:1px solid #58d6c7;border-radius:50%;color:#07110f!important;background:#58d6c7;font-size:.54rem}.unified-player-character-forge .npc-forge-class-family{display:grid;gap:3px;margin:2px 0}.unified-player-character-forge .npc-forge-class-family-row{border-color:rgba(168,108,255,.27)!important;background:linear-gradient(90deg,rgba(49,29,73,.54),rgba(13,18,29,.94))!important}.unified-player-character-forge .npc-forge-class-family-chevron{display:grid;place-items:center;width:21px;height:21px;border:1px solid rgba(168,108,255,.32);border-radius:50%;color:#e8dfff!important;background:rgba(126,72,199,.1);font-size:.74rem}.unified-player-character-forge .npc-forge-class-family-children{display:grid;gap:3px;margin-left:12px;padding-left:8px;border-left:1px solid rgba(168,108,255,.38)}.unified-player-character-forge .npc-forge-class-catalog-row.is-child{min-height:44px!important;background:rgba(12,16,27,.86)!important}.unified-player-character-forge .npc-forge-class-catalog-row.is-child .npc-forge-class-catalog-portrait{width:30px;height:34px}@media(max-width:900px){.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-class-selection{grid-template-rows:auto auto!important}.unified-player-character-forge .npc-forge-class-catalog{grid-template-rows:auto auto}.unified-player-character-forge .npc-forge-class-catalog-list{max-height:440px}.unified-player-character-forge .npc-forge-class-family-children{margin-left:9px}}
    `}</style>
  </div>;
}

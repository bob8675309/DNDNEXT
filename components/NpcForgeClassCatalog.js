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
      <span className="npc-forge-class-catalog-copy"><strong>Sidekick</strong><small>NPC companion progression from Tasha's Cauldron of Everything. Expand to choose Expert, Warrior, or Spellcaster.</small><em>{sidekicks.length} available path{sidekicks.length === 1 ? "" : "s"}</em></span>
      <b className="npc-forge-class-family-chevron" aria-hidden="true">{sidekickExpanded ? "⌄" : "›"}</b>
    </button>
    {sidekickExpanded ? <div className="npc-forge-class-family-children">{sidekicks.map((row) => <ClassChoiceRow key={row.id} row={row} selectedId={selectedId} onSelect={onSelect} child />)}</div> : null}
  </section> : null;

  return <div className="npc-forge-catalog npc-forge-class-catalog">
    <div className="npc-forge-catalog-head"><span>Classes</span><strong>{rows.length}</strong></div>
    <input className="npc-forge-search" value={query} onChange={(event) => onQuery?.(event.target.value)} placeholder="Search classes…" />
    <div className="npc-forge-catalog-list npc-forge-class-catalog-list">
      {beforeSidekick.map((row) => <ClassChoiceRow key={row.id} row={row} selectedId={selectedId} onSelect={onSelect} />)}
      {sidekickFamily}
      {afterSidekick.map((row) => <ClassChoiceRow key={row.id} row={row} selectedId={selectedId} onSelect={onSelect} />)}
      {!rows.length ? <div className="npc-forge-empty-list">{emptyText}</div> : null}
    </div>
    <style jsx global>{`
      .unified-player-character-forge .npc-forge-class-catalog{display:grid;grid-template-rows:auto auto minmax(180px,1fr);gap:7px;min-height:0}.unified-player-character-forge .npc-forge-class-catalog-list{align-content:start;min-height:0;overflow:auto;overscroll-behavior:contain;padding-right:3px}.unified-player-character-forge .npc-forge-class-catalog-row,.unified-player-character-forge .npc-forge-class-family-row{display:grid!important;grid-template-columns:42px minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;width:100%!important;min-height:58px!important;padding:6px 8px!important;border:1px solid rgba(255,255,255,.085)!important;border-radius:7px!important;color:#fff!important;background:linear-gradient(90deg,rgba(19,25,39,.96),rgba(13,18,29,.92))!important;text-align:left!important}.unified-player-character-forge .npc-forge-class-catalog-row:hover,.unified-player-character-forge .npc-forge-class-family-row:hover{border-color:rgba(168,108,255,.45)!important;background:linear-gradient(90deg,rgba(35,27,53,.98),rgba(15,21,32,.94))!important}.unified-player-character-forge .npc-forge-class-catalog-row.is-active{border-color:#a86cff!important;background:linear-gradient(90deg,rgba(126,72,199,.22),rgba(88,214,199,.045))!important;box-shadow:inset 3px 0 #a86cff}.unified-player-character-forge .npc-forge-class-catalog-portrait{display:block;width:40px;height:46px;overflow:hidden;border:1px solid rgba(168,108,255,.28);border-radius:7px;background:#111522}.unified-player-character-forge .npc-forge-class-catalog-portrait img{display:block;width:100%;height:100%;object-fit:cover;object-position:center 22%}.unified-player-character-forge .npc-forge-class-catalog-copy{display:grid;gap:2px;min-width:0}.unified-player-character-forge .npc-forge-class-catalog-copy strong{color:#fff;font-size:.64rem;line-height:1.2}.unified-player-character-forge .npc-forge-class-catalog-copy small{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;color:rgba(255,255,255,.58)!important;font-size:.48rem!important;line-height:1.28}.unified-player-character-forge .npc-forge-class-catalog-copy em{color:rgba(119,225,211,.66);font-size:.44rem;font-style:normal;font-weight:800;letter-spacing:.025em}.unified-player-character-forge .npc-forge-class-catalog-check{display:grid;place-items:center;width:19px;height:19px;border:1px solid #58d6c7;border-radius:50%;color:#07110f!important;background:#58d6c7;font-size:.58rem}.unified-player-character-forge .npc-forge-class-family{display:grid;gap:3px;margin:2px 0}.unified-player-character-forge .npc-forge-class-family-row{border-color:rgba(168,108,255,.27)!important;background:linear-gradient(90deg,rgba(49,29,73,.54),rgba(13,18,29,.94))!important}.unified-player-character-forge .npc-forge-class-family-chevron{display:grid;place-items:center;width:23px;height:23px;border:1px solid rgba(168,108,255,.32);border-radius:50%;color:#e8dfff!important;background:rgba(126,72,199,.1);font-size:.82rem}.unified-player-character-forge .npc-forge-class-family-children{display:grid;gap:3px;margin-left:16px;padding-left:9px;border-left:1px solid rgba(168,108,255,.38)}.unified-player-character-forge .npc-forge-class-catalog-row.is-child{min-height:54px!important;background:rgba(12,16,27,.86)!important}.unified-player-character-forge .npc-forge-class-catalog-row.is-child .npc-forge-class-catalog-portrait{width:36px;height:41px}@media(max-width:900px){.unified-player-character-forge .npc-forge-class-catalog{grid-template-rows:auto auto auto}.unified-player-character-forge .npc-forge-class-catalog-list{max-height:420px}.unified-player-character-forge .npc-forge-class-family-children{margin-left:9px}}
    `}</style>
  </div>;
}

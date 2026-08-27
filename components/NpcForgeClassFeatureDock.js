import ClassFeatureText from "./ClassFeatureText";
import ItemCard from "./ItemCard";
import { formatPlayerFacingText } from "../utils/playerFacingText";
import { classPresentationSummary } from "../utils/classes/classPresentation";

function safeText(value) {
  return String(value ?? "").trim();
}

export default function NpcForgeClassFeatureDock({ detail = null, selectedClass = null }) {
  const feature = detail?.type === "classFeature" ? detail.feature : null;
  const title = feature?.name || selectedClass?.class_name || "Class feature details";
  const description = feature?.description
    ? formatPlayerFacingText(feature.description)
    : formatPlayerFacingText(
      classPresentationSummary(selectedClass),
      "Hover or focus a class or subclass feature to inspect it here without leaving the class catalogue.",
    );
  const source = safeText(feature?.source || selectedClass?.source || "Campaign");
  const level = Number(feature?.level || 0);
  const isListedOption = feature?.type === "listed-option";
  const type = isListedOption ? "Listed Option" : feature?.type === "subclass" ? "Subclass Feature" : feature ? "Class Feature" : "Class Overview";
  const parentFeatureName = safeText(feature?.parentFeatureName || detail?.parentFeatureName);
  const canonicalItem = isListedOption && feature?.detailKind === "item" && feature?.metadata?.itemCard
    ? feature.metadata.itemCard
    : null;

  return (
    <section className={`npc-forge-class-feature-dock ${feature ? "has-feature" : "is-placeholder"}`}>
      <div className="npc-forge-class-feature-dock__head">
        <div>
          <span>{type}</span>
          <h3>{detail?.subclassName && feature?.type === "subclass" ? `${detail.subclassName}: ` : ""}{title}</h3>
        </div>
        <em>{source}</em>
      </div>
      <div className="npc-forge-class-feature-dock__meta">
        {level ? <span>Level {level}</span> : null}
        {selectedClass?.class_name ? <span>{selectedClass.class_name}</span> : null}
        {feature?.type === "subclass" && detail?.subclassName ? <span>{detail.subclassName}</span> : null}
        {isListedOption && parentFeatureName ? <span>From {parentFeatureName}</span> : null}
      </div>
      <ClassFeatureText text={description} entries={feature?.entries || null} compact />
      {canonicalItem ? <div className="npc-forge-class-feature-dock__item-card" aria-label={`${title} canonical item card`}><ItemCard item={canonicalItem} /></div> : null}
      {!feature ? <small>Feature descriptions will appear here as you move through the progression table or detailed guide.</small> : null}
      {isListedOption ? <div className="npc-forge-class-feature-dock__listed-note">This is a listed option inside <strong>{parentFeatureName || "the selected feature"}</strong>. The description comes from the normalized class-option or canonical item catalogue when a matching entry exists; otherwise the parent feature remains the mechanical authority.</div> : null}
      {selectedClass ? <div className="npc-forge-class-feature-dock__routing-note">Read feature rules here. Persistent selections such as Invocations, Fighting Styles, maneuvers, plans, and higher-level feats are completed in <strong>Training → Feats & Class Abilities</strong>; spell-specific selections are completed in <strong>Spells</strong>.</div> : null}
      <style jsx global>{`
        .npc-forge-class-feature-dock__routing-note,.npc-forge-class-feature-dock__listed-note{margin-top:10px;padding:9px 11px;border-left:3px solid #58d6c7;border-radius:8px;color:rgba(255,255,255,.78);background:rgba(88,214,199,.065);font-size:.68rem;line-height:1.5}.npc-forge-class-feature-dock__listed-note{border-left-color:#a86cff;background:rgba(126,72,199,.075)}.npc-forge-class-feature-dock__routing-note strong,.npc-forge-class-feature-dock__listed-note strong{color:#d8fff9}.npc-forge-class-feature-dock__item-card{margin-top:11px}.npc-forge-class-feature-dock__item-card .sitem-card{margin-bottom:0!important;background:rgba(12,15,24,.94)}.npc-forge-class-feature-dock__item-card .card-body{padding:.8rem}.npc-forge-class-feature-dock__item-card .sitem-title{font-size:.82rem}.npc-forge-class-feature-dock__item-card .sitem-section{font-size:.68rem;line-height:1.5}
      `}</style>
    </section>
  );
}

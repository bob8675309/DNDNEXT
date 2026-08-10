import ClassFeatureText from "./ClassFeatureText";
import { formatPlayerFacingText } from "../utils/playerFacingText";

function safeText(value) {
  return String(value ?? "").trim();
}

export default function NpcForgeClassFeatureDock({ detail = null, selectedClass = null }) {
  const feature = detail?.type === "classFeature" ? detail.feature : null;
  const title = feature?.name || selectedClass?.class_name || "Class feature details";
  const description = feature?.description
    ? formatPlayerFacingText(feature.description)
    : formatPlayerFacingText(
      selectedClass?.summary,
      "Hover or focus a class or subclass feature to inspect it here without leaving the class catalogue.",
    );
  const source = safeText(feature?.source || selectedClass?.source || "Campaign");
  const level = Number(feature?.level || 0);
  const type = feature?.type === "subclass" ? "Subclass Feature" : feature ? "Class Feature" : "Class Overview";

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
      </div>
      <ClassFeatureText text={description} compact />
      {!feature ? <small>Feature descriptions will appear here as you move through the progression table or detailed guide.</small> : null}
      {selectedClass ? <div className="npc-forge-class-feature-dock__routing-note">Read feature rules here. Persistent selections such as Invocations, Fighting Styles, maneuvers, plans, and higher-level feats are completed in <strong>Training → Feats & Class Abilities</strong>; spell-specific selections are completed in <strong>Spells</strong>.</div> : null}
      <style jsx global>{`
        .npc-forge-class-feature-dock__routing-note{margin-top:10px;padding:9px 11px;border-left:3px solid #58d6c7;border-radius:8px;color:rgba(255,255,255,.7);background:rgba(88,214,199,.065);font-size:.68rem;line-height:1.5}.npc-forge-class-feature-dock__routing-note strong{color:#d8fff9}
      `}</style>
    </section>
  );
}

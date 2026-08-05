import NpcForgeContextPanelRefined from "./NpcForgeContextPanelRefined";
import NpcForgeClassGuide from "./NpcForgeClassGuide";

export default function NpcForgeContextPanel(props) {
  const activeClass = props?.detail?.type === "class" && props.detail.option
    ? props.detail.option
    : Number(props?.step) === 2
      ? props?.selectedClass
      : null;

  return <>
    {activeClass
      ? <NpcForgeClassGuide selectedClass={activeClass} level={props?.draft?.level || 1} />
      : <NpcForgeContextPanelRefined {...props} />}
    <style jsx global>{`
      .npc-forge-context-card.is-species{
        display:grid!important;
        grid-template-columns:minmax(220px,35fr) minmax(0,65fr)!important;
        align-items:start!important;
        column-gap:16px!important;
      }
      .npc-forge-context-card.is-species>.npc-forge-species-artwork{
        grid-column:1!important;
        grid-row:1!important;
        align-self:stretch!important;
        margin:0!important;
      }
      .npc-forge-context-card.is-species>.npc-forge-species-lore{
        grid-column:2!important;
        grid-row:1!important;
        align-self:stretch!important;
        min-width:0!important;
        margin:0!important;
      }
      .npc-forge-context-card.is-species>.npc-forge-context-rows,
      .npc-forge-context-card.is-species>.npc-forge-species-features,
      .npc-forge-context-card.is-species>.npc-forge-context-note{
        grid-column:1/-1!important;
      }
      @media(max-width:900px){
        .npc-forge-context-card.is-species{grid-template-columns:minmax(0,1fr)!important}
        .npc-forge-context-card.is-species>.npc-forge-species-artwork,
        .npc-forge-context-card.is-species>.npc-forge-species-lore,
        .npc-forge-context-card.is-species>.npc-forge-context-rows,
        .npc-forge-context-card.is-species>.npc-forge-species-features,
        .npc-forge-context-card.is-species>.npc-forge-context-note{grid-column:1!important;grid-row:auto!important}
      }
    `}</style>
  </>;
}

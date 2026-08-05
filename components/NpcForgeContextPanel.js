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
        grid-template-columns:minmax(300px,43fr) minmax(0,57fr)!important;
        align-items:start!important;
        column-gap:20px!important;
      }
      .npc-forge-context-card.is-species>.npc-forge-species-artwork{
        grid-column:1!important;
        grid-row:1 / span 2!important;
        align-self:start!important;
        width:100%!important;
        min-height:360px!important;
        aspect-ratio:3 / 4!important;
        margin:0!important;
      }
      .npc-forge-context-card.is-species>.npc-forge-species-artwork img{
        object-fit:cover!important;
        object-position:center top!important;
      }
      .npc-forge-context-card.is-species>.npc-forge-species-lore{
        grid-column:2!important;
        grid-row:1!important;
        align-self:start!important;
        min-width:0!important;
        min-height:190px!important;
        margin:0!important;
        padding:18px 20px!important;
      }
      .npc-forge-context-card.is-species>.npc-forge-context-rows,
      .npc-forge-context-card.is-species>.npc-forge-species-features{
        grid-column:2!important;
      }
      .npc-forge-context-card.is-species>.npc-forge-context-note{
        grid-column:1/-1!important;
      }
      @media(max-width:1120px){
        .npc-forge-context-card.is-species{grid-template-columns:minmax(260px,40fr) minmax(0,60fr)!important}
        .npc-forge-context-card.is-species>.npc-forge-species-artwork{min-height:320px!important}
      }
      @media(max-width:900px){
        .npc-forge-context-card.is-species{grid-template-columns:minmax(0,1fr)!important}
        .npc-forge-context-card.is-species>.npc-forge-species-artwork,
        .npc-forge-context-card.is-species>.npc-forge-species-lore,
        .npc-forge-context-card.is-species>.npc-forge-context-rows,
        .npc-forge-context-card.is-species>.npc-forge-species-features,
        .npc-forge-context-card.is-species>.npc-forge-context-note{grid-column:1!important;grid-row:auto!important}
        .npc-forge-context-card.is-species>.npc-forge-species-artwork{width:min(100%,460px)!important;justify-self:center!important;min-height:0!important}
      }
    `}</style>
  </>;
}

export default function NpcForgeClassGuideStyles() {
  return <style jsx global>{`
    .npc-forge-class-guide{gap:14px!important;padding:14px!important;background:linear-gradient(160deg,rgba(18,14,28,.98),rgba(6,8,14,.99))!important}
    .npc-forge-class-guide::before{margin-bottom:2px}
    .npc-forge-class-guide__view-header{margin:0!important;align-items:center!important;border-color:rgba(171,120,255,.28)!important;background:linear-gradient(145deg,rgba(39,25,58,.72),rgba(13,12,22,.92))!important}
    .npc-forge-class-guide__view-header h2{color:#fff7e6}
    .npc-forge-class-guide__tabs{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap}
    .npc-forge-class-guide__tabs button,.npc-forge-class-guide__controls button{padding:7px 10px;border:1px solid rgba(255,255,255,.22);border-radius:7px;color:rgba(255,255,255,.9);background:rgba(255,255,255,.035);font-size:.72rem;font-weight:800}
    .npc-forge-class-guide__tabs button.is-active,.npc-forge-class-guide__controls button.is-primary{border-color:#a86cff;color:#fff;background:#7c45ca}
    .npc-forge-class-guide__controls button:disabled{opacity:.5}
    .npc-forge-class-guide__subclasses{display:grid;gap:10px;padding:14px;border:1px solid rgba(88,214,199,.28);border-radius:12px;background:linear-gradient(135deg,rgba(26,120,143,.1),rgba(27,18,40,.5))}
    .npc-forge-class-guide__subclasses.is-required{border-color:rgba(255,121,121,.58);background:linear-gradient(135deg,rgba(126,25,35,.18),rgba(27,18,40,.55))}
    .npc-forge-class-guide__subclasses>p{margin:0;color:rgba(255,255,255,.68);font-size:.72rem}
    .npc-forge-class-guide__subclasses>.npc-forge-class-guide__requirement{color:#ffc4c4}
    .npc-forge-class-guide__subhead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
    .npc-forge-class-guide__subhead>div{display:grid;gap:2px}
    .npc-forge-class-guide__subhead span{color:#d5b6ff;font-size:.63rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
    .npc-forge-class-guide__subhead strong{color:#fff;font-size:.9rem}
    .npc-forge-class-guide__subhead label{color:rgba(255,255,255,.72);font-size:.7rem}
    .npc-forge-class-guide__controls{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:end;gap:8px}
    .npc-forge-class-guide__controls label{display:grid;gap:4px}
    .npc-forge-class-guide__controls label span{color:rgba(255,255,255,.58);font-size:.62rem;text-transform:uppercase}
    .npc-forge-class-guide__controls select{width:100%;min-width:0;padding:8px;border:1px solid rgba(255,255,255,.2);border-radius:7px;color:#fff;background:#111522}
    .npc-forge-class-guide__compare{display:grid;gap:8px;max-height:320px;overflow:auto;scrollbar-gutter:stable}
    .npc-forge-class-guide__compare.is-all{grid-template-columns:repeat(2,minmax(0,1fr))}
    .npc-forge-class-guide__compare article{display:grid;gap:6px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.025)}
    .npc-forge-class-guide__compare article.is-selected{border-color:#58d6c7;box-shadow:inset 3px 0 #58d6c7}
    .npc-forge-class-guide__compare span{color:#75e3d6;font-size:.6rem;font-weight:900}
    .npc-forge-class-guide__compare strong{color:#fff;font-size:1rem}
    .npc-forge-class-guide__compare small{color:rgba(255,255,255,.52);font-size:.65rem}
    .npc-forge-class-guide__compare p{margin:0;color:rgba(255,255,255,.74);font-size:.72rem;line-height:1.55}
    .npc-forge-class-guide__compare em{color:#f1c878;font-size:.63rem}
    .npc-forge-class-guide__warning,.npc-forge-class-guide__loading{padding:10px 12px;border-radius:9px;color:#ffd5a2;background:rgba(132,73,24,.18);font-size:.74rem}
    .npc-forge-class-guide__book,.npc-forge-class-guide__overview-book{min-width:0}
    .npc-forge-class-guide__book .class-book-guide__outline{top:0;max-height:min(70vh,760px)}
    .npc-forge-class-guide__book-hero{grid-template-columns:minmax(0,1fr) minmax(320px,42%);min-height:360px}
    .npc-forge-class-guide__book-hero img{min-height:360px;object-position:center top}
    .npc-forge-class-guide__book-hero h2{font-size:clamp(2.35rem,5vw,4.2rem)}
    .npc-forge-class-guide__overview-body{display:grid;gap:14px;padding:clamp(1rem,2.2vw,1.6rem)}
    .npc-forge-class-guide__stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .npc-forge-class-guide__stats>div{display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;padding:11px 12px;border:1px solid rgba(255,255,255,.09);border-radius:9px;background:rgba(255,255,255,.018)}
    .npc-forge-class-guide__stats span{color:rgba(255,255,255,.52);font-size:.65rem;text-transform:uppercase}
    .npc-forge-class-guide__stats strong{color:#fff;font-size:.76rem}
    .npc-forge-class-guide__table-card{max-height:540px;overflow:auto!important;scrollbar-gutter:stable}
    .npc-forge-class-guide__detail{margin:0!important;min-height:150px}
    .npc-forge-class-guide__detail small{color:rgba(255,255,255,.55)}
    .npc-forge-class-guide .class-book-guide__feature p,.npc-forge-class-guide .class-book-guide__subclass-intro p{white-space:pre-line}
    .npc-forge-class-guide .class-book-guide__content{min-width:0}
    @media(max-width:1120px){.npc-forge-class-guide__book-hero{grid-template-columns:minmax(0,1fr) minmax(260px,38%);min-height:320px}.npc-forge-class-guide__book-hero img{min-height:320px}.npc-forge-class-guide__book{grid-template-columns:minmax(165px,205px) minmax(0,1fr)}}
    @media(max-width:900px){.npc-forge-class-guide__book{grid-template-columns:1fr}.npc-forge-class-guide__book .class-book-guide__outline{position:relative;max-height:none}.npc-forge-class-guide__compare.is-all,.npc-forge-class-guide__stats{grid-template-columns:1fr}.npc-forge-class-guide__controls{grid-template-columns:1fr}.npc-forge-class-guide__subhead{flex-direction:column}.npc-forge-class-guide__tabs{width:100%}.npc-forge-class-guide__tabs button{flex:1}.npc-forge-class-guide__book-hero{grid-template-columns:1fr;min-height:0}.npc-forge-class-guide__book-hero img{min-height:360px;max-height:520px;mask-image:linear-gradient(180deg,transparent 0,#000 15%)}}
  `}</style>;
}

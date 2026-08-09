import {
  formatCopper,
  magicAllowanceLabel,
  normalizeEquipmentOptions,
  startingCurrencyCopper,
} from "../utils/playerForgeStartingEquipment";

function selectedOption(options = [], key = "") {
  return normalizeEquipmentOptions(options).find((option) => option.key === String(key || "").trim().toUpperCase()) || null;
}

export default function NpcForgeEquipmentReviewSummary({ model, selection = {} }) {
  if (!model?.catalogReady) return null;
  const classOption = selectedOption(model.classOptions, selection.classOption);
  const backgroundOption = selectedOption(model.backgroundOptions, selection.backgroundOption);
  const totalCopper = startingCurrencyCopper(model, selection);
  return <section className="npc-forge-review-equipment" aria-label="Starting equipment review">
    <div className="npc-forge-review-equipment__head"><div><span>Equipment &amp; currency</span><strong>Creation materialization</strong></div><b>{formatCopper(totalCopper)}</b></div>
    <div className="npc-forge-review-equipment__grid">
      <div><span>Class package</span><strong>{classOption ? `Package ${classOption.key}` : "—"}</strong></div>
      <div><span>Background package</span><strong>{backgroundOption ? `Package ${backgroundOption.key}` : "—"}</strong></div>
      <div><span>Higher-level roll</span><strong>{selection.wealthRoll ? `d10 = ${selection.wealthRoll}` : "Not required"}</strong></div>
      <div><span>Magic-item guide</span><strong>{magicAllowanceLabel(model.level)}</strong></div>
    </div>
    <p>Selected items will be created in this character&apos;s canonical inventory and start unequipped. The magic-item allowance is a DM guide only and is not automatically granted.</p>
    <style jsx global>{`
      .npc-forge-review-equipment{margin:12px 18px 0;padding:12px 14px;border:1px solid rgba(88,214,199,.24);border-radius:10px;background:rgba(88,214,199,.055);color:#fff}.npc-forge-review-equipment__head{display:flex;align-items:center;justify-content:space-between;gap:12px}.npc-forge-review-equipment__head>div{display:grid;gap:2px}.npc-forge-review-equipment__head span,.npc-forge-review-equipment__grid span{color:rgba(255,255,255,.48);font-size:.61rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.npc-forge-review-equipment__head strong{font-size:.78rem}.npc-forge-review-equipment__head>b{color:#9ff8ec;font-size:.88rem}.npc-forge-review-equipment__grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}.npc-forge-review-equipment__grid>div{display:grid;gap:3px;padding:8px 9px;border-radius:8px;background:rgba(0,0,0,.16)}.npc-forge-review-equipment__grid strong{font-size:.7rem}.npc-forge-review-equipment p{margin:9px 0 0;color:rgba(255,255,255,.58);font-size:.64rem;line-height:1.45}@media(max-width:900px){.npc-forge-review-equipment__grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.npc-forge-review-equipment{margin:10px}.npc-forge-review-equipment__grid{grid-template-columns:1fr}}
    `}</style>
  </section>;
}

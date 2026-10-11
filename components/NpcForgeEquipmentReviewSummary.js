import {
  formatCopper,
  higherLevelWealthRule,
  magicAllowanceLabel,
  startingMarketBudgetCopper,
  startingMarketPurchases,
  startingMarketRemainingCopper,
  startingMarketSpentCopper,
} from "../utils/playerForgeStartingEquipment";

export default function NpcForgeEquipmentReviewSummary({ model, selection = {} }) {
  if (!model?.catalogReady) return null;
  const purchases = startingMarketPurchases(selection);
  const budgetCopper = startingMarketBudgetCopper(model, selection);
  const spentCopper = startingMarketSpentCopper(selection);
  const remainingCopper = startingMarketRemainingCopper(model, selection);
  const merchantCount = new Set(purchases.map((entry) => entry.merchantId).filter(Boolean)).size;
  const itemCount = purchases.reduce((total, entry) => total + Number(entry.qty || 1), 0);
  const rule = higherLevelWealthRule(model.level);

  return <section className="npc-forge-review-equipment" aria-label="Starting market review">
    <div className="npc-forge-review-equipment__head">
      <div><span>Equipment &amp; currency</span><strong>Starting market</strong></div>
      <b>{formatCopper(remainingCopper)} remaining</b>
    </div>
    <div className="npc-forge-review-equipment__grid">
      <div><span>Source budget</span><strong>{formatCopper(budgetCopper)}</strong></div>
      <div><span>Market purchases</span><strong>{itemCount ? `${itemCount} item${itemCount === 1 ? "" : "s"} · ${formatCopper(spentCopper)}` : "None · keep full purse"}</strong></div>
      <div><span>Merchants used</span><strong>{merchantCount || "None"}</strong></div>
      <div><span>Higher-level roll</span><strong>{rule.rollRequired ? selection.wealthRoll ? `d10 = ${selection.wealthRoll}` : "Required" : "Not required"}</strong></div>
      <div><span>Magic-item guide</span><strong>{magicAllowanceLabel(model.level)}</strong></div>
    </div>
    {purchases.length ? <div className="npc-forge-review-equipment__items">
      {purchases.map((entry) => <span key={`${entry.merchantId}:${entry.stockId}`}><strong>{entry.qty > 1 ? `${entry.qty}× ` : ""}{entry.itemName}</strong><small>{entry.merchantName || "Merchant"} · {entry.priceGp} gp each</small></span>)}
    </div> : null}
    <p>These purchases are staged until character creation. Creation rechecks current merchant stock and price, moves the purchased items into this character&apos;s canonical inventory, deducts the cost from the source-backed starting purse, and preserves any unspent coin as character-scoped currency.</p>
    <style jsx global>{`
      .npc-forge-review-equipment{margin:12px 18px 0;padding:12px 14px;border:1px solid rgba(88,214,199,.24);border-radius:10px;background:rgba(88,214,199,.055);color:#fff}.npc-forge-review-equipment__head{display:flex;align-items:center;justify-content:space-between;gap:12px}.npc-forge-review-equipment__head>div{display:grid;gap:2px}.npc-forge-review-equipment__head span,.npc-forge-review-equipment__grid span{color:rgba(255,255,255,.48);font-size:.61rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.npc-forge-review-equipment__head strong{font-size:.78rem}.npc-forge-review-equipment__head>b{color:#9ff8ec;font-size:.88rem}.npc-forge-review-equipment__grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:10px}.npc-forge-review-equipment__grid>div{display:grid;gap:3px;padding:8px 9px;border-radius:8px;background:rgba(0,0,0,.16)}.npc-forge-review-equipment__grid strong{font-size:.7rem}.npc-forge-review-equipment__items{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.npc-forge-review-equipment__items>span{display:grid;gap:2px;padding:6px 8px;border:1px solid rgba(168,108,255,.18);border-radius:8px;background:rgba(126,72,199,.05)}.npc-forge-review-equipment__items strong{font-size:.64rem}.npc-forge-review-equipment__items small{color:rgba(255,255,255,.52);font-size:.54rem}.npc-forge-review-equipment p{margin:9px 0 0;color:rgba(255,255,255,.58);font-size:.64rem;line-height:1.45}@media(max-width:1000px){.npc-forge-review-equipment__grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.npc-forge-review-equipment{margin:10px}.npc-forge-review-equipment__grid{grid-template-columns:1fr}}
    `}</style>
  </section>;
}

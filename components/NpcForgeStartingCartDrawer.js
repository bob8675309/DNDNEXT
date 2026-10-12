import { formatCopper, magicAllowanceLabel } from "../utils/playerForgeStartingEquipment";

export default function NpcForgeStartingCartDrawer({
  open = false,
  onClose = null,
  ruleset = "dndnext-homebrew",
  budgetCopper = 0,
  spentCopper = 0,
  remainingCopper = 0,
  vanillaSourceCopper = 0,
  classCashCopper = 0,
  backgroundCashCopper = 0,
  level = 1,
  purchases = [],
  onRemovePurchase = null,
}) {
  if (!open) return null;
  const totalItems = purchases.reduce((sum, entry) => sum + Math.max(0, Number(entry?.qty || 0)), 0);

  return <div className="forge-starting-cart-drawer" role="dialog" aria-modal="false" aria-label="Starting cart">
    <button type="button" className="forge-starting-cart-drawer__backdrop" aria-label="Close starting cart" onClick={() => onClose?.()} />
    <aside className="forge-starting-cart-drawer__panel">
      <header>
        <div>
          <span>Starting cart</span>
          <strong>{totalItems} item{totalItems === 1 ? "" : "s"}</strong>
        </div>
        <button type="button" onClick={() => onClose?.()} aria-label="Close starting cart">×</button>
      </header>

      <div className="forge-starting-cart-drawer__totals">
        <div><span>Total gold</span><strong>{formatCopper(budgetCopper)}</strong></div>
        <div><span>Spent</span><strong>{formatCopper(spentCopper)}</strong></div>
        <div className="is-remaining"><span>Remaining</span><strong>{formatCopper(remainingCopper)}</strong></div>
      </div>

      <div className="forge-starting-cart-drawer__items">
        {purchases.length ? purchases.map((entry) => <div key={`${entry.merchantId}:${entry.stockId}`}>
          <span><strong>{entry.qty > 1 ? `${entry.qty}× ` : ""}{entry.itemName}</strong><small>{entry.merchantName || "Merchant"} · {entry.priceGp} gp each</small></span>
          <button type="button" onClick={() => onRemovePurchase?.(entry.stockId)} aria-label={`Remove one ${entry.itemName}`}>−</button>
        </div>) : <p>Your starting cart is empty. Keeping unspent gold is allowed.</p>}
      </div>

      <details className="forge-starting-cart-drawer__rules">
        <summary>Rules &amp; source purse</summary>
        <dl>
          <div><dt>Ruleset</dt><dd>{ruleset === "vanilla" ? "Vanilla source rules" : "DNDNext Homebrew"}</dd></div>
          <div><dt>Vanilla source purse</dt><dd>{formatCopper(vanillaSourceCopper)}</dd></div>
          <div><dt>Class source cash</dt><dd>{formatCopper(classCashCopper)}</dd></div>
          <div><dt>Background source cash</dt><dd>{formatCopper(backgroundCashCopper)}</dd></div>
          <div><dt>Higher-level magic</dt><dd>{magicAllowanceLabel(level)}</dd></div>
        </dl>
        <p><strong>DM guide only:</strong> the higher-level magic-item allowance remains a review guide; the Forge does not grant free magic items.</p>
      </details>
    </aside>
  </div>;
}

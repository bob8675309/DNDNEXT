import { merchantInitials, merchantShopLabel, resolveMerchantPortrait } from "../utils/merchantStorefrontMedia";
import { themeFromMerchant } from "../utils/merchantTheme";

export default function MerchantRail({
  merchants = [],
  activeMerchantId = "",
  loading = false,
  onSelect = null,
}) {
  return <aside className="merchant-rail" aria-label="Campaign merchants">
    <div className="merchant-rail__head">
      <span>Campaign merchants</span>
      <small>{merchants.length ? `${merchants.length} storefronts` : "Starting market"}</small>
    </div>
    <div className="merchant-rail__list">
      {loading ? <div className="merchant-rail__empty">Loading merchants…</div> : null}
      {!loading && !merchants.length ? <div className="merchant-rail__empty">No storefront merchants are currently available.</div> : null}
      {merchants.map((merchant) => {
        const active = String(merchant.id) === String(activeMerchantId);
        const portrait = resolveMerchantPortrait(merchant);
        const theme = themeFromMerchant(merchant);
        return <button
          key={merchant.id}
          type="button"
          className={`merchant-rail__merchant is-${theme} ${active ? "is-active" : ""}`}
          onClick={() => onSelect?.(merchant.id)}
          aria-pressed={active}
        >
          {portrait ? <img src={portrait} alt="" loading="lazy" /> : <span className="merchant-rail__portrait-fallback" aria-hidden="true">{merchantInitials(merchant)}</span>}
          <span className="merchant-rail__merchant-copy">
            <strong>{merchant.name || "Merchant"}</strong>
            <em>{merchantShopLabel(merchant)}</em>
          </span>
          <span className="merchant-rail__status" aria-label="Storefront available" title="Storefront available" />
        </button>;
      })}
    </div>
  </aside>;
}

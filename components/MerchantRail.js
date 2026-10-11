import { merchantShopLabel, merchantTagline, resolveMerchantPortrait } from "../utils/merchantStorefrontMedia";

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
        const tagline = merchantTagline(merchant);
        return <button
          key={merchant.id}
          type="button"
          className={`merchant-rail__merchant ${active ? "is-active" : ""}`}
          onClick={() => onSelect?.(merchant.id)}
          aria-pressed={active}
        >
          <img src={resolveMerchantPortrait(merchant)} alt="" loading="lazy" />
          <span className="merchant-rail__merchant-copy">
            <strong>{merchant.name || "Merchant"}</strong>
            <em>{merchantShopLabel(merchant)}</em>
            {tagline ? <small>{tagline}</small> : null}
          </span>
          <span className="merchant-rail__status" aria-label="Storefront available" title="Storefront available" />
        </button>;
      })}
    </div>
  </aside>;
}

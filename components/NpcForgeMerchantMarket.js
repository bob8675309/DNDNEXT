import ItemCard from "./ItemCard";
import MerchantAmbientBackdrop from "./MerchantAmbientBackdrop";
import {
  merchantShopLabel,
  merchantTagline,
  resolveMerchantPortrait,
  resolveMerchantStorefrontMedia,
} from "../utils/merchantStorefrontMedia";
import { themeFromMerchant } from "../utils/merchantTheme";
import { formatCopper } from "../utils/playerForgeStartingEquipment";

function safeText(value) {
  return String(value ?? "").trim();
}

function raritySlug(value = "") {
  return safeText(value || "Mundane")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "mundane";
}

function rarityClass(value = "") {
  return `rarity-${raritySlug(value)}`;
}

function rarityBadgeClass(value = "") {
  return `is-rarity-${raritySlug(value)}`;
}

export default function NpcForgeMerchantMarket({
  merchant = null,
  items = [],
  categories = ["All"],
  selectedCard = null,
  query = "",
  typeFilter = "All",
  loading = false,
  error = "",
  notice = "",
  remainingCopper = 0,
  onQueryChange = null,
  onTypeFilterChange = null,
  onSelect = null,
  onAdd = null,
  canAddItem = null,
  selectedActionLabel = "Add to Starting Cart",
}) {
  if (!merchant) {
    return <section className="merchant-panel-inner merchant-market merchant-panel-forge forge-equipment-merchant-panel is-loading">
      <div className="merchant-market-empty">Loading campaign storefront…</div>
    </section>;
  }

  const theme = themeFromMerchant(merchant);
  const media = resolveMerchantStorefrontMedia(merchant);
  const portrait = resolveMerchantPortrait(merchant);
  const sceneImage = portrait || media.imageUrl;
  const shopLabel = merchantShopLabel(merchant);
  const tagline = merchantTagline(merchant);
  const stockLabel = loading
    ? "Loading stock"
    : `${items.length} item${items.length === 1 ? "" : "s"} shown`;

  const sceneStyle = sceneImage ? { "--merchant-bg": `url("${sceneImage}")` } : undefined;
  const selectedAvailable = Math.max(0, Number(selectedCard?._available_qty || 0));
  const addEnabled = selectedCard && (typeof canAddItem !== "function" || canAddItem(selectedCard));

  return <section className="merchant-panel-inner merchant-market merchant-panel-forge forge-equipment-merchant-panel">
    <header className="merchant-market-header">
      <div className="merchant-market-heading">
        <div className="merchant-market-kicker">Starting equipment merchant</div>
        <h2 className="merchant-market-title">{merchant.name || "Merchant"}’s Wares</h2>
        <div className="merchant-market-subline">{shopLabel} · {stockLabel}</div>
      </div>
      <div className="merchant-market-header-actions">
        <span className="merchant-wallet-badge" title="Character starting purse remaining">
          {formatCopper(remainingCopper)} left
        </span>
      </div>
    </header>

    {notice ? <div className="merchant-market-notice merchant-market-notice-success" role="status"><span>{notice}</span></div> : null}

    <main className="merchant-market-shell forge-equipment-merchant-market-shell">
      <section className={`merchant-scene forge-equipment-vendor-scene is-${theme}`} style={sceneStyle}>
        {media.videoUrl ? <MerchantAmbientBackdrop merchant={merchant} className="forge-equipment-vendor-ambient" /> : null}
        <div className="merchant-scene-scrim" />
        <div className="merchant-scene-copy">
          <span className="merchant-scene-theme">{theme}</span>
          <h3>{shopLabel || "Curated wares"}</h3>
          <p>{tagline || "Browse the merchant’s current stock and choose what this character carries into the campaign."}</p>
        </div>
      </section>

      <section className="merchant-stock-workspace forge-equipment-merchant-stock">
        <div className="merchant-stock-toolbar">
          <label className="merchant-search-field">
            <span>Search stock</span>
            <input
              className="form-control form-control-sm"
              value={query}
              onChange={(event) => onQueryChange?.(event.target.value)}
              placeholder="Name, rarity, type, source, or description"
            />
          </label>
          <div className="merchant-category-row" aria-label="Stock categories">
            {categories.map((category) => <button
              key={category}
              type="button"
              className={`merchant-category-chip ${typeFilter === category ? "active" : ""}`}
              onClick={() => onTypeFilterChange?.(category)}
            >{category}</button>)}
          </div>
        </div>

        {error ? <div className="merchant-inline-error">{error}</div> : null}

        <div className="merchant-stock-layout">
          <div className="merchant-stock-list" role="listbox" aria-label={`${merchant.name || "Merchant"} stock`}>
            {loading ? <div className="merchant-market-empty">Loading stock…</div> : null}
            {!loading && !items.length ? <div className="merchant-market-empty">No items match the current search and category.</div> : null}
            {items.map((card) => {
              const selected = String(selectedCard?.id) === String(card.id);
              return <button
                key={card.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`merchant-stock-row ${rarityClass(card.item_rarity)} ${selected ? "selected" : ""}`}
                onClick={() => onSelect?.(card.id)}
              >
                <div className="merchant-stock-row-head">
                  <strong>{card.item_name}</strong>
                  <span>{Number(card._price_gp || 0)} gp</span>
                </div>
                <div className="merchant-stock-row-meta">
                  <span className={rarityBadgeClass(card.item_rarity)}>{card.item_rarity || "Mundane"}</span>
                  <span>{card.item_type || "Item"}</span>
                  <span>Qty {Math.max(0, Number(card._available_qty ?? card._stock_qty ?? 0))}</span>
                  {card.source ? <span>{card.source}</span> : null}
                </div>
                <p>{card.item_description || "No description is available for this item."}</p>
              </button>;
            })}
          </div>

          <aside className="merchant-preview-pane">
            {selectedCard ? <>
              <div className="merchant-preview-head">
                <div>
                  <div className="merchant-market-kicker">Selected item</div>
                  <h3>{selectedCard.item_name}</h3>
                </div>
                <span className="merchant-preview-price">{Number(selectedCard._price_gp || 0)} gp</span>
              </div>
              <div className="merchant-preview-card-scroll">
                <ItemCard item={selectedCard} variant="shop" detailsCollapsible />
              </div>
              <div className="merchant-preview-purchase">
                <div><span>Available</span><strong>{selectedAvailable}</strong></div>
                <div><span>Remaining</span><strong>{formatCopper(remainingCopper)}</strong></div>
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={!addEnabled}
                  onClick={() => onAdd?.(selectedCard)}
                >{selectedActionLabel}</button>
              </div>
            </> : <div className="merchant-market-empty">Select an item to inspect it.</div>}
          </aside>
        </div>
      </section>
    </main>
  </section>;
}

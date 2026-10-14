import { useEffect, useRef, useState } from "react";
import ItemCard from "./ItemCard";

function safeText(value) {
  return String(value ?? "").trim();
}

function raritySlug(value = "") {
  return safeText(value || "Mundane")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "mundane";
}

function defaultRarityClass(value = "") {
  return `rarity-${raritySlug(value)}`;
}

function defaultRarityBadgeClass(value = "") {
  return `is-rarity-${raritySlug(value)}`;
}

function MerchantCategoryScroller({ categories = [], typeFilter = "All", onTypeFilterChange = null }) {
  const topRef = useRef(null);
  const rowRef = useRef(null);
  const syncingRef = useRef(false);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return undefined;

    const update = () => {
      setScrollWidth(Math.max(row.scrollWidth, row.clientWidth));
      setHasOverflow(row.scrollWidth > row.clientWidth + 1);
      if (topRef.current) topRef.current.scrollLeft = row.scrollLeft;
    };

    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(row);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [categories]);

  const syncScroll = (source, target) => {
    if (!source || !target || syncingRef.current) return;
    syncingRef.current = true;
    target.scrollLeft = source.scrollLeft;
    window.requestAnimationFrame(() => { syncingRef.current = false; });
  };

  return <div className="merchant-category-stack">
    <div
      ref={topRef}
      className={`merchant-category-scrollbar${hasOverflow ? " is-active" : ""}`}
      aria-hidden="true"
      onScroll={(event) => syncScroll(event.currentTarget, rowRef.current)}
    >
      <div className="merchant-category-scrollbar__spacer" style={{ width: scrollWidth || "100%" }} />
    </div>
    <div
      ref={rowRef}
      className="merchant-category-row"
      aria-label="Stock categories"
      onScroll={(event) => syncScroll(event.currentTarget, topRef.current)}
    >
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          className={`merchant-category-chip${typeFilter === category ? " active" : ""}`}
          onClick={() => onTypeFilterChange?.(category)}
        >
          {category}
        </button>
      ))}
    </div>
  </div>;
}

export default function MerchantStorefrontView({
  merchant,
  rootClassName = "merchant-panel-inner merchant-market",
  headerKicker = "Merchant storefront",
  title = "",
  titleAddon = null,
  subline = "",
  headerActions = null,
  notice = "",
  noticeKind = "success",
  onDismissNotice = null,
  beforeMain = null,
  shellClassName = "",
  sceneClassName = "",
  sceneStyle = undefined,
  sceneMedia = null,
  theme = "general",
  sceneTitle = "",
  sceneTagline = "",
  workspaceClassName = "",
  query = "",
  onQueryChange = null,
  searchPlaceholder = "Name, rarity, type, or description",
  categories = ["All"],
  typeFilter = "All",
  onTypeFilterChange = null,
  error = "",
  loading = false,
  items = [],
  selectedCard = null,
  onSelect = null,
  stockAriaLabel = "Merchant stock",
  rarityClassFor = defaultRarityClass,
  rarityBadgeClassFor = defaultRarityBadgeClass,
  showSource = false,
  quantityFor = null,
  itemCardProps = {},
  previewMetrics = [],
  showPreviewHeader = true,
  actionLabel = "",
  actionDisabled = false,
  onAction = null,
  actionClassName = "btn btn-success",
  emptySelectionText = "Select an item to inspect it.",
}) {
  if (!merchant) return null;

  const resolvedQuantity = (card) => {
    if (typeof quantityFor === "function") return Math.max(0, Number(quantityFor(card) || 0));
    return Math.max(0, Number(card?._available_qty ?? card?._qty ?? card?._stock_qty ?? 0));
  };

  return (
    <section className={rootClassName}>
      <header className="merchant-market-header">
        <div className="merchant-market-heading">
          <div className="merchant-market-kicker">{headerKicker}</div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <h2 className="merchant-market-title">{title || `${merchant.name || "Merchant"}’s Wares`}</h2>
            {titleAddon}
          </div>
          {subline ? <div className="merchant-market-subline">{subline}</div> : null}
        </div>
        {headerActions ? <div className="merchant-market-header-actions">{headerActions}</div> : null}
      </header>

      {notice ? (
        <div className={`merchant-market-notice merchant-market-notice-${noticeKind || "success"}`} role="status">
          <span>{notice}</span>
          {onDismissNotice ? <button type="button" aria-label="Dismiss notice" onClick={onDismissNotice}>×</button> : null}
        </div>
      ) : null}

      {beforeMain}

      <main className={`merchant-market-shell${shellClassName ? ` ${shellClassName}` : ""}`}>
        <section className={`merchant-scene${sceneClassName ? ` ${sceneClassName}` : ""}`} style={sceneStyle}>
          {sceneMedia}
          <div className="merchant-scene-scrim" />
          <div className="merchant-scene-copy">
            <span className="merchant-scene-theme">{theme}</span>
            <h3>{sceneTitle || merchant.storefront_title || "Curated wares"}</h3>
            <p>{sceneTagline || merchant.storefront_tagline || "Browse the merchant’s current stock and inspect an item without leaving the storefront."}</p>
          </div>
        </section>

        <section className={`merchant-stock-workspace${workspaceClassName ? ` ${workspaceClassName}` : ""}`}>
          <div className="merchant-stock-toolbar">
            <label className="merchant-search-field">
              <span>Search stock</span>
              <input
                className="form-control form-control-sm"
                value={query}
                onChange={(event) => onQueryChange?.(event.target.value)}
                placeholder={searchPlaceholder}
              />
            </label>
            <MerchantCategoryScroller
              categories={categories}
              typeFilter={typeFilter}
              onTypeFilterChange={onTypeFilterChange}
            />
          </div>

          {error ? <div className="merchant-inline-error">{error}</div> : null}

          <div className="merchant-stock-layout">
            <div className="merchant-stock-list" role="listbox" aria-label={stockAriaLabel}>
              {loading ? <div className="merchant-market-empty">Loading stock…</div> : null}
              {!loading && !items.length ? <div className="merchant-market-empty">No items match the current search and category.</div> : null}
              {items.map((card) => {
                const selected = String(selectedCard?.id) === String(card.id);
                const qty = resolvedQuantity(card);
                return (
                  <button
                    key={card.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`merchant-stock-row ${rarityClassFor(card.item_rarity)}${selected ? " selected" : ""}`}
                    onClick={() => onSelect?.(card.id)}
                  >
                    <div className="merchant-stock-row-head">
                      <strong>{card.item_name}</strong>
                      <span>{Number(card._price_gp || 0)} gp</span>
                    </div>
                    <div className="merchant-stock-row-meta">
                      <span className={rarityBadgeClassFor(card.item_rarity)}>{card.item_rarity || "Mundane"}</span>
                      <span>{card.item_type || "Item"}</span>
                      <span>Qty {qty}</span>
                      {showSource && card.source ? <span>{card.source}</span> : null}
                    </div>
                    <p title={card.item_description || "No description is available for this item."}>
                      {card.item_description || "No description is available for this item."}
                    </p>
                  </button>
                );
              })}
            </div>

            <aside className="merchant-preview-pane">
              {selectedCard ? (
                <>
                  {showPreviewHeader ? <div className="merchant-preview-head">
                    <div>
                      <div className="merchant-market-kicker">Selected item</div>
                      <h3>{selectedCard.item_name}</h3>
                    </div>
                    <span className="merchant-preview-price">{Number(selectedCard._price_gp || 0)} gp</span>
                  </div> : null}
                  <div className="merchant-preview-card-scroll">
                    <ItemCard item={selectedCard} {...itemCardProps} />
                  </div>
                  <div className="merchant-preview-purchase">
                    {previewMetrics.map((metric) => (
                      <div key={metric.label}>
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                      </div>
                    ))}
                    {actionLabel ? (
                      <button
                        type="button"
                        className={actionClassName}
                        onClick={() => onAction?.(selectedCard)}
                        disabled={actionDisabled}
                      >
                        {actionLabel}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : <div className="merchant-market-empty">{emptySelectionText}</div>}
            </aside>
          </div>
        </section>
      </main>
    </section>
  );
}

import { resolveItemVisual } from "../utils/itemVisuals";

function itemDescription(item = {}) {
  return String(item.item_description || item.card_payload?.item_description || item.card_payload?.description || "").trim();
}

function sourceLabel(item = {}) {
  return String(item.source || item.item_source || item.card_payload?.source || item.card_payload?.item_source || "Campaign").trim();
}

export default function MerchantWaresList({
  merchantName = "Merchant",
  items = [],
  categories = ["All"],
  selectedId = "",
  query = "",
  typeFilter = "All",
  sortKey = "name-asc",
  loading = false,
  error = "",
  notice = "",
  onQueryChange = null,
  onTypeFilterChange = null,
  onSortChange = null,
  onSelect = null,
}) {
  return <section className="merchant-stock-workspace forge-merchant-wares" aria-label={`${merchantName} wares`}>
    <div className="merchant-stock-toolbar forge-merchant-wares__toolbar">
      <label className="merchant-search-field">
        <span>Search stock</span>
        <input
          className="form-control form-control-sm"
          value={query}
          onChange={(event) => onQueryChange?.(event.target.value)}
          placeholder="Name, rarity, type, source, or description"
        />
      </label>
      <label className="forge-merchant-wares__sort">
        <span>Sort</span>
        <select value={sortKey} onChange={(event) => onSortChange?.(event.target.value)}>
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="price-asc">Price low-high</option>
          <option value="price-desc">Price high-low</option>
          <option value="rarity">Rarity</option>
        </select>
      </label>
    </div>

    <div className="merchant-category-row forge-merchant-wares__categories" aria-label="Stock categories">
      {categories.map((category) => <button
        key={category}
        type="button"
        className={`merchant-category-chip ${typeFilter === category ? "active" : ""}`}
        onClick={() => onTypeFilterChange?.(category)}
      >{category}</button>)}
    </div>

    {error ? <div className="merchant-inline-error">{error}</div> : null}
    {notice ? <div className="forge-merchant-wares__notice">{notice}</div> : null}

    <div className="merchant-stock-list forge-merchant-wares__list" role="listbox" aria-label={`${merchantName} stock list`}>
      {loading ? <div className="merchant-market-empty">Loading stock…</div> : null}
      {!loading && !items.length ? <div className="merchant-market-empty">No items match the current search and category.</div> : null}
      {items.map((item) => {
        const selected = String(item.id) === String(selectedId);
        const visual = resolveItemVisual(item);
        const description = itemDescription(item);
        return <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={selected}
          className={`merchant-stock-row forge-merchant-wares__row ${selected ? "selected" : ""}`}
          onClick={() => onSelect?.(item.id)}
        >
          <span className={`forge-merchant-wares__thumb ${visual.className}`}>
            {visual.hasImage ? <img src={visual.imageUrl} alt="" loading="lazy" /> : <span aria-hidden="true">{visual.icon}</span>}
          </span>
          <span className="forge-merchant-wares__copy">
            <span className="merchant-stock-row-head">
              <strong>{item.item_name || "Item"}</strong>
              <span>{Number(item._price_gp || 0)} gp</span>
            </span>
            <span className="merchant-stock-row-meta">
              <span>{item.item_rarity || "Mundane"}</span>
              <span>{item.item_type || "Item"}</span>
              <span>Qty {Math.max(0, Number(item._available_qty ?? item._stock_qty ?? 0))}</span>
              <span>{sourceLabel(item)}</span>
            </span>
            {description ? <p>{description}</p> : null}
          </span>
        </button>;
      })}
    </div>

    <div className="forge-merchant-wares__footer">{items.length} item{items.length === 1 ? "" : "s"} shown</div>
  </section>;
}

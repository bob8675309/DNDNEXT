import { resolveItemVisual } from "../utils/itemVisuals";

function safe(value) {
  return String(value || "").trim();
}

function sourceLabel(item = {}) {
  return safe(item.source || item.item_source || item.card_payload?.source || item.card_payload?.item_source || "Campaign");
}

function itemDescription(item = {}) {
  return safe(item.item_description || item.card_payload?.item_description || item.card_payload?.description || "No description is available for this item.");
}

export default function MerchantStockBrowser({
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
  onAdd = null,
  canAddItem = null,
  addLabel = null,
}) {
  return <section className="merchant-stock-browser">
    <div className="merchant-stock-browser__categories" aria-label="Item categories">
      {categories.map((category) => <button
        key={category}
        type="button"
        className={typeFilter === category ? "is-active" : ""}
        onClick={() => onTypeFilterChange?.(category)}
      >{category}</button>)}
    </div>

    <div className="merchant-stock-browser__toolbar">
      <label className="merchant-stock-browser__search">
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={(event) => onQueryChange?.(event.target.value)}
          placeholder="Search items, descriptions, or keywords…"
          aria-label="Search merchant stock"
        />
      </label>
      <label className="merchant-stock-browser__sort">
        <span>Sort</span>
        <select value={sortKey} onChange={(event) => onSortChange?.(event.target.value)}>
          <option value="name-asc">Name (A–Z)</option>
          <option value="name-desc">Name (Z–A)</option>
          <option value="price-asc">Price (low-high)</option>
          <option value="price-desc">Price (high-low)</option>
          <option value="rarity">Rarity</option>
        </select>
      </label>
    </div>

    {error ? <div className="merchant-stock-browser__message is-error">{error}</div> : null}
    {notice ? <div className="merchant-stock-browser__message is-notice">{notice}</div> : null}

    <div className="merchant-stock-browser__table" role="listbox" aria-label={`${merchantName} starting stock`}>
      <div className="merchant-stock-browser__table-head" aria-hidden="true">
        <span>Item</span><span>Type</span><span>Rarity</span><span>Price</span><span>Source</span><span>Actions</span>
      </div>
      <div className="merchant-stock-browser__rows">
        {loading ? <div className="merchant-stock-browser__empty">Loading stock…</div> : null}
        {!loading && !items.length ? <div className="merchant-stock-browser__empty">No starting-market items match this filter.</div> : null}
        {items.map((item) => {
          const selected = String(item.id) === String(selectedId);
          const visual = resolveItemVisual(item);
          const canAdd = typeof canAddItem === "function" ? canAddItem(item) : true;
          const label = typeof addLabel === "function" ? addLabel(item) : "Add";
          return <div
            key={item.id}
            className={`merchant-stock-browser__row ${selected ? "is-selected" : ""}`}
            role="option"
            aria-selected={selected}
          >
            <button type="button" className="merchant-stock-browser__inspect" onClick={() => onSelect?.(item.id)}>
              <span className={`merchant-stock-browser__thumb ${visual.className}`}>
                {visual.hasImage ? <img src={visual.imageUrl} alt="" loading="lazy" /> : <span aria-hidden="true">{visual.icon}</span>}
              </span>
              <span className="merchant-stock-browser__item-copy">
                <strong>{item.item_name || "Item"}</strong>
                <small>{itemDescription(item)}</small>
              </span>
            </button>
            <span className="merchant-stock-browser__type">{item.item_type || "Item"}</span>
            <span className="merchant-stock-browser__rarity">{item.item_rarity || "Mundane"}</span>
            <strong className="merchant-stock-browser__price">{Number(item._price_gp || 0)} gp</strong>
            <span className="merchant-stock-browser__source">{sourceLabel(item)}</span>
            <button
              type="button"
              className="merchant-stock-browser__add"
              disabled={!canAdd}
              onClick={() => onAdd?.(item)}
              title={item._available_qty <= 0 ? "This stock is fully reserved in your starting cart." : undefined}
            >{label}</button>
          </div>;
        })}
      </div>
      <div className="merchant-stock-browser__footer">
        <span>{items.length} item{items.length === 1 ? "" : "s"} shown</span>
      </div>
    </div>
  </section>;
}

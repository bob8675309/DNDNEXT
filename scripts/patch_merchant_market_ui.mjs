import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const merchantPath = path.join(process.cwd(), "components", "MerchantPanel.js");
let merchant = fs.readFileSync(merchantPath, "utf8");

if (!merchant.includes('className={"merchant-panel-inner merchant-market merchant-panel-" + presentation}')) {
  merchant = replaceOnce(
    merchant,
    '  onBackToProfile,\n  onClose,\n}) {',
    '  onBackToProfile,\n  onClose,\n  presentation = "map",\n}) {',
    "MerchantPanel presentation prop"
  );

  merchant = replaceOnce(
    merchant,
    '  const [openId, setOpenId] = useState(null); // currently unused, kept for future expansion',
    '  const [openId, setOpenId] = useState(null); // retained for future card expansion\n  const [query, setQuery] = useState("");\n  const [typeFilter, setTypeFilter] = useState("All");\n  const [selectedId, setSelectedId] = useState(null);\n  const [notice, setNotice] = useState(null);',
    "MerchantPanel market state"
  );

  merchant = replaceOnce(
    merchant,
    '  const cards = useMemo(() => stock.map(normalizeRow), [stock]);',
    `  const cards = useMemo(() => stock.map(normalizeRow), [stock]);
  const categories = useMemo(() => {
    const values = Array.from(new Set(cards.map((card) => card.item_type || "Other").filter(Boolean)));
    return ["All", ...values.sort((a, b) => String(a).localeCompare(String(b)))];
  }, [cards]);
  const filteredCards = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cards.filter((card) => {
      if (typeFilter !== "All" && String(card.item_type || "Other") !== typeFilter) return false;
      if (!needle) return true;
      return [card.item_name, card.item_type, card.item_rarity, card.item_description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [cards, query, typeFilter]);

  useEffect(() => {
    if (!filteredCards.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!filteredCards.some((card) => String(card.id) === String(selectedId))) {
      setSelectedId(filteredCards[0].id);
    }
  }, [filteredCards, selectedId]);

  const selectedCard = filteredCards.find((card) => String(card.id) === String(selectedId)) || filteredCards[0] || null;`,
    "MerchantPanel stock derivations"
  );

  merchant = replaceOnce(
    merchant,
    `    if (!uid) {
      alert("Please sign in.");
      return;
    }`,
    `    if (!uid) {
      setNotice({ kind: "error", message: "Please sign in before purchasing an item." });
      return;
    }`,
    "MerchantPanel signed-in purchase notice"
  );

  merchant = replaceOnce(
    merchant,
    '      alert(`Purchased: ${card.item_name} for ${card._price_gp} gp.`);',
    '      setNotice({ kind: "success", message: `Purchased ${card.item_name} for ${card._price_gp} gp. It has been added to your inventory.` });',
    "MerchantPanel purchase success notice"
  );

  merchant = replaceOnce(
    merchant,
    `      setErr(msg);
      alert(msg);`,
    `      setErr(msg);
      setNotice({ kind: "error", message: msg });`,
    "MerchantPanel purchase error notice"
  );

  const renderStart = merchant.indexOf("  if (!merchant) return null;\n\n  return (");
  const renderEnd = merchant.lastIndexOf("\n}");
  if (renderStart < 0 || renderEnd <= renderStart) throw new Error("MerchantPanel render block not found");

  const newRender = String.raw`  if (!merchant) return null;

  const merchantSubline = merchant.storefront_tagline || merchant.storefront_title || merchant.role || merchant.affiliation || "Traveling merchant";
  const stockLabel = loading ? "Loading stock" : `${cards.length} item${cards.length === 1 ? "" : "s"} in stock`;

  return (
    <div className={"merchant-panel-inner merchant-market merchant-panel-" + presentation}>
      <header className="merchant-market-header">
        <div className="merchant-market-heading">
          <div className="merchant-market-kicker">Merchant storefront</div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <h2 className="merchant-market-title">{merchant.name}’s Wares</h2>
            <Pill theme={theme} small />
          </div>
          <div className="merchant-market-subline">{merchantSubline} · {stockLabel}</div>
        </div>

        <div className="merchant-market-header-actions">
          <span className="merchant-wallet-badge">{walletLoading ? "…" : gp === -1 ? "∞ gp" : `${gp ?? 0} gp`}</span>
          {isAdmin ? (
            <button type="button" className={"btn btn-sm " + (showTravel ? "btn-warning" : "btn-outline-warning")} onClick={() => setShowTravel((value) => !value)}>
              Merchant tools
            </button>
          ) : null}
          {typeof onBackToProfile === "function" ? (
            <button type="button" className="btn btn-sm btn-outline-light" data-bs-dismiss="offcanvas" onClick={onBackToProfile}>Profile</button>
          ) : null}
          <button
            type="button"
            className="btn-close btn-close-white"
            data-bs-dismiss="offcanvas"
            aria-label="Close storefront"
            onClick={() => onClose?.()}
          />
        </div>
      </header>

      {notice?.message ? (
        <div className={"merchant-market-notice merchant-market-notice-" + notice.kind} role="status">
          <span>{notice.message}</span>
          <button type="button" aria-label="Dismiss notice" onClick={() => setNotice(null)}>×</button>
        </div>
      ) : null}

      {isAdmin && showTravel ? (
        <section className="merchant-admin-console">
          <div className="merchant-admin-console-head">
            <div>
              <div className="merchant-market-kicker">Admin controls</div>
              <strong>Stock and travel</strong>
            </div>
            <button type="button" className="btn btn-sm btn-outline-light" onClick={() => setShowTravel(false)}>Done</button>
          </div>

          <div className="merchant-admin-restock-row">
            <input type="text" className="form-control form-control-sm" placeholder="Paste JSON or type an item name…" value={restockText} onChange={(event) => setRestockText(event.target.value)} />
            <button type="button" className="btn btn-sm btn-outline-light" onClick={handlePasteFromClipboard} disabled={busyId === "paste"}>Paste</button>
            <button type="button" className="btn btn-sm btn-outline-success" onClick={addItem} disabled={busyId === "add"}>{busyId === "add" ? "Adding…" : "Add item"}</button>
            <button type="button" className="btn btn-sm btn-outline-warning" onClick={rerollThemed} disabled={busyId === "reroll"}>{busyId === "reroll" ? "Rerolling…" : "Reroll stock"}</button>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={dumpAll} disabled={busyId === "dump"}>Dump stock</button>
          </div>

          <div className="merchant-admin-grid">
            <label><span>Trade route</span><select className="form-select form-select-sm" value={tradeRouteId || ""} onChange={(event) => setTradeRouteId(event.target.value ? Number(event.target.value) : null)}><option value="">— none —</option>{routes.filter((route) => route.route_type === "trade").map((route) => <option key={route.id} value={route.id}>{route.name || route.code}</option>)}</select><button type="button" className="btn btn-sm btn-outline-light" onClick={setTradeRoute} disabled={savingTravel || !tradeRouteId}>Set trade route</button></label>
            <label><span>Excursion route</span><select className="form-select form-select-sm" value={excursionRouteId || ""} onChange={(event) => setExcursionRouteId(event.target.value ? Number(event.target.value) : null)}><option value="">— none —</option>{routes.filter((route) => route.route_type === "excursion").map((route) => <option key={route.id} value={route.id}>{route.name || route.code}</option>)}</select><button type="button" className="btn btn-sm btn-outline-warning" onClick={sendOnExcursion} disabled={savingTravel || !excursionRouteId}>Send on excursion</button></label>
            <label><span>Next destination</span><select className="form-select form-select-sm" value={nextLocationId || ""} onChange={(event) => setNextLocationId(event.target.value ? Number(event.target.value) : null)}><option value="">— none —</option>{locations.filter((loc) => loc?.id).map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}</select><button type="button" className="btn btn-sm btn-outline-info" onClick={setNextDestination} disabled={savingTravel || !nextLocationId}>Set destination</button></label>
            <label><span>Move speed · {Number(draftMoveSpeed).toFixed(3)} pct/sec</span><input type="range" className="form-range" min={0.001} max={0.05} step={0.001} value={draftMoveSpeed} onChange={(event) => setDraftMoveSpeed(parseFloat(event.target.value))} /></label>
            <label><span>Dwell time · {Number(draftDwellHours).toFixed(0)} hours</span><input type="range" className="form-range" min={1} max={24} step={1} value={draftDwellHours} onChange={(event) => setDraftDwellHours(parseInt(event.target.value, 10))} /></label>
            <div className="merchant-admin-save"><button type="button" className="btn btn-sm btn-success" onClick={saveMovementSettings} disabled={savingTravel}>{savingTravel ? "Saving…" : "Save movement"}</button></div>
          </div>
        </section>
      ) : null}

      <main className="merchant-market-shell">
        <section className="merchant-scene" style={hasVideo ? undefined : { "--merchant-bg": "url(" + bgUrl + ")" }}>
          {hasVideo ? <div className="merchant-bg-video-wrap"><video ref={videoRef} className="merchant-bg-video" src={videoUrl} playsInline loop={false} /></div> : null}
          <div className="merchant-scene-scrim" />
          <div className="merchant-scene-copy">
            <span className="merchant-scene-theme">{theme}</span>
            <h3>{merchant.storefront_title || "Curated wares"}</h3>
            <p>{merchant.storefront_tagline || "Browse the merchant’s current stock, inspect an item, and purchase without leaving the storefront."}</p>
          </div>
        </section>

        <section className="merchant-stock-workspace">
          <div className="merchant-stock-toolbar">
            <label className="merchant-search-field">
              <span>Search stock</span>
              <input className="form-control form-control-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, rarity, type, or description" />
            </label>
            <div className="merchant-category-row" aria-label="Stock categories">
              {categories.map((category) => (
                <button key={category} type="button" className={"merchant-category-chip" + (typeFilter === category ? " active" : "")} onClick={() => setTypeFilter(category)}>{category}</button>
              ))}
            </div>
          </div>

          {err ? <div className="merchant-inline-error">{err}</div> : null}

          <div className="merchant-stock-layout">
            <div className="merchant-stock-list" role="listbox" aria-label="Merchant stock">
              {loading ? <div className="merchant-market-empty">Loading stock…</div> : null}
              {!loading && !filteredCards.length ? <div className="merchant-market-empty">No items match the current search and category.</div> : null}
              {filteredCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  role="option"
                  aria-selected={String(selectedCard?.id) === String(card.id)}
                  className={"merchant-stock-row" + (String(selectedCard?.id) === String(card.id) ? " selected" : "")}
                  onClick={() => setSelectedId(card.id)}
                >
                  <div className="merchant-stock-row-head">
                    <strong>{card.item_name}</strong>
                    <span>{card._price_gp} gp</span>
                  </div>
                  <div className="merchant-stock-row-meta">
                    <span>{card.item_rarity || "Mundane"}</span>
                    <span>{card.item_type || "Item"}</span>
                    <span>Qty {card._qty}</span>
                  </div>
                  <p>{card.item_description || "No description is available for this item."}</p>
                </button>
              ))}
            </div>

            <aside className="merchant-preview-pane">
              {selectedCard ? (
                <>
                  <div className="merchant-preview-head">
                    <div>
                      <div className="merchant-market-kicker">Selected item</div>
                      <h3>{selectedCard.item_name}</h3>
                    </div>
                    <span className="merchant-preview-price">{selectedCard._price_gp} gp</span>
                  </div>
                  <div className="merchant-preview-card-scroll"><ItemCard item={selectedCard} /></div>
                  <div className="merchant-preview-purchase">
                    <div><span>Available</span><strong>{selectedCard._qty}</strong></div>
                    <div><span>Your wallet</span><strong>{walletLoading ? "…" : gp === -1 ? "∞ gp" : `${gp ?? 0} gp`}</strong></div>
                    <button type="button" className="btn btn-success" onClick={() => handleBuy(selectedCard)} disabled={busyId === selectedCard.id || selectedCard._qty <= 0}>
                      {busyId === selectedCard.id ? "Purchasing…" : selectedCard._qty <= 0 ? "Sold out" : `Buy for ${selectedCard._price_gp} gp`}
                    </button>
                  </div>
                </>
              ) : <div className="merchant-market-empty">Select an item to inspect it.</div>}
            </aside>
          </div>
        </section>
      </main>
    </div>
  );`;

  merchant = merchant.slice(0, renderStart) + newRender + merchant.slice(renderEnd);
  fs.writeFileSync(merchantPath, merchant, "utf8");
  console.log("Applied modern merchant market UI.");
} else {
  console.log("Modern merchant market UI already present.");
}

const townPath = path.join(process.cwd(), "components", "TownSheet.js");
let town = fs.readFileSync(townPath, "utf8");
if (!town.includes('presentation="town"')) {
  town = replaceOnce(
    town,
    '<div className={cls(styles.crafterModal, styles.crafterModalBuilder)} onClick={(event) => event.stopPropagation()}>\n            <MerchantPanel merchant={activeMerchant} isAdmin={isAdmin} locations={location ? [location] : []} onClose={() => setActiveMerchant(null)} />',
    '<div className={cls(styles.crafterModal, styles.crafterModalBuilder, styles.merchantMarketModal)} onClick={(event) => event.stopPropagation()}>\n            <MerchantPanel merchant={activeMerchant} isAdmin={isAdmin} locations={location ? [location] : []} presentation="town" onClose={() => setActiveMerchant(null)} />',
    "Town Sheet merchant presentation"
  );
  fs.writeFileSync(townPath, town, "utf8");
  console.log("Applied Town Sheet merchant presentation mode.");
}

const globalPath = path.join(process.cwd(), "styles", "globals.scss");
let globalCss = fs.readFileSync(globalPath, "utf8");
const cssMarker = "/* ===== Merchant market workspace v2 ===== */";
if (!globalCss.includes(cssMarker)) {
  globalCss += String.raw`

/* ===== Merchant market workspace v2 ===== */
.merchant-market {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: #f3edff;
  background:
    radial-gradient(circle at 8% 0%, rgba(126, 88, 255, 0.16), transparent 34%),
    linear-gradient(180deg, #120e1d 0%, #0a0812 100%);
  border-radius: 18px;
  overflow: hidden;
}

#merchantPanel .merchant-panel-inner.merchant-market {
  padding: 0;
}

.merchant-market-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(188, 156, 255, 0.18);
  background: linear-gradient(90deg, rgba(34, 23, 51, 0.98), rgba(61, 40, 93, 0.96));
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  z-index: 20;
}

.merchant-market-heading { min-width: 0; }
.merchant-market-kicker {
  color: #d4b6ff;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.18em;
}
.merchant-market-title {
  margin: 2px 0 0;
  color: #fff8ea;
  font-size: clamp(1.15rem, 1.8vw, 1.55rem);
  font-weight: 900;
}
.merchant-market-subline { margin-top: 3px; color: rgba(232, 222, 248, 0.72); font-size: 0.84rem; }
.merchant-market-header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.merchant-wallet-badge,
.merchant-preview-price {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 5px 11px;
  border: 1px solid rgba(241, 201, 117, 0.32);
  border-radius: 999px;
  background: rgba(241, 201, 117, 0.10);
  color: #ffe7aa;
  font-weight: 900;
  white-space: nowrap;
}

.merchant-market-notice {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  font-size: 0.86rem;
}
.merchant-market-notice-success { background: rgba(31, 155, 91, 0.18); color: #c7ffdd; }
.merchant-market-notice-error { background: rgba(194, 62, 76, 0.18); color: #ffd6da; }
.merchant-market-notice button { border: 0; background: transparent; color: inherit; font-size: 1.25rem; line-height: 1; }

.merchant-admin-console {
  flex: 0 0 auto;
  max-height: min(44vh, 430px);
  overflow-y: auto;
  padding: 14px 18px 16px;
  border-bottom: 1px solid rgba(241, 201, 117, 0.18);
  background: rgba(16, 12, 25, 0.98);
}
.merchant-admin-console-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
.merchant-admin-restock-row { display: grid; grid-template-columns: minmax(220px, 1fr) repeat(4, auto); gap: 8px; margin-bottom: 12px; }
.merchant-admin-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.merchant-admin-grid label { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; background: rgba(255,255,255,0.035); color: rgba(239,232,255,0.84); font-size: 0.78rem; }
.merchant-admin-save { display: flex; align-items: end; justify-content: flex-end; }

.merchant-market-shell {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(250px, 0.72fr) minmax(0, 2fr);
  gap: 0;
}

.merchant-scene {
  position: relative;
  min-width: 0;
  overflow: hidden;
  background-image: var(--merchant-bg, url("/images/merchants/default.jpg"));
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  border-right: 1px solid rgba(188, 156, 255, 0.16);
}
.merchant-scene .merchant-bg-video-wrap { position: absolute; inset: 0; z-index: 0; border-radius: 0; }
.merchant-scene .merchant-bg-video { width: 100%; height: 100%; object-fit: cover; }
.merchant-scene-scrim { position: absolute; inset: 0; z-index: 1; background: linear-gradient(180deg, rgba(9,7,14,0.08), rgba(9,7,14,0.78) 74%, rgba(9,7,14,0.94)); }
.merchant-scene-copy { position: absolute; z-index: 2; left: 18px; right: 18px; bottom: 18px; }
.merchant-scene-theme { display: inline-flex; padding: 4px 8px; border: 1px solid rgba(255,255,255,0.18); border-radius: 999px; background: rgba(10,8,18,0.58); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.12em; }
.merchant-scene-copy h3 { margin: 8px 0 4px; color: #fff4d2; font-size: 1.25rem; font-weight: 900; }
.merchant-scene-copy p { margin: 0; color: rgba(245,238,255,0.76); font-size: 0.84rem; line-height: 1.45; }

.merchant-stock-workspace {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 14px;
  background: linear-gradient(180deg, rgba(22, 17, 35, 0.98), rgba(12, 9, 20, 0.99));
}
.merchant-stock-toolbar { flex: 0 0 auto; display: grid; grid-template-columns: minmax(240px, 0.7fr) minmax(0, 1.3fr); gap: 12px; align-items: end; margin-bottom: 12px; }
.merchant-search-field { display: flex; flex-direction: column; gap: 5px; color: rgba(235,226,250,0.82); font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
.merchant-category-row { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
.merchant-category-chip { flex: 0 0 auto; border: 1px solid rgba(188,156,255,0.18); border-radius: 999px; padding: 6px 10px; background: rgba(255,255,255,0.04); color: rgba(242,235,255,0.82); font-size: 0.74rem; }
.merchant-category-chip:hover,
.merchant-category-chip.active { border-color: rgba(241,201,117,0.55); background: rgba(108,75,164,0.58); color: #fff8e6; }
.merchant-inline-error { margin-bottom: 10px; padding: 8px 10px; border: 1px solid rgba(255,103,117,0.28); border-radius: 10px; background: rgba(176,44,58,0.14); color: #ffd7db; font-size: 0.82rem; }

.merchant-stock-layout { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(285px, 0.78fr) minmax(380px, 1.22fr); gap: 12px; }
.merchant-stock-list { min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px; }
.merchant-stock-row { width: 100%; text-align: left; border: 1px solid rgba(188,156,255,0.13); border-radius: 13px; padding: 10px 11px; background: linear-gradient(180deg, rgba(41,31,65,0.72), rgba(28,21,45,0.82)); color: #f5efff; transition: border-color .15s ease, background .15s ease, transform .15s ease; }
.merchant-stock-row:hover { transform: translateY(-1px); border-color: rgba(211,180,255,0.36); background: linear-gradient(180deg, rgba(53,39,83,0.84), rgba(35,26,56,0.92)); }
.merchant-stock-row.selected { border-color: rgba(241,201,117,0.66); box-shadow: 0 0 0 1px rgba(241,201,117,0.14) inset, 0 8px 22px rgba(0,0,0,0.22); }
.merchant-stock-row-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.merchant-stock-row-head strong { font-size: 0.9rem; line-height: 1.25; }
.merchant-stock-row-head span { color: #ffe1a0; font-weight: 900; white-space: nowrap; }
.merchant-stock-row-meta { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
.merchant-stock-row-meta span { border-radius: 999px; padding: 3px 7px; background: rgba(255,255,255,0.06); color: rgba(235,226,250,0.74); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em; }
.merchant-stock-row p { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin: 8px 0 0; color: rgba(231,222,246,0.72); font-size: 0.76rem; line-height: 1.4; }

.merchant-preview-pane { min-width: 0; min-height: 0; display: flex; flex-direction: column; border: 1px solid rgba(188,156,255,0.16); border-radius: 16px; overflow: hidden; background: radial-gradient(circle at top right, rgba(126,88,255,0.14), transparent 36%), rgba(20,15,32,0.92); }
.merchant-preview-head { flex: 0 0 auto; display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.merchant-preview-head h3 { margin: 4px 0 0; font-size: 1.05rem; font-weight: 900; color: #fff7df; }
.merchant-preview-card-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 12px; }
.merchant-preview-card-scroll .sitem-card { width: 100%; max-width: none; min-width: 0; height: auto; box-shadow: none; border: 1px solid rgba(255,255,255,0.07); }
.merchant-preview-purchase { flex: 0 0 auto; display: grid; grid-template-columns: auto auto minmax(150px, 1fr); gap: 10px; align-items: center; padding: 11px 12px; border-top: 1px solid rgba(255,255,255,0.09); background: rgba(10,8,17,0.96); }
.merchant-preview-purchase > div { display: flex; flex-direction: column; gap: 1px; }
.merchant-preview-purchase span { color: rgba(229,220,245,0.62); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; }
.merchant-preview-purchase strong { color: #fff4d2; }
.merchant-market-empty { display: grid; place-items: center; min-height: 160px; padding: 18px; color: rgba(232,222,248,0.64); text-align: center; }

.merchant-panel-town .merchant-market-shell { grid-template-columns: minmax(260px, 0.62fr) minmax(0, 2.38fr); }
.merchant-panel-map .merchant-market-shell { grid-template-columns: minmax(280px, 0.82fr) minmax(0, 1.8fr); }

@media (max-width: 1100px) {
  .merchant-market-shell { grid-template-columns: 220px minmax(0, 1fr); }
  .merchant-stock-layout { grid-template-columns: minmax(250px, 0.8fr) minmax(330px, 1.2fr); }
  .merchant-admin-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 820px) {
  .merchant-market-header { align-items: flex-start; }
  .merchant-market-shell { grid-template-columns: 1fr; overflow-y: auto; }
  .merchant-scene { min-height: 190px; border-right: 0; border-bottom: 1px solid rgba(188,156,255,0.16); }
  .merchant-stock-workspace { min-height: 680px; }
  .merchant-stock-toolbar,
  .merchant-stock-layout { grid-template-columns: 1fr; }
  .merchant-stock-list { max-height: 330px; }
  .merchant-preview-pane { min-height: 520px; }
  .merchant-admin-restock-row,
  .merchant-admin-grid { grid-template-columns: 1fr; }
}

@media (max-width: 560px) {
  .merchant-market-header { flex-direction: column; }
  .merchant-market-header-actions { width: 100%; justify-content: flex-start; }
  .merchant-stock-workspace { padding: 10px; }
  .merchant-preview-purchase { grid-template-columns: 1fr 1fr; }
  .merchant-preview-purchase .btn { grid-column: 1 / -1; }
}
`;
  fs.writeFileSync(globalPath, globalCss, "utf8");
  console.log("Appended merchant market workspace styles.");
}

const townStylePath = path.join(process.cwd(), "components", "TownSheet.module.scss");
let townCss = fs.readFileSync(townStylePath, "utf8");
if (!townCss.includes(".merchantMarketModal")) {
  townCss += String.raw`

.merchantMarketModal {
  width: min(1440px, calc(100vw - 28px));
  height: min(900px, calc(100vh - 28px));
  max-height: calc(100vh - 28px);
  overflow: hidden;
  padding: 0;
}
`;
  fs.writeFileSync(townStylePath, townCss, "utf8");
  console.log("Appended Town Sheet merchant modal sizing.");
}

const validations = [
  [merchant, 'presentation = "map"', "MerchantPanel presentation"],
  [merchant, 'merchant-stock-layout', "MerchantPanel stock workspace"],
  [merchant, 'setNotice({ kind: "success"', "inline purchase confirmation"],
  [town, 'presentation="town"', "Town Sheet presentation mode"],
  [globalCss, cssMarker, "merchant market CSS"],
  [townCss, ".merchantMarketModal", "Town Sheet merchant modal CSS"],
];
for (const [source, token, label] of validations) {
  if (!source.includes(token)) throw new Error(`${label} validation failed`);
}

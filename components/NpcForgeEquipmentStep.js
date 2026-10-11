import { useEffect, useMemo, useState } from "react";
import ItemCard from "./ItemCard";
import { supabase } from "../utils/supabaseClient";
import {
  cashOnlyEquipmentOption,
  equipmentOptionCopper,
  formatCopper,
  higherLevelWealthRule,
  magicAllowanceLabel,
  startingMarketBudgetCopper,
  startingMarketPurchases,
  startingMarketRemainingCopper,
  startingMarketSpentCopper,
} from "../utils/playerForgeStartingEquipment";

function safeText(value) {
  return String(value ?? "").trim();
}

function stockCard(row = {}, cartQty = 0) {
  const payload = row.card_payload && typeof row.card_payload === "object" ? row.card_payload : {};
  const price = Math.max(0, Number(row.price_gp ?? payload.price_gp ?? payload.price ?? 0) || 0);
  const itemName = row.display_name || payload.item_name || payload.name || "Item";
  return {
    id: row.id,
    stockId: row.id,
    merchantId: row.character_id,
    item_id: row.item_id || payload.item_id || row.id,
    item_name: itemName,
    item_type: payload.item_type || payload.type || null,
    item_rarity: payload.item_rarity || payload.rarity || null,
    item_description: payload.item_description || payload.description || null,
    item_weight: payload.item_weight || payload.weight || null,
    item_cost: `${price} gp`,
    image_url: payload.image_url || row.image_url || "/placeholder.png",
    card_payload: payload,
    _price_gp: price,
    _stock_qty: Math.max(0, Number(row.qty || 0)),
    _cart_qty: Math.max(0, Number(cartQty || 0)),
    _available_qty: Math.max(0, Number(row.qty || 0) - Number(cartQty || 0)),
  };
}

function isStartingMarketStock(row = {}) {
  const payload = row.card_payload && typeof row.card_payload === "object" ? row.card_payload : {};
  const type = safeText(payload.item_type || payload.type).toLowerCase();
  if (type === "recipe" || payload.recipe_unlock || payload.recipeUnlock) return false;
  return Number(row.qty || 0) > 0;
}

function rarityClass(value) {
  const slug = safeText(value || "mundane").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `rarity-${slug || "mundane"}`;
}

function merchantPortrait(merchant = {}) {
  if (merchant.portrait_shop_url) return merchant.portrait_shop_url;
  if (merchant.portrait_url) return merchant.portrait_url;
  if (merchant.image_url) return merchant.image_url;
  if (merchant.portrait_storage_path) {
    return supabase.storage.from("npc-portraits").getPublicUrl(merchant.portrait_storage_path).data?.publicUrl || "";
  }
  return "/images/merchants/default.jpg";
}

export default function NpcForgeEquipmentStep({ model, selection = {}, onChange }) {
  const [merchants, setMerchants] = useState([]);
  const [stock, setStock] = useState([]);
  const [loadingMerchants, setLoadingMerchants] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [selectedStockId, setSelectedStockId] = useState("");
  const [notice, setNotice] = useState("");

  const purchases = useMemo(() => startingMarketPurchases(selection), [selection]);
  const classCashOption = cashOnlyEquipmentOption(model?.classOptions);
  const backgroundCashOption = cashOnlyEquipmentOption(model?.backgroundOptions);
  const classCash = equipmentOptionCopper(classCashOption);
  const backgroundCash = equipmentOptionCopper(backgroundCashOption);
  const budgetCopper = startingMarketBudgetCopper(model, selection);
  const spentCopper = startingMarketSpentCopper(selection);
  const remainingCopper = startingMarketRemainingCopper(model, selection);
  const rule = higherLevelWealthRule(model?.level || 1);

  useEffect(() => {
    let active = true;
    setLoadingMerchants(true);
    setMarketError("");
    supabase.from("characters")
      .select("id,name,role,storefront_enabled,storefront_title,storefront_tagline,portrait_shop_url,portrait_url,portrait_storage_path,image_url")
      .eq("storefront_enabled", true)
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setMarketError(error.message || "Could not load campaign merchants.");
          setMerchants([]);
          setLoadingMerchants(false);
          return;
        }
        const rows = data || [];
        setMerchants(rows);
        const current = safeText(selection.marketMerchantId);
        if ((!current || !rows.some((merchant) => String(merchant.id) === current)) && rows[0]?.id) {
          onChange?.({ ...selection, mode: "market", marketMerchantId: String(rows[0].id), marketPurchases: purchases });
        }
        setLoadingMerchants(false);
      });
    return () => { active = false; };
  }, []);

  const activeMerchant = useMemo(() => merchants.find((merchant) => String(merchant.id) === String(selection.marketMerchantId)) || merchants[0] || null, [merchants, selection.marketMerchantId]);

  useEffect(() => {
    let active = true;
    if (!activeMerchant?.id) {
      setStock([]);
      setLoadingStock(false);
      return () => { active = false; };
    }
    setLoadingStock(true);
    setMarketError("");
    supabase.from("character_stock")
      .select("id,character_id,item_id,display_name,price_gp,qty,card_payload")
      .eq("character_id", activeMerchant.id)
      .order("display_name", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setMarketError(error.message || "Could not load merchant stock.");
          setStock([]);
          setLoadingStock(false);
          return;
        }
        setStock((data || []).filter(isStartingMarketStock));
        setLoadingStock(false);
      });
    return () => { active = false; };
  }, [activeMerchant?.id]);

  const cartQtyByStock = useMemo(() => {
    const map = new Map();
    for (const entry of purchases) map.set(String(entry.stockId), (map.get(String(entry.stockId)) || 0) + Number(entry.qty || 1));
    return map;
  }, [purchases]);

  const cards = useMemo(() => stock.map((row) => stockCard(row, cartQtyByStock.get(String(row.id)) || 0)), [cartQtyByStock, stock]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(cards.map((card) => card.item_type || "Other"))).sort((a, b) => String(a).localeCompare(String(b)))], [cards]);
  const filteredCards = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cards.filter((card) => {
      if (typeFilter !== "All" && String(card.item_type || "Other") !== typeFilter) return false;
      if (!needle) return true;
      return [card.item_name, card.item_type, card.item_rarity, card.item_description].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [cards, query, typeFilter]);

  useEffect(() => {
    if (!filteredCards.length) {
      setSelectedStockId("");
      return;
    }
    if (!filteredCards.some((card) => String(card.id) === String(selectedStockId))) setSelectedStockId(String(filteredCards[0].id));
  }, [filteredCards, selectedStockId]);

  const selectedCard = filteredCards.find((card) => String(card.id) === String(selectedStockId)) || filteredCards[0] || null;
  const selectedPriceCopper = Math.round(Number(selectedCard?._price_gp || 0) * 100);
  const canAffordSelected = Boolean(selectedCard && selectedPriceCopper <= remainingCopper);
  const canAddSelected = Boolean(selectedCard && selectedCard._available_qty > 0 && canAffordSelected);

  function chooseMerchant(merchantId) {
    setQuery("");
    setTypeFilter("All");
    setSelectedStockId("");
    setNotice("");
    onChange?.({ ...selection, mode: "market", marketMerchantId: String(merchantId), marketPurchases: purchases });
  }

  function addSelectedItem() {
    if (!selectedCard || !activeMerchant) return;
    if (selectedCard._available_qty <= 0) {
      setNotice("That item is already fully reserved in your starting cart.");
      return;
    }
    if (!canAffordSelected) {
      setNotice(`You need ${formatCopper(selectedPriceCopper - remainingCopper)} more for ${selectedCard.item_name}.`);
      return;
    }
    const index = purchases.findIndex((entry) => String(entry.stockId) === String(selectedCard.id) && String(entry.merchantId) === String(activeMerchant.id));
    const next = purchases.map((entry) => ({ ...entry }));
    if (index >= 0) next[index].qty += 1;
    else next.push({
      merchantId: String(activeMerchant.id),
      merchantName: activeMerchant.name || "Merchant",
      stockId: String(selectedCard.id),
      itemId: String(selectedCard.item_id || ""),
      itemName: selectedCard.item_name,
      itemType: selectedCard.item_type || "",
      itemRarity: selectedCard.item_rarity || "",
      priceGp: Number(selectedCard._price_gp || 0),
      qty: 1,
    });
    setNotice(`${selectedCard.item_name} added to your starting cart.`);
    onChange?.({ ...selection, mode: "market", marketMerchantId: String(activeMerchant.id), marketPurchases: next });
  }

  function removePurchase(stockId) {
    const index = purchases.findIndex((entry) => String(entry.stockId) === String(stockId));
    if (index < 0) return;
    const next = purchases.map((entry) => ({ ...entry }));
    if (next[index].qty > 1) next[index].qty -= 1;
    else next.splice(index, 1);
    onChange?.({ ...selection, mode: "market", marketMerchantId: String(activeMerchant?.id || selection.marketMerchantId || ""), marketPurchases: next });
  }

  if (!model || model.loading) return <div className="npc-forge-body npc-forge-step-equipment is-player-mode"><section className="npc-forge-workspace"><div className="npc-forge-section"><div className="npc-forge-section-heading"><div><span>Equipment</span><h3>Preparing the starting market…</h3></div></div></div></section></div>;
  if (!model.catalogReady) return <div className="npc-forge-body npc-forge-step-equipment is-player-mode"><section className="npc-forge-workspace"><div className="npc-forge-catalog-warning">{model.error || "Source-backed starting equipment is unavailable."}</div></section></div>;

  return <div className="npc-forge-body npc-forge-step-equipment is-player-mode">
    <section className="npc-forge-workspace">
      <div className="npc-forge-section npc-forge-starting-market">
        <div className="npc-forge-section-heading"><div><span>Equipment</span><h3>Starting market</h3></div><p>Take the source-backed cash alternative and build your own loadout from campaign merchants.</p></div>

        <div className="npc-forge-starting-market__purse">
          <div><span>Class purse</span><strong>{formatCopper(classCash)}</strong><small>{model.className || "Class"} cash option {classCashOption?.key || "—"}</small></div>
          <div><span>Background purse</span><strong>{formatCopper(backgroundCash)}</strong><small>{model.backgroundName || "Background"} cash option {backgroundCashOption?.key || "—"}</small></div>
          <div><span>Starting budget</span><strong>{formatCopper(budgetCopper)}</strong><small>{rule.rollRequired && !selection.wealthRoll ? "Higher-level roll still required" : "Available before market purchases"}</small></div>
          <div className="is-remaining"><span>Remaining</span><strong>{formatCopper(remainingCopper)}</strong><small>{formatCopper(spentCopper)} currently staged</small></div>
        </div>

        {rule.rollRequired ? <div className="npc-forge-equipment-roll npc-forge-starting-market__roll"><p>Higher-level creation adds {rule.baseGp.toLocaleString()} gp + 1d10 × {rule.multiplierGp.toLocaleString()} gp to this starting market purse.</p><button type="button" onClick={() => onChange?.({ ...selection, mode: "market", wealthRoll: 1 + Math.floor(Math.random() * 10), marketPurchases: purchases })}>Roll 1d10 Starting Wealth</button><strong>{selection.wealthRoll ? `d10 = ${selection.wealthRoll}` : "Roll required"}</strong></div> : null}

        <div className="npc-forge-starting-market__note">Purchases are staged during Character Forge. Merchant stock, character-scoped inventory, and the remaining starting currency are committed together only when the character is created. This does not use the account-wide player wallet.</div>

        <div className="npc-forge-starting-market__merchant-tabs" aria-label="Starting market merchants">
          {loadingMerchants ? <span>Loading merchants…</span> : null}
          {!loadingMerchants && !merchants.length ? <span>No storefront merchants are currently available. You can continue and keep the full starting purse.</span> : null}
          {merchants.map((merchant) => <button key={merchant.id} type="button" className={String(activeMerchant?.id) === String(merchant.id) ? "is-active" : ""} onClick={() => chooseMerchant(merchant.id)}><strong>{merchant.name}</strong><small>{merchant.storefront_title || merchant.role || "Merchant"}</small></button>)}
        </div>

        {activeMerchant ? <div className="merchant-market npc-forge-starting-market__store">
          <main className="merchant-market-shell">
            <section className="merchant-scene" style={{ "--merchant-bg": `url("${merchantPortrait(activeMerchant)}")` }}>
              <div className="merchant-scene-scrim" />
              <div className="merchant-scene-copy"><span className="merchant-scene-theme">Starting vendor</span><h3>{activeMerchant.name}</h3><p>{activeMerchant.storefront_tagline || activeMerchant.storefront_title || activeMerchant.role || "Browse this merchant's current stock."}</p></div>
            </section>
            <section className="merchant-stock-workspace">
              <div className="merchant-stock-toolbar">
                <label className="merchant-search-field"><span>Search stock</span><input className="form-control form-control-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, rarity, type, or description" /></label>
                <div className="merchant-category-row">{categories.map((category) => <button key={category} type="button" className={`merchant-category-chip ${typeFilter === category ? "active" : ""}`} onClick={() => setTypeFilter(category)}>{category}</button>)}</div>
              </div>
              {marketError ? <div className="merchant-inline-error">{marketError}</div> : null}
              {notice ? <div className="npc-forge-starting-market__notice">{notice}</div> : null}
              <div className="merchant-stock-layout">
                <div className="merchant-stock-list" role="listbox" aria-label={`${activeMerchant.name} starting stock`}>
                  {loadingStock ? <div className="merchant-market-empty">Loading stock…</div> : null}
                  {!loadingStock && !filteredCards.length ? <div className="merchant-market-empty">No starting-market items match this filter.</div> : null}
                  {filteredCards.map((card) => <button key={card.id} type="button" role="option" aria-selected={String(selectedCard?.id) === String(card.id)} className={`merchant-stock-row ${rarityClass(card.item_rarity)} ${String(selectedCard?.id) === String(card.id) ? "selected" : ""}`} onClick={() => setSelectedStockId(String(card.id))}>
                    <div className="merchant-stock-row-head"><strong>{card.item_name}</strong><span>{card._price_gp} gp</span></div>
                    <div className="merchant-stock-row-meta"><span>{card.item_rarity || "Mundane"}</span><span>{card.item_type || "Item"}</span><span>{card._available_qty} available</span>{card._cart_qty ? <span>{card._cart_qty} in cart</span> : null}</div>
                    <p>{card.item_description || "No description is available for this item."}</p>
                  </button>)}
                </div>
                <aside className="merchant-preview-pane">
                  {selectedCard ? <>
                    <div className="merchant-preview-head"><div><div className="merchant-market-kicker">Selected item</div><h3>{selectedCard.item_name}</h3></div><span className="merchant-preview-price">{selectedCard._price_gp} gp</span></div>
                    <div className="merchant-preview-card-scroll"><ItemCard item={selectedCard} /></div>
                    <div className="merchant-preview-purchase">
                      <div><span>Available</span><strong>{selectedCard._available_qty}</strong></div>
                      <div><span>Starting purse</span><strong>{formatCopper(remainingCopper)}</strong></div>
                      <button type="button" className="btn btn-success" onClick={addSelectedItem} disabled={!canAddSelected}>{selectedCard._available_qty <= 0 ? "Reserved" : !canAffordSelected ? "Not enough gold" : `Add for ${selectedCard._price_gp} gp`}</button>
                    </div>
                  </> : <div className="merchant-market-empty">Select an item to inspect it.</div>}
                </aside>
              </div>
            </section>
          </main>
        </div> : null}
      </div>
    </section>

    <aside className="npc-forge-preview npc-forge-context-panel">
      <div className="npc-forge-context-card npc-forge-starting-cart">
        <div className="npc-forge-context-header"><span>Creation summary</span><h4>Starting cart</h4></div>
        <div className="npc-forge-starting-cart__balance"><span>Remaining after purchases</span><strong>{formatCopper(remainingCopper)}</strong><small>Budget {formatCopper(budgetCopper)} · Spent {formatCopper(spentCopper)}</small></div>
        <div className="npc-forge-starting-cart__items">
          {purchases.length ? purchases.map((entry) => <div key={`${entry.merchantId}:${entry.stockId}`}><span><strong>{entry.qty > 1 ? `${entry.qty}× ` : ""}{entry.itemName}</strong><small>{entry.merchantName || "Merchant"} · {entry.priceGp} gp each</small></span><button type="button" onClick={() => removePurchase(entry.stockId)} aria-label={`Remove one ${entry.itemName}`}>−</button></div>) : <p>No purchases yet. Keeping gold is allowed.</p>}
        </div>
        <dl className="npc-forge-equipment-summary">
          <div><dt>Class cash option</dt><dd>{classCashOption ? `Option ${classCashOption.key} · ${formatCopper(classCash)}` : "Unavailable"}</dd></div>
          <div><dt>Background cash option</dt><dd>{backgroundCashOption ? `Option ${backgroundCashOption.key} · ${formatCopper(backgroundCash)}` : "Unavailable"}</dd></div>
          <div><dt>Higher-level magic</dt><dd>{magicAllowanceLabel(model.level)}</dd></div>
        </dl>
        <p className="npc-forge-equipment-note"><strong>DM guide only:</strong> the higher-level magic-item allowance remains a review guide; the Forge does not grant free magic items.</p>
      </div>
    </aside>

    <style jsx global>{`
      .npc-forge-body.npc-forge-step-equipment{grid-template-columns:minmax(0,76fr) minmax(320px,24fr)}.npc-forge-starting-market{min-height:0}.npc-forge-starting-market__purse{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-bottom:9px}.npc-forge-starting-market__purse>div{display:grid;gap:2px;padding:8px 10px;border:1px solid rgba(168,108,255,.18);border-radius:9px;background:rgba(126,72,199,.045)}.npc-forge-starting-market__purse>div.is-remaining{border-color:rgba(88,214,199,.35);background:rgba(88,214,199,.07)}.npc-forge-starting-market__purse span{color:rgba(255,255,255,.52);font-size:.55rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.npc-forge-starting-market__purse strong{color:#fff;font-size:.86rem}.npc-forge-starting-market__purse .is-remaining strong{color:#aefbef}.npc-forge-starting-market__purse small{color:rgba(255,255,255,.56);font-size:.56rem;line-height:1.35}.npc-forge-starting-market__roll{margin-bottom:8px}.npc-forge-starting-market__note{margin-bottom:8px;padding:7px 9px;border-left:3px solid rgba(88,214,199,.58);border-radius:7px;background:rgba(88,214,199,.055);color:rgba(255,255,255,.72);font-size:.64rem;line-height:1.45}.npc-forge-starting-market__merchant-tabs{display:flex;gap:6px;overflow-x:auto;margin-bottom:8px;padding-bottom:1px}.npc-forge-starting-market__merchant-tabs>span{padding:7px 9px;color:rgba(255,255,255,.62);font-size:.64rem}.npc-forge-starting-market__merchant-tabs>button{display:grid;gap:1px;flex:0 0 auto;min-width:150px;padding:6px 9px;border:1px solid rgba(168,108,255,.2);border-radius:8px;color:#fff;background:rgba(126,72,199,.045);text-align:left}.npc-forge-starting-market__merchant-tabs>button.is-active{border-color:rgba(241,201,117,.58);background:rgba(126,72,199,.16)}.npc-forge-starting-market__merchant-tabs strong{font-size:.66rem}.npc-forge-starting-market__merchant-tabs small{color:rgba(255,255,255,.5);font-size:.53rem}.npc-forge-starting-market__store{height:min(58vh,650px);min-height:520px;border:1px solid rgba(168,108,255,.24);border-radius:12px}.npc-forge-starting-market__store .merchant-market-shell{grid-template-columns:minmax(210px,.5fr) minmax(0,2.5fr)}.npc-forge-starting-market__store .merchant-stock-workspace{padding:10px}.npc-forge-starting-market__store .merchant-stock-toolbar{margin-bottom:8px}.npc-forge-starting-market__store .merchant-stock-layout{grid-template-columns:minmax(300px,.9fr) minmax(420px,1.1fr);gap:9px}.npc-forge-starting-market__store .merchant-stock-row{padding:8px 9px;border-radius:9px}.npc-forge-starting-market__store .merchant-stock-row-head strong{font-size:.78rem}.npc-forge-starting-market__store .merchant-stock-row p{margin-top:5px;font-size:.66rem}.npc-forge-starting-market__store .merchant-stock-row-meta{margin-top:5px}.npc-forge-starting-market__store .merchant-stock-row-meta span{padding:2px 5px;font-size:.55rem}.npc-forge-starting-market__store .merchant-preview-pane{border-radius:10px}.npc-forge-starting-market__store .merchant-preview-card-scroll{padding:8px}.npc-forge-starting-market__store .merchant-scene-copy{left:14px;right:14px;bottom:14px}.npc-forge-starting-market__notice{margin-bottom:7px;padding:6px 8px;border:1px solid rgba(241,201,117,.24);border-radius:7px;color:#ffe3a6;background:rgba(241,201,117,.07);font-size:.62rem}.npc-forge-starting-cart{display:grid;align-content:start;gap:10px}.npc-forge-starting-cart__balance{display:grid;gap:3px;padding:10px 11px;border:1px solid rgba(88,214,199,.25);border-radius:9px;background:rgba(88,214,199,.06)}.npc-forge-starting-cart__balance span{color:rgba(255,255,255,.5);font-size:.57rem;font-weight:900;text-transform:uppercase}.npc-forge-starting-cart__balance strong{color:#aefbef;font-size:1.05rem}.npc-forge-starting-cart__balance small{color:rgba(255,255,255,.58);font-size:.6rem}.npc-forge-starting-cart__items{display:grid;gap:0;max-height:310px;overflow:auto;border-top:1px solid rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.07)}.npc-forge-starting-cart__items>div{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 2px;border-top:1px solid rgba(255,255,255,.055)}.npc-forge-starting-cart__items>div:first-child{border-top:0}.npc-forge-starting-cart__items>div>span{display:grid;gap:2px;min-width:0}.npc-forge-starting-cart__items strong{color:#fff;font-size:.68rem}.npc-forge-starting-cart__items small{color:rgba(255,255,255,.52);font-size:.56rem}.npc-forge-starting-cart__items button{width:26px;height:26px;border:1px solid rgba(255,143,122,.32);border-radius:999px;color:#ffd3cc;background:rgba(255,143,122,.07)}.npc-forge-starting-cart__items p{margin:8px 2px;color:rgba(255,255,255,.56);font-size:.62rem}.npc-forge-equipment-roll{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:9px 10px;border:1px solid rgba(88,214,199,.2);border-radius:9px;background:rgba(88,214,199,.045)}.npc-forge-equipment-roll p{margin:0;color:rgba(255,255,255,.65);font-size:.66rem}.npc-forge-equipment-roll button{padding:6px 9px;border:1px solid rgba(88,214,199,.42);border-radius:8px;background:rgba(42,136,124,.12);color:#c9fff7;font-size:.65rem}.npc-forge-equipment-roll strong{color:#fff3ce;font-size:.68rem}.npc-forge-equipment-summary{display:grid;gap:7px;margin:2px 0}.npc-forge-equipment-summary>div{display:grid;grid-template-columns:105px minmax(0,1fr);gap:8px}.npc-forge-equipment-summary dt{color:rgba(255,255,255,.48);font-size:.57rem;text-transform:uppercase}.npc-forge-equipment-summary dd{margin:0;color:#fff;font-size:.66rem}.npc-forge-equipment-note{color:rgba(255,255,255,.58);font-size:.62rem;line-height:1.45}@media(max-width:1180px){.npc-forge-starting-market__purse{grid-template-columns:repeat(2,minmax(0,1fr))}.npc-forge-starting-market__store .merchant-market-shell{grid-template-columns:180px minmax(0,1fr)}.npc-forge-starting-market__store .merchant-stock-layout{grid-template-columns:minmax(250px,.9fr) minmax(360px,1.1fr)}}@media(max-width:900px){.npc-forge-body.npc-forge-step-equipment{grid-template-columns:1fr}.npc-forge-starting-market__store{height:auto}.npc-forge-starting-market__store .merchant-market-shell,.npc-forge-starting-market__store .merchant-stock-layout{grid-template-columns:1fr}.npc-forge-starting-market__store .merchant-scene{min-height:210px}.npc-forge-equipment-roll{grid-template-columns:1fr}.npc-forge-equipment-roll button{justify-self:start}}@media(max-width:620px){.npc-forge-starting-market__purse{grid-template-columns:1fr}}
    `}</style>
  </div>;
}

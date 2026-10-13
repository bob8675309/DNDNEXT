import { useEffect, useMemo, useState } from "react";
import MerchantAmbientBackdrop from "./MerchantAmbientBackdrop";
import MerchantRail from "./MerchantRail";
import NpcForgeMerchantMarket from "./NpcForgeMerchantMarket";
import NpcForgeEquipmentSummaryDock from "./NpcForgeEquipmentSummaryDock";
import { supabase } from "../utils/supabaseClient";
import {
  cashOnlyEquipmentOption,
  equipmentOptionCopper,
  formatCopper,
  higherLevelWealthRule,
  startingEquipmentRuleset,
  startingMarketBudgetCopper,
  startingMarketPurchases,
  startingMarketVanillaCopper,
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
    image_url: payload.image_url || row.image_url || null,
    source: payload.source || payload.item_source || row.source || null,
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
  const ruleset = startingEquipmentRuleset(selection);
  const vanillaSourceCopper = startingMarketVanillaCopper(model);
  const budgetCopper = startingMarketBudgetCopper(model, selection);
  const spentCopper = startingMarketSpentCopper(selection);
  const remainingCopper = startingMarketRemainingCopper(model, selection);
  const rule = higherLevelWealthRule(model?.level || 1);
  const keepingFullPurse = Boolean(selection.keepStartingGold) && purchases.length === 0;

  useEffect(() => {
    let active = true;
    setLoadingMerchants(true);
    setMarketError("");
    supabase.from("characters")
      .select("id,name,role,description,tags,storefront_enabled,storefront_title,storefront_tagline,storefront_bg_url,storefront_bg_video_url,storefront_bg_image_url,portrait_shop_url,portrait_url,portrait_thumb_url,portrait_storage_path,image_url")
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
          onChange?.({ ...selection, mode: "market", marketMerchantId: String(rows[0].id), marketPurchases: purchases, keepStartingGold: Boolean(selection.keepStartingGold) && purchases.length === 0 });
        }
        setLoadingMerchants(false);
      });
    return () => { active = false; };
  }, []);

  const activeMerchant = useMemo(
    () => merchants.find((merchant) => String(merchant.id) === String(selection.marketMerchantId)) || merchants[0] || null,
    [merchants, selection.marketMerchantId],
  );

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

  const cards = useMemo(
    () => stock.map((row) => stockCard(row, cartQtyByStock.get(String(row.id)) || 0)),
    [cartQtyByStock, stock],
  );

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(cards.map((card) => card.item_type || "Other"))).sort((a, b) => String(a).localeCompare(String(b)))],
    [cards],
  );

  const filteredCards = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = cards.filter((card) => {
      if (typeFilter !== "All" && String(card.item_type || "Other") !== typeFilter) return false;
      if (!needle) return true;
      return [card.item_name, card.item_type, card.item_rarity, card.item_description, card.source]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    return filtered;
  }, [cards, query, typeFilter]);

  useEffect(() => {
    if (!filteredCards.length) {
      setSelectedStockId("");
      return;
    }
    if (!filteredCards.some((card) => String(card.id) === String(selectedStockId))) {
      setSelectedStockId(String(filteredCards[0].id));
    }
  }, [filteredCards, selectedStockId]);

  const selectedCard = filteredCards.find((card) => String(card.id) === String(selectedStockId)) || filteredCards[0] || null;

  function canAddItem(card) {
    if (!card) return false;
    const priceCopper = Math.round(Number(card._price_gp || 0) * 100);
    return card._available_qty > 0 && priceCopper <= remainingCopper;
  }

  function chooseMerchant(merchantId) {
    setQuery("");
    setTypeFilter("All");
    setSelectedStockId("");
    setNotice("");
    onChange?.({ ...selection, mode: "market", marketMerchantId: String(merchantId), marketPurchases: purchases, keepStartingGold: keepingFullPurse });
  }

  function addItem(card) {
    if (!card || !activeMerchant) return;
    const priceCopper = Math.round(Number(card._price_gp || 0) * 100);
    if (card._available_qty <= 0) {
      setNotice("That item is already fully reserved in your starting cart.");
      return;
    }
    if (priceCopper > remainingCopper) {
      setNotice(`You need ${formatCopper(priceCopper - remainingCopper)} more for ${card.item_name}.`);
      return;
    }

    const index = purchases.findIndex((entry) => String(entry.stockId) === String(card.id) && String(entry.merchantId) === String(activeMerchant.id));
    const next = purchases.map((entry) => ({ ...entry }));
    if (index >= 0) next[index].qty += 1;
    else next.push({
      merchantId: String(activeMerchant.id),
      merchantName: activeMerchant.name || "Merchant",
      stockId: String(card.id),
      itemId: String(card.item_id || ""),
      itemName: card.item_name,
      itemType: card.item_type || "",
      itemRarity: card.item_rarity || "",
      priceGp: Number(card._price_gp || 0),
      qty: 1,
    });

    setSelectedStockId(String(card.id));
    setNotice(`${card.item_name} added to your starting cart.`);
    onChange?.({ ...selection, mode: "market", marketMerchantId: String(activeMerchant.id), marketPurchases: next, keepStartingGold: false });
  }

  function removePurchase(stockId) {
    const index = purchases.findIndex((entry) => String(entry.stockId) === String(stockId));
    if (index < 0) return;
    const next = purchases.map((entry) => ({ ...entry }));
    if (next[index].qty > 1) next[index].qty -= 1;
    else next.splice(index, 1);
    onChange?.({
      ...selection,
      mode: "market",
      marketMerchantId: String(activeMerchant?.id || selection.marketMerchantId || ""),
      marketPurchases: next,
      keepStartingGold: false,
    });
  }

  function keepFullPurse() {
    if (purchases.length && typeof window !== "undefined") {
      const confirmed = window.confirm(`Clear your starting cart and keep the full ${formatCopper(budgetCopper)} starting purse?`);
      if (!confirmed) return;
    }
    setNotice(`No starting gear selected. Continue when ready; the full ${formatCopper(budgetCopper)} will stay with this character.`);
    onChange?.({
      ...selection,
      mode: "market",
      marketMerchantId: String(activeMerchant?.id || selection.marketMerchantId || ""),
      marketPurchases: [],
      keepStartingGold: true,
    });
  }

  if (model?.loading) {
    return <div className="npc-forge-body npc-forge-step-equipment is-player-mode"><section className="npc-forge-workspace"><div className="npc-forge-equipment-market-prereq"><strong>Preparing the starting market…</strong>Resolving the current Class, Background, starting purse, and merchant catalogue.</div></section></div>;
  }

  if (!model) {
    return <div className="npc-forge-body npc-forge-step-equipment is-player-mode"><section className="npc-forge-workspace"><div className="npc-forge-equipment-market-prereq"><strong>Starting market needs this Forge draft.</strong>Equipment needs a selected Class and Background to resolve its source purse. A saved Forge draft restores only on the same site origin where it was created; version-specific Vercel deployment hostnames do not share browser localStorage with dndnext.vercel.app. Choose Class and Background first, or open the review link on the same origin as the saved draft.</div></section></div>;
  }

  if (!model.catalogReady) {
    return <div className="npc-forge-body npc-forge-step-equipment is-player-mode"><section className="npc-forge-workspace"><div className="npc-forge-equipment-market-prereq"><strong>Source-backed starting equipment is unavailable.</strong>{model.error || "The imported starting-equipment catalogue could not be resolved."}</div></section></div>;
  }

  const selectedActionLabel = selectedCard?._available_qty <= 0
    ? "Reserved"
    : !selectedCard || !canAddItem(selectedCard)
      ? "Not enough gold"
      : `Add to Starting Cart (${selectedCard._price_gp} gp)`;

  const cartControl = <NpcForgeEquipmentSummaryDock
    presentation="header"
    ruleset={ruleset}
    budgetCopper={budgetCopper}
    spentCopper={spentCopper}
    remainingCopper={remainingCopper}
    vanillaSourceCopper={vanillaSourceCopper}
    classCashCopper={classCash}
    backgroundCashCopper={backgroundCash}
    level={model.level}
    purchases={purchases}
    keepStartingGold={keepingFullPurse}
    wealthRoll={selection.wealthRoll || null}
    rollRequired={rule.rollRequired}
    onRollWealth={() => onChange?.({
      ...selection,
      mode: "market",
      wealthRoll: 1 + Math.floor(Math.random() * 10),
      marketPurchases: purchases,
      keepStartingGold: keepingFullPurse,
    })}
    onKeepFullPurse={keepFullPurse}
    onRemovePurchase={removePurchase}
  />;

  return <div className="npc-forge-body npc-forge-step-equipment is-player-mode">
    <section className="npc-forge-workspace">
      <div className="npc-forge-equipment-storefront is-merchant-panel-pivot">
        {activeMerchant ? <MerchantAmbientBackdrop merchant={activeMerchant} className="forge-equipment-stage-backdrop" /> : null}

        <div className="forge-equipment-vendor-frame">
          <MerchantRail
            merchants={merchants}
            activeMerchantId={activeMerchant?.id || ""}
            loading={loadingMerchants}
            onSelect={chooseMerchant}
          />

          <NpcForgeMerchantMarket
            merchant={activeMerchant}
            items={filteredCards}
            categories={categories}
            selectedCard={selectedCard}
            query={query}
            typeFilter={typeFilter}
            loading={loadingStock}
            error={marketError}
            notice={notice}
            remainingCopper={remainingCopper}
            headerActions={cartControl}
            onQueryChange={setQuery}
            onTypeFilterChange={setTypeFilter}
            onSelect={(id) => {
              setSelectedStockId(String(id));
              setNotice("");
            }}
            onAdd={addItem}
            canAddItem={canAddItem}
            selectedActionLabel={selectedActionLabel}
          />
        </div>
      </div>
    </section>
  </div>;
}

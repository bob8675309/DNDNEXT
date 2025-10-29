// ============================
// FILE: components/MerchantPanel.js
// (Option A: client-driven reroll using Admin catalog)
// ============================

import { useEffect, useMemo, useState, useCallback } from "react";
import ItemCard from "./ItemCard";
import useWallet from "../utils/useWallet";
import { supabase } from "../utils/supabaseClient";
import { themeFromMerchant as detectTheme, Pill, backgroundForTheme } from "../utils/merchantTheme";
import { classifyUi } from "../utils/itemsIndex";

/**
 * MerchantPanel (normalized + themed reroll)
 *
 * Changes (surgical):
 * - Reroll now reuses the Admin catalog (/items/all-items.json) and classifies items
 *   via classifyUi to pick theme-appropriate stock; writes to merchant_stock using
 *   RPC stock_merchant_item with a direct-insert fallback. (Keeps existing server RPC
 *   as a last resort.)
 * - Removed inline z-index wrappers; stacking is controlled by CSS classes only so
 *   expanded cards always stay above minis.
 * - Exposes a per-theme background by setting a CSS var on the closest container.
 */
export default function MerchantPanel({ merchant, isAdmin = false }) {
  const { uid, gp, loading: walletLoading, refresh: refreshWallet } = useWallet();
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const [restockText, setRestockText] = useState("");

  const theme = useMemo(() => detectTheme(merchant), [merchant]);
  const bgImg = useMemo(() => backgroundForTheme(theme), [theme]);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    setErr("");
    const { data, error } = await supabase
      .from("merchant_stock")
      .select("*")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: true });
    if (error) setErr(error.message);
    setStock(data || []);
    setLoading(false);
  }, [merchant?.id]);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  function normalizeRow(row) {
    const payload = row.card_payload || {};
    const price = Number(row.price_gp ?? payload.price_gp ?? payload.price ?? 0);
    const name = row.display_name || payload.display_name || payload.item_name || payload.name || "Item";
    return {
      id: row.id,
      item_id: payload.item_id || row.id,
      item_name: name,
      item_type: payload.item_type || payload.type || null,
      item_rarity: payload.item_rarity || payload.rarity || null,
      item_description: payload.item_description || payload.description || row.description || null,
      item_weight: payload.item_weight || payload.weight || null,
      item_cost: `${price} gp`,
      image_url: payload.image_url || row.image_url || "/placeholder.png",
      card_payload: payload,
      _price_gp: price,
      _qty: row.qty ?? 0,
    };
  }

  const cards = useMemo(() => stock.map(normalizeRow), [stock]);

  async function handleBuy(card) {
    if (!uid) return alert("Please sign in.");
    setBusyId(card.id);
    setErr("");
    try {
      let res = await supabase.rpc("buy_from_merchant", {
        p_merchant_id: merchant.id,
        p_stock_uuid: card.id, // preferred arg name
        p_qty: 1,
      });
      if (res.error && /No function|does not exist/i.test(res.error.message)) {
        // Old signature fallback
        res = await supabase.rpc("buy_from_merchant", { p_merchant: merchant.id, p_stock: card.id, p_q: 1 });
      }
      if (res.error) throw res.error;
      await Promise.all([fetchStock(), refreshWallet()]);
      alert(`Purchased: ${card.item_name} for ${card._price_gp} gp.`);
    } catch (e) {
      console.error(e);
      setErr(e.message || "Purchase failed");
      alert(e.message || "Purchase failed.");
    } finally {
      setBusyId(null);
    }
  }

  // ---------- Theme helpers reused from Admin classification ----------
  const titleOf = (it) => String(it.name || it.item_name || "");
  const rarityOf = (it) => String(it.rarity || it.item_rarity || "");

  function jewelryLike(name) {
    const s = name.toLowerCase();
    return /\b(ring|amulet|necklace|locket|pendant|charm|bracelet|bangle|earring|circlet|tiara|diadem|brooch|cameo|jewel|gem|stone|bead|figurine)\b/.test(s);
  }

  function themePredicate(t) {
    return (it) => {
      const cls = classifyUi(it); // { uiType, rawType }
      const ui = cls.uiType || cls.rawType || "";
      const name = titleOf(it);
      switch ((t || "").toLowerCase()) {
        case "jeweler":
          return ui === "Ring" || jewelryLike(name) || (ui === "Wondrous Item" && jewelryLike(name));
        case "smith":
        case "armorer":
          return ui === "Armor" || ui === "Shield" || ui === "Melee Weapon";
        case "fletcher":
          return ui === "Ranged Weapon" || ui === "Ammunition";
        case "alchemist":
        case "apothecary":
          return ui === "Potions & Poisons" || /\b(potion|poison|elixir|philter|phial|herb|herbal|alchemist|alchemical)\b/i.test(name);
        case "arcane":
        case "occult":
          return /\b(wand|staff|rod|orb|focus|scroll|spellbook)\b/i.test(name) || ui === "Scroll & Focus";
        case "dwarven":
          return (ui === "Armor" || ui === "Shield" || ui === "Melee Weapon") && /\b(dwarf|dwarven|mithral|adamantine|adamantite|stone|hammer)\b/i.test(name);
        case "drow":
          return /\b(drow|matron|spider|web|lolth|piwafwi|hand crossbow)\b/i.test(name);
        case "kaorti":
          return /\b(kaorti|resin|far\s*realm|ichor|eldritch)\b/i.test(name);
        default:
          return true; // general store
      }
    };
  }

  const rarityWeight = (r) => {
    const x = String(r || "").toLowerCase();
    if (x === "uncommon") return 6;
    if (x === "rare") return 4;
    if (x === "very rare") return 1;
    if (x === "common" || x === "mundane" || x === "none") return 2;
    return 0.5; // legendary/artifact—still possible but very unlikely
  };

  function weightedSample(pool, count) {
    const bag = [];
    for (const it of pool) {
      const w = rarityWeight(rarityOf(it));
      const n = Math.max(1, Math.floor(w));
      for (let i = 0; i < n; i++) bag.push(it);
    }
    const picks = [];
    const used = new Set();
    while (picks.length < count && bag.length) {
      const idx = Math.floor(Math.random() * bag.length);
      const pick = bag[idx];
      const key = titleOf(pick).toLowerCase();
      if (!used.has(key)) {
        used.add(key);
        picks.push(pick);
      }
      bag.splice(idx, 1);
    }
    return picks;
  }

  const priceFromRarity = (r) => {
    const x = String(r || "").toLowerCase();
    if (x === "common") return 10;
    if (x === "uncommon") return 50;
    if (x === "rare") return 500;
    if (x === "very rare") return 5000;
    if (x === "legendary") return 25000;
    return 5;
  };

  async function upsertStockRows(items) {
    const rows = items.map((it) => {
      const cls = classifyUi(it);
      const name = titleOf(it);
      const rarity = rarityOf(it);
      const price_gp = Number(it.price_gp || it.value || it.price || priceFromRarity(rarity)) || 0;
      const payload = {
        item_id: it.id || undefined,
        item_name: name,
        item_rarity: rarity,
        item_type: cls.uiType || cls.rawType || undefined,
        image_url: it.image_url || it.img || it.image || "/placeholder.png",
        description: it.description || (Array.isArray(it.entries) ? undefined : undefined),
        price_gp,
      };
      return { display_name: name, price_gp, qty: 1 + Math.floor(Math.random() * 2), payload };
    });

    // Insert/merge via RPC (preferred), fall back to direct inserts
    for (const r of rows) {
      let rpc = await supabase.rpc("stock_merchant_item", {
        p_merchant_id: merchant.id,
        p_display_name: r.display_name,
        p_price_gp: r.price_gp,
        p_qty: r.qty,
        p_payload: r.payload,
      });
      if (rpc.error && /No function|does not exist/i.test(rpc.error.message)) {
        // Fallback: direct insert
        const { error } = await supabase.from("merchant_stock").insert({
          merchant_id: merchant.id,
          display_name: r.display_name,
          price_gp: r.price_gp,
          qty: r.qty,
          card_payload: r.payload,
        });
        if (error) throw error;
      } else if (rpc.error) {
        throw rpc.error;
      }
    }
  }

  async function rerollThemed() {
    setBusyId("reroll");
    setErr("");
    try {
      // Try client-driven reroll using Admin catalog
      const res = await fetch("/items/all-items.json");
      if (res.ok) {
        const all = (await res.json()) || [];
        const pred = themePredicate(theme);
        const pool = (all || []).filter(pred);
        // Target 16 items by default; adjust if pool is small
        const picks = weightedSample(pool, 16);
        // Replace current stock
        await supabase.from("merchant_stock").delete().eq("merchant_id", merchant.id);
        await upsertStockRows(picks);
        await fetchStock();
        return;
      }

      // Fallback to existing server-side RPC if catalog fetch fails
      let rpc = await supabase.rpc("reroll_merchant_inventory", {
        p_merchant_id: merchant.id,
        p_theme: theme,
        p_count: 16,
      });
      if (rpc.error && /No function|does not exist/i.test(rpc.error.message)) {
        rpc = await supabase.rpc("reroll_merchant_inventory", { p_merchant: merchant.id, p_theme: theme, p_cnt: 16 });
      }
      if (rpc.error) throw rpc.error;
      await fetchStock();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Reroll failed");
      alert(e.message || "Reroll failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function dumpAll() {
    if (!confirm("Dump all current stock?")) return;
    setBusyId("dump");
    try {
      const { error } = await supabase.from("merchant_stock").delete().eq("merchant_id", merchant.id);
      if (error) throw error;
      await fetchStock();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Dump failed");
    } finally { setBusyId(null); }
  }

  // ---- Admin: add single item (name or JSON). Uses RPC first, falls back to insert.
  async function addItem() {
    if (!restockText.trim()) return;
    setBusyId("add");
    setErr("");
    try {
      const raw = restockText.trim();
      let row = null;
      if (raw.startsWith("{") || raw.startsWith("[")) {
        try { row = JSON.parse(raw); } catch { throw new Error("Invalid JSON payload"); }
      } else {
        row = { name: raw };
      }

      const qty = Number(row.qty ?? row.quantity ?? 1) || 1;
      const price_gp = Number(row.value ?? row.price ?? row.price_gp ?? 0) || 0;
      const display_name = String(row.name || row.item_name || row.display_name || "Item");
      const payload = row.card_payload || row.payload || {
        item_id: row.item_id || undefined,
        item_name: display_name,
        item_rarity: row.rarity || row.item_rarity || undefined,
        item_type: row.type || row.item_type || undefined,
        image_url: row.image_url || undefined,
        description: row.description || undefined,
        price_gp,
      };

      let rpc = await supabase.rpc("stock_merchant_item", {
        p_merchant_id: merchant.id,
        p_display_name: display_name,
        p_price_gp: price_gp,
        p_qty: qty,
        p_payload: payload,
      });

      if (rpc.error && /No function|does not exist/i.test(rpc.error.message)) {
        const { error } = await supabase.from("merchant_stock").insert({
          merchant_id: merchant.id,
          display_name,
          price_gp,
          qty,
          card_payload: payload,
        });
        if (error) throw error;
      } else if (rpc.error) {
        throw rpc.error;
      }

      setRestockText("");
      await fetchStock();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Add failed");
    } finally { setBusyId(null); }
  }

  async function changeQty(stockId, nextQty) {
    const qty = Math.max(0, Number(nextQty || 0));
    const { error } = await supabase.from("merchant_stock").update({ qty }).eq("id", stockId);
    if (error) throw error;
  }
  async function incQty(stockId, by = 1) {
    setBusyId(`inc:${stockId}`);
    try { const row = stock.find(r => r.id === stockId); if (!row) return; await changeQty(stockId, (row.qty || 0) + by); await fetchStock(); }
    catch (e) { console.error(e); setErr(e.message || "Update failed"); }
    finally { setBusyId(null); }
  }
  async function decQty(stockId, by = 1) {
    setBusyId(`dec:${stockId}`);
    try { const row = stock.find(r => r.id === stockId); if (!row) return; await changeQty(stockId, Math.max(0, (row.qty || 0) - by)); await fetchStock(); }
    catch (e) { console.error(e); setErr(e.message || "Update failed"); }
    finally { setBusyId(null); }
  }
  async function removeRow(stockId) {
    if (!confirm("Remove this item from stock?")) return;
    setBusyId(`rm:${stockId}`);
    try { const { error } = await supabase.from("merchant_stock").delete().eq("id", stockId); if (error) throw error; await fetchStock(); }
    catch (e) { console.error(e); setErr(e.message || "Remove failed"); }
    finally { setBusyId(null); }
  }

  return (
    // IMPORTANT: no id="merchantPanel" here to avoid clashing with the offcanvas id
    <div className="container my-3 merchant-panel" style={{ "--merchant-bg-img": `url('${bgImg}')` }}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="d-flex align-items-center gap-2">
          <h2 className="h5 m-0">{merchant.name}’s Wares</h2>
          <Pill theme={theme} small />
        </div>
        <span className="badge bg-secondary">{walletLoading ? "…" : gp === -1 ? "∞ gp" : `${gp ?? 0} gp`}</span>
      </div>

      {err && <div className="alert alert-danger py-2 mb-2">{err}</div>}
      {loading && <div className="text-muted">Loading stock…</div>}
      {!loading && stock.length === 0 && (<div className="text-muted small">— no stock —</div>)}

      <div className="merchant-grid">
        {cards.map((card) => (
          <div key={card.id} className="tile" tabIndex={0}>
            <div className="tile-card-wrap">
              <ItemCard item={card} mini />
            </div>
            <div className="buy-strip">
              <span className="badge bg-dark">x{card._qty}</span>
              <div className="ms-auto d-flex gap-1">
                {isAdmin && (
                  <>
                    <button className="btn btn-sm btn-outline-light" disabled={busyId?.startsWith("dec:") && busyId.includes(card.id)} onClick={() => decQty(card.id, 1)} title="Decrease quantity">−</button>
                    <button className="btn btn-sm btn-outline-light" disabled={busyId?.startsWith("inc:") && busyId.includes(card.id)} onClick={() => incQty(card.id, 1)} title="Increase quantity">+</button>
                    <button className="btn btn-sm btn-outline-danger" disabled={busyId === `rm:${card.id}`} onClick={() => removeRow(card.id)} title="Remove item">✕</button>
                  </>
                )}
                <button className="btn btn-sm btn-primary" disabled={busyId === card.id || card._qty <= 0} onClick={() => handleBuy(card)}>
                  {busyId === card.id ? "…" : `Buy (${card._price_gp} gp)`}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="card mt-4">
          <div className="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
            <strong>Inventory (Admin)</strong>
            <div className="d-flex gap-2 ms-auto">
              <button className="btn btn-sm btn-outline-secondary" onClick={dumpAll} disabled={busyId === "dump"}>{busyId === "dump" ? "Dumping…" : "Dump"}</button>
              <button className="btn btn-sm btn-outline-warning" onClick={rerollThemed} disabled={busyId === "reroll"} title={`Theme: ${theme}`}>{busyId === "reroll" ? "Rerolling…" : "Reroll (theme)"}</button>
            </div>
          </div>
          <div className="card-body">
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md">
                <input className="form-control" placeholder='Add item by name or JSON (e.g. {"name":"+1 Dagger","qty":1,"price":400})' value={restockText} onChange={(e) => setRestockText(e.target.value)} />
              </div>
              <div className="col-auto">
                <button className="btn btn-primary" onClick={addItem} disabled={busyId === "add"}>{busyId === "add" ? "Adding…" : "Add"}</button>
              </div>
            </div>
            <div className="form-text mt-1">Strings are treated as single items. JSON with <code>qty</code>/<code>quantity</code> can be incremented. RPC <code>stock_merchant_item</code> will merge quantities when display names match.</div>
          </div>
        </div>
      )}
    </div>
  );
}

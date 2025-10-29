/* components/MerchantPanel.js */
import { useEffect, useMemo, useState, useCallback } from "react";
import ItemCard from "./ItemCard";
import useWallet from "../utils/useWallet";
import { supabase } from "../utils/supabaseClient";
import { themeFromMerchant as detectTheme, Pill } from "../utils/merchantTheme";
import { classifyUi } from "../utils/itemsIndex"; // for client-side reroll buckets

/**
 * MerchantPanel (uuid-safe + client-reroll fallback)
 */
export default function MerchantPanel({ merchant, isAdmin = false }) {
  const { uid, gp, loading: walletLoading, refresh: refreshWallet } = useWallet();
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const [restockText, setRestockText] = useState("");

  const theme = useMemo(() => detectTheme(merchant), [merchant]);

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

  /* --------------------------- BUY --------------------------- */
  async function handleBuy(card) {
    if (!uid) return alert("Please sign in.");
    setBusyId(card.id);
    setErr("");
    try {
      let res = await supabase.rpc("buy_from_merchant", {
        p_merchant_id: merchant.id,
        p_stock_uuid: card.id,
        p_qty: 1,
      });
      if (res.error && /No function|does not exist/i.test(res.error.message)) {
        res = await supabase.rpc("buy_from_merchant", { p_merchant: merchant.id, p_stock: card.id, p_q: 1 });
      }
      if (res.error) throw res.error;
      await Promise.all([fetchStock(), refreshWallet()]);
      alert(`Purchased: ${card.item_name} for ${card._price_gp} gp.`);
    } catch (e) {
      console.error(e);
      setErr(e.message || "Purchase failed");
      alert(e.message || "Purchase failed.");
    } finally { setBusyId(null); }
  }

  /* ----------------- ADMIN: reroll helpers ------------------ */

  // Theme → bucket(s) used by classifyUi(uiType)
  const THEME_BUCKETS = {
    jeweler: ["Wondrous Item", "Other"], // rings/amulets/figurines live here in your data
    smith: ["Armor", "Shield", "Melee Weapon"], // plus odd metals show as "Other"/"Wondrous"
    fletcher: ["Ammunition", "Ranged Weapon"],
    alchemist: ["Potions & Poisons"],
    arcane: ["Rods & Wands", "Scroll & Focus", "Wondrous Item", "Tools"],
    general: ["Wondrous Item", "Tools", "Adventuring Gear"],
    drow: ["Wondrous Item", "Armor", "Ranged Weapon"],
    dwarven: ["Armor", "Melee Weapon", "Tools"],
    kaorti: ["Wondrous Item", "Armor", "Melee Weapon"],
  };

  function toCardPayload(it) {
    const name = it.name || it.item_name || "Item";
    const rarity = it.rarity || it.item_rarity || null;
    const type = it.type || it.item_type || classifyUi(it)?.uiType || null;
    const img = it.image_url || it.img || it.image || "/placeholder.png";
    const price_gp = Number(it.price_gp ?? it.price ?? it.value ?? it.cost ?? 0) || 0;
    return {
      item_id: it.id || undefined,
      item_name: name,
      item_rarity: rarity,
      item_type: type,
      image_url: img,
      description: it.flavor || it.item_description || it.description || null,
      price_gp,
    };
  }

  async function clientRerollFromCatalog(p_theme = theme, count = 16) {
    try {
      // Load the same catalog Admin uses
      let all = typeof window !== "undefined" ? window.__ALL_ITEMS__ : null;
      if (!all) {
        const r = await fetch("/items/all-items.json");
        if (r.ok) all = await r.json();
      }
      if (!Array.isArray(all) || all.length === 0) {
        throw new Error("No item catalog available for client reroll.");
      }

      // Filter by theme buckets
      const buckets = THEME_BUCKETS[(p_theme || "").toLowerCase()] || THEME_BUCKETS.general;
      const pool = all.filter((it) => {
        const ui = classifyUi(it);
        const T = ui?.uiType || ui?.rawType || "";
        return buckets.includes(T);
      });

      // Safety: fallback to whole catalog if we filtered too hard
      const source = pool.length >= Math.min(12, count) ? pool : all;

      // Random distinct picks
      const picks = [];
      const used = new Set();
      while (picks.length < Math.min(count, source.length)) {
        const i = Math.floor(Math.random() * source.length);
        if (used.has(i)) continue;
        used.add(i);
        picks.push(source[i]);
      }

      // Build rows
      const rows = picks.map((it) => {
        const payload = toCardPayload(it);
        return {
          merchant_id: merchant.id,
          display_name: payload.item_name,
          price_gp: Number(payload.price_gp || 0),
          qty: 1,
          card_payload: payload,
        };
      });

      // Replace stock
      const del = await supabase.from("merchant_stock").delete().eq("merchant_id", merchant.id);
      if (del.error) throw del.error;

      const ins = await supabase.from("merchant_stock").insert(rows);
      if (ins.error) throw ins.error;

      await fetchStock();
    } catch (e) {
      console.error("Client reroll failed:", e);
      setErr(e.message || "Client reroll failed.");
    }
  }

  async function rerollThemed() {
    setBusyId("reroll");
    setErr("");
    try {
      // Try server RPC first
      let res = await supabase.rpc("reroll_merchant_inventory", {
        p_merchant_id: merchant.id,
        p_theme: theme,
        p_count: 16,
      });
      if (res.error && /No function|does not exist/i.test(res.error.message)) {
        res = await supabase.rpc("reroll_merchant_inventory", { p_merchant: merchant.id, p_theme: theme, p_cnt: 16 });
      }
      if (res.error) throw res.error;

      await fetchStock();

      // If nothing came back (or still “placeholdery”), run client fallback
      if (!Array.isArray(stock) || stock.length === 0) {
        await clientRerollFromCatalog(theme, 16);
      }
    } catch (e) {
      // Hard error → client fallback
      console.warn("RPC reroll failed; using client fallback:", e?.message || e);
      await clientRerollFromCatalog(theme, 16);
    } finally {
      setBusyId(null);
    }
  }

  /* ----------------- ADMIN: add single item ----------------- */
  function looksInvalidBigint(errObj) {
    const msg = (errObj?.message || "").toLowerCase();
    const code = (errObj?.code || "").toUpperCase();
    return code === "22P02" || msg.includes("type bigint");
  }

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

      // Prefer RPC that merges quantity by display_name
      let rpc = await supabase.rpc("stock_merchant_item", {
        p_merchant_id: merchant.id,          // your function currently expects BIGINT in some envs
        p_display_name: display_name,
        p_price_gp: price_gp,
        p_qty: qty,
        p_payload: payload,
      });

      if (rpc.error && looksInvalidBigint(rpc.error)) {
        // UUID vs BIGINT mismatch → fallback to direct insert
        console.warn("stock_merchant_item expects bigint; falling back to table insert.");
        const { error } = await supabase.from("merchant_stock").insert({
          merchant_id: merchant.id,
          display_name,
          price_gp,
          qty,
          card_payload: payload,
        });
        if (error) throw error;
      } else if (rpc.error && /No function|does not exist/i.test(rpc.error.message)) {
        // Legacy name fallback
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

  /* ------------------------- QTY ops ------------------------ */
  async function changeQty(stockId, nextQty) {
    const qty = Math.max(0, Number(nextQty || 0));
    const { error } = await supabase.from("merchant_stock").update({ qty }).eq("id", stockId);
    if (error) throw error;
  }
  async function incQty(stockId, by = 1) {
    setBusyId(`inc:${stockId}`);
    try { const row = stock.find(r => r.id === stockId); if (!row) return;
      await changeQty(stockId, (row.qty || 0) + by); await fetchStock(); }
    catch (e) { console.error(e); setErr(e.message || "Update failed"); }
    finally { setBusyId(null); }
  }
  async function decQty(stockId, by = 1) {
    setBusyId(`dec:${stockId}`);
    try { const row = stock.find(r => r.id === stockId); if (!row) return;
      await changeQty(stockId, Math.max(0, (row.qty || 0) - by)); await fetchStock(); }
    catch (e) { console.error(e); setErr(e.message || "Update failed"); }
    finally { setBusyId(null); }
  }
  async function removeRow(stockId) {
    if (!confirm("Remove this item from stock?")) return;
    setBusyId(`rm:${stockId}`);
    try { const { error } = await supabase.from("merchant_stock").delete().eq("id", stockId);
      if (error) throw error; await fetchStock(); }
    catch (e) { console.error(e); setErr(e.message || "Remove failed"); }
    finally { setBusyId(null); }
  }

  return (
    <div
      className={`container my-3 merchant-panel theme-${String(theme || "general").toLowerCase()}`}
      id="merchantPanel"
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="d-flex align-items-center gap-2">
          <h2 className="h5 m-0">{merchant.name}’s Wares</h2>
          <Pill theme={theme} small />
        </div>
        <span className="badge bg-secondary">
          {walletLoading ? "…" : gp === -1 ? "∞ gp" : `${gp ?? 0} gp`}
        </span>
      </div>

      {err && <div className="alert alert-danger py-2 mb-2">{err}</div>}
      {loading && <div className="text-muted">Loading stock…</div>}
      {!loading && stock.length === 0 && (<div className="text-muted small">— no stock —</div>)}

      <div className="merchant-grid">
        {cards.map((card) => (
          <div key={card.id} className="tile" tabIndex={0} style={{ position: "relative" }}>
            <div style={{ position: "relative" }}>
              <ItemCard item={card} mini />
            </div>
            <div className="buy-strip" style={{ opacity: 0, pointerEvents: "none" }}>
              <span className="badge bg-dark">x{card._qty}</span>
              <div className="ms-auto d-flex gap-1">
                {isAdmin && (
                  <>
                    <button className="btn btn-sm btn-outline-light"
                            disabled={busyId?.startsWith("dec:") && busyId.includes(card.id)}
                            onClick={() => decQty(card.id, 1)} title="Decrease quantity">−</button>
                    <button className="btn btn-sm btn-outline-light"
                            disabled={busyId?.startsWith("inc:") && busyId.includes(card.id)}
                            onClick={() => incQty(card.id, 1)} title="Increase quantity">+</button>
                    <button className="btn btn-sm btn-outline-danger"
                            disabled={busyId === `rm:${card.id}`}
                            onClick={() => removeRow(card.id)} title="Remove item">✕</button>
                  </>
                )}
                <button className="btn btn-sm btn-primary"
                        disabled={busyId === card.id || card._qty <= 0}
                        onClick={() => handleBuy(card)}>
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
              <button className="btn btn-sm btn-outline-secondary" onClick={async()=>{
                if (!confirm("Dump all current stock?")) return;
                setBusyId("dump");
                try {
                  const { error } = await supabase.from("merchant_stock").delete().eq("merchant_id", merchant.id);
                  if (error) throw error;
                  await fetchStock();
                } catch (e) { console.error(e); setErr(e.message || "Dump failed"); }
                finally { setBusyId(null); }
              }} disabled={busyId === "dump"}>{busyId === "dump" ? "Dumping…" : "Dump"}</button>

              <button className="btn btn-sm btn-outline-warning" onClick={rerollThemed}
                      disabled={busyId === "reroll"} title={`Theme: ${theme}`}>
                {busyId === "reroll" ? "Rerolling…" : "Reroll (theme)"}
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md">
                <input className="form-control"
                  placeholder='Add item by name or JSON (e.g. {"name":"+1 Dagger","qty":1,"price":400})'
                  value={restockText} onChange={(e) => setRestockText(e.target.value)} />
              </div>
              <div className="col-auto">
                <button className="btn btn-primary" onClick={addItem} disabled={busyId === "add"}>
                  {busyId === "add" ? "Adding…" : "Add"}
                </button>
              </div>
            </div>
            <div className="form-text mt-1">
              Strings are treated as single items. JSON with <code>qty</code>/<code>quantity</code> can be incremented.
              RPC <code>stock_merchant_item</code> is used when compatible; otherwise we fall back safely to a table insert.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

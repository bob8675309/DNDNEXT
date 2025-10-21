/*     
Path components/MerchantPanel.js
import { useEffect, useMemo, useState, useCallback } from "react";
import ItemCard from "./ItemCard";
import useWallet from "../utils/useWallet";
import { supabase } from "../utils/supabaseClient";
import { themeFromMerchant as detectTheme, Pill } from "../utils/merchantTheme";

/**
 * MerchantPanel (normalized)
 * - Reads stock from merchant_stock (qty > 0)
 * - Player Buy -> rpc('buy_from_merchant') for atomic wallet/spend/insert/decrement
 * - Admin Reroll -> rpc('reroll_merchant_inventory') with detected theme (12–20 items server-side)
 * - Mini-card grid expands toward the map using .merchant-grid styles (globals.scss)
 */
export default function MerchantPanel({ merchant, isAdmin = false }) {
  const { uid, gp, loading: walletLoading, refresh: refreshWallet } = useWallet();
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");

  const theme = useMemo(() => detectTheme(merchant), [merchant]);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    setErr("");
    const { data, error } = await supabase
      .from("merchant_stock")
      .select("*")
      .eq("merchant_id", merchant.id)
      .gt("qty", 0)
      .order("created_at", { ascending: true });
    if (error) setErr(error.message);
    setStock(data || []);
    setLoading(false);
  }, [merchant?.id]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  // Normalize a merchant_stock row into ItemCard-friendly shape
  function normalizeRow(row) {
    const payload = row.card_payload || {};
    const price = Number(row.price_gp ?? payload.price_gp ?? 0);
    const name = row.display_name || payload.item_name || payload.name || "Item";
    return {
      id: row.id,
      item_id: payload.item_id || row.id,
      item_name: name,
      item_type: payload.item_type || payload.type || null,
      item_rarity: payload.item_rarity || payload.rarity || null,
      item_description: payload.item_description || payload.description || null,
      item_weight: payload.item_weight || payload.weight || null,
      item_cost: `${price} gp`,
      image_url: payload.image_url || "/placeholder.png",
      card_payload: payload,
      _price_gp: price,
      _qty: row.qty,
    };
  }

  const cards = useMemo(() => stock.map(normalizeRow), [stock]);

  async function handleBuy(card) {
    if (!uid) return alert("Please sign in.");
    setBusyId(card.id);
    setErr("");
    try {
      // Preferred signature
      let res = await supabase.rpc("buy_from_merchant", {
        p_merchant_id: merchant.id,
        p_stock_id: card.id,
        p_qty: 1,
      });
      // Fallback if arg names differ on your DB
      if (res.error && /No function|does not exist/i.test(res.error.message)) {
        res = await supabase.rpc("buy_from_merchant", {
          p_merchant: merchant.id,
          p_stock: card.id,
          p_q: 1,
        });
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

  async function rerollThemed() {
    setBusyId("reroll");
    setErr("");
    try {
      let res = await supabase.rpc("reroll_merchant_inventory", {
        p_merchant_id: merchant.id,
        p_theme: theme,
        p_count: 16,
      });
      if (res.error && /No function|does not exist/i.test(res.error.message)) {
        res = await supabase.rpc("reroll_merchant_inventory", {
          p_merchant: merchant.id,
          p_theme: theme,
          p_cnt: 16,
        });
      }
      if (res.error) throw res.error;
      await fetchStock();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Reroll failed");
      alert(e.message || "Reroll failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="container my-3" id="merchantPanel">
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
      {!loading && stock.length === 0 && (
        <div className="text-muted small">— no stock —</div>
      )}

      <div className="merchant-grid">
        {cards.map((card) => (
          <div key={card.id} className="tile" tabIndex={0}>
            {/* Full-size card scaled down by CSS */}
            <ItemCard item={card} mini />

            {/* Buy strip */}
            <div className="buy-strip">
              <span className="badge bg-dark">x{card._qty}</span>
              <button
                className="btn btn-sm btn-primary ms-auto"
                disabled={busyId === card.id || card._qty <= 0}
                onClick={() => handleBuy(card)}
              >
                {busyId === card.id ? "…" : `Buy (${card._price_gp} gp)`}
              </button>
            </div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="card mt-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <strong>Inventory (Admin)</strong>
            <div className="d-flex gap-2">
              <button
                className="btn btn-sm btn-outline-warning"
                onClick={rerollThemed}
                disabled={busyId === "reroll"}
                title={`Theme: ${theme}`}
              >
                {busyId === "reroll" ? "Rerolling…" : "Reroll (theme)"}
              </button>
            </div>
          </div>
          <div className="card-body small text-muted">
            Uses <code>merchant_stock</code> and server RPCs. Theme: <strong>{theme}</strong>.
          </div>
        </div>
      )}
    </div>
  );
}
```

---

# components/LocationSideBar.js

```jsx
import React from "react";
import { themeFromMerchant, Pill } from "../utils/merchantTheme";

/**
 * LocationSideBar (excerpt / full file replacement as needed)
 * - Adds theme pill next to each merchant
 */
export default function LocationSideBar({ location, merchantsHere = [], onSelectMerchant }) {
  if (!location) return null;

  return (
    <div className="loc-panel">
      <div className="loc-sec">
        <div className="loc-sec-title">
          <span>Merchants at this location</span>
        </div>
        {merchantsHere.length === 0 && (
          <div className="text-muted small">No merchants present.</div>
        )}
        {merchantsHere.length > 0 && (
          <ul className="list-unstyled m-0">
            {merchantsHere.map((m) => {
              const theme = themeFromMerchant(m);
              return (
                <li
                  key={m.id}
                  className="loc-item d-flex align-items-center justify-content-between"
                >
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none"
                    onClick={() => onSelectMerchant?.(m)}
                  >
                    {m.name}
                  </button>
                  <Pill theme={theme} small />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}




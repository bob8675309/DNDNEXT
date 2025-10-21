import { useEffect, useMemo, useState, useCallback } from "react";
import ItemCard from "./ItemCard";
import useWallet from "@/utils/useWallet";
import { supabase } from "@/utils/supabaseClient";
import { themeFromMerchant as detectTheme } from "@/utils/merchantTheme";

/**
 * MerchantPanel (normalized)
 * - Displays stock from merchant_stock
 * - Player Buy -> server RPC buy_from_merchant (atomic)
 * - Admin Reroll -> server RPC reroll_merchant_inventory (12–20, themed)
 */
export default function MerchantPanel({ merchant, isAdmin = false }) {
  const { uid, gp, spend, loading: walletLoading, err: walletErr, refresh: refreshWallet } = useWallet();
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
    const price = Number(row.price_gp || payload.price_gp || 0);
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
      // Prefer server-side atomic purchase
      // NOTE: adjust arg names if your function differs!
      let res = await supabase.rpc("buy_from_merchant", {
        p_merchant_id: merchant.id,
        p_stock_id: card.id,
        p_qty: 1,
      });

      // Fallback if your arg names are shorter (based on your screenshot’s truncation)
      if (res.error && /No function|function.*does not exist/i.test(res.error.message)) {
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
      // Default to 16; server can randomize 12–20 if you prefer.
      let res = await supabase.rpc("reroll_merchant_inventory", {
        p_merchant_id: merchant.id,
        p_theme: theme,
        p_count: 16,
      });
      if (res.error && /No function|function.*does not exist/i.test(res.error.message)) {
        // alt signature
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
    <div className="container my-3">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h2 className="h5 m-0">{merchant.name}’s Wares</h2>
        <span className="badge bg-secondary">
          {walletLoading ? "…" : gp === -1 ? "∞ gp" : `${gp ?? 0} gp`}
        </span>
      </div>

      {err && <div className="alert alert-danger py-2">{err}</div>}
      {loading && <div className="text-muted">Loading stock…</div>}

      {!loading && stock.length === 0 && (
        <div className="text-muted small">— no stock —</div>
      )}

      {/* mini-card grid that expands on hover via CSS scale (kept from your version) */}
      <div className="row g-2">
        {cards.map((card) => (
          <div key={card.id} className="col-6 col-md-4 col-lg-3">
            <div className="position-relative">
              <ItemCard item={card} mini onBuy={() => handleBuy(card)} />
              <button
                className="btn btn-sm btn-primary position-absolute bottom-1 end-1"
                disabled={busyId === card.id || card._qty <= 0}
                onClick={() => handleBuy(card)}
              >
                {busyId === card.id ? "…" : `Buy (${card._price_gp} gp)`}
              </button>
              <span className="badge bg-dark position-absolute top-1 start-1">
                x{card._qty}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Admin tools */}
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
          <div className="card-body">
            <div className="small text-muted">
              Theme detected: <strong>{theme}</strong>. Uses <code>merchant_stock</code> and server RPCs.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

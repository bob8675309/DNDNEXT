/* components/MerchantPanel.js */
import { useEffect, useMemo, useState, useCallback } from "react";
import ItemCard from "./ItemCard";
import useWallet from "../utils/useWallet";
import { supabase } from "../utils/supabaseClient";
import { themeFromMerchant as detectTheme, Pill } from "../utils/merchantTheme";

/* Theme → allow-list rules (kept for possible client-side fallback reroll) */
const THEME_RULES = {
  jeweler: (it, c) =>
    (c?.uiType === "Wondrous Item" &&
      ["Ring", "Amulet", "Necklace", "Ioun Stone", "Figurine", "Stone"].includes(
        c.uiSubKind
      )) ||
    (c?.uiType === "Trade Goods" &&
      /\b(gem|jewel|pearl|diamond)\b/i.test(it?.name || "")),

  smith: (it, c) =>
    ["Armor", "Shield", "Melee Weapon"].includes(c?.uiType) ||
    /\b(mithral|adamantine|ingot|plate|chain|scale)\b/i.test(it?.name || ""),

  weapons: (_it, c) =>
    ["Melee Weapon", "Ranged Weapon", "Ammunition"].includes(c?.uiType),

  alchemy: (_it, c) => c?.uiType === "Potions & Poisons",

  herbalist: (it, c) =>
    c?.uiType === "Potions & Poisons" &&
    /\b(herb|salve|balm|elixir)\b/i.test(
      ((it?.name || "") + " " + (it?.item_description || "")).trim()
    ),

  arcanist: (it, c) =>
    c?.uiType === "Scroll & Focus" ||
    (c?.uiType === "Wondrous Item" &&
      /\b(staff|wand|rod)\b/i.test(it?.name || "")),

  clothier: (_it, c) =>
    c?.uiType === "Wondrous Item" &&
    [
      "Cloak",
      "Boots",
      "Gloves",
      "Belt",
      "Bracers",
      "Helm",
      "Mask",
      "Goggles",
      "Wraps",
      "Girdle",
    ].includes(c.uiSubKind),

  stable: (it, c) =>
    c?.uiType === "Vehicles & Structures" ||
    /\b(saddle|tack|bridle|harness)\b/i.test(it?.name || ""),

  caravan: (it, c) =>
    c?.uiType === "Adventuring Gear" ||
    /\b(tent|rations|pack|rope|wagon|cart)\b/i.test(
      ((it?.name || "") + " " + (it?.item_description || "")).trim()
    ),

  general: () => true,
};

/* helper to coerce “1000 gp” -> 1000 */
const gpNumber = (s = "") => {
  const n = parseFloat(
    String(s).replace(/[, ]/g, "").replace(/gp.*/i, "").trim()
  );
  return Number.isFinite(n) ? n : 0;
};

export default function MerchantPanel({ merchant, isAdmin = false }) {
  const { uid, gp, loading: walletLoading, refresh: refreshWallet } = useWallet();

  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const [restockText, setRestockText] = useState("");
  const [openId, setOpenId] = useState(null); // currently unused, kept for future expansion

  const theme = useMemo(() => detectTheme(merchant), [merchant]);
  const bgUrl = merchant?.bg_url || "/parchment.jpg";

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

  useEffect(() => {
    if (merchant?.id) {
      fetchStock();
    }
  }, [fetchStock, merchant?.id]);

  function normalizeRow(row) {
    const payload = row.card_payload || {};
    const price = Number(
      row.price_gp ?? payload.price_gp ?? payload.price ?? 0
    );
    const name =
      row.display_name ||
      payload.display_name ||
      payload.item_name ||
      payload.name ||
      "Item";

    return {
      id: row.id,
      item_id: payload.item_id || row.id,
      item_name: name,
      item_type: payload.item_type || payload.type || null,
      item_rarity: payload.item_rarity || payload.rarity || null,
      item_description:
        payload.item_description || payload.description || row.description || null,
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
    if (!uid) {
      alert("Please sign in.");
      return;
    }

    setBusyId(card.id);
    setErr("");

    try {
      // Preferred signature
      let res = await supabase.rpc("buy_from_merchant", {
        p_merchant_id: merchant.id,
        p_stock_uuid: card.id,
        p_qty: 1,
      });

      // Fallback to old signature if the new one doesn't exist
      if (res.error && /No function|does not exist/i.test(res.error.message)) {
        // Old signature fallback
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
      const msg = e.message || "Purchase failed";
      setErr(msg);
      alert(msg);
    } finally {
      setBusyId(null);
    }
  }

  // Dump + reroll via pure RPC
  async function rerollThemed() {
    if (!isAdmin) {
      alert("Only admins can reroll merchant stock.");
      return;
    }

    setBusyId("reroll");
    setErr("");

    try {
      const { error } = await supabase.rpc("reroll_merchant_inventory_v2", {
        p_merchant_id: merchant.id,
        p_theme: theme, // jeweler/smith/etc from merchantTheme.js
        p_count: 16, // tweak if you want 12–20, etc
      });

      if (error) throw error;

      // give Postgres a moment to commit inserts, then refetch
      await new Promise((r) => setTimeout(r, 120));
      await fetchStock();
    } catch (e) {
      console.error(e);
      const msg = e.message || "Reroll failed";
      setErr(msg);
      alert(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function dumpAll() {
    if (!confirm("Dump all current stock?")) return;

    setBusyId("dump");
    setErr("");

    try {
      const { error } = await supabase
        .from("merchant_stock")
        .delete()
        .eq("merchant_id", merchant.id);
      if (error) throw error;
      await fetchStock();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Dump failed");
    } finally {
      setBusyId(null);
    }
  }

  // Admin: add item by name or JSON; RPC first, then direct insert on ANY error
  async function addItem() {
    if (!restockText.trim()) return;

    setBusyId("add");
    setErr("");

    try {
      const raw = restockText.trim();
      let row = null;

      if (raw.startsWith("{") || raw.startsWith("[")) {
        try {
          row = JSON.parse(raw);
        } catch {
          throw new Error("Invalid JSON payload");
        }
      } else {
        row = { name: raw };
      }

      const qty = Number(row.qty ?? row.quantity ?? 1) || 1;
      const price_gp =
        Number(row.value ?? row.price ?? row.price_gp ?? row.cost ?? 0) || 0;
      const display_name = String(
        row.display_name || row.item_name || row.name || "Item"
      );

      const payload =
        row.card_payload ||
        row.payload || {
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

      if (rpc.error) {
        const { error } = await supabase.from("merchant_stock").insert({
          merchant_id: merchant.id,
          display_name,
          price_gp,
          qty,
          card_payload: payload,
        });
        if (error) throw error;
      }

      setRestockText("");
      await fetchStock();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Add failed");
    } finally {
      setBusyId(null);
    }
  }

  async function changeQty(stockId, nextQty) {
    const qty = Math.max(0, Number(nextQty || 0));
    const { error } = await supabase
      .from("merchant_stock")
      .update({ qty })
      .eq("id", stockId);
    if (error) throw error;
  }

  async function incQty(stockId, by = 1) {
    setBusyId(`inc:${stockId}`);
    setErr("");

    try {
      const row = stock.find((r) => r.id === stockId);
      if (!row) return;
      await changeQty(stockId, (row.qty || 0) + by);
      await fetchStock();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function decQty(stockId, by = 1) {
    setBusyId(`dec:${stockId}`);
    setErr("");

    try {
      const row = stock.find((r) => r.id === stockId);
      if (!row) return;
      await changeQty(stockId, Math.max(0, (row.qty || 0) - by));
      await fetchStock();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function removeRow(stockId) {
    if (!confirm("Remove this item from stock?")) return;

    setBusyId(`rm:${stockId}`);
    setErr("");

    try {
      const { error } = await supabase
        .from("merchant_stock")
        .delete()
        .eq("id", stockId);
      if (error) throw error;
      await fetchStock();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Remove failed");
    } finally {
      setBusyId(null);
    }
  }

return (
  <div
    className={`merchant-panel theme-${theme || "general"}`}
    id="merchantPanel"
    style={{ "--merchant-bg": `url(${bgUrl})` }}
    >
      {/* Top gradient header: name on left, wallet + reroll on right */}
      <div className="merchant-panel-header d-flex align-items-center">
        <div className="d-flex align-items-center gap-2">
          <h2 className="h5 m-0">{merchant.name}’s Wares</h2>
          <Pill theme={theme} small />
        </div>

        <div className="ms-auto d-flex align-items-center gap-2">
          <span className="badge bg-secondary">
            {walletLoading ? "…" : gp === -1 ? "∞ gp" : `${gp ?? 0} gp`}
          </span>

          {isAdmin && (
            <button
              type="button"
              className="btn btn-sm btn-outline-warning merchant-reroll-btn"
              onClick={rerollThemed}
              disabled={busyId === "reroll"}
              title={`Theme: ${theme}`}
            >
              {busyId === "reroll" ? "Rerolling…" : "Reroll (theme)"}
            </button>
          )}
        </div>
      </div>

      {err && (
        <div className="alert alert-danger py-2 mb-2" role="alert">
          {err}
        </div>
      )}

      <div className="merchant-panel-body">
        {loading && <div className="text-muted">Loading stock…</div>}
        {!loading && stock.length === 0 && (
          <div className="text-muted small">— no stock —</div>
        )}

        <div className="merchant-grid">
          {cards.map((card) => (
            <div
              key={card.id}
              className="tile"
              tabIndex={0}
              style={{ position: "relative", zIndex: 2500 }}
            >
              <div style={{ position: "relative", zIndex: 3000 }}>
                <ItemCard item={card} mini />
              </div>

              <div className="buy-strip">
                <span className="badge bg-dark">x{card._qty}</span>
                <div className="ms-auto d-flex gap-1">
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-light"
                        disabled={
                          busyId?.startsWith("dec:") && busyId.includes(card.id)
                        }
                        onClick={() => decQty(card.id, 1)}
                        title="Decrease quantity"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-light"
                        disabled={
                          busyId?.startsWith("inc:") && busyId.includes(card.id)
                        }
                        onClick={() => incQty(card.id, 1)}
                        title="Increase quantity"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        disabled={busyId === `rm:${card.id}`}
                        onClick={() => removeRow(card.id)}
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={busyId === card.id || card._qty <= 0}
                    onClick={() => handleBuy(card)}
                  >
                    {busyId === card.id
                      ? "…"
                      : `Buy (${card._price_gp} gp)`}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {isAdmin && (
          <div className="card mt-4 merchant-admin-card">
            <div className="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
              <strong>Inventory (Admin)</strong>
              <div className="d-flex gap-2 ms-auto">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={dumpAll}
                  disabled={busyId === "dump"}
                >
                  {busyId === "dump" ? "Dumping…" : "Dump"}
                </button>
              </div>
            </div>

            <div className="card-body">
              <div className="row g-2 align-items-center">
                <div className="col-12 col-md">
                  <input
                    className="form-control"
                    placeholder='Add item by name or JSON (e.g. {"name":"+1 Dagger","qty":1,"price":400})'
                    value={restockText}
                    onChange={(e) => setRestockText(e.target.value)}
                  />
                </div>
                <div className="col-auto">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={addItem}
                    disabled={busyId === "add"}
                  >
                    {busyId === "add" ? "Adding…" : "Add"}
                  </button>
                </div>
              </div>

              <div className="form-text mt-1">
                Strings are treated as single items. JSON with{" "}
                <code>qty</code>/<code>quantity</code> can be incremented. RPC{" "}
                <code>stock_merchant_item</code> will merge quantities when
                display names match.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// /components/MerchantPanel.js
import { useEffect, useMemo, useState } from "react";
import ItemCard from "./ItemCard";
import useWallet from "@/utils/useWallet";
import { supabase } from "@/utils/supabaseClient";

/**
 * MerchantPanel (player storefront + lightweight admin)
 *
 * Player
 *  - Wallet badge (∞ when gp === -1)
 *  - Item grid uses compact mini-card CSS (scaled to ~75%, expands on hover)
 *  - Buy => wallet spend (server), insert into inventory_items, decrement stock
 *
 * Admin (isAdmin=true)
 *  - Inline restock: add/remove items in merchant.inventory
 *  - +/- quantity controls for object items with qty/quantity
 *
 * Props:
 *  - merchant: { id, name, inventory, ... }
 *  - isAdmin?: boolean
 */
export default function MerchantPanel({ merchant, isAdmin = false }) {
  const { uid, gp, spend, loading: walletLoading, err: walletErr } = useWallet();
  const [busyId, setBusyId] = useState(null);
  const [inv, setInv] = useState(() => normalizeInventory(merchant?.inventory));
  const [restockText, setRestockText] = useState("");

  // keep local inv mirror in sync when merchant prop changes
  useEffect(() => {
    setInv(normalizeInventory(merchant?.inventory));
  }, [merchant?.inventory]);

  if (!merchant) return null;

  /* ---------------- helpers ---------------- */
  function normalizeInventory(any) {
    if (!any) return [];
    if (Array.isArray(any)) return any;
    if (typeof any === "string") {
      try {
        const j = JSON.parse(any);
        return Array.isArray(j) ? j : [];
      } catch {
        return any
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    return [];
  }

  function toPriceNumber(v) {
    if (v == null || v === "") return 0;
    if (typeof v === "number") return v;
    if (typeof v === "object") {
      const amt = v.amount ?? v.value ?? v.qty ?? null;
      return amt != null ? Number(amt) : 0;
    }
    const m = String(v).match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  function toText(v, defaultUnit) {
    if (v == null || v === "") return null;
    if (typeof v === "string") return v;
    if (typeof v === "number") return `${v} ${defaultUnit}`;
    if (typeof v === "object") {
      const amt = v.amount ?? v.value ?? v.qty ?? null;
      const unit = v.unit ?? v.currency ?? defaultUnit;
      return amt != null ? `${amt} ${unit}` : null;
    }
    return null;
  }

  function normalizeItem(raw) {
    if (typeof raw === "string") {
      return {
        id: raw.toLowerCase().replace(/\W+/g, "-"),
        item_id: raw.toLowerCase().replace(/\W+/g, "-"),
        item_name: raw,
        name: raw,
        item_type: null,
        item_rarity: null,
        item_description: null,
        item_weight: null,
        item_cost: "—",
        image_url: "/placeholder.png",
        card_payload: { name: raw },
        _price_gp: 0,
        _qty: null,
        _raw: raw,
      };
    }
    const name = raw.item_name || raw.name || "Unnamed Item";
    const priceText = raw.item_cost ?? raw.cost ?? raw.value ?? null;
    return {
      id: raw.id || raw._id || (name || "").toLowerCase().replace(/\W+/g, "-"),
      item_id: raw.id || raw._id || (name || "").toLowerCase().replace(/\W+/g, "-"),
      item_name: name,
      name,
      item_type: raw.item_type || raw.type || null,
      item_rarity: raw.item_rarity || raw.rarity || null,
      item_description: raw.item_description || raw.description || null,
      item_weight: raw.item_weight || raw.weight || null,
      item_cost: priceText ?? null,
      image_url: raw.image_url || "/placeholder.png",
      card_payload: raw,
      _price_gp: toPriceNumber(priceText),
      _qty: typeof raw.qty === "number" ? raw.qty : raw.quantity ?? null,
      _raw: raw,
    };
  }

  const cards = useMemo(() => normalizeInventory(inv).map(normalizeItem), [inv]);

  /* ---------------- persistence helpers ---------------- */
  function invToPersist() {
    return Array.isArray(inv) ? inv : normalizeInventory(inv);
  }

  async function persistInventory(next) {
    setInv(next);
    const up = await supabase
      .from("merchants")
      .update({ inventory: next })
      .eq("id", merchant.id);
    if (up.error) {
      console.warn("Persist inventory failed:", up.error.message);
    }
  }

  /* ---------------- buy flow ---------------- */
  async function handleBuy(card) {
    if (!uid) return alert("Please sign in.");
    const price = Number(card._price_gp || 0);

    setBusyId(card.id);
    try {
      // 1) spend gp (server validates + supports infinite wallet)
      const spendRes = await spend(price);
      if (spendRes?.error) throw spendRes.error;

      // 2) insert into inventory_items (player’s bag)
      const row = {
        user_id: uid,
        item_id: card.item_id,
        item_name: card.item_name,
        item_type: card.item_type,
        item_rarity: card.item_rarity,
        item_description: card.item_description,
        item_weight: toText(card.item_weight, "lbs"),
        item_cost: toText(card.item_cost, "gp"),
        card_payload: card.card_payload ?? null,
      };
      const ins = await supabase.from("inventory_items").insert(row);
      if (ins.error) throw ins.error;

      // 3) decrement merchant stock then persist
      const next = [...normalizeInventory(invToPersist())];
      const idx = next.findIndex((x) => {
        const nm = typeof x === "string" ? x : x?.item_name || x?.name || "";
        return nm === card.item_name;
      });
      if (idx >= 0) {
        const raw = next[idx];
        if (typeof raw === "object" && (raw.qty != null || raw.quantity != null)) {
          const cur = Number(raw.qty ?? raw.quantity ?? 1);
          const newQty = Math.max(0, cur - 1);
          if (raw.qty != null) raw.qty = newQty; else raw.quantity = newQty;
          if (newQty === 0) next.splice(idx, 1);
        } else {
          next.splice(idx, 1);
        }
        await persistInventory(next);
      }

      alert(`Purchased: ${card.item_name}${price ? ` for ${price} gp` : ""}.`);
    } catch (e) {
      alert(e.message || "Purchase failed.");
    } finally {
      setBusyId(null);
    }
  }

  /* ---------------- admin ops ---------------- */
  function parseRestock(text) {
    const v = text.trim();
    if (!v) return null;
    try {
      return JSON.parse(v);
    } catch {
      /* keep string */
    }
    return v;
  }

  async function addItem() {
    const item = parseRestock(restockText);
    if (item == null) return;
    const next = [...invToPersist(), item];
    setRestockText("");
    await persistInventory(next);
  }

  async function removeIndex(i) {
    const next = invToPersist().toSpliced(i, 1);
    await persistInventory(next);
  }

  async function bumpQty(i, delta) {
    const next = invToPersist()
      .map((x, idx) => {
        if (idx !== i || typeof x !== "object") return x;
        const cur = Number(x.qty ?? x.quantity ?? 0);
        const n = Math.max(0, cur + delta);
        if (x.qty != null) return { ...x, qty: n };
        if (x.quantity != null) return { ...x, quantity: n };
        return x; // no qty field
      })
      .filter((x) => {
        if (typeof x === "object" && (x.qty === 0 || x.quantity === 0)) return false;
        return true;
      });
    await persistInventory(next);
  }

  /* ---------------- render ---------------- */
  return (
    <div className="container my-3">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h2 className="h5 m-0">{merchant.name}’s Wares</h2>
        <span className="badge bg-secondary">
          {walletLoading ? "…" : gp === -1 ? "∞ gp" : `${gp ?? 0} gp`}
        </span>
      </div>
      {walletErr && <div className="alert alert-danger py-2">{walletErr}</div>}

      {cards.length === 0 ? (
        <div className="text-muted fst-italic">No items available.</div>
      ) : (
        // mini-card => uses /styles/card-compact.css to shrink cards ~75%
        <div className="row g-3 mini-card">
          {cards.map((card, i) => (
            <div key={card.id || i} className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex">
              {/* the scaled element uses .item-card so CSS can target it */}
              <div className="w-100 d-flex flex-column item-card">
                <ItemCard item={card} />
                <div className="d-flex justify-content-between align-items-center mt-2">
                  <span className="small text-muted">
                    {card._price_gp ? `${card._price_gp} gp` : "—"}
                    {typeof card._qty === "number" && <span className="ms-2">x{card._qty}</span>}
                  </span>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={busyId === card.id}
                    onClick={() => handleBuy(card)}
                  >
                    {busyId === card.id ? "Buying…" : "Buy"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="card mt-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <strong>Inventory (Admin)</strong>
            <span className="text-muted small">merchant.id: {merchant.id}</span>
          </div>
          <div className="card-body">
            {inv.length === 0 && <div className="text-muted small mb-2">— empty —</div>}
            {inv.length > 0 && (
              <ul className="list-group mb-3">
                {inv.map((it, i) => {
                  const nm = typeof it === "string" ? it : it.item_name || it.name || JSON.stringify(it);
                  const qty = typeof it === "object" ? it.qty ?? it.quantity ?? null : null;
                  return (
                    <li key={i} className="list-group-item d-flex justify-content-between align-items-center">
                      <div className="me-3">
                        <div className="fw-semibold">{nm}</div>
                        {qty != null && <div className="small text-muted">qty: {qty}</div>}
                      </div>
                      <div className="btn-group">
                        {qty != null && (
                          <>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => bumpQty(i, -1)}>-1</button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => bumpQty(i, +1)}>+1</button>
                          </>
                        )}
                        <button className="btn btn-sm btn-outline-danger" onClick={() => removeIndex(i)}>Remove</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="input-group">
              <input
                className="form-control"
                placeholder='Add item by name or JSON (e.g. {"name":"Potion of Healing","qty":2,"value":50})'
                value={restockText}
                onChange={(e) => setRestockText(e.target.value)}
              />
              <button className="btn btn-primary" onClick={addItem}>Add</button>
            </div>
            <div className="form-text">
              Strings are treated as simple single items. JSON objects with <code>qty</code> or <code>quantity</code>
              can be incremented/decremented.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

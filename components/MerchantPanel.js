// /components/MerchantPanel.js
import { useEffect, useMemo, useState } from "react";
import ItemCard from "./ItemCard";
import useWallet from "@/utils/useWallet";
import { supabase } from "@/utils/supabaseClient";

/**
 * MerchantPanel
 * Player-facing “storefront” for a single merchant.
 * - Displays merchant.inventory (array of strings or objects)
 * - Normalizes items for ItemCard
 * - Shows price and a Buy button
 * - On buy: spends wallet gp (server-checked), inserts into inventory_items,
 *   and optionally decrements stock on the merchant (string removes one; object with {qty} decrements).
 *
 * Props:
 *   merchant: { id, name, inventory, ... }
 */
export default function MerchantPanel({ merchant }) {
  const { uid, gp, spend, loading: walletLoading, err: walletErr } = useWallet();
  const [busyId, setBusyId] = useState(null);
  const items = useMemo(() => parseInventory(merchant?.inventory), [merchant?.inventory]);

  if (!merchant) return null;

  function parseInventory(any) {
    if (!any) return [];
    if (Array.isArray(any)) return any;
    if (typeof any === "string") {
      try {
        const j = JSON.parse(any);
        return Array.isArray(j) ? j : [];
      } catch {
        // comma-delimited strings -> list of names
        return any.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    return [];
  }

  // ----- price helpers -----
  function toPriceNumber(v) {
    if (v == null || v === "") return 0;
    if (typeof v === "number") return v;
    if (typeof v === "object") {
      const amt = v.amount ?? v.value ?? v.qty ?? null;
      return amt != null ? Number(amt) : 0;
    }
    // string like "50 gp" or "50"
    const m = String(v).match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  // Normalize raw merchant inventory item into an ItemCard-friendly payload
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
        _raw: raw,
      };
    }
    // object-style
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
      _qty: typeof raw.qty === "number" ? raw.qty : (raw.quantity ?? null),
      _raw: raw,
    };
  }

  const cards = useMemo(() => items.map(normalizeItem), [items]);

  async function handleBuy(card) {
    if (!uid) return alert("Please sign in.");
    const price = Number(card._price_gp || 0);

    setBusyId(card.id);
    try {
      // 1) spend gp (server validates + supports infinite wallet)
      const spendRes = await spend(price);
      if (spendRes?.error) throw spendRes.error;

      // 2) insert into inventory_items
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

      // 3) decrement merchant stock if possible
      const inv = parseInventory(merchant.inventory);
      const idx = inv.findIndex((x) => {
        if (typeof x === "string") return x === card.item_name;
        const xname = x?.item_name || x?.name || "";
        return xname === card.item_name;
      });

      if (idx >= 0) {
        let next = [...inv];
        const raw = next[idx];

        if (typeof raw === "object" && (raw.qty || raw.quantity)) {
          const cur = Number(raw.qty ?? raw.quantity ?? 1);
          const newQty = Math.max(0, cur - 1);
          if (raw.qty != null) raw.qty = newQty;
          else raw.quantity = newQty;
          if (newQty === 0) next.splice(idx, 1);
        } else {
          next.splice(idx, 1);
        }

        const up = await supabase
          .from("merchants")
          .update({ inventory: next })
          .eq("id", merchant.id);

        if (up.error) {
          console.warn("Stock decrement failed:", up.error.message);
        }
      }

      alert(`Purchased: ${card.item_name}${price ? ` for ${price} gp` : ""}.`);
    } catch (e) {
      alert(e.message || "Purchase failed.");
    } finally {
      setBusyId(null);
    }
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
        <div className="row g-3">
          {cards.map((card) => (
            <div key={card.id} className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex">
              <div className="w-100 d-flex flex-column">
                <ItemCard item={card} />
                <div className="d-flex justify-content-between align-items-center mt-2">
                  <span className="small text-muted">
                    {card._price_gp ? `${card._price_gp} gp` : "—"}
                    {typeof card._qty === "number" && (
                      <span className="ms-2">x{card._qty}</span>
                    )}
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
    </div>
  );
}

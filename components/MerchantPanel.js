import { useEffect, useMemo, useState } from "react";
import ItemCard from "./ItemCard";
import useWallet from "@/utils/useWallet";
import { supabase } from "@/utils/supabaseClient";

/**
 * MerchantPanel (player storefront + admin tools)
 * - Renders merchant inventory as ItemCards (mini-card layout with hover zoom)
 * - Buy: spends wallet gp (server-side checked) and inserts into inventory_items
 * - Admin: add/remove items, bump qty, dump, and **Reroll (theme)** to generate 12–20 items
 *
 * Props:
 *   merchant: { id, name, inventory, icon, ... }
 *   isAdmin?: boolean
 */
export default function MerchantPanel({ merchant, isAdmin = false }) {
  const { uid, gp, spend, loading: walletLoading, err: walletErr } = useWallet();
  const [busyId, setBusyId] = useState(null);
  const [restockText, setRestockText] = useState("");
  const [inv, setInv] = useState(() => normalizeInventory(merchant?.inventory));

  useEffect(() => {
    setInv(normalizeInventory(merchant?.inventory));
  }, [merchant?.inventory]);

  if (!merchant) return null;

  /* ---------------- inventory helpers ---------------- */
  function normalizeInventory(any) {
    if (!any) return [];
    if (Array.isArray(any)) return any;
    if (typeof any === "string") {
      try {
        const j = JSON.parse(any);
        return Array.isArray(j) ? j : [];
      } catch {
        return any.split(",").map((s) => s.trim()).filter(Boolean);
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
      const id = raw.toLowerCase().replace(/\W+/g, "-");
      return {
        id, item_id: id, item_name: raw, name: raw,
        item_cost: "—", image_url: "/placeholder.png",
        card_payload: { name: raw },
        _price_gp: 0, _qty: null, _raw: raw,
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

  async function persistInventory(next) {
    setInv(next);
    const up = await supabase.from("merchants").update({ inventory: next }).eq("id", merchant.id);
    if (up.error) console.warn("Persist inventory failed:", up.error.message);
  }

  /* ---------------- player buy flow ---------------- */
  async function handleBuy(card) {
    if (!uid) return alert("Please sign in.");
    const price = Number(card._price_gp || 0);
    setBusyId(card.id);
    try {
      const spendRes = await spend(price);
      if (spendRes?.error) throw spendRes.error;

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

      // decrement local stock then persist
      const next = [...normalizeInventory(inv)];
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
    try { return JSON.parse(v); } catch { /* keep string */ }
    return v;
  }

  async function addItem() {
    const item = parseRestock(restockText);
    if (item == null) return;
    const next = [...normalizeInventory(inv), item];
    setRestockText("");
    await persistInventory(next);
  }

  async function removeIndex(i) {
    const next = normalizeInventory(inv).toSpliced(i, 1);
    await persistInventory(next);
  }

  async function bumpQty(i, delta) {
    const next = normalizeInventory(inv).map((x, idx) => {
      if (idx !== i || typeof x !== "object") return x;
      const cur = Number(x.qty ?? x.quantity ?? 0);
      const n = Math.max(0, cur + delta);
      if (x.qty != null) return { ...x, qty: n };
      if (x.quantity != null) return { ...x, quantity: n };
      return x;
    }).filter((x) => !(typeof x === "object" && (x.qty === 0 || x.quantity === 0)));
    await persistInventory(next);
  }

  async function dumpAll() {
    await persistInventory([]);
  }

  function themeFromMerchant(m) {
    const s = (m?.icon || m?.name || "").toLowerCase();
    if (s.includes("alch") || s.includes("potion")) return "alchemist";
    if (s.includes("herb") || s.includes("leaf") || s.includes("plant")) return "herbalist";
    if (s.includes("smith") || s.includes("anvil") || s.includes("hammer")) return "smith";
    if (s.includes("weapon") || s.includes("sword") || s.includes("blade")) return "weapons";
    return "general";
  }

  function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /**
   * generateStockFor: quick themed pool.
   * Focus: Uncommon/Rare, occasional Very Rare. Prices are ballpark.
   */
  function generateStockFor(m, count = randInt(12, 20)) {
    const theme = themeFromMerchant(m);

    const pools = {
      alchemist: [
        { name: "Potion of Healing", rarity: "Common", gp: 50 },
        { name: "Potion of Greater Healing", rarity: "Uncommon", gp: 150 },
        { name: "Potion of Fire Breath", rarity: "Uncommon", gp: 180 },
        { name: "Potion of Invisibility", rarity: "Very Rare", gp: 2500 },
        { name: "Elixir of Health", rarity: "Rare", gp: 800 },
        { name: "Alchemist’s Fire (flask)", rarity: "Uncommon", gp: 100 },
        { name: "Oil of Slipperiness", rarity: "Rare", gp: 500 },
        { name: "Dust of Disappearance", rarity: "Uncommon", gp: 300 },
        { name: "Antitoxin (vial)", rarity: "Common", gp: 50 },
      ],
      herbalist: [
        { name: "Goodberry Pouch", rarity: "Uncommon", gp: 120 },
        { name: "Herbal Kit: Nightshade", rarity: "Rare", gp: 700 },
        { name: "Herbal Kit: Kingsfoil", rarity: "Uncommon", gp: 180 },
        { name: "Elven Tea (Restorative)", rarity: "Uncommon", gp: 160 },
        { name: "Druid’s Balm", rarity: "Rare", gp: 900 },
        { name: "Sprig of Mistletoe (focus)", rarity: "Common", gp: 20 },
        { name: "Incense of Meditation", rarity: "Rare", gp: 1100 },
      ],
      smith: [
        { name: "+1 Longsword", rarity: "Rare", gp: 2000 },
        { name: "+1 Shield", rarity: "Uncommon", gp: 500 },
        { name: "Mithral Shirt", rarity: "Rare", gp: 800 },
        { name: "+1 Breastplate", rarity: "Rare", gp: 1500 },
        { name: "Adamantine Plate (piece)", rarity: "Very Rare", gp: 3500 },
        { name: "Smith’s Tools (masterwork)", rarity: "Uncommon", gp: 200 },
        { name: "Chain Mail (fine)", rarity: "Uncommon", gp: 250 },
      ],
      weapons: [
        { name: "+1 Dagger", rarity: "Uncommon", gp: 400 },
        { name: "+1 Shortbow", rarity: "Uncommon", gp: 450 },
        { name: "+1 Greataxe", rarity: "Rare", gp: 2200 },
        { name: "Arrows, +1 (10)", rarity: "Uncommon", gp: 300 },
        { name: "Javelin of Lightning", rarity: "Uncommon", gp: 1500 },
        { name: "Sun Blade", rarity: "Very Rare", gp: 6000 },
        { name: "Net (reinforced)", rarity: "Uncommon", gp: 120 },
      ],
      general: [
        { name: "Cloak of Protection", rarity: "Uncommon", gp: 600 },
        { name: "Bag of Holding", rarity: "Uncommon", gp: 400 },
        { name: "Ring of Warmth", rarity: "Uncommon", gp: 300 },
        { name: "Boots of Elvenkind", rarity: "Uncommon", gp: 450 },
        { name: "Wand of Secrets", rarity: "Uncommon", gp: 350 },
        { name: "Pearl of Power", rarity: "Uncommon", gp: 600 },
        { name: "Immovable Rod", rarity: "Rare", gp: 2500 },
        { name: "Amulet of Health", rarity: "Very Rare", gp: 6000 },
      ],
    };

    const weights = { Common: 1, Uncommon: 6, Rare: 4, "Very Rare": 1 };
    const pool = pools[theme] || pools.general;

    const out = [];
    while (out.length < count) {
      const candidate = pick(pool);
      // weight by rarity
      const tries = weights[candidate.rarity] ?? 1;
      if (Math.random() < tries / 6) {
        out.push({
          item_name: candidate.name,
          item_rarity: candidate.rarity,
          item_cost: `${candidate.gp} gp`,
          qty: 1,
          // card payload keeps future fields flexible
          card_payload: {
            name: candidate.name,
            rarity: candidate.rarity,
            value: candidate.gp,
          },
        });
      }
    }
    return out;
  }

  async function rerollThemed() {
    const next = generateStockFor(merchant);
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

      {/* Merchant items (compact grid that zooms on hover/focus) */}
{cards.length === 0 ? (
  <div className="text-muted fst-italic">No items available.</div>
) : (
  {/* inside MerchantPanel offcanvas body */}
<div className="merchant-grid">
  {cards.map((card) => (
    <div key={card.id} className="tile" tabIndex={0}>
      <ItemCard item={card} />
      <div className="buy-strip">
        <span className="small text-muted">
          {card._price_gp ? `${card._price_gp} gp` : "—"}{typeof card._qty === "number" ? `  x${card._qty}` : ""}
        </span>
        <button className="btn btn-sm btn-primary" onClick={() => handleBuy(card)}>Buy</button>
      </div>
    </div>
  ))}
</div>

)}

      {/* Admin section */}
      {isAdmin && (
        <div className="card mt-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <strong>Inventory (Admin)</strong>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-warning" onClick={rerollThemed}>
                Reroll (theme)
              </button>
              <button className="btn btn-sm btn-outline-danger" onClick={dumpAll}>
                Dump
              </button>
            </div>
          </div>
          <div className="card-body">
            {inv.length === 0 && <div className="text-muted small mb-2">— empty —</div>}
            {inv.length > 0 && (
              <ul className="list-group mb-3">
                {normalizeInventory(inv).map((it, i) => {
                  const nm = typeof it === "string" ? it : (it.item_name || it.name || JSON.stringify(it));
                  const qty = typeof it === "object" ? (it.qty ?? it.quantity ?? null) : null;
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
                placeholder='Add item by name or JSON (e.g. {"name":"+1 Dagger","qty":1,"value":400})'
                value={restockText}
                onChange={(e) => setRestockText(e.target.value)}
              />
              <button className="btn btn-primary" onClick={addItem}>Add</button>
            </div>
            <div className="form-text">
              Strings are treated as single items. JSON with <code>qty</code>/<code>quantity</code> can be incremented.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
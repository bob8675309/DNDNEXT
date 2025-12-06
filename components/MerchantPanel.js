/* components/MerchantPanel.js */

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
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

// how many seconds from the end we keep looping
const LOOP_TAIL_SECONDS = 6;

export default function MerchantPanel({ merchant, isAdmin = false }) {
  const { uid, gp, loading: walletLoading, refresh: refreshWallet } = useWallet();

  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const [restockText, setRestockText] = useState("");
  const [openId, setOpenId] = useState(null); // currently unused, kept for future expansion

  const videoRef = useRef(null);
  const [videoFailed, setVideoFailed] = useState(false);

  const theme = useMemo(() => detectTheme(merchant), [merchant]);

  // Read video / image URLs from the merchant row (snake_case from Supabase)
  const videoUrl =
    merchant?.bg_video_url ||
    merchant?.bgVideoUrl ||
    null;

  const bgUrl =
    merchant?.bg_image_url ||
    merchant?.bg_url ||
    merchant?.bgImageUrl ||
    merchant?.bgUrl ||
    "/parchment.jpg";

  const hasVideo = !!videoUrl && !videoFailed;

  const fetchStock = useCallback(async () => {
    if (!merchant?.id) return;

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

  // Handle video: play once, then loop the last LOOP_TAIL_SECONDS
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasVideo) return;

    const handleLoaded = () => {
      if (!video.duration || !Number.isFinite(video.duration)) return;
      const loopStart = Math.max(0, video.duration - LOOP_TAIL_SECONDS);
      video.dataset.loopStart = String(loopStart);
    };

    const handleTimeUpdate = () => {
      const loopStart = parseFloat(video.dataset.loopStart || "0");
      // when we reach the end, jump back to loopStart
      if (
        video.duration &&
        video.currentTime >= video.duration - 0.05 &&
        loopStart > 0
      ) {
        video.currentTime = loopStart;
        video.play();
      }
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [videoUrl, hasVideo]);

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
        payload.item_description ||
        payload.description ||
        row.description ||
        null,
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

  if (!merchant) return null;

  return (
    <div className="merchant-panel-inner">
      {/* Top gradient header: name on left, wallet + reroll + close on right */}
      <div className="merchant-panel-header d-flex align-items-center">
        <div className="d-flex align-items-center gap-2">
          <h2 className="h5 m-0">{merchant.name}’s Wares</h2>
          <Pill theme={theme} small />
        </div>

        <div className="ms-auto d-flex align-items-center gap-2">
          {/* Wallet badge */}
          <span className="badge bg-secondary">
            {walletLoading ? "…" : gp === -1 ? "∞ gp" : `${gp ?? 0} gp`}
          </span>

          {/* Admin reroll button */}
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

          {/* Offcanvas close button */}
          <button
            type="button"
            className="btn-close btn-close-white ms-2"
            data-bs-dismiss="offcanvas"
            aria-label="Close"
          />
        </div>
      </div>

      {/* Body with background art or video + cards */}
      <div
        className="merchant-panel-body"
        style={{
          "--merchant-bg": `url(${bgUrl})`,
        }}
      >
        {/* Background video layer (if present) */}
        {hasVideo && (
          <div className="merchant-bg-video-wrap">
            <video
              ref={videoRef}
              className="merchant-bg-video"
              src={videoUrl}
              autoPlay
              muted
              playsInline
              loop={false} // we manually loop just the tail
              onError={() => setVideoFailed(true)}
            />
          </div>
        )}

        {/* Gradient / content layer */}
        {err && (
          <div className="alert alert-danger py-1 px-2 mb-2 small">
            {err}
          </div>
        )}

        {/* Admin quick restock bar */}
        {isAdmin && (
          <div className="merchant-admin-toolbar mb-3 d-flex gap-2">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder='Paste item JSON or type a name, e.g. "Potion of Healing"'
              value={restockText}
              onChange={(e) => setRestockText(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-sm btn-outline-light"
              onClick={addItem}
              disabled={busyId === "add"}
            >
              {busyId === "add" ? "Adding…" : "Add item"}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={dumpAll}
              disabled={busyId === "dump"}
            >
              Dump stock
            </button>
          </div>
        )}

        {loading && <div className="text-muted">Loading stock…</div>}

        {!loading && stock.length === 0 && (
          <div className="text-muted small">— no stock —</div>
        )}

        {/* Mini-card grid */}
        <div className="merchant-grid">
          {cards.map((card) => (
            <div key={card.id} className="tile" tabIndex={0}>
              <ItemCard item={card} />

              <div className="buy-strip">
                <span className="small text-muted">
                  {card.item_cost || "— gp"}
                </span>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-light"
                  onClick={() => handleBuy(card)}
                  disabled={busyId === card.id}
                >
                  {busyId === card.id ? "Buying…" : "Buy"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

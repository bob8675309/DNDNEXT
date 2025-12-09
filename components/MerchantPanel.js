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
import {
  themeFromMerchant as detectTheme,
  Pill,
} from "../utils/merchantTheme";

/* Theme → allow-list rules (kept for possible client-side fallback reroll) */
const THEME_RULES = {
  smith: {
    allowTypes: ["Melee Weapon", "Ranged Weapon", "Armor", "Shield"],
  },
  weapons: {
    allowTypes: ["Melee Weapon", "Ranged Weapon", "Ammunition"],
  },
  alchemy: {
    allowTypes: ["Potions & Poisons"],
  },
  herbalist: {
    allowTypes: ["Potions & Poisons"],
  },
  caravan: {
    allowTypes: ["Wondrous", "Scroll", "Ammunition", "Potions & Poisons"],
  },
  stable: {
    allowTypes: ["Mounts & Vehicles"],
  },
  clothier: {
    allowTypes: ["Wondrous", "Armor"],
  },
  jeweler: {
    allowTypes: ["Wondrous"],
  },
  arcanist: {
    allowTypes: ["Wondrous", "Scroll"],
  },
  general: {
    allowTypes: [
      "Wondrous",
      "Scroll",
      "Potions & Poisons",
      "Ammunition",
      "Melee Weapon",
      "Ranged Weapon",
    ],
  },
};

/* How many items to show by default */
const DEFAULT_STOCK_COUNT = 16;

/* Video loop tuning */
const LOOP_TAIL_SECONDS = 6;

export default function MerchantPanel({
  merchant,
  isAdmin = false,
  locations = [],
}) {
  const { uid, gp, loading: walletLoading, refresh: refreshWallet } =
    useWallet();

  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const [restockText, setRestockText] = useState("");
  const [openId, setOpenId] = useState(null); // currently unused, kept for future expansion

  // Travel / route admin state
  const [routes, setRoutes] = useState([]);
  const [tradeRouteId, setTradeRouteId] = useState(null);
  const [excursionRouteId, setExcursionRouteId] = useState(null);
  const [nextLocationId, setNextLocationId] = useState(null);
  const [savingTravel, setSavingTravel] = useState(false);

  const videoRef = useRef(null);

  const theme = useMemo(() => detectTheme(merchant), [merchant]);

  // Load available map routes for admin travel controls
  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    const loadRoutes = async () => {
      const { data, error } = await supabase
        .from("map_routes")
        .select("id, name, code, route_type")
        .order("name", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }

      if (!cancelled) {
        setRoutes(data || []);
      }
    };

    loadRoutes();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // Seed travel controls from the current merchant + routes
  useEffect(() => {
    if (!merchant) return;
    if (!routes || routes.length === 0) return;

    if (merchant.route_id) {
      const active = routes.find((r) => r.id === merchant.route_id);
      if (active) {
        if (active.route_type === "trade") {
          setTradeRouteId(active.id);
        } else if (active.route_type === "excursion") {
          setExcursionRouteId(active.id);
        }
      }
    }

    if (merchant.projected_destination_id) {
      setNextLocationId(merchant.projected_destination_id);
    }
  }, [merchant, routes]);

  // Read video / image URLs from the merchant row (snake_case from Supabase)
  const videoUrl =
    merchant?.bg_video_url || merchant?.bgVideoUrl || null;

  const bgUrl =
    merchant?.bg_image_url ||
    merchant?.bg_url ||
    merchant?.bgImageUrl ||
    merchant?.bgUrl ||
    "/parchment.jpg";

  const hasVideo = !!videoUrl;

  const fetchStock = useCallback(
    async function fetchStockInner() {
      if (!merchant?.id) {
        setStock([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErr("");

      const { data, error } = await supabase
        .from("merchant_stock")
        .select("*")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        setErr(error.message || "Failed to load stock");
        setStock([]);
      } else {
        setStock((data || []).map(normalizeRow));
      }

      setLoading(false);
    },
    [merchant?.id]
  );

  useEffect(() => {
    if (merchant?.id) {
      fetchStock();
    }
  }, [fetchStock, merchant?.id]);

  // Handle video: 1s delay before first play, then loop the last LOOP_TAIL_SECONDS
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasVideo) return;

    const handleLoaded = () => {
      if (!video.duration || !Number.isFinite(video.duration)) return;

      // compute where the loop should start
      const loopStart = Math.max(
        0,
        video.duration - LOOP_TAIL_SECONDS
      );

      // start near the beginning so the user sees some context, then we’ll loop the tail
      if (video.currentTime < 0.1) {
        setTimeout(() => {
          try {
            video.currentTime = Math.max(0, loopStart - 1.0);
            video.play().catch(() => {});
          } catch {
            /* ignore */
          }
        }, 1000);
      }
    };

    const handleTimeUpdate = () => {
      if (!video.duration || !Number.isFinite(video.duration)) return;

      const loopStart = Math.max(
        0,
        video.duration - LOOP_TAIL_SECONDS
      );

      if (video.currentTime >= video.duration - 0.25) {
        // jump back to our loopStart
        try {
          video.currentTime = loopStart;
        } catch {
          /* ignore */
        }
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
        payload.entries ||
        "",
      payload,
      qty: row.qty ?? 1,
      price_gp: price,
    };
  }

  const visibleStock = stock.slice(0, DEFAULT_STOCK_COUNT);

  async function handleBuy(card) {
    if (!uid) {
      alert("You must be logged in to buy from merchants.");
      return;
    }
    if (!merchant?.id) return;

    setBusyId(card.id);
    setErr("");

    try {
      // Preferred path: use the RPC to handle wallet + inventory atomically
      const { error: rpcError } = await supabase.rpc(
        "buy_from_merchant",
        {
          p_merchant_id: merchant.id,
          p_stock_id: card.id,
          p_buyer_user_id: uid,
        }
      );

      if (rpcError) {
        console.warn("buy_from_merchant RPC failed, falling back:", rpcError);

        // Fallback: direct writes
        if (card.price_gp > (gp ?? 0)) {
          throw new Error("Not enough gold.");
        }

        const { error: invError } = await supabase
          .from("inventory_items")
          .insert({
            owner_user_id: uid,
            card_payload: card.payload,
            display_name: card.item_name,
            item_id: card.item_id,
            qty: 1,
          });

        if (invError) throw invError;

        const { error: stockError } = await supabase
          .from("merchant_stock")
          .update({ qty: (card.qty || 0) - 1 })
          .eq("id", card.id);

        if (stockError) throw stockError;
      }

      await Promise.all([fetchStock(), refreshWallet()]);
    } catch (e) {
      console.error(e);
      const msg = e.message || "Purchase failed";
      setErr(msg);
      alert(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function rerollThemed() {
    if (!isAdmin) {
      alert("Only admins can reroll merchant stock.");
      return;
    }

    setBusyId("reroll");
    setErr("");

    try {
      const { error } = await supabase.rpc(
        "reroll_merchant_inventory_v2",
        {
          p_merchant_id: merchant.id,
          p_theme: theme, // jeweler/smith/etc from merchantTheme.js
          p_count: 16, // tweak if you want 12–20, etc
        }
      );

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

  async function setTradeRoute() {
    if (!isAdmin) {
      alert("Only admins can change routes.");
      return;
    }
    if (!merchant?.id || !tradeRouteId) return;

    setSavingTravel(true);
    setErr("");

    try {
      const { error } = await supabase.rpc("set_merchant_route", {
        p_merchant_id: merchant.id,
        p_route_id: tradeRouteId,
        p_start_seq: 1,
        p_mode: "trade",
      });

      if (error) throw error;
    } catch (e) {
      console.error(e);
      const msg = e.message || "Failed to set trade route";
      setErr(msg);
      alert(msg);
    } finally {
      setSavingTravel(false);
    }
  }

  async function sendOnExcursion() {
    if (!isAdmin) {
      alert("Only admins can send merchants on excursions.");
      return;
    }
    if (!merchant?.id || !excursionRouteId) return;

    setSavingTravel(true);
    setErr("");

    try {
      const { error } = await supabase.rpc("set_merchant_route", {
        p_merchant_id: merchant.id,
        p_route_id: excursionRouteId,
        p_start_seq: 1,
        p_mode: "excursion",
      });

      if (error) throw error;
    } catch (e) {
      console.error(e);
      const msg = e.message || "Failed to send on excursion";
      setErr(msg);
      alert(msg);
    } finally {
      setSavingTravel(false);
    }
  }

  async function setNextDestination() {
    if (!isAdmin) {
      alert("Only admins can set destinations.");
      return;
    }
    if (!merchant?.id || !nextLocationId) return;

    setSavingTravel(true);
    setErr("");

    try {
      const { error } = await supabase
        .from("merchants")
        .update({ projected_destination_id: nextLocationId })
        .eq("id", merchant.id);

      if (error) throw error;
    } catch (e) {
      console.error(e);
      const msg = e.message || "Failed to set next destination";
      setErr(msg);
      alert(msg);
    } finally {
      setSavingTravel(false);
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
      let payload = null;
      let displayName = "";
      let priceGp = null;

      try {
        const parsed = JSON.parse(restockText);
        payload = parsed;
        displayName =
          parsed.display_name ||
          parsed.item_name ||
          parsed.name ||
          "Item";
        priceGp = parsed.price_gp ?? parsed.price ?? null;
      } catch {
        // not JSON, interpret as an item name/type hint
        payload = { item_name: restockText.trim() };
        displayName = restockText.trim();
      }

      // RPC: let the server try to resolve the item from the catalog + theme
      const { error: rpcError } = await supabase.rpc(
        "stock_merchant_item",
        {
          p_merchant_id: merchant.id,
          p_display_name: displayName,
          p_price_gp: priceGp,
          p_qty: 1,
          p_payload: payload,
        }
      );

      if (rpcError) {
        console.warn(
          "stock_merchant_item RPC failed, falling back:",
          rpcError
        );

        const { error: insertError } = await supabase
          .from("merchant_stock")
          .insert({
            merchant_id: merchant.id,
            display_name: displayName,
            price_gp: priceGp,
            qty: 1,
            card_payload: payload,
          });

        if (insertError) throw insertError;
      }

      setRestockText("");
      await fetchStock();
    } catch (e) {
      console.error(e);
      const msg = e.message || "Add failed";
      setErr(msg);
      alert(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function changeQty(stockId, newQty) {
    const clamped = Math.max(0, newQty | 0);
    const { error } = await supabase
      .from("merchant_stock")
      .update({ qty: clamped })
      .eq("id", stockId);

    if (error) throw error;
  }

  async function decQty(stockId, by = 1) {
    const row = stock.find((s) => s.id === stockId);
    const next = (row?.qty || 0) - by;
    await changeQty(stockId, next);
    await fetchStock();
  }

  async function incQty(stockId, by = 1) {
    const row = stock.find((s) => s.id === stockId);
    const next = (row?.qty || 0) + by;
    await changeQty(stockId, next);
    await fetchStock();
  }

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRestockText(text);
      }
    } catch (e) {
      console.error("Clipboard read failed:", e);
      alert(
        "Could not read from clipboard. Paste manually into the box instead."
      );
    }
  }

  return (
    <div className="merchant-panel-inner">
      {/* Top gradient header: name on left, wallet + admin tools + reroll + close on right */}
      <div className="merchant-panel-header d-flex align-items-center gap-3 flex-wrap">
        <div className="d-flex align-items-center gap-2">
          <h2 className="h5 m-0">{merchant.name}’s Wares</h2>
          <Pill theme={theme} small />
        </div>

        <div className="ms-auto d-flex align-items-center gap-2 flex-wrap justify-content-end">
          {/* Wallet badge */}
          <span className="badge bg-secondary">
            {walletLoading ? "…" : gp === -1 ? "∞ gp" : `${gp ?? 0} gp`}
          </span>

          {/* Admin toolbar: paste / add / dump */}
          {isAdmin && (
            <div className="merchant-admin-toolbar d-flex align-items-center gap-1">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder='Paste JSON or type an item name…'
                value={restockText}
                onChange={(e) => setRestockText(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-sm btn-outline-light"
                onClick={handlePasteFromClipboard}
                disabled={busyId === "paste"}
              >
                Paste
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-success"
                onClick={addItem}
                disabled={busyId === "add"}
              >
                {busyId === "add" ? "Adding…" : "Add"}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={dumpAll}
                disabled={busyId === "dump"}
              >
                Dump
              </button>
            </div>
          )}

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

      {/* Admin travel & routes controls */}
      {isAdmin && (
        <div className="merchant-travel-admin mt-3 p-2 rounded border border-secondary bg-dark bg-opacity-25">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="small text-uppercase text-muted">
              Travel & routes
            </span>
            {savingTravel && (
              <span className="small text-warning">Saving…</span>
            )}
          </div>

          <div className="row g-2">
            <div className="col-12 col-lg-6">
              <label className="form-label form-label-sm mb-1">
                Trade route
              </label>
              <select
                className="form-select form-select-sm"
                value={tradeRouteId || ""}
                onChange={(e) =>
                  setTradeRouteId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">— none —</option>
                {routes
                  .filter((r) => r.route_type === "trade")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || r.code}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="btn btn-sm btn-outline-light mt-1"
                onClick={setTradeRoute}
                disabled={savingTravel || !tradeRouteId}
              >
                Set trade route
              </button>
            </div>

            <div className="col-12 col-lg-6">
              <label className="form-label form-label-sm mb-1">
                Excursion route
              </label>
              <select
                className="form-select form-select-sm"
                value={excursionRouteId || ""}
                onChange={(e) =>
                  setExcursionRouteId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">— none —</option>
                {routes
                  .filter((r) => r.route_type === "excursion")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || r.code}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="btn btn-sm btn-outline-warning mt-1"
                onClick={sendOnExcursion}
                disabled={savingTravel || !excursionRouteId}
              >
                Send on excursion
              </button>
            </div>
          </div>

          <div className="row g-2 mt-2">
            <div className="col-12 col-lg-8">
              <label className="form-label form-label-sm mb-1">
                Next destination
              </label>
              <select
                className="form-select form-select-sm"
                value={nextLocationId || ""}
                onChange={(e) =>
                  setNextLocationId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">— none —</option>
                {locations
                  ?.filter((loc) => loc && loc.id)
                  .map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="col-12 col-lg-4 d-flex align-items-end">
              <button
                type="button"
                className="btn btn-sm btn-outline-info w-100"
                onClick={setNextDestination}
                disabled={savingTravel || !nextLocationId}
              >
                Set next destination
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Body with background art or video + cards */}
      <div
        className="merchant-panel-body"
        style={
          hasVideo
            ? {}
            : {
                // keep the old behavior if there is no video
                "--merchant-bg": `url(${bgUrl})`,
              }
        }
      >
        {/* Background video layer (if present) */}
        {hasVideo && (
          <div className="merchant-bg-video-wrap">
            <video
              ref={videoRef}
              className="merchant-bg-video"
              src={videoUrl}
              muted
              playsInline
            />
          </div>
        )}

        {/* Foreground content: cards */}
        <div className="merchant-panel-cards">
          {err && (
            <div className="alert alert-danger py-1 px-2 rounded border border-secondary bg-danger bg-opacity-25">
              <div className="d-flex justify-content-between align-items-center gap-2">
                <span className="small text-uppercase text-muted">
                  Error
                </span>
                <button
                  type="button"
                  className="btn-close btn-close-white btn-close-sm"
                  aria-label="Clear error"
                  onClick={() => setErr("")}
                />
              </div>
              <div className="small mt-1">{err}</div>
            </div>
          )}

          {loading ? (
            <div className="text-center text-muted small mt-3">
              Loading merchant stock…
            </div>
          ) : visibleStock.length === 0 ? (
            <div className="text-center text-muted small mt-3">
              This merchant has nothing in stock right now.
            </div>
          ) : (
            <div className="merchant-card-grid">
              {visibleStock.map((card) => (
                <div
                  key={card.id}
                  className="merchant-card-wrap"
                >
                  <ItemCard
                    card={card.payload}
                    displayName={card.item_name}
                    compact
                  />
                  <div className="merchant-card-strip d-flex align-items-center justify-content-between mt-1">
                    <span className="small text-muted">
                      {card.price_gp ?? 0} gp
                    </span>
                    <span className="small text-muted">
                      Qty: {card.qty ?? 0}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => handleBuy(card)}
                      disabled={busyId === card.id || card.qty <= 0}
                    >
                      {busyId === card.id ? "Buying…" : "Buy"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/*  components/MerchantPanel.js */

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

// how many seconds from the end we keep looping
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
  const [showTravel, setShowTravel] = useState(false);

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

  // When merchant or routes change, seed the route + next-destination controls
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
    merchant?.bg_video_url ||
    merchant?.bgVideoUrl ||
    null;

  const bgUrl =
    merchant?.bg_image_url ||
    merchant?.bg_url ||
    merchant?.bgImageUrl ||
    merchant?.bgUrl ||
    "/parchment.jpg";

  const hasVideo = !!videoUrl;

  const fetchStock = useCallback(async () => {
    if (!merchant?.id) {
      setStock([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr("");

    const { data, error } = await supabase
      .from("character_stock")
      .select("*")
      .eq("character_id", merchant.id)
        // character_stock does not have created_at; keep ordering stable by name.
        .order("display_name", { ascending: true });

    if (error) setErr(error.message);
    setStock(data || []);
    setLoading(false);
  }, [merchant?.id]);

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
      const loopStart = Math.max(0, video.duration - LOOP_TAIL_SECONDS);
      video.dataset.loopStart = String(loopStart);

      // wait 1s before starting so the panel can fully slide in
      setTimeout(() => {
        video.currentTime = 0;
        // audio ON: no muted flag; rely on user click that opened the panel
        video.play().catch(() => {
          // If the browser blocks autoplay w/ sound, we just fail silently;
          // user can click the panel to start playback if needed.
        });
      }, 1000);
    };

    const handleTimeUpdate = () => {
      const loopStart = parseFloat(video.dataset.loopStart || "0");
      if (
        video.duration &&
        video.currentTime >= video.duration - 0.05 &&
        loopStart > 0
      ) {
        video.currentTime = loopStart;
        video.play().catch(() => {});
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
      item_id: row.item_id || payload.item_id || row.id,
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

  // Paste helper for admin restock bar
  async function handlePasteFromClipboard() {
    if (!navigator?.clipboard) {
      alert("Clipboard API not available in this browser.");
      return;
    }

    setBusyId("paste");
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRestockText(text);
      }
    } catch (e) {
      console.error(e);
      alert("Could not read from clipboard.");
    } finally {
      setBusyId(null);
    }
  }


  function isMissingFunctionError(err) {
    const msg = String(err?.message || err || "");
    return /No function|does not exist|PGRST202/i.test(msg);
  }

  function normalizeRarity(r) {
    const s = String(r || "").toLowerCase().replace(/\s+/g, "").replace(/[-_]/g, "");
    if (s in { common: 1 }) return "Common";
    if (s in { uncommon: 1 }) return "Uncommon";
    if (s in { rare: 1 }) return "Rare";
    if (s in { veryrare: 1, veryrareitem: 1 }) return "Very Rare";
    if (s in { legendary: 1 }) return "Legendary";
    return null;
  }

  function sample(arr, k) {
    if (!Array.isArray(arr) || arr.length === 0 || k <= 0) return [];
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, Math.min(k, a.length));
  }

  async function rerollThemedFallback() {
    // Client-side reroll (when the RPC isn't installed):
    // - dump existing stock
    // - select items from items_catalog by theme tag
    // - insert 12–20 themed items into character_stock
    if (!merchant?.id) return;

    const count = 12 + Math.floor(Math.random() * 9); // 12..20

    // 1) Clear stock
    {
      const { error } = await supabase
        .from("character_stock")
        .delete()
        .eq("character_id", merchant.id);
      if (error) throw error;
    }

    // 2) Pull candidates
    let q = supabase
      .from("items_catalog")
      .select("id,item_name,item_type,item_rarity,price_gp,payload,merchant_tags")
      .limit(1200);

    if (theme && theme !== "general") {
      q = q.contains("merchant_tags", [theme]);
    }

    const { data: rows, error: qErr } = await q;
    if (qErr) throw qErr;

    const candidates = (rows || []).map((r) => {
      const rarity = normalizeRarity(r.item_rarity || r.payload?.item_rarity || r.payload?.rarity);
      return { ...r, _rarity: rarity };
    });

    // Prefer Uncommon/Rare, with a small chance of Very Rare.
    const uncommon = candidates.filter((r) => r._rarity === "Uncommon");
    const rare = candidates.filter((r) => r._rarity === "Rare");
    const veryRare = candidates.filter((r) => r._rarity === "Very Rare");
    const fallback = candidates.filter((r) => !r._rarity || r._rarity === "Common");

    const nUncommon = Math.max(0, Math.round(count * 0.6));
    const nRare = Math.max(0, Math.round(count * 0.35));
    const nVeryRare = Math.max(0, count - nUncommon - nRare);

    let picked = [
      ...sample(uncommon, nUncommon),
      ...sample(rare, nRare),
      ...sample(veryRare, nVeryRare),
    ];

    if (picked.length < count) {
      const pool = [...uncommon, ...rare, ...veryRare, ...fallback];
      const already = new Set(picked.map((p) => p.item_name));
      const extra = pool.filter((p) => !already.has(p.item_name));
      picked = picked.concat(sample(extra, count - picked.length));
    }

    if (!picked.length) return;

    // 3) Insert stock rows
    const stockRows = picked.map((it) => {
      const payload = (it.payload && typeof it.payload === "object") ? it.payload : {};
      const display_name = it.item_name || payload.item_name || payload.name || "Item";
      const price_gp = Number(it.price_gp ?? payload.price_gp ?? payload.price ?? 0) || 0;

      const mergedPayload = {
        ...payload,
        item_id: payload.item_id || it.id || null,
        item_name: payload.item_name || display_name,
        item_type: payload.item_type || it.item_type || payload.type || null,
        item_rarity: payload.item_rarity || it.item_rarity || payload.rarity || null,
        price_gp,
      };

      return {
        character_id: merchant.id,
        item_id: (mergedPayload && mergedPayload.item_id) ? String(mergedPayload.item_id) : (it?.id ? String(it.id) : null),
        display_name,
        price_gp,
        qty: 1,
        card_payload: mergedPayload,
      };
    });

    const { error: insErr } = await supabase.from("character_stock").insert(stockRows);
    if (insErr) throw insErr;
  }

  async function setMerchantRouteFallback(routeId, mode) {
    if (!merchant?.id || !routeId) return;
    const now = new Date().toISOString();
    const patch = {
      route_id: routeId,
      route_mode: mode,
      state: "moving",
      rest_until: null,
      route_point_seq: 1,
      route_segment_progress: 0,
      current_point_seq: 1,
      next_point_seq: 2,
      prev_point_seq: null,
      segment_started_at: now,
      segment_ends_at: null,
      last_moved_at: now,
      updated_at: now,
    };

    const { error } = await supabase.from("characters").update(patch).eq("id", merchant.id);
    if (error) throw error;
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
      // IMPORTANT: pass p_count to disambiguate overloaded functions in PostgREST
      // (your DB can have both a 2-arg and 3-arg overload of reroll_merchant_inventory_v2).
      // Target 12-20 items, matching the merchant inventory expectation.
      const desiredCount = 12 + Math.floor(Math.random() * 9);

      let rpcError = null;
      let rpcData = null;

      // Attempt the 3-arg signature first (preferred).
      {
        const { data, error } = await supabase.rpc("reroll_merchant_inventory_v2", {
          p_merchant_id: merchant.id,
          p_theme: theme, // jeweler/smith/etc from merchantTheme.js
          p_count: desiredCount,
        });
        rpcData = data;
        rpcError = error;
      }

      // If the DB only has the 2-arg version, retry without p_count.
      if (rpcError && /p_count|argument|unknown|does not exist/i.test(rpcError.message || "")) {
        const { data, error } = await supabase.rpc("reroll_merchant_inventory_v2", {
          p_merchant_id: merchant.id,
          p_theme: theme,
        });
        rpcData = data;
        rpcError = error;
      }

      if (rpcError) throw rpcError;

      // Supabase returns a 1-row array for SETOF/TABLE-returning functions.
      const insertedCount = Array.isArray(rpcData) ? rpcData?.[0]?.inserted_count : rpcData?.inserted_count;
      if (typeof insertedCount === "number" && insertedCount === 0) {
        setError(
          "Reroll completed but inserted 0 items. This usually means your items_catalog is missing merchant_tags for the selected theme (or the theme is too restrictive)."
        );
      }

      // give Postgres a moment to commit inserts, then refetch
      await new Promise((r) => setTimeout(r, 120));
      await fetchStock();
    } catch (e) {
      console.error(e);

      // If the DB RPC pack isn't installed yet, fall back to a client-side reroll.
      if (isMissingFunctionError(e)) {
        try {
          await rerollThemedFallback();
          await fetchStock();
          return;
        } catch (inner) {
          console.error(inner);
          const msg = inner.message || "Reroll failed";
          setErr(msg);
          alert(msg);
          return;
        }
      }

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

      if (isMissingFunctionError(e)) {
        try {
          await setMerchantRouteFallback(tradeRouteId, "trade");
          return;
        } catch (inner) {
          console.error(inner);
          const msg = inner.message || "Failed to set trade route";
          setErr(msg);
          alert(msg);
          return;
        }
      }

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

      if (isMissingFunctionError(e)) {
        try {
          await setMerchantRouteFallback(excursionRouteId, "excursion");
          return;
        } catch (inner) {
          console.error(inner);
          const msg = inner.message || "Failed to send on excursion";
          setErr(msg);
          alert(msg);
          return;
        }
      }

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
        .from("characters")
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
        .from("character_stock")
        .delete()
        .eq("character_id", merchant.id);
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
        const { error } = await supabase.from("character_stock").insert({
          character_id: merchant.id,
          item_id: payload.item_id || null,
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
      .from("character_stock")
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
        .from("character_stock")
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
      {/* Top gradient header: name on left, wallet + admin tools + travel + reroll + close on right */}
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
                placeholder="Paste JSON or type an item name…"
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

          {/* Admin Travel & routes toggle button */}
          {isAdmin && (
            <button
              type="button"
              className={
                "btn btn-sm btn-outline-info" +
                (showTravel ? " active" : "")
              }
              onClick={() => setShowTravel((v) => !v)}
            >
              Travel &amp; routes
            </button>
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
              playsInline
              loop={false}
            />
          </div>
        )}

        {/* Slide-out Travel & routes panel (admin only) */}
        {isAdmin && (
          <div
            className={
              "merchant-travel-panel" +
              (showTravel ? " merchant-travel-panel-open" : "")
            }
          >
            <div className="merchant-travel-admin mt-3 p-2 rounded border border-secondary bg-dark bg-opacity-25">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="small text-uppercase text-muted">
                  Travel &amp; routes
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
          </div>
        )}

        {err && (
          <div className="alert alert-danger py-1 px-2 mb-2 small">
            {err}
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

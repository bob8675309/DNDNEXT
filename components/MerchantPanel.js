/*   components/MerchantPanel.js */

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

/*     Theme → allow-list rules (kept for possible client-side fallback reroll) */
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
  onBackToProfile,
  onClose,
  presentation = "map",
}) {
  const { uid, gp, loading: walletLoading, refresh: refreshWallet } =
    useWallet();

  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const [restockText, setRestockText] = useState("");
  const [openId, setOpenId] = useState(null); // retained for future card expansion
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState(null);

  // Travel / route admin state
  const [routes, setRoutes] = useState([]);
  const [tradeRouteId, setTradeRouteId] = useState(null);
  const [excursionRouteId, setExcursionRouteId] = useState(null);
  const [nextLocationId, setNextLocationId] = useState(null);
  const [savingTravel, setSavingTravel] = useState(false);
  const [showTravel, setShowTravel] = useState(false);

  // Movement tuning (per-character)
  const [draftMoveSpeed, setDraftMoveSpeed] = useState(0.02);
  const [draftDwellHours, setDraftDwellHours] = useState(4);

  const videoRef = useRef(null);

  const theme = useMemo(() => detectTheme(merchant), [merchant]);

  useEffect(() => {
    if (!merchant) return;
    setDraftMoveSpeed(
      Number.isFinite(Number(merchant.roaming_speed)) ? Number(merchant.roaming_speed) : 0.02
    );
    setDraftDwellHours(
      Number.isFinite(Number(merchant.dwell_hours)) ? Number(merchant.dwell_hours) : 4
    );
  }, [merchant?.id]);

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

  const portraitStorageUrl = merchant?.portrait_storage_path
    ? supabase.storage.from("npc-portraits").getPublicUrl(merchant.portrait_storage_path).data?.publicUrl
    : null;

  const bgUrl =
    merchant?.portrait_shop_url ||
    merchant?.portrait_url ||
    merchant?.image_url ||
    portraitStorageUrl ||
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
  const categories = useMemo(() => {
    const values = Array.from(new Set(cards.map((card) => card.item_type || "Other").filter(Boolean)));
    return ["All", ...values.sort((a, b) => String(a).localeCompare(String(b)))];
  }, [cards]);
  const filteredCards = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cards.filter((card) => {
      if (typeFilter !== "All" && String(card.item_type || "Other") !== typeFilter) return false;
      if (!needle) return true;
      return [card.item_name, card.item_type, card.item_rarity, card.item_description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [cards, query, typeFilter]);

  useEffect(() => {
    if (!filteredCards.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!filteredCards.some((card) => String(card.id) === String(selectedId))) {
      setSelectedId(filteredCards[0].id);
    }
  }, [filteredCards, selectedId]);

  const selectedCard = filteredCards.find((card) => String(card.id) === String(selectedId)) || filteredCards[0] || null;

  async function handleBuy(card) {
    if (!uid) {
      setNotice({ kind: "error", message: "Please sign in before purchasing an item." });
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
      setNotice({ kind: "success", message: "Purchased " + card.item_name + " for " + card._price_gp + " gp. It has been added to your inventory." });
    } catch (e) {
      console.error(e);
      const msg = e.message || "Purchase failed";
      setErr(msg);
      setNotice({ kind: "error", message: msg });
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
      // Only trust public.characters (public.merchants is legacy).
      await setMerchantRouteFallback(tradeRouteId, "trade");
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
      // Only trust public.characters (public.merchants is legacy).
      await setMerchantRouteFallback(excursionRouteId, "excursion");
    } catch (e) {
      console.error(e);
      const msg = e.message || "Failed to send on excursion";
      setErr(msg);
      alert(msg);
    } finally {
      setSavingTravel(false);
    }
  }

  async function saveMovementSettings() {
    if (!merchant?.id) return;
    setSavingTravel(true);
    setErr("");
    try {
      const { error } = await supabase.rpc("update_character", {
        p_character_id: merchant.id,
        p_patch: {
          roaming_speed: Number(draftMoveSpeed),
          dwell_hours: Number(draftDwellHours),
        },
      });
      if (error) throw error;
    } catch (e) {
      console.error(e);
      const msg = e.message || "Failed to save movement settings";
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

  const merchantSubline = merchant.storefront_tagline || merchant.storefront_title || merchant.role || merchant.affiliation || "Traveling merchant";
  const stockLabel = loading ? "Loading stock" : cards.length + " item" + (cards.length === 1 ? "" : "s") + " in stock";

  return (
    <div className={"merchant-panel-inner merchant-market merchant-panel-" + presentation}>
      <header className="merchant-market-header">
        <div className="merchant-market-heading">
          <div className="merchant-market-kicker">Merchant storefront</div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <h2 className="merchant-market-title">{merchant.name}’s Wares</h2>
            <Pill theme={theme} small />
          </div>
          <div className="merchant-market-subline">{merchantSubline} · {stockLabel}</div>
        </div>

        <div className="merchant-market-header-actions">
          {isAdmin ? (
            <button type="button" className={"btn btn-sm " + (showTravel ? "btn-warning" : "btn-outline-warning")} onClick={() => setShowTravel((value) => !value)}>
              Merchant tools
            </button>
          ) : null}
          <button
            type="button"
            className="btn-close btn-close-white"
            data-bs-dismiss="offcanvas"
            aria-label="Close storefront"
            onClick={() => onClose?.()}
          />
        </div>
      </header>

      {notice?.message ? (
        <div className={"merchant-market-notice merchant-market-notice-" + notice.kind} role="status">
          <span>{notice.message}</span>
          <button type="button" aria-label="Dismiss notice" onClick={() => setNotice(null)}>×</button>
        </div>
      ) : null}

      {isAdmin && showTravel ? (
        <section className="merchant-admin-console">
          <div className="merchant-admin-console-head">
            <div>
              <div className="merchant-market-kicker">Admin controls</div>
              <strong>Stock and travel</strong>
            </div>
            <button type="button" className="btn btn-sm btn-outline-light" onClick={() => setShowTravel(false)}>Done</button>
          </div>

          <div className="merchant-admin-restock-row">
            <input type="text" className="form-control form-control-sm" placeholder="Paste JSON or type an item name…" value={restockText} onChange={(event) => setRestockText(event.target.value)} />
            <button type="button" className="btn btn-sm btn-outline-light" onClick={handlePasteFromClipboard} disabled={busyId === "paste"}>Paste</button>
            <button type="button" className="btn btn-sm btn-outline-success" onClick={addItem} disabled={busyId === "add"}>{busyId === "add" ? "Adding…" : "Add item"}</button>
            <button type="button" className="btn btn-sm btn-outline-warning" onClick={rerollThemed} disabled={busyId === "reroll"}>{busyId === "reroll" ? "Rerolling…" : "Reroll stock"}</button>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={dumpAll} disabled={busyId === "dump"}>Dump stock</button>
          </div>

          <div className="merchant-admin-grid">
            <label><span>Trade route</span><select className="form-select form-select-sm" value={tradeRouteId || ""} onChange={(event) => setTradeRouteId(event.target.value ? Number(event.target.value) : null)}><option value="">— none —</option>{routes.filter((route) => route.route_type === "trade").map((route) => <option key={route.id} value={route.id}>{route.name || route.code}</option>)}</select><button type="button" className="btn btn-sm btn-outline-light" onClick={setTradeRoute} disabled={savingTravel || !tradeRouteId}>Set trade route</button></label>
            <label><span>Excursion route</span><select className="form-select form-select-sm" value={excursionRouteId || ""} onChange={(event) => setExcursionRouteId(event.target.value ? Number(event.target.value) : null)}><option value="">— none —</option>{routes.filter((route) => route.route_type === "excursion").map((route) => <option key={route.id} value={route.id}>{route.name || route.code}</option>)}</select><button type="button" className="btn btn-sm btn-outline-warning" onClick={sendOnExcursion} disabled={savingTravel || !excursionRouteId}>Send on excursion</button></label>
            <label><span>Next destination</span><select className="form-select form-select-sm" value={nextLocationId || ""} onChange={(event) => setNextLocationId(event.target.value ? Number(event.target.value) : null)}><option value="">— none —</option>{locations.filter((loc) => loc?.id).map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}</select><button type="button" className="btn btn-sm btn-outline-info" onClick={setNextDestination} disabled={savingTravel || !nextLocationId}>Set destination</button></label>
            <label><span>Move speed · {Number(draftMoveSpeed).toFixed(3)} pct/sec</span><input type="range" className="form-range" min={0.001} max={0.05} step={0.001} value={draftMoveSpeed} onChange={(event) => setDraftMoveSpeed(parseFloat(event.target.value))} /></label>
            <label><span>Dwell time · {Number(draftDwellHours).toFixed(0)} hours</span><input type="range" className="form-range" min={1} max={24} step={1} value={draftDwellHours} onChange={(event) => setDraftDwellHours(parseInt(event.target.value, 10))} /></label>
            <div className="merchant-admin-save"><button type="button" className="btn btn-sm btn-success" onClick={saveMovementSettings} disabled={savingTravel}>{savingTravel ? "Saving…" : "Save movement"}</button></div>
          </div>
        </section>
      ) : null}

      <main className="merchant-market-shell">
        <section className="merchant-scene" style={hasVideo ? undefined : { "--merchant-bg": "url(" + bgUrl + ")" }}>
          {hasVideo ? <div className="merchant-bg-video-wrap"><video ref={videoRef} className="merchant-bg-video" src={videoUrl} playsInline loop={false} /></div> : null}
          <div className="merchant-scene-scrim" />
          <div className="merchant-scene-copy">
            <span className="merchant-scene-theme">{theme}</span>
            <h3>{merchant.storefront_title || "Curated wares"}</h3>
            <p>{merchant.storefront_tagline || "Browse the merchant’s current stock, inspect an item, and purchase without leaving the storefront."}</p>
          </div>
        </section>

        <section className="merchant-stock-workspace">
          <div className="merchant-stock-toolbar">
            <label className="merchant-search-field">
              <span>Search stock</span>
              <input className="form-control form-control-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, rarity, type, or description" />
            </label>
            <div className="merchant-category-row" aria-label="Stock categories">
              {categories.map((category) => (
                <button key={category} type="button" className={"merchant-category-chip" + (typeFilter === category ? " active" : "")} onClick={() => setTypeFilter(category)}>{category}</button>
              ))}
            </div>
          </div>

          {err ? <div className="merchant-inline-error">{err}</div> : null}

          <div className="merchant-stock-layout">
            <div className="merchant-stock-list" role="listbox" aria-label="Merchant stock">
              {loading ? <div className="merchant-market-empty">Loading stock…</div> : null}
              {!loading && !filteredCards.length ? <div className="merchant-market-empty">No items match the current search and category.</div> : null}
              {filteredCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  role="option"
                  aria-selected={String(selectedCard?.id) === String(card.id)}
                  className={"merchant-stock-row" + (String(selectedCard?.id) === String(card.id) ? " selected" : "")}
                  onClick={() => setSelectedId(card.id)}
                >
                  <div className="merchant-stock-row-head">
                    <strong>{card.item_name}</strong>
                    <span>{card._price_gp} gp</span>
                  </div>
                  <div className="merchant-stock-row-meta">
                    <span>{card.item_rarity || "Mundane"}</span>
                    <span>{card.item_type || "Item"}</span>
                    <span>Qty {card._qty}</span>
                  </div>
                  <p>{card.item_description || "No description is available for this item."}</p>
                </button>
              ))}
            </div>

            <aside className="merchant-preview-pane">
              {selectedCard ? (
                <>
                  <div className="merchant-preview-head">
                    <div>
                      <div className="merchant-market-kicker">Selected item</div>
                      <h3>{selectedCard.item_name}</h3>
                    </div>
                    <span className="merchant-preview-price">{selectedCard._price_gp} gp</span>
                  </div>
                  <div className="merchant-preview-card-scroll"><ItemCard item={selectedCard} /></div>
                  <div className="merchant-preview-purchase">
                    <div><span>Available</span><strong>{selectedCard._qty}</strong></div>
                    <div><span>Your wallet</span><strong>{walletLoading ? "…" : gp === -1 ? "∞ gp" : (gp ?? 0) + " gp"}</strong></div>
                    <button type="button" className="btn btn-success" onClick={() => handleBuy(selectedCard)} disabled={busyId === selectedCard.id || selectedCard._qty <= 0}>
                      {busyId === selectedCard.id ? "Purchasing…" : selectedCard._qty <= 0 ? "Sold out" : "Buy for " + selectedCard._price_gp + " gp"}
                    </button>
                  </div>
                </>
              ) : <div className="merchant-market-empty">Select an item to inspect it.</div>}
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}

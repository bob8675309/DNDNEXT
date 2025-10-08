// /pages/inventory.js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import ItemCard from "@/components/ItemCard";
import OfferTradeButton from "@/components/OfferTradeButton";
import TradeRequestsPanel from "@/components/TradeRequestsPanel";
import { classifyUi } from "@/utils/itemsIndex";
import useWallet from "@/utils/useWallet";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function InventoryPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ character_name: "", character_image_url: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null); // for per-card delete spinner
  const [isAdmin, setIsAdmin] = useState(false);
  const { gp, loading: gpLoading } = useWallet();

  useEffect(() => {
    let unsub;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sess = data.session;
      if (!sess) { router.replace("/login"); return; }
      setSession(sess);

      // role check
      const up = await supabase.from("user_profiles").select("role").eq("id", sess.user.id).maybeSingle();
      setIsAdmin((up.data?.role || "player").toLowerCase() !== "player");

      setMeta({
        character_name: sess.user.user_metadata?.character_name || "",
        character_image_url: sess.user.user_metadata?.character_image_url || "",
      });
      await load(sess.user.id);

      const ch = supabase
        .channel("inv-self")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "inventory_items", filter: `user_id=eq.${sess.user.id}` },
          () => load(sess.user.id)
        )
        .subscribe();
      unsub = () => supabase.removeChannel(ch);
    })();
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(userId) {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error) setRows(data || []);
    setLoading(false);
  }

  async function saveMeta(e) {
    e?.preventDefault();
    setSaving(true); setErr("");
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          character_name: meta.character_name || "",
          character_image_url: meta.character_image_url || "",
        },
      });
      if (error) throw error;
    } catch (e2) {
      setErr(e2.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  // Hydrate DB rows into ItemCard-friendly items
  const items = useMemo(() => {
    return (rows || []).map((row) => {
      // payload may be JSON (object) or JSON string; or absent
      const payloadRaw = row.card_payload || row.item_payload || null;
      const payload = typeof payloadRaw === "string" ? (safeParse(payloadRaw) || {}) : (payloadRaw || {});

      const base = {
        id: row.id,
        name: row.item_name || payload.name,
        item_name: row.item_name || payload.name,
        rarity: row.item_rarity || payload.rarity,
        item_rarity: row.item_rarity || payload.rarity,
        description: row.item_description || payload.description,
        item_description: row.item_description || payload.description,
        image_url: payload.image_url || "/placeholder.png",
        type: row.item_type || payload.type,
        item_type: row.item_type || payload.type,
        weight: row.item_weight || payload.weight,
        item_weight: row.item_weight || payload.weight,
        cost: row.item_cost || payload.cost,
        item_cost: row.item_cost || payload.cost,
        card_payload: payload,
        _cls: classifyUi(row.item_type || payload.type, row.item_rarity || payload.rarity),
      };

      return base;
    });
  }, [rows]);

  function safeParse(s){
    try { return JSON.parse(s); } catch { return null; }
  }

  async function removeItem(id) {
    setBusyId(id);
    try {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
    } catch (e) {
      alert(e.message || "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="container my-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-3">
          <h1 className="h4 m-0">Inventory</h1>
          <span className="badge bg-secondary">
            {gpLoading ? "…" : gp === -1 ? "∞ gp" : `${gp ?? 0} gp`}
          </span>
        </div>
        {meta.character_name && (
          <div className="text-muted small">{meta.character_name}</div>
        )}
      </div>

      {err && <div className="alert alert-danger py-2">{err}</div>}

      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-muted">No items yet.</div>
      ) : (
        <div className="row g-3">
          {items.map((item) => (
            <div key={item.id} className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex">
              <div className="w-100 d-flex flex-column">
                <ItemCard item={item} />
                <div className="d-flex justify-content-between align-items-center mt-2">
                  <OfferTradeButton row={item} />
                  <button
                    className="btn btn-sm btn-outline-danger"
                    disabled={busyId === item.id}
                    onClick={() => removeItem(item.id)}
                  >
                    {busyId === item.id ? "Removing…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <TradeRequestsPanel />
      </div>
    </div>
  );
}
// /pages/inventory.js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import ItemCard from "@/components/ItemCard";
import OfferTradeButton from "@/components/OfferTradeButton";
import TradeRequestsPanel from "@/components/TradeRequestsPanel";
import { classifyUi } from "@/utils/itemsIndex";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ---- small helpers ---------------------------------------------------
function safeParse(json) {
  try { return JSON.parse(json); } catch { return null; }
}
function coerceArr(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return v.split(/\n+/).map(s => s.trim()).filter(Boolean);
  return [];
}

export default function InventoryPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [meta, setMeta] = useState({ character_name: "", character_image_url: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [busyId, setBusyId] = useState(null);   // per-card remove spinner
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAll, setShowAll] = useState(false); // admin: show everyone’s items

  // --------------------------------------------------------------------
  useEffect(() => {
    let unsub;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sess = data.session;
      if (!sess) { router.replace("/login"); return; }
      setSession(sess);

      // profile meta
      setMeta({
        character_name: sess.user.user_metadata?.character_name || "",
        character_image_url: sess.user.user_metadata?.character_image_url || "",
      });

      // role check
      const prof = await supabase.from("user_profiles").select("role").eq("id", sess.user.id).maybeSingle();
      const admin = !prof.error && (prof.data?.role || "").toLowerCase() === "admin";
      setIsAdmin(admin);

      await load(admin ? (showAll ? null : sess.user.id) : sess.user.id);

      // real-time refresh for my items; if admin+showAll, refresh on any row
      const filter = admin && showAll ? undefined : `user_id=eq.${sess.user.id}`;
      const ch = supabase
        .channel("inv-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items", filter }, () =>
          load(admin ? (showAll ? null : sess.user.id) : sess.user.id)
        )
        .subscribe();
      unsub = () => supabase.removeChannel(ch);
    })();
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll]);

  async function load(userId /* string | null for admin-all */) {
    setLoading(true);
    let q = supabase.from("inventory_items").select("*").order("created_at", { ascending: false });
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
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

  async function removeRow(id) {
    setBusyId(id);
    try {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
      setRows((rs) => rs.filter(r => r.id !== id));
    } catch (e) {
      alert(e.message || "Failed to remove item.");
    } finally {
      setBusyId(null);
    }
  }

  // ---- hydrate DB rows into ItemCard-friendly items -------------------
  const items = useMemo(() => {
    return (rows || []).map((row) => {
      const payloadRaw = row.card_payload || row.item_payload || null;
      const payload = typeof payloadRaw === "string" ? (safeParse(payloadRaw) || {}) : (payloadRaw || {});

      const it = {
        id: row.id,
        // identity
        name: row.item_name || payload.name,
        item_name: row.item_name || payload.name,
        item_type: row.item_type || payload.item_type || payload.type,
        item_rarity: row.item_rarity || payload.item_rarity || payload.rarity,
        // description
        description: row.item_description || payload.description || payload.flavor,
        item_description: row.item_description || payload.description || payload.flavor,
        entries: coerceArr(payload.entries),
        flavor: payload.flavor || "",
        // stats for ItemCard bottom row
        damageText: payload.damageText || payload.damage_text || row.damage_text || "",
        rangeText: payload.rangeText || payload.range_text || row.range_text || "",
        propertiesText: payload.propertiesText || payload.properties_text || row.properties_text || "",
        ac: payload.ac ?? row.ac ?? "",
        // image
        image_url: row.image_url || payload.image_url || "/placeholder.png",
      };

      // Classify for weapon/armor preview labels (ItemCard uses __cls sometimes)
      it.__cls = classifyUi(it);
      return it;
    });
  }, [rows]);

  const name = meta.character_name || session?.user?.email || "My Character";
  const avatar = meta.character_image_url || "/placeholder.png";

  return (
    <div className="container my-4">
      {/* Character header */}
      <div className="card mb-4">
        <div className="card-body d-flex align-items-center gap-3 flex-wrap">
          <div className="rounded-circle overflow-hidden" style={{ width: 88, height: 88 }}>
            <img src={avatar} alt="Character" className="img-fluid object-fit-cover" />
          </div>
          <div className="flex-grow-1">
            <h1 className="h4 m-0">{name}</h1>
            <form className="row g-2 mt-2" onSubmit={saveMeta}>
              <div className="col-12 col-md-4">
                <input className="form-control" placeholder="Character Name"
                  value={meta.character_name} onChange={(e)=>setMeta(m=>({...m, character_name:e.target.value}))}/>
              </div>
              <div className="col-12 col-md-6">
                <input className="form-control" placeholder="Image URL"
                  value={meta.character_image_url} onChange={(e)=>setMeta(m=>({...m, character_image_url:e.target.value}))}/>
              </div>
              <div className="col-12 col-md-2 d-grid">
                <button className="btn btn-outline-primary" disabled={saving}>{saving?"Saving…":"Save"}</button>
              </div>
              {err && <div className="col-12"><div className="alert alert-danger py-2 m-0">{err}</div></div>}
            </form>
          </div>

          {isAdmin && (
            <div className="ms-auto">
              <label className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input me-2"
                  checked={showAll}
                  onChange={(e)=>setShowAll(e.target.checked)}
                />
                <span className="form-check-label">Show all players’ items (admin)</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Trade requests */}
      <h2 className="h5 mb-3">Trade Requests</h2>
      <div className="mb-4">
        <TradeRequestsPanel />
      </div>

      {/* Inventory */}
      <h2 className="h5 mb-3">My Inventory</h2>
      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-muted fst-italic">No items yet.</div>
      ) : (
        <div className="row g-3">
          {items.map((it) => (
            <div key={it.id} className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex">
              <div className="w-100 d-flex flex-column">
                <ItemCard item={it} />
                <div className="mt-2 d-flex justify-content-between">
                  {/* Remove (owner OR admin) */}
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => removeRow(it.id)}
                    disabled={busyId === it.id}
                    title="Remove from inventory"
                  >
                    {busyId === it.id ? "Removing…" : "Remove"}
                  </button>

                  {/* Trade */}
                  <OfferTradeButton row={{ id: it.id, item_name: it.item_name, name: it.name }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

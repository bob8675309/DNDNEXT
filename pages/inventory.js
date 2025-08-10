// /pages/inventory.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import ItemCard from "@/components/ItemCard";
import OfferTradeButton from "@/components/OfferTradeButton";
import TradeRequestsPanel from "@/components/TradeRequestsPanel";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function InventoryPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ character_name: "", character_image_url: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let unsub;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sess = data.session;
      if (!sess) { router.replace("/login"); return; }
      setSession(sess);
      setMeta({
        character_name: sess.user.user_metadata?.character_name || "",
        character_image_url: sess.user.user_metadata?.character_image_url || "",
      });
      await load(sess.user.id);

      const ch = supabase
        .channel("inv-self")
        .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items", filter: `user_id=eq.${sess.user.id}` }, () => load(sess.user.id))
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
    if (!error) setItems(data || []);
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
          {items.map((row) => (
            <div key={row.id} className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex">
              <div className="w-100 d-flex flex-column">
                <ItemCard item={row} />
                <div className="mt-2 d-flex justify-content-end">
                  <OfferTradeButton row={row} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

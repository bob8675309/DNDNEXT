// /pages/inventory.js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import ItemCard from "@/components/ItemCard";
import OfferTradeButton from "@/components/OfferTradeButton";
import TradeRequestsPanel from "@/components/TradeRequestsPanel";
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

  // admin selector
  const [isAdmin, setIsAdmin] = useState(false);
  const [targetUser, setTargetUser] = useState(null); // whose inventory we’re looking at
  const [users, setUsers] = useState([]);

  const { label: walletLabel, setAmount, addAmount, isAdmin: hookSaysAdmin } = useWallet(targetUser);

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

      // role & admin dropdown
      const prof = await supabase.from("user_profiles").select("role").eq("id", sess.user.id).maybeSingle();
      const admin = (prof.data?.role || "player") !== "player";
      setIsAdmin(admin);
      if (admin) {
        const up = await supabase.from("user_profiles").select("id, role");
        setUsers((up.data || []).map((u) => ({ id: u.id, role: u.role })));
        setTargetUser(sess.user.id);
      }

      await load(sess.user.id, sess.user.id);

      const ch = supabase
        .channel("inv-self")
        .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, () => load(sess.user.id, targetUser || sess.user.id))
        .subscribe();
      unsub = () => supabase.removeChannel(ch);
    })();
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUser]);

  async function load(selfId, viewingId) {
    setLoading(true);
    const uid = viewingId || selfId;
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (!error) setRows(data || []);
    setLoading(false);
  }

  async function saveMeta(e) {
    e?.preventDefault();
    setSaving(true); setErr("");
    try {
      const { error } = await supabase.auth.updateUser({
        data: { character_name: meta.character_name || "", character_image_url: meta.character_image_url || "" },
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
          <div className="rounded-circle overflow-hidden" style={{ width: 64, height: 64 }}>
            <img src={avatar} alt="Character" className="img-fluid object-fit-cover" />
          </div>
          <div className="flex-grow-1">
            <div className="d-flex align-items-center gap-2">
              <h1 className="h5 m-0">{name}</h1>
              <span className="badge bg-secondary">{walletLabel}</span>
            </div>
            <form className="row g-2 mt-2" onSubmit={saveMeta}>
              <div className="col-12 col-md-4">
                <input className="form-control" placeholder="Character Name" value={meta.character_name} onChange={(e)=>setMeta(m=>({...m, character_name:e.target.value}))}/>
              </div>
              <div className="col-12 col-md-6">
                <input className="form-control" placeholder="Image URL" value={meta.character_image_url} onChange={(e)=>setMeta(m=>({...m, character_image_url:e.target.value}))}/>
              </div>
              <div className="col-12 col-md-2 d-grid">
                <button className="btn btn-outline-primary" disabled={saving}>{saving?"Saving…":"Save"}</button>
              </div>
              {err && <div className="col-12"><div className="alert alert-danger py-2 m-0">{err}</div></div>}
            </form>
          </div>

          {/* Admin tools */}
          {isAdmin && (
            <div className="ms-auto d-flex align-items-center gap-2">
              <select className="form-select" style={{ minWidth: 260 }} value={targetUser || ""} onChange={(e)=>setTargetUser(e.target.value)}>
                {(users||[]).map(u => <option key={u.id} value={u.id}>{u.id.slice(0,8)}… ({u.role})</option>)}
              </select>
              <div className="input-group" style={{ maxWidth: 260 }}>
                <span className="input-group-text">±gp</span>
                <input id="gpDelta" type="number" className="form-control" defaultValue={0} />
                <button className="btn btn-outline-secondary" onClick={async()=>{
                  const v = Number(document.getElementById("gpDelta").value || 0);
                  await addAmount(v, targetUser);
                }}>Apply</button>
              </div>
              <div className="input-group" style={{ maxWidth: 260 }}>
                <span className="input-group-text">set</span>
                <input id="gpSet" type="number" className="form-control" placeholder="amount or -1" />
                <button className="btn btn-outline-secondary" onClick={async()=>{
                  const v = Number(document.getElementById("gpSet").value);
                  if (Number.isFinite(v)) await setAmount(v, targetUser);
                }}>Go</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trade requests */}
      <h2 className="h6 mb-3">Trade Requests</h2>
      <div className="mb-4"><TradeRequestsPanel /></div>

      {/* Inventory */}
      <h2 className="h6 mb-3">Inventory</h2>
      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-muted fst-italic">No items yet.</div>
      ) : (
        <div className="row g-3">
          {rows.map((row) => (
            <div key={row.id} className="col-6 col-md-4 col-lg-3 d-flex">
              <div className="w-100 d-flex flex-column">
                <div className="card-compact">
                  <ItemCard item={row} />
                </div>
                <div className="mt-2 d-flex justify-content-between">
                  <OfferTradeButton row={row} />
                  <button className="btn btn-sm btn-outline-danger" onClick={async()=>{
                    if (!confirm("Delete this item?")) return;
                    await supabase.from("inventory_items").delete().eq("id", row.id);
                  }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
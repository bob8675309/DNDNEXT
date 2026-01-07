// /pages/inventory.js
// Updated inventory page to support inventories for players, NPCs, and merchants.
// Inventory ownership is determined via query parameters ownerType and ownerId.
// Players can manage their own inventory; admins can view NPC/merchant inventories and transfer items.
// Equipped items are highlighted and can be toggled on/off.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import ItemCard from "@/components/ItemCard";
import OfferTradeButton from "@/components/OfferTradeButton";
import TradeRequestsPanel from "@/components/TradeRequestsPanel";
import useWallet from "@/utils/useWallet";

// Initialize Supabase client from env vars
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Helper to parse bonus strings like "+1" into numbers
function parseBonus(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const m = v.match(/-?\d+/);
    return m ? parseInt(m[0], 10) : 0;
  }
  return 0;
}

export default function InventoryPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [ownerType, setOwnerType] = useState("player");
  const [ownerId, setOwnerId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ character_name: "", character_image_url: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [players, setPlayers] = useState([]);

  // wallet hook is only used for player inventories
  const { label: walletLabel, setAmount, addAmount, isAdmin: hookAdmin } = useWallet(ownerId);

  // Parse query parameters on mount and when they change
  useEffect(() => {
    const q = router.query || {};
    const type = typeof q.ownerType === "string" ? q.ownerType : "player";
    const id = typeof q.ownerId === "string" ? q.ownerId : null;
    const fId = typeof q.focus === "string" ? q.focus : null;
    setOwnerType(type);
    setOwnerId(id);
    setFocusId(fId);
  }, [router.query]);

  // Load session and basic metadata
  useEffect(() => {
    let unsub;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sess = data.session;
      if (!sess) {
        // Not logged in; redirect to login
        router.replace("/login");
        return;
      }
      setSession(sess);
      // Determine admin status
      const prof = await supabase.from("user_profiles").select("role").eq("id", sess.user.id).maybeSingle();
      const admin = (prof.data?.role || "player") !== "player";
      setIsAdmin(admin);
      // Set default ownerId to user for players
      if (!ownerId) setOwnerId(sess.user.id);
      // Load players list for admin transfers
      if (admin) {
        const { data: p } = await supabase.from("players").select("user_id,name").order("name");
        setPlayers(p || []);
      }
      // Load character meta for player inventories
      setMeta({
        character_name: sess.user.user_metadata?.character_name || "",
        character_image_url: sess.user.user_metadata?.character_image_url || "",
      });
      // Load inventory items
      await loadInventory(sess.user.id);
      // Subscribe to changes
      const ch = supabase
        .channel("inventory-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "inventory_items" },
          () => loadInventory(sess.user.id)
        )
        .subscribe();
      unsub = () => supabase.removeChannel(ch);
    })();
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerType, ownerId]);

  // Reload inventory when focus changes (smooth scroll will happen in child component)
  useEffect(() => {
    // When focus changes, setFocusId again to trigger highlight
    const fid = typeof router.query.focus === "string" ? router.query.focus : null;
    setFocusId(fid);
  }, [router.query.focus]);

  async function loadInventory(selfId) {
    if (!ownerId) return;
    setLoading(true);
    // Determine owner id and type; fallback to current user for player
    const type = ownerType || "player";
    const id = ownerId || selfId;
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("owner_type", type)
      .eq("owner_id", id)
      .order("created_at", { ascending: false });
    if (!error) setRows(data || []);
    setLoading(false);
  }

  // Save character meta for players
  async function saveMeta(e) {
    e?.preventDefault();
    setSaving(true);
    setErr("");
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

  // Toggle equip/unequip state for an item
  async function toggleEquipped(rowId, nextVal) {
    const { error } = await supabase
      .from("inventory_items")
      .update({ is_equipped: nextVal })
      .eq("id", rowId);
    if (error) console.error("toggleEquipped", error);
  }

  // Admin transfer: move item to a player. Resets equip and sets owner/user accordingly.
  async function transferToPlayer(rowId, targetPlayerId) {
    if (!targetPlayerId) return;
    const { error } = await supabase
      .from("inventory_items")
      .update({
        owner_type: "player",
        owner_id: targetPlayerId,
        user_id: targetPlayerId,
        is_equipped: false,
      })
      .eq("id", rowId);
    if (error) console.error("transferToPlayer", error);
  }

  // Determine whether the viewer owns the inventory (player) or is admin
  const isOwnInventory = useMemo(() => {
    if (!session) return false;
    return ownerType === "player" && ownerId === session.user.id;
  }, [session, ownerType, ownerId]);

  const showTrade = isOwnInventory;

  // Name/avatar display for player inventories
  const displayName = meta.character_name || session?.user?.email || "My Character";
  const avatar = meta.character_image_url || "/placeholder.png";

  return (
    <div className="container my-4">
      {/* Header: only show character edit for player inventories */}
      <div className="card mb-4">
        <div className="card-body d-flex align-items-center gap-3 flex-wrap">
          <div className="rounded-circle overflow-hidden" style={{ width: 64, height: 64 }}>
            <img src={avatar} alt="Character" className="img-fluid object-fit-cover" />
          </div>
          <div className="flex-grow-1">
            <div className="d-flex align-items-center gap-2">
              <h1 className="h5 m-0">{displayName}</h1>
              {ownerType === "player" && <span className="badge bg-secondary">{walletLabel}</span>}
            </div>
            {isOwnInventory && (
              <form className="row g-2 mt-2" onSubmit={saveMeta}>
                <div className="col-12 col-md-4">
                  <input
                    className="form-control"
                    placeholder="Character Name"
                    value={meta.character_name}
                    onChange={(e) => setMeta((m) => ({ ...m, character_name: e.target.value }))}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <input
                    className="form-control"
                    placeholder="Image URL"
                    value={meta.character_image_url}
                    onChange={(e) => setMeta((m) => ({ ...m, character_image_url: e.target.value }))}
                  />
                </div>
                <div className="col-12 col-md-2 d-grid">
                  <button className="btn btn-outline-primary" disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
                {err && (
                  <div className="col-12">
                    <div className="alert alert-danger py-2 m-0">{err}</div>
                  </div>
                )}
              </form>
            )}
          </div>
          {/* Admin controls for player inventories */}
          {isOwnInventory && isAdmin && (
            <div className="ms-auto d-flex align-items-center gap-2">
              <select
                className="form-select"
                style={{ minWidth: 260 }}
                value={ownerId || ""}
                onChange={(e) => setOwnerId(e.target.value)}
              >
                {(players || []).map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.user_id.slice(0, 8)}… ({p.name})
                  </option>
                ))}
              </select>
              <div className="input-group" style={{ maxWidth: 260 }}>
                <span className="input-group-text">±gp</span>
                <input id="gpDelta" type="number" className="form-control" defaultValue={0} />
                <button
                  className="btn btn-outline-secondary"
                  onClick={async () => {
                    const v = Number(document.getElementById("gpDelta").value || 0);
                    await addAmount(v, ownerId);
                  }}
                >
                  Apply
                </button>
              </div>
              <div className="input-group" style={{ maxWidth: 260 }}>
                <span className="input-group-text">set</span>
                <input id="gpSet" type="number" className="form-control" placeholder="amount or -1" />
                <button
                  className="btn btn-outline-secondary"
                  onClick={async () => {
                    const v = Number(document.getElementById("gpSet").value);
                    if (Number.isFinite(v)) await setAmount(v, ownerId);
                  }}
                >
                  Go
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trade requests only for player inventories */}
      {showTrade && (
        <>
          <h2 className="h6 mb-3">Trade Requests</h2>
          <div className="mb-4">
            <TradeRequestsPanel />
          </div>
        </>
      )}

      {/* Inventory items list */}
      <h2 className="h6 mb-3">Inventory</h2>
      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-muted fst-italic">No items yet.</div>
      ) : (
        <div className="row g-3">
          {rows.map((row) => {
            const isFocus = focusId && row.id === focusId;
            return (
              <div
                key={row.id}
                className="col-6 col-md-4 col-lg-3 d-flex"
                style={isFocus ? { outline: "2px solid rgba(255,255,255,0.65)", boxShadow: "0 0 0 3px rgba(120,70,200,0.35)", borderRadius: "12px" } : {}}
              >
                <div className="w-100 d-flex flex-column">
                  <div className="card-compact">
                    <ItemCard item={{ ...row.card_payload, card_payload: row.card_payload, _invRow: row }} />
                  </div>
                  <div className="mt-2 d-flex flex-wrap gap-1">
                    {/* Equip toggle for any inventory */}
                    <button
                      className={`btn btn-sm ${row.is_equipped ? "btn-success" : "btn-outline-light"}`}
                      onClick={() => toggleEquipped(row.id, !row.is_equipped)}
                    >
                      {row.is_equipped ? "Equipped" : "Equip"}
                    </button>
                    {/* Trade button only for player-owned items */}
                    {showTrade && <OfferTradeButton row={row} />}
                    {/* Delete button only for player-owned items */}
                    {showTrade && (
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={async () => {
                          if (!confirm("Delete this item?")) return;
                          await supabase.from("inventory_items").delete().eq("id", row.id);
                        }}
                      >
                        Delete
                      </button>
                    )}
                    {/* Admin transfer: show when viewing NPC/merchant inventory */}
                    {!showTrade && isAdmin && ownerType !== "player" && (
                      <div className="d-flex gap-1 align-items-center">
                        <select
                          className="form-select form-select-sm"
                          style={{ minWidth: 160 }}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) transferToPlayer(row.id, val);
                          }}
                          defaultValue=""
                        >
                          <option value="">Transfer…</option>
                          {(players || []).map((p) => (
                            <option key={p.user_id} value={p.user_id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
// Unified inventory page supporting inventories for players, NPCs and merchants.
// The inventory owner is specified via query parameters `ownerType` and `ownerId`.
// Owner types: 'player' (default), 'npc', 'merchant'.
//
//
// Access control:
// - players can view/manage their own inventory
// - admins can view/manage any
// - players with entries in `npc_permissions` may view/manage NPC inventories depending on flags
// - merchants are admin-only unless you extend permissions.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import ItemCard from "@/components/ItemCard";
import OfferTradeButton from "@/components/OfferTradeButton";
import TradeRequestsPanel from "@/components/TradeRequestsPanel";
import useWallet from "@/utils/useWallet";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function InventoryPage() {
  const router = useRouter();
  const { isReady, query } = router;

  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [ownerType, setOwnerType] = useState("player");
  const [ownerId, setOwnerId] = useState(null);
  const [focusId, setFocusId] = useState(null);

  const [ownerMeta, setOwnerMeta] = useState(null);

  const [canView, setCanView] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const [rows, setRows] = useState([]);
  const [loadingInv, setLoadingInv] = useState(true);

  const [players, setPlayers] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  // Bulk selection / move (admin only, non-player inventories)
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkTargetPlayerId, setBulkTargetPlayerId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const { label: walletLabel } = useWallet(ownerId);

  const isOwnInventory = useMemo(() => {
    return ownerType === "player" && session && ownerId === session.user.id;
  }, [ownerType, ownerId, session]);

  const showTradePanel = isOwnInventory;

  const canBulkMove = useMemo(() => {
    return isAdmin && ownerType !== "player";
  }, [isAdmin, ownerType]);

  const allRowIds = useMemo(() => rows.map((r) => r.id), [rows]);

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return Array.from(s);
    });
  }

  function selectAll() {
    setSelectedIds(allRowIds);
  }

  function clearSelection() {
    setSelectedIds([]);
    setBulkTargetPlayerId("");
  }

  // Load session + admin flag
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sess = data?.session;
      if (!sess) {
        router.replace("/login");
        return;
      }
      if (!mounted) return;

      setSession(sess);

      const { data: prof } = await supabase.from("user_profiles").select("role").eq("id", sess.user.id).maybeSingle();
      const admin = (prof?.role || "player") !== "player";
      setIsAdmin(admin);

      if (admin) {
        const { data: p } = await supabase.from("players").select("user_id,name").order("name");
        setPlayers(p || []);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parse query params
  useEffect(() => {
    if (!isReady) return;

    const { ownerType: oType, ownerId: oId, focus } = query;

    const type = typeof oType === "string" ? oType : "player";
    setOwnerType(type);

    const id = typeof oId === "string" ? oId : null;
    setOwnerId(id);

    setFocusId(typeof focus === "string" ? focus : null);
  }, [isReady, query]);

  // Default to own inventory if /inventory has no params
  useEffect(() => {
    if (!session) return;
    if (!isReady) return;

    if ((ownerType === "player" || !ownerType) && !ownerId) {
      setOwnerType("player");
      setOwnerId(session.user.id);
    }
  }, [session, isReady, ownerType, ownerId]);

  // Reset selection when inventory owner changes
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerType, ownerId]);

  // Load owner meta + permissions
  useEffect(() => {
    if (!session || !ownerType || ownerId == null) return;

    let cancelled = false;

    async function loadOwnerAndPermissions() {
      setOwnerMeta(null);
      setCanView(false);
      setCanManage(false);
      setErrorMsg("");

      let view = false;
      let manage = false;
      let meta = { name: "", subtitle: "", imageUrl: "", backHref: null };

      try {
        if (ownerType === "player") {
          if (ownerId === session.user.id) {
            view = true;
            manage = true;
            meta.name = session.user.user_metadata?.character_name || "Character";
            meta.subtitle = session.user.email || "";
            meta.imageUrl = session.user.user_metadata?.character_image_url || "/placeholder.png";
          } else if (isAdmin) {
            view = true;
            manage = true;
            const { data: player } = await supabase.from("players").select("name").eq("user_id", ownerId).maybeSingle();
            meta.name = player?.name || ownerId;
            meta.subtitle = "Player";
            meta.imageUrl = "/placeholder.png";
          }
        } else if (ownerType === "npc") {
          const { data: npc } = await supabase
            .from("npcs")
            .select("id,name,race,role,affiliation,location_id")
            .eq("id", ownerId)
            .maybeSingle();

          if (npc) {
            meta.name = npc.name || ownerId;
            const extras = [];
            if (npc.race) extras.push(npc.race);
            if (npc.role) extras.push(npc.role);
            if (npc.affiliation) extras.push(npc.affiliation);

            if (npc.location_id) {
              const { data: loc } = await supabase.from("locations").select("name").eq("id", npc.location_id).maybeSingle();
              if (loc?.name) extras.push(loc.name);
            }

            meta.subtitle = extras.join(" • ");
            meta.imageUrl = "/placeholder.png";

            // Return to NPC page focused on this NPC (supports "npc:<id>")
            meta.backHref = `/npcs?focus=${encodeURIComponent(`npc:${ownerId}`)}`;
          }

          if (isAdmin) {
            view = true;
            manage = true;
          } else {
            const { data: perm } = await supabase
              .from("npc_permissions")
              .select("can_inventory,can_edit")
              .eq("npc_id", ownerId)
              .eq("user_id", session.user.id)
              .maybeSingle();

            const canInv = perm?.can_inventory || false;
            const canEdit = perm?.can_edit || false;

            view = canInv || canEdit;
            manage = canEdit;
          }
        } else if (ownerType === "merchant") {
          const { data: mer } = await supabase
            .from("merchants")
            .select("id,name,location_id,state")
            .eq("id", ownerId)
            .maybeSingle();

          if (mer) {
            meta.name = mer.name || ownerId;
            const extras = [];
            if (mer.state) extras.push(mer.state);

            if (mer.location_id) {
              const { data: loc } = await supabase.from("locations").select("name").eq("id", mer.location_id).maybeSingle();
              if (loc?.name) extras.push(loc.name);
            }

            meta.subtitle = extras.join(" • ");
            meta.imageUrl = "/placeholder.png";

            meta.backHref = `/npcs?focus=${encodeURIComponent(`merchant:${ownerId}`)}`;
          }

          if (isAdmin) {
            view = true;
            manage = true;
          } else {
            view = false;
            manage = false;
          }
        }
      } catch (err) {
        setErrorMsg(err?.message || "Error loading inventory");
      }

      if (!cancelled) {
        setOwnerMeta(meta);
        setCanView(view);
        setCanManage(manage);
      }
    }

    loadOwnerAndPermissions();

    return () => {
      cancelled = true;
    };
  }, [session, ownerType, ownerId, isAdmin]);

  // Load inventory
  useEffect(() => {
    if (!canView || !ownerType || ownerId == null) {
      setRows([]);
      setLoadingInv(false);
      return;
    }

    let cancelled = false;

    async function fetchInventory() {
      setLoadingInv(true);

      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("owner_type", ownerType)
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setErrorMsg(error.message || "Error loading inventory");
        setRows([]);
      } else {
        setRows(data || []);
      }

      setLoadingInv(false);
    }

    fetchInventory();

    // Realtime: filter only by owner_id (supabase realtime filter supports single condition reliably)
    const channel = supabase
      .channel(`inventory-changes-${ownerType}-${ownerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_items", filter: `owner_id=eq.${ownerId}` },
        (payload) => {
          const tNew = payload?.new?.owner_type;
          const tOld = payload?.old?.owner_type;

          // only refresh for this owner_type
          if (tNew === ownerType || tOld === ownerType) fetchInventory();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [canView, ownerType, ownerId]);

  async function toggleEquipped(rowId, nextVal) {
    if (!canManage && !(isOwnInventory && ownerType === "player")) return;

    const { error } = await supabase.from("inventory_items").update({ is_equipped: nextVal }).eq("id", rowId);
    if (error) console.error("toggleEquipped", error);
  }

  async function transferToPlayer(rowId, targetPlayerId) {
    if (!isAdmin || !targetPlayerId) return;

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

  async function transferSelectedToPlayer() {
    if (!canBulkMove) return;
    if (!bulkTargetPlayerId) return;
    if (!selectedIds || selectedIds.length === 0) return;

    if (!confirm(`Move ${selectedIds.length} item(s) to the selected player?`)) return;

    setBulkBusy(true);
    try {
      const { error } = await supabase
        .from("inventory_items")
        .update({
          owner_type: "player",
          owner_id: bulkTargetPlayerId,
          user_id: bulkTargetPlayerId,
          is_equipped: false,
        })
        .in("id", selectedIds);

      if (error) throw error;

      clearSelection();
    } catch (e) {
      console.error("transferSelectedToPlayer", e);
      setErrorMsg(String(e?.message || e || "Failed to move selected items."));
    } finally {
      setBulkBusy(false);
    }
  }

  async function deleteItem(rowId) {
    if (!canManage && !(isOwnInventory && ownerType === "player")) return;
    if (!confirm("Delete this item?")) return;

    const { error } = await supabase.from("inventory_items").delete().eq("id", rowId);
    if (error) console.error("deleteItem", error);
  }

  return (
    <div className="container my-4">
      {ownerMeta && (
        <div className="card mb-4">
          <div className="card-body d-flex align-items-center gap-3 flex-wrap">
            <div className="rounded-circle overflow-hidden" style={{ width: 64, height: 64 }}>
              <img src={ownerMeta.imageUrl || "/placeholder.png"} alt="Avatar" className="img-fluid object-fit-cover" />
            </div>

            <div className="flex-grow-1">
              <div className="d-flex align-items-center gap-2">
                <h1 className="h5 m-0">{ownerMeta.name || "Inventory"}</h1>
                {ownerType === "player" && isOwnInventory && <span className="badge bg-secondary">{walletLabel}</span>}
              </div>
              {ownerMeta.subtitle && <div className="text-muted small">{ownerMeta.subtitle}</div>}
            </div>

            {ownerMeta.backHref && (
              <a className="btn btn-sm btn-outline-light ms-auto" href={ownerMeta.backHref}>
                &larr; Back
              </a>
            )}
          </div>
        </div>
      )}

      {!canView && <div className="alert alert-warning">You do not have permission to view this inventory.</div>}

      {showTradePanel && (
        <>
          <h2 className="h6 mb-3">Trade Requests</h2>
          <div className="mb-4">
            <TradeRequestsPanel />
          </div>
        </>
      )}

      {canView && (
        <>
          <h2 className="h6 mb-3">Inventory</h2>

          {canBulkMove && rows.length > 0 && (
            <div className="card mb-3">
              <div className="card-body d-flex align-items-center gap-2 flex-wrap">
                <div className="small text-muted">Selected: {selectedIds.length}</div>

                <button type="button" className="btn btn-sm btn-outline-light" onClick={selectAll}>
                  Select all
                </button>
                <button type="button" className="btn btn-sm btn-outline-light" onClick={clearSelection}>
                  Clear
                </button>

                <div className="ms-auto d-flex align-items-center gap-2 flex-wrap">
                  <select
                    className="form-select form-select-sm"
                    style={{ minWidth: 200 }}
                    value={bulkTargetPlayerId}
                    onChange={(e) => setBulkTargetPlayerId(e.target.value)}
                  >
                    <option value="">Move selected to…</option>
                    {players.map((p) => (
                      <option key={p.user_id} value={p.user_id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={bulkBusy || !bulkTargetPlayerId || selectedIds.length === 0}
                    onClick={transferSelectedToPlayer}
                    title="Moves selected gear items to the chosen player (removes from this inventory)"
                  >
                    {bulkBusy ? "Moving…" : "Move"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loadingInv ? (
            <div className="text-muted">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-muted fst-italic">No items yet.</div>
          ) : (
            <div className="row g-3">
              {rows.map((row) => {
                const isFocus = focusId && row.id === focusId;
                const payload = row.card_payload || {};
                const isSelected = selectedIds.includes(row.id);

                return (
                  <div
                    key={row.id}
                    className="col-6 col-md-4 col-lg-3 d-flex"
                    style={
                      isFocus
                        ? {
                            outline: "2px solid rgba(255,255,255,0.65)",
                            boxShadow: "0 0 0 3px rgba(120,70,200,0.35)",
                            borderRadius: "12px",
                          }
                        : {}
                    }
                  >
                    <div className="w-100 d-flex flex-column">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        {canBulkMove ? (
                          <label className="small text-muted d-flex align-items-center gap-2" style={{ cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              className="form-check-input m-0"
                              checked={isSelected}
                              onChange={() => toggleSelected(row.id)}
                            />
                            Select
                          </label>
                        ) : (
                          <span />
                        )}

                        {row.is_equipped ? <span className="badge bg-success">Equipped</span> : null}
                      </div>

                      <div className="card-compact">
                        <ItemCard item={{ ...payload, card_payload: payload, _invRow: row }} />
                      </div>

                      <div className="mt-2 d-flex flex-wrap gap-1">
                        {(isOwnInventory || canManage) && (
                          <button
                            className={`btn btn-sm ${row.is_equipped ? "btn-success" : "btn-outline-light"}`}
                            onClick={() => toggleEquipped(row.id, !row.is_equipped)}
                          >
                            {row.is_equipped ? "Equipped" : "Equip"}
                          </button>
                        )}

                        {isOwnInventory && <OfferTradeButton row={row} />}

                        {(isOwnInventory || canManage) && (
                          <button className="btn btn-sm btn-outline-danger" onClick={() => deleteItem(row.id)}>
                            Delete
                          </button>
                        )}

                        {isAdmin && ownerType !== "player" && (
                          <select
                            className="form-select form-select-sm"
                            style={{ minWidth: 160 }}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) transferToPlayer(row.id, val);
                            }}
                            defaultValue=""
                          >
                            <option value="">Move…</option>
                            {players.map((p) => (
                              <option key={p.user_id} value={p.user_id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {errorMsg && <div className="alert alert-danger mt-3">{errorMsg}</div>}
    </div>
  );
}

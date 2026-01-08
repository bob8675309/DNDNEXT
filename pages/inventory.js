// pages/inventory.js
// Unified inventory page supporting inventories for players, NPCs and merchants.
// The inventory owner is specified via query parameters `ownerType` and `ownerId`.
// Owner types: 'player' (default), 'npc', 'merchant'.
// The page loads the appropriate inventory and displays the owner's name and extra info.
// Access control: players can view/manage their own inventory; admins can view/manage any; players
// with entries in `npc_permissions` may view or manage NPC inventories depending on can_inventory
// and can_edit flags. Merchants are admin-only unless you extend permissions.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import ItemCard from "@/components/ItemCard";
import OfferTradeButton from "@/components/OfferTradeButton";
import TradeRequestsPanel from "@/components/TradeRequestsPanel";
import useWallet from "@/utils/useWallet";

// Supabase client initialized once at module scope. Creating a new client on every render
// can lead to multiple GoTrueClient instances. Use env vars defined in Next.js runtime.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * InventoryPage component.
 * Displays the contents of an inventory belonging to a player, NPC or merchant.
 * URL parameters:
 *   ownerType: 'player' | 'npc' | 'merchant'
 *   ownerId:   string identifier of the owner (user id, npc id, merchant id)
 *   focus:     optional inventory_item row id to highlight
 */
export default function InventoryPage() {
  const router = useRouter();
  const { isReady, query } = router;

  // Auth session for current user
  const [session, setSession] = useState(null);
  // Viewer admin status
  const [isAdmin, setIsAdmin] = useState(false);
  // Owner identifiers derived from URL
  const [ownerType, setOwnerType] = useState("player");
  const [ownerId, setOwnerId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  // Owner metadata (name, extra info, image and back link)
  const [ownerMeta, setOwnerMeta] = useState(null);
  // Permissions
  const [canView, setCanView] = useState(false);
  const [canManage, setCanManage] = useState(false);
  // Inventory rows
  const [rows, setRows] = useState([]);
  const [loadingInv, setLoadingInv] = useState(true);
  // List of players (for admin transfers)
  const [players, setPlayers] = useState([]);
  // Local error message
  const [errorMsg, setErrorMsg] = useState("");

  // Wallet hook; used only for player inventories (ownerType === 'player' && viewer is owner)
  const { label: walletLabel, setAmount, addAmount } = useWallet(ownerId);

  // Load authenticated session and determine admin status on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sess = data?.session;
      if (!sess) {
        // Redirect to login if not authenticated
        router.replace("/login");
        return;
      }
      if (!mounted) return;
      setSession(sess);
      // Determine if viewer is an admin via user_profiles table
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", sess.user.id)
        .maybeSingle();
      const admin = (prof?.role || "player") !== "player";
      setIsAdmin(admin);
      // Preload list of players for admin transfers
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

  // Parse URL query params when ready
  useEffect(() => {
    if (!isReady) return;
    const { ownerType: oType, ownerId: oId, focus } = query;
    // Use provided params; fallback to player type and current user id if none provided
    const type = typeof oType === "string" ? oType : "player";
    setOwnerType(type);
    const id = typeof oId === "string" ? oId : null;
    setOwnerId(id);
    setFocusId(typeof focus === "string" ? focus : null);
  }, [isReady, query]);

  /**
   * Load owner metadata (name, extra) and permission flags.
   * Also determines whether viewer can view/manage this inventory.
   */
  useEffect(() => {
    if (!session || !ownerType || ownerId == null) return;
    let cancelled = false;
    async function loadOwnerAndPermissions() {
      setOwnerMeta(null);
      setCanView(false);
      setCanManage(false);
      setErrorMsg("");
      // Default: no view/manage
      let view = false;
      let manage = false;
      let meta = { name: "", subtitle: "", imageUrl: "", backHref: null };
      try {
        if (ownerType === "player") {
          // Player inventory: allow if ownerId matches session user or admin
          if (ownerId) {
            if (ownerId === session.user.id) {
              view = true;
              manage = true;
              // Use session metadata for own character
              meta.name = session.user.user_metadata?.character_name || "Character";
              meta.subtitle = session.user.email || "";
              meta.imageUrl = session.user.user_metadata?.character_image_url || "/placeholder.png";
            } else if (isAdmin) {
              // Admin can view/manage other player inventories
              view = true;
              manage = true;
              // Load player row for display
              const { data: player } = await supabase
                .from("players")
                .select("name")
                .eq("user_id", ownerId)
                .maybeSingle();
              meta.name = player?.name || ownerId;
              meta.subtitle = "Player";
              meta.imageUrl = "/placeholder.png";
            }
          }
        } else if (ownerType === "npc") {
          // NPC inventory: check permissions
          // Load NPC meta
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
            // If NPC is at a location, load location name
            if (npc.location_id) {
              const { data: loc } = await supabase
                .from("locations")
                .select("name")
                .eq("id", npc.location_id)
                .maybeSingle();
              if (loc?.name) extras.push(loc.name);
            }
            meta.subtitle = extras.join(" • ");
            meta.imageUrl = "/placeholder.png";
            // Provide back link to NPC roster with focus on this NPC
            meta.backHref = `/npcs?focus=npc:${ownerId}`;
          }
          // Permission: admin always; else check npc_permissions
          if (isAdmin) {
            view = true;
            manage = true;
          } else {
            // Query npc_permissions table for this npc and current user
            const { data: perm } = await supabase
              .from("npc_permissions")
              .select("can_inventory,can_edit")
              .eq("npc_id", ownerId)
              .eq("user_id", session.user.id)
              .maybeSingle();
            const canInv = perm?.can_inventory || false;
            const canEdit = perm?.can_edit || false;
            // can_edit implies view per user instruction
            view = canInv || canEdit;
            manage = canEdit;
          }
        } else if (ownerType === "merchant") {
          // Merchant inventory: restricted to admins; display merchant name
          const { data: mer } = await supabase
            .from("merchants")
            .select("id,name,location_id,state")
            .eq("id", ownerId)
            .maybeSingle();
          if (mer) {
            meta.name = mer.name || ownerId;
            const extras = [];
            if (mer.state) extras.push(mer.state);
            // Try to load location name
            if (mer.location_id) {
              const { data: loc } = await supabase
                .from("locations")
                .select("name")
                .eq("id", mer.location_id)
                .maybeSingle();
              if (loc?.name) extras.push(loc.name);
            }
            meta.subtitle = extras.join(" • ");
            meta.imageUrl = "/placeholder.png";
            meta.backHref = `/npcs?focus=merchant:${ownerId}`;
          }
          // Only admins can view/manage merchants for now; extend as needed
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

  // Load inventory when viewer is allowed to view
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
      if (!cancelled) {
        if (error) {
          setErrorMsg(error.message || "Error loading inventory");
          setRows([]);
        } else {
          setRows(data || []);
        }
        setLoadingInv(false);
      }
    }
    fetchInventory();
    // Listen for inventory changes for this owner
    const channel = supabase
      .channel(`inventory-changes-${ownerType}-${ownerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_items", filter: `owner_type=eq.${ownerType},owner_id=eq.${ownerId}` },
        (payload) => {
          // Refresh on any change for this owner
          fetchInventory();
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [canView, ownerType, ownerId]);

  // Convenience flags
  const isOwnInventory = useMemo(() => {
    return ownerType === "player" && session && ownerId === session.user.id;
  }, [ownerType, ownerId, session]);

  const showTradePanel = isOwnInventory;

  // Handler to toggle equipped state
  async function toggleEquipped(rowId, nextVal) {
    // Anyone who can manage can equip/unequip; players can always equip their own items
    if (!canManage && !(isOwnInventory && ownerType === "player")) return;
    const { error } = await supabase
      .from("inventory_items")
      .update({ is_equipped: nextVal })
      .eq("id", rowId);
    if (error) console.error("toggleEquipped", error);
  }

  // Transfer item to a player (admin only). Used when viewing NPC/merchant inventory.
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

  // Delete item from inventory (players can remove their own items; admins can remove from any)
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
            {/* Avatar */}
            <div className="rounded-circle overflow-hidden" style={{ width: 64, height: 64 }}>
              <img
                src={ownerMeta.imageUrl || "/placeholder.png"}
                alt="Avatar"
                className="img-fluid object-fit-cover"
              />
            </div>
            {/* Name and subtitle */}
            <div className="flex-grow-1">
              <div className="d-flex align-items-center gap-2">
                <h1 className="h5 m-0">{ownerMeta.name || "Inventory"}</h1>
                {ownerType === "player" && isOwnInventory && <span className="badge bg-secondary">{walletLabel}</span>}
              </div>
              {ownerMeta.subtitle && <div className="text-muted small">{ownerMeta.subtitle}</div>}
            </div>
            {/* Back link for NPC/Merchant */}
            {ownerMeta.backHref && (
              <a className="btn btn-sm btn-outline-light ms-auto" href={ownerMeta.backHref}>
                &larr; Back
              </a>
            )}
          </div>
        </div>
      )}

      {/* Unauthorized */}
      {!canView && (
        <div className="alert alert-warning">
          You do not have permission to view this inventory.
        </div>
      )}

      {/* Trade requests for own inventory */}
      {showTradePanel && (
        <>
          <h2 className="h6 mb-3">Trade Requests</h2>
          <div className="mb-4">
            <TradeRequestsPanel />
          </div>
        </>
      )}

      {/* Inventory section */}
      {canView && (
        <>
          <h2 className="h6 mb-3">Inventory</h2>
          {loadingInv ? (
            <div className="text-muted">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-muted fst-italic">No items yet.</div>
          ) : (
            <div className="row g-3">
              {rows.map((row) => {
                const isFocus = focusId && row.id === focusId;
                const payload = row.card_payload || {};
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
                      <div className="card-compact">
                        {/* Spread card_payload to ItemCard for display */}
                        <ItemCard item={{ ...payload, card_payload: payload, _invRow: row }} />
                      </div>
                      {/* Action buttons */}
                      <div className="mt-2 d-flex flex-wrap gap-1">
                        {/* Equip toggle: available to owner or managers */}
                        {(isOwnInventory || canManage) && (
                          <button
                            className={`btn btn-sm ${row.is_equipped ? "btn-success" : "btn-outline-light"}`}
                            onClick={() => toggleEquipped(row.id, !row.is_equipped)}
                          >
                            {row.is_equipped ? "Equipped" : "Equip"}
                          </button>
                        )}
                        {/* Offer trade button: only for own player inventory */}
                        {isOwnInventory && <OfferTradeButton row={row} />}
                        {/* Delete button: own inventory or admin/managers */}
                        {(isOwnInventory || canManage) && (
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => deleteItem(row.id)}
                          >
                            Delete
                          </button>
                        )}
                        {/* Admin transfer to player: when viewing NPC/merchant and viewer is admin */}
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
                            <option value="">Transfer…</option>
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
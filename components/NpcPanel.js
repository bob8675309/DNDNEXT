/* components/NpcPanel.js */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabaseClient";
import { resolveCharacterPortrait } from "../utils/characterPortraits";
import CharacterSheetPanel from "./CharacterSheetPanel";
import ItemCard from "./ItemCard";
import { deriveEquippedItemEffects, hashEquippedRowsForKey } from "../utils/equipmentEffects";

const PROFILE_REVEAL_KEYS = [
  { key: "description", label: "Description", group: "Overview", hint: "Player-facing first impression and short profile summary.", alwaysPublic: true },
  { key: "background", label: "Background", group: "Origin & History", hint: "Where they come from; ties; history; why they matter." },
  { key: "traits", label: "Traits", group: "Personality" },
  { key: "ideals", label: "Ideals", group: "Personality" },
  { key: "bonds", label: "Bonds", group: "Personality" },
  { key: "flaws", label: "Flaws", group: "Personality" },
  { key: "motivation", label: "Motivation / Want", group: "Quick hooks" },
  { key: "quirk", label: "Personality / Quirk", group: "Quick hooks" },
  { key: "mannerism", label: "Mannerism / Voice", group: "Quick hooks" },
  { key: "secret", label: "Secret", group: "DM-only / Discovery" },
];

function locName(locations, id) {
  if (!id) return "";
  const loc = (locations || []).find((l) => String(l.id) === String(id));
  return loc?.name || "";
}

function safeStr(v) {
  return String(v ?? "").trim();
}

function deepClone(obj) {
  try {
    return structuredClone(obj ?? {});
  } catch {
    return JSON.parse(JSON.stringify(obj ?? {}));
  }
}

function pickItemName(row) {
  const payload = row?.card_payload || {};
  return safeStr(payload.item_name || payload.name || row?.item_name || row?.name || "");
}

function rollSummary(roll) {
  if (!roll) return "";
  const mod = Number(roll.mod || 0);
  const modText = mod >= 0 ? `+${mod}` : `${mod}`;
  const mode = roll.mode && roll.mode !== "normal" ? ` (${String(roll.mode).toUpperCase()})` : "";
  const rolls = Array.isArray(roll.rolls) && roll.rolls.length ? ` [${roll.rolls.join(", ")}]` : "";
  return `${roll.label}${mode}: ${roll.roll}${rolls} ${modText} = ${roll.total}`;
}

function profileRevealFromSheet(sheet) {
  const s = sheet && typeof sheet === "object" ? sheet : {};
  const reveal = s.profileReveal && typeof s.profileReveal === "object" ? s.profileReveal : s.npcProfileReveal;
  return reveal && typeof reveal === "object" ? reveal : {};
}

function loreFieldsFor(view, sheet) {
  const s = sheet && typeof sheet === "object" ? sheet : {};
  const personality = s.personality && typeof s.personality === "object" ? s.personality : {};

  return {
    description: safeStr(view?.description || s.description),
    background: safeStr(view?.background || s.background),
    traits: safeStr(s.traits ?? personality.traits),
    ideals: safeStr(s.ideals ?? personality.ideals),
    bonds: safeStr(s.bonds ?? personality.bonds),
    flaws: safeStr(s.flaws ?? personality.flaws),
    motivation: safeStr(view?.motivation || s.motivation),
    quirk: safeStr(view?.quirk || s.quirk),
    mannerism: safeStr([view?.mannerism || s.mannerism, view?.voice || s.voice].filter(Boolean).join(" • ")),
    secret: safeStr(view?.secret || s.secret),
  };
}

function ownerTypeFor(view, fallback) {
  const kind = safeStr(view?.kind || fallback?.kind || fallback?.type || "npc").toLowerCase();
  return kind === "merchant" ? "merchant" : "npc";
}

export default function NpcPanel({ npc, isAdmin = false, locations = [], onClose, onOpenDrawer, onBrowseWares }) {
  const router = useRouter();

  const [fullNpc, setFullNpc] = useState(null);
  const [pillIconUrl, setPillIconUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [activeView, setActiveView] = useState("profile");
  const [sheet, setSheet] = useState(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetErr, setSheetErr] = useState("");
  const [equippedRows, setEquippedRows] = useState([]);
  const [inventoryRows, setInventoryRows] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryErr, setInventoryErr] = useState("");
  const [inventoryAccess, setInventoryAccess] = useState({ checked: false, canView: false, canManage: false });
  const [lastRoll, setLastRoll] = useState(null);
  const [revealBusyKey, setRevealBusyKey] = useState("");

  const npcId = npc?.id || null;

  // Fetch a fuller row when opened (map pins are intentionally loaded with a minimal select).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!npcId) return;
      setLoading(true);
      setErr("");

      const { data, error } = await supabase
        .from("characters")
        .select(
          [
            "id",
            "name",
            "kind",
            "race",
            "role",
            "description",
            "affiliation",
            "status",
            "background",
            "motivation",
            "quirk",
            "mannerism",
            "voice",
            "secret",
            "tags",
            "x",
            "y",
            "location_id",
            "last_known_location_id",
            "projected_destination_id",
            "is_hidden",
            "map_icon_id",
            "portrait_url",
            "portrait_storage_path",
            "portrait_thumb_url",
            "portrait_shop_url",
            "portrait_source",
            "image_url",
          ].join(",")
        )
        .eq("id", npcId)
        .single();

      if (cancelled) return;
      if (error) {
        setErr(error.message || "Failed to load NPC");
        setFullNpc(null);
      } else {
        setFullNpc(data || null);
      }
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [npcId]);

  // Load sheet + equipped inventory so the in-map profile can roll from the same sheet logic as /npcs.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!npcId) {
        setSheet(null);
        setEquippedRows([]);
        setLastRoll(null);
        return;
      }

      setSheetLoading(true);
      setSheetErr("");
      setLastRoll(null);

      const viewKind = ownerTypeFor(fullNpc || npc, npc);

      const [sheetRes, equippedRes] = await Promise.all([
        supabase.from("character_sheets").select("sheet").eq("character_id", npcId).maybeSingle(),
        supabase
          .from("inventory_items")
          .select("*")
          .eq("owner_type", viewKind)
          .eq("owner_id", String(npcId))
          .eq("is_equipped", true)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      if (sheetRes.error) {
        setSheetErr(sheetRes.error.message || "Failed to load character sheet.");
        setSheet(null);
      } else {
        setSheet(sheetRes.data?.sheet || null);
      }

      if (equippedRes.error) setEquippedRows([]);
      else setEquippedRows(equippedRes.data || []);

      setSheetLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [npcId, fullNpc?.kind, npc?.kind, npc?.type]);

  // Resolve inventory permissions for the selected character.
  const ownerType = ownerTypeFor(fullNpc || npc, npc);
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!npcId) {
        setInventoryAccess({ checked: true, canView: false, canManage: false });
        return;
      }

      if (isAdmin) {
        setInventoryAccess({ checked: true, canView: true, canManage: true });
        return;
      }

      if (ownerType !== "npc") {
        setInventoryAccess({ checked: true, canView: false, canManage: false });
        return;
      }

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id || null;
      if (!userId) {
        setInventoryAccess({ checked: true, canView: false, canManage: false });
        return;
      }

      const { data, error } = await supabase
        .from("character_permissions")
        .select("can_inventory,can_edit")
        .eq("character_id", npcId)
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setInventoryAccess({ checked: true, canView: false, canManage: false });
        return;
      }

      const can = !!data?.can_inventory || !!data?.can_edit;
      setInventoryAccess({ checked: true, canView: can, canManage: can });
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [npcId, ownerType, isAdmin]);

  const loadInventoryRows = useCallback(async () => {
    if (!npcId || !inventoryAccess.canView) {
      setInventoryRows([]);
      setInventoryLoading(false);
      return;
    }

    setInventoryLoading(true);
    setInventoryErr("");

    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("owner_type", ownerType)
      .eq("owner_id", String(npcId))
      .order("created_at", { ascending: false });

    if (error) {
      setInventoryErr(error.message || "Failed to load inventory.");
      setInventoryRows([]);
    } else {
      const rows = data || [];
      setInventoryRows(rows);
      setEquippedRows(rows.filter((row) => !!row.is_equipped));
    }

    setInventoryLoading(false);
  }, [npcId, ownerType, inventoryAccess.canView]);

  useEffect(() => {
    if (!inventoryAccess.checked) return;
    loadInventoryRows();
  }, [inventoryAccess.checked, loadInventoryRows]);

  // Load the character's map icon so we can render a small "pill" icon near the name.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const mapIconId = (fullNpc || npc)?.map_icon_id;
      if (!mapIconId) {
        if (!cancelled) setPillIconUrl("");
        return;
      }

      const { data, error } = await supabase
        .from("map_icons")
        .select("storage_path, storage_bucket")
        .eq("id", mapIconId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data?.storage_path) {
        setPillIconUrl("");
        return;
      }

      const bucket = data.storage_bucket || "map-icons";
      const url = supabase.storage.from(bucket).getPublicUrl(data.storage_path).data?.publicUrl;
      setPillIconUrl(url || "");
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npcId, fullNpc?.map_icon_id, npc?.map_icon_id]);

  const view = fullNpc || npc || {};

  const status = safeStr(view.status).toLowerCase() || "unknown";
  const role = view.role ? String(view.role) : "";
  const affiliation = view.affiliation ? String(view.affiliation) : "";
  const lastSeen = useMemo(
    () => locName(locations, view.last_known_location_id),
    [locations, view.last_known_location_id]
  );

  const subline = useMemo(() => {
    const parts = [];
    if (role) parts.push(role);
    if (affiliation) parts.push(affiliation);
    if (lastSeen) parts.push(`Last seen: ${lastSeen}`);
    return parts.join(" • ");
  }, [role, affiliation, lastSeen]);

  const blurb = safeStr(view.description);
  const portrait = useMemo(() => resolveCharacterPortrait(view, supabase), [view]);
  const equippedEquipmentText = useMemo(() => (equippedRows || []).map(pickItemName).filter(Boolean).join("\n"), [equippedRows]);
  const { effects: equippedEffects, breakdown: equippedBreakdown } = useMemo(() => deriveEquippedItemEffects(equippedRows), [equippedRows]);
  const effectsKey = useMemo(() => `${npcId || ""}|${hashEquippedRowsForKey(equippedRows)}`, [npcId, equippedRows]);
  const sheetMetaLine = [view.race, role, affiliation].filter(Boolean).join(" • ");
  const inventoryHref = npcId
    ? `/inventory?ownerType=${encodeURIComponent(ownerType)}&ownerId=${encodeURIComponent(String(npcId))}`
    : "";

  const profileReveal = useMemo(() => profileRevealFromSheet(sheet), [sheet]);
  const loreFields = useMemo(() => loreFieldsFor(view, sheet), [view, sheet]);
  const visibleLoreFields = useMemo(() => {
    return PROFILE_REVEAL_KEYS.filter((entry) => {
      const value = loreFields[entry.key];
      if (isAdmin) return true;
      if (!value) return false;
      return !!entry.alwaysPublic || !!profileReveal[entry.key];
    });
  }, [isAdmin, loreFields, profileReveal]);
  const filledLoreCount = useMemo(() => PROFILE_REVEAL_KEYS.filter((entry) => !!loreFields[entry.key]).length, [loreFields]);

  async function toggleReveal(key) {
    if (!isAdmin || !npcId || !key) return;

    setRevealBusyKey(key);
    const nextSheet = deepClone(sheet || {});
    const nextReveal = {
      ...profileRevealFromSheet(nextSheet),
      [key]: !profileReveal[key],
    };
    nextSheet.profileReveal = nextReveal;

    const { error } = await supabase
      .from("character_sheets")
      .upsert(
        {
          character_id: npcId,
          sheet: nextSheet,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "character_id" }
      );

    if (error) {
      alert(error.message || "Failed to update player reveal state.");
    } else {
      setSheet(nextSheet);
    }
    setRevealBusyKey("");
  }

  async function toggleEquipped(rowId, nextVal) {
    if (!inventoryAccess.canManage) return;

    const { error } = await supabase.from("inventory_items").update({ is_equipped: nextVal }).eq("id", rowId);
    if (error) {
      alert(error.message || "Failed to update item.");
      return;
    }
    await loadInventoryRows();
  }

  async function deleteItem(rowId) {
    if (!inventoryAccess.canManage) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this item?")) return;

    const { error } = await supabase.from("inventory_items").delete().eq("id", rowId);
    if (error) {
      alert(error.message || "Failed to delete item.");
      return;
    }
    await loadInventoryRows();
  }

  function renderLoreCard() {
    return (
      <div className="npc-card" style={{ gridColumn: "1 / -1", marginTop: 0 }}>
        <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2">
          <div>
            <div className="npc-card-title mb-0">{isAdmin ? "NPC Dossier & Player Reveals" : "Known Lore"}</div>
            <div className="small text-muted">
              {isAdmin
                ? `Admin checklist: ${filledLoreCount}/${PROFILE_REVEAL_KEYS.length} fields filled. Toggle completed fields when players discover them.`
                : "More details can be uncovered through dialogue, checks, and rumors."}
            </div>
          </div>
        </div>

        {visibleLoreFields.length ? (
          <div className="row g-2">
            {visibleLoreFields.map((entry) => {
              const value = loreFields[entry.key];
              const hasValue = !!value;
              const revealed = !!entry.alwaysPublic || !!profileReveal[entry.key];
              return (
                <div key={entry.key} className="col-12 col-xl-6">
                  <div className="p-2 rounded-3" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", minHeight: 92 }}>
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div className="min-w-0">
                        {entry.group ? <div className="small text-muted">{entry.group}</div> : null}
                        <div className="fw-semibold">{entry.label}</div>
                      </div>
                      {isAdmin ? (
                        entry.alwaysPublic ? (
                          <span className="badge bg-secondary">Public</span>
                        ) : hasValue ? (
                          <button
                            type="button"
                            className={`btn btn-sm ${revealed ? "btn-success" : "btn-outline-warning"}`}
                            disabled={revealBusyKey === entry.key}
                            onClick={() => toggleReveal(entry.key)}
                            title={revealed ? "Hide this detail from players" : "Reveal this detail to players"}
                          >
                            {revealed ? "Visible" : "Reveal"}
                          </button>
                        ) : (
                          <button type="button" className="btn btn-sm btn-outline-secondary" disabled title="Add content before revealing this field">
                            Needs content
                          </button>
                        )
                      ) : null}
                    </div>
                    {entry.hint ? <div className="small text-muted mt-1">{entry.hint}</div> : null}
                    {hasValue ? (
                      <div className="npc-text mt-2" style={{ whiteSpace: "pre-wrap" }}>{value}</div>
                    ) : (
                      <div className="text-muted fst-italic mt-2">Not filled yet.</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-muted fst-italic">No additional public lore has been revealed yet.</div>
        )}
      </div>
    );
  }

  function renderInventoryPanel() {
    if (!inventoryAccess.checked || inventoryLoading) {
      return <div className="npc-card"><div className="text-muted">Loading inventory…</div></div>;
    }

    if (!inventoryAccess.canView) {
      return <div className="npc-card"><div className="text-warning">You do not have permission to view this inventory.</div></div>;
    }

    return (
      <div className="p-2">
        <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2">
          <div>
            <div className="fw-semibold">Inventory</div>
            <div className="small text-muted">Manage this character without leaving the map.</div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={loadInventoryRows} disabled={inventoryLoading}>
            Refresh
          </button>
        </div>

        {inventoryErr ? <div className="alert alert-danger py-2">{inventoryErr}</div> : null}

        {inventoryRows.length === 0 ? (
          <div className="npc-card"><div className="text-muted fst-italic">No items yet.</div></div>
        ) : (
          <div className="row g-3">
            {inventoryRows.map((row) => {
              const payload = row.card_payload || {};
              return (
                <div key={row.id} className="col-12 col-md-6 col-xxl-4 d-flex">
                  <div className="w-100 d-flex flex-column">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <span className="small text-muted text-truncate">{pickItemName(row) || "Item"}</span>
                      {row.is_equipped ? <span className="badge bg-success">Equipped</span> : null}
                    </div>

                    <div className="card-compact">
                      <ItemCard item={{ ...payload, card_payload: payload, _invRow: row }} />
                    </div>

                    {inventoryAccess.canManage ? (
                      <div className="mt-2 d-flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={`btn btn-sm ${row.is_equipped ? "btn-success" : "btn-outline-light"}`}
                          onClick={() => toggleEquipped(row.id, !row.is_equipped)}
                        >
                          {row.is_equipped ? "Equipped" : "Equip"}
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteItem(row.id)}>
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {inventoryHref ? (
          <div className="small text-muted mt-3">
            Full inventory URL remains available for deep links: <code>{inventoryHref}</code>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="npc-panel-inner">
      <div className="npc-panel-header">
        <div className="d-flex align-items-start justify-content-between gap-3">
          <div className="min-w-0">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {pillIconUrl ? (
                <span
                  className={`npc-kind-pill kind-${String(view.kind || "npc")}`}
                  title={String(view.kind || "").toUpperCase()}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pillIconUrl}
                    alt=""
                    onError={(e) => {
                      if (e?.currentTarget) e.currentTarget.style.display = "none";
                    }}
                  />
                </span>
              ) : null}
              <h3 className="npc-name m-0 text-truncate">{view.name || "NPC"}</h3>
              <span className={`badge npc-status badge-${status}`}>{status}</span>
            </div>
            {subline ? <div className="npc-subline text-truncate">{subline}</div> : null}
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end flex-shrink-0">
            <div className="btn-group btn-group-sm" role="tablist" aria-label="NPC profile views">
              <button
                type="button"
                className={`btn ${activeView === "profile" ? "btn-primary" : "btn-outline-light"}`}
                onClick={() => setActiveView("profile")}
              >
                Profile
              </button>
              <button
                type="button"
                className={`btn ${activeView === "sheet" ? "btn-primary" : "btn-outline-light"}`}
                onClick={() => setActiveView("sheet")}
              >
                Sheet & Rolls
              </button>
              <button
                type="button"
                className={`btn ${activeView === "inventory" ? "btn-primary" : "btn-outline-light"}`}
                onClick={() => setActiveView("inventory")}
              >
                Inventory
              </button>
            </div>

            {isAdmin ? (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light"
                  onClick={() => {
                    if (!npcId) return;
                    router.push(`/npcs?focus=npc:${encodeURIComponent(npcId)}`);
                  }}
                >
                  Open NPC page
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light"
                  onClick={() => {
                    if (!npcId) return;
                    onOpenDrawer?.(npcId);
                  }}
                  title="Open Character Drawer"
                >
                  Drawer
                </button>
              </>
            ) : null}

            <button
              type="button"
              className="btn btn-sm btn-outline-light"
              onClick={() => onClose?.()}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {activeView === "sheet" ? (
        <div className="npc-panel-body d-block">
          <div className="p-2">
            {sheetLoading ? (
              <div className="npc-card"><div className="text-muted">Loading character sheet…</div></div>
            ) : sheetErr ? (
              <div className="npc-card"><div className="text-danger">{sheetErr}</div></div>
            ) : sheet ? (
              <>
                {lastRoll ? (
                  <div className="alert alert-dark border border-warning-subtle text-warning-emphasis py-2 mb-2" role="status">
                    <strong>Last roll:</strong> {rollSummary(lastRoll)}
                  </div>
                ) : null}
                <CharacterSheetPanel
                  sheet={sheet || {}}
                  characterName={view.name || "Character"}
                  metaLine={sheetMetaLine}
                  inventoryHref=""
                  inventoryText="Inventory"
                  editable={false}
                  canSave={false}
                  onRoll={setLastRoll}
                  itemBonuses={equippedEffects}
                  equipmentOverride={equippedEquipmentText}
                  equipmentBreakdown={equippedBreakdown}
                  effectsKey={effectsKey}
                />
              </>
            ) : (
              <div className="npc-card"><div className="text-muted">No character sheet has been created for this character yet.</div></div>
            )}
          </div>
        </div>
      ) : activeView === "inventory" ? (
        <div className="npc-panel-body d-block">
          {renderInventoryPanel()}
        </div>
      ) : (
        <div className="npc-panel-body">
          <div className="npc-left">
            <div className="npc-portrait" aria-hidden="true">
              {portrait.url ? <img src={portrait.url} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="npc-portrait-placeholder">Portrait</div>}
            </div>

            <div className="npc-card">
              <div className="npc-card-title">About</div>
              {loading ? (
                <div className="text-muted">Loading…</div>
              ) : err ? (
                <div className="text-danger">{err}</div>
              ) : blurb ? (
                <div className="npc-text">{blurb}</div>
              ) : (
                <div className="text-muted">No description yet.</div>
              )}
            </div>
          </div>

          <div className="npc-right">
            <div className="npc-card">
              <div className="npc-card-title">Talk</div>
              <div className="npc-dialogue">
                {String(view.kind || "").toLowerCase() === "merchant" ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-warning"
                    onClick={() => {
                      if (!npcId) return;
                      onBrowseWares?.(view);
                    }}
                  >
                    Let me browse your wares.
                  </button>
                ) : null}
                <button type="button" className="btn btn-sm btn-primary" disabled>
                  Ask about rumors
                </button>
                <button type="button" className="btn btn-sm btn-primary" disabled>
                  Ask about work
                </button>
                <button type="button" className="btn btn-sm btn-primary" disabled>
                  Ask about the area
                </button>
              </div>
              <div className="npc-dialogue-hint text-muted">
                Dialogue options will be added later.
              </div>
            </div>

            <div className="npc-card">
              <div className="npc-card-title">Details</div>
              <div className="npc-details">
                {view.race ? (
                  <div>
                    <span className="text-muted">Race:</span> {view.race}
                  </div>
                ) : null}
                {role ? (
                  <div>
                    <span className="text-muted">Role:</span> {role}
                  </div>
                ) : null}
                {affiliation ? (
                  <div>
                    <span className="text-muted">Affiliation:</span> {affiliation}
                  </div>
                ) : null}
                {lastSeen ? (
                  <div>
                    <span className="text-muted">Last known:</span> {lastSeen}</div>
                ) : null}
              </div>
            </div>
          </div>

          {renderLoreCard()}
        </div>
      )}
    </div>
  );
}

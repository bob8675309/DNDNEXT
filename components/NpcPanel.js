/* components/NpcPanel.js */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabaseClient";
import { resolveCharacterPortrait } from "../utils/characterPortraits";
import CharacterSheetPanel from "./CharacterSheetPanel";
import { deriveEquippedItemEffects, hashEquippedRowsForKey } from "../utils/equipmentEffects";

function locName(locations, id) {
  if (!id) return "";
  const loc = (locations || []).find((l) => String(l.id) === String(id));
  return loc?.name || "";
}

function pickItemName(row) {
  const payload = row?.card_payload || {};
  return String(payload.item_name || payload.name || row?.item_name || row?.name || "").trim();
}

function rollSummary(roll) {
  if (!roll) return "";
  const mod = Number(roll.mod || 0);
  const modText = mod >= 0 ? `+${mod}` : `${mod}`;
  const mode = roll.mode && roll.mode !== "normal" ? ` (${String(roll.mode).toUpperCase()})` : "";
  const rolls = Array.isArray(roll.rolls) && roll.rolls.length ? ` [${roll.rolls.join(", ")}]` : "";
  return `${roll.label}${mode}: ${roll.roll}${rolls} ${modText} = ${roll.total}`;
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
  const [lastRoll, setLastRoll] = useState(null);

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

      const viewKind = String((fullNpc || npc)?.kind || npc?.type || "npc").toLowerCase();
      const ownerType = viewKind === "merchant" ? "merchant" : "npc";

      const [sheetRes, equippedRes] = await Promise.all([
        supabase.from("character_sheets").select("sheet").eq("character_id", npcId).maybeSingle(),
        supabase
          .from("inventory_items")
          .select("*")
          .eq("owner_type", ownerType)
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

  const status = String(view.status || "").toLowerCase() || "unknown";
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

  const blurb = (view.description || "").toString().trim();
  const portrait = useMemo(() => resolveCharacterPortrait(view, supabase), [view]);
  const equippedEquipmentText = useMemo(() => (equippedRows || []).map(pickItemName).filter(Boolean).join("\n"), [equippedRows]);
  const { effects: equippedEffects, breakdown: equippedBreakdown } = useMemo(() => deriveEquippedItemEffects(equippedRows), [equippedRows]);
  const effectsKey = useMemo(() => `${npcId || ""}|${hashEquippedRowsForKey(equippedRows)}`, [npcId, equippedRows]);
  const sheetMetaLine = [view.race, role, affiliation].filter(Boolean).join(" • ");
  const inventoryHref = npcId
    ? `/inventory?ownerType=${encodeURIComponent(String(view.kind || "npc").toLowerCase() === "merchant" ? "merchant" : "npc")}&ownerId=${encodeURIComponent(String(npcId))}`
    : "";

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

          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            <div className="npc-panel-tabs" role="tablist" aria-label="NPC profile views">
              <button
                type="button"
                className={`npc-panel-tab ${activeView === "profile" ? "is-active" : ""}`}
                onClick={() => setActiveView("profile")}
              >
                Profile
              </button>
              <button
                type="button"
                className={`npc-panel-tab ${activeView === "sheet" ? "is-active" : ""}`}
                onClick={() => setActiveView("sheet")}
              >
                Sheet & Rolls
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
        <div className="npc-panel-body npc-panel-body--sheet">
          <div className="npc-sheet-frame">
            {sheetLoading ? (
              <div className="npc-card"><div className="text-muted">Loading character sheet…</div></div>
            ) : sheetErr ? (
              <div className="npc-card"><div className="text-danger">{sheetErr}</div></div>
            ) : sheet ? (
              <>
                {lastRoll ? <div className="npc-sheet-roll-result">{rollSummary(lastRoll)}</div> : null}
                <CharacterSheetPanel
                  sheet={sheet || {}}
                  characterName={view.name || "Character"}
                  metaLine={sheetMetaLine}
                  inventoryHref={inventoryHref}
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
                    <span className="text-muted">Last known:</span> {lastSeen}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

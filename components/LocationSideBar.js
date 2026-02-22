//  components/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

// Helpers
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (v) => UUID_RE.test(String(v || "").trim());

const pickId = (x) => {
  if (!x) return null;
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  return x.id || x.uuid || x.character_id || x.npc_id || x.quest_id || x.name || x.title || null;
};

export default function LocationSideBar({
  isOpen = true,
  onClose,
  location,
  onOpenNpc,
  onOpenMerchant,
  // Optional: admin-only helper to re-fetch locations from the parent.
  isAdmin = false,
  onReload,
  onDeleteLocation,
  // If this sidebar is rendered inside a Bootstrap Offcanvas, we can close it directly.
  offcanvasId = "locPanel",
}) {
  const [loading, setLoading] = useState(false);
  const [rosterChars, setRosterChars] = useState([]);
  const [quests, setQuests] = useState([]);

  // Normalize ids from JSON arrays that may contain objects, ids, or names.
  const questKeys = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location?.quests]);

  useEffect(() => {
    let alive = true;

    const loadDetails = async () => {
      if (isOpen === false || !location?.id) return;

      setLoading(true);
      try {
        // IN-TOWN ROSTER ONLY
        // We intentionally do NOT show "traveling" / "away" / "on-map" rosters here.
        // Those belong in the NPC Drawer / map pins, not repeated per-location.
        let rosterQ = supabase
          .from("characters")
          .select(
            [
              "id",
              "name",
              "kind",
              "race",
              "role",
              "affiliation",
              "status",
              "state",
              "location_id",
              "last_known_location_id",
              "projected_destination_id",
              "is_hidden",
              "map_icon_id",
            ].join(",")
          )
          .in("kind", ["npc", "merchant"])
          .eq("location_id", location.id)
          .order("name", { ascending: true });

        // Player-facing default: hide hidden entries.
        if (!isAdmin) rosterQ = rosterQ.neq("is_hidden", true);

        const { data: rosterData, error: rosterErr } = await rosterQ;
        if (rosterErr) console.warn("LocationSideBar: roster fetch failed:", rosterErr);

        // --- Quests ---
        let finalQuests = [];
        if (questKeys.length) {
          const { data, error } = await supabase.from("quests").select("id, title, status").in("id", questKeys);
          if (error) console.warn("LocationSideBar: quest fetch failed:", error);
          if (Array.isArray(data)) {
            const byId = new Map(data.map((q) => [q.id, q]));
            finalQuests = questKeys.map((id) => byId.get(id)).filter(Boolean);
          }
        }

        if (!alive) return;
        setRosterChars(Array.isArray(rosterData) ? rosterData : []);
        setQuests(finalQuests);
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadDetails();

    return () => {
      alive = false;
    };
  }, [isOpen, location?.id, questKeys, isAdmin]);

  if (isOpen === false) return null;

  const handleClose = () => {
    try {
      if (typeof window !== "undefined") {
        const el = document.getElementById(offcanvasId);
        const Offcanvas = window?.bootstrap?.Offcanvas;
        if (el && Offcanvas) {
          const inst = Offcanvas.getInstance(el) || new Offcanvas(el);
          inst.hide();
        }
      }
    } catch {
      // ignore
    }

    if (typeof onClose === "function") onClose();
  };

  const npcsHere = useMemo(
    () => (Array.isArray(rosterChars) ? rosterChars : []).filter((c) => String(c?.kind) !== "merchant"),
    [rosterChars]
  );

  const merchantsHere = useMemo(
    () => (Array.isArray(rosterChars) ? rosterChars : []).filter((c) => String(c?.kind) === "merchant"),
    [rosterChars]
  );

  return (
    <div className="location-sidebar">
      <div className="location-sidebar__header">
        <div className="location-sidebar__title">
          <strong>{location?.name || "Location"}</strong>
          {location?.region ? <span className="location-sidebar__subtitle">{location.region}</span> : null}
        </div>

        <div className="d-flex align-items-center gap-2">
          {isAdmin && typeof onReload === "function" ? (
            <button type="button" className="btn btn-sm btn-outline-info" onClick={onReload} title="Reload locations">
              Reload
            </button>
          ) : null}
          {isAdmin && typeof onDeleteLocation === "function" ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => onDeleteLocation(location)}
              title="Delete this location"
            >
              Delete
            </button>
          ) : null}
          <button type="button" className="btn btn-sm btn-outline-light" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>

      <div className="location-sidebar__body">
        {loading ? <div className="text-muted small">Loading…</div> : null}

        {location?.description ? (
          <div className="mb-3">
            <div className="text-uppercase small text-muted mb-1">Description</div>
            <div className="small">{location.description}</div>
          </div>
        ) : null}

        <div className="mb-3">
          <div className="text-uppercase small text-muted mb-2">People</div>

          {(!npcsHere || npcsHere.length === 0) && !loading ? <div className="text-muted small">No NPCs present.</div> : null}

          {npcsHere?.length ? (
            <div className="d-flex flex-column gap-2 mt-2">
              {npcsHere.map((npc, idx) => {
                const canLink = isUuid(npc?.id);
                const label = npc?.name || "Unnamed NPC";
                if (onOpenNpc && canLink) {
                  return (
                    <button
                      key={npc.id || `${label}-${idx}`}
                      className="btn btn-sm btn-outline-secondary text-start"
                      onClick={() => onOpenNpc(npc)}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                }
                if (canLink) {
                  return (
                    <Link
                      key={npc.id}
                      href={`/npcs?focus=${npc.id}`}
                      className="btn btn-sm btn-outline-secondary text-start"
                    >
                      {label}
                    </Link>
                  );
                }
                return (
                  <div
                    key={`${label}-${idx}`}
                    className="btn btn-sm btn-outline-secondary text-start disabled"
                    aria-disabled="true"
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="mb-3">
          <div className="text-uppercase small text-muted mb-2">Quests</div>

          {(!quests || quests.length === 0) && !loading ? <div className="text-muted small">No quests listed.</div> : null}

          <div className="d-flex flex-column gap-2">
            {(quests || []).map((q) => (
              <div key={q.id} className="btn btn-sm btn-outline-secondary text-start disabled">
                <div className="d-flex justify-content-between align-items-center">
                  <span>{q.title || "Untitled Quest"}</span>
                  {q.status ? <span className="badge bg-secondary">{q.status}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <div className="text-uppercase small text-muted mb-2">Merchants</div>

          {(!merchantsHere || merchantsHere.length === 0) && !loading ? (
            <div className="text-muted small">No merchants present.</div>
          ) : null}

          <div className="d-flex flex-column gap-2">
            {(merchantsHere || []).map((m) => {
              const name = String(m?.name || "Merchant");
              const key = String(m?.id || name);

              if (typeof onOpenMerchant === "function") {
                return (
                  <button
                    key={key}
                    className="btn btn-sm btn-outline-secondary text-start"
                    onClick={() => onOpenMerchant(m)}
                    type="button"
                  >
                    {name}
                  </button>
                );
              }

              return (
                <div key={key} className="btn btn-sm btn-outline-secondary text-start disabled">
                  {name}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .location-sidebar {
          position: relative;
          height: 100%;
          width: 100%;
          background: rgba(10, 10, 14, 0.92);
          padding: 12px;
          overflow: auto;
        }
        .location-sidebar__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .location-sidebar__title {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .location-sidebar__subtitle {
          opacity: 0.7;
          font-size: 0.85rem;
        }
      `}</style>
    </div>
  );
}

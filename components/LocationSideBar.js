//  components/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

//    Helpers
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (v) => UUID_RE.test(String(v || "").trim());

const pickId = (x) => {
  if (!x) return null;
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  return (
    x.id ||
    x.uuid ||
    x.character_id ||
    x.npc_id ||
    x.quest_id ||
    x.name ||
    x.title ||
    null
  );
};

export default function LocationSideBar({
  isOpen = true,
  onClose,
  location,
  onOpenNpc,
  onOpenMerchant,
  // Optional: pass the full merchant list so the sidebar can show who's currently here.
  merchants = [],
  // Optional: admin-only helper to re-fetch locations from the parent.
  isAdmin = false,
  onReload,
  onDeleteLocation,
  // If this sidebar is rendered inside a Bootstrap Offcanvas, we can close it directly.
  offcanvasId = "locPanel",
}) {
  const [loading, setLoading] = useState(false);
  // Holds BOTH NPCs and merchants that are listed at this location.
  const [listedChars, setListedChars] = useState([]);
  const [quests, setQuests] = useState([]);
  // Roster rows derived from characters table.
  const [rosterChars, setRosterChars] = useState([]);

  // Normalize ids from JSON arrays that may contain objects, ids, or names.
  const npcKeys = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location?.npcs]);

  const questKeys = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location?.quests]);

  const merchantsHere = useMemo(() => {
    const list = Array.isArray(merchants) ? merchants : [];
    const locId = location?.id;
    if (!locId) return [];
    return list.filter((m) => {
      // "Moving" means On Map is active; those should not show in location lists.
      if (m?.is_hidden === false) return false;
      const a = m?.location_id;
      const b = m?.last_known_location_id;
      return String(a) === String(locId) || String(b) === String(locId);
    });
  }, [merchants, location?.id]);

  useEffect(() => {
    let alive = true;

    const loadDetails = async () => {
      if (isOpen === false || !location?.id) return;

      setLoading(true);
      try {
        // --- Roster ---
        // Player-facing model:
        // - location_id = "currently here"
        // - last_known_location_id = "linked to this place" (home/last seen)
        // - on-map travel = location_id IS NULL and is_hidden=false (pins)
        // NOTE: A future home_location_id will make this even cleaner; this roster code is written
        // to work well today without requiring schema changes.
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
              "x",
              "y",
              "location_id",
              "last_known_location_id",
              "projected_destination_id",
              "is_hidden",
              "map_icon_id",
            ].join(",")
          )
          .in("kind", ["npc", "merchant"])
          .or(`location_id.eq.${location.id},last_known_location_id.eq.${location.id}`)
          .order("name", { ascending: true });

        // Player-facing default: hide hidden entries.
        if (!isAdmin) rosterQ = rosterQ.neq("is_hidden", true);

        const { data: rosterData, error: rosterErr } = await rosterQ;
        if (rosterErr) console.warn("LocationSideBar: roster fetch failed:", rosterErr);

        // Preserve any explicit location.npcs ordering by pre-pending those items when present.
        // (This keeps authored lists stable while still allowing state-based grouping.)
        const fetchedRoster = Array.isArray(rosterData) ? rosterData : [];

        const fetchedChars = [];
        // Additional fetch for explicitly listed NPC keys (handles name-based legacy arrays)
        const uuidNpcIds = npcKeys.filter(isUuid);
        const nameNpcKeys = npcKeys.filter((k) => !isUuid(k));
        if (uuidNpcIds.length) {
          const { data } = await supabase
            .from("characters")
            .select("id,name,kind,role,affiliation,status,location_id,last_known_location_id,is_hidden,state")
            .in("id", uuidNpcIds)
            .in("kind", ["npc", "merchant"]);
          if (Array.isArray(data)) fetchedChars.push(...data);
        }
        if (nameNpcKeys.length) {
          const { data } = await supabase
            .from("characters")
            .select("id,name,kind,role,affiliation,status,location_id,last_known_location_id,is_hidden,state")
            .in("name", nameNpcKeys)
            .in("kind", ["npc", "merchant"]);
          if (Array.isArray(data)) fetchedChars.push(...data);
        }

        const merged = [...fetchedRoster, ...fetchedChars];
        const byId = new Map();
        for (const r of merged) {
          if (!r) continue;
          const k = String(r.id || r.name || "");
          if (!k) continue;
          if (!byId.has(k)) byId.set(k, r);
        }
        const finalRoster = Array.from(byId.values());

        // --- Quests ---
        let finalQuests = [];
        if (questKeys.length) {
          const { data, error } = await supabase
            .from("quests")
            .select("id, title, status")
            .in("id", questKeys);

          if (error) console.warn("LocationSideBar: quest fetch failed:", error);
          if (Array.isArray(data)) {
            // Preserve order from location.quests
            const byId = new Map(data.map((q) => [q.id, q]));
            finalQuests = questKeys.map((id) => byId.get(id)).filter(Boolean);
          }
        }

        if (!alive) return;
        setRosterChars(finalRoster);
        // Keep existing listedChars behavior for compatibility (used by older UI sections).
        setListedChars(finalRoster);
        setQuests(finalQuests);
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadDetails();

    return () => {
      alive = false;
    };
  }, [isOpen, location?.id, npcKeys, questKeys]);

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

  const npcsOnly = useMemo(
    () => (Array.isArray(rosterChars) ? rosterChars : []).filter((c) => String(c?.kind) !== "merchant"),
    [rosterChars]
  );

  const listedMerchants = useMemo(
    () => (Array.isArray(rosterChars) ? rosterChars : []).filter((c) => String(c?.kind) === "merchant"),
    [rosterChars]
  );

  const npcGroups = useMemo(() => {
    const locId = location?.id;
    const list = Array.isArray(npcsOnly) ? npcsOnly : [];
    if (!locId) return { here: [] };

    const here = [];

    for (const c of list) {
      const isStationary = c?.state === "resting" && !c?.projected_destination_id;
      if (!isStationary) continue;

      const atHere = String(c?.location_id) === String(locId);
      const fallbackHere = (c?.location_id == null || c?.location_id === "") && String(c?.last_known_location_id) === String(locId);

      if (atHere || fallbackHere) here.push(c);
    }

    return { here };
  }, [npcsOnly, location?.id]);

  const merchantsToShow = useMemo(() => {
    const out = new Map();
    for (const m of listedMerchants || []) {
      const k = String(m?.id || m?.name || Math.random());
      if (!out.has(k)) out.set(k, m);
    }
    for (const m of merchantsHere || []) {
      const k = String(m?.id || m?.name || Math.random());
      if (!out.has(k)) out.set(k, m);
    }
    return Array.from(out.values());
  }, [listedMerchants, merchantsHere]);

  return (
    <div className="location-sidebar">
      <div className="location-sidebar__header">
        <div className="location-sidebar__title">
          <strong>{location?.name || "Location"}</strong>
          {location?.region ? (
            <span className="location-sidebar__subtitle">{location.region}</span>
          ) : null}
        </div>

        <div className="d-flex align-items-center gap-2">
          {isAdmin && typeof onReload === "function" ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-info"
              onClick={onReload}
              title="Reload locations"
            >
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
            <div className="text-uppercase small text-muted mb-1">
              Description
            </div>
            <div className="small">{location.description}</div>
          </div>
        ) : null}

        <div className="mb-3">
          <div className="text-uppercase small text-muted mb-2">People</div>

          {(!npcsOnly || npcsOnly.length === 0) && !loading ? (
            <div className="text-muted small">No NPCs present.</div>
          ) : null}

          {/* Currently here */}
          {npcGroups?.here?.length ? (
            <div className="mb-2">
              <div className="d-flex align-items-center justify-content-between">
                <div className="small text-muted">Currently here</div>
                <span className="badge bg-secondary">{npcGroups.here.length}</span>
              </div>
              <div className="d-flex flex-column gap-2 mt-2">
                {npcGroups.here.map((npc, idx) => {
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
            </div>
          ) : null}

          {/* Traveling/on-map */}
          {npcGroups?.traveling?.length ? (
            <div className="mb-2">
              <div className="d-flex align-items-center justify-content-between">
                <div className="small text-muted">Traveling</div>
                <span className="badge bg-secondary">{[].length}</span>
              </div>
              <div className="d-flex flex-column gap-2 mt-2">
                      className="btn btn-sm btn-outline-secondary text-start d-flex align-items-center justify-content-between"
                      onClick={() => onOpenNpc?.(npc)}
                      type="button"
                      disabled={!onOpenNpc || !canLink}
                      title={onOpenNpc ? "Open" : "Admin-only"}
                    >
                      <span className="text-truncate">{label}</span>
                      <span className="badge bg-primary">On map</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Away/offscreen */}
          {npcGroups?.away?.length ? (
            <div className="mb-2">
              <div className="d-flex align-items-center justify-content-between">
                <div className="small text-muted">Away</div>
                <span className="badge bg-secondary">{[].length}</span>
              </div>
              <div className="d-flex flex-column gap-2 mt-2">
                {[].map((npc, idx) => {
                  const canLink = isUuid(npc?.id);
                  const label = npc?.name || "Unnamed NPC";
                  if (onOpenNpc && canLink) {
                    return (
                      <button
                        key={npc.id || `${label}-${idx}`}
                        className="btn btn-sm btn-outline-secondary text-start d-flex align-items-center justify-content-between"
                        onClick={() => onOpenNpc(npc)}
                        type="button"
                      >
                        <span className="text-truncate">{label}</span>
                        <span className="badge bg-secondary">Away</span>
                      </button>
                    );
                  }
                  if (canLink) {
                    return (
                      <Link
                        key={npc.id}
                        href={`/npcs?focus=${npc.id}`}
                        className="btn btn-sm btn-outline-secondary text-start d-flex align-items-center justify-content-between"
                      >
                        <span className="text-truncate">{label}</span>
                        <span className="badge bg-secondary">Away</span>
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
            </div>
          ) : null}
        </div>

        <div className="mb-3">
          <div className="text-uppercase small text-muted mb-2">Quests</div>

          {(!quests || quests.length === 0) && !loading ? (
            <div className="text-muted small">No quests listed.</div>
          ) : null}

          <div className="d-flex flex-column gap-2">
            {(quests || []).map((q) => (
              <div
                key={q.id}
                className="btn btn-sm btn-outline-secondary text-start disabled"
              >
                <div className="d-flex justify-content-between align-items-center">
                  <span>{q.title || "Untitled Quest"}</span>
                  {q.status ? (
                    <span className="badge bg-secondary">{q.status}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <div className="text-uppercase small text-muted mb-2">Merchants</div>

          {(!merchantsToShow || merchantsToShow.length === 0) && !loading ? (
            <div className="text-muted small">No merchants present.</div>
          ) : null}

          <div className="d-flex flex-column gap-2">
            {(merchantsToShow || []).map((m) => {
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

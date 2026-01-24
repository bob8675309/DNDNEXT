// components/LocationSideBar.js
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
  isOpen,
  onClose,
  location,
  onOpenNpc,
  onOpenMerchant,
}) {
  const [loading, setLoading] = useState(false);
  const [npcs, setNpcs] = useState([]);
  const [quests, setQuests] = useState([]);

  // Normalize ids from JSON arrays that may contain objects, ids, or names.
  const npcKeys = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location?.npcs]);

  const questKeys = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location?.quests]);

  useEffect(() => {
    let alive = true;

    const loadDetails = async () => {
      if (!isOpen || !location?.id) return;

      setLoading(true);
      try {
        // --- NPCs ---
        // We no longer support the legacy_character_map indirection.
        // If location.npcs contains UUIDs, fetch by id.
        // If it contains strings that are not UUIDs, treat them as names and try to fetch by name.
        const uuidNpcIds = npcKeys.filter(isUuid);
        const nameNpcKeys = npcKeys.filter((k) => !isUuid(k));

        const fetchedNpcs = [];

        if (uuidNpcIds.length) {
          const { data, error } = await supabase
            .from("characters")
            .select("id, name, kind, role, affiliation, status, location_id")
            .eq("kind", "npc")
            .in("id", uuidNpcIds);

          if (error)
            console.warn("LocationSideBar: NPC fetch by id failed:", error);
          if (Array.isArray(data)) fetchedNpcs.push(...data);
        }

        if (nameNpcKeys.length) {
          const { data, error } = await supabase
            .from("characters")
            .select("id, name, kind, role, affiliation, status, location_id")
            .eq("kind", "npc")
            .in("name", nameNpcKeys);

          if (error)
            console.warn("LocationSideBar: NPC fetch by name failed:", error);
          if (Array.isArray(data)) fetchedNpcs.push(...data);
        }

        // Fallback: if location.npcs is empty, list all NPCs currently at this location.
        if (!npcKeys.length) {
          const { data, error } = await supabase
            .from("characters")
            .select("id, name, kind, role, affiliation, status, location_id")
            .eq("kind", "npc")
            .eq("location_id", location.id);

          if (error)
            console.warn("LocationSideBar: NPC fallback fetch failed:", error);
          if (Array.isArray(data)) fetchedNpcs.push(...data);
        }

        // De-dupe by id (or by name for non-uuid keys)
        const npcById = new Map();
        const npcByNameLower = new Map();
        for (const n of fetchedNpcs) {
          if (n?.id && !npcById.has(n.id)) npcById.set(n.id, n);
          if (n?.name)
            npcByNameLower.set(String(n.name).toLowerCase(), n);
        }

        // Preserve the order from location.npcs when present
        let finalNpcs = [];
        if (npcKeys.length) {
          for (const key of npcKeys) {
            const n =
              (isUuid(key) ? npcById.get(key) : null) ||
              npcByNameLower.get(String(key).toLowerCase()) ||
              null;

            if (n) finalNpcs.push(n);
            else finalNpcs.push({ id: null, name: String(key), kind: "npc" });
          }
        } else {
          finalNpcs = Array.from(npcById.values());
        }

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
        setNpcs(finalNpcs);
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

  if (!isOpen) return null;

  return (
    <div className="location-sidebar">
      <div className="location-sidebar__header">
        <div className="location-sidebar__title">
          <strong>{location?.name || "Location"}</strong>
          {location?.region ? (
            <span className="location-sidebar__subtitle">{location.region}</span>
          ) : null}
        </div>

        <button className="btn btn-sm btn-outline-light" onClick={onClose}>
          Close
        </button>
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
          <div className="text-uppercase small text-muted mb-2">NPCs</div>

          {(!npcs || npcs.length === 0) && !loading ? (
            <div className="text-muted small">No NPCs listed.</div>
          ) : null}

          <div className="d-flex flex-column gap-2">
            {(npcs || []).map((npc, idx) => {
              const canLink = isUuid(npc?.id);
              const label = npc?.name || "Unnamed NPC";

              // If a click handler was provided, prefer it; otherwise use Link when possible.
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

        {location?.merchants && Array.isArray(location.merchants) ? (
          <div className="mb-3">
            <div className="text-uppercase small text-muted mb-2">Merchants</div>

            <div className="d-flex flex-column gap-2">
              {location.merchants.map((m) => {
                const key = pickId(m);
                const name =
                  (typeof m === "object" && (m.name || m.title)) ||
                  String(key || "");
                if (onOpenMerchant) {
                  return (
                    <button
                      key={key || name}
                      className="btn btn-sm btn-outline-secondary text-start"
                      onClick={() => onOpenMerchant(m)}
                      type="button"
                    >
                      {name}
                    </button>
                  );
                }
                return (
                  <div
                    key={key || name}
                    className="btn btn-sm btn-outline-secondary text-start disabled"
                  >
                    {name}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <style jsx>{`
        .location-sidebar {
          position: absolute;
          top: 0;
          right: 0;
          height: 100%;
          width: min(420px, 92vw);
          background: rgba(10, 10, 14, 0.92);
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          padding: 12px;
          z-index: 50;
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

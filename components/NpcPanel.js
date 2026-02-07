/* components/NpcPanel.js */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabaseClient";

function locName(locations, id) {
  if (!id) return "";
  const loc = (locations || []).find((l) => String(l.id) === String(id));
  return loc?.name || "";
}

export default function NpcPanel({ npc, isAdmin = false, locations = [] }) {
  const router = useRouter();

  const [fullNpc, setFullNpc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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

  return (
    <div className="npc-panel-inner">
      <div className="npc-panel-header">
        <div className="d-flex align-items-start justify-content-between gap-3">
          <div className="min-w-0">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h3 className="npc-name m-0 text-truncate">{view.name || "NPC"}</h3>
              <span className={`badge npc-status badge-${status}`}>{status}</span>
            </div>
            {subline ? <div className="npc-subline text-truncate">{subline}</div> : null}
          </div>

          {isAdmin ? (
            <div className="d-flex align-items-center gap-2 flex-shrink-0">
              <button
                type="button"
                className="btn btn-sm btn-outline-light"
                onClick={() => {
                  if (!npcId) return;
                  router.push(`/npcs?focus=npc:${encodeURIComponent(npcId)}`);
                }}
              >
                Open sheet
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="npc-panel-body">
        <div className="npc-left">
          <div className="npc-portrait" aria-hidden="true">
            <div className="npc-portrait-placeholder">Portrait</div>
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
    </div>
  );
}

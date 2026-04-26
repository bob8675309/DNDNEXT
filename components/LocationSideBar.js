
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";
import { buildTownData, pickId } from "../utils/townData";

function formatClock(d) {
  try {
    return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(d);
  } catch {
    return "--:--";
  }
}

export default function LocationSideBar({
  isOpen = true,
  onClose,
  location,
  isAdmin = false,
  onReload,
  onDeleteLocation,
  onOpenRoutes,
  offcanvasId = "locPanel",
}) {
  const [loading, setLoading] = useState(false);
  const [rosterChars, setRosterChars] = useState([]);
  const [quests, setQuests] = useState([]);
  const [clock, setClock] = useState(() => formatClock(new Date()));

  const questKeys = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location?.quests]);

  useEffect(() => {
    const t = setInterval(() => setClock(formatClock(new Date())), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    const loadDetails = async () => {
      if (isOpen === false || !location?.id) return;
      setLoading(true);
      try {
        let rosterQ = supabase
          .from("characters")
          .select([
            "id", "name", "kind", "race", "role", "affiliation", "status", "state", "location_id", "last_known_location_id", "projected_destination_id", "is_hidden", "map_icon_id", "tags",
          ].join(","))
          .in("kind", ["npc", "merchant"])
          .eq("location_id", location.id)
          .order("name", { ascending: true });
        // IMPORTANT: is_hidden means "do not render a world-map sprite," not "hide from in-town rosters."
        // Characters assigned to a location are often hidden from the map specifically so they can appear here instead.
        const { data: rosterData, error: rosterErr } = await rosterQ;
        if (rosterErr) console.warn("LocationSideBar: roster fetch failed:", rosterErr);

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
    return () => { alive = false; };
  }, [isOpen, location?.id, questKeys, isAdmin]);

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
    } catch {}
    if (typeof onClose === "function") onClose();
  };

  const townData = useMemo(() => buildTownData(location, rosterChars, quests), [location, rosterChars, quests]);
  const presentPeople = (townData.people || []).slice(0, 4);
  const hooks = [...(townData.jobLeads || []), ...(townData.rumors || []), ...(townData.cityStories || [])].slice(0, 3);
  const safety = /watch|guard|security|controlled|fort/i.test(String(townData?.stats?.defenses || "")) ? "Guarded" : "Uncertain";

  if (isOpen === false) return null;

  return (
    <div className="town-quick-sidebar">
      <div className="town-quick-sidebar__header">
        <div>
          <div className="town-quick-sidebar__eyebrow">Town</div>
          <div className="town-quick-sidebar__title">{location?.name || "Location"}</div>
          <div className="town-quick-sidebar__desc">{townData.summary}</div>
        </div>
        <div className="town-quick-sidebar__metaCard">
          <div><span>Safety:</span> {safety}</div>
          <div><span>Weather:</span> Clear</div>
          <div><span>Time:</span> {clock}</div>
        </div>
      </div>

      {loading ? <div className="town-quick-sidebar__loading">Loading town data…</div> : null}

      <div className="town-quick-sidebar__grid">
        <section className="town-quick-card">
          <div className="town-quick-card__kicker">Present NPCs</div>
          <ul className="town-quick-list">
            {presentPeople.length ? presentPeople.map((p) => <li key={p.title}>{p.title}</li>) : <li>No one surfaced</li>}
          </ul>
        </section>

        <section className="town-quick-card">
          <div className="town-quick-card__kicker">Services</div>
          <ul className="town-quick-list">
            {(townData.services || []).slice(0, 6).map((s) => <li key={s}>{s}</li>)}
          </ul>
        </section>
      </div>

      <section className="town-quick-card town-quick-card--full">
        <div className="town-quick-card__kicker">Active hooks</div>
        <div className="town-quick-hooks">
          {hooks.map((h) => (
            <div key={`${h.title}-${h.text}`} className="town-hook-chip">{h.text}</div>
          ))}
        </div>
      </section>

      <div className="town-quick-sidebar__actions">
        <Link href={`/town/${location?.id || ""}`} className="btn btn-warning town-quick-sidebar__primary" onClick={handleClose}>
          Enter Town Sheet
        </Link>
        <button type="button" className="btn btn-outline-light" onClick={() => typeof onOpenRoutes === "function" ? onOpenRoutes(location) : null}>
          Travel & Routes
        </button>
      </div>

      <div className="town-quick-sidebar__adminRow">
        {isAdmin && typeof onReload === "function" ? (
          <button type="button" className="btn btn-sm btn-outline-info" onClick={onReload}>Reload</button>
        ) : null}
        {isAdmin && typeof onDeleteLocation === "function" ? (
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDeleteLocation(location)}>Delete</button>
        ) : null}
        <button type="button" className="btn btn-sm btn-outline-light" onClick={handleClose}>Close</button>
      </div>
    </div>
  );
}

/*  components/LocationSideBar.js */
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

export default function LocationSideBar({ location, onClose, onReload }) {
  const [npcs, setNPCs] = useState([]);
  const [quests, setQuests] = useState([]);

  useEffect(() => {
    (async () => {
      const npcIds = idsFrom(location?.npcs);
      const questIds = idsFrom(location?.quests);
      const [nres, qres] = await Promise.all([
        npcIds.length ? supabase.from("npcs").select("id,name,race,role").in("id", npcIds) : Promise.resolve({ data: [] }),
        questIds.length ? supabase.from("quests").select("id,name,description,status").in("id", questIds) : Promise.resolve({ data: [] }),
      ]);
      setNPCs(nres.data || []);
      setQuests(qres.data || []);
    })();
  }, [location?.id]);

  return (
    <div className="offcanvas-body">
      <div className="offcanvas-header">
        <h5 className="offcanvas-title">{location?.name}</h5>
        <button className="btn-close" data-bs-dismiss="offcanvas" onClick={onClose} />
      </div>

      {location?.description && <p className="loc-desc">{location.description}</p>}

      <div className="loc-sec">
        <div className="loc-sec-title"><span>Quests</span></div>
        {quests.length === 0 && <div className="text-muted small">No quests linked.</div>}
        {quests.map((q) => (
          <div key={q.id} className="loc-item">
            <div className="fw-semibold">{q.name}</div>
            {q.status && <span className="badge-soft ms-2 align-middle">{q.status}</span>}
            {q.description && <div className="text-muted small mt-1">{q.description}</div>}
          </div>
        ))}
      </div>

      <div className="loc-sec">
        <div className="loc-sec-title"><span>NPCs</span></div>
        {npcs.length === 0 && <div className="text-muted small">No notable NPCs recorded.</div>}
        {npcs.map((n) => (
          <div key={n.id} className="loc-item">
            <div className="fw-semibold">{n.name}</div>
            <div className="small text-muted">{[n.race, n.role].filter(Boolean).join(" • ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function idsFrom(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  try { const arr = JSON.parse(val); return Array.isArray(arr) ? arr.map(String) : []; } catch { return []; }
}

// pages/map.js
import { useEffect, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";

export default function MapPage() {
  const [locs, setLocs] = useState([]);
  const [addMode, setAddMode] = useState(false);
  const [clickPt, setClickPt] = useState(null);
  const [err, setErr] = useState("");
  const imgRef = useRef(null);

  async function load() {
    setErr("");
    // locations has no created_at – order by an existing column
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .order("id", { ascending: true });

    if (error) { setErr(error.message); return; }
    setLocs(data || []);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("loc-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  function handleClick(e) {
    if (!addMode) return;
    const img = imgRef.current;
    if (!img) return;

    const r = img.getBoundingClientRect();
    const xPct = ((e.clientX - r.left) / r.width) * 100;
    const yPct = ((e.clientY - r.top) / r.height) * 100;

    const x = Math.max(0, Math.min(100, xPct)).toFixed(4);
    const y = Math.max(0, Math.min(100, yPct)).toFixed(4);

    setClickPt({ x, y });

    const m = document.getElementById("addLocModal");
    if (m && window.bootstrap) new window.bootstrap.Modal(m).show();
  }

  async function createLocation(e) {
    e.preventDefault();
    if (!clickPt) return;

    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") || "").toString().trim();
    const description = (fd.get("description") || "").toString().trim() || null;
    if (!name) return;

    setErr("");
    const { error } = await supabase.from("locations").insert({
      name,
      description,
      x: clickPt.x, // TEXT in DB
      y: clickPt.y, // TEXT in DB
    });

    if (error) { setErr(error.message); return; }

    // refresh & reset
    await load();
    setAddMode(false);
    setClickPt(null);
    e.currentTarget.reset();
  }

  // pages/map.js  (only the wrapper divs changed)
...
  return (
    <div className="container-fluid my-3 map-page">
      <div className="d-flex gap-2 align-items-center mb-2">
        <button
          className={`btn btn-sm ${addMode ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setAddMode(v => !v)}
        >
          {addMode ? "Click on the map…" : "Add Location"}
        </button>
        {err && <div className="text-danger small">{err}</div>}
      </div>

      {/* Centered, viewport-fitted map */}
      <div className="map-shell">
        <div className="map-wrap" onClick={handleClick}>
          <img ref={imgRef} src="/Wmap.jpg" alt="World map" className="map-img" />
          <div className="map-overlay">
            {locs.map(l => {
              const x = parseFloat(l.x);
              const y = parseFloat(l.y);
              if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) return null;
              return (
                <div
                  key={l.id}
                  className="map-pin"
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={l.name}
                  onClick={ev => { ev.stopPropagation(); alert(`${l.name}\n\n${l.description || ""}`); }}
                />
              );
            })}
            {addMode && clickPt && (
              <div
                className="map-pin"
                style={{ left: `${clickPt.x}%`, top: `${clickPt.y}%`, background: "#ffc107" }}
                title={`${clickPt.x}%, ${clickPt.y}%`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Modal ... unchanged */}
      ...
    </div>
  );
}

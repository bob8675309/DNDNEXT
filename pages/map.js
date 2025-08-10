// pages/map.js
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Assumes table public.locations with columns:
// id uuid pk, name text, description text, x_pct numeric, y_pct numeric, created_at timestamptz
export default function MapPage() {
  const [locs, setLocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState(false);
  const [clickPt, setClickPt] = useState(null); // {x_pct, y_pct}
  const [err, setErr] = useState("");

  const imgRef = useRef(null);
  const wrapRef = useRef(null);

  async function load() {
    setErr("");
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error) setLocs(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("locations-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  function mapClick(e) {
    if (!addMode) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x_px = e.clientX - rect.left;
    const y_px = e.clientY - rect.top;
    const x_pct = Math.max(0, Math.min(100, (x_px / rect.width) * 100));
    const y_pct = Math.max(0, Math.min(100, (y_px / rect.height) * 100));
    setClickPt({ x_pct, y_pct });
    // open modal
    const modal = document.getElementById("addLocModal");
    if (modal) new window.bootstrap.Modal(modal).show();
  }

  async function createLocation(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get("name")?.toString().trim();
    const description = fd.get("description")?.toString().trim() || null;
    if (!name || !clickPt) return;

    setErr("");
    const { error } = await supabase.from("locations").insert({
      name, description, x_pct: clickPt.x_pct, y_pct: clickPt.y_pct
    });
    if (error) setErr(error.message);
    e.currentTarget.reset();
    setAddMode(false);
    setClickPt(null);
  }

  return (
    <div className="container my-3">
      <div className="map-toolbar d-flex gap-2 mb-2">
        <button
          className={`btn btn-sm ${addMode ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setAddMode((v) => !v)}
          title="Add Location"
        >
          {addMode ? "Adding… (click map)" : "Add Location"}
        </button>
        {err && <div className="text-danger small align-self-center">{err}</div>}
      </div>

      <div className="map-wrap" ref={wrapRef} onClick={mapClick}>
        <img ref={imgRef} src="/WMmap.jpg" alt="World map" className="map-img" />
        <div className="map-overlay">
          {locs.map((l) => {
            const x = l.x_pct ?? (l.x * 100) ?? 0;
            const y = l.y_pct ?? (l.y * 100) ?? 0;
            return (
              <div
                key={l.id}
                className="map-pin"
                style={{ left: `${x}%`, top: `${y}%` }}
                title={l.name}
                onClick={(ev) => {
                  ev.stopPropagation();
                  alert(`${l.name}\n\n${l.description || ""}`);
                }}
              />
            );
          })}
          {/* Preview pin while adding */}
          {addMode && clickPt && (
            <div className="map-pin" style={{ left: `${clickPt.x_pct}%`, top: `${clickPt.y_pct}%`, background:"#ffc107" }} />
          )}
        </div>
      </div>

      {/* Add location modal */}
      <div className="modal fade" id="addLocModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog">
          <form className="modal-content" onSubmit={createLocation}>
            <div className="modal-header">
              <h5 className="modal-title">New Location</h5>
              <button className="btn-close" data-bs-dismiss="modal" aria-label="Close"/>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Name</label>
                <input name="name" className="form-control" required />
              </div>
              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea name="description" className="form-control" rows="3" />
              </div>
              {clickPt && (
                <div className="small text-muted">
                  Position: {clickPt.x_pct.toFixed(2)}%, {clickPt.y_pct.toFixed(2)}%
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button className="btn btn-primary" type="submit">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

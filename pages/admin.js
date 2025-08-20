// pages/admin.js
import { useEffect, useMemo, useState } from "react";
import AssignItemButton from "../components/AssignItemButton";
import ItemCard from "../components/ItemCard";
import { classifyUi, TYPE_PILLS, titleCase } from "../utils/itemsIndex";

export default function AdminPanel() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("All");
  const [type, setType] = useState("All"); // consolidated UI label or a raw code (for unsorted)
  const [selected, setSelected] = useState(null);

  async function ensureLoaded() {
    if (loaded) return;
    try {
      setLoading(true);
      const res = await fetch("/items/all-items.json");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
      setLoaded(true);
    } catch {
      setItems([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => ensureLoaded(), 300);
    return () => clearTimeout(t);
  }, []);

  // Rarities ("none" → Mundane)
  const rarities = useMemo(() => {
    const set = new Set(
      items.map((i) => String(i.rarity || i.item_rarity || "")).filter(Boolean)
    );
    const pretty = new Set(
      [...set].map((r) => (r.toLowerCase() === "none" ? "Mundane" : titleCase(r)))
    );
    return ["All", ...Array.from(pretty).sort()];
  }, [items]);

  // Attach uiType to each item once for cheaper filtering
  const itemsWithUi = useMemo(
    () => items.map((it) => ({ ...it, __cls: classifyUi(it) })),
    [items]
  );

  // Build dropdown options: consolidated + any remaining raw codes
  const typeOptions = useMemo(() => {
    const known = new Set(TYPE_PILLS.map((p) => p.key));
    const consolidated = new Set(
      itemsWithUi.map((it) => it.__cls.uiType).filter(Boolean)
    );
    const raw = new Set(
      itemsWithUi
        .map((it) => (!it.__cls.uiType ? it.__cls.rawType : null))
        .filter(Boolean)
    );
    return ["All", ...Array.from(new Set([...known, ...consolidated])).sort(), ...Array.from(raw).sort()];
  }, [itemsWithUi]);

  // Filtering
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (itemsWithUi || []).filter((it) => {
      const name = (it.name || it.item_name || "").toLowerCase();
      const rRaw = String(it.rarity || it.item_rarity || "");
      const rPretty = rRaw.toLowerCase() === "none" ? "Mundane" : titleCase(rRaw);
      const uiType = it.__cls.uiType;
      const rawType = it.__cls.rawType;

      const okText = !q || name.includes(q);
      const okR = rarity === "All" || rPretty === rarity;

      let okT = true;
      if (type !== "All") {
        okT = uiType ? uiType === type : rawType === type;
      }
      return okText && okR && okT;
    });
  }, [itemsWithUi, search, rarity, type]);

  useEffect(() => {
    if (!selected && filtered.length) setSelected(filtered[0]);
  }, [filtered, selected]);

  return (
    <div className="container my-4 admin-dark">
      <h1 className="h3 mb-3">🧭 Admin Dashboard</h1>

      {/* Controls */}
      <div className="row g-3 align-items-end mb-2">
        <div className="col-12 col-lg-5">
          <label className="form-label fw-semibold">Search by name</label>
          <div className="input-group">
            <span className="input-group-text">🔎</span>
            <input
              type="text"
              className="form-control"
              value={search}
              onFocus={ensureLoaded}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Mace of Disruption"
            />
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <label className="form-label fw-semibold">Rarity</label>
          <select
            className="form-select"
            value={rarity}
            onFocus={ensureLoaded}
            onChange={(e) => setRarity(e.target.value)}
          >
            {rarities.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="col-6 col-lg-2">
          <label className="form-label fw-semibold">Type</label>
          <select
            className="form-select"
            value={type}
            onFocus={ensureLoaded}
            onChange={(e) => setType(e.target.value)}
          >
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="col-12 col-lg-2">
          <button
            className="btn btn-outline-secondary w-100"
            onClick={ensureLoaded}
            disabled={loading || loaded}
          >
            {loaded ? "Loaded" : loading ? "Loading…" : "Load Items"}
          </button>
        </div>
      </div>

      {/* Type pills (replaces old slot pills) */}
      <div className="mb-3 d-flex flex-wrap gap-2">
        {TYPE_PILLS.map((p) => {
          const active = type === p.key || (p.key === "All" && type === "All");
          return (
            <button
              key={p.key}
              type="button"
              className={`btn btn-sm ${active ? "btn-light text-dark" : "btn-outline-light"}`}
              onClick={() => setType(p.key)}
              onFocus={ensureLoaded}
              title={p.key}
            >
              <span className="me-1">{p.icon}</span>
              {p.key}
            </button>
          );
        })}
      </div>

      <div className="row g-4">
        {/* Results list */}
        <div className="col-12 col-lg-5">
          <div className="card bg-dark text-light border-0 shadow-sm">
            <div className="card-header d-flex justify-content-between align-items-center bg-dark border-light-subtle">
              <span className="fw-semibold">Results</span>
              <span className="text-muted small">{filtered.length}</span>
            </div>
            <div className="list-group list-group-flush" style={{ maxHeight: 520, overflowY: "auto" }}>
              {!loaded && <div className="p-3 text-muted">Start typing to load the catalog…</div>}

              {loaded && filtered.slice(0, 250).map((it, i) => {
                const active = selected === it;
                const name = it.name || it.item_name;
                const rRaw = String(it.rarity || it.item_rarity || "");
                const rPretty = rRaw.toLowerCase() === "none" ? "Mundane" : titleCase(rRaw);
                const label = it.__cls.uiType || titleCase(it.__cls.rawType);

                return (
                  <button
                    key={it.id || i}
                    className={`list-group-item list-group-item-action ${active ? "active" : "bg-dark text-light"}`}
                    onClick={() => setSelected(it)}
                  >
                    <div className="d-flex justify-content-between">
                      <span className="fw-semibold">{name}</span>
                      <span className="badge bg-secondary ms-2">{rPretty || "—"}</span>
                    </div>
                    <div className="small text-muted">{label}</div>
                  </button>
                );
              })}

              {loaded && filtered.length === 0 && <div className="p-3 text-muted">No matches.</div>}
            </div>
          </div>
        </div>

        {/* Preview + Assign */}
        <div className="col-12 col-lg-7">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h2 className="h5 m-0">Preview</h2>
            {selected && <AssignItemButton item={selected} />}
          </div>

          {!selected ? (
            <div className="text-muted fst-italic">Select an item to preview.</div>
          ) : (
            <div className="row g-3">
              <div className="col-12 col-md-10 col-lg-9">
                <ItemCard item={selected} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

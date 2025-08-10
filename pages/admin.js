import { useEffect, useMemo, useState } from "react";
import AssignItemButton from "../components/AssignItemButton";
import ItemCard from "../components/ItemCard";

/** 5eTools → friendly text */
const TYPE_MAP = {
  A: "Ammunition", AT: "Artisan’s Tools", G: "Adventuring Gear", GS: "Gaming Set",
  INS: "Instrument", LA: "Light Armor", MA: "Medium Armor", HA: "Heavy Armor",
  M: "Melee Weapon", R: "Ranged Weapon", S: "Shield", SCF: "Spellcasting Focus",
  P: "Potion", RD: "Rod", RG: "Ring", WD: "Wand", ST: "Staff", W: "Wondrous Item", T: "Tool",
};

const SLOT_OPTIONS = [
  { id: "all", label: "All", emoji: "✨" },
  { id: "head", label: "Head", emoji: "🪖" },
  { id: "neck", label: "Neck", emoji: "🧿" },
  { id: "shoulders", label: "Shoulders", emoji: "🧣" },
  { id: "hands", label: "Hands", emoji: "🧤" },
  { id: "finger", label: "Finger", emoji: "💍" },
  { id: "waist", label: "Waist", emoji: "🧷" },
  { id: "feet", label: "Feet", emoji: "🥾" },
  { id: "body", label: "Armor", emoji: "🛡️" },
  { id: "shield", label: "Shield", emoji: "🛡" },
  { id: "weapon", label: "Weapon", emoji: "⚔️" },
  { id: "instrument", label: "Instrument", emoji: "🎻" },
  { id: "worn", label: "Wondrous", emoji: "🧵" },
];

/** crude slot guesser (name + type + text heuristics) */
function guessSlot(it) {
  const t = (it.type || it.item_type || "").toString();
  const n = (it.name || it.item_name || "").toLowerCase();
  const text = [
    n,
    (it.item_description || it.description || ""),
    JSON.stringify(it.entries || ""),
  ]
    .join(" ")
    .toLowerCase();

  // Type-driven
  if (t === "LA" || t === "MA" || t === "HA") return "body";
  if (t === "S") return "shield";
  if (t === "RG") return "finger";
  if (t === "M" || t === "R" || t === "WD" || t === "ST" || t === "RD") return "weapon";
  if (t === "INS") return "instrument";

  // Name/Text-driven
  if (n.includes("ring")) return "finger";
  if (n.includes("boots") || text.includes("boots")) return "feet";
  if (
    n.includes("gloves") ||
    n.includes("gauntlets") ||
    n.includes("bracers") ||
    text.includes("gloves") ||
    text.includes("gauntlets") ||
    text.includes("bracers")
  )
    return "hands";
  if (n.includes("belt") || text.includes("belt")) return "waist";
  if (
    n.includes("cloak") ||
    n.includes("cape") ||
    n.includes("mantle") ||
    text.includes("cloak") ||
    text.includes("cape") ||
    text.includes("mantle")
  )
    return "shoulders";
  if (
    n.includes("helm") ||
    n.includes("helmet") ||
    n.includes("hat") ||
    n.includes("circlet") ||
    n.includes("diadem") ||
    n.includes("crown") ||
    text.includes("helm") ||
    text.includes("helmet") ||
    text.includes("hat") ||
    text.includes("circlet") ||
    text.includes("diadem") ||
    text.includes("crown")
  )
    return "head";
  if (
    n.includes("amulet") ||
    n.includes("necklace") ||
    n.includes("pendant") ||
    n.includes("talisman") ||
    text.includes("amulet") ||
    text.includes("necklace") ||
    text.includes("pendant") ||
    text.includes("talisman")
  )
    return "neck";

  // default
  return "worn";
}

export default function AdminPanel() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("All");
  const [type, setType] = useState("All");
  const [slot, setSlot] = useState("all");

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
    // quiet prefetch
    const t = setTimeout(() => ensureLoaded(), 300);
    return () => clearTimeout(t);
  }, []);

  const rarities = useMemo(() => {
    const set = new Set(items.map((i) => i.rarity || i.item_rarity).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [items]);

  const types = useMemo(() => {
    const set = new Set(items.map((i) => i.type || i.item_type).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items || []).filter((it) => {
      const name = (it.name || it.item_name || "").toLowerCase();
      const r = (it.rarity || it.item_rarity || "").toString();
      const t = (it.type || it.item_type || "").toString();
      const slotGuess = guessSlot(it);

      const okText = !q || name.includes(q);
      const okR = rarity === "All" || r === rarity;
      const okT = type === "All" || t === type;
      const okS = slot === "all" || slotGuess === slot;

      return okText && okR && okT && okS;
    });
  }, [items, search, rarity, type, slot]);

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
              <option key={r} value={r}>
                {r}
              </option>
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
            {types.map((t) => (
              <option key={t} value={t}>
                {TYPE_MAP[t] || t}
              </option>
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

      {/* Slot filter row (clickable pills) */}
      <div className="mb-3 d-flex flex-wrap gap-2">
        {SLOT_OPTIONS.map((s) => {
          const active = slot === s.id;
          return (
            <button
              key={s.id}
              type="button"
              className={`btn btn-sm slot-pill ${
                active ? "btn-light text-dark" : "btn-outline-light"
              }`}
              onClick={() => setSlot(s.id)}
              onFocus={ensureLoaded}
              title={s.label}
            >
              <span className="me-1">{s.emoji}</span>
              {s.label}
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
              {loaded &&
                filtered.slice(0, 200).map((it, i) => {
                  const active = selected === it;
                  const name = it.name || it.item_name;
                  const r = (it.rarity || it.item_rarity || "").toString();
                  const t = TYPE_MAP[it.type] || it.type || it.item_type || "Item";
                  const s = guessSlot(it);
                  return (
                    <button
                      key={it.id || i}
                      className={`list-group-item list-group-item-action ${
                        active ? "active" : "bg-dark text-light"
                      }`}
                      onClick={() => setSelected(it)}
                    >
                      <div className="d-flex justify-content-between">
                        <span className="fw-semibold">{name}</span>
                        <span className="badge bg-secondary ms-2">{r}</span>
                      </div>
                      <div className="small text-muted">
                        {t}
                        <span className="ms-2">• Slot: {s}</span>
                      </div>
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
            {selected && (
              <div>
                <AssignItemButton item={selected} />
              </div>
            )}
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

import { useEffect, useMemo, useRef, useState } from "react";
import AssignItemButton from "../components/AssignItemButton";
import ItemCard from "../components/ItemCard";
import { classifyUi, TYPE_PILLS, titleCase } from "../utils/itemsIndex";
import dynamic from "next/dynamic";

const VariantBuilder = dynamic(
  () => import("../components/MagicVariantBuilder").then((m) => m.default || m),
  { ssr: false }
);

export default function AdminPanel() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("All");
  const [type, setType] = useState("All");
  const [selected, setSelected] = useState(null);

  const [showBuilder, setShowBuilder] = useState(false);
  const [stagedCustom, setStagedCustom] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__FLAVOR_OVERRIDES__ = window.__FLAVOR_OVERRIDES__ || {};
    }
  }, []);

  const looksVariant = (v) =>
    v && typeof v === "object" && (
      v.name || v.entries || v.item_description ||
      v.delta || v.mod || v.effects ||
      v.bonusWeapon || v.bonusAc || v.bonusShield || v.bonusSpellAttack || v.bonusSpellSaveDc
    );

  function collectVariants(node) {
    const out = [];
    if (!node) return out;
    if (Array.isArray(node)) {
      node.forEach((n) => out.push(...collectVariants(n)));
      return out;
    }
    if (typeof node === "object") {
      if (looksVariant(node)) out.push(node);
      Object.values(node).forEach((v) => out.push(...collectVariants(v)));
    }
    return out;
  }
  const normalizeVariants = (payload) => collectVariants(payload);

  useEffect(() => {
    let die = false;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch("/items/all-items.json");
        const data = r.ok ? await r.json() : [];
        if (!die) {
          setItems(Array.isArray(data) ? data : []);
          if (typeof window !== "undefined") window.__ALL_ITEMS__ = Array.isArray(data) ? data : [];
        }
      } finally {
        if (!die) { setLoading(false); setLoaded(true); }
      }
    })();
    return () => { die = true; };
  }, []);

  // 🔁 Always (re)load variant packs when the builder opens
  useEffect(() => {
    if (!showBuilder) return;
    let dead = false;
    (async () => {
      const files = [
        "/items/magicvariants.json",
        "/items/magicvariants.hb-armor-shield.json"
      ];
      const merged = [];
      const seen = new Set();

      for (const url of files) {
        try {
          const r = await fetch(url, { cache: "no-store" });
          if (!r.ok) { console.warn("Variant pack not found:", url, r.status); continue; }
          const payload = await r.json();
          const list = normalizeVariants(payload);
          for (const v of list) {
            const k = (String(v.key || "").trim().toLowerCase()) ||
                      (String(v.name || "").trim().toLowerCase() + "::" +
                        (Array.isArray(v.appliesTo) ? [...v.appliesTo].sort().join(",") : ""));
            if (!k || seen.has(k)) continue;
            seen.add(k);
            merged.push(v);
          }
        } catch (e) {
          console.error("Failed loading", url, e);
        }
      }

      if (!dead && typeof window !== "undefined") {
        window.__MAGIC_VARIANTS__ = merged;
        console.log(`[variants] loaded ${merged.length} entries from ${files.length} packs.`);
      }
    })();
    return () => { dead = true; };
  }, [showBuilder]);

  const itemsWithUi = useMemo(() => {
    return items.map((it) => {
      const cls = classifyUi(it);
      const name = String(it.name || it.item_name || "");
      if (/^orb of shielding\b/i.test(name)) cls.uiType = "Wondrous Item";
      else if (/^imbued wood\b/i.test(name)) cls.uiType = "Melee Weapon";

      const ageRaw = String(it.age || it.age_category || it.age_group || "").toLowerCase();
      const looksLikeFirearm = /(pistol|rifle|musket|revolver|firearm|shotgun|smg|carbine)/i.test(name.toLowerCase());
      if (["futuristic","renaissance","modern","contemporary","industrial","victorian"].includes(ageRaw) || looksLikeFirearm) {
        cls.uiType = "Future";
      }
      return { ...it, __cls: cls };
    });
  }, [items]);

  const rarities = useMemo(() => {
    const set = new Set(items.map((i) => String(i.rarity || i.item_rarity || "").trim()).filter(Boolean));
    const pretty = new Set([...set].map((r) => (r.toLowerCase() === "none" ? "Mundane" : titleCase(r))));
    return ["All", ...Array.from(pretty).sort()];
  }, [items]);

  const typeOptions = useMemo(() => {
    const known = new Set(TYPE_PILLS.map((p) => p.key));
    const consolidated = new Set(itemsWithUi.map((it) => it.__cls.uiType).filter(Boolean));
    const raw = new Set(itemsWithUi.map((it) => (!it.__cls.uiType ? it.__cls.rawType : null)).filter(Boolean));
    return ["All", ...Array.from(new Set([...known, ...consolidated])).sort(), ...Array.from(raw).sort()];
  }, [itemsWithUi]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return itemsWithUi.filter((it) => {
      const name = (it.name || it.item_name || "").toLowerCase();
      const rRaw = String(it.rarity || it.item_rarity || "");
      const rPretty = rRaw.toLowerCase() === "none" ? "Mundane" : titleCase(rRaw);
      const uiType = it.__cls.uiType;
      const rawType = it.__cls.rawType;
      const okText = !q || name.includes(q);
      const okR = rarity === "All" || rPretty === rarity;
      let okT = true;
      if (type !== "All") okT = uiType ? uiType === type : rawType === type;
      const isFuture = it.__cls.uiType === "Future";
      if (type !== "Future" && isFuture) return false;
      return okText && okR && okT;
    });
  }, [itemsWithUi, search, rarity, type]);

  useEffect(() => { if (!selected && filtered.length) setSelected(filtered[0]); }, [filtered, selected]);

  function ErrorBoundary({ children }) {
    const [err, setErr] = useState(null);
    const resetKey = useRef(0);
    if (err) {
      return (
        <div className="container my-5 text-center">
          <h2 className="h5">Something went wrong.</h2>
          <p className="text-muted small">{String(err.message || err)}</p>
          <button className="btn btn-outline-light" onClick={() => { setErr(null); resetKey.current++; }}>Retry</button>
        </div>
      );
    }
    return <BoundaryImpl onError={(e) => setErr(e)} key={resetKey.current}>{children}</BoundaryImpl>;
  }
  function BoundaryImpl({ onError, children }) { try { return <>{children}</>; } catch (e) { onError?.(e); return null; } }

  return (
    <ErrorBoundary>
      <div className="container my-4 admin-dark">
        <h1 className="h3 mb-3">🧭 Admin Dashboard</h1>

        <div className="row g-2 align-items-end">
          <div className="col-12 col-lg-4">
            <label className="form-label fw-semibold">Search</label>
            <input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. Mace of Disruption"/>
          </div>

          <div className="col-6 col-lg-3">
            <label className="form-label fw-semibold">Rarity</label>
            <select className="form-select" value={rarity} onChange={(e) => setRarity(e.target.value)}>
              {rarities.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="col-6 col-lg-3">
            <label className="form-label fw-semibold">Type</label>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
              {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="col-12 col-lg-2 d-flex gap-2">
            <button className="btn btn-outline-secondary flex-fill" disabled={loading || loaded}>
              {loaded ? "Loaded" : loading ? "Loading…" : "Load Items"}
            </button>
            <button className="btn btn-primary flex-fill" onClick={() => { setShowBuilder(true); setStagedCustom(null); }} title="Build a magic variant from a mundane base">
              Build Magic Variant
            </button>
          </div>
        </div>

        <div className="mb-3 d-flex flex-wrap gap-2">
          {TYPE_PILLS.map((p) => {
            const active = type === p.key || (p.key === "All" && type === "All");
            return (
              <button key={p.key} type="button" className={`btn btn-sm ${active ? "btn-light text-dark" : "btn-outline-light"}`} onClick={() => setType(p.key)} title={p.key}>
                <span className="me-1">{p.icon}</span>{p.key}
              </button>
            );
          })}
        </div>

        <div className="row g-3">
          <div className="col-12 col-lg-5">
            <div className="list-group list-group-flush">
              {filtered.map((it, i) => {
                const active = selected === it && !stagedCustom;
                const name = it.name || it.item_name;
                const rRaw = String(it.rarity || it.item_rarity || "");
                const rPretty = rRaw.toLowerCase() === "none" ? "Mundane" : titleCase(rRaw);
                const label = it.__cls.uiType || titleCase(it.__cls.rawType);
                return (
                  <button key={it.id || i} className={`list-group-item list-group-item-action ${active ? "active" : "bg-dark text-light"}`} onClick={() => { setSelected(it); setStagedCustom(null); }}>
                    <div className="d-flex justify-content-between">
                      <span className="fw-semibold">{name}</span>
                      <span className="badge bg-secondary ms-2">{rPretty || "—"}</span>
                    </div>
                    <div className="small text-muted">{label}</div>
                  </button>
                );
              })}
              {filtered.length === 0 && <div className="p-3 text-muted">No matches.</div>}
            </div>
          </div>

          <div className="col-12 col-lg-7">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h2 className="h5 m-0">Preview</h2>
              {(stagedCustom || selected) && (
                <AssignItemButton item={{ ...(stagedCustom || selected), id: (stagedCustom?.id) || (selected?.id) || `VAR-${Date.now()}` }} />
              )}
            </div>

            {!(stagedCustom || selected) ? (
              <div className="text-muted fst-italic">Select an item to preview.</div>
            ) : (
              <div className="row g-3">
                <div className="col-12 col-md-10 col-lg-9">
                  <ItemCard item={stagedCustom || selected} />
                </div>
              </div>
            )}
          </div>
        </div>

        <VariantBuilder
          open={showBuilder}
          onClose={() => setShowBuilder(false)}
          baseItem={selected}
          allItems={itemsWithUi}
          onBuild={(obj) => {
            const withId = { id: `VAR-${Date.now()}`, ...obj, __cls: classifyUi(obj) };
            setStagedCustom(withId);
            setShowBuilder(false);
          }}
        />
      </div>
    </ErrorBoundary>
  );
}

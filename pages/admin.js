import { useEffect, useMemo, useRef, useState } from "react";
import AssignItemButton from "../components/AssignItemButton";
import { createClient } from "@supabase/supabase-js";
import ItemCard from "../components/ItemCard";
import { classifyUi, TYPE_PILLS, titleCase } from "../utils/itemsIndex";
import dynamic from "next/dynamic";

// Small debounce hook to keep Search smooth and focused
function useDebounced(value, delay = 180) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

// Client-only load for the Variant Builder
const VariantBuilder = dynamic(
  () => import("../components/MagicVariantBuilder").then((m) => m.default || m),
  { ssr: false }
);

export default function AdminPanel() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Raw search text + debounced value used for filtering
  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebounced(searchRaw, 180);

  const [rarity, setRarity] = useState("All");
  const [type, setType] = useState("All");
  const [selected, setSelected] = useState(null);

  // Modal + data
  const [showBuilder, setShowBuilder] = useState(false);
  const [magicVariants, setMagicVariants] = useState(null);
  const [stagedCustom, setStagedCustom] = useState(null);

  // Supabase client for admin operations
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Owner selection for assigning items
  const [assignOwnerType, setAssignOwnerType] = useState("player");
  const [assignOwnerId, setAssignOwnerId] = useState("");
  const [assignPlayers, setAssignPlayers] = useState([]);
  const [assignNpcs, setAssignNpcs] = useState([]);
  const [assignMerchants, setAssignMerchants] = useState([]);

  // ---- benign flavor override patch (unchanged) ----
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__FLAVOR_OVERRIDES__ = window.__FLAVOR_OVERRIDES__ || {};
      const origFetch = window.fetch;
      if (!origFetch.__flavorPatch) {
        const patched = async (input, init) => {
          try {
            const url = typeof input === "string" ? input : input?.url;
            if (url && url.includes("/items/flavor-overrides.finished.json")) {
              try {
                const r2 = await origFetch("/items/flavor-overrides.json", init);
                if (r2 && r2.ok) return r2;
              } catch {}
              const blob = new Blob([JSON.stringify({})], { type: "application/json" });
              return new Response(blob, { status: 200, headers: { "Content-Type": "application/json" } });
            }
          } catch {}
          return origFetch(input, init);
        };
        patched.__flavorPatch = true;
        window.fetch = patched;
      }
      (async () => {
        try {
          const r = await fetch("/items/flavor-overrides.finished.json");
          if (r.ok) {
            window.__FLAVOR_OVERRIDES__ = await r.json();
            return;
          }
        } catch {}
        try {
          const r2 = await fetch("/items/flavor-overrides.json");
          if (r2.ok) window.__FLAVOR_OVERRIDES__ = await r2.json();
        } catch {}
      })();
    }
  }, []);

  /* ----------------- Variant file normalizer (robust) ----------------- */
  const looksVariant = (v) =>
    v && typeof v === "object" && (
      v.name || v.effects || v.delta || v.mod || v.entries || v.item_description ||
      v.bonusWeapon || v.bonusAc || v.bonusShield || v.bonusSpellAttack || v.bonusSpellSaveDc
    );

  function collectVariants(node) {
    const out = [];
    if (!node) return out;
    if (Array.isArray(node)) {
      for (const v of node) out.push(...collectVariants(v));
      return out;
    }
    if (typeof node === "object") {
      if (looksVariant(node)) out.push(node);
      else if (Array.isArray(node.items)) out.push(...collectVariants(node.items));
      else {
        for (const [k, v] of Object.entries(node)) {
          const kids = collectVariants(v);
          for (const child of kids) {
            if (!child.name && typeof k === "string") child.name = k;
            out.push(child);
          }
        }
      }
    }
    return out;
  }
  const normalizeVariants = (vjson) => collectVariants(vjson);

  /* -------------------------- Data loading --------------------------- */
  useEffect(() => {
    let die = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/items/all-items.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        if (!die) {
          setItems(list);
          if (typeof window !== "undefined") window.__ALL_ITEMS__ = list;
        }
      } catch (e) {
        console.error("Failed to load all-items.json:", e);
      } finally {
        if (!die) {
          setLoading(false);
          setLoaded(true);
        }
      }
    })();
    return () => { die = true; };
  }, []);

  // --- Preload variant packs once, merge & dedupe; pass to builder prop ---
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const files = [
          "/items/magicvariants.json",
          "/items/magicvariants.hb-armor-shield.json"
        ];
        const payloads = await Promise.all(
          files.map(async (url) => {
            try {
              const r = await fetch(url);
              if (!r.ok) return null;
              return await r.json();
            } catch { return null; }
          })
        );
        const merged = [];
        const seen = new Set();
        for (const payload of payloads) {
          if (!payload) continue;
          const list = normalizeVariants(payload);
          for (const v of list) {
            const k =
              String(v.key || "").trim().toLowerCase() ||
              `${String(v.name || "").trim().toLowerCase()}::${(Array.isArray(v.appliesTo) ? v.appliesTo : [])
                .slice().sort().join(",")}`;
            if (!k || seen.has(k)) continue;
            seen.add(k);
            merged.push(v);
          }
        }
        if (!dead) {
          setMagicVariants(merged);
          if (typeof window !== "undefined") window.__MAGIC_VARIANTS__ = merged;
        }
      } catch (e) {
        console.error("Failed to load variant packs:", e);
        if (!dead) setMagicVariants([]);
      }
    })();
    return () => { dead = true; };
  }, []);

  // Load players, NPCs and merchants for assigning items
  useEffect(() => {
    (async () => {
      try {
        const { data: p } = await supabase.from("players").select("user_id,name").order("name");
        setAssignPlayers(p || []);
      } catch {}
      try {
        const { data: n } = await supabase.from("npcs").select("id,name").order("name");
        setAssignNpcs(n || []);
      } catch {}
      try {
        const { data: m } = await supabase.from("merchants").select("id,name").order("name");
        setAssignMerchants(m || []);
      } catch {}
    })();
  }, [supabase]);

  /* ------------------------ Filtering helpers ------------------------ */
  const rarities = useMemo(() => {
    const set = new Set(items.map((i) => String(i.rarity || i.item_rarity || "").trim()).filter(Boolean));
    const pretty = new Set([...set].map((r) => (r.toLowerCase() === "none" ? "Mundane" : titleCase(r))));
    return ["All", ...Array.from(pretty).sort()];
  }, [items]);

  const itemsWithUi = useMemo(() => {
    return items.map((it) => {
      const cls = classifyUi(it);
      const name = String(it.name || it.item_name || "");

      // Tricky overrides
      if (/^orb of shielding\b/i.test(name)) cls.uiType = "Wondrous Item";
      else if (/^imbued wood\b/i.test(name)) cls.uiType = "Melee Weapon";

      // Tech/age gating
      const ageRaw = String(it.age || it.age_category || it.age_group || "").toLowerCase();
      const nameL = name.toLowerCase();
      const looksLikeFirearm = /(pistol|rifle|musket|revolver|firearm|shotgun|smg|carbine)/i.test(nameL);
      if (
        ["futuristic", "renaissance", "modern", "contemporary", "industrial", "victorian"].includes(ageRaw) ||
        looksLikeFirearm
      ) cls.uiType = "Future";

      return { ...it, __cls: cls };
    });
  }, [items]);

  const typeOptions = useMemo(() => {
    const known = new Set(TYPE_PILLS.map((p) => p.key));
    const consolidated = new Set(itemsWithUi.map((it) => it.__cls.uiType).filter(Boolean));
    const raw = new Set(itemsWithUi.map((it) => (!it.__cls.uiType ? it.__cls.rawType : null)).filter(Boolean));
    return [
      "All",
      ...Array.from(new Set([...known, ...consolidated])).sort(),
      ...Array.from(raw).sort()
    ];
  }, [itemsWithUi]);

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
      if (type !== "All") okT = uiType ? uiType === type : rawType === type;
      const isFuture = it.__cls.uiType === "Future";
      if (type !== "Future" && isFuture) return false;
      return okText && okR && okT;
    });
  }, [itemsWithUi, search, rarity, type]);

  useEffect(() => {
    if (!selected && filtered.length) setSelected(filtered[0]);
  }, [filtered, selected]);

  function ErrorBoundary({ children }) {
    const [err, setErr] = useState(null);
    const resetKey = useRef(0);
    if (err) {
      return (
        <div className="container my-5 text-center">
          <h2 className="h5">Something went wrong.</h2>
          <p className="text-muted small">{String(err.message || err)}</p>
          <button className="btn btn-outline-light" onClick={() => { setErr(null); resetKey.current++; }}>
            Retry
          </button>
        </div>
      );
    }
    return (
      <BoundaryImpl onError={(e) => setErr(e)} key={resetKey.current}>
        {children}
      </BoundaryImpl>
    );
  }
  function BoundaryImpl({ onError, children }) {
    try { return <>{children}</>; } catch (e) { onError?.(e); return null; }
  }

  return (
    <ErrorBoundary>
      <div className="container my-4 admin-dark">
        <h1 className="h3 mb-3">🧭 Admin Dashboard</h1>

        {/* Controls */}
        <div className="row g-2 align-items-end">
          <div className="col-12 col-lg-4">
            <label className="form-label fw-semibold">Search</label>
            <input
              className="form-control"
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              autoComplete="off"
              placeholder="e.g. Mace of Disruption"
            />
          </div>

          <div className="col-6 col-lg-3">
            <label className="form-label fw-semibold">Rarity</label>
            <select className="form-select" value={rarity} onChange={(e) => setRarity(e.target.value)}>
              {rarities.map((r) => (<option key={r} value={r}>{r}</option>))}
            </select>
          </div>

          <div className="col-6 col-lg-3">
            <label className="form-label fw-semibold">Type</label>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
              {typeOptions.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>

          <div className="col-12 col-lg-2 d-flex gap-2">
            <button className="btn btn-outline-secondary flex-fill" disabled={loading || loaded}>
              {loaded ? "Loaded" : loading ? "Loading…" : "Load Items"}
            </button>

            <button className="btn btn-primary flex-fill"
              onClick={() => { setShowBuilder(true); setStagedCustom(null); }}
              title="Build a magic variant from a mundane base">
              Build Magic Variant
            </button>
          </div>
        </div>

        {/* Type pills */}
        <div className="mb-3 d-flex flex-wrap gap-2">
          {TYPE_PILLS.map((p) => {
            const active = type === p.key || (p.key === "All" && type === "All");
            return (
              <button key={p.key} type="button"
                className={`btn btn-sm ${active ? "btn-light text-dark" : "btn-outline-light"}`}
                onClick={() => setType(p.key)} title={p.key}>
                <span className="me-1">{p.icon}</span>{p.key}
              </button>
            );
          })}
        </div>

        <div className="row g-3">
          {/* Results list */}
          <div className="col-12 col-lg-5">
            <div className="list-group list-group-flush">
              {filtered.map((it, i) => {
                const active = selected === it && !stagedCustom;
                const name = it.name || it.item_name;
                const rRaw = String(it.rarity || it.item_rarity || "");
                const rPretty = rRaw.toLowerCase() === "none" ? "Mundane" : titleCase(rRaw);
                const label = it.__cls.uiType || titleCase(it.__cls.rawType);
                return (
                  <button key={it.id || i}
                    className={`list-group-item list-group-item-action ${active ? "active" : "bg-dark text-light"}`}
                    onClick={() => { setSelected(it); setStagedCustom(null); }}>
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

          {/* Preview + Assign */}
          <div className="col-12 col-lg-7">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h2 className="h5 m-0">Preview</h2>
              {(stagedCustom || selected) && (
                <div className="d-flex flex-column align-items-end">
                  {/* Owner selection */}
                  <div className="d-flex align-items-center mb-1">
                    <label className="me-2 small fw-semibold">Assign to:</label>
                    <select
                      className="form-select form-select-sm me-2"
                      value={assignOwnerType}
                      onChange={(e) => {
                        setAssignOwnerType(e.target.value);
                        setAssignOwnerId("");
                      }}
                    >
                      <option value="player">Player</option>
                      <option value="npc">NPC</option>
                      <option value="merchant">Merchant</option>
                    </select>
                    <select
                      className="form-select form-select-sm"
                      value={assignOwnerId}
                      onChange={(e) => setAssignOwnerId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {assignOwnerType === "player" &&
                        assignPlayers.map((p) => (
                          <option key={p.user_id} value={p.user_id}>
                            {p.name}
                          </option>
                        ))}
                      {assignOwnerType === "npc" &&
                        assignNpcs.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.name}
                          </option>
                        ))}
                      {assignOwnerType === "merchant" &&
                        assignMerchants.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  {/* Assign button */}
                  <AssignItemButton
                    item={{
                      ...(stagedCustom || selected),
                      id: (stagedCustom?.id) || (selected?.id) || `VAR-${Date.now()}`,
                    }}
                    ownerType={assignOwnerId ? assignOwnerType : null}
                    ownerId={assignOwnerId || null}
                    onAssigned={() => {
                      // refresh or notify if needed
                    }}
                  >
                    Assign
                  </AssignItemButton>
                </div>
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

        {/* Builder receives merged variants explicitly */}
        <VariantBuilder
          open={showBuilder}
          onClose={() => setShowBuilder(false)}
          baseItem={selected}
          allItems={itemsWithUi}
          variantCatalog={magicVariants || []}
          onBuild={(obj) => {
            // Use the stats and text the builder preview produced as-is.
            const withId = {
              id: `VAR-${Date.now()}`,
              ...obj, // includes damageText/rangeText/propertiesText/ac, entries[], flavor
              name: obj.name,
              item_name: obj.name,
              item_rarity: obj.rarity,
              image_url:
                (selected && (selected.image_url || selected.img || selected.image)) ||
                "/placeholder.png",
            };
            withId.__cls = classifyUi(withId);
            setStagedCustom(withId);
            setShowBuilder(false);
          }}
        />
      </div>
    </ErrorBoundary>
  );
}

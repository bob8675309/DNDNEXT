// components/MagicVariantBuilder.js
// Upgrades:
// - Conflict-proof fixed overlay (no Bootstrap modal quirks)
// - Loading/error states for magicvariants.json fetch
// - ESC to close, click-outside to close, basic focus trap
// - Locks page scroll while open + autofocuses search
// - Kind pills (Auto/All/Weapons/Armor) + robust 5etools entry flattening
// - Keeps ALL original helpers and behavior

import { useEffect, useMemo, useRef, useState } from "react";

// Tiny helper: normalize strings
const norm = (s) => String(s || "").trim();

// --- normalize a variant label for display/compose
function normalizeVariantLabel(label) {
  const s = String(label || "").trim();
  // Strip leading "Weapon of ..." or "Armor of ..." → "of ..."
  return s.replace(/^(?:weapon|armor)\s+of\s+/i, "of ");
}

// --- flatten 5etools-style "entries" arrays into plaintext
function flattenEntries(entries) {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (typeof node === "string") {
      const t = node.replace(/\{@[^}]+}/g, (m) => {
        // light scrub of inline tags: {@damage 2d6} → 2d6, {@dc 15} → DC 15, etc.
        const inner = m.slice(2, -1).trim();
        const firstSpace = inner.indexOf(" ");
        if (firstSpace === -1) return inner;
        const tag = inner.slice(0, firstSpace).toLowerCase();
        const rest = inner.slice(firstSpace + 1).trim();
        if (tag === "dc") return `DC ${rest}`;
        if (tag === "damage") return rest;
        if (tag === "hit") return rest;
        if (tag === "variantrule") return rest.split("|")[0];
        if (tag === "spell" || tag === "item" || tag === "condition") return rest.split("|")[0];
        return rest;
      });
      out.push(t);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === "object") {
      if (node.entries) walk(node.entries);
      if (node.caption) out.push(String(node.caption));
      if (node.rows && Array.isArray(node.rows)) {
        // tables -> simple bullet lines
        node.rows.forEach((r) => {
          if (Array.isArray(r)) out.push(r.join(" — "));
        });
      }
    }
  };
  walk(entries);
  return out.join("\n\n").trim();
}

// A very tolerant guesser for item kind, so we can filter options sensibly
function guessKind(item) {
  const name = (item?.name || item?.item_name || "").toLowerCase();
  const type = (item?.type || item?.item_type || "").toLowerCase();
  const hay = `${name} ${type}`;

  if (/(armor|breastplate|chain|plate|leather|shield)/i.test(hay)) return "armor";
  if (/(sword|dagger|axe|mace|bow|crossbow|spear|polearm|maul|staff|club|whip|weapon)/i.test(hay)) return "weapon";
  return "any";
}

// --- derive likely variant kind from 5etools-like "requires" blocks
function guessVariantKind(variant) {
  // honors explicit appliesTo if present
  const at = variant?.appliesTo;
  if (Array.isArray(at)) {
    const hasW = at.some((a) => /weapon/i.test(a));
    const hasA = at.some((a) => /armor|shield/i.test(a));
    if (hasW && !hasA) return "weapon";
    if (hasA && !hasW) return "armor";
  }

  const reqs = Array.isArray(variant?.requires) ? variant.requires : [];
  let armorish = false;
  let weaponish = false;

  for (const r of reqs) {
    const keys = Object.keys(r || {}).map((k) => k.toLowerCase());
    const vals = Object.values(r || {}).map((v) => String(v || "").toLowerCase());
    const all = keys.join(" ") + " " + vals.join(" ");

    if (/(^|\W)(la|ma|ha|shield|s\|xphb)\b/.test(all) || /armor|shield/.test(all)) armorish = true;
    if (/(weapon|sword|axe|mace|bow|bolt|arrow|polearm|maul|club|whip)/.test(all)) weaponish = true;
    if (/ammo|ammunition|a\|xphb|af\|x dmg|af\|xdmg|type":"a/.test(JSON.stringify(r))) weaponish = true;
    if (r.weapon || r.sword || r.axe || r.bow) weaponish = true;
  }

  // Fallback to name sniff
  const name = String(variant?.name || "").toLowerCase();
  if (/armor|shield/.test(name)) armorish = armorish || true;
  if (/weapon|sword|axe|mace|bow|crossbow|spear|polearm|maul|club|whip/.test(name)) weaponish = weaponish || true;

  if (armorish && !weaponish) return "armor";
  if (weaponish && !armorish) return "weapon";
  return "any";
}

// Compose the display name from base + selected parts
function composeName(baseName, parts) {
  const pre = [];
  const suf = [];

  for (const p of parts) {
    const raw = p?.name || p?.label || p?.title || "";
    const label = normalizeVariantLabel(raw); // normalized label
    if (!label) continue;

    // Heuristics:
    // - "+1", "+2", "+3" -> prefix
    // - strings starting with "of " -> suffix
    // - otherwise suffix (conservative)
    if (/^\+\d/.test(label)) pre.push(label);
    else if (/^of\s+/i.test(label)) suf.push(label);
    else suf.push(label);
  }

  const left = pre.length ? pre.join(" ") + " " : "";
  const right = suf.length ? " " + suf.join(" ") : "";
  return `${left}${baseName}${right}`.replace(/\s+/g, " ").trim();
}

// Simple rarity ranker (adjust if you need finer control)
const RANK = {
  mundane: 0,
  common: 1,
  uncommon: 2,
  rare: 3,
  veryrare: 4,
  "very rare": 4,
  legendary: 5,
  artifact: 6,
};
function bestRarity(...vals) {
  let best = { v: -1, raw: "" };
  for (const r of vals) {
    if (!r) continue;
    const key = String(r).toLowerCase().replace(/-/g, "");
    const v = RANK[key] ?? -1;
    if (v > best.v) best = { v, raw: r };
  }
  return best.raw || vals.find(Boolean) || "";
}

// Merge text: base description + variant blurbs
function composeDescription(baseDesc, parts) {
  const extras = parts
    .map((p) => norm(p?.text || p?.description))
    .filter(Boolean);
  if (!extras.length) return baseDesc || "";
  return [norm(baseDesc), ...extras].filter(Boolean).join("\n\n");
}

// Apply structured changes if your magicvariants.json provides them.
// Supported keys (optional): { addProps, setProps, type, weight, cost, rarity }
function applyStructuredChanges(base, parts) {
  const out = { ...base };

  // Soft-merge props
  for (const p of parts) {
    const ch = p?.changes || p?.apply || {};
    const setProps = ch.setProps || {};
    const addProps = ch.addProps || {};

    Object.assign(out, setProps);
    for (const [k, v] of Object.entries(addProps)) {
      const cur = Number(out[k] ?? 0);
      const add = Number(v ?? 0);
      if (!Number.isNaN(cur) && !Number.isNaN(add)) out[k] = cur + add;
    }

    if (ch.type) out.type = ch.type;
    if (ch.weight) out.weight = ch.weight;
    if (ch.cost) out.cost = ch.cost;
    if (ch.rarity) out.rarity = ch.rarity;
  }

  return out;
}

// --- massage raw catalog items into a friendlier shape
function massageCatalog(raw) {
  return raw.map((v) => {
    const inherits = v?.inherits || {};
    const label = normalizeVariantLabel(v?.name || v?.label || v?.title || "");
    const rarity = v?.rarity || inherits?.rarity || "";
    const entries = v?.entries || inherits?.entries || [];
    const text = v?.text || v?.description || flattenEntries(entries);

    const kind = guessVariantKind(v);

    return {
      ...v,
      name: label || v?.name,
      rarity,
      text,
      _kind: kind, // weapon | armor | any
    };
  });
}

export default function MagicVariantBuilder({
  open,
  onClose,
  baseItem,
  onBuild,
}) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState([]); // array of up to 4 entries
  const [pill, setPill] = useState("auto"); // 'auto' | 'all' | 'weapon' | 'armor'

  // Load catalog (from /public/items/) only when opened
  useEffect(() => {
    if (!open) return;
    let die = false;
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch("/items/magicvariants.json", { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const arr = Array.isArray(data) ? data : Array.isArray(data?.variants) ? data.variants : [];
        const massaged = massageCatalog(arr);
        if (!die) setCatalog(massaged);
      } catch (e) {
        if (die || e?.name === "AbortError") return;
        console.error("Failed to load magicvariants.json", e);
        if (!die) { setError("Could not load magicvariants.json"); setCatalog([]); }
      } finally {
        if (!die) setLoading(false);
      }
    })();
    return () => { die = true; ctrl.abort(); };
  }, [open]);

  // Reset picks when base changes or modal opens
  useEffect(() => {
    if (open) setPicked([]);
  }, [open, baseItem?.name || baseItem?.item_name]);

  const kind = useMemo(() => guessKind(baseItem), [baseItem]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    // Which kind to filter by: 'any' means no filter
    const selectedKind = pill === "all" ? "any" : (pill === "auto" ? kind : pill);

    const applies = (v) => {
      const vKind = v?._kind || "any";
      if (selectedKind === "any") return true;
      if (vKind === "any") return true;
      return vKind === selectedKind;
    };

    return catalog
      .filter((v) => applies(v))
      .filter((v) => {
        if (!q) return true;
        const label = v?.name || v?.label || v?.title || "";
        const hay = `${label} ${v?.text || v?.description || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 200); // cheap guard
  }, [catalog, kind, query, pill]);

  const canPickMore = picked.length < 4;

  function addPick(v) {
    if (!canPickMore) return;
    const key = v?.key || v?.id || v?.name;
    if (key && picked.some((p) => (p?.key || p?.id || p?.name) === key)) return;
    setPicked((xs) => [...xs, v]);
  }

  function removePick(i) {
    setPicked((xs) => xs.filter((_, idx) => idx !== i));
  }

  function buildVariant() {
    if (!baseItem) return;

    const baseName = baseItem.name || baseItem.item_name || "Unnamed";
    const name = composeName(baseName, picked);

    const baseR = baseItem.rarity || baseItem.item_rarity;
    const partR = bestRarity(...picked.map((p) => p?.rarity));
    const rarity = bestRarity(baseR, partR);

    const baseDesc = baseItem.description || baseItem.item_description || "";
    const description = composeDescription(baseDesc, picked);

    // Start from a normalized base shape
    const base = {
      id: baseItem.id || baseItem.item_id || null,
      name: baseName,
      type: baseItem.type || baseItem.item_type || "",
      rarity: baseR || "",
      description: baseDesc,
      weight: baseItem.weight || baseItem.item_weight || "",
      cost: baseItem.cost || baseItem.item_cost || "",
    };

    // Structured merges (if your catalog provides them)
    const merged = applyStructuredChanges(base, picked);

    // Produce a stable-ish id for your inventory_items.item_id (not required to be UUID)
    const idParts = picked.map((p) => p?.key || p?.id || p?.name).filter(Boolean).join("+");
    const item_id = `${(base.id || base.name).replace(/\s+/g, "_")}::VAR::${idParts || "custom"}`;

    const out = {
      ...merged,
      id: item_id,                 // for UI components that expect .id
      item_id,                     // for AssignItemButton → inventory_items.item_id
      name,                        // for UI
      item_name: name,             // for AssignItemButton → inventory_items.item_name
      rarity,
      item_rarity: rarity,
      description,
      item_description: description,
      __isVariant: true,
      __variantParts: picked.map((p) => p?.key || p?.id || p?.name).filter(Boolean),
    };

    onBuild?.(out);
  }

  // ===== Presentation (custom overlay to avoid Bootstrap modal conflicts) =====
  if (!open) return null;

  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  // Lock page scroll + focus management
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const tid = setTimeout(() => searchRef.current?.focus(), 0);

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      } else if (e.key === "Tab") {
        // basic focus trap within panel
        const root = panelRef.current;
        if (!root) return;
        const nodes = root.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      clearTimeout(tid);
      document.documentElement.style.overflow = prev;
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onClose]);

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.6)",
    zIndex: 2000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
  };
  const panelStyle = {
    width: "min(960px, 95vw)",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: "0.75rem",
  };
  const bodyStyle = { overflowY: "auto" };

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose?.();
  };

  return (
    <div
      ref={overlayRef}
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-label="Build Magic Variant"
      onMouseDown={handleOverlayClick}
    >
      <div
        ref={panelRef}
        className="bg-dark text-light border-secondary shadow"
        style={panelStyle}
      >
        <div className="modal-header border-secondary">
          <h5 className="modal-title">Build Magic Variant</h5>
          <button className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
        </div>

        <div className="modal-body" style={bodyStyle}>
          <div className="mb-3">
            <div className="small text-muted">Base</div>
            <div className="fw-semibold">
              {(baseItem?.name || baseItem?.item_name) ?? "—"}
              <span className="ms-2 badge bg-secondary">
                {(baseItem?.rarity || baseItem?.item_rarity || "Mundane")}
              </span>
              {baseItem?.type || baseItem?.item_type ? (
                <span className="ms-2 small text-muted">{baseItem.type || baseItem.item_type}</span>
              ) : null}
            </div>
          </div>

          <div className="mb-2 d-flex align-items-center gap-2">
            <div className="btn-group btn-group-sm" role="group" aria-label="Variant kind filter">
              <button
                className={`btn ${pill==='auto' ? 'btn-primary' : 'btn-outline-light'} rounded-pill`}
                onClick={() => setPill('auto')}
                title="Follow base item kind"
              >
                Auto
              </button>
              <button
                className={`btn ${pill==='all' ? 'btn-primary' : 'btn-outline-light'} rounded-pill`}
                onClick={() => setPill('all')}
                title="Show all variants"
              >
                All
              </button>
              <button
                className={`btn ${pill==='weapon' ? 'btn-primary' : 'btn-outline-light'} rounded-pill`}
                onClick={() => setPill('weapon')}
                title="Weapon-only variants"
              >
                Weapons
              </button>
              <button
                className={`btn ${pill==='armor' ? 'btn-primary' : 'btn-outline-light'} rounded-pill`}
                onClick={() => setPill('armor')}
                title="Armor-only variants"
              >
                Armor
              </button>
            </div>

            <input
              ref={searchRef}
              className="form-control"
              placeholder="Search variants (e.g. +1, warning, flaming)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="small text-muted">Pick up to 4</span>
          </div>

          {loading && (
            <div className="alert alert-secondary py-2" role="status">Loading variants…</div>
          )}
          {error && (
            <div className="alert alert-danger py-2" role="alert">{error}</div>
          )}

          <div className="row g-2">
            <div className="col-12 col-md-7">
              <div className="list-group list-group-flush">
                {filtered.map((v, i) => {
                  const rawLabel = v?.name || v?.label || v?.title || "Variant";
                  const label = normalizeVariantLabel(rawLabel);
                  const text = v?.text || v?.description || "";
                  const r = v?.rarity;
                  const disabled = !canPickMore;
                  return (
                    <button
                      key={(v.key || v.id || rawLabel) + "::" + i}
                      disabled={disabled}
                      className={`list-group-item list-group-item-action bg-dark text-light border-secondary`}
                      onClick={() => addPick(v)}
                      title={text}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="fw-semibold">{label}</div>
                        {r ? <span className="badge bg-secondary">{r}</span> : null}
                      </div>
                      {text ? <div className="small text-muted mt-1" style={{ whiteSpace: 'pre-wrap' }}>{text}</div> : null}
                    </button>
                  );
                })}
                {!loading && filtered.length === 0 && (
                  <div className="p-3 text-muted">No matching variants.</div>
                )}
              </div>
            </div>

            <div className="col-12 col-md-5">
              <div className="card bg-black border-secondary">
                <div className="card-header border-secondary">Picked ({picked.length}/4)</div>
                <div className="list-group list-group-flush">
                  {picked.map((p, i) => (
                    <div key={(p.key || p.id || p.name || i) + "::picked"} className="list-group-item bg-dark text-light border-secondary d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold">{normalizeVariantLabel(p?.name || p?.label || p?.title || "Variant")}</div>
                        {p?.text ? <div className="small text-muted" style={{ whiteSpace: 'pre-wrap' }}>{p.text}</div> : null}
                      </div>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => removePick(i)}>Remove</button>
                    </div>
                  ))}
                  {picked.length === 0 && <div className="p-3 text-muted">Nothing picked yet.</div>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer border-secondary">
          <button className="btn btn-outline-light" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!baseItem} onClick={buildVariant}>
            Build Variant
          </button>
        </div>
      </div>
    </div>
  );
}

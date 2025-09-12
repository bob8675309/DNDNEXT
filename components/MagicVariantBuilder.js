// components/MagicVariantBuilder.js
// Upgrades:
// - Renders the modal via a React portal (document.body) to avoid parent stacking/overflow clipping
// - Adds loading/error states for the catalog fetch
// - ESC to close, click-outside to close, and a basic focus trap
// - Locks page scroll while open
// - Keeps ALL original helpers and behavior (no functions removed)

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Tiny helper: normalize strings
const norm = (s) => String(s || "").trim();

// A very tolerant guesser for item kind, so we can filter options sensibly
function guessKind(item) {
  const name = (item?.name || item?.item_name || "").toLowerCase();
  const type = (item?.type || item?.item_type || "").toLowerCase();
  const hay = `${name} ${type}`;

  if (/(armor|breastplate|chain|plate|leather|shield)/i.test(hay)) return "armor";
  if (/(sword|dagger|axe|mace|bow|crossbow|spear|polearm|maul|staff|club|whip|weapon)/i.test(hay)) return "weapon";
  return "any";
}

// Compose the display name from base + selected parts
function composeName(baseName, parts) {
  const pre = [];
  const suf = [];

  for (const p of parts) {
    const label = p?.name || p?.label || p?.title || "";
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
  }

  return out;
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
  const [mounted, setMounted] = useState(false); // portal safety for SSR

  // Ensure portal only renders on client
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Load catalog (from /public/items/) when opened
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
        if (!die) setCatalog(arr);
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

    // Try to honor an "appliesTo" convention if present in your JSON,
    // but fall back to "any" if not provided.
    const applies = (v) => {
      const arr = v?.appliesTo || v?.where || ["any"];
      if (!Array.isArray(arr)) return true;
      if (arr.includes("any")) return true;
      return arr.map(String).map((s) => s.toLowerCase()).includes(kind);
    };

    return catalog
      .filter((v) => applies(v))
      .filter((v) => {
        if (!q) return true;
        const hay = `${v?.name || v?.label || ""} ${v?.text || v?.description || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 200); // cheap guard
  }, [catalog, kind, query]);

  const canPickMore = picked.length < 4;

  function addPick(v) {
    if (!canPickMore) return;
    // Don’t add duplicate keys if provided by catalog
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

  // ===== Presentation (portal overlay to avoid Bootstrap/container conflicts) =====
  if (!open || !mounted) return null;

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
    // inline color fallback in case site styles override .bg-dark
    backgroundColor: "#111",
    color: "#eee",
    border: "1px solid rgba(255,255,255,.15)",
    boxShadow: "0 20px 50px rgba(0,0,0,.5)",
  };
  const bodyStyle = { overflowY: "auto" };

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose?.();
  };

  const content = (
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
        className="bg-dark text-light border-secondary"
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
                  const label = v?.name || v?.label || v?.title || "Variant";
                  const text = v?.text || v?.description || "";
                  const r = v?.rarity;
                  const disabled = !canPickMore;
                  return (
                    <button
                      key={(v.key || v.id || label) + "::" + i}
                      disabled={disabled}
                      className={`list-group-item list-group-item-action bg-dark text-light border-secondary`}
                      onClick={() => addPick(v)}
                      title={text}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="fw-semibold">{label}</div>
                        {r ? <span className="badge bg-secondary">{r}</span> : null}
                      </div>
                      {text ? <div className="small text-muted mt-1">{text}</div> : null}
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
                        <div className="fw-semibold">{p?.name || p?.label || p?.title || "Variant"}</div>
                        {p?.text ? <div className="small text-muted">{p.text}</div> : null}
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

  return createPortal(content, document.body);
}

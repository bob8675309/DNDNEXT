import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";

const TYPES = ["All", "feat", "boon", "background", "species", "skill"];

function safeText(value) {
  return String(value ?? "").trim();
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Character option batch must be a JSON object.");
  if (!Array.isArray(payload.rows) || !payload.rows.length) throw new Error("Character option batch must include a non-empty rows array.");
  if (payload.rows.length > 500) throw new Error("Character option batches are capped at 500 rows.");
  const invalid = payload.rows.find((row) => !row?.option_key || !row?.option_type || !row?.name);
  if (invalid) throw new Error("Every option row needs option_key, option_type, and name.");
  return payload;
}

export default function CharacterOptionsAdminPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(null);
  const [importing, setImporting] = useState(false);
  const [availabilityEdit, setAvailabilityEdit] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(() => new Set());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("character_option_catalog_configured")
      .select("id,option_key,option_type,name,source,category,description,prerequisite_text,tags,metadata,is_visible")
      .order("option_type", { ascending: true })
      .order("name", { ascending: true })
      .limit(5000);
    if (loadError) setError(loadError.message || "Could not load character options.");
    const rows = data || [];
    setOptions(rows);
    setSelected((current) => current && rows.some((row) => row.id === current.id)
      ? rows.find((row) => row.id === current.id)
      : rows[0] || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    async function check() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;
      if (!sessionData?.session?.user) {
        setAuthChecked(true);
        return;
      }
      const { data } = await supabase.rpc("is_admin");
      if (!active) return;
      setIsAdmin(Boolean(data));
      setAuthChecked(true);
    }
    check();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authChecked && isAdmin) loadOptions();
  }, [authChecked, isAdmin, loadOptions]);

  const filtered = useMemo(() => options.filter((option) => {
    if (type !== "All" && option.option_type !== type) return false;
    const q = safeText(query).toLowerCase();
    if (!q) return true;
    return [option.name, option.source, option.category, option.description, option.prerequisite_text, ...(option.tags || [])]
      .filter(Boolean).join(" ").toLowerCase().includes(q);
  }), [options, query, type]);

  const backgroundCounts = useMemo(() => {
    const backgrounds = options.filter((option) => option.option_type === "background");
    return {
      total: backgrounds.length,
      shown: backgrounds.filter((option) => option.is_visible !== false).length,
      hidden: backgrounds.filter((option) => option.is_visible === false).length,
    };
  }, [options]);

  useEffect(() => {
    if (filtered.length && (!selected || !filtered.some((row) => row.id === selected.id))) setSelected(filtered[0]);
  }, [filtered, selected]);

  async function chooseFile(event) {
    setPayload(null);
    setMessage("");
    setError("");
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = validatePayload(JSON.parse(await file.text()));
      setPayload(parsed);
      setMessage(`Ready to import ${parsed.rows.length} reviewed character options from ${file.name}.`);
    } catch (fileError) {
      setError(fileError.message || "Could not read this character option batch.");
    }
  }

  async function importBatch() {
    if (!payload) return;
    setImporting(true);
    setError("");
    setMessage("");
    const { data, error: importError } = await supabase.rpc("import_character_option_batch_v1", { p_payload: payload });
    if (importError) {
      setError(importError.message || "Character option import failed.");
    } else {
      setMessage(`Imported ${Number(data?.options || payload.rows.length).toLocaleString()} character options.`);
      setPayload(null);
      await loadOptions();
    }
    setImporting(false);
  }

  async function setBackgroundVisibility(option, nextVisible) {
    if (!option || option.option_type !== "background" || savingVisibility.has(option.id)) return;
    const previousVisible = option.is_visible !== false;
    setMessage("");
    setError("");
    setSavingVisibility((current) => new Set(current).add(option.id));
    setOptions((current) => current.map((row) => row.id === option.id ? { ...row, is_visible: nextVisible } : row));
    setSelected((current) => current?.id === option.id ? { ...current, is_visible: nextVisible } : current);

    const { error: visibilityError } = await supabase.rpc("set_character_option_visibility_v1", {
      p_option_id: option.id,
      p_is_visible: nextVisible,
      p_scope_key: "default",
    });

    if (visibilityError) {
      setOptions((current) => current.map((row) => row.id === option.id ? { ...row, is_visible: previousVisible } : row));
      setSelected((current) => current?.id === option.id ? { ...current, is_visible: previousVisible } : current);
      setError(visibilityError.message || "Could not update background availability.");
    } else {
      setMessage(`${option.name} is now ${nextVisible ? "shown" : "hidden"} in character creation.`);
    }

    setSavingVisibility((current) => {
      const next = new Set(current);
      next.delete(option.id);
      return next;
    });
  }

  function toggleAvailabilityEdit() {
    setAvailabilityEdit((current) => !current);
    setType("background");
    setMessage("");
    setError("");
  }

  if (!authChecked) return <main className="container my-4"><div className="text-muted">Checking admin access…</div></main>;
  if (!isAdmin) return <main className="container my-4"><h1 className="h4">Character Options</h1><p className="text-muted">Admin access is required.</p></main>;

  return (
    <main className="container-fluid my-3 px-3 admin-dark character-options-admin">
      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3">
        <div>
          <div className="spell-admin-kicker">Character Database</div>
          <h1 className="h3 mb-1">Character Options</h1>
          <div className="small text-muted">Feats, Epic Boons, backgrounds, species, and skills. Hidden backgrounds remain in the source catalogue and can be restored at any time.</div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button type="button" className={`btn btn-sm ${availabilityEdit ? "btn-warning" : "btn-outline-warning"}`} onClick={toggleAvailabilityEdit}>{availabilityEdit ? "Done editing backgrounds" : "Edit background availability"}</button>
          <Link href="/admin/class-features" className="btn btn-sm btn-outline-light">Class Features</Link>
          <Link href="/admin/spells" className="btn btn-sm btn-outline-light">Spell Catalog</Link>
          <Link href="/admin" className="btn btn-sm btn-outline-light">Admin</Link>
        </div>
      </div>

      <section className="npc-card mb-3">
        <div className="d-flex align-items-end justify-content-between gap-3 flex-wrap">
          <div>
            <div className="npc-card-title mb-1">Import reviewed option batch</div>
            <div className="small text-muted">Generate batches with scripts/import_5etools_character_options.mjs, review them, then upload each file here.</div>
          </div>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <input type="file" className="form-control form-control-sm" accept="application/json,.json" onChange={chooseFile} />
            <button type="button" className="btn btn-warning btn-sm" disabled={!payload || importing} onClick={importBatch}>{importing ? "Importing…" : "Import batch"}</button>
          </div>
        </div>
        {message ? <div className="alert alert-success py-2 mt-3 mb-0">{message}</div> : null}
        {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
      </section>

      <section className="npc-card mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-12 col-lg-6"><label className="form-label small fw-semibold">Search</label><input className="form-control" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="feat, boon, stealth, sailor…" /></div>
          <div className="col-8 col-lg-2"><label className="form-label small fw-semibold">Type</label><select className="form-select" value={type} onChange={(event) => setType(event.target.value)}>{TYPES.map((value) => <option key={value} value={value}>{value === "All" ? value : value[0].toUpperCase() + value.slice(1)}</option>)}</select></div>
          <div className="col-4 col-lg-2 text-end"><div className="small text-muted">Showing</div><strong>{filtered.length}/{options.length}</strong></div>
          <div className="col-12 col-lg-2 text-lg-end"><div className="small text-muted">Backgrounds</div><strong>{backgroundCounts.shown} shown</strong><span className="small text-muted ms-2">{backgroundCounts.hidden} hidden</span></div>
        </div>
        {availabilityEdit ? <div className="availability-help mt-3"><strong>Background availability edit mode</strong><span>Checked backgrounds appear in NPC Forge and player character creation. Unchecked backgrounds stay stored and can be turned back on later.</span></div> : null}
      </section>

      <div className="row g-3">
        <div className="col-12 col-xl-5">
          <section className="npc-card option-list-card">
            {loading ? <div className="text-muted">Loading character options…</div> : null}
            <div className="character-option-list">
              {filtered.map((option) => (
                <div key={option.id} className={`character-option-row ${selected?.id === option.id ? "active" : ""} ${option.option_type === "background" && option.is_visible === false ? "is-hidden-option" : ""}`}>
                  <button type="button" className="character-option-select" onClick={() => setSelected(option)}>
                    <strong>{option.name}</strong>
                    <small>{option.option_type} • {option.source}{option.category ? ` • ${option.category}` : ""}</small>
                  </button>
                  {availabilityEdit && option.option_type === "background" ? (
                    <label className="background-visibility-toggle" title={option.is_visible === false ? "Hidden from character creation" : "Shown in character creation"}>
                      <input type="checkbox" checked={option.is_visible !== false} disabled={savingVisibility.has(option.id)} onChange={(event) => setBackgroundVisibility(option, event.target.checked)} />
                      <span>{savingVisibility.has(option.id) ? "Saving…" : option.is_visible === false ? "Hidden" : "Shown"}</span>
                    </label>
                  ) : option.option_type === "background" ? <span className={`availability-badge ${option.is_visible === false ? "hidden" : "shown"}`}>{option.is_visible === false ? "Hidden" : "Shown"}</span> : null}
                </div>
              ))}
            </div>
          </section>
        </div>
        <div className="col-12 col-xl-7">
          <section className="npc-card">
            {selected ? <><div className="d-flex align-items-start justify-content-between gap-2"><div><div className="spell-admin-kicker">{selected.option_type}</div><h2 className="h4 mb-1">{selected.name}</h2></div><div className="d-flex align-items-center gap-2"><span className="badge text-bg-secondary">{selected.source}</span>{selected.option_type === "background" ? <span className={`availability-badge ${selected.is_visible === false ? "hidden" : "shown"}`}>{selected.is_visible === false ? "Hidden from creation" : "Shown in creation"}</span> : null}</div></div>{selected.prerequisite_text ? <div className="small mt-3"><strong>Prerequisite:</strong> {selected.prerequisite_text}</div> : null}<p className="mt-3 mb-0 option-description">{selected.description || "No description was supplied by the imported source."}</p></> : <div className="text-muted">Select an option to inspect it.</div>}
          </section>
        </div>
      </div>

      <style jsx>{`
        .option-list-card { max-height:68vh; overflow:auto; }
        .character-option-list { display:grid; gap:.4rem; }
        .character-option-row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:.55rem; padding:.22rem; border:1px solid rgba(255,255,255,.09); border-radius:.65rem; background:rgba(255,255,255,.035); }
        .character-option-row.active { border-color:rgba(245,190,75,.65); background:rgba(245,190,75,.1); }
        .character-option-row.is-hidden-option { opacity:.72; }
        .character-option-select { display:grid; gap:.15rem; width:100%; padding:.42rem .48rem; border:0; background:transparent; color:inherit; text-align:left; }
        .character-option-select strong { color:inherit; }
        .character-option-select small { color:rgba(255,255,255,.58); text-transform:capitalize; }
        .background-visibility-toggle { display:flex; align-items:center; gap:.4rem; margin:0 .4rem 0 0; padding:.35rem .48rem; border:1px solid rgba(255,255,255,.12); border-radius:.55rem; cursor:pointer; white-space:nowrap; }
        .background-visibility-toggle input { accent-color:#f5be4b; }
        .background-visibility-toggle span { font-size:.72rem; color:rgba(255,255,255,.75); }
        .availability-badge { display:inline-flex; align-items:center; justify-content:center; padding:.2rem .45rem; border-radius:999px; font-size:.66rem; font-weight:700; white-space:nowrap; }
        .availability-badge.shown { color:#baffda; border:1px solid rgba(79,205,139,.4); background:rgba(44,145,93,.14); }
        .availability-badge.hidden { color:#ffd0d0; border:1px solid rgba(235,103,103,.38); background:rgba(160,58,58,.14); }
        .availability-help { display:flex; flex-wrap:wrap; gap:.35rem 1rem; padding:.65rem .75rem; border-left:3px solid #f5be4b; border-radius:.55rem; background:rgba(245,190,75,.08); }
        .availability-help strong { color:#ffe5a4; }
        .availability-help span { color:rgba(255,255,255,.68); }
        .option-description { white-space:pre-line; }
      `}</style>
    </main>
  );
}

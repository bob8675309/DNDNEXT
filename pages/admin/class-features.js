import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";

function safeText(value) {
  return String(value ?? "").trim();
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Class feature batch must be a JSON object.");
  if (!Array.isArray(payload.rows) || !payload.rows.length) throw new Error("Class feature batch must include a non-empty rows array.");
  if (payload.rows.length > 500) throw new Error("Class feature batches are capped at 500 rows.");
  const invalid = payload.rows.find((row) => !row?.feature_key || !row?.feature_type || !row?.name || !row?.class_key || !row?.class_source || Number(row?.level || 0) < 1);
  if (invalid) throw new Error("Every row needs a feature key, type, name, class, class source, and level.");
  return payload;
}

export default function ClassFeaturesAdminPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [features, setFeatures] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [featureType, setFeatureType] = useState("all");
  const [classKey, setClassKey] = useState("all");
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadFeatures = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("class_feature_catalog")
      .select("id,feature_key,feature_type,name,source,class_key,class_name,class_source,subclass_name,subclass_short_name,level,description")
      .order("class_name", { ascending: true })
      .order("subclass_name", { ascending: true })
      .order("level", { ascending: true })
      .order("name", { ascending: true })
      .limit(10000);
    if (loadError) setError(loadError.message || "Could not load class features.");
    const rows = data || [];
    setFeatures(rows);
    setSelected((current) => current && rows.some((row) => row.id === current.id) ? current : rows[0] || null);
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
    if (authChecked && isAdmin) loadFeatures();
  }, [authChecked, isAdmin, loadFeatures]);

  const classOptions = useMemo(() => [...new Map(features.map((row) => [row.class_key, row.class_name])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [features]);
  const filtered = useMemo(() => features.filter((row) => {
    if (featureType !== "all" && row.feature_type !== featureType) return false;
    if (classKey !== "all" && row.class_key !== classKey) return false;
    const q = safeText(query).toLowerCase();
    if (!q) return true;
    return [row.name, row.class_name, row.subclass_name, row.source, row.description]
      .filter(Boolean).join(" ").toLowerCase().includes(q);
  }), [classKey, featureType, features, query]);

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
      setMessage(`Ready to import ${parsed.rows.length} reviewed class features from ${file.name}.`);
    } catch (fileError) {
      setError(fileError.message || "Could not read this class feature batch.");
    }
  }

  async function importBatch() {
    if (!payload) return;
    setImporting(true);
    setError("");
    setMessage("");
    const { data, error: importError } = await supabase.rpc("import_class_feature_batch_v1", { p_payload: payload });
    if (importError) {
      setError(importError.message || "Class feature import failed.");
    } else {
      setMessage(`Imported ${Number(data?.features || payload.rows.length).toLocaleString()} class and subclass features.`);
      setPayload(null);
      await loadFeatures();
    }
    setImporting(false);
  }

  if (!authChecked) return <main className="container my-4"><div className="text-muted">Checking admin access…</div></main>;
  if (!isAdmin) return <main className="container my-4"><h1 className="h4">Class Features</h1><p className="text-muted">Admin access is required.</p></main>;

  return (
    <main className="container-fluid my-3 px-3 admin-dark class-features-admin">
      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3">
        <div>
          <div className="spell-admin-kicker">Class Database</div>
          <h1 className="h3 mb-1">Class & Subclass Features</h1>
          <div className="small text-muted">Full source descriptions used by sheet hover text and the level 1–20 Class guide.</div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link href="/admin/character-options" className="btn btn-sm btn-outline-light">Character Options</Link>
          <Link href="/admin/spells" className="btn btn-sm btn-outline-light">Spell Catalog</Link>
          <Link href="/admin" className="btn btn-sm btn-outline-light">Admin</Link>
        </div>
      </div>

      <section className="npc-card mb-3">
        <div className="d-flex align-items-end justify-content-between gap-3 flex-wrap">
          <div>
            <div className="npc-card-title mb-1">Import reviewed class feature batch</div>
            <div className="small text-muted">Generate batches with scripts/import_5etools_class_features.mjs, review them, then upload each file in numeric order.</div>
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
          <div className="col-12 col-lg-5"><label className="form-label small fw-semibold">Search</label><input className="form-control" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Second Wind, Battle Master, spellcasting…" /></div>
          <div className="col-6 col-lg-2"><label className="form-label small fw-semibold">Type</label><select className="form-select" value={featureType} onChange={(event) => setFeatureType(event.target.value)}><option value="all">All</option><option value="class">Class</option><option value="subclass">Subclass</option></select></div>
          <div className="col-6 col-lg-3"><label className="form-label small fw-semibold">Class</label><select className="form-select" value={classKey} onChange={(event) => setClassKey(event.target.value)}><option value="all">All classes</option>{classOptions.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></div>
          <div className="col-12 col-lg-2 text-end"><div className="small text-muted">Showing</div><strong>{filtered.length}/{features.length}</strong></div>
        </div>
      </section>

      <div className="row g-3">
        <div className="col-12 col-xl-5">
          <section className="npc-card class-feature-list-card">
            {loading ? <div className="text-muted">Loading class features…</div> : null}
            <div className="class-feature-admin-list">
              {filtered.map((row) => <button type="button" key={row.id} className={`class-feature-admin-row ${selected?.id === row.id ? "active" : ""}`} onClick={() => setSelected(row)}><strong>{row.name}</strong><small>{row.class_name} • level {row.level}{row.subclass_name ? ` • ${row.subclass_name}` : ""} • {row.source}</small></button>)}
            </div>
          </section>
        </div>
        <div className="col-12 col-xl-7">
          <section className="npc-card">
            {selected ? <><div className="d-flex align-items-start justify-content-between gap-2"><div><div className="spell-admin-kicker">{selected.feature_type}{selected.subclass_name ? ` • ${selected.subclass_name}` : ""}</div><h2 className="h4 mb-1">{selected.name}</h2><div className="small text-muted">{selected.class_name} level {selected.level} • {selected.class_source}</div></div><span className="badge text-bg-secondary">{selected.source}</span></div><p className="mt-3 mb-0 class-feature-description">{selected.description || "No description was supplied by the imported source."}</p></> : <div className="text-muted">Select a class feature to inspect it.</div>}
          </section>
        </div>
      </div>

      <style jsx>{`
        .class-feature-list-card { max-height:68vh; overflow:auto; }
        .class-feature-admin-list { display:grid; gap:.4rem; }
        .class-feature-admin-row { display:grid; gap:.15rem; padding:.6rem .7rem; border:1px solid rgba(255,255,255,.09); border-radius:.65rem; background:rgba(255,255,255,.035); color:inherit; text-align:left; }
        .class-feature-admin-row.active { border-color:rgba(245,190,75,.65); background:rgba(245,190,75,.1); }
        .class-feature-admin-row small { color:rgba(255,255,255,.58); }
        .class-feature-description { white-space:pre-line; line-height:1.55; }
      `}</style>
    </main>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { formatPrerequisiteText } from "../utils/formatPrerequisiteText";

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeName(value) {
  return safeText(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function uniqueText(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(safeText).filter(Boolean))];
}

function optionTypeLabel(type) {
  return type === "boon" ? "Epic Boon" : "Feat";
}

function DetailCard({ option, isAdmin = false, notes = "", setNotes = null, busy = false, alreadyGranted = false, onGrant = null }) {
  if (!option) return <div className="text-muted">Select a feat or boon to inspect it.</div>;
  const prerequisite = formatPrerequisiteText(option.prerequisite_text || option.prerequisiteText || "");
  return (
    <>
      <div className="feature-detail">
        <div className="d-flex justify-content-between gap-2 align-items-start flex-wrap">
          <div>
            <div className="spell-admin-kicker">{optionTypeLabel(option.option_type || option.optionType)}</div>
            <h3 className="h5 mb-1">{option.name}</h3>
          </div>
          <span className="badge text-bg-secondary">{option.source || "Campaign"}</span>
        </div>
        {prerequisite ? <div className="small mt-2 feature-prerequisite"><strong>Prerequisite:</strong> {prerequisite}</div> : null}
        <p className="small mt-3 mb-0">{option.description || "No source description is available."}</p>
        {option.notes ? <div className="small mt-3"><strong>GM notes:</strong> {option.notes}</div> : null}
      </div>
      {isAdmin && onGrant ? (
        <div className="mt-3">
          <label className="form-label small fw-semibold">GM notes</label>
          <input className="form-control form-control-sm" value={notes} onChange={(event) => setNotes?.(event.target.value)} placeholder="Optional reason, quest reward, blessing…" />
          <button type="button" className="btn btn-warning btn-sm mt-2" disabled={busy || alreadyGranted} onClick={onGrant}>
            {alreadyGranted ? "Already granted" : busy ? "Granting…" : `Grant ${optionTypeLabel(option.option_type || option.optionType)}`}
          </button>
        </div>
      ) : null}
    </>
  );
}

export default function CharacterFeaturesPanel({ character = null, isAdmin = false }) {
  const characterId = character?.id || null;
  const [catalog, setCatalog] = useState([]);
  const [grants, setGrants] = useState([]);
  const [sheetFeats, setSheetFeats] = useState([]);
  const [view, setView] = useState("known");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("feat");
  const [selectedId, setSelectedId] = useState("");
  const [selectedKnownKey, setSelectedKnownKey] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async ({ preserveNotice = false } = {}) => {
    if (!characterId) {
      setCatalog([]);
      setGrants([]);
      setSheetFeats([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    if (!preserveNotice) setNotice("");
    const [catalogResult, grantsResult, sheetResult] = await Promise.all([
      supabase
        .from("character_option_catalog_preferred")
        .select("id,option_key,option_type,name,source,category,description,prerequisite_text,tags,metadata")
        .in("option_type", ["feat", "boon"])
        .order("option_type", { ascending: true })
        .order("name", { ascending: true })
        .limit(3000),
      supabase.rpc("get_character_option_grants_v1", { p_character_id: characterId }),
      supabase.from("character_sheets").select("sheet").eq("character_id", characterId).maybeSingle(),
    ]);
    if (catalogResult.error) setError(catalogResult.error.message || "Could not load feats and boons.");
    if (grantsResult.error) setError(grantsResult.error.message || "Could not load granted feats and boons.");
    if (sheetResult.error) setError(sheetResult.error.message || "Could not load sheet feats.");
    const nextCatalog = catalogResult.data || [];
    setCatalog(nextCatalog);
    setGrants(Array.isArray(grantsResult.data) ? grantsResult.data : []);
    setSheetFeats(uniqueText(sheetResult.data?.sheet?.feats || []));
    setSelectedId((current) => current && nextCatalog.some((row) => row.id === current) ? current : nextCatalog.find((row) => row.option_type === type)?.id || nextCatalog[0]?.id || "");
    setLoading(false);
  }, [characterId, type]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isAdmin && view === "admin") setView("known");
  }, [isAdmin, view]);

  const catalogByName = useMemo(() => {
    const map = new Map();
    for (const option of catalog) map.set(`${option.option_type}:${normalizeName(option.name)}`, option);
    return map;
  }, [catalog]);

  const knownOptions = useMemo(() => {
    const rows = [];
    const seen = new Set();
    for (const name of sheetFeats) {
      const catalogRow = catalogByName.get(`feat:${normalizeName(name)}`);
      const key = `feat:${normalizeName(name)}`;
      seen.add(key);
      rows.push({
        ...(catalogRow || {}),
        knownKey: `sheet:${key}`,
        option_type: "feat",
        name,
        source: catalogRow?.source || "Sheet",
        origin: "Origin, level, or creation feat",
        removable: false,
      });
    }
    for (const grant of grants) {
      const optionType = grant.optionType || grant.option_type || "feat";
      const key = `${optionType}:${normalizeName(grant.name)}`;
      const catalogRow = catalog.find((row) => row.id === grant.optionId) || catalogByName.get(key);
      rows.push({
        ...(catalogRow || {}),
        ...grant,
        knownKey: `grant:${grant.id}`,
        option_type: optionType,
        source: grant.source || catalogRow?.source || "Campaign",
        description: grant.description || catalogRow?.description || "",
        prerequisite_text: grant.prerequisiteText || catalogRow?.prerequisite_text || "",
        origin: grant.notes ? `Game Master grant • ${grant.notes}` : "Game Master grant",
        removable: true,
      });
      seen.add(key);
    }
    return rows.sort((a, b) => (a.option_type || "").localeCompare(b.option_type || "") || safeText(a.name).localeCompare(safeText(b.name)));
  }, [catalog, catalogByName, grants, sheetFeats]);

  useEffect(() => {
    if (knownOptions.length && !knownOptions.some((row) => row.knownKey === selectedKnownKey)) setSelectedKnownKey(knownOptions[0].knownKey);
  }, [knownOptions, selectedKnownKey]);

  const grantedOptionIds = useMemo(() => new Set(grants.map((grant) => grant.optionId)), [grants]);
  const filtered = useMemo(() => catalog.filter((option) => {
    if (option.option_type !== type) return false;
    const q = safeText(query).toLowerCase();
    if (!q) return true;
    return [option.name, option.source, option.category, option.description, formatPrerequisiteText(option.prerequisite_text)]
      .filter(Boolean).join(" ").toLowerCase().includes(q);
  }), [catalog, query, type]);
  const selected = useMemo(() => catalog.find((option) => option.id === selectedId) || filtered[0] || null, [catalog, filtered, selectedId]);
  const selectedKnown = useMemo(() => knownOptions.find((option) => option.knownKey === selectedKnownKey) || knownOptions[0] || null, [knownOptions, selectedKnownKey]);

  useEffect(() => {
    if (filtered.length && !filtered.some((option) => option.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  async function grantSelected() {
    if (!isAdmin || !selected?.id || grantedOptionIds.has(selected.id)) return;
    setBusy(true);
    setError("");
    setNotice("");
    const { error: grantError } = await supabase.rpc("grant_character_option_v1", {
      p_character_id: characterId,
      p_option_id: selected.id,
      p_notes: safeText(notes) || null,
    });
    if (grantError) setError(grantError.message || "Could not grant this feat or boon.");
    else {
      setNotice(`${selected.name} granted to ${character?.name || "the character"}.`);
      setNotes("");
      await loadData({ preserveNotice: true });
    }
    setBusy(false);
  }

  async function removeGrant(grant) {
    if (!isAdmin || !grant?.id) return;
    if (typeof window !== "undefined" && !window.confirm(`Remove ${grant.name} from ${character?.name || "this character"}?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    const { error: removeError } = await supabase.rpc("remove_character_option_grant_v1", { p_grant_id: grant.id });
    if (removeError) setError(removeError.message || "Could not remove this feat or boon.");
    else {
      setNotice(`${grant.name} removed.`);
      await loadData({ preserveNotice: true });
    }
    setBusy(false);
  }

  if (loading) return <div className="npc-card"><div className="text-muted">Loading feats and boons…</div></div>;

  const featKnown = knownOptions.filter((row) => row.option_type === "feat");
  const boonKnown = knownOptions.filter((row) => row.option_type === "boon");

  const CatalogList = () => (
    <section className="npc-card feature-catalog-card h-100">
      <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-3">
        <div>
          <div className="npc-card-title mb-0">{view === "admin" ? "Grant a Feat or Boon" : "Feat & Boon Catalogue"}</div>
          <div className="small text-muted">One preferred version is shown when names repeat.</div>
        </div>
        <div className="btn-group btn-group-sm">
          <button type="button" className={`btn ${type === "feat" ? "btn-warning" : "btn-outline-light"}`} onClick={() => setType("feat")}>Feats</button>
          <button type="button" className={`btn ${type === "boon" ? "btn-warning" : "btn-outline-light"}`} onClick={() => setType("boon")}>Boons</button>
        </div>
      </div>
      <input className="form-control form-control-sm mb-2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${type === "feat" ? "feats" : "boons"}…`} />
      <div className="feature-catalog-list">
        {filtered.map((option) => (
          <button type="button" key={option.id} className={`feature-catalog-row ${selected?.id === option.id ? "active" : ""}`} onClick={() => setSelectedId(option.id)}>
            <strong>{option.name}</strong>
            <small>{option.source}{option.category ? ` • ${option.category}` : ""}{grantedOptionIds.has(option.id) ? " • Granted" : ""}</small>
          </button>
        ))}
        {!filtered.length ? <div className="text-muted">No imported {type === "feat" ? "feats" : "boons"} match this search.</div> : null}
      </div>
    </section>
  );

  const KnownList = ({ compact = false }) => (
    <section className={`npc-card ${compact ? "" : "h-100"}`}>
      <div className="npc-card-title">Known Feats & Boons</div>
      {!knownOptions.length ? <div className="text-muted">No feats or Epic Boons are recorded yet.</div> : null}
      <div className="feature-known-groups">
        {featKnown.length ? <div><div className="feature-known-heading">Character Feats</div><div className="feature-grant-list">{featKnown.map((row) => (
          <button type="button" key={row.knownKey} className={`feature-known-row ${selectedKnown?.knownKey === row.knownKey ? "active" : ""}`} onClick={() => setSelectedKnownKey(row.knownKey)}>
            <span><strong>{row.name}</strong><small>{row.origin}</small></span>
            {row.removable && isAdmin && view === "admin" ? <span className="btn btn-sm btn-outline-danger" onClick={(event) => { event.stopPropagation(); removeGrant(row); }}>Remove</span> : <span className="badge text-bg-secondary">Feat</span>}
          </button>
        ))}</div></div> : null}
        <div><div className="feature-known-heading">Epic Boons</div>{boonKnown.length ? <div className="feature-grant-list">{boonKnown.map((row) => (
          <button type="button" key={row.knownKey} className={`feature-known-row ${selectedKnown?.knownKey === row.knownKey ? "active" : ""}`} onClick={() => setSelectedKnownKey(row.knownKey)}>
            <span><strong>{row.name}</strong><small>{row.origin}</small></span>
            {row.removable && isAdmin && view === "admin" ? <span className="btn btn-sm btn-outline-danger" onClick={(event) => { event.stopPropagation(); removeGrant(row); }}>Remove</span> : <span className="badge text-bg-info">Boon</span>}
          </button>
        ))}</div> : <div className="text-muted">No Epic Boons have been granted.</div>}</div>
      </div>
    </section>
  );

  return (
    <div className="character-features-panel">
      <div className="npc-card mb-3 feature-summary">
        <div>
          <div className="spell-admin-kicker">Feats & Boons</div>
          <h2 className="h5 mb-1">{character?.name || "Character"}</h2>
          <div className="small text-muted">Known choices, the full catalogue, and Game Master grants are kept separate.</div>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <div className="btn-group btn-group-sm" role="tablist" aria-label="Feat and boon views">
            <button type="button" className={`btn ${view === "known" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setView("known")}>Known</button>
            <button type="button" className={`btn ${view === "catalogue" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setView("catalogue")}>Catalogue</button>
            {isAdmin ? <button type="button" className={`btn ${view === "admin" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setView("admin")}>Admin</button> : null}
          </div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={() => loadData()}>Refresh</button>
        </div>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {notice ? <div className="alert alert-success py-2">{notice}</div> : null}

      {view === "known" ? (
        <div className="row g-3">
          <div className="col-12 col-xl-5"><KnownList /></div>
          <div className="col-12 col-xl-7"><section className="npc-card feature-detail-card h-100"><DetailCard option={selectedKnown} /></section></div>
        </div>
      ) : view === "catalogue" ? (
        <div className="row g-3">
          <div className="col-12 col-xl-5"><CatalogList /></div>
          <div className="col-12 col-xl-7"><section className="npc-card feature-detail-card h-100"><DetailCard option={selected} /></section></div>
        </div>
      ) : (
        <div className="row g-3">
          <div className="col-12 col-xl-5"><CatalogList /></div>
          <div className="col-12 col-xl-7">
            <div className="mb-3"><KnownList compact /></div>
            <section className="npc-card feature-detail-card">
              <DetailCard option={selected} isAdmin notes={notes} setNotes={setNotes} busy={busy} alreadyGranted={grantedOptionIds.has(selected?.id)} onGrant={grantSelected} />
            </section>
          </div>
        </div>
      )}

      <style jsx>{`
        .feature-summary { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; }
        .feature-catalog-card { min-height:62vh; }
        .feature-catalog-list { display:grid; gap:.4rem; max-height:54vh; overflow:auto; padding-right:.2rem; }
        .feature-catalog-row, .feature-known-row { display:flex; align-items:center; justify-content:space-between; gap:.6rem; width:100%; padding:.6rem .7rem; border:1px solid rgba(255,255,255,.09); border-radius:.65rem; background:rgba(255,255,255,.035); color:inherit; text-align:left; }
        .feature-catalog-row { display:grid; }
        .feature-catalog-row.active, .feature-known-row.active { border-color:rgba(245,190,75,.65); background:rgba(245,190,75,.1); }
        .feature-catalog-row small, .feature-known-row small { color:rgba(255,255,255,.58); }
        .feature-known-groups, .feature-grant-list { display:grid; gap:.55rem; }
        .feature-known-heading { margin:.6rem 0 .35rem; color:rgba(255,255,255,.62); font-size:.72rem; font-weight:800; letter-spacing:.05em; text-transform:uppercase; }
        .feature-known-row > span:first-child { min-width:0; display:grid; }
        .feature-detail { padding:.8rem; border-radius:.7rem; background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.09); }
        .feature-detail p { white-space:pre-line; line-height:1.55; }
        .feature-prerequisite { line-height:1.45; color:rgba(255,255,255,.78); }
        .feature-detail-card { min-height:230px; }
      `}</style>
    </div>
  );
}

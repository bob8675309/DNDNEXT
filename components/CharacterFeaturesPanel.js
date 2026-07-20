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

function DetailCard({ option, isAdmin = false, notes = "", setNotes = null, busy = false, isKnown = false, onGrant = null, onRemove = null }) {
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
      {isAdmin && (onGrant || onRemove) ? (
        <div className="profile-catalogue__admin-actions">
          {!isKnown ? (
            <label className="form-label small fw-semibold">GM notes
              <input className="form-control form-control-sm mt-1" value={notes} onChange={(event) => setNotes?.(event.target.value)} placeholder="Optional reason, quest reward, blessing…" />
            </label>
          ) : null}
          <button type="button" className={`btn btn-sm ${isKnown ? "btn-outline-danger" : "btn-warning"}`} disabled={busy} onClick={isKnown ? onRemove : onGrant}>
            {busy ? (isKnown ? "Removing…" : "Granting…") : isKnown ? `Remove ${optionTypeLabel(option.option_type || option.optionType)}` : `Grant ${optionTypeLabel(option.option_type || option.optionType)}`}
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
  const [characterSheet, setCharacterSheet] = useState({});
  const [sheetFeats, setSheetFeats] = useState([]);
  const [view, setView] = useState("known");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("feat");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState("name");
  const [statusFilter, setStatusFilter] = useState("All");
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
      setCharacterSheet({});
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
    const nextSheet = sheetResult.data?.sheet && typeof sheetResult.data.sheet === "object" ? sheetResult.data.sheet : {};
    setCharacterSheet(nextSheet);
    setSheetFeats(uniqueText(nextSheet.feats || []));
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
        catalogId: catalogRow?.id || null,
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
        grantId: grant.id,
        catalogId: catalogRow?.id || grant.optionId || null,
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

  const knownOptionKeys = useMemo(() => new Set(knownOptions.map((row) => `${row.option_type || "feat"}:${normalizeName(row.name)}`)), [knownOptions]);
  const knownByCatalogId = useMemo(() => {
    const map = new Map();
    for (const row of knownOptions) if (row.catalogId) map.set(row.catalogId, row);
    return map;
  }, [knownOptions]);
  const typeCatalog = useMemo(() => catalog.filter((option) => option.option_type === type), [catalog, type]);
  const sourceOptions = useMemo(() => ["All", ...uniqueText(typeCatalog.map((option) => option.source)).sort()], [typeCatalog]);
  const categoryOptions = useMemo(() => ["All", ...uniqueText(typeCatalog.map((option) => option.category)).sort()], [typeCatalog]);
  const filtered = useMemo(() => typeCatalog.filter((option) => {
    if (sourceFilter !== "All" && option.source !== sourceFilter) return false;
    if (categoryFilter !== "All" && option.category !== categoryFilter) return false;
    const known = knownOptionKeys.has(`${option.option_type}:${normalizeName(option.name)}`);
    if (view === "admin" && statusFilter === "Known" && !known) return false;
    if (view === "admin" && statusFilter === "Unknown" && known) return false;
    const q = safeText(query).toLowerCase();
    if (!q) return true;
    return [option.name, option.source, option.category, option.description, formatPrerequisiteText(option.prerequisite_text)]
      .filter(Boolean).join(" ").toLowerCase().includes(q);
  }).sort((a, b) => {
    if (sortBy === "source") return safeText(a.source).localeCompare(safeText(b.source)) || safeText(a.name).localeCompare(safeText(b.name));
    if (sortBy === "category") return safeText(a.category).localeCompare(safeText(b.category)) || safeText(a.name).localeCompare(safeText(b.name));
    return safeText(a.name).localeCompare(safeText(b.name));
  }), [categoryFilter, knownOptionKeys, query, sortBy, sourceFilter, statusFilter, typeCatalog, view]);
  const filteredKnown = useMemo(() => knownOptions.filter((option) => {
    if (option.option_type !== type) return false;
    if (sourceFilter !== "All" && option.source !== sourceFilter) return false;
    if (categoryFilter !== "All" && option.category !== categoryFilter) return false;
    const q = safeText(query).toLowerCase();
    if (!q) return true;
    return [option.name, option.source, option.category, option.origin, option.description, formatPrerequisiteText(option.prerequisite_text)]
      .filter(Boolean).join(" ").toLowerCase().includes(q);
  }).sort((a, b) => {
    if (sortBy === "source") return safeText(a.source).localeCompare(safeText(b.source)) || safeText(a.name).localeCompare(safeText(b.name));
    if (sortBy === "category") return safeText(a.category).localeCompare(safeText(b.category)) || safeText(a.name).localeCompare(safeText(b.name));
    return safeText(a.name).localeCompare(safeText(b.name));
  }), [categoryFilter, knownOptions, query, sortBy, sourceFilter, type]);
  const selected = useMemo(() => filtered.find((option) => option.id === selectedId) || filtered[0] || null, [filtered, selectedId]);
  const selectedKnown = useMemo(() => filteredKnown.find((option) => option.knownKey === selectedKnownKey) || filteredKnown[0] || null, [filteredKnown, selectedKnownKey]);
  const selectedKnownRecord = useMemo(() => {
    if (!selected) return null;
    return knownByCatalogId.get(selected.id) || knownOptions.find((row) => `${row.option_type}:${normalizeName(row.name)}` === `${selected.option_type}:${normalizeName(selected.name)}`) || null;
  }, [knownByCatalogId, knownOptions, selected]);

  useEffect(() => {
    if (filtered.length && !filtered.some((option) => option.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  useEffect(() => {
    if (filteredKnown.length && !filteredKnown.some((option) => option.knownKey === selectedKnownKey)) setSelectedKnownKey(filteredKnown[0].knownKey);
  }, [filteredKnown, selectedKnownKey]);

  useEffect(() => {
    if (!sourceOptions.includes(sourceFilter)) setSourceFilter("All");
    if (!categoryOptions.includes(categoryFilter)) setCategoryFilter("All");
  }, [categoryFilter, categoryOptions, sourceFilter, sourceOptions]);

  async function grantSelected() {
    if (!isAdmin || !selected?.id || selectedKnownRecord) return;
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
    const grantId = grant?.grantId || grant?.id;
    if (!isAdmin || !grantId) return;
    if (typeof window !== "undefined" && !window.confirm(`Remove ${grant.name} from ${character?.name || "this character"}?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    const { error: removeError } = await supabase.rpc("remove_character_option_grant_v1", { p_grant_id: grantId });
    if (removeError) setError(removeError.message || "Could not remove this feat or boon.");
    else {
      setNotice(`${grant.name} removed.`);
      await loadData({ preserveNotice: true });
    }
    setBusy(false);
  }

  async function removeSheetFeat(option) {
    if (!isAdmin || !characterId || !option?.name) return;
    if (typeof window !== "undefined" && !window.confirm(`Remove ${option.name} from ${character?.name || "this character"}?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    const nextFeats = sheetFeats.filter((name) => normalizeName(name) !== normalizeName(option.name));
    const nextSheet = { ...characterSheet, feats: nextFeats };
    const { error: updateError } = await supabase.from("character_sheets").upsert({
      character_id: characterId,
      sheet: nextSheet,
      updated_at: new Date().toISOString(),
    }, { onConflict: "character_id" });
    if (updateError) setError(updateError.message || "Could not remove this sheet feat.");
    else {
      setNotice(`${option.name} removed.`);
      await loadData({ preserveNotice: true });
    }
    setBusy(false);
  }

  async function removeSelectedOption() {
    if (!selectedKnownRecord) return;
    if (selectedKnownRecord.grantId || selectedKnownRecord.removable) await removeGrant(selectedKnownRecord);
    else await removeSheetFeat(selectedKnownRecord);
  }

  if (loading) return <div className="npc-card"><div className="text-muted">Loading feats and boons…</div></div>;

  function renderTypeButtons() {
    return (
      <div className="btn-group btn-group-sm" role="group" aria-label="Catalogue type">
        <button type="button" aria-pressed={type === "feat"} className={`btn ${type === "feat" ? "btn-warning" : "btn-outline-light"}`} onClick={() => setType("feat")}>Feats</button>
        <button type="button" aria-pressed={type === "boon"} className={`btn ${type === "boon" ? "btn-warning" : "btn-outline-light"}`} onClick={() => setType("boon")}>Epic Boons</button>
      </div>
    );
  }

  function renderFilters(visibleCount, totalCount, includeStatus = false) {
    return (
      <div className={`profile-catalogue__filters ${includeStatus ? "profile-catalogue__filters--with-status" : ""}`}>
        <label className="profile-catalogue__search"><span>Search</span><input className="form-control form-control-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, prerequisite, or description…" /></label>
        <label><span>Source</span><select className="form-select form-select-sm" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>{sourceOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Category</span><select className="form-select form-select-sm" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>{categoryOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
        {includeStatus ? <label><span>Status</span><select className="form-select form-select-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{["All", "Known", "Unknown"].map((value) => <option key={value}>{value}</option>)}</select></label> : null}
        <label><span>Sort</span><select className="form-select form-select-sm" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="name">Name, A–Z</option><option value="source">Source, then name</option><option value="category">Category, then name</option></select></label>
        <div className="profile-catalogue__count" aria-live="polite"><span>Showing</span><strong>{visibleCount}/{totalCount}</strong></div>
      </div>
    );
  }

  function renderCatalogList() {
    return (
      <section className="profile-catalogue" aria-label={`${type === "feat" ? "Feat" : "Epic Boon"} catalogue`}>
      <div className="profile-catalogue__heading">
        <div>
          <div className="npc-card-title mb-0">{view === "admin" ? "Manage Feats and Boons" : "Feats and Boons Catalogue"}</div>
          <div className="small text-muted">{view === "admin" ? "Select an entry to grant or remove it. One preferred version is shown when names repeat." : "One preferred version is shown when names repeat."}</div>
        </div>
        {renderTypeButtons()}
      </div>
      {renderFilters(filtered.length, typeCatalog.length, view === "admin")}
      <div className="profile-catalogue__list" aria-label={`Matching ${type === "feat" ? "feats" : "Epic Boons"}`}>
        {filtered.map((option) => (
          <button type="button" aria-pressed={selected?.id === option.id} key={option.id} className={`profile-catalogue__row ${selected?.id === option.id ? "active" : ""}`} onClick={() => setSelectedId(option.id)}>
            <span className="profile-catalogue__row-name">{option.name}</span>
            <span className="profile-catalogue__row-meta">{option.category || optionTypeLabel(option.option_type)} • {option.source || "Campaign"}</span>
            <span className="profile-catalogue__tags"><span>{optionTypeLabel(option.option_type)}</span>{knownOptionKeys.has(`${option.option_type}:${normalizeName(option.name)}`) ? <span className="is-known">Known</span> : <span>Unknown</span>}</span>
          </button>
        ))}
        {!filtered.length ? <div className="profile-catalogue__empty">No imported {type === "feat" ? "feats" : "Epic Boons"} match these filters.</div> : null}
      </div>
      </section>
    );
  }

  function renderKnownList() {
    const totalForType = knownOptions.filter((row) => row.option_type === type).length;
    return (
      <section className="profile-catalogue" aria-label={`Known ${type === "feat" ? "feats" : "Epic Boons"}`}>
        <div className="profile-catalogue__heading">
          <div><div className="npc-card-title mb-0">Known Feats and Boons</div><div className="small text-muted">Character choices and Game Master grants currently available to this character.</div></div>
          {renderTypeButtons()}
        </div>
        {renderFilters(filteredKnown.length, totalForType)}
        <div className="profile-catalogue__list" aria-label={`Known ${type === "feat" ? "feats" : "Epic Boons"}`}>
          {filteredKnown.map((row) => (
            <button type="button" aria-pressed={selectedKnown?.knownKey === row.knownKey} key={row.knownKey} className={`profile-catalogue__row ${selectedKnown?.knownKey === row.knownKey ? "active" : ""}`} onClick={() => setSelectedKnownKey(row.knownKey)}>
              <span className="profile-catalogue__row-name">{row.name}</span>
              <span className="profile-catalogue__row-meta">{row.origin} • {row.source || "Campaign"}</span>
              <span className="profile-catalogue__tags"><span>{optionTypeLabel(row.option_type)}</span><span className="is-known">Known</span></span>
            </button>
          ))}
          {!filteredKnown.length ? <div className="profile-catalogue__empty">No known {type === "feat" ? "feats" : "Epic Boons"} match these filters.</div> : null}
        </div>
      </section>
    );
  }

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
        <div className="profile-catalogue-workspace">
          {renderKnownList()}
          <section className="profile-catalogue__preview feature-detail-card"><DetailCard option={selectedKnown} /></section>
        </div>
      ) : view === "catalogue" ? (
        <div className="profile-catalogue-workspace">
          {renderCatalogList()}
          <section className="profile-catalogue__preview feature-detail-card"><DetailCard option={selected} /></section>
        </div>
      ) : (
        <div className="profile-catalogue-workspace">
          {renderCatalogList()}
          <section className="profile-catalogue__preview feature-detail-card">
            <DetailCard option={selected} isAdmin notes={notes} setNotes={setNotes} busy={busy} isKnown={!!selectedKnownRecord} onGrant={grantSelected} onRemove={removeSelectedOption} />
          </section>
        </div>
      )}

      <style jsx>{`
        .feature-summary { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; }
        .feature-detail { padding:.8rem; border-radius:.7rem; background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.09); }
        .feature-detail p { white-space:pre-line; line-height:1.55; }
        .feature-prerequisite { line-height:1.45; color:rgba(255,255,255,.78); }
        .feature-detail-card { min-height:230px; }
      `}</style>
    </div>
  );
}

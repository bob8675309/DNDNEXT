import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

function safeText(value) {
  return String(value ?? "").trim();
}

function uniqueText(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(safeText).filter(Boolean))];
}

export default function CharacterFeaturesPanel({ character = null, isAdmin = false }) {
  const characterId = character?.id || null;
  const [catalog, setCatalog] = useState([]);
  const [grants, setGrants] = useState([]);
  const [sheetFeats, setSheetFeats] = useState([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("feat");
  const [selectedId, setSelectedId] = useState("");
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

  const grantedOptionIds = useMemo(() => new Set(grants.map((grant) => grant.optionId)), [grants]);
  const filtered = useMemo(() => catalog.filter((option) => {
    if (option.option_type !== type) return false;
    const q = safeText(query).toLowerCase();
    if (!q) return true;
    return [option.name, option.source, option.category, option.description, option.prerequisite_text]
      .filter(Boolean).join(" ").toLowerCase().includes(q);
  }), [catalog, query, type]);
  const selected = useMemo(() => catalog.find((option) => option.id === selectedId) || filtered[0] || null, [catalog, filtered, selectedId]);

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
    if (grantError) {
      setError(grantError.message || "Could not grant this feat or boon.");
    } else {
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
    if (removeError) {
      setError(removeError.message || "Could not remove this feat or boon.");
    } else {
      setNotice(`${grant.name} removed.`);
      await loadData({ preserveNotice: true });
    }
    setBusy(false);
  }

  if (loading) return <div className="npc-card"><div className="text-muted">Loading feats and boons…</div></div>;

  const featGrants = grants.filter((grant) => grant.optionType === "feat");
  const boonGrants = grants.filter((grant) => grant.optionType === "boon");

  return (
    <div className="character-features-panel">
      <div className="npc-card mb-3 feature-summary">
        <div>
          <div className="spell-admin-kicker">Feats & Boons</div>
          <h2 className="h5 mb-1">{character?.name || "Character"}</h2>
          <div className="small text-muted">Origin, level, campaign, and Game Master-granted feats and boons are kept distinct.</div>
        </div>
        <button type="button" className="btn btn-sm btn-outline-light" onClick={() => loadData()}>Refresh</button>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {notice ? <div className="alert alert-success py-2">{notice}</div> : null}

      <div className="row g-3">
        <div className="col-12 col-xl-5">
          <section className="npc-card feature-catalog-card">
            <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-3">
              <div>
                <div className="npc-card-title mb-0">{isAdmin ? "Grant a Feat or Boon" : "Feat & Boon Catalog"}</div>
                <div className="small text-muted">One preferred version is shown when names repeat.</div>
              </div>
              <div className="btn-group btn-group-sm">
                <button type="button" className={`btn ${type === "feat" ? "btn-warning" : "btn-outline-light"}`} onClick={() => setType("feat")}>Feats</button>
                <button type="button" className={`btn ${type === "boon" ? "btn-warning" : "btn-outline-light"}`} onClick={() => setType("boon")}>Boons</button>
              </div>
            </div>
            <input className="form-control form-control-sm mb-2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${type === "feat" ? "feats" : "boons"}…`} />
            <div className="feature-catalog-list">
              {filtered.map((option) => <button type="button" key={option.id} className={`feature-catalog-row ${selected?.id === option.id ? "active" : ""}`} onClick={() => setSelectedId(option.id)}><strong>{option.name}</strong><small>{option.source}{option.category ? ` • ${option.category}` : ""}{grantedOptionIds.has(option.id) ? " • Granted" : ""}</small></button>)}
              {!filtered.length ? <div className="text-muted">No imported {type === "feat" ? "feats" : "boons"} match this search.</div> : null}
            </div>
          </section>
        </div>

        <div className="col-12 col-xl-7">
          <div className="row g-3 mb-3">
            <div className="col-12 col-lg-7">
              <section className="npc-card h-100">
                <div className="npc-card-title">Character Feats</div>
                {!sheetFeats.length && !featGrants.length ? <div className="text-muted">No feats are recorded yet.</div> : null}
                <div className="feature-grant-list">
                  {sheetFeats.map((name) => <div key={`sheet-${name}`} className="feature-grant-row"><div><strong>{name}</strong><small>Origin, level, or creation feat</small></div><span className="badge text-bg-secondary">Sheet</span></div>)}
                  {featGrants.map((grant) => <div key={grant.id} className="feature-grant-row"><div><strong>{grant.name}</strong><small>{grant.source}{grant.notes ? ` • ${grant.notes}` : ""}</small></div>{isAdmin ? <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => removeGrant(grant)}>Remove</button> : <span className="badge text-bg-warning">GM</span>}</div>)}
                </div>
              </section>
            </div>
            <div className="col-12 col-lg-5">
              <section className="npc-card h-100">
                <div className="npc-card-title">Epic Boons</div>
                {!boonGrants.length ? <div className="text-muted">No Epic Boons have been granted.</div> : null}
                <div className="feature-grant-list">
                  {boonGrants.map((grant) => <div key={grant.id} className="feature-grant-row"><div><strong>{grant.name}</strong><small>{grant.source}{grant.notes ? ` • ${grant.notes}` : ""}</small></div>{isAdmin ? <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => removeGrant(grant)}>Remove</button> : <span className="badge text-bg-info">Boon</span>}</div>)}
                </div>
              </section>
            </div>
          </div>

          <section className="npc-card feature-detail-card">
            <div className="npc-card-title mb-2">{selected?.option_type === "boon" ? "Boon Description" : "Feat Description"}</div>
            {selected ? <div className="feature-detail"><div className="d-flex justify-content-between gap-2"><h3 className="h5 mb-1">{selected.name}</h3><span className="badge text-bg-secondary">{selected.source}</span></div>{selected.prerequisite_text ? <div className="small mt-2"><strong>Prerequisite:</strong> {selected.prerequisite_text}</div> : null}<p className="small mt-2 mb-0">{selected.description || "No source description is available."}</p></div> : <div className="text-muted">Select a feat or boon from the list to inspect it.</div>}
            {isAdmin && selected ? <div className="mt-3"><label className="form-label small fw-semibold">GM notes</label><input className="form-control form-control-sm" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional reason, quest reward, blessing…" /><button type="button" className="btn btn-warning btn-sm mt-2" disabled={busy || grantedOptionIds.has(selected.id)} onClick={grantSelected}>{grantedOptionIds.has(selected.id) ? "Already granted" : busy ? "Granting…" : `Grant ${selected.option_type === "boon" ? "Boon" : "Feat"}`}</button></div> : null}
          </section>
        </div>
      </div>

      <style jsx>{`
        .feature-summary { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; }
        .feature-catalog-card { min-height:62vh; }
        .feature-grant-list { display:grid; gap:.45rem; }
        .feature-grant-row { display:flex; justify-content:space-between; align-items:center; gap:.6rem; padding:.6rem .7rem; border:1px solid rgba(255,255,255,.09); border-radius:.65rem; background:rgba(255,255,255,.035); }
        .feature-grant-row > div { min-width:0; display:grid; }
        .feature-grant-row small, .feature-catalog-row small { color:rgba(255,255,255,.58); }
        .feature-catalog-list { display:grid; gap:.4rem; max-height:54vh; overflow:auto; padding-right:.2rem; }
        .feature-catalog-row { display:grid; padding:.55rem .65rem; border:1px solid rgba(255,255,255,.09); border-radius:.6rem; background:rgba(255,255,255,.035); color:inherit; text-align:left; }
        .feature-catalog-row.active { border-color:rgba(245,190,75,.65); background:rgba(245,190,75,.1); }
        .feature-detail { padding:.75rem; border-radius:.7rem; background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.09); }
        .feature-detail p { white-space:pre-line; line-height:1.5; }
        .feature-detail-card { min-height:230px; }
      `}</style>
    </div>
  );
}

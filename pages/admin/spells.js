import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import SpellCard from "../../components/SpellCard";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const SCHOOLS = ["All", "Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];
const LEVELS = ["All", "Cantrip", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

function levelLabel(level) {
  return Number(level || 0) === 0 ? "Cantrip" : `Lv ${level}`;
}

function matchesText(spell, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [spell.name, spell.school, spell.source, spell.description, ...(spell.classes || []), ...(spell.damage_types || []), ...(spell.saving_throw_abilities || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function validatePreviewPayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Preview file must be a JSON object.");
  if (!Array.isArray(payload.rows)) throw new Error("Preview file must contain a rows array.");
  if (!payload.rows.length) throw new Error("Preview file has no spell rows.");
  if (payload.rows.length > 250) throw new Error("This controlled import is capped at 250 spells per batch.");
  if (payload.effects && !Array.isArray(payload.effects)) throw new Error("Preview file effects must be an array when present.");
  if ((payload.effects || []).length > 750) throw new Error("This controlled import is capped at 750 spell effects per batch.");
  const missingKey = payload.rows.find((row) => !row?.spell_key || !row?.name);
  if (missingKey) throw new Error("Every spell row must include spell_key and name.");
  return {
    ...payload,
    effects: Array.isArray(payload.effects) ? payload.effects : [],
  };
}

export default function AdminSpellCatalogPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [spells, setSpells] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [importError, setImportError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [importPayload, setImportPayload] = useState(null);
  const [query, setQuery] = useState("");
  const [school, setSchool] = useState("All");
  const [level, setLevel] = useState("All");
  const [source, setSource] = useState("All");

  const loadSpells = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: loadError } = await supabase
        .from("spells_catalog")
        .select("id,spell_key,name,source,page,level,school,classes,subclasses,ritual,concentration,casting_time,range_text,area_type,area_size,area_unit,components_v,components_s,components_m,material_text,duration_text,saving_throw_abilities,attack_type,damage_dice,damage_types,healing_dice,scaling_text,description,higher_level_text,tags,misc_tags,area_tags")
        .order("level", { ascending: true })
        .order("name", { ascending: true })
        .limit(500);
      if (loadError) throw loadError;
      const rows = data || [];
      setSpells(rows);
      setSelected((current) => current && rows.some((row) => row.id === current.id) ? current : rows[0] || null);
    } catch (err) {
      setError(err?.message || "Failed to load spells.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) {
          if (alive) setAuthChecked(true);
          return;
        }
        const { data } = await supabase.rpc("is_admin");
        if (alive) {
          setIsAdmin(Boolean(data));
          setAuthChecked(true);
        }
      } catch {
        if (alive) setAuthChecked(true);
      }
    }
    check();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (authChecked && isAdmin) loadSpells();
  }, [authChecked, isAdmin, loadSpells]);

  const sources = useMemo(() => ["All", ...Array.from(new Set(spells.map((spell) => spell.source).filter(Boolean))).sort()], [spells]);

  const filtered = useMemo(() => spells.filter((spell) => {
    if (school !== "All" && spell.school !== school) return false;
    if (source !== "All" && spell.source !== source) return false;
    if (level === "Cantrip" && Number(spell.level || 0) !== 0) return false;
    if (level !== "All" && level !== "Cantrip" && Number(spell.level || 0) !== Number(level)) return false;
    return matchesText(spell, query);
  }), [level, query, school, source, spells]);

  useEffect(() => {
    if (!filtered.length) return;
    if (!selected || !filtered.some((spell) => spell.id === selected.id)) setSelected(filtered[0]);
  }, [filtered, selected]);

  async function handlePreviewFile(event) {
    const file = event.target.files?.[0];
    setImportPayload(null);
    setImportError("");
    setImportMessage("");
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validated = validatePreviewPayload(parsed);
      setImportPayload(validated);
      setImportMessage(`Ready to import ${validated.rows.length} spells and ${validated.effects.length} effects from ${file.name}.`);
    } catch (err) {
      setImportError(err?.message || "Could not read this preview JSON file.");
    }
  }

  async function importPreviewBatch() {
    if (!importPayload) return;
    setImporting(true);
    setImportError("");
    setImportMessage("");
    try {
      const { data, error: importRpcError } = await supabase.rpc("import_spell_preview_batch", { p_payload: importPayload });
      if (importRpcError) throw importRpcError;
      const importedSpells = Number(data?.spells || 0);
      const importedEffects = Number(data?.effects || 0);
      setImportMessage(`Imported ${importedSpells} spells and ${importedEffects} effects.`);
      setImportPayload(null);
      await loadSpells();
    } catch (err) {
      setImportError(err?.message || "Spell import failed.");
    } finally {
      setImporting(false);
    }
  }

  const importSummary = importPayload?.summary || null;

  if (!authChecked) return <main className="container my-4 admin-dark"><div className="text-muted">Checking admin access...</div></main>;
  if (!isAdmin) return <main className="container my-4 admin-dark"><h1 className="h4">Spell Catalog</h1><p className="text-muted">Admin access is required.</p></main>;

  return (
    <main className="container-fluid my-3 px-3 admin-dark spell-admin-page">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <div className="spell-admin-kicker">Magic Database</div>
          <h1 className="h3 mb-0">Spell Catalog</h1>
          <div className="text-muted small">Preview, verify, and assign spells to characters, monsters, items, potions, and enchants.</div>
        </div>
        <Link className="btn btn-outline-light btn-sm" href="/admin">Admin Dashboard</Link>
      </div>

      <section className="spell-admin-import mb-3">
        <div>
          <div className="spell-admin-kicker">Controlled import</div>
          <h2 className="h5 mb-1">Upload reviewed spell-preview.json</h2>
          <p className="text-muted small mb-0">Use the local preview importer first, review the JSON, then import that reviewed batch here. Batches are capped at 250 spells.</p>
        </div>
        <div className="spell-admin-import-actions">
          <input type="file" className="form-control form-control-sm" accept="application/json,.json" onChange={handlePreviewFile} />
          <button type="button" className="btn btn-warning btn-sm" disabled={!importPayload || importing} onClick={importPreviewBatch}>{importing ? "Importing..." : "Import reviewed batch"}</button>
        </div>
        {importPayload ? <div className="spell-import-summary">{importPayload.rows.length} spells / {importPayload.effects.length} effects{importSummary?.bySource ? ` • Sources: ${Object.keys(importSummary.bySource).join(", ")}` : ""}</div> : null}
        {importMessage ? <div className="alert alert-success py-2 mb-0">{importMessage}</div> : null}
        {importError ? <div className="alert alert-danger py-2 mb-0">{importError}</div> : null}
      </section>

      <section className="spell-admin-toolbar mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-12 col-lg-4"><label className="form-label fw-semibold">Search</label><input className="form-control" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="acid, wisdom, evocation..." /></div>
          <div className="col-6 col-lg-2"><label className="form-label fw-semibold">Level</label><select className="form-select" value={level} onChange={(event) => setLevel(event.target.value)}>{LEVELS.map((option) => <option key={option}>{option}</option>)}</select></div>
          <div className="col-6 col-lg-3"><label className="form-label fw-semibold">School</label><select className="form-select" value={school} onChange={(event) => setSchool(event.target.value)}>{SCHOOLS.map((option) => <option key={option}>{option}</option>)}</select></div>
          <div className="col-6 col-lg-2"><label className="form-label fw-semibold">Source</label><select className="form-select" value={source} onChange={(event) => setSource(event.target.value)}>{sources.map((option) => <option key={option}>{option}</option>)}</select></div>
          <div className="col-6 col-lg-1 text-lg-end"><div className="small text-muted">Loaded</div><div className="fw-bold">{spells.length}</div></div>
        </div>
      </section>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {loading ? <div className="text-muted">Loading spells...</div> : null}
      {!loading && spells.length === 0 ? <div className="spell-empty-state"><h2>No spells imported yet</h2><p>Generate a preview JSON locally, upload it above, and import the reviewed batch.</p></div> : null}

      {spells.length ? (
        <div className="row g-3">
          <div className="col-12 col-lg-5 col-xl-4">
            <div className="spell-result-list">
              {filtered.map((spell) => (
                <button key={spell.id} type="button" className={`spell-result-row ${selected?.id === spell.id ? "active" : ""}`} onClick={() => setSelected(spell)}>
                  <span className="spell-result-name">{spell.name}</span>
                  <span className="spell-result-meta">{levelLabel(spell.level)} • {spell.school || "--"} • {spell.source}</span>
                </button>
              ))}
              {!filtered.length ? <div className="p-3 text-muted">No matching spells.</div> : null}
            </div>
          </div>
          <div className="col-12 col-lg-7 col-xl-8"><div className="spell-preview-shell">{selected ? <SpellCard spell={selected} /> : <div className="text-muted">Select a spell.</div>}</div></div>
        </div>
      ) : null}
    </main>
  );
}

import { useEffect, useMemo, useState } from "react";
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

export default function AdminSpellCatalogPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [spells, setSpells] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [school, setSchool] = useState("All");
  const [level, setLevel] = useState("All");
  const [source, setSource] = useState("All");

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
    if (!authChecked || !isAdmin) return;
    let alive = true;
    async function load() {
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
        if (alive) {
          const rows = data || [];
          setSpells(rows);
          setSelected(rows[0] || null);
        }
      } catch (err) {
        if (alive) setError(err?.message || "Failed to load spells.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [authChecked, isAdmin]);

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

  if (!authChecked) return <main className="container my-4 admin-dark"><div className="text-muted">Checking admin access...</div></main>;
  if (!isAdmin) return <main className="container my-4 admin-dark"><h1 className="h4">Spell Catalog</h1><p className="text-muted">Admin access is required.</p></main>;

  return (
    <main className="container-fluid my-3 px-3 admin-dark spell-admin-page">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <div className="spell-admin-kicker">Magic Database</div>
          <h1 className="h3 mb-0">Spell Catalog</h1>
          <div className="text-muted small">Preview, verify, and later assign spells to characters, monsters, items, potions, and enchants.</div>
        </div>
        <Link className="btn btn-outline-light btn-sm" href="/admin">Admin Dashboard</Link>
      </div>

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
      {!loading && spells.length === 0 ? <div className="spell-empty-state"><h2>No spells imported yet</h2><p>Run the preview importer, review the output, then use the controlled import path once approved.</p></div> : null}

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

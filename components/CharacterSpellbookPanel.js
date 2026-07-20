import { useCallback, useEffect, useMemo, useState } from "react";
import SpellCard from "./SpellCard";
import { supabase } from "../utils/supabaseClient";
import {
  highestUnlockedSpellLevel,
  isSpellUnlockedForCharacter,
  resolveCharacterSpellProfile,
  spellLevelLabel,
  spellMatchesClass,
} from "../utils/spells/classSpellbookRules";

const SPELL_SELECT = "id,spell_key,name,source,page,level,school,classes,subclasses,ritual,concentration,casting_time,range_text,area_type,area_size,area_unit,components_v,components_s,components_m,material_text,duration_text,saving_throw_abilities,attack_type,damage_dice,damage_types,healing_dice,scaling_text,description,higher_level_text,tags,misc_tags,area_tags";
// Compatibility contract retained for the existing build validator.
const SPELL_SOURCE_PRIORITY = { XPHB: 0, PHB: 1 };
const SPELL_SOURCE_RANK = { XPHB: 0, EFA: 1, TCE: 2, PHB: 3 };

function safeText(value) {
  return String(value ?? "").trim();
}

function sortSpellRows(a, b) {
  return Number(a?.level || 0) - Number(b?.level || 0)
    || safeText(a?.name).localeCompare(safeText(b?.name));
}

function preferredSpellRows(rows = []) {
  const preferred = new Map();
  for (const spell of rows) {
    const key = `${safeText(spell?.name).toLowerCase()}|${Number(spell?.level || 0)}`;
    if (!safeText(spell?.name)) continue;
    const current = preferred.get(key);
    const nextPriority = Number(SPELL_SOURCE_RANK[spell?.source] ?? 9);
    const currentPriority = Number(SPELL_SOURCE_RANK[current?.source] ?? 9);
    if (!current || nextPriority < currentPriority) preferred.set(key, spell);
  }
  return [...preferred.values()];
}

function matchesQuery(spell, query) {
  const q = safeText(query).toLowerCase();
  if (!q) return true;
  return [
    spell?.name,
    spell?.school,
    spell?.source,
    spell?.description,
    ...(spell?.classes || []),
    ...(spell?.damage_types || []),
    ...(spell?.saving_throw_abilities || []),
  ].filter(Boolean).join(" ").toLowerCase().includes(q);
}

function assignmentSpell(row, spellById) {
  return spellById.get(row.spell_id) || null;
}

export default function CharacterSpellbookPanel({ character = null, isAdmin = false }) {
  const characterId = character?.id || null;
  const [sheet, setSheet] = useState(null);
  const [spells, setSpells] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [view, setView] = useState("known");
  const [selectedSpellId, setSelectedSpellId] = useState("");
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("All");
  const [schoolFilter, setSchoolFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [catalogueSort, setCatalogueSort] = useState("levelName");
  const [loading, setLoading] = useState(true);
  const [busySpellId, setBusySpellId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const profile = useMemo(() => resolveCharacterSpellProfile(sheet || {}, character || {}), [character, sheet]);
  const highestLevel = useMemo(() => highestUnlockedSpellLevel(profile), [profile]);
  const spellById = useMemo(() => new Map(spells.map((spell) => [spell.id, spell])), [spells]);
  const preferredSpells = useMemo(() => preferredSpellRows(spells), [spells]);
  const has2024Catalog = useMemo(() => spells.some((spell) => spell.source === "XPHB"), [spells]);
  const assignmentBySpellId = useMemo(() => new Map(assignments.map((row) => [row.spell_id, row])), [assignments]);
  const catalogHasClassMetadata = useMemo(
    () => preferredSpells.some((spell) => Array.isArray(spell.classes) && spell.classes.length > 0),
    [preferredSpells]
  );
  const classFilterReady = !profile.classKey || catalogHasClassMetadata;

  const assignedSpells = useMemo(() => assignments
    .map((row) => ({ assignment: row, spell: assignmentSpell(row, spellById) }))
    .filter((row) => row.spell)
    .sort((a, b) => sortSpellRows(a.spell, b.spell)), [assignments, spellById]);

  const catalogueSources = useMemo(() => ["All", ...Array.from(new Set(preferredSpells.map((spell) => spell.source).filter(Boolean))).sort()], [preferredSpells]);
  const catalogueSchools = useMemo(() => ["All", ...Array.from(new Set(preferredSpells.map((spell) => spell.school).filter(Boolean))).sort()], [preferredSpells]);
  const catalogueSpells = useMemo(() => preferredSpells
    .filter((spell) => matchesQuery(spell, query))
    .filter((spell) => sourceFilter === "All" || spell.source === sourceFilter)
    .filter((spell) => schoolFilter === "All" || spell.school === schoolFilter)
    .filter((spell) => levelFilter === "All" || (levelFilter === "Cantrip" ? Number(spell.level || 0) === 0 : Number(spell.level || 0) === Number(levelFilter)))
    .sort((a, b) => {
      if (catalogueSort === "name") return safeText(a.name).localeCompare(safeText(b.name)) || sortSpellRows(a, b);
      if (catalogueSort === "school") return safeText(a.school).localeCompare(safeText(b.school)) || sortSpellRows(a, b);
      if (catalogueSort === "source") return safeText(a.source).localeCompare(safeText(b.source)) || sortSpellRows(a, b);
      return sortSpellRows(a, b);
    }), [catalogueSort, levelFilter, preferredSpells, query, schoolFilter, sourceFilter]);

  const eligibleSpells = useMemo(() => {
    const hasClass = !!profile.classKey;
    if (hasClass && !catalogHasClassMetadata) return [];

    return preferredSpells
      .filter((spell) => !assignmentBySpellId.has(spell.id))
      .filter((spell) => !hasClass || spellMatchesClass(spell, profile.classKey))
      .filter((spell) => !hasClass || isSpellUnlockedForCharacter(spell, profile))
      .filter((spell) => matchesQuery(spell, query))
      .sort(sortSpellRows)
      .slice(0, 150);
  }, [assignmentBySpellId, catalogHasClassMetadata, preferredSpells, profile, query]);

  const selectedSpell = useMemo(() => {
    const assignedMatch = assignedSpells.find(({ spell }) => spell.id === selectedSpellId)?.spell;
    if (assignedMatch) return assignedMatch;
    const catalogMatch = catalogueSpells.find((spell) => spell.id === selectedSpellId);
    if (catalogMatch) return catalogMatch;
    const eligibleMatch = eligibleSpells.find((spell) => spell.id === selectedSpellId);
    if (eligibleMatch) return eligibleMatch;
    if (view === "known") return assignedSpells[0]?.spell || null;
    if (view === "admin") return eligibleSpells[0] || assignedSpells[0]?.spell || null;
    return catalogueSpells[0] || null;
  }, [assignedSpells, catalogueSpells, eligibleSpells, selectedSpellId, view]);

  const loadSpellbook = useCallback(async ({ preserveNotice = false } = {}) => {
    if (!characterId) {
      setSheet(null);
      setSpells([]);
      setAssignments([]);
      setSelectedSpellId("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    if (!preserveNotice) setNotice("");

    const [sheetResult, spellResult, assignmentResult] = await Promise.all([
      supabase.from("character_sheets").select("sheet").eq("character_id", characterId).maybeSingle(),
      supabase.from("spells_catalog").select(SPELL_SELECT).order("level", { ascending: true }).order("name", { ascending: true }).limit(2000),
      supabase.from("character_spells")
        .select("id,character_id,spell_id,source_type,source_label,prepared,always_available,uses_max,uses_remaining,recharge,casting_stat,save_dc_override,attack_bonus_override,notes,created_at,updated_at")
        .eq("character_id", characterId)
        .order("created_at", { ascending: true }),
    ]);

    if (sheetResult.error) setError(sheetResult.error.message || "Failed to load character class information.");
    if (spellResult.error) setError(spellResult.error.message || "Failed to load the spell catalog.");
    if (assignmentResult.error) setError(assignmentResult.error.message || "Failed to load the character spellbook.");

    const nextSpells = spellResult.data || [];
    const nextAssignments = assignmentResult.data || [];
    setSheet(sheetResult.data?.sheet || {});
    setSpells(nextSpells);
    setAssignments(nextAssignments);
    setSelectedSpellId((current) => {
      if (current && nextSpells.some((spell) => spell.id === current)) return current;
      return nextAssignments[0]?.spell_id || "";
    });
    setLoading(false);
  }, [characterId]);

  useEffect(() => {
    loadSpellbook();
  }, [loadSpellbook]);

  useEffect(() => {
    if (!isAdmin && view === "admin") setView("known");
  }, [isAdmin, view]);

  useEffect(() => {
    if (!catalogueSources.includes(sourceFilter)) setSourceFilter("All");
    if (!catalogueSchools.includes(schoolFilter)) setSchoolFilter("All");
  }, [catalogueSchools, catalogueSources, schoolFilter, sourceFilter]);

  async function assignSpell(spell) {
    if (!isAdmin || !characterId || !spell?.id || !classFilterReady) return;
    setBusySpellId(spell.id);
    setError("");
    setNotice("");

    const { error: insertError } = await supabase.from("character_spells").insert({
      character_id: characterId,
      spell_id: spell.id,
      source_type: profile.classKey ? "class" : "admin",
      source_label: profile.className || "Admin grant",
      prepared: false,
      always_available: false,
      casting_stat: profile.castingAbility || null,
      raw_payload: {},
    });

    if (insertError) setError(insertError.message || "Failed to add this spell.");
    else {
      setNotice(`${spell.name} added to ${character?.name || "the character"}'s spellbook.`);
      setSelectedSpellId(spell.id);
      await loadSpellbook({ preserveNotice: true });
    }
    setBusySpellId("");
  }

  async function updateAssignment(rowId, patch) {
    if (!isAdmin || !rowId) return;
    setBusySpellId(rowId);
    setError("");
    setNotice("");

    const { error: updateError } = await supabase
      .from("character_spells")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", rowId);

    if (updateError) setError(updateError.message || "Failed to update the spellbook.");
    else setAssignments((rows) => rows.map((row) => row.id === rowId ? { ...row, ...patch } : row));
    setBusySpellId("");
  }

  async function removeAssignment(row) {
    if (!isAdmin || !row?.id) return;
    const spell = spellById.get(row.spell_id);
    if (typeof window !== "undefined" && !window.confirm(`Remove ${spell?.name || "this spell"} from ${character?.name || "this character"}?`)) return;

    setBusySpellId(row.id);
    setError("");
    setNotice("");
    const { error: deleteError } = await supabase.from("character_spells").delete().eq("id", row.id);
    if (deleteError) setError(deleteError.message || "Failed to remove this spell.");
    else {
      setNotice(`${spell?.name || "Spell"} removed.`);
      await loadSpellbook({ preserveNotice: true });
    }
    setBusySpellId("");
  }

  if (loading) return <div className="npc-card"><div className="text-muted">Loading spellbook…</div></div>;

  function KnownList({ adminControls = false }) {
    return (
      <section className="npc-card h-100">
        <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
          <div>
            <div className="npc-card-title mb-0">Known / Granted Spells</div>
            <div className="small text-muted">{assignedSpells.length} spell{assignedSpells.length === 1 ? "" : "s"}</div>
          </div>
        </div>
        {!assignedSpells.length ? <div className="text-muted">No spells have been added to this spellbook yet.</div> : null}
        <div className="spellbook-list">
          {assignedSpells.map(({ assignment, spell }) => (
            <div key={assignment.id} className={`spellbook-row ${selectedSpell?.id === spell.id ? "active" : ""}`}>
              <button type="button" className="spellbook-row__select" onClick={() => setSelectedSpellId(spell.id)}>
                <strong>{spell.name}</strong>
                <small>{spellLevelLabel(spell.level)} • {spell.school || "Spell"} • {spell.source}</small>
              </button>
              <div className="spellbook-row__actions">
                {assignment.prepared ? <span className="badge text-bg-success">Prepared</span> : null}
                {assignment.always_available ? <span className="badge text-bg-info">Always</span> : null}
                {adminControls ? (
                  <>
                    <label className="form-check form-switch mb-0" title="Prepared">
                      <input className="form-check-input" type="checkbox" checked={!!assignment.prepared} disabled={busySpellId === assignment.id} onChange={(event) => updateAssignment(assignment.id, { prepared: event.target.checked })} />
                    </label>
                    <button type="button" className="btn btn-sm btn-outline-danger" disabled={busySpellId === assignment.id} onClick={() => removeAssignment(assignment)}>Remove</button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function CatalogueList({ admin = false }) {
    const rows = admin ? eligibleSpells : catalogueSpells;
    if (!admin) {
      return (
        <section className="profile-catalogue" aria-label="Spell catalogue">
          <div className="profile-catalogue__heading">
            <div>
              <div className="npc-card-title mb-0">Spell Catalogue</div>
              <div className="small text-muted">Browse every preferred spell version; 2024 replaces 2014 when names repeat.</div>
            </div>
          </div>
          <div className="profile-catalogue__filters profile-catalogue__filters--spells">
            <label className="profile-catalogue__search"><span>Search</span><input className="form-control form-control-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, class, damage, or save…" /></label>
            <label><span>Level</span><select className="form-select form-select-sm" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>{["All", "Cantrip", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>School</span><select className="form-select form-select-sm" value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)}>{catalogueSchools.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Source</span><select className="form-select form-select-sm" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>{catalogueSources.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Sort</span><select className="form-select form-select-sm" value={catalogueSort} onChange={(event) => setCatalogueSort(event.target.value)}><option value="levelName">Level, then A–Z</option><option value="name">Name, A–Z</option><option value="school">School, then level</option><option value="source">Source, then level</option></select></label>
            <div className="profile-catalogue__count" aria-live="polite"><span>Showing</span><strong>{rows.length}/{preferredSpells.length}</strong></div>
          </div>
          <div className="profile-catalogue__list" aria-label="Matching spells">
            {rows.map((spell) => (
              <button type="button" aria-pressed={selectedSpell?.id === spell.id} key={spell.id} className={`profile-catalogue__row ${selectedSpell?.id === spell.id ? "active" : ""}`} onClick={() => setSelectedSpellId(spell.id)}>
                <span className="profile-catalogue__row-name">{spell.name}</span>
                <span className="profile-catalogue__row-meta">{spellLevelLabel(spell.level)} • {spell.school || "Spell"} • {spell.source}</span>
                <span className="profile-catalogue__tags">
                  {spell.concentration ? <span>Concentration</span> : null}
                  {spell.ritual ? <span>Ritual</span> : null}
                  {safeText(spell.saving_throw_abilities?.[0]) ? <span>{spell.saving_throw_abilities[0]} save</span> : null}
                  {safeText(spell.damage_types?.[0]) ? <span>{spell.damage_types[0]}</span> : null}
                  {assignmentBySpellId.has(spell.id) ? <span className="is-known">Known</span> : null}
                </span>
              </button>
            ))}
            {!rows.length ? <div className="profile-catalogue__empty">No spells match these filters.</div> : null}
          </div>
        </section>
      );
    }
    return (
      <section className="npc-card h-100">
        <div className="npc-card-title mb-0">Add from Class Spell List</div>
        <div className="small text-muted mb-2">
          {profile.classKey
            ? `Filtered to ${profile.className} spells unlocked by character level ${profile.level}. 2024 versions are preferred when both editions exist.`
            : "Set a recognized class and level to enable class filtering. Until then, the preferred catalogue is shown for explicit admin grants."}
        </div>
        <input className="form-control form-control-sm mb-2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search spell, school, class, damage type, save…" disabled={!classFilterReady} />
        <div className="spellbook-eligible-list">
          {rows.map((spell) => (
            <div key={spell.id} className={`spellbook-eligible-row ${selectedSpell?.id === spell.id ? "active" : ""}`}>
              <button type="button" className="spellbook-eligible-row__select" onClick={() => setSelectedSpellId(spell.id)}>
                <strong>{spell.name}</strong>
                <small>{spellLevelLabel(spell.level)} • {spell.school || "Spell"} • {spell.source}</small>
              </button>
              <button type="button" className="btn btn-sm btn-warning" disabled={busySpellId === spell.id || !classFilterReady} onClick={() => assignSpell(spell)}>{busySpellId === spell.id ? "Adding…" : "Add"}</button>
            </div>
          ))}
          {!rows.length ? <div className="text-muted small">No spells match this filter.</div> : null}
        </div>
      </section>
    );
  }

  return (
    <div className="character-spellbook-panel">
      <div className="spellbook-summary npc-card mb-3">
        <div>
          <div className="spell-admin-kicker">Spellbook</div>
          <h2 className="h5 mb-1">{character?.name || "Character"}</h2>
          <div className="small text-muted">
            {profile.classKey
              ? `${profile.className} level ${profile.level} • ${profile.castingAbilityLabel} casting • ${highestLevel == null ? "No spell slots yet" : highestLevel === 0 ? "Cantrips only" : `Up to level ${highestLevel} spells`}`
              : "No recognized spellcasting class is set on this character sheet."}
          </div>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <div className="btn-group btn-group-sm" role="tablist" aria-label="Spellbook views">
            <button type="button" className={`btn ${view === "known" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setView("known")}>Known</button>
            <button type="button" className={`btn ${view === "catalogue" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setView("catalogue")}>Catalogue</button>
            {isAdmin ? <button type="button" className={`btn ${view === "admin" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setView("admin")}>Admin</button> : null}
          </div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={() => loadSpellbook()}>Refresh</button>
        </div>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {notice ? <div className="alert alert-success py-2">{notice}</div> : null}
      {!has2024Catalog ? <div className="alert alert-info py-2">The 2024/XPHB spell catalog has not been imported yet. Legacy PHB spells remain available as fallbacks; once XPHB rows exist, duplicate spell names automatically use their 2024 version.</div> : null}
      {profile.classKey && !catalogHasClassMetadata ? <div className="alert alert-warning py-2">The spell catalog has not yet been enriched with class-access metadata. Existing assigned spells remain visible, but class-filtered assignment is disabled.</div> : null}

      {view === "known" ? (
        <div className="row g-3">
          <div className="col-12 col-xl-5"><KnownList /></div>
          <div className="col-12 col-xl-7"><section className="npc-card h-100"><div className="npc-card-title">Spell Details</div>{selectedSpell ? <SpellCard spell={selectedSpell} compact /> : <div className="text-muted">Select a known spell to view its details.</div>}</section></div>
        </div>
      ) : view === "catalogue" ? (
        <div className="profile-catalogue-workspace">
          <CatalogueList />
          <section className="profile-catalogue__preview"><div className="npc-card-title">Spell Details</div>{selectedSpell ? <SpellCard spell={selectedSpell} compact /> : <div className="text-muted">Select a spell to view its details.</div>}</section>
        </div>
      ) : (
        <div className="row g-3">
          <div className="col-12 col-xl-5"><KnownList adminControls /></div>
          <div className="col-12 col-xl-7">
            <section className="npc-card mb-3"><div className="npc-card-title">Spell Details</div>{selectedSpell ? <SpellCard spell={selectedSpell} compact /> : <div className="text-muted">Select a spell to view its details.</div>}</section>
            <CatalogueList admin />
          </div>
        </div>
      )}

      <style jsx>{`
        .spellbook-summary { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
        .spellbook-list, .spellbook-eligible-list { display:grid; gap:.5rem; max-height:58vh; overflow:auto; padding-right:.2rem; }
        .spellbook-row, .spellbook-eligible-row { display:flex; align-items:center; justify-content:space-between; gap:.75rem; border:1px solid rgba(255,255,255,.1); border-radius:.75rem; background:rgba(255,255,255,.035); padding:.55rem .65rem; }
        .spellbook-row.active, .spellbook-eligible-row.active { border-color:rgba(245,190,75,.7); background:rgba(245,190,75,.11); }
        .spellbook-row__select, .spellbook-eligible-row__select { min-width:0; flex:1; display:grid; text-align:left; border:0; background:transparent; color:inherit; padding:0; }
        .spellbook-row__select small, .spellbook-eligible-row__select small { color:rgba(255,255,255,.62); }
        .spellbook-row__actions { display:flex; align-items:center; justify-content:flex-end; gap:.4rem; flex-wrap:wrap; }
      `}</style>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import SpellCard from "./SpellCard";
import { supabase } from "../utils/supabaseClient";
import {
  highestUnlockedSpellLevel,
  isSpellUnlockedForCharacter,
  normalizeClassKey,
  resolveCharacterSpellProfile,
  spellLevelLabel,
  spellMatchesCharacterProfile,
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
  const [classFilter, setClassFilter] = useState("All");
  const [levelFilter, setLevelFilter] = useState("All");
  const [schoolFilter, setSchoolFilter] = useState("All");
  const [catalogueSort, setCatalogueSort] = useState("levelName");
  const [statusFilter, setStatusFilter] = useState("All");
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

  const catalogueClasses = useMemo(() => {
    const labels = new Map();
    for (const spell of preferredSpells) {
      for (const value of Array.isArray(spell.classes) ? spell.classes : []) {
        const key = normalizeClassKey(value);
        if (!key || labels.has(key)) continue;
        labels.set(key, key.replace(/\b\w/g, (letter) => letter.toUpperCase()));
      }
    }
    return [{ value: "All", label: "All" }, ...Array.from(labels, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))];
  }, [preferredSpells]);
  const catalogueSchools = useMemo(() => ["All", ...Array.from(new Set(preferredSpells.map((spell) => spell.school).filter(Boolean))).sort()], [preferredSpells]);
  const catalogueBaseSpells = useMemo(() => preferredSpells
    .filter((spell) => classFilter === "All" || spellMatchesClass(spell, classFilter)), [classFilter, preferredSpells]);
  const catalogueSpells = useMemo(() => catalogueBaseSpells
    .filter((spell) => matchesQuery(spell, query))
    .filter((spell) => schoolFilter === "All" || spell.school === schoolFilter)
    .filter((spell) => levelFilter === "All" || (levelFilter === "Cantrip" ? Number(spell.level || 0) === 0 : Number(spell.level || 0) === Number(levelFilter)))
    .sort((a, b) => {
      if (catalogueSort === "name") return safeText(a.name).localeCompare(safeText(b.name)) || sortSpellRows(a, b);
      if (catalogueSort === "school") return safeText(a.school).localeCompare(safeText(b.school)) || sortSpellRows(a, b);
      if (catalogueSort === "source") return safeText(a.source).localeCompare(safeText(b.source)) || sortSpellRows(a, b);
      return sortSpellRows(a, b);
    }), [catalogueBaseSpells, catalogueSort, levelFilter, query, schoolFilter]);

  const knownSpells = useMemo(() => assignedSpells
    .filter(({ spell }) => matchesQuery(spell, query))
    .filter(({ spell }) => classFilter === "All" || spellMatchesClass(spell, classFilter))
    .filter(({ spell }) => schoolFilter === "All" || spell.school === schoolFilter)
    .filter(({ spell }) => levelFilter === "All" || (levelFilter === "Cantrip" ? Number(spell.level || 0) === 0 : Number(spell.level || 0) === Number(levelFilter)))
    .sort((a, b) => {
      if (catalogueSort === "name") return safeText(a.spell.name).localeCompare(safeText(b.spell.name)) || sortSpellRows(a.spell, b.spell);
      if (catalogueSort === "school") return safeText(a.spell.school).localeCompare(safeText(b.spell.school)) || sortSpellRows(a.spell, b.spell);
      if (catalogueSort === "source") return safeText(a.spell.source).localeCompare(safeText(b.spell.source)) || sortSpellRows(a.spell, b.spell);
      return sortSpellRows(a.spell, b.spell);
    }), [assignedSpells, catalogueSort, classFilter, levelFilter, query, schoolFilter]);

  const adminSpells = useMemo(() => catalogueSpells
    .filter((spell) => statusFilter === "All" || (statusFilter === "Known" ? assignmentBySpellId.has(spell.id) : !assignmentBySpellId.has(spell.id)))
  , [assignmentBySpellId, catalogueSpells, statusFilter]);

  const selectedSpell = useMemo(() => {
    if (view === "known") return knownSpells.find(({ spell }) => spell.id === selectedSpellId)?.spell || knownSpells[0]?.spell || null;
    if (isAdmin) return adminSpells.find((spell) => spell.id === selectedSpellId) || adminSpells[0] || null;
    return catalogueSpells.find((spell) => spell.id === selectedSpellId) || catalogueSpells[0] || null;
  }, [adminSpells, catalogueSpells, isAdmin, knownSpells, selectedSpellId, view]);
  const selectedAssignment = selectedSpell ? assignmentBySpellId.get(selectedSpell.id) || null : null;
  const selectedSpellEligible = !profile.classKey || (
    catalogHasClassMetadata
    && spellMatchesCharacterProfile(selectedSpell, profile)
    && isSpellUnlockedForCharacter(selectedSpell, profile)
  );

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
    if (!catalogueClasses.some((option) => option.value === classFilter)) setClassFilter("All");
    if (!catalogueSchools.includes(schoolFilter)) setSchoolFilter("All");
  }, [catalogueClasses, catalogueSchools, classFilter, schoolFilter]);

  async function assignSpell(spell) {
    const isEligible = !profile.classKey || (
      catalogHasClassMetadata
      && spellMatchesCharacterProfile(spell, profile)
      && isSpellUnlockedForCharacter(spell, profile)
    );
    if (!isAdmin || !characterId || !spell?.id || !classFilterReady || !isEligible) return;
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

  function renderSpellFilters(visibleCount, totalCount, includeStatus = false) {
    return (
      <section className="profile-catalogue-toolbar" aria-label="Spell catalogue filters">
        <div className={`profile-catalogue__filters profile-catalogue__filters--spells ${includeStatus ? "profile-catalogue__filters--spell-admin" : ""}`}>
          <label className="profile-catalogue__search"><span>Search</span><input className="form-control form-control-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, class, damage, or save…" /></label>
          <label><span>Class</span><select className="form-select form-select-sm" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>{catalogueClasses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label><span>Level</span><select className="form-select form-select-sm" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>{["All", "Cantrip", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>School</span><select className="form-select form-select-sm" value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)}>{catalogueSchools.map((value) => <option key={value}>{value}</option>)}</select></label>
          {includeStatus ? <label><span>Status</span><select className="form-select form-select-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{["All", "Known", "Unknown"].map((value) => <option key={value}>{value}</option>)}</select></label> : null}
          <label><span>Sort</span><select className="form-select form-select-sm" value={catalogueSort} onChange={(event) => setCatalogueSort(event.target.value)}><option value="levelName">Level, then A–Z</option><option value="name">Name, A–Z</option><option value="school">School, then level</option><option value="source">Source, then level</option></select></label>
          <div className="profile-catalogue__count" aria-live="polite"><span>Showing</span><strong>{visibleCount}/{totalCount}</strong></div>
        </div>
      </section>
    );
  }

  function renderSpellList() {
    const rows = view === "known" ? knownSpells.map(({ spell }) => spell) : isAdmin ? adminSpells : catalogueSpells;
    const heading = view === "known" ? "Known Spells" : "Spell Catalogue";
    return (
      <section className="profile-catalogue" aria-label={heading}>
        <div className="profile-catalogue__list" aria-label={`Matching ${view === "known" ? "known " : ""}spells`}>
          {rows.map((spell) => {
            const assignment = assignmentBySpellId.get(spell.id);
            return (
              <button type="button" aria-pressed={selectedSpell?.id === spell.id} key={spell.id} className={`profile-catalogue__row ${selectedSpell?.id === spell.id ? "active" : ""}`} onClick={() => setSelectedSpellId(spell.id)}>
                <span className="profile-catalogue__row-name">{spell.name}</span>
                <span className="profile-catalogue__row-meta">{spellLevelLabel(spell.level)} • {spell.school || "Spell"} • {spell.source}</span>
                <span className="profile-catalogue__tags">
                  {spell.concentration ? <span>Concentration</span> : null}
                  {spell.ritual ? <span>Ritual</span> : null}
                  {safeText(spell.saving_throw_abilities?.[0]) ? <span>{spell.saving_throw_abilities[0]} save</span> : null}
                  {safeText(spell.damage_types?.[0]) ? <span>{spell.damage_types[0]}</span> : null}
                  {assignment?.prepared ? <span className="is-prepared">Prepared</span> : null}
                  {assignment ? <span className="is-known">Known</span> : <span>Unknown</span>}
                </span>
              </button>
            );
          })}
          {!rows.length ? <div className="profile-catalogue__empty">No {view === "known" ? "known " : ""}spells match these filters.</div> : null}
        </div>
      </section>
    );
  }

  function renderSpellDetails(adminControls = false) {
    return (
      <section className="profile-catalogue__preview">
        <div className="npc-card-title">Spell Details</div>
        {selectedSpell ? <SpellCard spell={selectedSpell} compact /> : <div className="text-muted">{view === "known" ? "No known spell matches these filters." : "Select a spell to view its details."}</div>}
        {adminControls && selectedSpell ? (
          <div className="profile-catalogue__admin-actions profile-catalogue__admin-actions--spell">
            {selectedAssignment ? (
              <label className="form-check form-switch mb-0"><input className="form-check-input" type="checkbox" checked={!!selectedAssignment.prepared} disabled={busySpellId === selectedAssignment.id} onChange={(event) => updateAssignment(selectedAssignment.id, { prepared: event.target.checked })} /><span>Prepared</span></label>
            ) : null}
            <button type="button" className={`btn btn-sm ${selectedAssignment ? "btn-outline-danger" : "btn-warning"}`} disabled={(!selectedAssignment && (!classFilterReady || !selectedSpellEligible)) || busySpellId === selectedSpell.id || busySpellId === selectedAssignment?.id} onClick={() => selectedAssignment ? removeAssignment(selectedAssignment) : assignSpell(selectedSpell)}>
              {busySpellId ? (selectedAssignment ? "Removing…" : "Adding…") : selectedAssignment ? "Remove Spell" : selectedSpellEligible ? "Add Spell" : "Not Eligible"}
            </button>
            {!selectedAssignment && !selectedSpellEligible ? <span className="small text-muted">Unavailable to {profile.className || "this character's class"} at level {profile.level}.</span> : null}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div className="character-spellbook-panel">
      <div className="spellbook-summary npc-card mb-3">
        <div>
          <h2 className="h5 mb-1">{view === "known" ? "Known Spells" : "Spell Catalogue"}</h2>
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
          </div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={() => loadSpellbook()}>Refresh</button>
        </div>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {notice ? <div className="alert alert-success py-2">{notice}</div> : null}
      {!has2024Catalog ? <div className="alert alert-info py-2">The 2024/XPHB spell catalog has not been imported yet. Legacy PHB spells remain available as fallbacks; once XPHB rows exist, duplicate spell names automatically use their 2024 version.</div> : null}
      {profile.classKey && !catalogHasClassMetadata ? <div className="alert alert-warning py-2">The spell catalog has not yet been enriched with class-access metadata. Existing assigned spells remain visible, but class-filtered assignment is disabled.</div> : null}

      {renderSpellFilters(
        view === "known" ? knownSpells.length : isAdmin ? adminSpells.length : catalogueSpells.length,
        view === "known"
          ? assignedSpells.filter(({ spell }) => classFilter === "All" || spellMatchesClass(spell, classFilter)).length
          : catalogueBaseSpells.length,
        isAdmin && view === "catalogue"
      )}

      <div className="profile-catalogue-workspace">
        {renderSpellList()}
        {renderSpellDetails(isAdmin && view === "catalogue")}
      </div>

      <style jsx>{`
        .spellbook-summary { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
      `}</style>
    </div>
  );
}

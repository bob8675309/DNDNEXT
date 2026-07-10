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

function safeText(value) {
  return String(value ?? "").trim();
}

function sortSpellRows(a, b) {
  return Number(a?.level || 0) - Number(b?.level || 0)
    || safeText(a?.name).localeCompare(safeText(b?.name));
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
  const [selectedSpellId, setSelectedSpellId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busySpellId, setBusySpellId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const profile = useMemo(() => resolveCharacterSpellProfile(sheet || {}, character || {}), [character, sheet]);
  const highestLevel = useMemo(() => highestUnlockedSpellLevel(profile), [profile]);
  const spellById = useMemo(() => new Map(spells.map((spell) => [spell.id, spell])), [spells]);
  const assignmentBySpellId = useMemo(() => new Map(assignments.map((row) => [row.spell_id, row])), [assignments]);
  const catalogHasClassMetadata = useMemo(
    () => spells.some((spell) => Array.isArray(spell.classes) && spell.classes.length > 0),
    [spells]
  );
  const classFilterReady = !profile.classKey || catalogHasClassMetadata;

  const assignedSpells = useMemo(() => assignments
    .map((row) => ({ assignment: row, spell: assignmentSpell(row, spellById) }))
    .filter((row) => row.spell)
    .sort((a, b) => sortSpellRows(a.spell, b.spell)), [assignments, spellById]);

  const eligibleSpells = useMemo(() => {
    const hasClass = !!profile.classKey;
    if (hasClass && !catalogHasClassMetadata) return [];

    return spells
      .filter((spell) => !assignmentBySpellId.has(spell.id))
      .filter((spell) => !hasClass || spellMatchesClass(spell, profile.classKey))
      .filter((spell) => !hasClass || isSpellUnlockedForCharacter(spell, profile))
      .filter((spell) => matchesQuery(spell, query))
      .sort(sortSpellRows)
      .slice(0, 100);
  }, [assignmentBySpellId, catalogHasClassMetadata, profile, query, spells]);

  const selectedSpell = useMemo(() => {
    const assignedMatch = assignedSpells.find(({ spell }) => spell.id === selectedSpellId)?.spell;
    if (assignedMatch) return assignedMatch;
    const eligibleMatch = eligibleSpells.find((spell) => spell.id === selectedSpellId);
    if (eligibleMatch) return eligibleMatch;
    return assignedSpells[0]?.spell || eligibleSpells[0] || null;
  }, [assignedSpells, eligibleSpells, selectedSpellId]);

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
      supabase.from("spells_catalog").select(SPELL_SELECT).order("level", { ascending: true }).order("name", { ascending: true }).limit(1000),
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

    if (insertError) {
      setError(insertError.message || "Failed to add this spell.");
    } else {
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

    if (updateError) {
      setError(updateError.message || "Failed to update the spellbook.");
    } else {
      setAssignments((rows) => rows.map((row) => row.id === rowId ? { ...row, ...patch } : row));
    }
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
    if (deleteError) {
      setError(deleteError.message || "Failed to remove this spell.");
    } else {
      setNotice(`${spell?.name || "Spell"} removed.`);
      await loadSpellbook({ preserveNotice: true });
    }
    setBusySpellId("");
  }

  if (loading) return <div className="npc-card"><div className="text-muted">Loading spellbook…</div></div>;

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
        <button type="button" className="btn btn-sm btn-outline-light" onClick={() => loadSpellbook()}>Refresh</button>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {notice ? <div className="alert alert-success py-2">{notice}</div> : null}
      {profile.classKey && !catalogHasClassMetadata ? (
        <div className="alert alert-warning py-2">
          The spell catalog has not yet been enriched with class-access metadata. Existing assigned spells remain visible, but class-filtered assignment is disabled until the reviewed spell batches are regenerated and imported again.
        </div>
      ) : null}

      <div className="row g-3">
        <div className="col-12 col-xl-5">
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
                    {isAdmin ? (
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
        </div>

        <div className="col-12 col-xl-7">
          <section className="npc-card mb-3">
            <div className="npc-card-title">Spell Details</div>
            {selectedSpell ? <SpellCard spell={selectedSpell} compact /> : <div className="text-muted">Select a spell to view its details.</div>}
          </section>

          {isAdmin ? (
            <section className="npc-card">
              <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-2">
                <div>
                  <div className="npc-card-title mb-0">Add from Class Spell List</div>
                  <div className="small text-muted">
                    {profile.classKey
                      ? `Filtered to ${profile.className} spells unlocked by character level ${profile.level}.`
                      : "Set a recognized class and level on the character sheet to enable class filtering. Until then, the full catalog is shown for explicit admin grants."}
                  </div>
                </div>
              </div>
              <input className="form-control form-control-sm mb-2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search spell, school, damage type, save..." disabled={!classFilterReady} />
              <div className="spellbook-eligible-list">
                {eligibleSpells.map((spell) => (
                  <div key={spell.id} className="spellbook-eligible-row">
                    <button type="button" className="spellbook-eligible-row__select" onClick={() => setSelectedSpellId(spell.id)}>
                      <strong>{spell.name}</strong>
                      <small>{spellLevelLabel(spell.level)} • {spell.school || "Spell"} • {spell.source}</small>
                    </button>
                    <button type="button" className="btn btn-sm btn-warning" disabled={busySpellId === spell.id || !classFilterReady} onClick={() => assignSpell(spell)}>{busySpellId === spell.id ? "Adding…" : "Add"}</button>
                  </div>
                ))}
                {classFilterReady && !eligibleSpells.length ? <div className="text-muted small">No additional eligible spells match this filter.</div> : null}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        .spellbook-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        .spellbook-list,
        .spellbook-eligible-list {
          display: grid;
          gap: 0.5rem;
          max-height: 58vh;
          overflow: auto;
          padding-right: 0.2rem;
        }
        .spellbook-row,
        .spellbook-eligible-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 0.75rem;
          background: rgba(255,255,255,0.035);
          padding: 0.55rem 0.65rem;
        }
        .spellbook-row.active {
          border-color: rgba(245,190,75,0.7);
          background: rgba(245,190,75,0.11);
        }
        .spellbook-row__select,
        .spellbook-eligible-row__select {
          min-width: 0;
          flex: 1;
          display: grid;
          text-align: left;
          border: 0;
          background: transparent;
          color: inherit;
          padding: 0;
        }
        .spellbook-row__select small,
        .spellbook-eligible-row__select small {
          color: rgba(255,255,255,0.62);
        }
        .spellbook-row__actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}

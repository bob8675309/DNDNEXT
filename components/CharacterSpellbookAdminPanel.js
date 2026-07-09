import { useCallback, useEffect, useMemo, useState } from "react";
import SpellCard from "./SpellCard";
import { supabase } from "../utils/supabaseClient";

const SOURCE_TYPES = [
  ["class", "Class / subclass"],
  ["admin", "Admin grant"],
  ["feat", "Feat"],
  ["item", "Item"],
  ["scroll", "Scroll"],
  ["potion", "Potion"],
  ["enchant", "Enchant"],
  ["monster", "Monster / innate"],
];
const CASTING_STATS = ["", "Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];
const SPELL_SELECT = "id,spell_key,name,source,page,level,school,classes,subclasses,ritual,concentration,casting_time,range_text,area_type,area_size,area_unit,components_v,components_s,components_m,material_text,duration_text,saving_throw_abilities,attack_type,damage_dice,damage_types,healing_dice,scaling_text,description,higher_level_text,tags,misc_tags,area_tags";

function safeText(value) {
  return String(value ?? "").trim();
}

function levelLabel(level) {
  const numeric = Number(level || 0);
  return numeric === 0 ? "Cantrip" : `Lv ${numeric}`;
}

function characterMeta(character) {
  return [character?.kind, character?.race, character?.role, character?.affiliation].filter(Boolean).join(" • ");
}

function sortByLevelName(a, b) {
  const aSpell = a.spell || a;
  const bSpell = b.spell || b;
  return Number(aSpell.level || 0) - Number(bSpell.level || 0)
    || safeText(aSpell.name).localeCompare(safeText(bSpell.name));
}

function spellMatchesQuery(spell, query) {
  const q = safeText(query).toLowerCase();
  if (!q) return true;
  return [
    spell.name,
    spell.source,
    spell.school,
    spell.description,
    ...(spell.classes || []),
    ...(spell.damage_types || []),
    ...(spell.saving_throw_abilities || []),
  ].filter(Boolean).join(" ").toLowerCase().includes(q);
}

function characterMatchesQuery(character, query) {
  const q = safeText(query).toLowerCase();
  if (!q) return true;
  return [character.name, character.kind, character.race, character.role, character.affiliation, ...(character.tags || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function normalizeAssignment(row, spellById) {
  return {
    ...row,
    spell: spellById.get(row.spell_id) || null,
  };
}

export default function CharacterSpellbookAdminPanel() {
  const [characters, setCharacters] = useState([]);
  const [spells, setSpells] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedSpellId, setSelectedSpellId] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [characterQuery, setCharacterQuery] = useState("");
  const [spellQuery, setSpellQuery] = useState("");
  const [sourceType, setSourceType] = useState("class");
  const [sourceLabel, setSourceLabel] = useState("");
  const [castingStat, setCastingStat] = useState("");
  const [prepared, setPrepared] = useState(false);
  const [alwaysAvailable, setAlwaysAvailable] = useState(false);
  const [usesMax, setUsesMax] = useState("");
  const [usesRemaining, setUsesRemaining] = useState("");
  const [recharge, setRecharge] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedCharacter = useMemo(
    () => characters.find((character) => String(character.id) === String(selectedCharacterId)) || null,
    [characters, selectedCharacterId]
  );

  const spellById = useMemo(() => new Map(spells.map((spell) => [spell.id, spell])), [spells]);

  const assignmentRows = useMemo(
    () => assignments.map((row) => normalizeAssignment(row, spellById)).filter((row) => row.spell).sort(sortByLevelName),
    [assignments, spellById]
  );

  const selectedSpell = useMemo(
    () => spellById.get(selectedSpellId) || assignmentRows.find((row) => row.id === selectedAssignmentId)?.spell || null,
    [assignmentRows, selectedAssignmentId, selectedSpellId, spellById]
  );

  const selectedAssignment = useMemo(
    () => assignmentRows.find((row) => row.id === selectedAssignmentId) || null,
    [assignmentRows, selectedAssignmentId]
  );

  const filteredCharacters = useMemo(
    () => characters.filter((character) => characterMatchesQuery(character, characterQuery)),
    [characters, characterQuery]
  );

  const filteredSpells = useMemo(
    () => spells.filter((spell) => spellMatchesQuery(spell, spellQuery)).sort(sortByLevelName).slice(0, 80),
    [spellQuery, spells]
  );

  const loadAssignments = useCallback(async (characterId) => {
    if (!characterId) {
      setAssignments([]);
      setSelectedAssignmentId("");
      return;
    }

    setAssignmentLoading(true);
    setError("");
    const { data, error: assignmentError } = await supabase
      .from("character_spells")
      .select("id,character_id,spell_id,source_type,source_label,prepared,always_available,uses_max,uses_remaining,recharge,casting_stat,save_dc_override,attack_bonus_override,notes,raw_payload,created_at,updated_at")
      .eq("character_id", characterId)
      .order("created_at", { ascending: false });

    if (assignmentError) {
      setError(assignmentError.message || "Failed to load character spells.");
      setAssignments([]);
      setSelectedAssignmentId("");
    } else {
      const rows = data || [];
      setAssignments(rows);
      setSelectedAssignmentId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id || "");
    }
    setAssignmentLoading(false);
  }, []);

  const loadBaseData = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    const [characterRes, spellRes] = await Promise.all([
      supabase
        .from("characters")
        .select("id,name,kind,race,role,affiliation,status,tags")
        .in("kind", ["npc", "merchant"])
        .order("name", { ascending: true }),
      supabase
        .from("spells_catalog")
        .select(SPELL_SELECT)
        .order("level", { ascending: true })
        .order("name", { ascending: true })
        .limit(1000),
    ]);

    if (characterRes.error) setError(characterRes.error.message || "Failed to load characters.");
    if (spellRes.error) setError(spellRes.error.message || "Failed to load spells.");

    const nextCharacters = characterRes.data || [];
    const nextSpells = spellRes.data || [];
    setCharacters(nextCharacters);
    setSpells(nextSpells);
    setSelectedCharacterId((current) => current || nextCharacters[0]?.id || "");
    setSelectedSpellId((current) => current || nextSpells[0]?.id || "");
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    loadAssignments(selectedCharacterId);
  }, [loadAssignments, selectedCharacterId]);

  async function addAssignment() {
    if (!selectedCharacterId || !selectedSpellId) return;
    setBusy(true);
    setError("");
    setNotice("");

    const cleanUsesMax = usesMax === "" ? null : Number(usesMax);
    const cleanUsesRemaining = usesRemaining === "" ? null : Number(usesRemaining);
    const payload = {
      character_id: selectedCharacterId,
      spell_id: selectedSpellId,
      source_type: sourceType || "class",
      source_label: sourceLabel.trim() || null,
      prepared,
      always_available: alwaysAvailable,
      uses_max: Number.isFinite(cleanUsesMax) ? cleanUsesMax : null,
      uses_remaining: Number.isFinite(cleanUsesRemaining) ? cleanUsesRemaining : null,
      recharge: recharge.trim() || null,
      casting_stat: castingStat || null,
      notes: notes.trim() || null,
      raw_payload: {},
    };

    const { error: insertError } = await supabase.from("character_spells").insert(payload);
    if (insertError) {
      setError(insertError.message || "Failed to assign spell. It may already be assigned with the same source.");
    } else {
      setNotice("Spell assigned.");
      setSourceLabel("");
      setUsesMax("");
      setUsesRemaining("");
      setRecharge("");
      setNotes("");
      await loadAssignments(selectedCharacterId);
    }
    setBusy(false);
  }

  async function updateAssignment(rowId, patch) {
    if (!rowId) return;
    setBusy(true);
    setError("");
    setNotice("");
    const { error: updateError } = await supabase
      .from("character_spells")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", rowId);

    if (updateError) {
      setError(updateError.message || "Failed to update spell assignment.");
    } else {
      setAssignments((rows) => rows.map((row) => row.id === rowId ? { ...row, ...patch } : row));
      setNotice("Spell assignment updated.");
    }
    setBusy(false);
  }

  async function removeAssignment(rowId) {
    if (!rowId) return;
    const row = assignmentRows.find((entry) => entry.id === rowId);
    const label = row?.spell?.name || "this spell";
    if (typeof window !== "undefined" && !window.confirm(`Remove ${label} from ${selectedCharacter?.name || "this character"}?`)) return;

    setBusy(true);
    setError("");
    setNotice("");
    const { error: deleteError } = await supabase.from("character_spells").delete().eq("id", rowId);
    if (deleteError) {
      setError(deleteError.message || "Failed to remove spell assignment.");
    } else {
      setNotice("Spell removed.");
      await loadAssignments(selectedCharacterId);
    }
    setBusy(false);
  }

  return (
    <div className="spell-admin-page">
      <div className="row g-3">
        <div className="col-12 col-xl-3">
          <section className="npc-card h-100">
            <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
              <div>
                <div className="spell-admin-kicker">Characters</div>
                <h2 className="h5 mb-0">Spell access</h2>
              </div>
              <button type="button" className="btn btn-sm btn-outline-light" onClick={loadBaseData} disabled={loading || busy}>Refresh</button>
            </div>
            <input className="form-control form-control-sm mb-2" value={characterQuery} onChange={(event) => setCharacterQuery(event.target.value)} placeholder="Search NPCs, merchants..." />
            <div className="list-group spellbook-character-list">
              {filteredCharacters.map((character) => (
                <button
                  key={character.id}
                  type="button"
                  className={`list-group-item list-group-item-action bg-transparent text-light border-secondary ${selectedCharacterId === character.id ? "active" : ""}`}
                  onClick={() => setSelectedCharacterId(character.id)}
                >
                  <div className="fw-semibold">{character.name}</div>
                  <div className="small text-muted">{characterMeta(character) || "NPC"}</div>
                </button>
              ))}
              {!filteredCharacters.length ? <div className="text-muted small p-2">No matching characters.</div> : null}
            </div>
          </section>
        </div>

        <div className="col-12 col-xl-5">
          <section className="npc-card mb-3">
            <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-2">
              <div>
                <div className="spell-admin-kicker">Assigned spells</div>
                <h2 className="h5 mb-0">{selectedCharacter?.name || "Choose a character"}</h2>
                <div className="small text-muted">{selectedCharacter ? `${assignmentRows.length} spell assignment${assignmentRows.length === 1 ? "" : "s"}` : "Assign spells to NPCs and merchants without touching character sheets."}</div>
              </div>
            </div>

            {assignmentLoading ? <div className="text-muted">Loading assignments…</div> : null}
            {!assignmentLoading && selectedCharacter && !assignmentRows.length ? <div className="text-muted">No spells assigned yet.</div> : null}

            <div className="spellbook-assignment-list">
              {assignmentRows.map((row) => (
                <button key={row.id} type="button" className={`spellbook-assignment-row ${selectedAssignmentId === row.id ? "active" : ""}`} onClick={() => { setSelectedAssignmentId(row.id); setSelectedSpellId(row.spell_id); }}>
                  <span className="spellbook-assignment-main">
                    <strong>{row.spell.name}</strong>
                    <small>{levelLabel(row.spell.level)} • {row.spell.school || "School"} • {row.source_type || "class"}{row.source_label ? `: ${row.source_label}` : ""}</small>
                  </span>
                  <span className="spellbook-assignment-flags">
                    {row.prepared ? <span>Prepared</span> : null}
                    {row.always_available ? <span>Always</span> : null}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="npc-card">
            <div className="spell-admin-kicker">Add spell</div>
            <h2 className="h5">Assign from catalog</h2>
            <input className="form-control form-control-sm mb-2" value={spellQuery} onChange={(event) => setSpellQuery(event.target.value)} placeholder="Search spell name, school, damage, save..." />
            <select className="form-select form-select-sm mb-2" value={selectedSpellId} onChange={(event) => setSelectedSpellId(event.target.value)}>
              {filteredSpells.map((spell) => <option key={spell.id} value={spell.id}>{levelLabel(spell.level)} • {spell.name} • {spell.school || "School"} • {spell.source}</option>)}
            </select>
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small fw-semibold">Source</label>
                <select className="form-select form-select-sm" value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
                  {SOURCE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Source label</label>
                <input className="form-control form-control-sm" value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} placeholder="Wizard, innate, wand..." />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Casting stat</label>
                <select className="form-select form-select-sm" value={castingStat} onChange={(event) => setCastingStat(event.target.value)}>
                  {CASTING_STATS.map((value) => <option key={value || "blank"} value={value}>{value || "Default / unset"}</option>)}
                </select>
              </div>
              <div className="col-3">
                <label className="form-label small fw-semibold">Uses</label>
                <input className="form-control form-control-sm" type="number" min="0" value={usesMax} onChange={(event) => setUsesMax(event.target.value)} placeholder="Max" />
              </div>
              <div className="col-3">
                <label className="form-label small fw-semibold">Left</label>
                <input className="form-control form-control-sm" type="number" min="0" value={usesRemaining} onChange={(event) => setUsesRemaining(event.target.value)} placeholder="Now" />
              </div>
              <div className="col-12">
                <label className="form-label small fw-semibold">Recharge</label>
                <input className="form-control form-control-sm" value={recharge} onChange={(event) => setRecharge(event.target.value)} placeholder="Long rest, dawn, 1/day..." />
              </div>
              <div className="col-12 d-flex gap-3 flex-wrap">
                <label className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={prepared} onChange={(event) => setPrepared(event.target.checked)} /> <span className="form-check-label">Prepared</span></label>
                <label className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={alwaysAvailable} onChange={(event) => setAlwaysAvailable(event.target.checked)} /> <span className="form-check-label">Always available</span></label>
              </div>
              <div className="col-12">
                <label className="form-label small fw-semibold">Notes</label>
                <textarea className="form-control form-control-sm" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional table notes for this grant." />
              </div>
            </div>
            <button type="button" className="btn btn-warning btn-sm mt-3" disabled={!selectedCharacterId || !selectedSpellId || busy} onClick={addAssignment}>Assign spell</button>
          </section>
        </div>

        <div className="col-12 col-xl-4">
          <section className="npc-card mb-3">
            <div className="spell-admin-kicker">Preview</div>
            {selectedSpell ? <SpellCard spell={selectedSpell} compact /> : <div className="text-muted">Choose a spell to preview it.</div>}
          </section>

          <section className="npc-card">
            <div className="spell-admin-kicker">Selected assignment</div>
            {selectedAssignment ? (
              <div className="spellbook-assignment-editor">
                <h2 className="h5">{selectedAssignment.spell.name}</h2>
                <div className="small text-muted mb-2">{selectedAssignment.source_type || "class"}{selectedAssignment.source_label ? ` • ${selectedAssignment.source_label}` : ""}</div>
                <div className="d-flex gap-3 flex-wrap mb-2">
                  <label className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={!!selectedAssignment.prepared} disabled={busy} onChange={(event) => updateAssignment(selectedAssignment.id, { prepared: event.target.checked })} /> <span className="form-check-label">Prepared</span></label>
                  <label className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={!!selectedAssignment.always_available} disabled={busy} onChange={(event) => updateAssignment(selectedAssignment.id, { always_available: event.target.checked })} /> <span className="form-check-label">Always available</span></label>
                </div>
                <div className="small text-muted mb-2">
                  Casting stat: {selectedAssignment.casting_stat || "unset"}<br />
                  Uses: {selectedAssignment.uses_remaining ?? "—"}/{selectedAssignment.uses_max ?? "—"} {selectedAssignment.recharge ? `• Recharge: ${selectedAssignment.recharge}` : ""}
                </div>
                {selectedAssignment.notes ? <div className="npc-text mb-2" style={{ whiteSpace: "pre-wrap" }}>{selectedAssignment.notes}</div> : null}
                <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => removeAssignment(selectedAssignment.id)}>Remove assignment</button>
              </div>
            ) : (
              <div className="text-muted">Select an assigned spell to edit prepared/always flags or remove it.</div>
            )}
          </section>
        </div>
      </div>

      {error ? <div className="alert alert-danger mt-3">{error}</div> : null}
      {notice ? <div className="alert alert-success mt-3">{notice}</div> : null}
      {loading ? <div className="text-muted mt-3">Loading spellbook tools…</div> : null}

      <style jsx>{`
        .spellbook-character-list,
        .spellbook-assignment-list {
          max-height: 58vh;
          overflow: auto;
        }
        .spellbook-assignment-list {
          display: grid;
          gap: 0.45rem;
        }
        .spellbook-assignment-row {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          text-align: left;
          padding: 0.65rem 0.75rem;
          border-radius: 0.8rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: inherit;
        }
        .spellbook-assignment-row.active,
        .spellbook-assignment-row:hover {
          border-color: rgba(245, 190, 75, 0.65);
          background: rgba(245, 190, 75, 0.12);
        }
        .spellbook-assignment-main {
          display: grid;
          min-width: 0;
        }
        .spellbook-assignment-main small {
          color: rgba(255,255,255,0.62);
        }
        .spellbook-assignment-flags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
          justify-content: flex-end;
        }
        .spellbook-assignment-flags span {
          padding: 0.1rem 0.42rem;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.14);
          color: #f9e6b2;
          font-size: 0.72rem;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}

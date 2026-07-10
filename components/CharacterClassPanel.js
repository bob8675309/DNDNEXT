import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const ABILITY_LABELS = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

const SOURCE_PRIORITY = { XPHB: 0, TCE: 1, PHB: 2, EFA: 3 };

function safeText(value) {
  return String(value ?? "").trim();
}

function ordinal(value) {
  const number = Number(value || 0);
  if (number % 100 >= 11 && number % 100 <= 13) return `${number}th`;
  if (number % 10 === 1) return `${number}st`;
  if (number % 10 === 2) return `${number}nd`;
  if (number % 10 === 3) return `${number}rd`;
  return `${number}th`;
}

function sourceLabel(row) {
  if (!row) return "";
  if (row.source === "XPHB") return "2024 Player's Handbook";
  if (row.source === "PHB") return "2014 Player's Handbook";
  if (row.source === "TCE") return "Legacy supplemental class";
  return row.source || row.ruleset || "Campaign";
}

function featureLabel(feature) {
  if (typeof feature === "string") return feature.split("|")[0] || feature;
  return feature?.name || feature?.label || feature?.title || "Class feature";
}

function preferredClassRows(rows = []) {
  const preferred = new Map();
  for (const row of rows) {
    const key = safeText(row?.class_key);
    if (!key) continue;
    const current = preferred.get(key);
    const rowPriority = Number(SOURCE_PRIORITY[row.source] ?? 9);
    const currentPriority = Number(SOURCE_PRIORITY[current?.source] ?? 9);
    if (!current || rowPriority < currentPriority) preferred.set(key, row);
  }
  return [...preferred.values()].sort((a, b) => safeText(a.class_name).localeCompare(safeText(b.class_name)));
}

function renderSlots(spellSlots) {
  if (!spellSlots) return <div className="text-muted">No spell slots.</div>;
  if (!Array.isArray(spellSlots)) {
    const slots = Number(spellSlots.pactSlots || 0);
    const slotLevel = Number(spellSlots.pactSlotLevel || 0);
    return slots > 0 ? (
      <div className="class-slot-grid">
        <div><span>Pact slots</span><strong>{slots}</strong></div>
        <div><span>Slot level</span><strong>{ordinal(slotLevel)}</strong></div>
      </div>
    ) : <div className="text-muted">No spell slots.</div>;
  }

  const populated = spellSlots
    .map((count, index) => ({ level: index + 1, count: Number(count || 0) }))
    .filter((entry) => entry.count > 0);
  if (!populated.length) return <div className="text-muted">No spell slots.</div>;

  return (
    <div className="class-slot-grid">
      {populated.map((entry) => (
        <div key={entry.level}><span>{ordinal(entry.level)}</span><strong>{entry.count}</strong></div>
      ))}
    </div>
  );
}

export default function CharacterClassPanel({ character = null, isAdmin = false }) {
  const characterId = character?.id || null;
  const [payload, setPayload] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [canManage, setCanManage] = useState(Boolean(isAdmin));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [classSelection, setClassSelection] = useState("");
  const [level, setLevel] = useState(1);
  const [experiencePoints, setExperiencePoints] = useState(0);
  const [subclassName, setSubclassName] = useState("");
  const [xpAmount, setXpAmount] = useState("");
  const [xpReason, setXpReason] = useState("");
  const [xpSaving, setXpSaving] = useState(false);
  const [levelUpReview, setLevelUpReview] = useState(null);
  const [levelUpBusy, setLevelUpBusy] = useState(false);

  const progression = payload?.progression || null;
  const classRow = payload?.class || null;
  const currentLevel = payload?.currentLevel || null;
  const nextLevel = payload?.nextLevel || null;
  const xp = payload?.xp || null;
  const events = Array.isArray(payload?.events) ? payload.events : [];

  const classOptions = useMemo(() => preferredClassRows(catalog), [catalog]);

  const selectedCatalogRow = useMemo(() => {
    const [classKey, source] = classSelection.split("|");
    return catalog.find((row) => row.class_key === classKey && row.source === source) || null;
  }, [catalog, classSelection]);

  const canonicalAlternative = useMemo(() => {
    if (!classRow || classRow.source === "XPHB") return null;
    return catalog.find((row) => row.class_key === classRow.class_key && row.source === "XPHB") || null;
  }, [catalog, classRow]);

  const loadProgression = useCallback(async ({ preserveNotice = false } = {}) => {
    if (!characterId) {
      setPayload(null);
      setCatalog([]);
      setCanManage(Boolean(isAdmin));
      setLevelUpReview(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    if (!preserveNotice) setNotice("");

    const [progressionResult, catalogResult, accessResult] = await Promise.all([
      supabase.rpc("get_character_progression_v1", { p_character_id: characterId }),
      supabase
        .from("class_catalog")
        .select("id,class_key,class_name,source,ruleset,edition,hit_die,primary_abilities,saving_throws,spellcasting_ability,caster_progression,summary")
        .order("class_name", { ascending: true })
        .order("source", { ascending: true }),
      supabase.rpc("can_manage_character_progression_v1", { p_character_id: characterId }),
    ]);

    if (progressionResult.error) setError(progressionResult.error.message || "Failed to load class progression.");
    if (catalogResult.error) setError(catalogResult.error.message || "Failed to load the class catalog.");

    const nextPayload = progressionResult.data || null;
    const nextCatalog = catalogResult.data || [];
    const nextCanManage = Boolean(isAdmin || (!accessResult.error && accessResult.data));
    setPayload(nextPayload);
    setCatalog(nextCatalog);
    setCanManage(nextCanManage);

    const nextProgression = nextPayload?.progression;
    const nextClass = nextPayload?.class;
    if (nextProgression && nextClass) {
      const canonical = nextCatalog.find((row) => row.class_key === nextClass.class_key && row.source === "XPHB");
      const editableClass = canonical || nextClass;
      setClassSelection(`${editableClass.class_key}|${editableClass.source}`);
      setLevel(Number(nextProgression.class_level || 1));
      setExperiencePoints(Number(nextProgression.experience_points || 0));
      setSubclassName(nextProgression.subclass_name || "");
    } else if (nextCatalog.length) {
      const preferred = preferredClassRows(nextCatalog)[0] || nextCatalog[0];
      setClassSelection(`${preferred.class_key}|${preferred.source}`);
      setLevel(1);
      setExperiencePoints(0);
      setSubclassName("");
    }

    if (nextCanManage) {
      const reviewResult = await supabase.rpc("get_character_level_up_review_v1", { p_character_id: characterId });
      if (!reviewResult.error) setLevelUpReview(reviewResult.data || null);
    } else {
      setLevelUpReview(null);
    }
    setLoading(false);
  }, [characterId, isAdmin]);

  useEffect(() => {
    loadProgression();
  }, [loadProgression]);

  async function saveProgression() {
    if (!isAdmin || !characterId || !selectedCatalogRow) return;
    setSaving(true);
    setError("");
    setNotice("");
    const { data, error: saveError } = await supabase.rpc("set_character_progression_v1", {
      p_character_id: characterId,
      p_class_key: selectedCatalogRow.class_key,
      p_source: selectedCatalogRow.source,
      p_level: Math.max(1, Math.min(20, Number(level || 1))),
      p_experience_points: Math.max(0, Number(experiencePoints || 0)),
      p_subclass_name: subclassName.trim() || null,
      p_subclass_source: subclassName.trim() ? selectedCatalogRow.source : null,
    });

    if (saveError) {
      setError(saveError.message || "Failed to save class progression.");
    } else {
      setPayload(data || null);
      setEditing(false);
      setLevelUpReview(null);
      setNotice("Class progression saved.");
    }
    setSaving(false);
  }

  async function applyXpChange() {
    if (!canManage || !characterId || !progression) return;
    const amount = Number(xpAmount);
    if (!Number.isInteger(amount) || amount === 0) {
      setError("Enter a whole-number XP change other than zero.");
      return;
    }
    if (!isAdmin && amount < 0) {
      setError("Only an admin can remove XP.");
      return;
    }

    setXpSaving(true);
    setError("");
    setNotice("");
    const { data, error: xpError } = await supabase.rpc("add_character_xp_v1", {
      p_character_id: characterId,
      p_amount: amount,
      p_reason: xpReason.trim() || null,
    });

    if (xpError) {
      setError(xpError.message || "Failed to update XP.");
    } else {
      setPayload(data || null);
      setXpAmount("");
      setXpReason("");
      setNotice(`${amount > 0 ? "Added" : "Removed"} ${Math.abs(amount).toLocaleString()} XP.`);
      if (!data?.progression?.pending_level_up) setLevelUpReview(null);
    }
    setXpSaving(false);
  }

  async function beginLevelUpReview() {
    if (!canManage || !characterId || !progression?.pending_level_up) return;
    setLevelUpBusy(true);
    setError("");
    setNotice("");
    const { data, error: reviewError } = await supabase.rpc("begin_character_level_up_v1", { p_character_id: characterId });
    if (reviewError) {
      setError(reviewError.message || "Failed to open the level-up review.");
    } else {
      setLevelUpReview(data || null);
      setNotice("Level-up review opened. No character values have been changed yet.");
    }
    setLevelUpBusy(false);
  }

  async function cancelLevelUpReview() {
    if (!canManage || !characterId) return;
    setLevelUpBusy(true);
    setError("");
    const { error: cancelError } = await supabase.rpc("cancel_character_level_up_v1", { p_character_id: characterId });
    if (cancelError) {
      setError(cancelError.message || "Failed to cancel the level-up review.");
    } else {
      setLevelUpReview(null);
      setNotice("Level-up review cancelled. XP and level were not changed.");
    }
    setLevelUpBusy(false);
  }

  if (loading) return <div className="npc-card"><div className="text-muted">Loading class progression…</div></div>;

  const features = Array.isArray(currentLevel?.features) ? currentLevel.features : [];
  const nextFeatures = Array.isArray(nextLevel?.features) ? nextLevel.features : [];
  const cantripsKnown = currentLevel?.cantrips_known;
  const spellsKnown = currentLevel?.spells_known;
  const reviewPreview = levelUpReview?.preview || null;
  const reviewFeatures = Array.isArray(reviewPreview?.features) ? reviewPreview.features : [];
  const reviewChoices = Array.isArray(reviewPreview?.choices) ? reviewPreview.choices : [];

  return (
    <div className="character-class-panel">
      <div className="npc-card class-summary-card mb-3">
        <div>
          <div className="spell-admin-kicker">Class Progression</div>
          <h2 className="h5 mb-1">{character?.name || "Character"}</h2>
          <div className="small text-muted">
            {progression && classRow
              ? `${classRow.class_name} level ${progression.class_level} • ${sourceLabel(classRow)}${progression.subclass_name ? ` • ${progression.subclass_name}` : ""}`
              : "No canonical class progression has been initialized for this character."}
          </div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button type="button" className="btn btn-sm btn-outline-light" onClick={() => loadProgression()}>Refresh</button>
          {isAdmin ? <button type="button" className="btn btn-sm btn-warning" onClick={() => setEditing((value) => !value)}>{editing ? "Cancel" : progression ? "Edit Progression" : "Set Class"}</button> : null}
        </div>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {notice ? <div className="alert alert-success py-2">{notice}</div> : null}
      {canonicalAlternative ? <div className="alert alert-warning py-2">This character uses legacy {sourceLabel(classRow)} progression. Editing the class will default to the 2024 {canonicalAlternative.class_name} progression.</div> : null}

      {isAdmin && editing ? (
        <section className="npc-card mb-3">
          <div className="npc-card-title">Admin Progression Setup</div>
          <div className="small text-muted mb-3">2024 rules are canonical. A legacy class appears only when no 2024 version exists.</div>
          <div className="row g-2">
            <div className="col-12 col-lg-6">
              <label className="form-label small fw-semibold">Class</label>
              <select className="form-select form-select-sm" value={classSelection} onChange={(event) => setClassSelection(event.target.value)}>
                {classOptions.map((row) => <option key={row.id} value={`${row.class_key}|${row.source}`}>{row.class_name} • {sourceLabel(row)}</option>)}
              </select>
            </div>
            <div className="col-6 col-lg-2">
              <label className="form-label small fw-semibold">Level</label>
              <input className="form-control form-control-sm" type="number" min="1" max="20" value={level} onChange={(event) => setLevel(event.target.value)} />
            </div>
            <div className="col-6 col-lg-4">
              <label className="form-label small fw-semibold">Experience points</label>
              <input className="form-control form-control-sm" type="number" min="0" step="1" value={experiencePoints} onChange={(event) => setExperiencePoints(event.target.value)} />
            </div>
            <div className="col-12">
              <label className="form-label small fw-semibold">Subclass</label>
              <input className="form-control form-control-sm" value={subclassName} onChange={(event) => setSubclassName(event.target.value)} placeholder="Optional until subclass progression is integrated" />
            </div>
          </div>
          <button type="button" className="btn btn-warning btn-sm mt-3" disabled={saving || !selectedCatalogRow} onClick={saveProgression}>{saving ? "Saving…" : "Save progression"}</button>
        </section>
      ) : null}

      {!progression || !classRow ? (
        <div className="npc-card">
          <div className="text-muted">{isAdmin ? "Use Set Class to initialize this character." : "An admin has not initialized class progression yet."}</div>
        </div>
      ) : (
        <div className="row g-3">
          <div className="col-12 col-xl-7">
            <section className="npc-card mb-3">
              <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                <div>
                  <div className="npc-card-title mb-1">{classRow.class_name}</div>
                  <div className="small text-muted">{classRow.summary || `${sourceLabel(classRow)} class progression.`}</div>
                </div>
                <span className={`badge ${classRow.source === "XPHB" ? "text-bg-success" : "text-bg-secondary"}`}>{classRow.ruleset} rules</span>
              </div>
              <div className="class-stat-grid mt-3">
                <div><span>Level</span><strong>{progression.class_level}</strong></div>
                <div><span>Proficiency</span><strong>+{currentLevel?.proficiency_bonus || 2}</strong></div>
                <div><span>Hit Die</span><strong>d{classRow.hit_die || 8}</strong></div>
                <div><span>Primary</span><strong>{(classRow.primary_abilities || []).map((key) => ABILITY_LABELS[key] || key).join(" / ") || "—"}</strong></div>
                <div><span>Saving Throws</span><strong>{(classRow.saving_throws || []).map((key) => ABILITY_LABELS[key] || key).join(" / ") || "—"}</strong></div>
                <div><span>Spellcasting</span><strong>{ABILITY_LABELS[classRow.spellcasting_ability] || "None"}</strong></div>
              </div>
            </section>

            <section className="npc-card mb-3">
              <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2">
                <div>
                  <div className="npc-card-title mb-0">Experience</div>
                  <div className="small text-muted">{Number(xp?.current || 0).toLocaleString()} XP</div>
                </div>
                {progression.pending_level_up ? <span className="badge text-bg-warning">Level up ready</span> : null}
              </div>
              <div className="progress class-xp-progress" role="progressbar" aria-label="XP progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Number(xp?.percent || 0)}>
                <div className="progress-bar" style={{ width: `${Number(xp?.percent || 0)}%` }}>{Number(xp?.percent || 0)}%</div>
              </div>
              <div className="d-flex justify-content-between gap-2 small text-muted mt-2">
                <span>Level floor: {Number(xp?.levelFloor || 0).toLocaleString()}</span>
                <span>{xp?.nextThreshold == null ? "Maximum level" : `Next: ${Number(xp.nextThreshold).toLocaleString()} XP`}</span>
              </div>

              {canManage ? (
                <div className="class-xp-controls mt-3">
                  <div>
                    <label className="form-label small fw-semibold">XP change</label>
                    <input className="form-control form-control-sm" type="number" step="1" min={isAdmin ? undefined : 1} value={xpAmount} onChange={(event) => setXpAmount(event.target.value)} placeholder={isAdmin ? "Positive or negative" : "XP earned"} />
                  </div>
                  <div>
                    <label className="form-label small fw-semibold">Reason</label>
                    <input className="form-control form-control-sm" value={xpReason} onChange={(event) => setXpReason(event.target.value)} placeholder="Session, quest, milestone..." />
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-warning" disabled={xpSaving || !xpAmount} onClick={applyXpChange}>{xpSaving ? "Saving…" : "Apply XP"}</button>
                </div>
              ) : null}

              {canManage && progression.pending_level_up ? (
                <div className="mt-3 d-flex gap-2 flex-wrap">
                  <button type="button" className="btn btn-sm btn-warning" disabled={levelUpBusy} onClick={beginLevelUpReview}>{levelUpBusy ? "Opening…" : levelUpReview ? "Refresh Level-Up Review" : "Review Level Up"}</button>
                  {levelUpReview ? <button type="button" className="btn btn-sm btn-outline-light" disabled={levelUpBusy} onClick={cancelLevelUpReview}>Cancel review</button> : null}
                </div>
              ) : null}
            </section>

            {levelUpReview ? (
              <section className="npc-card mb-3 class-level-up-review">
                <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-2">
                  <div>
                    <div className="npc-card-title mb-0">Level-Up Review</div>
                    <div className="small text-muted">Level {reviewPreview?.fromLevel} → {reviewPreview?.toLevel} • No changes are applied during review.</div>
                  </div>
                  <span className={`badge ${levelUpReview.metadataReady ? "text-bg-success" : "text-bg-warning"}`}>{levelUpReview.metadataReady ? "2024 metadata ready" : "2024 metadata required"}</span>
                </div>
                <div className="class-known-grid mb-3">
                  <div><span>Proficiency</span><strong>+{reviewPreview?.proficiencyBonus || "—"}</strong></div>
                  <div><span>Required XP</span><strong>{Number(reviewPreview?.requiredXp || 0).toLocaleString()}</strong></div>
                </div>
                <div className="small fw-semibold mb-1">Features at this level</div>
                {reviewFeatures.length ? <div className="class-feature-list mb-3">{reviewFeatures.map((feature, index) => <div key={`${featureLabel(feature)}-review-${index}`}>{featureLabel(feature)}</div>)}</div> : <div className="text-muted mb-3">Detailed 2024 features have not been imported for this level yet.</div>}
                <div className="small fw-semibold mb-1">Required choices</div>
                <div className="class-feature-list mb-3">{reviewChoices.map((choice, index) => <div key={`${choice?.key || "choice"}-${index}`}>{choice?.label || choice?.key || "Level choice"}</div>)}</div>
                <button type="button" className="btn btn-sm btn-secondary" disabled title="The transactional choice engine must validate every 2024 class choice before the level can be applied.">Apply Level (not yet enabled)</button>
                <div className="small text-muted mt-2">{levelUpReview.message || "Final application remains locked until the 2024 choice engine is complete."}</div>
              </section>
            ) : null}

            <section className="npc-card">
              <div className="npc-card-title">Current Level Features</div>
              {features.length ? <div className="class-feature-list">{features.map((feature, index) => <div key={`${featureLabel(feature)}-${index}`}>{featureLabel(feature)}</div>)}</div> : <div className="text-muted">Detailed feature text will populate after the reviewed 2024 class metadata is imported.</div>}
            </section>
          </div>

          <div className="col-12 col-xl-5">
            <section className="npc-card mb-3">
              <div className="npc-card-title">Spellcasting Progression</div>
              {classRow.spellcasting_ability ? (
                <>
                  <div className="small text-muted mb-2">{classRow.caster_progression || "Class"} progression • {ABILITY_LABELS[classRow.spellcasting_ability] || classRow.spellcasting_ability}</div>
                  {cantripsKnown != null || spellsKnown != null ? <div className="class-known-grid mb-2">
                    {cantripsKnown != null ? <div><span>Cantrips</span><strong>{cantripsKnown}</strong></div> : null}
                    {spellsKnown != null ? <div><span>Known / prepared</span><strong>{spellsKnown}</strong></div> : null}
                  </div> : null}
                  {renderSlots(currentLevel?.spell_slots)}
                </>
              ) : <div className="text-muted">This base class does not have spellcasting progression.</div>}
            </section>

            <section className="npc-card mb-3">
              <div className="npc-card-title">Next Level</div>
              {nextLevel ? (
                <>
                  <div className="fw-semibold">Level {nextLevel.class_level}</div>
                  <div className="small text-muted mb-2">Requires {Number(nextLevel.xp_threshold || 0).toLocaleString()} total XP.</div>
                  {nextFeatures.length ? <div className="class-feature-list">{nextFeatures.map((feature, index) => <div key={`${featureLabel(feature)}-${index}`}>{featureLabel(feature)}</div>)}</div> : <div className="text-muted">Detailed 2024 feature and choice metadata has not been imported for this level yet.</div>}
                </>
              ) : <div className="text-muted">Maximum class level reached.</div>}
            </section>

            <section className="npc-card">
              <div className="npc-card-title">Progression History</div>
              {events.length ? <div className="class-event-list">{events.slice(0, 8).map((event) => (
                <div key={event.id}>
                  <strong>{safeText(event.event_type).replaceAll("_", " ")}</strong>
                  <small>{new Date(event.created_at).toLocaleString()} • {Number(event.xp_after ?? event.xp_before ?? 0).toLocaleString()} XP</small>
                </div>
              ))}</div> : <div className="text-muted">No progression events yet.</div>}
            </section>
          </div>
        </div>
      )}

      <style jsx>{`
        .class-summary-card { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
        .class-stat-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.55rem; }
        .class-stat-grid > div, .class-slot-grid > div, .class-known-grid > div { padding:.65rem; border-radius:.7rem; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09); display:grid; gap:.15rem; }
        .class-stat-grid span, .class-slot-grid span, .class-known-grid span { color:rgba(255,255,255,.58); font-size:.72rem; text-transform:uppercase; letter-spacing:.04em; }
        .class-slot-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.45rem; }
        .class-known-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.45rem; }
        .class-feature-list, .class-event-list { display:grid; gap:.45rem; }
        .class-feature-list > div, .class-event-list > div { padding:.55rem .65rem; border-radius:.65rem; background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.08); }
        .class-event-list > div { display:grid; }
        .class-event-list small { color:rgba(255,255,255,.58); }
        .class-xp-progress { height:1.15rem; background:rgba(255,255,255,.07); }
        .class-xp-controls { display:grid; grid-template-columns:minmax(130px,.55fr) minmax(220px,1fr) auto; gap:.55rem; align-items:end; }
        .class-level-up-review { border-color:rgba(245,190,75,.45); }
        @media (max-width: 800px) {
          .class-stat-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .class-xp-controls { grid-template-columns:1fr; }
        }
      `}</style>
    </div>
  );
}

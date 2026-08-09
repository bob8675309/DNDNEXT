import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const safeText = (value) => String(value ?? "").trim();
const compact = (value) => safeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");

function speciesIdentity(sheet = {}) {
  return {
    name: compact(sheet.species || sheet.race || sheet.meta?.species),
    source: safeText(sheet.meta?.speciesSource || sheet.speciesSource).toUpperCase(),
  };
}

export default function CharacterSpeciesRestProficiencyPanel({ characterId, sheet = {}, onSheetUpdated = null }) {
  const identity = speciesIdentity(sheet);
  const mode = identity.name === "githyanki" && identity.source === "MPMM"
    ? "githyanki"
    : identity.name === "khoravar" && identity.source === "EFA"
      ? "khoravar"
      : "";
  const [profile, setProfile] = useState(null);
  const [skillKey, setSkillKey] = useState("");
  const [trainingId, setTrainingId] = useState("");
  const [proficiencyKey, setProficiencyKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const rpcName = mode === "githyanki"
    ? "get_character_githyanki_astral_knowledge_v1"
    : "get_character_khoravar_skill_versatility_v1";

  async function loadProfile() {
    if (!characterId || !mode) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc(rpcName, { p_character_id: characterId });
    if (rpcError) {
      if (!["42501", "PGRST202"].includes(String(rpcError.code || ""))) {
        setError(rpcError.message || "Could not load Species runtime proficiency state.");
      }
      setProfile(null);
    } else setProfile(data && typeof data === "object" ? data : null);
    setLoading(false);
  }

  useEffect(() => {
    setSkillKey("");
    setTrainingId("");
    setProficiencyKey("");
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, mode, sheet?.runtimeProficiencies?.githyankiAstralKnowledge?.configuredRestAt, sheet?.runtimeProficiencies?.khoravarSkillVersatility?.configuredAt]);

  const skills = useMemo(() => Array.isArray(profile?.skillOptions) ? profile.skillOptions : [], [profile?.skillOptions]);
  const training = useMemo(() => Array.isArray(profile?.trainingOptions) ? profile.trainingOptions : [], [profile?.trainingOptions]);
  const options = useMemo(() => Array.isArray(profile?.options) ? profile.options : [], [profile?.options]);

  async function refreshSheet() {
    const { data: sheetRow, error: sheetError } = await supabase
      .from("character_sheets")
      .select("sheet")
      .eq("character_id", characterId)
      .maybeSingle();
    if (!sheetError && sheetRow?.sheet) onSheetUpdated?.(sheetRow.sheet);
  }

  async function saveGithyanki() {
    if (!characterId || !skillKey || !trainingId || busy) return;
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_githyanki_astral_knowledge_v1", {
      p_character_id: characterId,
      p_skill_key: skillKey,
      p_training_item_id: trainingId,
    });
    if (rpcError) setError(rpcError.message || "Could not configure Astral Knowledge.");
    else {
      setProfile(data && typeof data === "object" ? data : null);
      setSkillKey("");
      setTrainingId("");
      await refreshSheet();
    }
    setBusy(false);
  }

  async function saveKhoravar() {
    if (!characterId || !proficiencyKey || busy) return;
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_khoravar_skill_versatility_v1", {
      p_character_id: characterId,
      p_option_key: proficiencyKey,
    });
    if (rpcError) setError(rpcError.message || "Could not configure Skill Versatility.");
    else {
      setProfile(data && typeof data === "object" ? data : null);
      setProficiencyKey("");
      await refreshSheet();
    }
    setBusy(false);
  }

  if (!mode || (!loading && !profile && !error)) return null;

  if (mode === "githyanki") {
    const configured = Boolean(profile?.configured);
    const state = profile?.state || null;
    return <section className="character-runtime-choice character-runtime-choice--species-proficiency" aria-label="Githyanki Astral Knowledge configuration">
      <div className="character-runtime-choice__head">
        <div><span>Long-Rest choice</span><strong>Astral Knowledge</strong></div>
        <button type="button" className="character-runtime-choice__refresh" onClick={loadProfile} disabled={loading || busy}>Refresh</button>
      </div>
      {error ? <div className="character-runtime-choice__error">{error}</div> : null}
      {loading ? <p>Loading Astral Knowledge…</p> : configured ? <>
        <div className="character-runtime-choice__current">
          <div><span>Skill</span><strong>{state?.skill?.name || state?.skill?.key || "—"}</strong></div>
          <div><span>{state?.training?.kind === "weapon" ? "Weapon" : "Tool"}</span><strong>{state?.training?.name || "—"}</strong></div>
        </div>
        <p>These temporary proficiencies last until your next Long Rest, when they expire and can be chosen again.</p>
      </> : profile?.canConfigure ? <>
        <div className="character-runtime-choice__selectors">
          <label><span>Skill proficiency</span><select value={skillKey} onChange={(event) => setSkillKey(event.target.value)}><option value="">Choose a skill…</option>{skills.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}</select></label>
          <label><span>PHB weapon or tool proficiency</span><select value={trainingId} onChange={(event) => setTrainingId(event.target.value)}><option value="">Choose a weapon or tool…</option>{training.map((option) => <option key={option.itemId} value={option.itemId}>{option.name} • {option.kind}</option>)}</select></label>
        </div>
        <button type="button" className="character-runtime-choice__save" onClick={saveGithyanki} disabled={busy || !skillKey || !trainingId}>{busy ? "Applying…" : "Choose for this Long Rest"}</button>
      </> : <p>Finish a Long Rest to choose one skill and one Player’s Handbook weapon or tool proficiency.</p>}
    </section>;
  }

  const configured = Boolean(profile?.configured);
  const state = profile?.state || null;
  const canChoose = Boolean(profile?.canConfigure || profile?.canReplace);
  return <section className="character-runtime-choice character-runtime-choice--species-proficiency" aria-label="Khoravar Skill Versatility configuration">
    <div className="character-runtime-choice__head">
      <div><span>Long-Rest replacement</span><strong>Skill Versatility</strong></div>
      <button type="button" className="character-runtime-choice__refresh" onClick={loadProfile} disabled={loading || busy}>Refresh</button>
    </div>
    {error ? <div className="character-runtime-choice__error">{error}</div> : null}
    {loading ? <p>Loading Skill Versatility…</p> : <>
      {configured ? <div className="character-runtime-choice__current"><div><span>Current proficiency</span><strong>{state?.proficiency?.name || state?.proficiency?.label || "—"} • {state?.proficiency?.kind || "—"}</strong></div></div> : null}
      {canChoose ? <>
        <div className="character-runtime-choice__selectors character-runtime-choice__selectors--one">
          <label><span>{configured ? "New skill or tool" : "Skill or tool proficiency"}</span><select value={proficiencyKey} onChange={(event) => setProficiencyKey(event.target.value)}><option value="">Choose a skill or tool…</option>{options.map((option) => <option key={option.key} value={option.key}>{option.name || option.label} • {option.kind}</option>)}</select></label>
        </div>
        <button type="button" className="character-runtime-choice__save" onClick={saveKhoravar} disabled={busy || !proficiencyKey}>{busy ? "Applying…" : configured ? "Replace Proficiency" : "Choose Proficiency"}</button>
      </> : configured ? <p>Your current proficiency persists. Finish a newer Long Rest before replacing it.</p> : null}
      <p>This runtime choice adds proficiency without rewriting permanent Species, class, Background, or feat training.</p>
    </>}
  </section>;
}

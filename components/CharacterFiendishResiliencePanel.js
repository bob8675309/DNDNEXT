import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import CharacterCircleLandPanel from "./CharacterCircleLandPanel";

function safeText(value) {
  return String(value ?? "").trim();
}

export default function CharacterFiendishResiliencePanel({ characterId, sheet = {}, onSheetUpdated = null }) {
  const classKey = safeText(sheet.classKey || sheet.className || sheet.class || sheet.meta?.classKey).toLowerCase();
  const level = Number(sheet.level || sheet.meta?.level || 1);
  const potentiallyAvailable = classKey === "warlock" && level >= 10;
  const [profile, setProfile] = useState(null);
  const [choice, setChoice] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadProfile() {
    if (!characterId || !potentiallyAvailable) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("get_character_fiendish_resilience_v1", { p_character_id: characterId });
    if (rpcError) {
      if (String(rpcError.code || "") !== "42501" && String(rpcError.code || "") !== "PGRST202") {
        setError(rpcError.message || "Could not load Fiendish Resilience state.");
      }
      setProfile(null);
    } else setProfile(data && typeof data === "object" ? data : null);
    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, potentiallyAvailable, sheet?.meta?.subclassName, sheet?.meta?.subclassSource, sheet?.runtimeFeatures?.fiendishResilience?.configuredAt]);

  const options = useMemo(() => Array.isArray(profile?.options) ? profile.options : [], [profile?.options]);
  const configured = Boolean(profile?.configured);
  const canChoose = Boolean(profile?.canConfigure || profile?.canReplace);
  const state = profile?.state || null;

  useEffect(() => {
    if (!canChoose) return;
    setChoice(profile?.canReplace ? safeText(state?.resistance) : "");
  }, [canChoose, profile?.canReplace, state?.resistance]);

  async function save() {
    if (!characterId || !choice || busy) return;
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_fiendish_resilience_v1", {
      p_character_id: characterId,
      p_damage_type: choice,
    });
    if (rpcError) {
      setError(rpcError.message || "Could not configure Fiendish Resilience.");
      setBusy(false);
      return;
    }
    setProfile(data && typeof data === "object" ? data : null);
    const { data: sheetRow, error: sheetError } = await supabase.from("character_sheets").select("sheet").eq("character_id", characterId).maybeSingle();
    if (!sheetError && sheetRow?.sheet) onSheetUpdated?.(sheetRow.sheet);
    setBusy(false);
  }

  const visible = potentiallyAvailable && (loading || profile?.available !== false) && (loading || profile || error);
  const fiendishPanel = !visible ? null : <section className="character-runtime-choice character-runtime-choice--fiendish" aria-label="Fiendish Resilience configuration">
    <div className="character-runtime-choice__head">
      <div><span>Short / Long Rest choice</span><strong>Fiendish Resilience</strong></div>
      <button type="button" className="character-runtime-choice__refresh" onClick={loadProfile} disabled={loading || busy}>Refresh</button>
    </div>
    {error ? <div className="character-runtime-choice__error">{error}</div> : null}
    {loading ? <p>Loading Fiendish Resilience…</p> : <>
      {configured ? <div className="character-runtime-choice__current"><div><span>Current resistance</span><strong>{state?.resistanceName || safeText(state?.resistance).replace(/^./, (v) => v.toUpperCase()) || "—"}</strong></div></div> : null}
      {canChoose ? <>
        <div className="character-runtime-choice__selectors character-runtime-choice__selectors--one">
          <label><span>{configured ? "New resistance" : "Damage resistance"}</span><select value={choice} onChange={(event) => setChoice(event.target.value)}><option value="">Choose a damage type…</option>{options.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}</select></label>
        </div>
        <button type="button" className="character-runtime-choice__save" onClick={save} disabled={busy || !choice}>{busy ? "Applying…" : configured ? "Change Resistance" : "Choose Resistance"}</button>
      </> : configured ? <p>Your current resistance persists. Finish a newer Short or Long Rest before changing it.</p> : <p>Finish a Short or Long Rest after gaining Fiendish Resilience before choosing your first resistance.</p>}
      <p>Choose one damage type other than Force. The current resistance persists until you replace it after a later Short or Long Rest.</p>
    </>}
    <style jsx global>{`
      .character-runtime-choice--fiendish{border-color:rgba(242,135,54,.32);background:rgba(151,72,21,.08)}.character-runtime-choice--fiendish .character-runtime-choice__save,.character-runtime-choice--fiendish .character-runtime-choice__refresh{border-color:rgba(242,135,54,.46);background:rgba(151,72,21,.14);color:#ffe0c6}.character-runtime-choice--fiendish .character-runtime-choice__current{grid-template-columns:1fr}
    `}</style>
  </section>;

  return <>{fiendishPanel}<CharacterCircleLandPanel characterId={characterId} sheet={sheet} onSheetUpdated={onSheetUpdated} /></>;
}

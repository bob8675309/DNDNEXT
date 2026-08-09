import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

function safeText(value) {
  return String(value ?? "").trim();
}

export default function CharacterDreadAllegiancePanel({ characterId, sheet = {}, onSheetUpdated = null }) {
  const classKey = safeText(sheet.classKey || sheet.className || sheet.class || sheet.meta?.classKey).toLowerCase();
  const level = Number(sheet.level || sheet.meta?.level || 1);
  const potentiallyAvailable = classKey === "rogue" && level >= 3;
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
    const { data, error: rpcError } = await supabase.rpc("get_character_dread_allegiance_v1", { p_character_id: characterId });
    if (rpcError) {
      if (String(rpcError.code || "") !== "42501" && String(rpcError.code || "") !== "PGRST202") {
        setError(rpcError.message || "Could not load Dread Allegiance state.");
      }
      setProfile(null);
    } else setProfile(data && typeof data === "object" ? data : null);
    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, potentiallyAvailable, sheet?.meta?.subclassName, sheet?.meta?.subclassSource, sheet?.runtimeFeatures?.dreadAllegiance?.configuredAt]);

  const options = useMemo(() => Array.isArray(profile?.options) ? profile.options : [], [profile?.options]);
  const configured = Boolean(profile?.configured);
  const canChoose = Boolean(profile?.canConfigure || profile?.canReplace);
  const state = profile?.state || null;

  useEffect(() => {
    if (!canChoose) return;
    setChoice(profile?.canReplace ? safeText(state?.allegianceKey) : "");
  }, [canChoose, profile?.canReplace, state?.allegianceKey]);

  async function save() {
    if (!characterId || !choice || busy) return;
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_dread_allegiance_v1", {
      p_character_id: characterId,
      p_allegiance_key: choice,
    });
    if (rpcError) {
      setError(rpcError.message || "Could not configure Dread Allegiance.");
      setBusy(false);
      return;
    }
    setProfile(data && typeof data === "object" ? data : null);
    const { data: sheetRow, error: sheetError } = await supabase.from("character_sheets").select("sheet").eq("character_id", characterId).maybeSingle();
    if (!sheetError && sheetRow?.sheet) onSheetUpdated?.(sheetRow.sheet);
    setBusy(false);
  }

  if (!potentiallyAvailable || (!loading && profile?.available === false) || (!loading && !profile && !error)) return null;

  return <section className="character-runtime-choice character-runtime-choice--dread" aria-label="Dread Allegiance configuration">
    <div className="character-runtime-choice__head">
      <div><span>Long-Rest replacement</span><strong>Dread Allegiance</strong></div>
      <button type="button" className="character-runtime-choice__refresh" onClick={loadProfile} disabled={loading || busy}>Refresh</button>
    </div>
    {error ? <div className="character-runtime-choice__error">{error}</div> : null}
    {loading ? <p>Loading Dread Allegiance…</p> : <>
      {configured ? <div className="character-runtime-choice__current">
        <div><span>Allegiance</span><strong>{state?.allegianceName || "—"}</strong></div>
        <div><span>Resistance</span><strong>{safeText(state?.resistance).replace(/^./, (v) => v.toUpperCase()) || "—"}</strong></div>
        <div><span>Cantrip</span><strong>{state?.cantripName || "—"} • Intelligence</strong></div>
      </div> : null}
      {canChoose ? <>
        <div className="character-runtime-choice__selectors character-runtime-choice__selectors--one">
          <label><span>{configured ? "New allegiance" : "Allegiance"}</span><select value={choice} onChange={(event) => setChoice(event.target.value)}><option value="">Choose Bane, Bhaal, or Myrkul…</option>{options.map((option) => <option key={option.key} value={option.key}>{option.name} • {option.resistance} resistance • {option.cantripName}</option>)}</select></label>
        </div>
        <button type="button" className="character-runtime-choice__save" onClick={save} disabled={busy || !choice}>{busy ? "Applying…" : configured ? "Change Allegiance" : "Choose Allegiance"}</button>
      </> : configured ? <p>Your current allegiance persists. Finish a newer Long Rest before changing all three linked effects together.</p> : null}
      <p>Dread Allegiance changes as one package: allegiance, damage resistance, and Intelligence-based cantrip. The current choice remains active until you replace it after a newer Long Rest.</p>
    </>}
    <style jsx global>{`
      .character-runtime-choice--dread{border-color:rgba(225,87,130,.3);background:rgba(155,47,83,.07)}.character-runtime-choice--dread .character-runtime-choice__save,.character-runtime-choice--dread .character-runtime-choice__refresh{border-color:rgba(225,87,130,.42);background:rgba(155,47,83,.13);color:#ffd5e3}.character-runtime-choice__selectors--one{grid-template-columns:1fr}.character-runtime-choice--dread .character-runtime-choice__current{grid-template-columns:repeat(3,minmax(0,1fr))}@media(max-width:800px){.character-runtime-choice--dread .character-runtime-choice__current{grid-template-columns:1fr}}
    `}</style>
  </section>;
}

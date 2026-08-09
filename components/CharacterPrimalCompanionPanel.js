import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

function safeText(value) {
  return String(value ?? "").trim();
}

export default function CharacterPrimalCompanionPanel({ characterId, sheet = {}, onSheetUpdated = null }) {
  const classKey = safeText(sheet.classKey || sheet.className || sheet.class || sheet.meta?.classKey).toLowerCase();
  const level = Number(sheet.level || sheet.meta?.level || 1);
  const potentiallyAvailable = classKey === "ranger" && level >= 3;
  const [profile, setProfile] = useState(null);
  const [statBlockKey, setStatBlockKey] = useState("");
  const [appearance, setAppearance] = useState("");
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
    const { data, error: rpcError } = await supabase.rpc("get_character_primal_companion_v1", {
      p_character_id: characterId,
    });
    if (rpcError) {
      if (String(rpcError.code || "") !== "42501" && String(rpcError.code || "") !== "PGRST202") {
        setError(rpcError.message || "Could not load Primal Companion state.");
      }
      setProfile(null);
    } else {
      setProfile(data && typeof data === "object" ? data : null);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
    // Refresh when character/subclass/level changes or the current runtime projection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, potentiallyAvailable, sheet?.meta?.subclassName, sheet?.meta?.subclassSource, sheet?.runtimeCompanions?.primalCompanion?.configuredAt]);

  const options = useMemo(() => Array.isArray(profile?.options) ? profile.options : [], [profile?.options]);
  const configured = Boolean(profile?.configured);
  const canConfigure = Boolean(profile?.canConfigure);
  const canReplace = Boolean(profile?.canReplace);
  const canChoose = canConfigure || canReplace;
  const state = profile?.state || null;

  useEffect(() => {
    if (!canChoose) return;
    setStatBlockKey(canReplace ? safeText(state?.statBlockKey) : "");
    setAppearance(canReplace ? safeText(state?.appearance) : "");
  }, [canChoose, canReplace, state?.statBlockKey, state?.appearance]);

  async function save() {
    if (!characterId || !statBlockKey || !safeText(appearance) || busy) return;
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_primal_companion_v1", {
      p_character_id: characterId,
      p_stat_block_key: statBlockKey,
      p_appearance: safeText(appearance),
    });
    if (rpcError) {
      setError(rpcError.message || "Could not configure Primal Companion.");
      setBusy(false);
      return;
    }
    setProfile(data && typeof data === "object" ? data : null);
    const { data: sheetRow, error: sheetError } = await supabase
      .from("character_sheets")
      .select("sheet")
      .eq("character_id", characterId)
      .maybeSingle();
    if (!sheetError && sheetRow?.sheet) onSheetUpdated?.(sheetRow.sheet);
    setBusy(false);
  }

  if (!potentiallyAvailable || (!loading && profile?.available === false) || (!loading && !profile && !error)) return null;

  return <section className="character-runtime-choice character-runtime-choice--companion" aria-label="Primal Companion configuration">
    <div className="character-runtime-choice__head">
      <div><span>Long-Rest replacement</span><strong>Primal Companion</strong></div>
      <button type="button" className="character-runtime-choice__refresh" onClick={loadProfile} disabled={loading || busy} title="Refresh after leveling or completing a Long Rest">Refresh</button>
    </div>
    {error ? <div className="character-runtime-choice__error">{error}</div> : null}
    {loading ? <p>Loading Primal Companion state…</p> : <>
      {configured ? <div className="character-runtime-choice__current">
        <div><span>Current form</span><strong>{state?.statBlockName || "—"}</strong></div>
        <div><span>Appearance</span><strong>{state?.appearance || "—"}</strong></div>
      </div> : null}

      {canChoose ? <>
        <div className="character-runtime-choice__selectors">
          <label><span>{configured ? "New form" : "Companion form"}</span><select value={statBlockKey} onChange={(event) => setStatBlockKey(event.target.value)}><option value="">Choose Land, Sea, or Sky…</option>{options.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}</select></label>
          <label><span>Animal appearance</span><input value={appearance} maxLength={80} onChange={(event) => setAppearance(event.target.value)} placeholder="e.g. wolf, panther, giant otter, hawk" /></label>
        </div>
        <button type="button" className="character-runtime-choice__save" onClick={save} disabled={busy || !statBlockKey || !safeText(appearance)}>{busy ? "Applying…" : configured ? "Summon Replacement" : "Summon Initial Companion"}</button>
      </> : configured ? <p>Your current companion persists. Finish a newer Long Rest before summoning a different primal beast.</p> : <p>Choose the initial Beast of the Land, Sea, or Sky and describe its animal appearance.</p>}
      <p>The current beast remains until you replace it. A Long Rest opens one replacement opportunity; it does not automatically dismiss your existing companion.</p>
    </>}
    <style jsx global>{`
      .character-runtime-choice--companion{border-color:rgba(88,214,199,.28);background:rgba(88,214,199,.055)}.character-runtime-choice--companion .character-runtime-choice__save,.character-runtime-choice--companion .character-runtime-choice__refresh{border-color:rgba(88,214,199,.4);background:rgba(42,136,124,.12);color:#c9fff7}.character-runtime-choice--companion .character-runtime-choice__selectors input{width:100%;padding:6px 7px;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#10131d;color:#fff;font-size:.68rem}
    `}</style>
  </section>;
}

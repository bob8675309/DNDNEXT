import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const safeText = (value) => String(value ?? "").trim();
const compact = (value) => safeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
const abilityLabel = (value) => ({ int: "Intelligence", wis: "Wisdom", cha: "Charisma" }[safeText(value).toLowerCase()] || safeText(value) || "—");

function potentiallyEligible(sheet = {}) {
  const species = compact(sheet.species || sheet.race || sheet.meta?.species);
  const source = safeText(sheet.meta?.speciesSource || sheet.speciesSource).toUpperCase();
  return (species === "elf" && source === "XPHB") || (species === "khoravar" && source === "EFA");
}

export default function CharacterSpeciesReplaceableCantripPanel({ characterId, sheet = {}, onSheetUpdated = null }) {
  const eligible = potentiallyEligible(sheet);
  const [profile, setProfile] = useState(null);
  const [spellId, setSpellId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadProfile() {
    if (!characterId || !eligible) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("get_character_species_replaceable_cantrip_v1", { p_character_id: characterId });
    if (rpcError) {
      if (!["42501", "PGRST202"].includes(String(rpcError.code || ""))) {
        setError(rpcError.message || "Could not load the Species cantrip state.");
      }
      setProfile(null);
    } else setProfile(data && typeof data === "object" ? data : null);
    setLoading(false);
  }

  useEffect(() => {
    setSpellId("");
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, eligible, sheet?.runtimeFeatures?.speciesReplaceableCantrip?.configuredAt]);

  const options = useMemo(() => Array.isArray(profile?.options) ? profile.options : [], [profile?.options]);
  const state = profile?.state || null;
  const currentSpellId = safeText(state?.spellId);
  const replacementOptions = useMemo(() => options.filter((option) => safeText(option.spellId) !== currentSpellId), [currentSpellId, options]);

  async function save() {
    if (!characterId || !spellId || busy) return;
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_species_replaceable_cantrip_v1", {
      p_character_id: characterId,
      p_spell_id: spellId,
    });
    if (rpcError) {
      setError(rpcError.message || "Could not replace the Species cantrip.");
      setBusy(false);
      return;
    }
    setProfile(data && typeof data === "object" ? data : null);
    setSpellId("");
    const { data: sheetRow, error: sheetError } = await supabase.from("character_sheets").select("sheet").eq("character_id", characterId).maybeSingle();
    if (!sheetError && sheetRow?.sheet) onSheetUpdated?.(sheetRow.sheet);
    setBusy(false);
  }

  if (!eligible || (!loading && profile?.available === false) || (!loading && !profile && !error)) return null;

  const configured = Boolean(profile?.configured);
  const canReplace = Boolean(profile?.canReplace);
  return <section className="character-runtime-choice character-runtime-choice--species-cantrip" aria-label="Species replaceable cantrip">
    <div className="character-runtime-choice__head">
      <div><span>Long-Rest replacement</span><strong>{profile?.featureName || "Species Cantrip"}</strong></div>
      <button type="button" className="character-runtime-choice__refresh" onClick={loadProfile} disabled={loading || busy}>Refresh</button>
    </div>
    {error ? <div className="character-runtime-choice__error">{error}</div> : null}
    {loading ? <p>Loading Species cantrip…</p> : <>
      {configured ? <div className="character-runtime-choice__current">
        <div><span>Current cantrip</span><strong>{state?.cantripName || "—"}</strong></div>
        <div><span>Spellcasting ability</span><strong>{abilityLabel(state?.castingStat)}</strong></div>
      </div> : <p>The source-fixed initial cantrip has not been materialized for this character.</p>}
      {configured && canReplace ? <>
        <div className="character-runtime-choice__selectors character-runtime-choice__selectors--one">
          <label><span>Replacement cantrip</span><select value={spellId} onChange={(event) => setSpellId(event.target.value)}><option value="">Choose a different cantrip…</option>{replacementOptions.map((option) => <option key={option.spellId} value={option.spellId}>{option.name} • {option.source}</option>)}</select></label>
        </div>
        <button type="button" className="character-runtime-choice__save" onClick={save} disabled={busy || !spellId}>{busy ? "Applying…" : "Replace Cantrip"}</button>
      </> : configured ? <p>The current cantrip persists. Finish a newer Long Rest before replacing it.</p> : null}
      <p>{profile?.helper || "The cantrip can change after a Long Rest; the permanent Species spellcasting-ability choice does not change."}</p>
    </>}
    <style jsx global>{`
      .character-runtime-choice--species-cantrip{border-color:rgba(126,198,255,.28);background:rgba(63,139,191,.07)}
      .character-runtime-choice--species-cantrip .character-runtime-choice__save,.character-runtime-choice--species-cantrip .character-runtime-choice__refresh{border-color:rgba(126,198,255,.4);background:rgba(63,139,191,.13);color:#d9f1ff}
      .character-runtime-choice--species-cantrip .character-runtime-choice__current{grid-template-columns:repeat(2,minmax(0,1fr))}
      @media(max-width:800px){.character-runtime-choice--species-cantrip .character-runtime-choice__current{grid-template-columns:1fr}}
    `}</style>
  </section>;
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import CharacterCurrencyBadge from "./CharacterCurrencyBadge";

function safeText(value) {
  return String(value ?? "").trim();
}

export default function CharacterCircleLandPanel({ characterId, sheet = {}, onSheetUpdated = null }) {
  const classKey = safeText(sheet.classKey || sheet.className || sheet.class || sheet.meta?.classKey).toLowerCase();
  const level = Number(sheet.level || sheet.meta?.level || 1);
  const potentiallyAvailable = classKey === "druid" && level >= 3;
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
    const { data, error: rpcError } = await supabase.rpc("get_character_circle_land_v1", { p_character_id: characterId });
    if (rpcError) {
      if (String(rpcError.code || "") !== "42501" && String(rpcError.code || "") !== "PGRST202") {
        setError(rpcError.message || "Could not load Circle of the Land spells.");
      }
      setProfile(null);
    } else setProfile(data && typeof data === "object" ? data : null);
    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, potentiallyAvailable, sheet?.meta?.subclassName, sheet?.meta?.subclassSource, sheet?.runtimeFeatures?.circleOfTheLand?.configuredAt]);

  const options = useMemo(() => Array.isArray(profile?.options) ? profile.options : [], [profile?.options]);
  const configured = Boolean(profile?.configured);
  const canConfigure = Boolean(profile?.canConfigure);
  const state = profile?.state || null;

  useEffect(() => {
    if (canConfigure) setChoice("");
  }, [canConfigure, profile?.latestLongRestAt]);

  async function save() {
    if (!characterId || !choice || busy) return;
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_circle_land_v1", {
      p_character_id: characterId,
      p_land_key: choice,
    });
    if (rpcError) {
      setError(rpcError.message || "Could not configure Circle of the Land spells.");
      setBusy(false);
      return;
    }
    setProfile(data && typeof data === "object" ? data : null);
    const { data: sheetRow, error: sheetError } = await supabase.from("character_sheets").select("sheet").eq("character_id", characterId).maybeSingle();
    if (!sheetError && sheetRow?.sheet) onSheetUpdated?.(sheetRow.sheet);
    setBusy(false);
  }

  const visible = potentiallyAvailable && (loading || profile?.available !== false) && (loading || profile || error);
  const currentSpells = Array.isArray(state?.spellNames) ? state.spellNames : [];
  const circlePanel = !visible ? null : <section className="character-runtime-choice character-runtime-choice--land" aria-label="Circle of the Land spell configuration">
    <div className="character-runtime-choice__head">
      <div><span>Long-Rest choice</span><strong>Circle Spells</strong></div>
      <button type="button" className="character-runtime-choice__refresh" onClick={loadProfile} disabled={loading || busy}>Refresh</button>
    </div>
    {error ? <div className="character-runtime-choice__error">{error}</div> : null}
    {loading ? <p>Loading Circle of the Land spell packages…</p> : <>
      {configured ? <div className="character-runtime-choice__current character-runtime-choice__current--land">
        <div><span>Current land</span><strong>{state?.landName || "—"}</strong></div>
        <div><span>Always-prepared Circle Spells</span><strong>{currentSpells.length ? currentSpells.join(", ") : "—"}</strong></div>
      </div> : null}
      {canConfigure ? <>
        <div className="circle-land-options">
          {options.map((option) => <button key={option.key} type="button" className={choice === option.key ? "is-active" : ""} onClick={() => setChoice(option.key)}>
            <strong>{option.name}</strong>
            <span>{Array.isArray(option.spells) ? option.spells.map((spell) => spell.name).join(", ") : ""}</span>
          </button>)}
        </div>
        <button type="button" className="character-runtime-choice__save" onClick={save} disabled={busy || !choice}>{busy ? "Applying…" : "Choose Land for this Long Rest"}</button>
      </> : configured ? <p>This land package lasts until your next Long Rest. When that rest finishes, the package expires and you choose a new land for the next rest cycle.</p> : <p>Finish a Long Rest after gaining Circle Spells to choose Arid, Polar, Temperate, or Tropical.</p>}
      <p>The spell packages are read from the imported XPHB Circle Spells table. They are always prepared and remain separate from ordinary Druid prepared-spell authority.</p>
    </>}
    <style jsx global>{`
      .character-runtime-choice--land{border-color:rgba(112,194,96,.3);background:rgba(59,123,50,.08)}.character-runtime-choice--land .character-runtime-choice__save,.character-runtime-choice--land .character-runtime-choice__refresh{border-color:rgba(112,194,96,.44);background:rgba(59,123,50,.14);color:#d9ffd1}.character-runtime-choice__current--land{grid-template-columns:minmax(150px,.35fr) minmax(0,1fr)}.circle-land-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:9px 0}.circle-land-options button{display:grid;gap:4px;padding:9px;border:1px solid rgba(255,255,255,.11);border-radius:8px;background:rgba(0,0,0,.14);color:#fff;text-align:left}.circle-land-options button.is-active{border-color:rgba(112,194,96,.7);background:rgba(69,139,58,.18)}.circle-land-options strong{font-size:.72rem}.circle-land-options span{color:rgba(255,255,255,.58);font-size:.62rem;line-height:1.4}@media(max-width:760px){.circle-land-options,.character-runtime-choice__current--land{grid-template-columns:1fr}}
    `}</style>
  </section>;

  return <>{circlePanel}<CharacterCurrencyBadge characterId={characterId} /></>;
}

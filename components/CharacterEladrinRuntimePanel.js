import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const safeText = (value) => String(value ?? "").trim();
const compact = (value) => safeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");

function eligibleEladrin(sheet = {}) {
  const species = compact(sheet.species || sheet.race || sheet.meta?.species);
  const source = safeText(sheet.meta?.speciesSource || sheet.speciesSource).toUpperCase();
  return species === "eladrin" && source === "MPMM";
}

export default function CharacterEladrinRuntimePanel({ characterId, sheet = {}, onSheetUpdated = null }) {
  const eligible = eligibleEladrin(sheet);
  const [season, setSeason] = useState(null);
  const [trance, setTrance] = useState(null);
  const [seasonKey, setSeasonKey] = useState("");
  const [firstTraining, setFirstTraining] = useState("");
  const [secondTraining, setSecondTraining] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!characterId || !eligible) {
      setSeason(null);
      setTrance(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const [seasonResult, tranceResult] = await Promise.all([
      supabase.rpc("get_character_eladrin_season_v1", { p_character_id: characterId }),
      supabase.rpc("get_character_eladrin_trance_v1", { p_character_id: characterId }),
    ]);
    const rpcError = seasonResult.error || tranceResult.error;
    if (rpcError) {
      if (!["42501", "PGRST202"].includes(String(rpcError.code || ""))) {
        setError(rpcError.message || "Could not load Eladrin runtime choices.");
      }
      setSeason(null);
      setTrance(null);
    } else {
      setSeason(seasonResult.data && typeof seasonResult.data === "object" ? seasonResult.data : null);
      setTrance(tranceResult.data && typeof tranceResult.data === "object" ? tranceResult.data : null);
    }
    setLoading(false);
  }

  useEffect(() => {
    setSeasonKey("");
    setFirstTraining("");
    setSecondTraining("");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, eligible, sheet?.runtimeFeatures?.eladrinSeason?.configuredAt, sheet?.runtimeProficiencies?.eladrinTrance?.configuredAt]);

  const seasonOptions = useMemo(() => Array.isArray(season?.options) ? season.options : [], [season?.options]);
  const trainingOptions = useMemo(() => Array.isArray(trance?.trainingOptions) ? trance.trainingOptions : [], [trance?.trainingOptions]);

  async function refreshSheet() {
    const { data: sheetRow, error: sheetError } = await supabase.from("character_sheets").select("sheet").eq("character_id", characterId).maybeSingle();
    if (!sheetError && sheetRow?.sheet) onSheetUpdated?.(sheetRow.sheet);
  }

  async function saveSeason() {
    if (!seasonKey || busy) return;
    setBusy("season");
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_eladrin_season_v1", {
      p_character_id: characterId,
      p_season_key: seasonKey,
    });
    if (rpcError) setError(rpcError.message || "Could not change Eladrin Season.");
    else {
      setSeason(data && typeof data === "object" ? data : null);
      setSeasonKey("");
      await refreshSheet();
    }
    setBusy("");
  }

  async function saveTrance() {
    if (!firstTraining || !secondTraining || firstTraining === secondTraining || busy) return;
    setBusy("trance");
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_eladrin_trance_v1", {
      p_character_id: characterId,
      p_first_item_id: firstTraining,
      p_second_item_id: secondTraining,
    });
    if (rpcError) setError(rpcError.message || "Could not configure Eladrin Trance proficiencies.");
    else {
      setTrance(data && typeof data === "object" ? data : null);
      setFirstTraining("");
      setSecondTraining("");
      await refreshSheet();
    }
    setBusy("");
  }

  if (!eligible || (!loading && !season && !trance && !error)) return null;

  const currentSeason = season?.state?.season || null;
  const currentTrainings = Array.isArray(trance?.state?.trainings) ? trance.state.trainings : [];
  const canChooseSeason = Boolean(season?.canConfigure || season?.canReplace);
  const canChooseTrance = Boolean(trance?.canConfigure);

  return <div className="character-eladrin-runtime" aria-label="Eladrin runtime choices">
    {error ? <div className="character-runtime-choice__error">{error}</div> : null}
    {loading ? <section className="character-runtime-choice"><p>Loading Eladrin runtime choices…</p></section> : <>
      <section className="character-runtime-choice character-runtime-choice--eladrin-season" aria-label="Eladrin Season configuration">
        <div className="character-runtime-choice__head">
          <div><span>Long-Rest replacement</span><strong>Eladrin Season</strong></div>
          <button type="button" className="character-runtime-choice__refresh" onClick={load} disabled={loading || Boolean(busy)}>Refresh</button>
        </div>
        {season?.configured ? <div className="character-runtime-choice__current"><div><span>Current season</span><strong>{currentSeason?.label || "—"}</strong></div></div> : <p>No current season is configured.</p>}
        {canChooseSeason ? <>
          <div className="character-runtime-choice__selectors character-runtime-choice__selectors--one">
            <label><span>{season?.configured ? "New season" : "Current season"}</span><select value={seasonKey} onChange={(event) => setSeasonKey(event.target.value)}><option value="">Choose a season…</option>{seasonOptions.filter((option) => option.key !== currentSeason?.key).map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
          </div>
          <button type="button" className="character-runtime-choice__save" onClick={saveSeason} disabled={Boolean(busy) || !seasonKey}>{busy === "season" ? "Applying…" : season?.configured ? "Change Season" : "Set Season"}</button>
        </> : season?.configured ? <p>The current season persists. Finish a newer Long Rest before changing it.</p> : null}
        <p>{season?.helper || "The current season persists until changed after a Long Rest. At character level 3+, it determines the extra Fey Step effect."}</p>
        {currentSeason?.effect ? <p><strong>Fey Step:</strong> {currentSeason.effect}</p> : null}
      </section>

      <section className="character-runtime-choice character-runtime-choice--eladrin-trance" aria-label="Eladrin Trance proficiency configuration">
        <div className="character-runtime-choice__head"><div><span>Long-Rest choice</span><strong>Trance Training</strong></div></div>
        {trance?.configured ? <div className="character-runtime-choice__current">
          <div><span>Proficiency 1</span><strong>{currentTrainings[0]?.name || "—"} • {currentTrainings[0]?.kind || "—"}</strong></div>
          <div><span>Proficiency 2</span><strong>{currentTrainings[1]?.name || "—"} • {currentTrainings[1]?.kind || "—"}</strong></div>
        </div> : null}
        {canChooseTrance ? <>
          <div className="character-runtime-choice__selectors">
            <label><span>Weapon or tool 1</span><select value={firstTraining} onChange={(event) => setFirstTraining(event.target.value)}><option value="">Choose a weapon or tool…</option>{trainingOptions.map((option) => <option key={`a-${option.itemId}`} value={option.itemId}>{option.name} • {option.kind}</option>)}</select></label>
            <label><span>Weapon or tool 2</span><select value={secondTraining} onChange={(event) => setSecondTraining(event.target.value)}><option value="">Choose a different weapon or tool…</option>{trainingOptions.filter((option) => option.itemId !== firstTraining).map((option) => <option key={`b-${option.itemId}`} value={option.itemId}>{option.name} • {option.kind}</option>)}</select></label>
          </div>
          <button type="button" className="character-runtime-choice__save" onClick={saveTrance} disabled={Boolean(busy) || !firstTraining || !secondTraining || firstTraining === secondTraining}>{busy === "trance" ? "Applying…" : "Choose for this Long Rest"}</button>
        </> : trance?.configured ? <p>These two temporary proficiencies last until your next Long Rest, when they expire.</p> : <p>Finish a Long Rest before choosing the two temporary Trance proficiencies.</p>}
        <p>{trance?.helper || "After the Eladrin Trance/Long Rest, choose two different Player’s Handbook weapon or tool proficiencies until the next Long Rest."}</p>
      </section>
    </>}
    <style jsx global>{`
      .character-runtime-choice--eladrin-season,.character-runtime-choice--eladrin-trance{border-color:rgba(191,150,255,.28);background:rgba(117,72,180,.07)}
      .character-runtime-choice--eladrin-season .character-runtime-choice__save,.character-runtime-choice--eladrin-season .character-runtime-choice__refresh,.character-runtime-choice--eladrin-trance .character-runtime-choice__save{border-color:rgba(191,150,255,.4);background:rgba(117,72,180,.13);color:#efe3ff}
    `}</style>
  </div>;
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import CharacterDreadAllegiancePanel from "./CharacterDreadAllegiancePanel";
import CharacterSheetRestSyncBridge from "./CharacterSheetRestSyncBridge";

function safeText(value) {
  return String(value ?? "").trim();
}

export default function CharacterAstralTrancePanel({ characterId, sheet = {}, onSheetUpdated = null }) {
  const species = safeText(sheet.species || sheet.race || sheet.meta?.species).toLowerCase();
  const source = safeText(sheet.meta?.speciesSource).toUpperCase();
  const potentiallyAvailable = species === "astral elf" && source === "AAG";
  const [profile, setProfile] = useState(null);
  const [skillKey, setSkillKey] = useState("");
  const [trainingItemId, setTrainingItemId] = useState("");
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
    const { data, error: rpcError } = await supabase.rpc("get_character_astral_trance_v1", {
      p_character_id: characterId,
    });
    if (rpcError) {
      if (String(rpcError.code || "") !== "42501" && String(rpcError.code || "") !== "PGRST202") {
        setError(rpcError.message || "Could not load Astral Trance choices.");
      }
      setProfile(null);
    } else {
      setProfile(data && typeof data === "object" ? data : null);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
    // Re-read when selection/sheet changes so a Long Rest refresh or character swap cannot retain stale state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, potentiallyAvailable, sheet?.runtimeProficiencies?.astralTrance?.configured, sheet?.runtimeProficiencies?.astralTrance?.configuredRestAt]);

  const skills = useMemo(() => Array.isArray(profile?.skillOptions) ? profile.skillOptions : [], [profile?.skillOptions]);
  const training = useMemo(() => Array.isArray(profile?.trainingOptions) ? profile.trainingOptions : [], [profile?.trainingOptions]);
  const configured = Boolean(profile?.configured);
  const canConfigure = Boolean(profile?.canConfigure);
  const selectedSkill = profile?.state?.skill || null;
  const selectedTraining = profile?.state?.training || null;

  async function save() {
    if (!characterId || !skillKey || !trainingItemId || busy) return;
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_astral_trance_v1", {
      p_character_id: characterId,
      p_skill_key: skillKey,
      p_training_item_id: trainingItemId,
    });
    if (rpcError) {
      setError(rpcError.message || "Could not configure Astral Trance.");
      setBusy(false);
      return;
    }
    setProfile(data && typeof data === "object" ? data : null);
    setSkillKey("");
    setTrainingItemId("");
    const { data: sheetRow, error: sheetError } = await supabase
      .from("character_sheets")
      .select("sheet")
      .eq("character_id", characterId)
      .maybeSingle();
    if (!sheetError && sheetRow?.sheet) onSheetUpdated?.(sheetRow.sheet);
    setBusy(false);
  }

  const visible = potentiallyAvailable && (loading || profile?.available !== false) && (loading || profile || error);
  const astralPanel = !visible ? null : <section className="character-runtime-choice character-runtime-choice--astral" aria-label="Astral Trance configuration">
    <div className="character-runtime-choice__head">
      <div><span>Long-Rest choice</span><strong>Astral Trance</strong></div>
      <button type="button" className="character-runtime-choice__refresh" onClick={loadProfile} disabled={loading || busy} title="Refresh after completing a Long Rest">Refresh</button>
    </div>
    {error ? <div className="character-runtime-choice__error">{error}</div> : null}
    {loading ? <p>Loading Astral Trance state…</p> : configured ? <>
      <div className="character-runtime-choice__current">
        <div><span>Skill</span><strong>{selectedSkill?.name || selectedSkill?.key || "—"}</strong></div>
        <div><span>{selectedTraining?.kind === "weapon" ? "Weapon" : "Tool"}</span><strong>{selectedTraining?.name || "—"}</strong></div>
      </div>
      <p>These proficiencies last until the next Long Rest. They are temporary runtime choices and do not rewrite permanent character training.</p>
    </> : canConfigure ? <>
      <div className="character-runtime-choice__selectors">
        <label><span>Skill proficiency</span><select value={skillKey} onChange={(event) => setSkillKey(event.target.value)}><option value="">Choose a skill…</option>{skills.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}</select></label>
        <label><span>Weapon or tool proficiency</span><select value={trainingItemId} onChange={(event) => setTrainingItemId(event.target.value)}><option value="">Choose a weapon or tool…</option>{training.map((option) => <option key={option.itemId} value={option.itemId}>{option.name} • {option.kind}</option>)}</select></label>
      </div>
      <button type="button" className="character-runtime-choice__save" onClick={save} disabled={busy || !skillKey || !trainingItemId}>{busy ? "Applying…" : "Choose for this Long Rest"}</button>
      <p>Choose one skill and one PHB weapon or tool after the completed Long Rest. The pair expires automatically at the next Long Rest.</p>
    </> : <p>Finish a Long Rest to choose one skill and one weapon or tool proficiency from shared elven memory.</p>}
    <style jsx global>{`
      .character-runtime-choice{margin:10px 12px;padding:11px 13px;border:1px solid rgba(168,108,255,.28);border-radius:10px;background:rgba(126,72,199,.07);color:#fff}.character-runtime-choice__head{display:flex;align-items:center;justify-content:space-between;gap:10px}.character-runtime-choice__head>div{display:grid;gap:2px}.character-runtime-choice__head span,.character-runtime-choice__current span,.character-runtime-choice__selectors label>span{font-size:.61rem;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.5);font-weight:800}.character-runtime-choice__head strong{font-size:.82rem}.character-runtime-choice__refresh,.character-runtime-choice__save{border:1px solid rgba(168,108,255,.44);border-radius:8px;background:rgba(126,72,199,.13);color:#eadfff;padding:6px 9px;font-size:.68rem;font-weight:750}.character-runtime-choice__current{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}.character-runtime-choice__current>div{display:grid;gap:3px;padding:8px;border-radius:8px;background:rgba(0,0,0,.16)}.character-runtime-choice__current strong{font-size:.72rem}.character-runtime-choice__selectors{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:9px 0}.character-runtime-choice__selectors label{display:grid;gap:4px}.character-runtime-choice__selectors select{width:100%;padding:6px 7px;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#10131d;color:#fff;font-size:.68rem}.character-runtime-choice p{margin:8px 0 0;color:rgba(255,255,255,.58);font-size:.64rem;line-height:1.45}.character-runtime-choice__error{margin-top:7px;color:#ffb9b9;font-size:.68rem}@media(max-width:720px){.character-runtime-choice__current,.character-runtime-choice__selectors{grid-template-columns:1fr}}
    `}</style>
  </section>;

  return <><CharacterSheetRestSyncBridge characterId={characterId} onSheetUpdated={onSheetUpdated} />{astralPanel}<CharacterDreadAllegiancePanel characterId={characterId} sheet={sheet} onSheetUpdated={onSheetUpdated} /></>;
}

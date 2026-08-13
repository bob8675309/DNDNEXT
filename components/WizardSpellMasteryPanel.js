import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const safeText = (value) => String(value ?? "").trim();

function optionLabel(option) {
  return `${option?.name || "Spell"}${option?.source ? ` • ${option.source}` : ""}`;
}

export default function WizardSpellMasteryPanel({ characterId = "", encounterLocked = false, lastLongRest = null }) {
  const id = safeText(characterId);
  const [profile, setProfile] = useState(null);
  const [level1SpellId, setLevel1SpellId] = useState("");
  const [level2SpellId, setLevel2SpellId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    if (!id) {
      setProfile(null);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("get_wizard_spell_mastery_v1", { p_character_id: id });
    if (rpcError) {
      setError(rpcError.message || "Could not load Spell Mastery.");
      setProfile(null);
    } else {
      const next = data && typeof data === "object" ? data : null;
      setProfile(next);
      setLevel1SpellId(safeText(next?.state?.level1?.spellId));
      setLevel2SpellId(safeText(next?.state?.level2?.spellId));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // A new Long Rest changes replacement eligibility, so reload when its timestamp changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lastLongRest]);

  const level1Options = Array.isArray(profile?.level1Options) ? profile.level1Options : [];
  const level2Options = Array.isArray(profile?.level2Options) ? profile.level2Options : [];
  const currentLevel1 = safeText(profile?.state?.level1?.spellId);
  const currentLevel2 = safeText(profile?.state?.level2?.spellId);
  const changedCount = useMemo(() => {
    if (!profile?.configured) return Number(Boolean(level1SpellId)) + Number(Boolean(level2SpellId));
    return Number(level1SpellId !== currentLevel1) + Number(level2SpellId !== currentLevel2);
  }, [currentLevel1, currentLevel2, level1SpellId, level2SpellId, profile?.configured]);

  if (!profile?.available && !loading && !error) return null;
  if (!profile?.available && loading) return null;

  const configured = Boolean(profile?.configured);
  const canReplaceOne = Boolean(profile?.canReplaceOne);
  const locked = encounterLocked || busy || loading || (configured && !canReplaceOne);
  const valid = Boolean(level1SpellId && level2SpellId)
    && (!configured || changedCount <= 1)
    && (!configured || changedCount === 0 || canReplaceOne);
  const buttonLabel = !configured ? "Set Spell Mastery" : changedCount === 0 ? "Mastery unchanged" : "Replace mastered spell";

  async function save() {
    if (!id || !valid || busy || encounterLocked) return;
    if (configured && changedCount === 0) {
      setNotice("Spell Mastery is already configured with those spells.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const { data, error: rpcError } = await supabase.rpc("configure_wizard_spell_mastery_v1", {
      p_character_id: id,
      p_level_1_spell_id: level1SpellId,
      p_level_2_spell_id: level2SpellId,
    });
    if (rpcError) setError(rpcError.message || "Could not configure Spell Mastery.");
    else {
      setProfile(data && typeof data === "object" ? data : profile);
      setNotice(configured ? "Spell Mastery updated for this Long Rest." : "Spell Mastery configured.");
      await load();
    }
    setBusy(false);
  }

  return (
    <section className="wizard-spell-mastery" aria-label="Wizard Spell Mastery configuration">
      <header>
        <div>
          <span>Long-Rest configuration</span>
          <strong>Spell Mastery</strong>
        </div>
        <em>{configured ? canReplaceOne ? "1 replacement available" : "Configured" : "Choose both spells"}</em>
      </header>

      <p>{profile?.helper || "Choose one level-1 and one level-2 Action spell from this Wizard's spellbook."}</p>
      <div className="wizard-spell-mastery__grid">
        <label>
          <span>Level 1 mastered spell</span>
          <select value={level1SpellId} disabled={locked && !(!configured && !encounterLocked)} onChange={(event) => { setLevel1SpellId(event.target.value); setError(""); setNotice(""); }}>
            <option value="">Choose a level-1 Action spell…</option>
            {level1Options.map((option) => <option key={option.spellId} value={option.spellId}>{optionLabel(option)}</option>)}
          </select>
        </label>
        <label>
          <span>Level 2 mastered spell</span>
          <select value={level2SpellId} disabled={locked && !(!configured && !encounterLocked)} onChange={(event) => { setLevel2SpellId(event.target.value); setError(""); setNotice(""); }}>
            <option value="">Choose a level-2 Action spell…</option>
            {level2Options.map((option) => <option key={option.spellId} value={option.spellId}>{optionLabel(option)}</option>)}
          </select>
        </label>
      </div>

      {configured && changedCount > 1 ? <div className="wizard-spell-mastery__warning">Only one mastered spell can change after a Long Rest.</div> : null}
      {configured && !canReplaceOne ? <div className="wizard-spell-mastery__hint">Finish a new Long Rest before changing one mastered spell. A Short Rest does not unlock a replacement.</div> : null}
      {encounterLocked ? <div className="wizard-spell-mastery__hint">Spell Mastery cannot be reconfigured while the battle board controls this character.</div> : null}
      {profile?.tacticalFreeCastAutomated === false ? <div className="wizard-spell-mastery__hint">The no-slot Spell Mastery cast is tracked on the character sheet; battle-board free-cast automation remains GM-assisted.</div> : null}
      {error ? <div className="wizard-spell-mastery__error" role="alert">{error}</div> : null}
      {notice ? <div className="wizard-spell-mastery__notice" role="status">{notice}</div> : null}

      <button type="button" disabled={!valid || busy || encounterLocked || (configured && changedCount === 0)} onClick={save}>
        {busy ? "Saving…" : buttonLabel}
      </button>

      <style jsx>{`
        .wizard-spell-mastery{display:grid;gap:10px;padding:12px;border:1px solid rgba(168,108,255,.38);border-radius:12px;background:rgba(48,31,70,.22)}
        header{display:flex;align-items:center;justify-content:space-between;gap:12px}header>div{display:grid;gap:2px}header span{font-size:.58rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#c9a8ff}header strong{color:#fff;font-size:.9rem}header em{padding:4px 8px;border-radius:999px;background:rgba(168,108,255,.16);color:#eadfff;font-size:.6rem;font-style:normal}
        p{margin:0;color:rgba(255,255,255,.72);font-size:.68rem;line-height:1.5}.wizard-spell-mastery__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}label{display:grid;gap:5px}label span{color:rgba(255,255,255,.62);font-size:.6rem;font-weight:800;text-transform:uppercase}select{width:100%;padding:8px 9px;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:#0c0e17;color:#fff;font-size:.7rem}select:disabled{opacity:.6}
        .wizard-spell-mastery__warning,.wizard-spell-mastery__error{padding:7px 9px;border-radius:8px;background:rgba(255,104,104,.1);color:#ffd0d0;font-size:.64rem}.wizard-spell-mastery__hint{color:rgba(255,255,255,.56);font-size:.61rem;line-height:1.45}.wizard-spell-mastery__notice{padding:7px 9px;border-radius:8px;background:rgba(88,214,199,.1);color:#c9fff7;font-size:.64rem}button{justify-self:start;padding:7px 11px;border:1px solid rgba(168,108,255,.55);border-radius:8px;background:rgba(126,72,199,.22);color:#fff;font-size:.65rem;font-weight:800}button:disabled{opacity:.5}
        @media(max-width:700px){.wizard-spell-mastery__grid{grid-template-columns:1fr}header{align-items:flex-start;flex-direction:column}}
      `}</style>
    </section>
  );
}

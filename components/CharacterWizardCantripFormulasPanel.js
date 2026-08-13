import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const safeText = (value) => String(value ?? "").trim();
const list = (value) => Array.isArray(value) ? value : [];

export default function CharacterWizardCantripFormulasPanel({ characterId }) {
  const [model, setModel] = useState(null);
  const [fromAssignmentId, setFromAssignmentId] = useState("");
  const [toSpellId, setToSpellId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadModel() {
    if (!characterId) {
      setModel(null);
      setFromAssignmentId("");
      setToSpellId("");
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("get_character_wizard_cantrip_formulas_v1", {
      p_character_id: characterId,
    });
    if (rpcError) {
      const code = safeText(rpcError.code).toUpperCase();
      if (code !== "42501" && code !== "PGRST202") setError(rpcError.message || "Could not load Cantrip Formulas.");
      setModel(null);
    } else setModel(data && typeof data === "object" ? data : null);
    setLoading(false);
  }

  useEffect(() => {
    setFromAssignmentId("");
    setToSpellId("");
    loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  if (!characterId || (!loading && !error && !model?.available)) return null;

  async function save() {
    if (!fromAssignmentId || !toSpellId || saving) return;
    setSaving(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_wizard_cantrip_formulas_v1", {
      p_character_id: characterId,
      p_from_assignment_id: fromAssignmentId,
      p_to_spell_id: toSpellId,
    });
    if (rpcError) setError(rpcError.message || "Could not replace this Wizard cantrip.");
    else {
      setModel(data && typeof data === "object" ? data : null);
      setFromAssignmentId("");
      setToSpellId("");
    }
    setSaving(false);
  }

  const canConfigure = Boolean(model?.canConfigure);
  const knownCantrips = list(model?.knownCantrips);
  const replacementOptions = list(model?.replacementOptions);
  const lastReplacement = model?.lastReplacement || {};

  return <section className="character-wizard-cantrip-formulas" aria-label="Wizard Cantrip Formulas">
    <div className="character-wizard-cantrip-formulas__head">
      <div><span>Long-Rest feature</span><strong>Cantrip Formulas</strong></div>
      <small>{loading ? "Loading…" : `TCE • PHB Wizard ${Number(model?.context?.classLevel || 0) || ""}`}</small>
    </div>
    {lastReplacement?.toSpell?.name ? <div className="character-wizard-cantrip-formulas__last">
      <span>Last replacement</span><strong>{lastReplacement.fromSpell?.name || "—"} → {lastReplacement.toSpell.name}</strong>
    </div> : null}
    {canConfigure ? <div className="character-wizard-cantrip-formulas__choices">
      <label><span>Replace known cantrip</span><select value={fromAssignmentId} onChange={(event) => setFromAssignmentId(event.target.value)} disabled={saving}>
        <option value="">Choose class cantrip…</option>
        {knownCantrips.map((option) => <option key={option.assignmentId} value={option.assignmentId}>{option.name} • {option.source}</option>)}
      </select></label>
      <label><span>Learn instead</span><select value={toSpellId} onChange={(event) => setToSpellId(event.target.value)} disabled={saving}>
        <option value="">Choose Wizard cantrip…</option>
        {replacementOptions.map((option) => <option key={option.spellId} value={option.spellId}>{option.name} • {option.source}</option>)}
      </select></label>
      <button type="button" onClick={save} disabled={saving || !fromAssignmentId || !toSpellId}>{saving ? "Replacing…" : "Replace Cantrip"}</button>
    </div> : <div className="character-wizard-cantrip-formulas__wait">Finish a qualifying Long Rest after gaining Cantrip Formulas to replace one class-owned Wizard cantrip.</div>}
    {error ? <div className="character-wizard-cantrip-formulas__error">{error}</div> : null}
    <p>{model?.helper || "Cantrip Formulas replaces one existing PHB Wizard cantrip assignment in place; it does not add an extra known cantrip."}</p>
    <style jsx global>{`
      .character-wizard-cantrip-formulas{margin:8px 12px;padding:10px 12px;border:1px solid rgba(179,139,255,.26);border-radius:10px;background:rgba(94,57,145,.08);color:#fff}.character-wizard-cantrip-formulas__head{display:flex;justify-content:space-between;align-items:center;gap:12px}.character-wizard-cantrip-formulas__head>div{display:grid;gap:2px}.character-wizard-cantrip-formulas__head span,.character-wizard-cantrip-formulas__last span,.character-wizard-cantrip-formulas__choices label>span{font-size:.59rem;font-weight:850;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.48)}.character-wizard-cantrip-formulas__head strong{font-size:.8rem;color:#eadcff}.character-wizard-cantrip-formulas__head small{font-size:.63rem;color:rgba(255,255,255,.55)}.character-wizard-cantrip-formulas__last{display:grid;gap:3px;margin-top:8px;padding:8px;border-radius:8px;background:rgba(0,0,0,.15)}.character-wizard-cantrip-formulas__last strong{font-size:.7rem}.character-wizard-cantrip-formulas__choices{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;margin-top:8px}.character-wizard-cantrip-formulas__choices label{display:grid;gap:4px}.character-wizard-cantrip-formulas__choices select{min-width:0;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#17151c;color:#fff;padding:6px 7px;font-size:.68rem}.character-wizard-cantrip-formulas__choices button{border:1px solid rgba(179,139,255,.38);border-radius:7px;background:rgba(94,57,145,.18);color:#eadcff;padding:7px 9px;font-size:.66rem;font-weight:800}.character-wizard-cantrip-formulas__choices button:disabled{opacity:.45}.character-wizard-cantrip-formulas__wait{margin-top:8px;padding:8px;border-radius:8px;background:rgba(0,0,0,.14);font-size:.64rem;color:rgba(255,255,255,.62)}.character-wizard-cantrip-formulas__error{margin-top:8px;color:#ffb5b5;font-size:.66rem}.character-wizard-cantrip-formulas p{margin:8px 0 0;color:rgba(255,255,255,.56);font-size:.62rem;line-height:1.45}@media(max-width:850px){.character-wizard-cantrip-formulas__choices{grid-template-columns:1fr}.character-wizard-cantrip-formulas__choices button{width:100%}}
    `}</style>
  </section>;
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const safeText = (value) => String(value ?? "").trim();

function groupByLevel(options = []) {
  const map = new Map();
  for (const option of Array.isArray(options) ? options : []) {
    const level = Number(option?.level || 0);
    if (!map.has(level)) map.set(level, []);
    map.get(level).push(option);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

export default function CharacterWizardMemorizeSpellPanel({ characterId }) {
  const [model, setModel] = useState(null);
  const [fromSpellId, setFromSpellId] = useState("");
  const [toSpellId, setToSpellId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadModel() {
    if (!characterId) {
      setModel(null);
      setFromSpellId("");
      setToSpellId("");
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("get_character_wizard_memorize_spell_v1", {
      p_character_id: characterId,
    });
    if (rpcError) {
      const code = safeText(rpcError.code).toUpperCase();
      if (code !== "42501" && code !== "PGRST202") setError(rpcError.message || "Could not load Memorize Spell.");
      setModel(null);
    } else setModel(data && typeof data === "object" ? data : null);
    setLoading(false);
  }

  useEffect(() => {
    setFromSpellId("");
    setToSpellId("");
    loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  const preparedGroups = useMemo(() => groupByLevel(model?.preparedOptions), [model?.preparedOptions]);
  const unpreparedGroups = useMemo(() => groupByLevel(model?.unpreparedOptions), [model?.unpreparedOptions]);

  if (!characterId || (!loading && !error && !model?.available)) return null;

  async function save() {
    if (!fromSpellId || !toSpellId || saving) return;
    setSaving(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_wizard_memorize_spell_v1", {
      p_character_id: characterId,
      p_from_spell_id: fromSpellId,
      p_to_spell_id: toSpellId,
    });
    if (rpcError) setError(rpcError.message || "Could not use Memorize Spell.");
    else {
      setModel(data && typeof data === "object" ? data : null);
      setFromSpellId("");
      setToSpellId("");
    }
    setSaving(false);
  }

  const canConfigure = Boolean(model?.canConfigure);
  const lastSwap = model?.lastSwap || {};
  return <section className="character-wizard-memorize" aria-label="Wizard Memorize Spell">
    <div className="character-wizard-memorize__head">
      <div><span>Short-Rest feature</span><strong>Memorize Spell</strong></div>
      <small>{loading ? "Loading…" : model?.context?.classLevel ? `Wizard ${model.context.classLevel}` : "Wizard"}</small>
    </div>
    {lastSwap?.toSpell?.name ? <div className="character-wizard-memorize__last">
      <span>Last Short-Rest swap</span><strong>{lastSwap.fromSpell?.name || "—"} → {lastSwap.toSpell.name}</strong>
    </div> : null}
    {canConfigure ? <div className="character-wizard-memorize__choices">
      <label><span>Unprepare</span><select value={fromSpellId} onChange={(event) => setFromSpellId(event.target.value)} disabled={saving}>
        <option value="">Choose prepared spell…</option>
        {preparedGroups.map(([level, entries]) => <optgroup key={level} label={`Level ${level}`}>{entries.map((option) => <option key={option.spellId} value={option.spellId}>{option.name} • {option.source}</option>)}</optgroup>)}
      </select></label>
      <label><span>Prepare instead</span><select value={toSpellId} onChange={(event) => setToSpellId(event.target.value)} disabled={saving}>
        <option value="">Choose spellbook spell…</option>
        {unpreparedGroups.map(([level, entries]) => <optgroup key={level} label={`Level ${level}`}>{entries.map((option) => <option key={option.spellId} value={option.spellId}>{option.name} • {option.source}</option>)}</optgroup>)}
      </select></label>
      <button type="button" onClick={save} disabled={saving || !fromSpellId || !toSpellId}>{saving ? "Memorizing…" : "Memorize Spell"}</button>
    </div> : <div className="character-wizard-memorize__wait">Finish a qualifying Short Rest to replace one prepared level-1+ Wizard spell from your spellbook.</div>}
    {error ? <div className="character-wizard-memorize__error">{error}</div> : null}
    <p>{model?.helper || "Memorize Spell changes preparation only; it never changes spellbook membership."}</p>
    <style jsx global>{`
      .character-wizard-memorize{margin:8px 12px;padding:10px 12px;border:1px solid rgba(115,181,255,.26);border-radius:10px;background:rgba(49,93,145,.08);color:#fff}.character-wizard-memorize__head{display:flex;justify-content:space-between;align-items:center;gap:12px}.character-wizard-memorize__head>div{display:grid;gap:2px}.character-wizard-memorize__head span,.character-wizard-memorize__last span,.character-wizard-memorize__choices label>span{font-size:.59rem;font-weight:850;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.48)}.character-wizard-memorize__head strong{font-size:.8rem;color:#d8ebff}.character-wizard-memorize__head small{font-size:.63rem;color:rgba(255,255,255,.55)}.character-wizard-memorize__last{display:grid;gap:3px;margin-top:8px;padding:8px;border-radius:8px;background:rgba(0,0,0,.15)}.character-wizard-memorize__last strong{font-size:.7rem}.character-wizard-memorize__choices{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;margin-top:8px}.character-wizard-memorize__choices label{display:grid;gap:4px}.character-wizard-memorize__choices select{min-width:0;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#17151c;color:#fff;padding:6px 7px;font-size:.68rem}.character-wizard-memorize__choices button{border:1px solid rgba(115,181,255,.38);border-radius:7px;background:rgba(49,93,145,.17);color:#d8ebff;padding:7px 9px;font-size:.66rem;font-weight:800}.character-wizard-memorize__choices button:disabled{opacity:.45}.character-wizard-memorize__wait{margin-top:8px;padding:8px;border-radius:8px;background:rgba(0,0,0,.14);font-size:.64rem;color:rgba(255,255,255,.62)}.character-wizard-memorize__error{margin-top:8px;color:#ffb5b5;font-size:.66rem}.character-wizard-memorize p{margin:8px 0 0;color:rgba(255,255,255,.56);font-size:.62rem;line-height:1.45}@media(max-width:850px){.character-wizard-memorize__choices{grid-template-columns:1fr}.character-wizard-memorize__choices button{width:100%}}
    `}</style>
  </section>;
}

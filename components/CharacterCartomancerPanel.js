import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const safeText = (value) => String(value ?? "").trim();

function timeLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? safeText(value) : date.toLocaleString();
}

export default function CharacterCartomancerPanel({ characterId }) {
  const [model, setModel] = useState(null);
  const [spellId, setSpellId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadModel() {
    if (!characterId) {
      setModel(null);
      setSpellId("");
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("get_character_cartomancer_v1", {
      p_character_id: characterId,
    });
    if (rpcError) {
      const code = safeText(rpcError.code).toUpperCase();
      if (code !== "42501" && code !== "PGRST202") setError(rpcError.message || "Could not load Cartomancer.");
      setModel(null);
    } else setModel(data && typeof data === "object" ? data : null);
    setLoading(false);
  }

  useEffect(() => {
    setSpellId("");
    loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  const options = useMemo(() => Array.isArray(model?.options) ? model.options : [], [model?.options]);
  const grouped = useMemo(() => {
    const map = new Map();
    for (const option of options) {
      const level = Number(option.level || 0);
      if (!map.has(level)) map.set(level, []);
      map.get(level).push(option);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [options]);

  if (!characterId || (!loading && !error && !model?.available)) return null;

  async function configureHiddenAce() {
    if (!spellId || saving || !model?.instanceKey) return;
    setSaving(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_cartomancer_hidden_ace_v1", {
      p_character_id: characterId,
      p_instance_key: model.instanceKey,
      p_spell_id: spellId,
    });
    if (rpcError) setError(rpcError.message || "Could not configure Hidden Ace.");
    else {
      setModel(data && typeof data === "object" ? data : null);
      setSpellId("");
    }
    setSaving(false);
  }

  const state = model?.state || {};
  const spell = state?.spell || {};
  const active = Boolean(model?.hiddenAceActive);
  const configured = Boolean(model?.hiddenAceConfigured);
  const canConfigure = Boolean(model?.canConfigureHiddenAce);

  return <section className="character-cartomancer" aria-label="Cartomancer">
    <div className="character-cartomancer__head">
      <div><span>Feat runtime</span><strong>Cartomancer</strong></div>
      <small>{loading ? "Loading…" : model?.class?.className || "Spellcasting class"}</small>
    </div>
    <div className="character-cartomancer__cards">
      <div><span>Card Tricks</span><strong>{model?.cardTricksPrestidigitation ? "Prestidigitation learned" : "Prestidigitation missing"}</strong><em>Permanent feat spell</em></div>
      <div><span>Hidden Ace</span><strong>{configured ? `${spell.name || "Selected spell"}${spell.level ? ` • Level ${spell.level}` : ""}` : "No card imbued"}</strong><em>{active ? `Expires ${timeLabel(state.expiresAt)}` : configured ? "The current card is expired or consumed." : canConfigure ? "Long Rest selection is available." : "Finish a qualifying Long Rest to choose."}</em></div>
    </div>
    {canConfigure ? <div className="character-cartomancer__configure">
      <label><span>Hidden Ace spell</span><select value={spellId} onChange={(event) => setSpellId(event.target.value)} disabled={saving}>
        <option value="">Choose a 1-Action class spell…</option>
        {grouped.map(([level, entries]) => <optgroup key={level} label={`Level ${level}`}>{entries.map((option) => <option key={option.spellId} value={option.spellId}>{option.name} • {option.source}</option>)}</optgroup>)}
      </select></label>
      <button type="button" onClick={configureHiddenAce} disabled={saving || !spellId}>{saving ? "Imbuing…" : "Imbue Hidden Ace"}</button>
    </div> : null}
    <div className="character-cartomancer__notice"><strong>Selection authority only.</strong> Hidden Ace Bonus Action casting and card consumption are intentionally deferred to the spell/action execution layer.</div>
    {error ? <div className="character-cartomancer__error">{error}</div> : null}
    <p>{model?.helper || "Hidden Ace is selected after a Long Rest and remains imbued for 8 hours."}</p>
    <style jsx global>{`
      .character-cartomancer{margin:8px 12px;padding:10px 12px;border:1px solid rgba(210,153,255,.26);border-radius:10px;background:rgba(104,57,139,.08);color:#fff}.character-cartomancer__head{display:flex;align-items:center;justify-content:space-between;gap:12px}.character-cartomancer__head>div{display:grid;gap:2px}.character-cartomancer__head span,.character-cartomancer__cards span,.character-cartomancer__configure label>span{font-size:.59rem;font-weight:850;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.48)}.character-cartomancer__head strong{font-size:.8rem;color:#ebd3ff}.character-cartomancer__head small{font-size:.63rem;color:rgba(255,255,255,.55)}.character-cartomancer__cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}.character-cartomancer__cards>div{display:grid;gap:3px;padding:9px;border-radius:8px;background:rgba(0,0,0,.16)}.character-cartomancer__cards strong{font-size:.72rem}.character-cartomancer__cards em{font-size:.61rem;font-style:normal;color:rgba(255,255,255,.55)}.character-cartomancer__configure{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;margin-top:9px;padding:9px;border-radius:8px;background:rgba(0,0,0,.16)}.character-cartomancer__configure label{display:grid;gap:4px}.character-cartomancer__configure select{min-width:0;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#17151c;color:#fff;padding:6px 7px;font-size:.68rem}.character-cartomancer__configure button{border:1px solid rgba(210,153,255,.38);border-radius:7px;background:rgba(104,57,139,.17);color:#ebd3ff;padding:7px 9px;font-size:.66rem;font-weight:800}.character-cartomancer__configure button:disabled{opacity:.45}.character-cartomancer__notice{margin-top:8px;padding:7px 9px;border-radius:7px;background:rgba(255,205,92,.08);color:rgba(255,255,255,.66);font-size:.62rem}.character-cartomancer__notice strong{color:#ffe1a0}.character-cartomancer__error{margin-top:8px;color:#ffb5b5;font-size:.66rem}.character-cartomancer p{margin:8px 0 0;color:rgba(255,255,255,.56);font-size:.62rem;line-height:1.45}@media(max-width:800px){.character-cartomancer__cards,.character-cartomancer__configure{grid-template-columns:1fr}.character-cartomancer__configure button{width:100%}}
    `}</style>
  </section>;
}

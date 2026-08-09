import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const safeText = (value) => String(value ?? "").trim();

export default function CharacterBoonEnergyResistancePanel({ characterId }) {
  const [model, setModel] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");

  async function loadModel() {
    if (!characterId) {
      setModel(null);
      setDrafts({});
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("get_character_boon_energy_resistance_v1", {
      p_character_id: characterId,
    });
    if (rpcError) {
      const code = safeText(rpcError.code).toUpperCase();
      if (code !== "42501" && code !== "PGRST202") setError(rpcError.message || "Could not load Boon of Energy Resistance.");
      setModel(null);
      setDrafts({});
    } else {
      const next = data && typeof data === "object" ? data : null;
      setModel(next);
      const nextDrafts = {};
      for (const instance of Array.isArray(next?.instances) ? next.instances : []) {
        const selected = Array.isArray(instance?.state?.resistances) ? instance.state.resistances : [];
        nextDrafts[instance.instanceKey] = [selected[0] || "", selected[1] || ""];
      }
      setDrafts(nextDrafts);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  const options = useMemo(() => Array.isArray(model?.options) ? model.options : [], [model?.options]);
  if (!characterId || (!loading && !error && !model?.available)) return null;

  function setChoice(instanceKey, index, value) {
    setDrafts((current) => {
      const pair = Array.isArray(current?.[instanceKey]) ? [...current[instanceKey]] : ["", ""];
      pair[index] = value;
      return { ...current, [instanceKey]: pair };
    });
  }

  async function saveInstance(instance) {
    const pair = Array.isArray(drafts?.[instance.instanceKey]) ? drafts[instance.instanceKey].map(safeText) : [];
    if (pair.length !== 2 || pair.some((value) => !value) || pair[0] === pair[1]) {
      setError("Choose two different Energy Resistances.");
      return;
    }
    setSavingKey(instance.instanceKey);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_boon_energy_resistance_v1", {
      p_character_id: characterId,
      p_instance_key: instance.instanceKey,
      p_damage_types: pair,
    });
    if (rpcError) {
      setError(rpcError.message || "Could not change Boon of Energy Resistance.");
    } else {
      setModel(data || null);
      const refreshed = (data?.instances || []).find((row) => row.instanceKey === instance.instanceKey);
      const selected = Array.isArray(refreshed?.state?.resistances) ? refreshed.state.resistances : pair;
      setDrafts((current) => ({ ...current, [instance.instanceKey]: [selected[0] || "", selected[1] || ""] }));
    }
    setSavingKey("");
  }

  return <section className="character-boon-energy-resistance" aria-label="Boon of Energy Resistance">
    <div className="character-boon-energy-resistance__head">
      <div><span>Epic Boon runtime</span><strong>Boon of Energy Resistance</strong></div>
      <small>{loading ? "Loading…" : "Two current resistances"}</small>
    </div>
    {(Array.isArray(model?.instances) ? model.instances : []).map((instance) => {
      const pair = Array.isArray(drafts?.[instance.instanceKey]) ? drafts[instance.instanceKey] : ["", ""];
      const current = Array.isArray(instance?.state?.resistanceNames) ? instance.state.resistanceNames.join(" + ") : "Not configured";
      const canSave = Boolean(instance?.canConfigure || instance?.canReplace);
      return <div className="character-boon-energy-resistance__instance" key={instance.instanceKey}>
        <div className="character-boon-energy-resistance__status">
          <span>Current</span><strong>{current}</strong>
          <em>{instance.canReplace ? "A newer Long Rest is available for replacement." : instance.configured ? "Finish a newer Long Rest to change these choices." : "Choose the initial resistance pair."}</em>
        </div>
        <div className="character-boon-energy-resistance__choices">
          {[0, 1].map((index) => <label key={index}>
            <span>Resistance {index + 1}</span>
            <select value={pair[index] || ""} onChange={(event) => setChoice(instance.instanceKey, index, event.target.value)} disabled={!canSave || savingKey === instance.instanceKey}>
              <option value="">Choose damage type</option>
              {options.map((option) => <option key={option.key} value={option.key} disabled={pair[1 - index] === option.key}>{option.name}</option>)}
            </select>
          </label>)}
          <button type="button" onClick={() => saveInstance(instance)} disabled={!canSave || savingKey === instance.instanceKey || !pair[0] || !pair[1] || pair[0] === pair[1]}>
            {savingKey === instance.instanceKey ? "Saving…" : instance.configured ? "Replace Resistances" : "Set Resistances"}
          </button>
        </div>
      </div>;
    })}
    {error ? <div className="character-boon-energy-resistance__error">{error}</div> : null}
    <p>{model?.helper || "Choose two resistances. After a newer Long Rest, both may be changed together."}</p>
    <style jsx global>{`
      .character-boon-energy-resistance{margin:8px 12px;padding:10px 12px;border:1px solid rgba(255,197,92,.28);border-radius:10px;background:rgba(129,82,18,.08);color:#fff}.character-boon-energy-resistance__head{display:flex;align-items:center;justify-content:space-between;gap:12px}.character-boon-energy-resistance__head>div{display:grid;gap:2px}.character-boon-energy-resistance__head span,.character-boon-energy-resistance__status span,.character-boon-energy-resistance__choices label>span{font-size:.59rem;font-weight:850;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.48)}.character-boon-energy-resistance__head strong{font-size:.8rem;color:#ffe0a1}.character-boon-energy-resistance__head small{font-size:.63rem;color:rgba(255,255,255,.55)}.character-boon-energy-resistance__instance{display:grid;grid-template-columns:minmax(180px,.8fr) minmax(320px,1.2fr);gap:10px;margin-top:9px}.character-boon-energy-resistance__status,.character-boon-energy-resistance__choices{padding:9px;border-radius:8px;background:rgba(0,0,0,.16)}.character-boon-energy-resistance__status{display:grid;gap:3px}.character-boon-energy-resistance__status strong{font-size:.73rem}.character-boon-energy-resistance__status em{font-size:.61rem;font-style:normal;color:rgba(255,255,255,.55)}.character-boon-energy-resistance__choices{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end}.character-boon-energy-resistance__choices label{display:grid;gap:4px}.character-boon-energy-resistance__choices select{min-width:0;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#17151c;color:#fff;padding:6px 7px;font-size:.68rem}.character-boon-energy-resistance__choices button{border:1px solid rgba(255,197,92,.36);border-radius:7px;background:rgba(129,82,18,.18);color:#ffe0a1;padding:7px 9px;font-size:.66rem;font-weight:800}.character-boon-energy-resistance__choices button:disabled{opacity:.45}.character-boon-energy-resistance__error{margin-top:8px;color:#ffb5b5;font-size:.66rem}.character-boon-energy-resistance p{margin:8px 0 0;color:rgba(255,255,255,.56);font-size:.62rem;line-height:1.45}@media(max-width:850px){.character-boon-energy-resistance__instance{grid-template-columns:1fr}.character-boon-energy-resistance__choices{grid-template-columns:1fr 1fr}.character-boon-energy-resistance__choices button{grid-column:1/-1}}
    `}</style>
  </section>;
}

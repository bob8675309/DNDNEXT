import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const safeText = (value) => String(value ?? "").trim();

function familyLabel(family = "") {
  return family === "echoing-soul" ? "Echoing Soul" : family === "zhentarim-tactics" ? "Zhentarim Tactics" : "Runtime Expertise";
}

export default function CharacterFeatRuntimeExpertisePanel({ characterId }) {
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
    const { data, error: rpcError } = await supabase.rpc("get_character_feat_runtime_expertise_v1", {
      p_character_id: characterId,
    });
    if (rpcError) {
      const code = safeText(rpcError.code).toUpperCase();
      if (code !== "42501" && code !== "PGRST202") setError(rpcError.message || "Could not load runtime Expertise.");
      setModel(null);
      setDrafts({});
    } else {
      const next = data && typeof data === "object" ? data : null;
      setModel(next);
      const nextDrafts = {};
      for (const instance of Array.isArray(next?.instances) ? next.instances : []) {
        nextDrafts[instance.instanceKey] = safeText(instance?.state?.skill?.key);
      }
      setDrafts(nextDrafts);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  const skillOptions = useMemo(() => Array.isArray(model?.skillOptions) ? model.skillOptions : [], [model?.skillOptions]);
  if (!characterId || (!loading && !error && !model?.available)) return null;

  async function save(instance) {
    const skillKey = safeText(drafts?.[instance.instanceKey]);
    if (!skillKey) {
      setError("Choose a proficient skill for Expertise.");
      return;
    }
    setSavingKey(instance.instanceKey);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_feat_runtime_expertise_v1", {
      p_character_id: characterId,
      p_instance_key: instance.instanceKey,
      p_skill_key: skillKey,
    });
    if (rpcError) {
      setError(rpcError.message || "Could not configure runtime Expertise.");
    } else {
      const next = data && typeof data === "object" ? data : null;
      setModel(next);
      const refreshed = (next?.instances || []).find((row) => row.instanceKey === instance.instanceKey);
      setDrafts((current) => ({ ...current, [instance.instanceKey]: safeText(refreshed?.state?.skill?.key || skillKey) }));
    }
    setSavingKey("");
  }

  return <section className="character-feat-runtime-expertise" aria-label="Feat runtime Expertise">
    <div className="character-feat-runtime-expertise__head">
      <div><span>Long-Rest feature choices</span><strong>Runtime Expertise</strong></div>
      <small>{loading ? "Loading…" : "Per feat instance"}</small>
    </div>
    {(Array.isArray(model?.instances) ? model.instances : []).map((instance) => {
      const family = safeText(instance.family);
      const currentKey = safeText(instance?.state?.skill?.key);
      const currentName = safeText(instance?.state?.skill?.name) || "Not configured";
      const draft = safeText(drafts?.[instance.instanceKey]);
      const canSave = Boolean(instance.canConfigure || instance.canReplace);
      const selectable = skillOptions.some((option) => option.key === currentKey)
        ? skillOptions
        : currentKey ? [{ key: currentKey, name: currentName, source: instance.source }, ...skillOptions] : skillOptions;
      const status = family === "echoing-soul"
        ? instance.canReplace
          ? "A newer Long Rest is available for replacement."
          : instance.configured
            ? "This Expertise persists until you change it after a newer Long Rest."
            : "Choose the feat's initial Expertise."
        : instance.configured
          ? "This Expertise lasts until your next Long Rest."
          : instance.canConfigure
            ? "Your completed Long Rest is ready for a new Expertise choice."
            : "Finish a Long Rest after gaining this feat to choose Expertise.";
      return <div className="character-feat-runtime-expertise__instance" key={instance.instanceKey}>
        <div className="character-feat-runtime-expertise__status">
          <span>{familyLabel(family)}</span>
          <strong>{currentName}</strong>
          <em>{status}</em>
        </div>
        <div className="character-feat-runtime-expertise__choice">
          <label><span>Proficient skill</span><select value={draft} onChange={(event) => setDrafts((current) => ({ ...current, [instance.instanceKey]: event.target.value }))} disabled={!canSave || savingKey === instance.instanceKey}>
            <option value="">Choose skill…</option>
            {selectable.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}
          </select></label>
          <button type="button" onClick={() => save(instance)} disabled={!canSave || savingKey === instance.instanceKey || !draft}>
            {savingKey === instance.instanceKey ? "Saving…" : instance.configured ? "Change Expertise" : "Set Expertise"}
          </button>
        </div>
      </div>;
    })}
    {error ? <div className="character-feat-runtime-expertise__error">{error}</div> : null}
    <p>{model?.helper || "Runtime Expertise uses an existing skill proficiency and never rewrites permanent proficiency choices."}</p>
    <style jsx global>{`
      .character-feat-runtime-expertise{margin:8px 12px;padding:10px 12px;border:1px solid rgba(130,170,255,.28);border-radius:10px;background:rgba(69,87,146,.08);color:#fff}.character-feat-runtime-expertise__head{display:flex;align-items:center;justify-content:space-between;gap:12px}.character-feat-runtime-expertise__head>div{display:grid;gap:2px}.character-feat-runtime-expertise__head span,.character-feat-runtime-expertise__status span,.character-feat-runtime-expertise__choice label>span{font-size:.59rem;font-weight:850;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.48)}.character-feat-runtime-expertise__head strong{font-size:.8rem;color:#d9e5ff}.character-feat-runtime-expertise__head small{font-size:.63rem;color:rgba(255,255,255,.55)}.character-feat-runtime-expertise__instance{display:grid;grid-template-columns:minmax(180px,.9fr) minmax(300px,1.1fr);gap:10px;margin-top:9px}.character-feat-runtime-expertise__status,.character-feat-runtime-expertise__choice{padding:9px;border-radius:8px;background:rgba(0,0,0,.16)}.character-feat-runtime-expertise__status{display:grid;gap:3px}.character-feat-runtime-expertise__status strong{font-size:.73rem}.character-feat-runtime-expertise__status em{font-size:.61rem;font-style:normal;color:rgba(255,255,255,.55)}.character-feat-runtime-expertise__choice{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.character-feat-runtime-expertise__choice label{display:grid;gap:4px}.character-feat-runtime-expertise__choice select{min-width:0;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#17151c;color:#fff;padding:6px 7px;font-size:.68rem}.character-feat-runtime-expertise__choice button{border:1px solid rgba(130,170,255,.38);border-radius:7px;background:rgba(69,87,146,.17);color:#d9e5ff;padding:7px 9px;font-size:.66rem;font-weight:800}.character-feat-runtime-expertise__choice button:disabled{opacity:.45}.character-feat-runtime-expertise__error{margin-top:8px;color:#ffb5b5;font-size:.66rem}.character-feat-runtime-expertise p{margin:8px 0 0;color:rgba(255,255,255,.56);font-size:.62rem;line-height:1.45}@media(max-width:800px){.character-feat-runtime-expertise__instance{grid-template-columns:1fr}.character-feat-runtime-expertise__choice{grid-template-columns:1fr}.character-feat-runtime-expertise__choice button{width:100%}}
    `}</style>
  </section>;
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const safeText = (value) => String(value ?? "").trim();
const list = (value) => Array.isArray(value) ? value : [];

export default function CharacterArmorerArmorModelPanel({ characterId }) {
  const [model, setModel] = useState(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadModel() {
    if (!characterId) {
      setModel(null);
      setSelectedKey("");
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("get_character_armorer_armor_model_v1", {
      p_character_id: characterId,
    });
    if (rpcError) {
      const code = safeText(rpcError.code).toUpperCase();
      if (code !== "42501" && code !== "PGRST202") setError(rpcError.message || "Could not load Armor Model.");
      setModel(null);
    } else {
      const next = data && typeof data === "object" ? data : null;
      setModel(next);
      setSelectedKey(safeText(next?.state?.modelKey));
    }
    setLoading(false);
  }

  useEffect(() => {
    setSelectedKey("");
    loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  const options = list(model?.options);
  const selectedOption = useMemo(
    () => options.find((option) => safeText(option?.key) === selectedKey) || null,
    [options, selectedKey]
  );

  if (!characterId || (!loading && !error && !model?.available)) return null;

  const configured = Boolean(model?.configured);
  const canAct = Boolean(model?.canConfigure || model?.canReplace);
  const hasTools = Boolean(model?.context?.hasSmithsTools);
  const currentKey = safeText(model?.state?.modelKey);

  async function save() {
    if (!selectedKey || !canAct || selectedKey === currentKey || saving) return;
    setSaving(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_armorer_armor_model_v1", {
      p_character_id: characterId,
      p_model_key: selectedKey,
    });
    if (rpcError) setError(rpcError.message || "Could not configure Armor Model.");
    else {
      const next = data && typeof data === "object" ? data : null;
      setModel(next);
      setSelectedKey(safeText(next?.state?.modelKey));
    }
    setSaving(false);
  }

  return <section className="character-armorer-model" aria-label="Armorer Armor Model">
    <div className="character-armorer-model__head">
      <div><span>Armorer runtime</span><strong>Armor Model</strong></div>
      <small>{loading ? "Loading…" : `${safeText(model?.source)} • Artificer ${Number(model?.context?.classLevel || 0) || ""}`}</small>
    </div>

    {configured ? <div className="character-armorer-model__current">
      <span>Current model</span><strong>{model?.state?.modelName || "—"}</strong>
    </div> : null}

    <div className="character-armorer-model__controls">
      <label><span>{configured ? "Change model" : "Choose model"}</span>
        <select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)} disabled={saving || loading || !hasTools}>
          <option value="">Choose Armor Model…</option>
          {options.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}
        </select>
      </label>
      <button type="button" onClick={save} disabled={saving || !canAct || !selectedKey || selectedKey === currentKey}>
        {saving ? "Saving…" : configured ? "Change Model" : "Choose Model"}
      </button>
    </div>

    {!hasTools ? <div className="character-armorer-model__wait">Smith&apos;s Tools must be in this character&apos;s inventory before configuring an Armor Model.</div> : null}
    {hasTools && configured && !model?.canReplace ? <div className="character-armorer-model__wait">Finish a newer Short Rest or Long Rest before changing the current model.</div> : null}
    {selectedOption?.description ? <details className="character-armorer-model__details">
      <summary>{selectedOption.name} details</summary>
      <p>{selectedOption.description}</p>
    </details> : null}
    {error ? <div className="character-armorer-model__error">{error}</div> : null}
    <p className="character-armorer-model__note">The site currently treats Smith&apos;s Tools in inventory as the closest available representation of having the tools in hand. This selector stores the source-backed model only; it does not alter armor inventory or resolve model combat effects.</p>

    <style jsx global>{`
      .character-armorer-model{margin:8px 12px;padding:10px 12px;border:1px solid rgba(113,193,214,.26);border-radius:10px;background:rgba(38,100,119,.08);color:#fff}.character-armorer-model__head{display:flex;justify-content:space-between;align-items:center;gap:12px}.character-armorer-model__head>div{display:grid;gap:2px}.character-armorer-model__head span,.character-armorer-model__current span,.character-armorer-model__controls label>span{font-size:.59rem;font-weight:850;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.48)}.character-armorer-model__head strong{font-size:.8rem;color:#cceff8}.character-armorer-model__head small{font-size:.63rem;color:rgba(255,255,255,.55)}.character-armorer-model__current{display:flex;justify-content:space-between;gap:10px;margin-top:8px;padding:7px 8px;border-radius:8px;background:rgba(0,0,0,.14)}.character-armorer-model__current strong{font-size:.7rem}.character-armorer-model__controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;margin-top:8px}.character-armorer-model__controls label{display:grid;gap:4px}.character-armorer-model__controls select{min-width:0;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#14191b;color:#fff;padding:6px 7px;font-size:.68rem}.character-armorer-model__controls button{border:1px solid rgba(113,193,214,.38);border-radius:7px;background:rgba(38,100,119,.18);color:#cceff8;padding:7px 9px;font-size:.66rem;font-weight:800}.character-armorer-model__controls button:disabled,.character-armorer-model__controls select:disabled{opacity:.45}.character-armorer-model__wait{margin-top:8px;padding:8px;border-radius:8px;background:rgba(0,0,0,.14);font-size:.64rem;color:rgba(255,255,255,.62)}.character-armorer-model__details{margin-top:8px;border-radius:8px;background:rgba(0,0,0,.12);padding:7px 8px}.character-armorer-model__details summary{cursor:pointer;font-size:.65rem;font-weight:800;color:#cceff8}.character-armorer-model__details p{white-space:pre-line;margin:7px 0 0;font-size:.62rem;line-height:1.42;color:rgba(255,255,255,.68)}.character-armorer-model__error{margin-top:8px;color:#ffb5b5;font-size:.66rem}.character-armorer-model__note{margin:8px 0 0;color:rgba(255,255,255,.5);font-size:.6rem;line-height:1.4}@media(max-width:850px){.character-armorer-model__controls{grid-template-columns:1fr}.character-armorer-model__controls button{width:100%}}
    `}</style>
  </section>;
}

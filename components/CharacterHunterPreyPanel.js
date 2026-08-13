import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const safeText = (value) => String(value ?? "").trim();
const list = (value) => Array.isArray(value) ? value : [];

export default function CharacterHunterPreyPanel({ characterId }) {
  const [model, setModel] = useState(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadModel() {
    if (!characterId) { setModel(null); setSelectedKey(""); setError(""); return; }
    setLoading(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("get_character_hunter_prey_v1", { p_character_id: characterId });
    if (rpcError) {
      const code = safeText(rpcError.code).toUpperCase();
      if (code !== "42501" && code !== "PGRST202") setError(rpcError.message || "Could not load Hunter's Prey.");
      setModel(null);
    } else {
      const next = data && typeof data === "object" ? data : null;
      setModel(next);
      setSelectedKey(safeText(next?.state?.preyKey));
    }
    setLoading(false);
  }

  useEffect(() => {
    setSelectedKey("");
    loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  const options = list(model?.options);
  const selectedOption = useMemo(() => options.find((option) => safeText(option?.key) === selectedKey) || null, [options, selectedKey]);
  if (!characterId || (!loading && !error && !model?.available)) return null;

  const configured = Boolean(model?.configured);
  const canAct = Boolean(model?.canConfigure || model?.canReplace);
  const currentKey = configured ? safeText(model?.state?.preyKey) : "";

  async function save() {
    if (!selectedKey || !canAct || selectedKey === currentKey || saving) return;
    setSaving(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_hunter_prey_v1", {
      p_character_id: characterId,
      p_prey_key: selectedKey,
    });
    if (rpcError) setError(rpcError.message || "Could not configure Hunter's Prey.");
    else {
      const next = data && typeof data === "object" ? data : null;
      setModel(next);
      setSelectedKey(safeText(next?.state?.preyKey));
    }
    setSaving(false);
  }

  return <section className="character-hunter-prey" aria-label="Hunter's Prey">
    <div className="character-hunter-prey__head">
      <div><span>XPHB Hunter runtime</span><strong>Hunter&apos;s Prey</strong></div>
      <small>{loading ? "Loading…" : `Ranger ${Number(model?.context?.classLevel || 0) || ""}`}</small>
    </div>
    {configured ? <div className="character-hunter-prey__current"><span>Current option</span><strong>{model?.state?.preyName || "—"}</strong></div> : null}
    <div className="character-hunter-prey__controls">
      <label><span>{configured ? "Change option" : "Choose option"}</span><select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)} disabled={saving || loading || !canAct}><option value="">Choose Hunter&apos;s Prey…</option>{options.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}</select></label>
      <button type="button" onClick={save} disabled={saving || !canAct || !selectedKey || selectedKey === currentKey}>{saving ? "Saving…" : configured ? "Change Prey" : "Choose Prey"}</button>
    </div>
    {configured && !model?.canReplace ? <div className="character-hunter-prey__wait">The current option remains active. Finish a newer Short Rest or Long Rest before changing it.</div> : null}
    {selectedOption?.description ? <details className="character-hunter-prey__details"><summary>{selectedOption.name} details</summary><p>{selectedOption.description}</p></details> : null}
    {error ? <div className="character-hunter-prey__error">{error}</div> : null}
    <p className="character-hunter-prey__note">This panel manages only the XPHB Hunter&apos;s Prey choice. The PHB Hunter&apos;s Prey choice stays permanent Forge/progression authority. Combat effects remain in the feature/action layer and are not resolved here.</p>
    <style jsx global>{`.character-hunter-prey{margin:8px 12px;padding:10px 12px;border:1px solid rgba(197,168,94,.28);border-radius:10px;background:rgba(93,74,28,.09);color:#fff}.character-hunter-prey__head{display:flex;justify-content:space-between;align-items:center;gap:12px}.character-hunter-prey__head>div{display:grid;gap:2px}.character-hunter-prey__head span,.character-hunter-prey__current span,.character-hunter-prey__controls label>span{font-size:.59rem;font-weight:850;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.48)}.character-hunter-prey__head strong{font-size:.8rem;color:#f3dfa5}.character-hunter-prey__head small{font-size:.63rem;color:rgba(255,255,255,.55)}.character-hunter-prey__current{display:flex;justify-content:space-between;gap:10px;margin-top:8px;padding:7px 8px;border-radius:8px;background:rgba(0,0,0,.14)}.character-hunter-prey__current strong{font-size:.7rem;color:#f6e8bc}.character-hunter-prey__controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;margin-top:8px}.character-hunter-prey__controls label{display:grid;gap:4px}.character-hunter-prey__controls select{min-width:0;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#1b1913;color:#fff;padding:6px 7px;font-size:.68rem}.character-hunter-prey__controls button{border:1px solid rgba(197,168,94,.4);border-radius:7px;background:rgba(93,74,28,.22);color:#f3dfa5;padding:7px 9px;font-size:.66rem;font-weight:800}.character-hunter-prey__controls button:disabled,.character-hunter-prey__controls select:disabled{opacity:.45}.character-hunter-prey__wait{margin-top:8px;padding:8px;border-radius:8px;background:rgba(0,0,0,.14);font-size:.64rem;color:rgba(255,255,255,.62)}.character-hunter-prey__details{margin-top:8px;border-radius:8px;background:rgba(0,0,0,.12);padding:7px 8px}.character-hunter-prey__details summary{cursor:pointer;font-size:.65rem;font-weight:800;color:#f3dfa5}.character-hunter-prey__details p{white-space:pre-line;margin:7px 0 0;font-size:.62rem;line-height:1.42;color:rgba(255,255,255,.68)}.character-hunter-prey__error{margin-top:8px;color:#ffb5b5;font-size:.66rem}.character-hunter-prey__note{margin:8px 0 0;color:rgba(255,255,255,.5);font-size:.6rem;line-height:1.4}@media(max-width:850px){.character-hunter-prey__controls{grid-template-columns:1fr}.character-hunter-prey__controls button{width:100%}}`}</style>
  </section>;
}

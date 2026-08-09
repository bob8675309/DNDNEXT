import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const safeText = (value) => String(value ?? "").trim();
const list = (value) => Array.isArray(value) ? value : [];

export default function CharacterWildHeartAspectPanel({ characterId }) {
  const [model, setModel] = useState(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadModel() {
    if (!characterId) { setModel(null); setSelectedKey(""); setError(""); return; }
    setLoading(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("get_character_wild_heart_aspect_v1", { p_character_id: characterId });
    if (rpcError) {
      const code = safeText(rpcError.code).toUpperCase();
      if (code !== "42501" && code !== "PGRST202") setError(rpcError.message || "Could not load Aspect of the Wilds.");
      setModel(null);
    } else {
      const next = data && typeof data === "object" ? data : null;
      setModel(next);
      setSelectedKey(safeText(next?.state?.aspectKey));
    }
    setLoading(false);
  }

  useEffect(() => { setSelectedKey(""); loadModel(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [characterId]);

  const options = list(model?.options);
  const selectedOption = useMemo(() => options.find((option) => safeText(option?.key) === selectedKey) || null, [options, selectedKey]);
  if (!characterId || (!loading && !error && !model?.available)) return null;

  const configured = Boolean(model?.configured);
  const canAct = Boolean(model?.canConfigure || model?.canReplace);
  const currentKey = configured ? safeText(model?.state?.aspectKey) : "";

  async function save() {
    if (!selectedKey || !canAct || selectedKey === currentKey || saving) return;
    setSaving(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_wild_heart_aspect_v1", { p_character_id: characterId, p_aspect_key: selectedKey });
    if (rpcError) setError(rpcError.message || "Could not configure Aspect of the Wilds.");
    else {
      const next = data && typeof data === "object" ? data : null;
      setModel(next);
      setSelectedKey(safeText(next?.state?.aspectKey));
    }
    setSaving(false);
  }

  return <section className="character-wild-heart-aspect" aria-label="Aspect of the Wilds">
    <div className="character-wild-heart-aspect__head"><div><span>Wild Heart runtime</span><strong>Aspect of the Wilds</strong></div><small>{loading ? "Loading…" : `XPHB • Barbarian ${Number(model?.context?.classLevel || 0) || ""}`}</small></div>
    {configured ? <div className="character-wild-heart-aspect__current"><span>Current aspect</span><strong>{model?.state?.aspectName || "—"}</strong></div> : null}
    <div className="character-wild-heart-aspect__controls">
      <label><span>{configured ? "Change aspect" : "Choose aspect"}</span><select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)} disabled={saving || loading || !canAct}><option value="">Choose Aspect…</option>{options.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}</select></label>
      <button type="button" onClick={save} disabled={saving || !canAct || !selectedKey || selectedKey === currentKey}>{saving ? "Saving…" : configured ? "Change Aspect" : "Choose Aspect"}</button>
    </div>
    {configured && !model?.canReplace ? <div className="character-wild-heart-aspect__wait">The current aspect remains active. Finish a newer Long Rest before changing it.</div> : null}
    {selectedOption?.description ? <details className="character-wild-heart-aspect__details"><summary>{selectedOption.name} details</summary><p>{selectedOption.description}</p></details> : null}
    {error ? <div className="character-wild-heart-aspect__error">{error}</div> : null}
    <p className="character-wild-heart-aspect__note">A Long Rest permits a change but does not expire the current aspect. This panel stores the source-backed choice only; it does not rewrite Darkvision, climb/swim speeds, world travel, or tactical movement.</p>
    <style jsx global>{`.character-wild-heart-aspect{margin:8px 12px;padding:10px 12px;border:1px solid rgba(117,190,122,.28);border-radius:10px;background:rgba(47,103,53,.09);color:#fff}.character-wild-heart-aspect__head{display:flex;justify-content:space-between;align-items:center;gap:12px}.character-wild-heart-aspect__head>div{display:grid;gap:2px}.character-wild-heart-aspect__head span,.character-wild-heart-aspect__current span,.character-wild-heart-aspect__controls label>span{font-size:.59rem;font-weight:850;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.48)}.character-wild-heart-aspect__head strong{font-size:.8rem;color:#d8f6d8}.character-wild-heart-aspect__head small{font-size:.63rem;color:rgba(255,255,255,.55)}.character-wild-heart-aspect__current{display:flex;justify-content:space-between;gap:10px;margin-top:8px;padding:7px 8px;border-radius:8px;background:rgba(0,0,0,.14)}.character-wild-heart-aspect__current strong{font-size:.7rem;color:#e0f6e0}.character-wild-heart-aspect__controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;margin-top:8px}.character-wild-heart-aspect__controls label{display:grid;gap:4px}.character-wild-heart-aspect__controls select{min-width:0;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#151a15;color:#fff;padding:6px 7px;font-size:.68rem}.character-wild-heart-aspect__controls button{border:1px solid rgba(117,190,122,.4);border-radius:7px;background:rgba(47,103,53,.22);color:#d8f6d8;padding:7px 9px;font-size:.66rem;font-weight:800}.character-wild-heart-aspect__controls button:disabled,.character-wild-heart-aspect__controls select:disabled{opacity:.45}.character-wild-heart-aspect__wait{margin-top:8px;padding:8px;border-radius:8px;background:rgba(0,0,0,.14);font-size:.64rem;color:rgba(255,255,255,.62)}.character-wild-heart-aspect__details{margin-top:8px;border-radius:8px;background:rgba(0,0,0,.12);padding:7px 8px}.character-wild-heart-aspect__details summary{cursor:pointer;font-size:.65rem;font-weight:800;color:#d8f6d8}.character-wild-heart-aspect__details p{white-space:pre-line;margin:7px 0 0;font-size:.62rem;line-height:1.42;color:rgba(255,255,255,.68)}.character-wild-heart-aspect__error{margin-top:8px;color:#ffb5b5;font-size:.66rem}.character-wild-heart-aspect__note{margin:8px 0 0;color:rgba(255,255,255,.5);font-size:.6rem;line-height:1.4}@media(max-width:850px){.character-wild-heart-aspect__controls{grid-template-columns:1fr}.character-wild-heart-aspect__controls button{width:100%}}`}</style>
  </section>;
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const safeText = (value) => String(value ?? "").trim();
const list = (value) => Array.isArray(value) ? value : [];

export default function CharacterBestialSoulPanel({ characterId }) {
  const [model, setModel] = useState(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadModel() {
    if (!characterId) { setModel(null); setSelectedKey(""); setError(""); return; }
    setLoading(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("get_character_bestial_soul_v1", { p_character_id: characterId });
    if (rpcError) {
      const code = safeText(rpcError.code).toUpperCase();
      if (code !== "42501" && code !== "PGRST202") setError(rpcError.message || "Could not load Bestial Soul.");
      setModel(null);
    } else {
      const next = data && typeof data === "object" ? data : null;
      setModel(next);
      setSelectedKey(next?.active ? safeText(next?.state?.benefitKey) : "");
    }
    setLoading(false);
  }

  useEffect(() => { setSelectedKey(""); loadModel(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [characterId]);

  const options = list(model?.options);
  const selectedOption = useMemo(() => options.find((option) => safeText(option?.key) === selectedKey) || null, [options, selectedKey]);
  if (!characterId || (!loading && !error && !model?.available)) return null;

  const active = Boolean(model?.active);
  const canConfigure = Boolean(model?.canConfigure);
  const expiredName = !active && model?.state?.configured ? safeText(model?.state?.benefitName) : "";

  async function save() {
    if (!selectedKey || !canConfigure || saving) return;
    setSaving(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_bestial_soul_v1", { p_character_id: characterId, p_benefit_key: selectedKey });
    if (rpcError) setError(rpcError.message || "Could not configure Bestial Soul.");
    else {
      const next = data && typeof data === "object" ? data : null;
      setModel(next);
      setSelectedKey(next?.active ? safeText(next?.state?.benefitKey) : "");
    }
    setSaving(false);
  }

  return <section className="character-bestial-soul" aria-label="Bestial Soul adaptation">
    <div className="character-bestial-soul__head"><div><span>Rest adaptation</span><strong>Bestial Soul</strong></div><small>{loading ? "Loading…" : `TCE • PHB Barbarian ${Number(model?.context?.classLevel || 0) || ""}`}</small></div>
    {active ? <div className="character-bestial-soul__current"><span>Active until next Short/Long Rest</span><strong>{model?.state?.benefitName || "—"}</strong></div> : expiredName ? <div className="character-bestial-soul__expired"><span>Expired at latest rest</span><strong>{expiredName}</strong></div> : null}
    {canConfigure ? <div className="character-bestial-soul__controls">
      <label><span>Choose adaptation</span><select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)} disabled={saving || loading}><option value="">Choose Bestial Soul benefit…</option>{options.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}</select></label>
      <button type="button" onClick={save} disabled={saving || !selectedKey}>{saving ? "Saving…" : "Choose Benefit"}</button>
    </div> : <div className="character-bestial-soul__wait">{active ? "This rest's Bestial Soul benefit is already selected." : "Finish a qualifying Short Rest or Long Rest after gaining Bestial Soul to choose an adaptation."}</div>}
    {selectedOption?.description ? <details className="character-bestial-soul__details"><summary>{selectedOption.name} details</summary><p>{selectedOption.description}</p></details> : null}
    {error ? <div className="character-bestial-soul__error">{error}</div> : null}
    <p className="character-bestial-soul__note">The selected adaptation expires at the next Short or Long Rest. This panel stores the source-backed choice only; it does not rewrite base movement values. Bestial Soul&apos;s always-on magical natural-weapon clause remains part of the feature itself.</p>
    <style jsx global>{`.character-bestial-soul{margin:8px 12px;padding:10px 12px;border:1px solid rgba(205,136,82,.28);border-radius:10px;background:rgba(112,62,31,.09);color:#fff}.character-bestial-soul__head{display:flex;justify-content:space-between;align-items:center;gap:12px}.character-bestial-soul__head>div{display:grid;gap:2px}.character-bestial-soul__head span,.character-bestial-soul__current span,.character-bestial-soul__expired span,.character-bestial-soul__controls label>span{font-size:.59rem;font-weight:850;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.48)}.character-bestial-soul__head strong{font-size:.8rem;color:#ffd6b5}.character-bestial-soul__head small{font-size:.63rem;color:rgba(255,255,255,.55)}.character-bestial-soul__current,.character-bestial-soul__expired{display:flex;justify-content:space-between;gap:10px;margin-top:8px;padding:7px 8px;border-radius:8px;background:rgba(0,0,0,.14)}.character-bestial-soul__current strong{font-size:.7rem;color:#ffe2ca}.character-bestial-soul__expired strong{font-size:.7rem;color:rgba(255,255,255,.55)}.character-bestial-soul__controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;margin-top:8px}.character-bestial-soul__controls label{display:grid;gap:4px}.character-bestial-soul__controls select{min-width:0;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#1b1714;color:#fff;padding:6px 7px;font-size:.68rem}.character-bestial-soul__controls button{border:1px solid rgba(205,136,82,.4);border-radius:7px;background:rgba(112,62,31,.22);color:#ffd6b5;padding:7px 9px;font-size:.66rem;font-weight:800}.character-bestial-soul__controls button:disabled,.character-bestial-soul__controls select:disabled{opacity:.45}.character-bestial-soul__wait{margin-top:8px;padding:8px;border-radius:8px;background:rgba(0,0,0,.14);font-size:.64rem;color:rgba(255,255,255,.62)}.character-bestial-soul__details{margin-top:8px;border-radius:8px;background:rgba(0,0,0,.12);padding:7px 8px}.character-bestial-soul__details summary{cursor:pointer;font-size:.65rem;font-weight:800;color:#ffd6b5}.character-bestial-soul__details p{white-space:pre-line;margin:7px 0 0;font-size:.62rem;line-height:1.42;color:rgba(255,255,255,.68)}.character-bestial-soul__error{margin-top:8px;color:#ffb5b5;font-size:.66rem}.character-bestial-soul__note{margin:8px 0 0;color:rgba(255,255,255,.5);font-size:.6rem;line-height:1.4}@media(max-width:850px){.character-bestial-soul__controls{grid-template-columns:1fr}.character-bestial-soul__controls button{width:100%}}`}</style>
  </section>;
}

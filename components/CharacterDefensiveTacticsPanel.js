import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const safeText = (value) => String(value ?? "").trim();
const list = (value) => Array.isArray(value) ? value : [];

export default function CharacterDefensiveTacticsPanel({ characterId }) {
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
    const { data, error: rpcError } = await supabase.rpc("get_character_defensive_tactics_v1", {
      p_character_id: characterId,
    });
    if (rpcError) {
      const code = safeText(rpcError.code).toUpperCase();
      if (code !== "42501" && code !== "PGRST202") setError(rpcError.message || "Could not load Defensive Tactics.");
      setModel(null);
    } else {
      const next = data && typeof data === "object" ? data : null;
      setModel(next);
      setSelectedKey(safeText(next?.state?.tacticKey));
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
  const currentKey = configured ? safeText(model?.state?.tacticKey) : "";

  async function save() {
    if (!selectedKey || !canAct || selectedKey === currentKey || saving) return;
    setSaving(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_defensive_tactics_v1", {
      p_character_id: characterId,
      p_tactic_key: selectedKey,
    });
    if (rpcError) setError(rpcError.message || "Could not configure Defensive Tactics.");
    else {
      const next = data && typeof data === "object" ? data : null;
      setModel(next);
      setSelectedKey(safeText(next?.state?.tacticKey));
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("dndnext:runtime-choice-changed"));
    }
    setSaving(false);
  }

  return <section className="character-defensive-tactics" aria-label="Defensive Tactics">
    <div className="character-defensive-tactics__head">
      <div><span>XPHB Hunter runtime</span><strong>Defensive Tactics</strong></div>
      <small>{loading ? "Loading…" : `Ranger ${Number(model?.context?.classLevel || 0) || ""}`}</small>
    </div>
    {configured ? <div className="character-defensive-tactics__current"><span>Current tactic</span><strong>{model?.state?.tacticName || "—"}</strong></div> : null}
    <div className="character-defensive-tactics__controls">
      <label><span>{configured ? "Change tactic" : "Choose tactic"}</span><select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)} disabled={saving || loading || !canAct}><option value="">Choose Defensive Tactics…</option>{options.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}</select></label>
      <button type="button" onClick={save} disabled={saving || !canAct || !selectedKey || selectedKey === currentKey}>{saving ? "Saving…" : configured ? "Change Tactic" : "Choose Tactic"}</button>
    </div>
    {configured && !model?.canReplace ? <div className="character-defensive-tactics__wait">The current tactic remains active. Finish a newer Short Rest or Long Rest before changing it.</div> : null}
    {selectedOption?.description ? <details className="character-defensive-tactics__details"><summary>{selectedOption.name} details</summary><p>{selectedOption.description}</p></details> : null}
    {error ? <div className="character-defensive-tactics__error">{error}</div> : null}
    <p className="character-defensive-tactics__note">This manages only the XPHB Hunter runtime choice. PHB Defensive Tactics remains a permanent Forge/progression choice.</p>
    <style jsx global>{`.character-defensive-tactics{margin:8px 12px;padding:10px 12px;border:1px solid rgba(121,183,214,.28);border-radius:10px;background:rgba(42,92,119,.09);color:#fff}.character-defensive-tactics__head{display:flex;justify-content:space-between;align-items:center;gap:12px}.character-defensive-tactics__head>div{display:grid;gap:2px}.character-defensive-tactics__head span,.character-defensive-tactics__current span,.character-defensive-tactics__controls label>span{font-size:.59rem;font-weight:850;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.48)}.character-defensive-tactics__head strong{font-size:.8rem;color:#cfeeff}.character-defensive-tactics__head small{font-size:.63rem;color:rgba(255,255,255,.55)}.character-defensive-tactics__current{display:flex;justify-content:space-between;gap:10px;margin-top:8px;padding:7px 8px;border-radius:8px;background:rgba(0,0,0,.14)}.character-defensive-tactics__current strong{font-size:.7rem;color:#def4ff}.character-defensive-tactics__controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;margin-top:8px}.character-defensive-tactics__controls label{display:grid;gap:4px}.character-defensive-tactics__controls select{min-width:0;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#111b21;color:#fff;padding:6px 7px;font-size:.68rem}.character-defensive-tactics__controls button{border:1px solid rgba(121,183,214,.4);border-radius:7px;background:rgba(42,92,119,.22);color:#d9f3ff;padding:7px 9px;font-size:.66rem;font-weight:800}.character-defensive-tactics__controls button:disabled,.character-defensive-tactics__controls select:disabled{opacity:.45}.character-defensive-tactics__wait,.character-defensive-tactics__details{margin-top:8px;padding:8px;border-radius:8px;background:rgba(0,0,0,.14);font-size:.64rem;color:rgba(255,255,255,.62)}.character-defensive-tactics__details summary{cursor:pointer;font-weight:800;color:#cfeeff}.character-defensive-tactics__details p{white-space:pre-line;margin:7px 0 0;font-size:.62rem;line-height:1.42;color:rgba(255,255,255,.68)}.character-defensive-tactics__error{margin-top:8px;color:#ffb5b5;font-size:.66rem}.character-defensive-tactics__note{margin:8px 0 0;color:rgba(255,255,255,.5);font-size:.6rem;line-height:1.4}@media(max-width:850px){.character-defensive-tactics__controls{grid-template-columns:1fr}.character-defensive-tactics__controls button{width:100%}}`}</style>
  </section>;
}

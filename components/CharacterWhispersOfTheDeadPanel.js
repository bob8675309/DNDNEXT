import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const safeText = (value) => String(value ?? "").trim();
const list = (value) => Array.isArray(value) ? value : [];

export default function CharacterWhispersOfTheDeadPanel({ characterId }) {
  const [model, setModel] = useState(null);
  const [kind, setKind] = useState("skill");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadModel() {
    if (!characterId) { setModel(null); setName(""); setError(""); return; }
    setLoading(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("get_character_whispers_of_the_dead_v1", { p_character_id: characterId });
    if (rpcError) {
      const code = safeText(rpcError.code).toUpperCase();
      if (code !== "42501" && code !== "PGRST202") setError(rpcError.message || "Could not load Whispers of the Dead.");
      setModel(null);
    } else { setModel(data && typeof data === "object" ? data : null); setName(""); }
    setLoading(false);
  }

  useEffect(() => {
    setKind("skill"); setName(""); loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  const skillOptions = useMemo(() => list(model?.skillOptions), [model?.skillOptions]);
  const toolOptions = useMemo(() => list(model?.toolOptions), [model?.toolOptions]);
  const options = kind === "tool" ? toolOptions : skillOptions;
  if (!characterId || (!loading && !error && !model?.available)) return null;

  const configured = Boolean(model?.configured);
  const canChoose = Boolean(model?.canConfigure);
  const currentKind = safeText(model?.state?.proficiencyKind);
  const currentName = safeText(model?.state?.proficiencyName);

  async function save() {
    if (!canChoose || !name || saving) return;
    setSaving(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_whispers_of_the_dead_v1", {
      p_character_id: characterId,
      p_kind: kind,
      p_name: name,
    });
    if (rpcError) setError(rpcError.message || "Could not configure Whispers of the Dead.");
    else {
      setModel(data && typeof data === "object" ? data : null); setName("");
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("dndnext:runtime-choice-changed"));
    }
    setSaving(false);
  }

  return <section className="character-whispers" aria-label="Whispers of the Dead">
    <div className="character-whispers__head"><div><span>TCE Phantom runtime</span><strong>Whispers of the Dead</strong></div><small>{loading ? "Loading…" : `Rogue ${Number(model?.context?.classLevel || 0) || ""}`}</small></div>
    {configured ? <div className="character-whispers__current"><span>Borrowed proficiency</span><strong>{currentName || "—"}{currentKind ? ` • ${currentKind}` : ""}</strong></div> : null}
    {canChoose ? <div className="character-whispers__controls">
      <label><span>Proficiency type</span><select value={kind} onChange={(event) => { setKind(event.target.value); setName(""); }} disabled={saving || loading}><option value="skill">Skill</option><option value="tool">Tool</option></select></label>
      <label><span>{configured ? "Replacement proficiency" : "Borrowed proficiency"}</span><select value={name} onChange={(event) => setName(event.target.value)} disabled={saving || loading}><option value="">Choose a {kind}…</option>{options.map((option) => <option key={option.key || `${option.kind}:${option.name}`} value={option.name}>{option.name}</option>)}</select></label>
      <button type="button" onClick={save} disabled={saving || !name}>{saving ? "Saving…" : configured ? "Replace Proficiency" : "Borrow Proficiency"}</button>
    </div> : configured ? <div className="character-whispers__wait">The borrowed proficiency remains active. Finish a newer Short Rest or Long Rest before replacing it.</div> : <div className="character-whispers__wait">Finish a Short Rest or Long Rest after gaining this feature before choosing the borrowed proficiency.</div>}
    {error ? <div className="character-whispers__error">{error}</div> : null}
    <p className="character-whispers__note">The borrowed proficiency is a runtime overlay. Permanent skill and tool Training arrays are never rewritten.</p>
    <style jsx global>{`.character-whispers{margin:8px 12px;padding:10px 12px;border:1px solid rgba(183,142,220,.28);border-radius:10px;background:rgba(87,49,119,.09);color:#fff}.character-whispers__head{display:flex;justify-content:space-between;align-items:center;gap:12px}.character-whispers__head>div{display:grid;gap:2px}.character-whispers__head span,.character-whispers__current span,.character-whispers__controls label>span{font-size:.59rem;font-weight:850;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.48)}.character-whispers__head strong{font-size:.8rem;color:#efd8ff}.character-whispers__head small{font-size:.63rem;color:rgba(255,255,255,.55)}.character-whispers__current{display:flex;justify-content:space-between;gap:10px;margin-top:8px;padding:7px 8px;border-radius:8px;background:rgba(0,0,0,.14)}.character-whispers__current strong{font-size:.7rem;color:#f3e4ff}.character-whispers__controls{display:grid;grid-template-columns:minmax(110px,.35fr) minmax(0,1fr) auto;gap:8px;align-items:end;margin-top:8px}.character-whispers__controls label{display:grid;gap:4px}.character-whispers__controls select{min-width:0;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#18121d;color:#fff;padding:6px 7px;font-size:.68rem}.character-whispers__controls button{border:1px solid rgba(183,142,220,.42);border-radius:7px;background:rgba(87,49,119,.22);color:#efd8ff;padding:7px 9px;font-size:.66rem;font-weight:800}.character-whispers__controls button:disabled,.character-whispers__controls select:disabled{opacity:.45}.character-whispers__wait{margin-top:8px;padding:8px;border-radius:8px;background:rgba(0,0,0,.14);font-size:.64rem;color:rgba(255,255,255,.62)}.character-whispers__error{margin-top:8px;color:#ffb5b5;font-size:.66rem}.character-whispers__note{margin:8px 0 0;color:rgba(255,255,255,.5);font-size:.6rem;line-height:1.4}@media(max-width:850px){.character-whispers__controls{grid-template-columns:1fr}.character-whispers__controls button{width:100%}}`}</style>
  </section>;
}

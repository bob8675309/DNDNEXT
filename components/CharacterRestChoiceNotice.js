import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const safeText = (value) => String(value ?? "").trim();
const list = (value) => Array.isArray(value) ? value : [];

function cadenceLabel(value) {
  const normalized = safeText(value).toLowerCase();
  if (normalized === "long_rest") return "Long Rest";
  if (normalized === "short_rest") return "Short Rest";
  if (normalized === "short_or_long_rest") return "Short / Long Rest";
  return "Rest";
}

function ChoiceRows({ rows }) {
  return <div className="character-rest-choice-notice__rows">
    {rows.map((row, index) => <div className="character-rest-choice-notice__row" key={`${row.featureKey || row.featureName}-${index}`}>
      <div className="character-rest-choice-notice__row-head"><strong>{row.featureName || "Runtime choice"}</strong><span>{row.source || "Source"} • {cadenceLabel(row.cadence)}</span></div>
      <p>{row.message}</p>
    </div>)}
  </div>;
}

export default function CharacterRestChoiceNotice({ characterId }) {
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadModel = useCallback(async ({ quiet = false } = {}) => {
    if (!characterId) { setModel(null); setError(""); return; }
    if (!quiet) setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("get_character_pending_rest_choices_v1", { p_character_id: characterId });
    if (rpcError) {
      const code = safeText(rpcError.code).toUpperCase();
      if (code !== "42501" && code !== "PGRST202") setError(rpcError.message || "Could not refresh rest choices.");
      else setError("");
      setModel(null);
    } else {
      setError("");
      setModel(data && typeof data === "object" ? data : null);
    }
    if (!quiet) setLoading(false);
  }, [characterId]);

  useEffect(() => { loadModel(); }, [loadModel]);

  useEffect(() => {
    if (!characterId || typeof window === "undefined") return undefined;
    let active = true;
    const refresh = () => { if (active && document.visibilityState !== "hidden") loadModel({ quiet: true }); };
    const timer = window.setInterval(refresh, 4000);
    window.addEventListener("focus", refresh);
    window.addEventListener("dndnext:runtime-choice-changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("dndnext:runtime-choice-changed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [characterId, loadModel]);

  const needs = useMemo(() => list(model?.needsSelection), [model?.needsSelection]);
  const optional = useMemo(() => list(model?.optionalChanges), [model?.optionalChanges]);
  const actions = useMemo(() => list(model?.availableActions), [model?.availableActions]);
  const hasAny = needs.length || optional.length || actions.length;

  if (!characterId || (!loading && !error && !hasAny)) return null;

  return <section className={`character-rest-choice-notice ${needs.length ? "is-attention" : ""}`} aria-live="polite" aria-label="Post-rest character choices">
    <div className="character-rest-choice-notice__head">
      <div><span>{needs.length ? "Rest choice waiting" : "Post-rest options"}</span><strong>{needs.length ? `${needs.length} benefit${needs.length === 1 ? "" : "s"} need a current rest-cycle choice` : "Optional rest changes are available"}</strong></div>
      <button type="button" onClick={() => loadModel()} disabled={loading} title="Refresh post-rest choices">{loading ? "…" : "↻"}</button>
    </div>
    {needs.length ? <div className="character-rest-choice-notice__urgent"><ChoiceRows rows={needs} /></div> : null}
    {optional.length ? <details className="character-rest-choice-notice__optional"><summary>{optional.length} optional persistent change{optional.length === 1 ? "" : "s"} unlocked</summary><ChoiceRows rows={optional} /></details> : null}
    {actions.length ? <details className="character-rest-choice-notice__optional"><summary>{actions.length} optional post-rest action{actions.length === 1 ? "" : "s"} available</summary><ChoiceRows rows={actions} /></details> : null}
    {error ? <div className="character-rest-choice-notice__error">{error}</div> : null}
    <p className="character-rest-choice-notice__note">Flashing is reserved for benefits that are currently inactive or still need their first rest-backed choice. Persistent selections never flash merely because a rest unlocked an optional replacement.</p>
    <style jsx global>{`.character-rest-choice-notice{margin:8px 12px;padding:10px 12px;border:1px solid rgba(255,209,102,.27);border-radius:10px;background:rgba(121,91,24,.08);color:#fff}.character-rest-choice-notice.is-attention{border-color:rgba(255,209,102,.7);background:rgba(121,91,24,.16);animation:rest-choice-pulse 1.8s ease-in-out infinite}.character-rest-choice-notice__head{display:flex;justify-content:space-between;align-items:center;gap:10px}.character-rest-choice-notice__head>div{display:grid;gap:2px}.character-rest-choice-notice__head span{font-size:.59rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.5)}.character-rest-choice-notice__head strong{font-size:.76rem;color:#ffe7a4}.character-rest-choice-notice__head button{border:1px solid rgba(255,209,102,.32);border-radius:7px;background:rgba(121,91,24,.14);color:#ffe7a4;min-width:30px;height:28px;font-weight:850}.character-rest-choice-notice__urgent{margin-top:8px}.character-rest-choice-notice__rows{display:grid;gap:6px}.character-rest-choice-notice__row{padding:8px;border-radius:8px;background:rgba(0,0,0,.16)}.character-rest-choice-notice__row-head{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.character-rest-choice-notice__row-head strong{font-size:.7rem}.character-rest-choice-notice__row-head span{font-size:.56rem;color:rgba(255,255,255,.47);text-transform:uppercase;letter-spacing:.05em}.character-rest-choice-notice__row p{margin:4px 0 0;font-size:.62rem;line-height:1.42;color:rgba(255,255,255,.67)}.character-rest-choice-notice__optional{margin-top:8px;padding:7px 8px;border-radius:8px;background:rgba(0,0,0,.12)}.character-rest-choice-notice__optional summary{cursor:pointer;font-size:.63rem;font-weight:800;color:#ffe7a4}.character-rest-choice-notice__optional[open] summary{margin-bottom:7px}.character-rest-choice-notice__error{margin-top:8px;color:#ffb5b5;font-size:.65rem}.character-rest-choice-notice__note{margin:8px 0 0;font-size:.58rem;line-height:1.4;color:rgba(255,255,255,.46)}@keyframes rest-choice-pulse{0%,100%{box-shadow:0 0 0 rgba(255,209,102,0)}50%{box-shadow:0 0 18px rgba(255,209,102,.24)}}@media(prefers-reduced-motion:reduce){.character-rest-choice-notice.is-attention{animation:none}}@media(max-width:760px){.character-rest-choice-notice__row-head{align-items:flex-start;flex-direction:column;gap:2px}}`}</style>
  </section>;
}

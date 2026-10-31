import { useMemo, useState } from "react";
import {
  eldritchBlastPlanBeamCount, eldritchBlastPlanCandidates,
  normalizeEldritchBlastPlan, isEldritchBlastPlanComplete,
} from "../../utils/eldritchBlastPlanner.mjs";

// GM-assisted on production. On isolated staging, a callback may cast using
// the authenticated server route; this component has no Supabase access.
export default function EldritchBlastPlanner({
  caster, participants = [], classLevel, spellAttackBonus,
  stagingEnabled = false, canStageCast = false, onCast,
}) {
  const [targetIds, setTargetIds] = useState([]);
  const beamCount = eldritchBlastPlanBeamCount(classLevel);
  const candidates = useMemo(
    () => eldritchBlastPlanCandidates(caster, participants),
    [caster, participants]
  );
  const chosen = normalizeEldritchBlastPlan(targetIds, candidates, beamCount);
  const complete = isEldritchBlastPlanComplete(chosen, candidates, beamCount);
  const hasAttackBonus = Number.isFinite(Number(spellAttackBonus)) && spellAttackBonus != null;
  const stagingAvailable = stagingEnabled && typeof onCast === "function";

  function selectBeam(index, id) {
    if (index < 0 || index >= beamCount) return;
    setTargetIds((current) => {
      const next = normalizeEldritchBlastPlan(current, candidates, beamCount);
      next[index] = candidates.some((p) => p.id === id) ? id : "";
      return next;
    });
  }

  return (
    <section className="eb-planner" aria-label="Eldritch Blast GM-assisted targeting preview">
      <div className="eb-title">
        <strong>Eldritch Blast • Beam Planner</strong>
        <span>{stagingAvailable ? "Isolated staging test" : "GM-assisted only"}</span>
      </div>
      {stagingAvailable
        ? <p>Staging only: the server independently checks every selected target,
          spends the Action and resolves each attack and damage roll.</p>
        : <p>This is a non-casting preview. It makes no dice rolls, spends no Action,
          changes no HP, and sends no request to Supabase.</p>}
      {beamCount ? <>
        <p>{beamCount} independent ranged spell attack{beamCount === 1 ? "" : "s"} • 120 ft. range •
          1d10 Force damage per hit{hasAttackBonus ? ` • displayed spell attack bonus ${spellAttackBonus >= 0 ? "+" : ""}${spellAttackBonus}` : ""}.
          Each beam may target the same or a different creature.</p>
        <div className="eb-beams">
          {chosen.map((id, index) => (
            <label key={index}>
              <span>Beam {index + 1}</span>
              <select
                aria-label={`Eldritch Blast beam ${index + 1} target`}
                value={id}
                onChange={(event) => selectBeam(index, event.target.value)}
              >
                <option value="">Choose shown creature</option>
                {candidates.map((p) => (
                  <option value={p.id} key={p.id}>{p.name} • {p.distanceFt} ft.</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p role="status">{complete
          ? `GM target plan ready: ${chosen.map((id, i) => `beam ${i + 1} → ${candidates.find((p) => p.id === id)?.name || "creature"}`).join("; ")}.`
          : `Select a shown creature for each of the ${beamCount} beams.`}</p>
        {stagingAvailable ? <button type="button" className="eb-cast"
          disabled={!canStageCast || !complete}
          onClick={() => { if (canStageCast && complete) onCast([...chosen]); }}
        >Cast Eldritch Blast — staging only</button> : null}
        {!candidates.length ? <p>No eligible shown creatures within 120 ft.
          Object targeting or exceptional situations require GM adjudication.</p> : null}
      </> : <p>Cannot determine a supported single-class character level;
        target planning requires verified progression.</p>}
      <p>Cover, line of sight, attack rolls, damage affinities, hidden targets,
        and Agonizing Blast's selected-cantrip Charisma modifier remain
        server-authoritative. This planner never applies the invocation.</p>
      <style jsx>{`
        .eb-planner{margin:12px 0;padding:12px;border:1px solid rgba(201,160,246,.35);border-radius:10px;background:rgba(75,52,92,.17)}
        .eb-title{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;align-items:center;font-size:.81rem}
        .eb-title span{font-size:.64rem;color:#edc5ff;border:1px solid rgba(201,160,246,.32);border-radius:999px;padding:3px 7px}
        p{line-height:1.55;font-size:.72rem;color:rgba(255,255,255,.75);margin:10px 0}
        .eb-beams{display:grid;gap:9px;margin:12px 0}
        .eb-beams label{display:grid;gap:5px;font-size:.74rem}
        .eb-beams select{width:100%;padding:8px;background:#101318;color:#f3f0e8;border:1px solid rgba(255,255,255,.22);border-radius:7px}
        .eb-cast{margin:10px 0;padding:10px;width:100%;border:1px solid rgba(171,227,188,.55);background:rgba(37,112,65,.25);color:#e3ffe7;border-radius:8px;cursor:pointer}
        .eb-cast:disabled{opacity:.4;cursor:not-allowed}
      `}</style>
    </section>
  );
}

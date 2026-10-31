// Read-only Eldritch Blast planning helpers. No dice rolls, writes, or RPC.
import { eldritchBlastBeamCount } from "./eldritchBlastRules.mjs";

const isHex = (p) => p && Number.isInteger(Number(p.q)) && Number.isInteger(Number(p.r))
  && p.q != null && p.r != null;

export function eldritchBlastPlanBeamCount(classLevel) {
  return Number.isInteger(classLevel) && classLevel >= 1 && classLevel <= 20
    ? eldritchBlastBeamCount(classLevel)
    : 0;
}

// Preview candidates are intentionally more restrictive than the 2024 spell:
// known, shown, undefeated creature participants only, not objects. Full
// visibility, cover, targeting authority and unusual features remain server-side.
export function eldritchBlastPlanCandidates(caster, participants) {
  if (!caster?.id || !isHex(caster) || !Array.isArray(participants)) return [];
  const q = Number(caster.q);
  const r = Number(caster.r);
  const seen = new Set();
  return participants.flatMap((p) => {
    if (!p?.id || p.is_defeated || p.is_hidden || String(p.id) === String(caster.id)
        || !isHex(p) || seen.has(String(p.id))) return [];
    const dq = Number(p.q) - q;
    const dr = Number(p.r) - r;
    const distanceHex = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
    if (distanceHex > 24) return [];
    seen.add(String(p.id));
    return [{ id: String(p.id), name: String(p.display_name || "Creature"),
      distanceFt: distanceHex * 5 }];
  });
}

// Ordered beam selection is intentional: the same target may be chosen
// multiple times. Invalid/stale ids are cleared when encounter state refreshes.
export function normalizeEldritchBlastPlan(targetIds, candidates, beamCount) {
  const count = Number.isInteger(beamCount) && beamCount >= 1 && beamCount <= 4 ? beamCount : 0;
  const valid = new Set((candidates || []).map((p) => String(p.id)));
  return Array.from({ length: count }, (_, i) => {
    const id = String((Array.isArray(targetIds) ? targetIds[i] : null) || "");
    return valid.has(id) ? id : "";
  });
}

export function isEldritchBlastPlanComplete(targetIds, candidates, beamCount) {
  if (!Number.isInteger(beamCount) || beamCount < 1 || beamCount > 4) return false;
  const plan = normalizeEldritchBlastPlan(targetIds, candidates, beamCount);
  return plan.every(Boolean);
}

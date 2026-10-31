// Experimental staging guard and server result presentation. No network calls.
const PROD_REF = "ucggczovhmauhshvhusx";
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export function isEldritchBlastStagingCastAllowed({enabled,supabaseUrl,stagingProjectRef,vercelEnv}={}) {
 if(enabled!==true || vercelEnv==="production" || typeof supabaseUrl!=="string" ||
    typeof stagingProjectRef!=="string") return false;
 const ref=stagingProjectRef.trim();
 if(!/^[a-z0-9]{20}$/.test(ref) || ref===PROD_REF) return false;
 try {
  const url=new URL(supabaseUrl);
  return url.protocol==="https:" && url.hostname===`${ref}.supabase.co` &&
   url.pathname==="/" && !url.port && !url.search && !url.hash &&
   !url.username && !url.password;
 } catch { return false; }
}
export function buildEldritchBlastStagingRequest({casterId,assignmentId,targetIds,candidates,beamCount,requestId}={}) {
 if(!UUID.test(String(casterId||"")) || !UUID.test(String(assignmentId||"")) ||
    !UUID.test(String(requestId||"")) || !Number.isInteger(beamCount) ||
    beamCount<1 || beamCount>4 || !Array.isArray(targetIds) ||
    targetIds.length!==beamCount || !Array.isArray(candidates)) return null;
 const allowed=new Set(candidates.map(p=>String(p?.id||"")));
 if(targetIds.some(id=>!UUID.test(String(id||"")) || !allowed.has(String(id)))) return null;
 return {p_caster_id:casterId,p_assignment_id:assignmentId,p_target_ids:[...targetIds],p_request_id:requestId};
}
export function summarizeEldritchBlastCast(data) {
 const beams=Array.isArray(data?.beams)?data.beams:[];
 const n=Number(data?.beamCount);
 if(!Number.isInteger(n)||n<1||n>4||beams.length!==n||
    !Array.isArray(data?.targetIds)||data.targetIds.length!==n)
  return "Eldritch Blast response received. Refresh the combat log for the authoritative outcome.";
 const lines=beams.map((b,i)=>{
  const target=typeof b?.targetName==="string"?b.targetName:"Target";
  const total=b?.total!=null?b.total:"?",ac=b?.targetAc!=null?b.targetAc:"?";
  if(!b?.hit)return `Beam ${i+1} → ${target}: miss (${total} vs AC ${ac})`;
  const damage=b?.damage?.damage!=null?b.damage.damage:"?";
  const critical=b?.critical?" • critical":"";
  const agonizing=b?.agonizingBlastApplied
   ? ` • Agonizing Blast ${Number(b.agonizingBlastDamageModifier)>=0?"+":""}${b.agonizingBlastDamageModifier??"?"}`:"";
  return `Beam ${i+1} → ${target}: hit (${total} vs AC ${ac}), ${damage} Force${critical}${agonizing}`;
 });
 return `Eldritch Blast: ${n} independent beam${n===1?"":"s"}. ${lines.join("; ")}. Action spent; see combat log.`;
}

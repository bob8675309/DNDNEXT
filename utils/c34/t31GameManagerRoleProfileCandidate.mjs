// C34 T31 owner-revised, UNMOUNTED game-management permission candidate.
// Admin, GM, DM are equally powerful *within the game*. This is a validated
// display projection, NEVER authorization: each server RPC and RLS policy must
// independently check current signed user_profiles.role.
// The prior T29/T30 merchant-vs-travel split is historical/superseded.
import { NPC_UUID_RE, emptyNpcReaderResult, readNonMapNpcProfileCandidate }
  from "./readNonMapNpcProfileCandidate.mjs";

export const GAME_MANAGER_ROLES = Object.freeze(["admin","gm","dm"]);
const RPC = "c34_game_manager_capabilities_research_v1";
const BOOLEAN_FIELDS = Object.freeze([
  "canEditMerchantStock","canSetPlayerGold","canEditWorldTravel",
  "canReadNpcDossier","canEditCharacterPrivacy","canManageNpcPlayers",
  "canManageCharacterInventory",
]);
const isValidId = id => NPC_UUID_RE.test(String(id||""));
const stillCurrent = opts => typeof opts.isCurrent!=="function" || opts.isCurrent()===true;

export function expectedGameManagementCapabilities(role) {
  const canonical = typeof role==="string"?role:"";
  const allowed = GAME_MANAGER_ROLES.includes(canonical);
  return Object.freeze({
    role:canonical,
    isGameManager:allowed,
    isAdmin:allowed, // legacy *in-game* Admin UIs, never infrastructure.
    canEditMerchantStock:allowed,
    canSetPlayerGold:allowed,
    canEditWorldTravel:allowed,
    canReadNpcDossier:allowed,
    canEditCharacterPrivacy:allowed,
    canManageNpcPlayers:allowed,
    canManageCharacterInventory:allowed,
  });
}
export function validateGameManagementProjection(raw) {
  if(!raw || typeof raw!=="object" || Array.isArray(raw) ||
     typeof raw.role!=="string")return null;
  const expected=expectedGameManagementCapabilities(raw.role);
  if(BOOLEAN_FIELDS.some(key=>typeof raw[key]!=="boolean" || raw[key]!==expected[key]))
    return null;
  return expected;
}
const unavailable = status => Object.freeze({
  status,actorId:null,capabilities:expectedGameManagementCapabilities(""),
});

export async function readTownGameManagerCapabilitiesCandidate(client,opts={}) {
  if(!client?.auth?.getUser || !client?.rpc)return unavailable("unavailable");
  if(!stillCurrent(opts))return unavailable("request-stale");
  const before=await client.auth.getUser();
  const actorId=before?.data?.user?.id;
  if(before.error || !isValidId(actorId))return unavailable("unauthenticated");
  if(!stillCurrent(opts))return unavailable("request-stale");
  const response=await client.rpc(RPC);
  if(response.error)return unavailable("unavailable");
  const capabilities=validateGameManagementProjection(response.data);
  if(!capabilities)return unavailable("invalid-projection");
  const after=await client.auth.getUser();
  if(after.error || after.data?.user?.id!==actorId || !stillCurrent(opts))
    return unavailable("session-changed");
  return Object.freeze({status:"ok",actorId,capabilities});
}
export async function readTownGameManagerNpcProfileCandidate(client,characterId,opts={}) {
  const blank = status => ({
    ...emptyNpcReaderResult(status),
    roleCapabilities:expectedGameManagementCapabilities(""),
  });
  const id=String(characterId||"").trim();
  if(!isValidId(id))return blank("invalid-id");
  const start=await readTownGameManagerCapabilitiesCandidate(client,opts);
  if(start.status!=="ok")return blank(start.status);
  const profile=await readNonMapNpcProfileCandidate(client,id,{
    withDossier:false,
    withSheet:opts.withSheet===true,
    withPrivateBackstory:opts.withPrivateBackstory===true,
  });
  if(profile.status!=="ok" || !stillCurrent(opts))
    return blank(profile.status==="ok"?"request-stale":profile.status);
  let dossier=null;
  if(opts.withDossier===true && start.capabilities.canReadNpcDossier){
    // The ORIGINAL #345 Stage2 RPC verifies the signed caller again using
    // the currently installed server-owned gameplay administrator predicate.
    const result=await client.rpc("get_npc_dossier_admin_v1",{p_character_id:id});
    if(result.error || !result.data ||
       String(result.data.id||"").toLowerCase()!==id.toLowerCase())
      return blank("dossier-unavailable");
    dossier=result.data;
  }
  // Same-actor role changes are possible without a JWT change. Repeat a
  // real server role read before handing back any private or GM-only bytes.
  const end=await readTownGameManagerCapabilitiesCandidate(client,opts);
  if(end.status!=="ok" || start.actorId!==end.actorId ||
     BOOLEAN_FIELDS.some(k=>start.capabilities[k]!==end.capabilities[k]) ||
     start.capabilities.role!==end.capabilities.role)
    return blank("session-or-role-changed");
  return {
    ...profile,status:"ok",dossier,
    roleCapabilities:end.capabilities,
  };
}

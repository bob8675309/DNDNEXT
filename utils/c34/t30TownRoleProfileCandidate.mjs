// C34 T30 research only. Unmounted and not a frontend authorization boundary.
// A signed, server-owned user_profiles role is projected by an ACL-limited RPC.
// Stock, wallet, NPC dossier, sheet, Story and travel actions MUST reauthorize
// on the server. Never use user_metadata, is_admin(uid), or a browser role prop.
import { commerceRoleCapabilities } from "./commerceRolePolicyCandidate.mjs";
import { NPC_UUID_RE, emptyNpcReaderResult, readNonMapNpcProfileCandidate } from "./readNonMapNpcProfileCandidate.mjs";

const CAPABILITY_RPC = "c34_town_role_capabilities_research_v1";
const FIELDS = Object.freeze([
  "canEditMerchantStock", "canSetPlayerGold", "canEditWorldTravel",
  "canReadNpcDossier", "canEditCharacterPrivacy",
]);
const base = () => Object.freeze({
  role: null, isAdmin: false,
  canEditMerchantStock: false, canSetPlayerGold: false,
  canEditWorldTravel: false, canReadNpcDossier: false,
  canEditCharacterPrivacy: false,
});
const denied = status => Object.freeze({ status, actorId: null, capabilities: base() });
const validId = id => NPC_UUID_RE.test(String(id || ""));
const current = options => typeof options.isCurrent !== "function" || options.isCurrent() === true;

// Reject incomplete or contradictory RPC responses. In particular a GM/DM
// must NEVER be presented with a dossier/travel privilege merely because an
// older global is_admin(uid) overload considers non-player roles Admin.
export function validateTownCapabilityProjection(data) {
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      typeof data.role !== "string") return null;
  const role = data.role;
  const intended = commerceRoleCapabilities(role);
  const expected = {
    canEditMerchantStock: intended.canEditMerchantStock,
    canSetPlayerGold: intended.canSetPlayerGold,
    canEditWorldTravel: role === "admin",
    canReadNpcDossier: role === "admin",
    canEditCharacterPrivacy: role === "admin",
  };
  if (FIELDS.some(key => typeof data[key] !== "boolean" || data[key] !== expected[key]))
    return null;
  return Object.freeze({ role, isAdmin: role === "admin", ...expected });
}

export async function readTownRoleCapabilitiesCandidate(client, options = {}) {
  if (!client?.auth?.getUser || !client?.rpc) return denied("unavailable");
  if (!current(options)) return denied("request-stale");
  const first = await client.auth.getUser();
  const actorId = first?.data?.user?.id;
  if (first.error || !validId(actorId)) return denied("unauthenticated");
  if (!current(options)) return denied("request-stale");
  const response = await client.rpc(CAPABILITY_RPC);
  if (response.error) return denied("unavailable");
  const capabilities = validateTownCapabilityProjection(response.data);
  if (!capabilities) return denied("invalid-projection");
  const last = await client.auth.getUser();
  if (last.error || last.data?.user?.id !== actorId || !current(options))
    return denied("session-changed");
  return Object.freeze({ status: "ok", actorId, capabilities });
}

// This is NOT the shared world-map NpcPanel. It reads Stage1 public Profile,
// Stage2 editor projection and optional Stage3 Story through the existing
// source-authenticated T21 reader, then a separate Stage2 Admin-only dossier.
// An explicit non-admin request for dossier is ignored, never attempted.
export async function readTownNpcProfileCandidate(client, characterId, options = {}) {
  const empty = (status, roleCapabilities = base()) => ({
    status, roleCapabilities, ...emptyNpcReaderResult(status),
  });
  const id = String(characterId || "").trim();
  if (!validId(id)) return empty("invalid-id");
  const first = await readTownRoleCapabilitiesCandidate(client, options);
  if (first.status !== "ok") return empty(first.status);
  const npc = await readNonMapNpcProfileCandidate(client, id, {
    withDossier: false,
    withSheet: options.withSheet === true,
    withPrivateBackstory: options.withPrivateBackstory === true,
  });
  if (npc.status !== "ok" || !current(options))
    return empty(npc.status === "ok" ? "request-stale" : npc.status);
  let dossier = null;
  if (options.withDossier === true && first.capabilities.canReadNpcDossier) {
    const response = await client.rpc("get_npc_dossier_admin_v1", { p_character_id: id });
    if (!response.error && response.data &&
        String(response.data.id || "").toLowerCase() === id.toLowerCase())
      dossier = response.data; // separate strict Admin server RPC, never public lore
  }
  // Repeat the server role read to reject same-session demotion during a long
  // Profile/stock request; an auth event's generation callback handles ABA
  // same-user signout/relogin, which auth.getUser() alone cannot detect.
  const last = await readTownRoleCapabilitiesCandidate(client, options);
  if (last.status !== "ok" || first.actorId !== last.actorId ||
      FIELDS.some(key => first.capabilities[key] !== last.capabilities[key]))
    return empty("session-or-role-changed");
  return {
    ...npc, status: "ok", dossier: last.capabilities.canReadNpcDossier ? dossier : null,
    roleCapabilities: last.capabilities,
  };
}

// C34 T23 — NON-ORIGINAL, UNMOUNTED research candidate.
// The active pages/npcs.js and shared map-connected NpcPanel are untouched.
// This is presentation-layer minimization, NEVER a substitute for RLS, ACLs,
// or original #345 stage1/stage2/3 server-authorized RPC checks.

const NPC_OR_MERCHANT_FIELDS = Object.freeze([
  "id", "name", "kind", "race", "role", "affiliation", "status",
  "location_id", "last_known_location_id", "projected_destination_id",
  "tags", "description", "map_icon_id",
  "portrait_url", "portrait_storage_path", "portrait_thumb_url",
  "portrait_shop_url", "portrait_source", "image_url",
  "sprite_path", "sprite_scale", "camp_sprite_path", "updated_at",
  "is_hidden", "x", "y", "roaming_speed",
  "state", "route_mode", "storefront_enabled"
]);
const EDITOR_FIELDS = Object.freeze([
  "id", "background", "motivation", "quirk", "mannerism", "voice"
]);
const EMPTY_RIGHTS = Object.freeze({
  can_edit: false, can_inventory: false, can_convert: false
});

const sameId = (left, right) =>
  typeof left === "string" && left.length > 0 &&
  typeof right === "string" && right.length > 0 &&
  left.toLowerCase() === right.toLowerCase();

const plainRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function pickFields(input, allowed) {
  const result = {};
  for (const field of allowed) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      result[field] = input[field];
    }
  }
  return result;
}

// Both NPC and merchant rosters are basic PUBLIC projections. Never carry
// private characters.background/motivation/quirk/mannerism/voice or legacy
// bulk-loaded get_character_secrets_v1 into any roster-derived UI.
export function projectNonMapManagerRosterRow(input, expectedKind) {
  if (!plainRecord(input) || !["npc", "merchant"].includes(expectedKind) ||
      !sameId(input.id, input.id) || input.kind !== expectedKind) {
    return null;
  }
  const row = pickFields(input, NPC_OR_MERCHANT_FIELDS);
  row.status = row.is_hidden === true ? "hidden" : row.status || "alive";
  return row;
}

// Client-side display gate only; DB is the sole authority to grant rights.
// Unlike the held #345 display guard, BOTH selected character and actor must
// match the identity on the originally fetched grant.
export function selectedManagerDisplayRights(grant, selectedId, actorId) {
  if (!plainRecord(grant) ||
      !sameId(grant.character_id, selectedId) ||
      !sameId(grant.user_id, actorId)) {
    return { ...EMPTY_RIGHTS };
  }
  return {
    can_edit: grant.can_edit === true,
    can_inventory: grant.can_inventory === true,
    can_convert: grant.can_convert === true
  };
}

// Check every asynchronous response against BOTH request identities and the
// actual record identity before it can be accepted into selected-only state.
// Caller must clear privileged state synchronously when either identity
// changes, including SIGNED_OUT and USER_UPDATED.
export function isCurrentManagerPrivateResponse({
  selectedId, requestSelectedId, actorId, requestActorId, row
}) {
  return sameId(selectedId, requestSelectedId) &&
    sameId(actorId, requestActorId) && plainRecord(row) &&
    sameId(row.id, selectedId);
}

// The original editor RPC permits these five narrative values but NEVER
// returns GM Secret; do not spread the server or stale roster response into
// an editable/printable editor model.
export function projectSelectedEditorNarrative(args) {
  if (!isCurrentManagerPrivateResponse(args)) return null;
  return pickFields(args.row, EDITOR_FIELDS);
}

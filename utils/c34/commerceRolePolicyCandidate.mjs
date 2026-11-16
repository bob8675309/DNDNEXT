// C34 T29 REVIEW-ONLY commerce capability matrix, not an authorization system.
// The database must check the signed auth.uid() against server-owned user_profiles
// for every mutating RPC and character_stock RLS policy. Never trust browser values.
export const COMMERCE_MANAGER_ROLES = Object.freeze(["admin", "gm", "dm"]);

// Intentionally exact, canonical, lowercase database values. Unknown or typoed
// roles fail CLOSED instead of allowing every unspecified non-player role.
export function commerceRoleCapabilities(canonicalDatabaseRole) {
  const role = typeof canonicalDatabaseRole === "string" ? canonicalDatabaseRole : "";
  const canManageCommerce = COMMERCE_MANAGER_ROLES.includes(role);
  return Object.freeze({
    canViewPublicStock: true, // still subject to signed/visible-merchant RLS
    canEditMerchantStock: canManageCommerce,
    canSetPlayerGold: canManageCommerce,
    canEditWorldTravel: role === "admin", // no implicit expansion to GM/DM
    canEditCharacterPrivacy: role === "admin",
  });
}

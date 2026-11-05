// Shared NPC/merchant Profile entry point for pages without a local profile host.
// Map and town keep their existing Profile controller and use the same shared
// CharacterInteractionPanel. Inventory and future NPC links use this event.
export const OPEN_NPC_PROFILE_EVENT = "dndnext:open-npc-profile";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function openNpcProfile(characterId) {
  const id = String(characterId?.id || characterId || "").trim();
  if (typeof window === "undefined" || !UUID_PATTERN.test(id)) return false;
  window.dispatchEvent(new CustomEvent(OPEN_NPC_PROFILE_EVENT, {
    detail: { characterId: id },
  }));
  return true;
}

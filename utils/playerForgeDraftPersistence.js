const PLAYER_FORGE_DRAFT_STORAGE_KEY = "dndnext:player-character-forge:draft:v1";
const playerForgeDraftStorageKey = (scope = "") => `${PLAYER_FORGE_DRAFT_STORAGE_KEY}:${String(scope || "default")}`;
const PLAYER_FORGE_DRAFT_VERSION = 1;

function storageAvailable() {
  return typeof window !== "undefined" && window.localStorage;
}

export function readPlayerForgeDraft(scope = "") {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(playerForgeDraftStorageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Number(parsed.version || 0) !== PLAYER_FORGE_DRAFT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePlayerForgeDraft(patch = {}, scope = "") {
  if (!storageAvailable()) return;
  try {
    const current = readPlayerForgeDraft(scope) || { version: PLAYER_FORGE_DRAFT_VERSION };
    const next = {
      ...current,
      ...patch,
      version: PLAYER_FORGE_DRAFT_VERSION,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(playerForgeDraftStorageKey(scope), JSON.stringify(next));
  } catch {
    // Character Forge must remain usable even if browser storage is unavailable/full.
  }
}

export function clearPlayerForgeDraft(scope = "") {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(playerForgeDraftStorageKey(scope));
  } catch {
    // Reset/create should still succeed even when storage cannot be changed.
  }
}

export { PLAYER_FORGE_DRAFT_STORAGE_KEY };

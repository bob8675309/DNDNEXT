const PLAYER_FORGE_DRAFT_STORAGE_KEY = "dndnext:player-character-forge:draft:v1";
const PLAYER_FORGE_DRAFT_VERSION = 1;

function storageAvailable() {
  return typeof window !== "undefined" && window.localStorage;
}

export function readPlayerForgeDraft() {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(PLAYER_FORGE_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Number(parsed.version || 0) !== PLAYER_FORGE_DRAFT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePlayerForgeDraft(patch = {}) {
  if (!storageAvailable()) return;
  try {
    const current = readPlayerForgeDraft() || { version: PLAYER_FORGE_DRAFT_VERSION };
    const next = {
      ...current,
      ...patch,
      version: PLAYER_FORGE_DRAFT_VERSION,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(PLAYER_FORGE_DRAFT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Character Forge must remain usable even if browser storage is unavailable/full.
  }
}

export function clearPlayerForgeDraft() {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(PLAYER_FORGE_DRAFT_STORAGE_KEY);
  } catch {
    // Reset/create should still succeed even when storage cannot be changed.
  }
}

export { PLAYER_FORGE_DRAFT_STORAGE_KEY };

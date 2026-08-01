export function normalizeCharacterIdentity(value) {
  return String(value ?? "").trim();
}

export function characterIdentityChanged(previousIdentity, nextIdentity) {
  return normalizeCharacterIdentity(previousIdentity) !== normalizeCharacterIdentity(nextIdentity);
}

export function isCurrentCharacterSheetRequest({
  activeCharacterId,
  requestedCharacterId,
  activeRequestId,
  requestId,
} = {}) {
  return Number(activeRequestId) === Number(requestId)
    && normalizeCharacterIdentity(activeCharacterId) === normalizeCharacterIdentity(requestedCharacterId);
}

export function normalizeNpcSelectionKey(value) {
  return String(value ?? "").trim();
}

export function isCurrentNpcSelectionRequest({
  activeKey,
  requestedKey,
  activeRequestId,
  requestId,
} = {}) {
  return Number(activeRequestId) === Number(requestId)
    && normalizeNpcSelectionKey(activeKey) === normalizeNpcSelectionKey(requestedKey);
}

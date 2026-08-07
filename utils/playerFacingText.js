function safeText(value) {
  return String(value ?? "").trim();
}

function isSourceCode(value) {
  return /^[A-Z][A-Z0-9]{1,11}$/.test(safeText(value));
}

function isFeatureLevel(value) {
  return /^\d{1,2}$/.test(safeText(value));
}

function isInternalReferenceLine(value) {
  const parts = safeText(value).split("|").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 4 || parts.length > 8) return false;
  const penultimate = parts.at(-2) || "";
  const last = parts.at(-1) || "";
  const tailLooksInternal = (isSourceCode(penultimate) && isFeatureLevel(last))
    || (isFeatureLevel(penultimate) && isSourceCode(last));
  if (!tailLooksInternal) return false;
  return parts.slice(1).some(isSourceCode);
}

function cleanInlineMarkup(value) {
  return safeText(value)
    .replace(/\{@(?:damage|dice|hit|chance)\s+([^}|]+)(?:\|[^}]*)?}/gi, "$1")
    .replace(/\{@(?:spell|item|creature|condition|skill|action|sense|language|race|class|subclass|feat|filter|book|adventure|variantrule)\s+([^}|]+)(?:\|[^}]*)?}/gi, "$1")
    .replace(/\{@(?:b|i|u|note|atk|h|dc)\s+([^}]*)}/gi, "$1")
    .replace(/\{@[a-zA-Z]+\s+([^}]*)}/g, "$1")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function formatPlayerFacingText(value, fallback = "") {
  const lines = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(cleanInlineMarkup)
    .filter((line) => !isInternalReferenceLine(line));

  const cleaned = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned || fallback;
}

export function formatPlayerFacingInline(value, fallback = "") {
  const cleaned = formatPlayerFacingText(value, fallback);
  return cleaned.replace(/\s*\n+\s*/g, " ").replace(/\s+/g, " ").trim();
}

export { isInternalReferenceLine };

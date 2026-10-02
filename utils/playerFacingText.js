function safeText(value) {
  return String(value ?? "").trim();
}

function isSourceCode(value) {
  return /^[A-Z][A-Z0-9]{1,23}$/i.test(safeText(value));
}

function isFeatureLevel(value) {
  return /^\d{1,2}$/.test(safeText(value));
}

function isInternalReferenceLine(value) {
  const rawParts = safeText(value).split("|").map((part) => part.trim());
  if (rawParts.length === 2) {
    const source = rawParts[1];
    return Boolean(rawParts[0] && source && /^[A-Za-z][A-Za-z0-9]{1,23}$/.test(source) && /[A-Z]/.test(source));
  }
  if (rawParts.length < 4 || rawParts.length > 8) return false;
  if (!rawParts[0] || !rawParts.slice(1).some(isFeatureLevel)) return false;
  return rawParts.slice(1).some((part) => isSourceCode(part) || part === "");
}

function internalReferenceLabel(value) {
  return safeText(value).split("|")[0]?.trim() || "";
}

function cleanInlineMarkup(value) {
  return safeText(value)
    .replace(/\{@(?:damage|dice|hit|chance)\s+([^}|]+)(?:\|[^}]*)?}/gi, "$1")
    .replace(/\{@(?:spell|item|creature|condition|skill|action|sense|language|race|class|subclass|feat|filter|book|adventure|variantrule)\s+([^}|]+)(?:\|[^}]*)?}/gi, "$1")
    .replace(/\{@(?:b|i|u|note|atk|h|dc)\s+([^}]*)}/gi, "$1")
    .replace(/\{@[a-zA-Z0-9]+\s+([^}|]+)(?:\|[^}]*)?}/g, "$1")
    .replace(/\s*\[(?:Area of Effect|Attitude)\]/gi, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function formatPlayerFacingText(value, fallback = "") {
  const lines = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => isInternalReferenceLine(line) ? internalReferenceLabel(line) : line)
    .map(cleanInlineMarkup);

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

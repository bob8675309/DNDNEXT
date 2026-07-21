function safeText(value) {
  return String(value ?? "").trim();
}

function isInternalReferenceLine(value) {
  const parts = safeText(value).split("|").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 4 || parts.length > 7) return false;
  const source = parts.at(-2) || "";
  const level = parts.at(-1) || "";
  return /^[A-Z0-9]{2,12}$/.test(source) && /^\d{1,2}$/.test(level);
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

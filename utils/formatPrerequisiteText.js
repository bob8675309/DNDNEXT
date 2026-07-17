function safeText(value) {
  return String(value ?? "").trim();
}

function titleCase(value) {
  return safeText(value)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayReference(value) {
  const parts = safeText(value).split("|").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return "";
  const sourceLike = /^[A-Z0-9]{2,8}$/i;
  const candidates = parts.filter((part, index) => index === 0 || !sourceLike.test(part));
  const chosen = candidates[candidates.length - 1] || parts[0];
  return titleCase(chosen);
}

function formatLevel(value) {
  if (typeof value === "number" || /^\d+$/.test(safeText(value))) return `Level ${Number(value)}`;
  if (!value || typeof value !== "object") return "";
  const level = Number(value.level || value.value || 0);
  const className = safeText(value.class?.name || value.className || value.class);
  return level > 0 ? `${className ? `${className} ` : ""}Level ${level}` : "";
}

function formatAbility(value) {
  if (Array.isArray(value)) return value.map(formatAbility).filter(Boolean).join(" or ");
  if (!value || typeof value !== "object") return titleCase(value);
  return Object.entries(value)
    .map(([ability, score]) => `${titleCase(ability)} ${Number(score) || score}`)
    .join(" or ");
}

function formatEntry(key, value) {
  const labelMap = {
    level: "",
    feat: "Feat",
    race: "Species",
    species: "Species",
    class: "Class",
    background: "Background",
    spellcasting: "Spellcasting",
    ability: "Ability",
    proficiency: "Proficiency",
    campaign: "Campaign",
    other: "Requirement",
  };

  if (key === "level") return formatLevel(value);
  if (key === "ability") {
    const text = formatAbility(value);
    return text ? `Ability: ${text}` : "";
  }

  let text = "";
  if (Array.isArray(value)) text = value.map((item) => formatValue(item)).filter(Boolean).join(" or ");
  else if (value && typeof value === "object") text = formatValue(value);
  else text = displayReference(value);

  if (!text) return "";
  const label = labelMap[key] ?? titleCase(key);
  return label ? `${label}: ${text}` : text;
}

function formatValue(value) {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join("; ");
  if (typeof value !== "object") return displayReference(value);
  return Object.entries(value).map(([key, entry]) => formatEntry(key, entry)).filter(Boolean).join("; ");
}

export function formatPrerequisiteText(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object") return formatValue(value);

  const raw = safeText(value);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return formatValue(parsed) || raw;
  } catch {
    return raw
      .replace(/\{@[^\s}]+\s+([^}|]+)(?:\|[^}]*)?}/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }
}

export default formatPrerequisiteText;

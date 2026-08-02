function safeText(value) {
  return String(value ?? "").trim();
}

export function normalizeCharacterOptionName(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueText(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(safeText).filter(Boolean))];
}

export function mergeKnownCharacterOptions({ catalog = [], grants = [], sheetFeats = [] } = {}) {
  const catalogRows = Array.isArray(catalog) ? catalog : [];
  const catalogById = new Map(catalogRows.map((row) => [String(row?.id || ""), row]));
  const catalogByIdentity = new Map();
  for (const row of catalogRows) {
    const optionType = safeText(row?.option_type || "feat") || "feat";
    const identity = `${optionType}:${normalizeCharacterOptionName(row?.name)}`;
    if (!identity.endsWith(":")) catalogByIdentity.set(identity, row);
  }

  const knownByIdentity = new Map();
  for (const name of uniqueText(sheetFeats)) {
    const identity = `feat:${normalizeCharacterOptionName(name)}`;
    if (identity.endsWith(":")) continue;
    const catalogRow = catalogByIdentity.get(identity) || null;
    knownByIdentity.set(identity, {
      ...(catalogRow || {}),
      knownKey: `known:${identity}`,
      catalogId: catalogRow?.id || null,
      option_type: "feat",
      name,
      source: catalogRow?.source || "Sheet",
      origin: "Origin, level, or creation feat",
      origins: ["Origin, level, or creation feat"],
      sheetBacked: true,
      removable: false,
    });
  }

  for (const grant of Array.isArray(grants) ? grants : []) {
    const optionType = safeText(grant?.optionType || grant?.option_type || "feat") || "feat";
    const name = safeText(grant?.name);
    const identity = `${optionType}:${normalizeCharacterOptionName(name)}`;
    if (!name || identity.endsWith(":")) continue;
    const catalogRow = catalogById.get(String(grant?.optionId || grant?.option_id || ""))
      || catalogByIdentity.get(identity)
      || null;
    const grantOrigin = grant?.notes ? `Game Master grant • ${safeText(grant.notes)}` : "Game Master grant";
    const existing = knownByIdentity.get(identity);
    const origins = uniqueText([...(existing?.origins || []), grantOrigin]);
    knownByIdentity.set(identity, {
      ...(catalogRow || {}),
      ...(existing || {}),
      ...grant,
      knownKey: `known:${identity}`,
      grantId: grant?.id || existing?.grantId || null,
      catalogId: catalogRow?.id || grant?.optionId || grant?.option_id || existing?.catalogId || null,
      option_type: optionType,
      name,
      source: grant?.source || catalogRow?.source || existing?.source || "Campaign",
      description: grant?.description || catalogRow?.description || existing?.description || "",
      prerequisite_text: grant?.prerequisiteText || grant?.prerequisite_text || catalogRow?.prerequisite_text || existing?.prerequisite_text || "",
      origin: origins.join(" • "),
      origins,
      sheetBacked: Boolean(existing?.sheetBacked),
      // A sheet-backed feat remains known even if only its duplicate grant row is removed.
      // Keep removal disabled until a future canonical feat-revocation transaction can
      // reverse every associated sheet/progression effect atomically.
      removable: !existing?.sheetBacked,
    });
  }

  return [...knownByIdentity.values()].sort((left, right) =>
    safeText(left?.option_type).localeCompare(safeText(right?.option_type))
    || safeText(left?.name).localeCompare(safeText(right?.name))
  );
}

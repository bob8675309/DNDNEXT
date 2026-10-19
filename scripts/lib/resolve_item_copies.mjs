// 5etools item progression states frequently use _copy instead of repeating the
// full base item. Resolve those copies before DNDNext derives display fields so
// Dormant/Awakened/Exalted and similar inherited items keep their source rules.

const cloneJson = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const asArray = (value) => Array.isArray(value) ? cloneJson(value) : value == null ? [] : [cloneJson(value)];
const copyKey = (name, source) => `${String(name || "").trim().toLowerCase()}|${String(source || "UNK").trim().toUpperCase()}`;
const SOURCE_SUCCESSOR = Object.freeze({ DMG: "XDMG", PHB: "XPHB", MM: "XMM" });

// These legacy campaign/adventure variants are known to be compatible with the
// current 2024 successor base used by DNDNext. Do not apply DMG -> XDMG/PHB ->
// XPHB blindly: some legacy copies (notably Book of Vile Darkness (Variant))
// materially diverge from the 2024 base.
const LEGACY_SUCCESSOR_COPY_ALLOWLIST = new Set([
  "+2 ring of protection|tdcsr",
  "charred wand of magic missiles|wdh",
  "devlin's staff of striking|toa",
  "enchanted three-dragon ante set|llk",
  "horn of the endless maze|wdmm",
  "jakarion's staff of frost|cos",
]);

const SOURCE_SPECIFIC_COPY_FALLBACKS = Object.freeze({
  "book of vile darkness (variant)|kftgv": {
    item_type: "Wondrous Item",
    uiType: "Wondrous Item",
    rarity: "artifact",
    item_rarity: "artifact",
    price_gp: 50000,
    item_description: [
      "A uniquely corrupted version of the Book of Vile Darkness, this artifact rewards prolonged study but binds its bearer to evil. A creature must spend 80 hours studying it before using its deeper benefits. A non-evil creature that attunes to it faces a DC 17 Charisma saving throw; failure changes that creature to neutral evil. The book abandons a bearer who stops furthering evil, and a bearer who dies while attuned has their soul claimed by a powerful evil entity.",
      "Circle of Death",
      "While attuned, you can use an action to cast Circle of Death from the book with save DC 20. Afterward, roll a d6; on 1–5 this property cannot be used again until the next dawn.",
      "Condition Immunities",
      "While attuned, you cannot be Charmed or Frightened.",
      "Evil Presence",
      "The hostile spirit inside the book tries to possess a new bearer. On a failed DC 20 Charisma saving throw, the spirit takes control until magic such as Dispel Evil and Good drives it out.",
      "Adjusted Ability Scores",
      "After the required study, increase one ability score by 2 to a maximum of 24 and decrease another by 2 to a minimum of 3. The book makes this adjustment only once.",
      "Mark of Darkness",
      "Study leaves a visible mark of corruption that helps with social pressure against appropriate creatures.",
      "Command Evil",
      "While attuned and holding the book, you can use an action to cast Dominate Monster on an evil target with save DC 18. This property recharges at the next dawn.",
      "Dark Lore",
      "When using the book to recall lore about evil, double your proficiency bonus on the relevant Intelligence check.",
      "Dark Speech",
      "While carrying the book and attuned to it, you can use an action to speak its Dark Speech. You take 1d12 Psychic damage, and each non-evil creature within 15 feet takes 3d6 Psychic damage.",
      "Destroying the Book",
      "The artifact repeatedly reforms unless evil is eradicated. Exceptional divine intervention or discovery of its hidden phrase can destroy it only under the source item's special conditions.",
    ].join("\n\n"),
  },
});

function sourceSpecificCopyFallback(row = {}) {
  const key = `${String(row?.name || row?.item_name || "").trim().toLowerCase()}|${String(row?.source || row?.item_source || "").trim().toLowerCase()}`;
  const fallback = SOURCE_SPECIFIC_COPY_FALLBACKS[key];
  if (!fallback) return null;
  const resolved = { ...cloneJson(row), ...cloneJson(fallback) };
  resolved.rulesShort = fallback.item_description;
  delete resolved._copy;
  return resolved;
}


function sourceCandidates(source = "", child = {}) {
  const key = String(source || "UNK").trim().toUpperCase();
  const childKey = `${String(child?.name || child?.item_name || "").trim().toLowerCase()}|${String(child?.source || child?.item_source || "").trim().toLowerCase()}`;
  const successor = LEGACY_SUCCESSOR_COPY_ALLOWLIST.has(childKey) ? SOURCE_SUCCESSOR[key] : null;
  return [key, successor].filter(Boolean);
}

export function flattenItemEntryText(node) {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") return String(node);
  if (Array.isArray(node)) return node.map(flattenItemEntryText).filter(Boolean).join("\n\n");
  if (typeof node === "object") {
    const title = String(node.name || "").trim();
    const body = flattenItemEntryText(node.entries ?? node.items ?? node.entry ?? "");
    return [title, body].filter(Boolean).join("\n\n");
  }
  return "";
}

function applyEntryMods(entries = [], mods) {
  let next = asArray(entries);
  for (const operation of asArray(mods).filter(Boolean)) {
    const items = asArray(operation.items);
    if (operation.mode === "appendArr") next.push(...items);
    else if (operation.mode === "prependArr") next.unshift(...items);
    else if (operation.mode === "insertArr") next.splice(Math.max(0, Math.min(next.length, Number(operation.index || 0))), 0, ...items);
    else if (operation.mode === "removeArr") {
      const names = new Set(asArray(operation.names).map(String));
      next = next.filter((entry, index) => !names.has(String(entry?.name || "")) && !names.has(String(index)));
    } else if (operation.mode === "replaceArr") {
      let index = -1;
      if (typeof operation.replace === "string") index = next.findIndex((entry) => String(entry?.name || "") === operation.replace);
      else if (operation.replace && Number.isInteger(Number(operation.replace.index))) index = Number(operation.replace.index);
      if (index >= 0 && index < next.length) next.splice(index, 1, ...items);
    } else if (operation.mode === "replaceTxt") {
      const pattern = new RegExp(operation.replace || "", operation.flags || "g");
      next = JSON.parse(JSON.stringify(next).replace(pattern, operation.with || ""));
    }
  }
  return next;
}

export function resolveItemCopies(rows = [], { warn = console.warn } = {}) {
  const sourceRows = (rows || []).filter(Boolean);
  const byKey = new Map(sourceRows.map((row) => [copyKey(row.name || row.item_name, row.source || row.item_source), row]));
  const byName = new Map();
  for (const row of sourceRows) {
    const nameKey = String(row.name || row.item_name || "").trim().toLowerCase();
    if (!nameKey) continue;
    if (!byName.has(nameKey)) byName.set(nameKey, []);
    byName.get(nameKey).push(row);
  }
  const memo = new Map();
  const resolving = new Set();

  function resolve(row) {
    const key = copyKey(row?.name || row?.item_name, row?.source || row?.item_source);
    if (memo.has(key)) return cloneJson(memo.get(key));
    if (!row?._copy) {
      const plain = cloneJson(row);
      memo.set(key, plain);
      return cloneJson(plain);
    }
    if (resolving.has(key)) {
      warn?.(`[resolveItemCopies] Circular item copy skipped: ${key}`);
      return cloneJson(row);
    }

    resolving.add(key);
    const requestedSource = row._copy.source || row.source || row.item_source;
    const baseName = row._copy.name;
    const candidateKeys = sourceCandidates(requestedSource, row).map((source) => copyKey(baseName, source));
    const baseRow = candidateKeys.map((candidateKey) => byKey.get(candidateKey)).find(Boolean) || null;
    if (!baseRow) {
      const fallback = sourceSpecificCopyFallback(row);
      if (fallback) {
        resolving.delete(key);
        memo.set(key, fallback);
        return cloneJson(fallback);
      }
      warn?.(`[resolveItemCopies] Item copy base not found: ${candidateKeys.join(" or ")}`);
      resolving.delete(key);
      const unresolved = cloneJson(row);
      memo.set(key, unresolved);
      return cloneJson(unresolved);
    }

    const base = resolve(baseRow);
    const child = cloneJson(row);
    const resolved = { ...base, ...child };
    resolved.name = child.name || child.item_name || base.name || base.item_name;
    resolved.source = child.source || child.item_source || base.source || base.item_source;

    const mods = child._copy?._mod || {};
    if (mods.entries) {
      resolved.entries = applyEntryMods(base.entries || [], mods.entries);
      const flattened = flattenItemEntryText(resolved.entries).trim();
      const baseDescription = String(base.item_description || base.rulesText || "").trim();
      const operations = asArray(mods.entries).filter(Boolean);
      const modText = flattenItemEntryText(operations.flatMap((operation) => asArray(operation?.items))).trim();
      let derivedDescription = baseDescription;

      for (const operation of operations) {
        const operationText = flattenItemEntryText(asArray(operation?.items)).trim();
        if (operation.mode === "replaceTxt") {
          const pattern = new RegExp(operation.replace || "", operation.flags || "g");
          derivedDescription = String(derivedDescription || "").replace(pattern, operation.with || "");
        } else if (operation.mode === "prependArr" && operationText) {
          derivedDescription = [operationText, derivedDescription].filter(Boolean).join("\n\n");
        } else if ((operation.mode === "appendArr" || operation.mode === "insertArr") && operationText) {
          // A flattened description cannot preserve an exact array insertion
          // index, but it can preserve every inherited rule and every added
          // state rule. ItemCard will recover named source sections separately
          // from resolved.entries when structure is available.
          derivedDescription = [derivedDescription, operationText].filter(Boolean).join("\n\n");
        } else if (operation.mode === "replaceArr" && operationText) {
          // replaceArr needs the structured entry tree for exact replacement.
          // Use it when available; otherwise at least avoid silently dropping
          // the replacement rule text.
          derivedDescription = flattened || operationText;
        }
      }

      // item_description is the canonical runtime rules authority. Some baked
      // payload.entries values are deliberately flavor-only, so never let a
      // short flavor entry overwrite a complete inherited description.
      resolved.item_description = derivedDescription || flattened || baseDescription;
      resolved.rulesShort = resolved.item_description;
    } else if (!resolved.item_description && base.item_description) {
      resolved.item_description = base.item_description;
    }

    // Normalized legacy packs sometimes derived empty copy fields before the
    // inheritance step. Restore canonical inherited identity/economy fields.
    for (const field of ["type","rawType","uiType","uiSubKind","rarity","item_rarity","value","cost","price_gp","weight","ac","weaponCategory","property","source_property","propertiesText","reqAttune","attunementText"]) {
      const childValue = child[field];
      const looksEmptyDerived = childValue == null || childValue === "" || childValue === "none" || childValue === "mundane" || childValue === 1 || childValue === "1 gp";
      if (looksEmptyDerived && base[field] != null && base[field] !== "") resolved[field] = cloneJson(base[field]);
    }

    delete resolved._copy;
    resolving.delete(key);
    memo.set(key, resolved);
    return cloneJson(resolved);
  }

  return (rows || []).map(resolve);
}

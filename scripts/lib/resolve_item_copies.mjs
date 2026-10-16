// 5etools item progression states frequently use _copy instead of repeating the
// full base item. Resolve those copies before DNDNext derives display fields so
// Dormant/Awakened/Exalted and similar inherited items keep their source rules.

const cloneJson = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const asArray = (value) => Array.isArray(value) ? cloneJson(value) : value == null ? [] : [cloneJson(value)];
const copyKey = (name, source) => `${String(name || "").trim().toLowerCase()}|${String(source || "UNK").trim().toUpperCase()}`;

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
  const byKey = new Map((rows || []).filter(Boolean).map((row) => [copyKey(row.name || row.item_name, row.source || row.item_source), row]));
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
    const baseKey = copyKey(row._copy.name, row._copy.source || row.source || row.item_source);
    const baseRow = byKey.get(baseKey);
    if (!baseRow) {
      warn?.(`[resolveItemCopies] Item copy base not found: ${baseKey}`);
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
      const modText = flattenItemEntryText(asArray(mods.entries).flatMap((operation) => asArray(operation?.items))).trim();
      resolved.item_description = flattened || [baseDescription, modText].filter(Boolean).join("\n\n");
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

function safeText(value) {
  return String(value ?? "").trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeEquipmentOptions(raw = []) {
  const output = [];
  for (const group of asArray(raw)) {
    if (!group || typeof group !== "object" || Array.isArray(group)) continue;
    for (const [key, parts] of Object.entries(group)) {
      if (!Array.isArray(parts)) continue;
      output.push({ key: safeText(key).toUpperCase(), parts });
    }
  }
  return output;
}

export function equipmentChoiceKey(scope, optionKey, partIndex) {
  return `${scope}:${safeText(optionKey).toUpperCase()}:${Number(partIndex)}`;
}

export function equipmentPartCategory(part = {}) {
  if (safeText(part.equipmentType)) return [safeText(part.equipmentType)];
  return asArray(part.equipmentTypes).map(safeText).filter(Boolean);
}

export function equipmentPartNeedsChoice(part = {}) {
  return equipmentPartCategory(part).length > 0;
}

export function equipmentPartLabel(part = {}) {
  const quantity = Math.max(1, Number(part.quantity || 1));
  if (safeText(part.item)) return `${quantity > 1 ? `${quantity}× ` : ""}${safeText(part.item).split("|")[0]}`;
  if (safeText(part.special)) return `${quantity > 1 ? `${quantity}× ` : ""}${safeText(part.special)}`;
  if (Number.isFinite(Number(part.value))) return `${(Number(part.value) / 100).toLocaleString()} gp`;
  const categories = equipmentPartCategory(part);
  if (categories.length) return categories.map(equipmentCategoryLabel).join(" or ");
  return "Source equipment choice";
}

export function equipmentCategoryLabel(value = "") {
  const key = safeText(value);
  if (key === "toolArtisan") return "Artisan's Tools";
  if (key === "instrumentMusical") return "Musical Instrument";
  if (key === "setGaming") return "Gaming Set";
  if (key === "focusHoly") return "Holy Symbol";
  if (key === "focusDruidic") return "Druidic Focus";
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

export function equipmentOptionCopper(option = null) {
  return asArray(option?.parts).reduce((total, part) => total + (Number.isFinite(Number(part?.value)) ? Number(part.value) : 0), 0);
}

export function higherLevelCopper(level = 1, roll = null) {
  const resolvedLevel = Math.max(1, Math.min(20, Number(level || 1)));
  const d10 = Number(roll);
  if (resolvedLevel < 5) return 0;
  if (!Number.isInteger(d10) || d10 < 1 || d10 > 10) return 0;
  if (resolvedLevel <= 10) return (500 + d10 * 25) * 100;
  if (resolvedLevel <= 16) return (5000 + d10 * 250) * 100;
  return (20000 + d10 * 250) * 100;
}

export function higherLevelWealthRule(level = 1) {
  const resolvedLevel = Math.max(1, Math.min(20, Number(level || 1)));
  if (resolvedLevel <= 4) return { rollRequired: false, baseGp: 0, multiplierGp: 0, magicItems: resolvedLevel >= 2 ? { common: 1 } : {} };
  if (resolvedLevel <= 10) return { rollRequired: true, baseGp: 500, multiplierGp: 25, magicItems: { common: 1, uncommon: 1 } };
  if (resolvedLevel <= 16) return { rollRequired: true, baseGp: 5000, multiplierGp: 250, magicItems: { common: 2, uncommon: 3, rare: 1 } };
  return { rollRequired: true, baseGp: 20000, multiplierGp: 250, magicItems: { common: 2, uncommon: 4, rare: 3, veryRare: 1 } };
}

export function magicAllowanceLabel(level = 1) {
  const entries = Object.entries(higherLevelWealthRule(level).magicItems || {}).filter(([, count]) => Number(count) > 0);
  if (!entries.length) return "None listed";
  const labels = { common: "Common", uncommon: "Uncommon", rare: "Rare", veryRare: "Very Rare" };
  return entries.map(([rarity, count]) => `${count} ${labels[rarity] || rarity}`).join(" • ");
}

export function normalizeStartingEquipmentSelection(model = null, current = {}) {
  const classOptions = normalizeEquipmentOptions(model?.classOptions);
  const backgroundOptions = normalizeEquipmentOptions(model?.backgroundOptions);
  const classOption = classOptions.some((option) => option.key === current?.classOption) ? current.classOption : classOptions[0]?.key || "";
  const backgroundOption = backgroundOptions.some((option) => option.key === current?.backgroundOption) ? current.backgroundOption : backgroundOptions[0]?.key || "";
  const choices = current?.choices && typeof current.choices === "object" ? { ...current.choices } : {};
  const rule = higherLevelWealthRule(model?.level || 1);
  const wealthRoll = rule.rollRequired && Number.isInteger(Number(current?.wealthRoll)) && Number(current.wealthRoll) >= 1 && Number(current.wealthRoll) <= 10 ? Number(current.wealthRoll) : null;
  return { classOption, backgroundOption, choices, wealthRoll };
}

export function startingEquipmentSelectionComplete(model = null, selection = {}) {
  if (!model?.catalogReady) return false;
  const classOptions = normalizeEquipmentOptions(model.classOptions);
  const backgroundOptions = normalizeEquipmentOptions(model.backgroundOptions);
  const classOption = classOptions.find((option) => option.key === selection?.classOption) || null;
  const backgroundOption = backgroundOptions.find((option) => option.key === selection?.backgroundOption) || null;
  if (classOptions.length && !classOption) return false;
  if (backgroundOptions.length && !backgroundOption) return false;
  const choices = selection?.choices || {};
  for (const [scope, option] of [["class", classOption], ["background", backgroundOption]]) {
    for (const [index, part] of asArray(option?.parts).entries()) {
      if (!equipmentPartNeedsChoice(part)) continue;
      const selected = safeText(choices[equipmentChoiceKey(scope, option.key, index)]);
      const categories = equipmentPartCategory(part);
      const allowed = categories.flatMap((category) => asArray(model?.choiceOptions?.[category])).map((entry) => safeText(entry.itemKey));
      if (!selected || !allowed.includes(selected)) return false;
    }
  }
  const rule = higherLevelWealthRule(model?.level || 1);
  if (rule.rollRequired && (!Number.isInteger(Number(selection?.wealthRoll)) || Number(selection.wealthRoll) < 1 || Number(selection.wealthRoll) > 10)) return false;
  return true;
}

export function startingCurrencyCopper(model = null, selection = {}) {
  const classOption = normalizeEquipmentOptions(model?.classOptions).find((option) => option.key === selection?.classOption) || null;
  const backgroundOption = normalizeEquipmentOptions(model?.backgroundOptions).find((option) => option.key === selection?.backgroundOption) || null;
  return equipmentOptionCopper(classOption) + equipmentOptionCopper(backgroundOption) + higherLevelCopper(model?.level || 1, selection?.wealthRoll);
}

export function formatCopper(copper = 0) {
  const total = Math.max(0, Math.trunc(Number(copper || 0)));
  const gp = Math.floor(total / 100);
  const sp = Math.floor((total % 100) / 10);
  const cp = total % 10;
  return [gp ? `${gp.toLocaleString()} gp` : "", sp ? `${sp} sp` : "", cp ? `${cp} cp` : ""].filter(Boolean).join(" • ") || "0 gp";
}

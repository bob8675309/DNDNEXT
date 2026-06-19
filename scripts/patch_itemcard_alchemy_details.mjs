import fs from "node:fs";
import path from "node:path";

const filePath = path.join(process.cwd(), "components", "ItemCard.js");
let source = fs.readFileSync(filePath, "utf8");
let changed = false;

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
  changed = true;
}

function replaceRegex(rx, after, label) {
  if (source.includes(after)) return;
  if (!rx.test(source)) throw new Error(`${label}: pattern not found`);
  source = source.replace(rx, after);
  changed = true;
}

replaceOnce(
  'function buildRangeText(raw, propsList) {\n  const rTxt = coalesce(\n    raw.rangeText, raw.range, raw?.card_payload?.range,\n    (raw.range_normal && raw.range_long) ? `${raw.range_normal}/${raw.range_long} ft.` : null\n  );\n  if (rTxt) return String(rTxt).replace(/ft\\.?$/i, "ft.");\n\n  if (Array.isArray(propsList) && propsList.includes("T")) return "Thrown";\n  return "—";\n}',
  'function buildRangeText(raw, propsList) {\n  const alchemy = raw?.alchemy && typeof raw.alchemy === "object" ? raw.alchemy : {};\n  const result = raw?.alchemy_result && typeof raw.alchemy_result === "object" ? raw.alchemy_result : {};\n  const craft = raw?.merchant_craft && typeof raw.merchant_craft === "object" ? raw.merchant_craft : {};\n  const areaFromParts = (raw.base_area_feet || alchemy.base_area_feet || result.base_area_feet || craft.base_area_feet)\n    ? `${raw.base_area_feet || alchemy.base_area_feet || result.base_area_feet || craft.base_area_feet}-foot ${raw.area_shape || alchemy.area_shape || result.area_shape || craft.area_shape || "area"}`\n    : null;\n  const rTxt = coalesce(\n    raw.rangeText, raw.range, raw?.card_payload?.range,\n    raw.area_text, raw.areaText, alchemy.area_text, alchemy.areaText, result.area_text, result.areaText, craft.area_text, craft.areaText, areaFromParts,\n    (raw.range_normal && raw.range_long) ? `${raw.range_normal}/${raw.range_long} ft.` : null\n  );\n  if (rTxt) return String(rTxt).replace(/ft\\.?$/i, "ft.");\n\n  if (Array.isArray(propsList) && propsList.includes("T")) return "Thrown";\n  return "—";\n}',
  "alchemy area-aware range text"
);

replaceOnce(
  'function isPotionLikeItem(item = {}, type = "") {\n  const blob = [type, item.item_type, item.type, item.name, item.item_name, item.category].filter(Boolean).join(" ").toLowerCase();\n  return /\\b(potion|oil|poison|elixir|philter|tonic|draught|salve|drops)\\b/.test(blob);\n}',
  'function isPotionLikeItem(item = {}, type = "") {\n  const blob = [type, item.item_type, item.type, item.name, item.item_name, item.category, item.uiType, item?.alchemy?.section].filter(Boolean).join(" ").toLowerCase();\n  return /\\b(potion|oil|poison|elixir|philter|tonic|draught|salve|drops|bomb)\\b/.test(blob);\n}',
  "alchemy bomb detail eligibility"
);

if (!source.includes("function inferSaveAbilityFromAlchemyText")) {
  replaceOnce(
    'function extractDuration(text = "") {',
    'function inferSaveAbilityFromAlchemyText(text = "") {\n  const s = String(text || "");\n  const match = s.match(/\\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\\s+saving throw/i);\n  return match ? match[1].replace(/^./, (char) => char.toUpperCase()) : "";\n}\n\nfunction extractDuration(text = "") {',
    "alchemy save ability inference helper"
  );
}

const fn = [
  'function potionDetailsForItem(item = {}, type = "", ruleText = "", entriesText = "") {',
  '  if (!isPotionLikeItem(item, type)) return null;',
  '  const name = item.item_name || item.name || "";',
  '  const known = POTION_DETAIL_OVERRIDES[name] || {};',
  '  const alchemy = item.alchemy && typeof item.alchemy === "object" ? item.alchemy : {};',
  '  const result = item.alchemy_result && typeof item.alchemy_result === "object" ? item.alchemy_result : {};',
  '  const craft = item.merchant_craft && typeof item.merchant_craft === "object" ? item.merchant_craft : {};',
  '  const savePreview = result.saveDcPreview && typeof result.saveDcPreview === "object" ? result.saveDcPreview : {};',
  '  const sourceText = [ruleText, entriesText, item.effect_text, item.effect, alchemy.effect, result.effect, item.rulesText].filter(Boolean).join("\\n");',
  '  const duration = craft.duration || result.duration || alchemy.duration || item.duration || item.duration_text || known.duration || extractDuration(sourceText) || "See item text";',
  '  const use = craft.use || result.use || alchemy.use || item.use || item.use_text || item.activation || item.application || known.use || (/oil|bomb/i.test(name + " " + type) ? "Bonus Action to use or apply" : "Action to drink/use");',
  '  const effect = item.effect_detail || result.effect || alchemy.effect || item.effect_text || item.effect || known.effect || sourceText || "See item text.";',
  '  const saveDc = item.save_dc || item.saveDc || craft.save_dc || craft.saveDc || alchemy.save_dc || alchemy.saveDc || result.save_dc || result.saveDc || savePreview.dc || null;',
  '  const saveAbility = item.save_ability || item.saveAbility || craft.save_ability || craft.saveAbility || alchemy.save_ability || alchemy.saveAbility || alchemy.rider_save || result.save_ability || result.saveAbility || savePreview.saveAbility || inferSaveAbilityFromAlchemyText(sourceText) || null;',
  '  const doses = item.charges ?? craft.doses ?? alchemy.doses ?? result.doses ?? null;',
  '  const selectedIngredients = item.selected_ingredients || alchemy.selectedIngredients || result.selectedIngredients || craft.ingredients || [];',
  '  const ingredientLine = item.ingredient_line || alchemy.ingredientLine || result.ingredientLine || craft.ingredient_line || (Array.isArray(selectedIngredients) ? selectedIngredients.map((ingredient) => {',
  '    const ingredientName = ingredient?.name || ingredient?.item_name;',
  '    if (!ingredientName) return null;',
  '    const detail = [ingredient?.family_label || ingredient?.family, ingredient?.rarity].filter(Boolean).join(", ");',
  '    return detail ? ingredientName + " (" + detail + ")" : ingredientName;',
  '  }).filter(Boolean).join("; ") : "");',
  '  return {',
  '    use, duration, effect, saveDc, saveAbility, doses, ingredientLine,',
  '    saveLabel: saveAbility ? (saveDc ? String(saveAbility) + " DC " + String(saveDc) : String(saveAbility) + " save") : (saveDc ? "DC " + String(saveDc) : null),',
  '  };',
  '}'
].join('\n');

replaceRegex(/function potionDetailsForItem\(item = \{\}, type = "", ruleText = "", entriesText = ""\) \{[\s\S]*?\n\}/, fn, "alchemy item detail function");

const originalRows = [
  '            <div className="row g-2">',
  '              <div className="col-12 col-md-6"><strong>Use:</strong> {potionDetails.use}</div>',
  '              <div className="col-12 col-md-6"><strong>Duration:</strong> {potionDetails.duration}</div>',
  '              <div className="col-12"><strong>Effect:</strong> {potionDetails.effect}</div>',
  '            </div>'
].join('\n');

const previouslyPatchedRows = [
  '            <div className="row g-2">',
  '              <div className="col-12 col-md-6"><strong>Use:</strong> {potionDetails.use}</div>',
  '              <div className="col-12 col-md-6"><strong>Duration:</strong> {potionDetails.duration}</div>',
  '              {potionDetails.saveLabel ? <div className="col-12 col-md-6"><strong>Save:</strong> {potionDetails.saveLabel}</div> : null}',
  '              {potionDetails.doses != null ? <div className="col-12 col-md-6"><strong>Doses:</strong> {potionDetails.doses}</div> : null}',
  '              <div className="col-12"><strong>Effect:</strong> {potionDetails.effect}</div>',
  '            </div>'
].join('\n');

const newRows = previouslyPatchedRows;
const visibleIngredientRow = '              {potionDetails.ingredientLine ? <div className="col-12"><strong>Brewed With:</strong> {potionDetails.ingredientLine}</div> : null}';

if (!source.includes('<strong>Save:</strong>')) {
  const originalCount = source.split(originalRows).length - 1;
  const patchedCount = source.split(previouslyPatchedRows).length - 1;
  if (originalCount + patchedCount !== 1) throw new Error("Potion detail rows expected one supported match, found " + (originalCount + patchedCount));
  source = originalCount === 1 ? source.replace(originalRows, newRows) : source.replace(previouslyPatchedRows, newRows);
  changed = true;
}

if (source.includes(visibleIngredientRow)) {
  source = source.replace(visibleIngredientRow + "\n", "").replace(visibleIngredientRow, "");
  changed = true;
}

if (changed) {
  fs.writeFileSync(filePath, source, "utf8");
  console.log("Applied alchemy item details while keeping ingredient provenance as hidden metadata.");
} else {
  console.log("Alchemy ItemCard details and hidden provenance already present.");
}

for (const token of [
  "bomb)\\b",
  "function inferSaveAbilityFromAlchemyText",
  "alchemy.area_text",
  "saveLabel: saveAbility ?",
  "ingredientLine",
  "<strong>Save:</strong>",
  "<strong>Doses:</strong>",
]) {
  if (!source.includes(token)) throw new Error("ItemCard alchemy details validation failed: " + token);
}
if (source.includes(visibleIngredientRow)) throw new Error("ItemCard provenance must remain metadata-only");

await import("./patch_professions_canonical_crafting.mjs");

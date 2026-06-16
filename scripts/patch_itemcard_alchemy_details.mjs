import fs from "node:fs";
import path from "node:path";

const filePath = path.join(process.cwd(), "components", "ItemCard.js");
let source = fs.readFileSync(filePath, "utf8");

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
  '  const use = craft.use || result.use || alchemy.use || item.use || item.use_text || item.activation || item.application || known.use || (/oil/i.test(name) ? "Bonus Action to use or apply" : "Action to drink/use");',
  '  const effect = item.effect_detail || result.effect || alchemy.effect || item.effect_text || item.effect || known.effect || sourceText || "See item text.";',
  '  const saveDc = item.save_dc || craft.save_dc || alchemy.saveDc || savePreview.dc || null;',
  '  const saveAbility = item.save_ability || craft.save_ability || alchemy.saveAbility || savePreview.saveAbility || null;',
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
  '    saveLabel: saveDc ? (saveAbility ? String(saveAbility) + " DC " + String(saveDc) : "DC " + String(saveDc)) : null,',
  '  };',
  '}'
].join('\n');

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

const newRows = [
  '            <div className="row g-2">',
  '              <div className="col-12 col-md-6"><strong>Use:</strong> {potionDetails.use}</div>',
  '              <div className="col-12 col-md-6"><strong>Duration:</strong> {potionDetails.duration}</div>',
  '              {potionDetails.saveLabel ? <div className="col-12 col-md-6"><strong>Save:</strong> {potionDetails.saveLabel}</div> : null}',
  '              {potionDetails.doses != null ? <div className="col-12 col-md-6"><strong>Doses:</strong> {potionDetails.doses}</div> : null}',
  '              {potionDetails.ingredientLine ? <div className="col-12"><strong>Brewed With:</strong> {potionDetails.ingredientLine}</div> : null}',
  '              <div className="col-12"><strong>Effect:</strong> {potionDetails.effect}</div>',
  '            </div>'
].join('\n');

if (!source.includes("potionDetails.ingredientLine")) {
  const fnRx = /function potionDetailsForItem\(item = \{\}, type = "", ruleText = "", entriesText = ""\) \{[\s\S]*?\n\}/;
  if (!fnRx.test(source)) throw new Error("potionDetailsForItem function not found");
  source = source.replace(fnRx, fn);

  const originalCount = source.split(originalRows).length - 1;
  const patchedCount = source.split(previouslyPatchedRows).length - 1;
  if (originalCount + patchedCount !== 1) {
    throw new Error("Potion detail rows expected one supported match, found " + (originalCount + patchedCount));
  }
  source = originalCount === 1
    ? source.replace(originalRows, newRows)
    : source.replace(previouslyPatchedRows, newRows);

  fs.writeFileSync(filePath, source, "utf8");
  console.log("Applied merchant-crafted alchemy details to ItemCard.");
} else {
  console.log("Merchant-crafted alchemy ItemCard details already present.");
}

for (const token of [
  "craft.duration || result.duration || alchemy.duration",
  "saveLabel: saveDc ?",
  "ingredientLine",
  "<strong>Save:</strong>",
  "<strong>Doses:</strong>",
  "<strong>Brewed With:</strong>",
]) {
  if (!source.includes(token)) throw new Error("ItemCard alchemy details validation failed: " + token);
}

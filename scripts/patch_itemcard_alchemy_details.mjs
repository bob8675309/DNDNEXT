import fs from "node:fs";
import path from "node:path";

const filePath = path.join(process.cwd(), "components", "ItemCard.js");
let source = fs.readFileSync(filePath, "utf8");

if (!source.includes("saveLabel: saveDc ?")) {
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
    '  return {',
    '    use, duration, effect, saveDc, saveAbility, doses,',
    '    saveLabel: saveDc ? (saveAbility ? String(saveAbility) + " DC " + String(saveDc) : "DC " + String(saveDc)) : null,',
    '  };',
    '}'
  ].join('\n');

  const fnRx = /function potionDetailsForItem\(item = \{\}, type = "", ruleText = "", entriesText = ""\) \{[\s\S]*?\n\}/;
  if (!fnRx.test(source)) throw new Error("potionDetailsForItem function not found");
  source = source.replace(fnRx, fn);

  const oldRows = [
    '            <div className="row g-2">',
    '              <div className="col-12 col-md-6"><strong>Use:</strong> {potionDetails.use}</div>',
    '              <div className="col-12 col-md-6"><strong>Duration:</strong> {potionDetails.duration}</div>',
    '              <div className="col-12"><strong>Effect:</strong> {potionDetails.effect}</div>',
    '            </div>'
  ].join('\n');
  const newRows = [
    '            <div className="row g-2">',
    '              <div className="col-12 col-md-6"><strong>Use:</strong> {potionDetails.use}</div>',
    '              <div className="col-12 col-md-6"><strong>Duration:</strong> {potionDetails.duration}</div>',
    '              {potionDetails.saveLabel ? <div className="col-12 col-md-6"><strong>Save:</strong> {potionDetails.saveLabel}</div> : null}',
    '              {potionDetails.doses != null ? <div className="col-12 col-md-6"><strong>Doses:</strong> {potionDetails.doses}</div> : null}',
    '              <div className="col-12"><strong>Effect:</strong> {potionDetails.effect}</div>',
    '            </div>'
  ].join('\n');
  const count = source.split(oldRows).length - 1;
  if (count !== 1) throw new Error("Potion detail rows expected one match, found " + count);
  source = source.replace(oldRows, newRows);

  fs.writeFileSync(filePath, source, "utf8");
  console.log("Applied merchant-crafted alchemy details to ItemCard.");
} else {
  console.log("Merchant-crafted alchemy ItemCard details already present.");
}

for (const token of ["craft.duration || result.duration || alchemy.duration", "saveLabel: saveDc ?", "<strong>Save:</strong>", "<strong>Doses:</strong>"]) {
  if (!source.includes(token)) throw new Error("ItemCard alchemy details validation failed: " + token);
}

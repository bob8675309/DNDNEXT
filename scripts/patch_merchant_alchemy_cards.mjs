import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const target = path.join(process.cwd(), "components", "ItemCard.js");
let source = fs.readFileSync(target, "utf8");
const marker = "merchant-crafted-alchemy-card-v1";

if (!source.includes(marker)) {
  const functionStart = source.indexOf("function potionDetailsForItem(item = {}, type = \"\", ruleText = \"\", entriesText = \"\") {");
  const functionEndMarker = "\n}\n\n/* ---------- component ---------- */";
  const functionEnd = source.indexOf(functionEndMarker, functionStart);
  if (functionStart < 0 || functionEnd < 0) throw new Error("Potion detail function boundaries not found");

  const replacement = `function potionDetailsForItem(item = {}, type = "", ruleText = "", entriesText = "") {
  // merchant-crafted-alchemy-card-v1
  if (!isPotionLikeItem(item, type)) return null;

  const name = item.item_name || item.name || "";
  const known = POTION_DETAIL_OVERRIDES[name] || {};
  const alchemy = item.alchemy && typeof item.alchemy === "object" ? item.alchemy : {};
  const result = item.alchemy_result && typeof item.alchemy_result === "object" ? item.alchemy_result : {};
  const merchantCraft = item.merchant_craft && typeof item.merchant_craft === "object" ? item.merchant_craft : {};
  const savePreview = result.saveDcPreview && typeof result.saveDcPreview === "object" ? result.saveDcPreview : {};
  const sourceText = [
    ruleText,
    entriesText,
    item.effect_text,
    item.effect,
    alchemy.effect,
    result.effect,
    item.rulesText,
  ].filter(Boolean).join("\\n");

  const duration =
    item.duration ||
    item.duration_text ||
    alchemy.duration ||
    result.duration ||
    merchantCraft.duration ||
    known.duration ||
    extractDuration(sourceText) ||
    "By item text / DM ruling";

  const use =
    item.use ||
    item.use_text ||
    alchemy.use ||
    result.use ||
    merchantCraft.use ||
    item.activation ||
    item.application ||
    known.use ||
    (/oil/i.test(name) ? "Apply as described" : "Action to drink/use");

  const effect =
    item.effect_detail ||
    item.effect_text ||
    item.effect ||
    alchemy.effect ||
    result.effect ||
    known.effect ||
    sourceText ||
    "See item text.";

  const saveDcRaw =
    item.save_dc ??
    alchemy.saveDc ??
    result.saveDc ??
    savePreview.dc ??
    merchantCraft.save_dc ??
    null;
  const saveDcNumber = Number(saveDcRaw);
  const saveDc = Number.isFinite(saveDcNumber) && saveDcNumber > 0 ? saveDcNumber : null;
  const saveAbility =
    item.save_ability ||
    alchemy.saveAbility ||
    result.saveAbility ||
    savePreview.saveAbility ||
    merchantCraft.save_ability ||
    null;

  const selectedIngredients =
    item.selected_ingredients ||
    alchemy.selectedIngredients ||
    result.selectedIngredients ||
    merchantCraft.ingredients ||
    [];
  const ingredientLine =
    item.ingredient_line ||
    alchemy.ingredientLine ||
    result.ingredientLine ||
    merchantCraft.ingredient_line ||
    (Array.isArray(selectedIngredients)
      ? selectedIngredients
          .map((ingredient) => {
            const ingredientName = ingredient?.name || ingredient?.item_name;
            if (!ingredientName) return null;
            const family = ingredient?.family_label || ingredient?.family;
            const rarity = ingredient?.rarity;
            const detail = [family, rarity].filter(Boolean).join(", ");
            return detail ? ingredientName + " (" + detail + ")" : ingredientName;
          })
          .filter(Boolean)
          .join("; ")
      : "");

  return { use, duration, effect, saveDc, saveAbility, ingredientLine };
}`;

  source = source.slice(0, functionStart) + replacement + source.slice(functionEnd + 2);

  const oldDetails = `        {potionDetails ? (
          <div className="sitem-section sitem-rules mt-2">
            <div className="small text-muted mb-1 text-uppercase fw-semibold">Potion Details</div>
            <div className="row g-2">
              <div className="col-12 col-md-6"><strong>Use:</strong> {potionDetails.use}</div>
              <div className="col-12 col-md-6"><strong>Duration:</strong> {potionDetails.duration}</div>
              <div className="col-12"><strong>Effect:</strong> {potionDetails.effect}</div>
            </div>
          </div>
        ) : null}`;

  const newDetails = `        {potionDetails ? (
          <div className="sitem-section sitem-rules mt-2">
            <div className="small text-muted mb-1 text-uppercase fw-semibold">Potion Details</div>
            <div className="row g-2">
              <div className="col-12 col-md-6"><strong>Use:</strong> {potionDetails.use}</div>
              <div className="col-12 col-md-6"><strong>Duration:</strong> {potionDetails.duration}</div>
              {potionDetails.saveDc ? (
                <div className="col-12 col-md-6">
                  <strong>Save DC:</strong> DC {potionDetails.saveDc}{potionDetails.saveAbility ? " • " + potionDetails.saveAbility : ""}
                </div>
              ) : null}
              {potionDetails.ingredientLine ? (
                <div className="col-12"><strong>Brewed With:</strong> {potionDetails.ingredientLine}</div>
              ) : null}
              <div className="col-12"><strong>Effect:</strong> {potionDetails.effect}</div>
            </div>
          </div>
        ) : null}`;

  source = replaceOnce(source, oldDetails, newDetails, "Potion details card block");
  fs.writeFileSync(target, source, "utf8");
  console.log("Applied merchant-crafted alchemy ItemCard details.");
} else {
  console.log("Merchant-crafted alchemy ItemCard details already present.");
}

const required = [
  marker,
  "alchemy.selectedIngredients",
  "merchantCraft.save_dc",
  "<strong>Save DC:</strong>",
  "<strong>Brewed With:</strong>",
];
for (const token of required) {
  if (!source.includes(token)) throw new Error(`Merchant alchemy card validation failed: ${token}`);
}

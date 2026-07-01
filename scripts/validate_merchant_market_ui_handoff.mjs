import fs from "node:fs";
import path from "node:path";

const merchant = fs.readFileSync(path.join(process.cwd(), "components", "MerchantPanel.js"), "utf8");
const town = fs.readFileSync(path.join(process.cwd(), "components", "TownSheet.js"), "utf8");
const globalCss = fs.readFileSync(path.join(process.cwd(), "styles", "globals.scss"), "utf8");
const townCss = fs.readFileSync(path.join(process.cwd(), "components", "TownSheet.module.scss"), "utf8");

function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

for (const token of [
  'presentation = "map"',
  'className={"merchant-panel-inner merchant-market merchant-panel-" + presentation}',
  'merchant?.portrait_shop_url',
  'merchant?.portrait_url',
  'merchant?.image_url',
  'portraitStorageUrl',
  'const [query, setQuery] = useState("");',
  'const [typeFilter, setTypeFilter] = useState("All");',
  'const [selectedId, setSelectedId] = useState(null);',
  'const [notice, setNotice] = useState(null);',
  'setNotice({ kind: "error", message: "Please sign in before purchasing an item." });',
  'setNotice({ kind: "success", message: "Purchased " + card.item_name + " for " + card._price_gp + " gp. It has been added to your inventory." });',
  'merchant-stock-layout',
]) requireToken(merchant, token, "Merchant market UI handoff");

for (const token of [
  'presentation="town"',
  'styles.merchantMarketModal',
]) requireToken(town, token, "Town merchant presentation handoff");

requireToken(globalCss, "/* ===== Merchant market workspace v2 ===== */", "Merchant market global CSS");
requireToken(townCss, ".merchantMarketModal", "Town merchant market modal CSS");

console.log("Merchant market UI handoff validated.");

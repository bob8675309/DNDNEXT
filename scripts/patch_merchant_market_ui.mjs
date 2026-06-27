import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const logicTemplate = fs.readFileSync(path.join(process.cwd(), "scripts", "merchant_market_logic.template"), "utf8").trimEnd();
const renderTemplate = fs.readFileSync(path.join(process.cwd(), "scripts", "merchant_market_render.template"), "utf8").trimEnd();
const styleTemplate = fs.readFileSync(path.join(process.cwd(), "scripts", "merchant_market_styles.template"), "utf8").trimEnd();

const merchantPath = path.join(process.cwd(), "components", "MerchantPanel.js");
let merchant = fs.readFileSync(merchantPath, "utf8");

if (!merchant.includes('className={"merchant-panel-inner merchant-market merchant-panel-" + presentation}')) {
  merchant = replaceOnce(
    merchant,
    '  onBackToProfile,\n  onClose,\n}) {',
    '  onBackToProfile,\n  onClose,\n  presentation = "map",\n}) {',
    "MerchantPanel presentation prop"
  );

  merchant = replaceOnce(
    merchant,
    '  const bgUrl =\n    merchant?.bg_image_url ||\n    merchant?.bg_url ||\n    merchant?.bgImageUrl ||\n    merchant?.bgUrl ||\n    "/parchment.jpg";',
    '  const bgUrl =\n    merchant?.portrait_shop_url ||\n    merchant?.portrait_url ||\n    merchant?.image_url ||\n    merchant?.bg_image_url ||\n    merchant?.bg_url ||\n    merchant?.bgImageUrl ||\n    merchant?.bgUrl ||\n    "/parchment.jpg";',
    "MerchantPanel portrait-first storefront art"
  );

  merchant = replaceOnce(
    merchant,
    '  const [openId, setOpenId] = useState(null); // currently unused, kept for future expansion',
    '  const [openId, setOpenId] = useState(null); // retained for future card expansion\n  const [query, setQuery] = useState("");\n  const [typeFilter, setTypeFilter] = useState("All");\n  const [selectedId, setSelectedId] = useState(null);\n  const [notice, setNotice] = useState(null);',
    "MerchantPanel market state"
  );

  merchant = replaceOnce(
    merchant,
    '  const cards = useMemo(() => stock.map(normalizeRow), [stock]);',
    logicTemplate,
    "MerchantPanel stock derivations"
  );

  merchant = replaceOnce(
    merchant,
    '    if (!uid) {\n      alert("Please sign in.");\n      return;\n    }',
    '    if (!uid) {\n      setNotice({ kind: "error", message: "Please sign in before purchasing an item." });\n      return;\n    }',
    "MerchantPanel signed-in purchase notice"
  );

  merchant = replaceOnce(
    merchant,
    '      alert(`Purchased: ${card.item_name} for ${card._price_gp} gp.`);',
    '      setNotice({ kind: "success", message: "Purchased " + card.item_name + " for " + card._price_gp + " gp. It has been added to your inventory." });',
    "MerchantPanel purchase success notice"
  );

  merchant = replaceOnce(
    merchant,
    '    } catch (e) {\n      console.error(e);\n      const msg = e.message || "Purchase failed";\n      setErr(msg);\n      alert(msg);\n    } finally {',
    '    } catch (e) {\n      console.error(e);\n      const msg = e.message || "Purchase failed";\n      setErr(msg);\n      setNotice({ kind: "error", message: msg });\n    } finally {',
    "MerchantPanel purchase error notice"
  );

  const renderStart = merchant.indexOf("  if (!merchant) return null;\n\n  return (");
  const renderEnd = merchant.lastIndexOf("\n}");
  if (renderStart < 0 || renderEnd <= renderStart) throw new Error("MerchantPanel render block not found");
  merchant = merchant.slice(0, renderStart) + renderTemplate + merchant.slice(renderEnd);

  fs.writeFileSync(merchantPath, merchant, "utf8");
  console.log("Applied modern merchant market UI.");
} else {
  console.log("Modern merchant market UI already present.");
}

const townPath = path.join(process.cwd(), "components", "TownSheet.js");
let town = fs.readFileSync(townPath, "utf8");
if (!town.includes('presentation="town"')) {
  town = replaceOnce(
    town,
    '<div className={cls(styles.crafterModal, styles.crafterModalBuilder)} onClick={(event) => event.stopPropagation()}>\n            <MerchantPanel merchant={activeMerchant} isAdmin={isAdmin} locations={location ? [location] : []} onClose={() => setActiveMerchant(null)} />',
    '<div className={cls(styles.crafterModal, styles.crafterModalBuilder, styles.merchantMarketModal)} onClick={(event) => event.stopPropagation()}>\n            <MerchantPanel merchant={activeMerchant} isAdmin={isAdmin} locations={location ? [location] : []} presentation="town" onClose={() => setActiveMerchant(null)} />',
    "Town Sheet merchant presentation"
  );
  fs.writeFileSync(townPath, town, "utf8");
  console.log("Applied Town Sheet merchant presentation mode.");
}

const globalPath = path.join(process.cwd(), "styles", "globals.scss");
let globalCss = fs.readFileSync(globalPath, "utf8");
const cssMarker = "/* ===== Merchant market workspace v2 ===== */";
if (!globalCss.includes(cssMarker)) {
  globalCss += "\n\n" + styleTemplate + "\n";
  fs.writeFileSync(globalPath, globalCss, "utf8");
  console.log("Appended merchant market workspace styles.");
}

const townStylePath = path.join(process.cwd(), "components", "TownSheet.module.scss");
let townCss = fs.readFileSync(townStylePath, "utf8");
if (!townCss.includes(".merchantMarketModal")) {
  townCss += '\n\n.merchantMarketModal {\n  width: min(1440px, calc(100vw - 28px));\n  height: min(900px, calc(100vh - 28px));\n  max-height: calc(100vh - 28px);\n  overflow: hidden;\n  padding: 0;\n}\n';
  fs.writeFileSync(townStylePath, townCss, "utf8");
  console.log("Appended Town Sheet merchant modal sizing.");
}

const validations = [
  [merchant, 'presentation = "map"', "MerchantPanel presentation"],
  [merchant, "merchant-stock-layout", "MerchantPanel stock workspace"],
  [merchant, "merchant?.portrait_shop_url", "MerchantPanel portrait art fallback"],
  [merchant, 'setNotice({ kind: "success"', "inline purchase confirmation"],
  [town, 'presentation="town"', "Town Sheet presentation mode"],
  [globalCss, cssMarker, "merchant market CSS"],
  [townCss, ".merchantMarketModal", "Town Sheet merchant modal CSS"],
];
for (const [source, token, label] of validations) {
  if (!source.includes(token)) throw new Error(`${label} validation failed`);
}

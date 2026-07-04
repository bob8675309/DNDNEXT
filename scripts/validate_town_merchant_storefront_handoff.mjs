import fs from "node:fs";
import path from "node:path";

const town = fs.readFileSync(path.join(process.cwd(), "components", "TownSheet.js"), "utf8");
const merchant = fs.readFileSync(path.join(process.cwd(), "components", "MerchantPanel.js"), "utf8");

function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

function requireAbsent(source, token, label) {
  if (source.includes(token)) throw new Error(`${label}: forbidden ${token}`);
}

const finalParentProfileStorefront = town.includes('function MerchantLinkRow({ merchant, onBrowseWares, onOpenProfile, onOpenShop })')
  && town.includes('onClick={() => onOpenProfile(merchant, "profile")}')
  && town.includes('onClick={() => onOpenShop(merchant, "shop")}')
  && town.includes('function MarketDrawer({ marketData, townName, onBrowseWares, onOpenProfile, onOpenShop })')
  && town.includes('onOpenProfile={onOpenCharacterProfile}')
  && town.includes('onOpenShop={onOpenCharacterProfile}');

if (finalParentProfileStorefront) {
  for (const token of [
    'import dynamic from "next/dynamic";',
    'const MerchantPanel = dynamic(() => import("./MerchantPanel"), { ssr: false });',
    'function MerchantLinkRow({ merchant, onBrowseWares, onOpenProfile, onOpenShop })',
    'const canOpenProfile = !!merchant?.id && typeof onOpenProfile === "function";',
    'const canBrowseWares = Boolean(merchant?.storefront_enabled && merchant?.id && typeof onOpenShop === "function");',
    'onClick={() => onOpenProfile(merchant, "profile")}',
    'onClick={() => onOpenShop(merchant, "shop")}',
    'function MarketDrawer({ marketData, townName, onBrowseWares, onOpenProfile, onOpenShop })',
    'onOpenProfile={onOpenProfile}',
    'onOpenShop={onOpenShop}',
    '<MarketDrawer marketData={marketData} townName={townName} onBrowseWares={onBrowseWares} onOpenProfile={onOpenCharacterProfile} onOpenShop={onOpenCharacterProfile} />',
    'onBrowseWares={setActiveMerchant}',
    'const [activeMerchant, setActiveMerchant] = useState(null);',
    '<MerchantPanel merchant={activeMerchant}',
    'onClose={() => setActiveMerchant(null)}',
    'import { availableProfessionsForCharacter } from "../utils/craftingProfessions";',
    'const PROFESSION_TO_CRAFT_TYPE = Object.freeze({',
    'availableProfessionsForCharacter(crafter)',
  ]) requireToken(town, token, "Town merchant storefront handoff");

  for (const token of [
    'function MerchantLinkRow({ merchant, onBrowseWares }) {',
    'const canBrowseWares = Boolean(merchant?.storefront_enabled && merchant?.id);',
    'onClick={() => onBrowseWares?.(merchant)}',
    'function MarketDrawer({ marketData, townName, onBrowseWares }) {',
    'href={profileHref}>Open Profile',
    'href={shopHref}>Browse Wares',
    'const profileHref =',
    'const shopHref =',
    '["blacksmith", "alchemist", "enchanter", "scribe", "jeweler"]',
  ]) requireAbsent(town, token, "Town merchant storefront handoff");

  for (const token of [
    'onClose,',
    'onClose?.()',
  ]) requireToken(merchant, token, "MerchantPanel close callback");

  console.log("Town merchant storefront handoff validated for source-baked parent profile/shop callbacks.");
} else {
  for (const token of [
    'import dynamic from "next/dynamic";',
    'const MerchantPanel = dynamic(() => import("./MerchantPanel"), { ssr: false });',
    'function MerchantLinkRow({ merchant, onBrowseWares }) {',
    'const canBrowseWares = Boolean(merchant?.storefront_enabled && merchant?.id);',
    'onClick={() => onBrowseWares?.(merchant)}',
    'function MarketDrawer({ marketData, townName, onBrowseWares }) {',
    'onBrowseWares={onBrowseWares}',
    'onBrowseWares={setActiveMerchant}',
    'const [activeMerchant, setActiveMerchant] = useState(null);',
    '<MerchantPanel merchant={activeMerchant}',
    'onClose={() => setActiveMerchant(null)}',
    'import { availableProfessionsForCharacter } from "../utils/craftingProfessions";',
    'const PROFESSION_TO_CRAFT_TYPE = Object.freeze({',
    'availableProfessionsForCharacter(crafter)',
  ]) requireToken(town, token, "Town merchant storefront handoff");

  for (const token of [
    '["blacksmith", "alchemist", "enchanter", "scribe", "jeweler"]',
  ]) requireAbsent(town, token, "Town merchant storefront handoff");

  for (const token of [
    'onClose,',
    'onClose?.()',
  ]) requireToken(merchant, token, "MerchantPanel close callback");

  console.log("Town merchant storefront handoff validated for legacy local merchant modal callbacks.");
}

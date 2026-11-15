#!/usr/bin/env node
// C34 T28-P2 opt-in town-only integration: source contract, no DB/browser.
// A passing source contract is NOT a signed Playwright or production acceptance.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const source=p=>readFileSync(path.join(root,p),"utf8");
const blob=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");

for(const [file,expected] of [
 ["components/MerchantPanel.js","22e4d0810603bc0322904573cb5fe0c14bad1f88"],
 ["utils/useWallet.js","f34b99f1d6eee66420d57bdcefdc6d3427092e25"],
 ["components/MapPageClient.js","61f8738da2ca3d8635b5a413bfdc18c094228a0a"]
])assert.equal(blob(source(file)),expected,"T28-P2 must not change original commerce or protected world map "+file);

const town=source("components/TownSheet.js");
const page=source("pages/town/[id].js");
const candidate=source("components/c34/MerchantPanelT28P2Research.jsx");
assert.match(town,/const MerchantPanel = dynamic\(\(\) => import\("\.\/MerchantPanel"\), \{ ssr: false \}\);/,
 "Keep existing town renderer import for default and validators");
assert.match(town,/const GuardedTownMerchantPanel = dynamic\(\(\) => import\("\.\/c34\/MerchantPanelT28P2Research"\), \{ ssr: false \}\);/);
assert.match(town,/const T28_P2_TOWN_SHOP_ENABLED = process\.env\.NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP === "1";/,
 "Opt-in must be an exact explicit value, default OFF");
assert.match(town,/\{T28_P2_TOWN_SHOP_ENABLED \? \(\s*<GuardedTownMerchantPanel merchant=\{activeMerchant\}/);
assert.match(town,/\) : \(\s*<MerchantPanel merchant=\{activeMerchant\}/,
 "Existing production town component must remain fallback");
for (const attribute of [
 'isAdmin={isAdmin}',
 'locations={location ? [location] : []}',
 'presentation="town"',
 'onClose={() => setActiveMerchant(null)}'
]) {
  const opening=town.slice(town.lastIndexOf("{T28_P2_TOWN_SHOP_ENABLED ? ("));
  assert.equal(opening.split(attribute).length - 1,2,
    "Guarded and default town merchant need equivalent modal props "+attribute);
}
assert.match(candidate,/from "\.\.\/MerchantStorefrontView"/);
assert.match(candidate,/import useWallet from "\.\.\/\.\.\/utils\/c34\/useWalletT28P2Research"/);
assert.match(candidate,/supabase\.rpc\("buy_from_merchant"/);
assert.match(page,/import TownSheet from "\.\.\/\.\.\/components\/TownSheet"/);
for (const file of [
 "pages/map.js","components/MapPageClient.js","pages/npcs.js",
 "components/NpcPanel.js","pages/inventory.js",
 "components/character/CharacterInteractionPanel.js",
 "utils/useWallet.js","components/MerchantPanel.js"
]){
 const src=source(file);
 assert.doesNotMatch(src,/NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP|GuardedTownMerchantPanel|MerchantPanelT28P2Research/,
  "Town preview must NOT change shared world map, NPC profile, inventory or original storefront: "+file);
}
// Source-level byte check: strip ONLY the two opt-in edits and recover the
// exact previously deployed town UI blob. This guards every other town feature.
const unpatchedTown = town
 .replace("const MerchantPanel = dynamic(() => import(\"./MerchantPanel\"), { ssr: false });\n// C34 T28-P2: opt-in town-only preview; never changes MapPageClient or NPC Profile.\nconst GuardedTownMerchantPanel = dynamic(() => import(\"./c34/MerchantPanelT28P2Research\"), { ssr: false });\nconst T28_P2_TOWN_SHOP_ENABLED = process.env.NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP === \"1\";","const MerchantPanel = dynamic(() => import(\"./MerchantPanel\"), { ssr: false });")
 .replace("{T28_P2_TOWN_SHOP_ENABLED ? (\n              <GuardedTownMerchantPanel merchant={activeMerchant} isAdmin={isAdmin} locations={location ? [location] : []} presentation=\"town\" onClose={() => setActiveMerchant(null)} />\n            ) : (\n              <MerchantPanel merchant={activeMerchant} isAdmin={isAdmin} locations={location ? [location] : []} presentation=\"town\" onClose={() => setActiveMerchant(null)} />\n            )}","<MerchantPanel merchant={activeMerchant} isAdmin={isAdmin} locations={location ? [location] : []} presentation=\"town\" onClose={() => setActiveMerchant(null)} />");
assert.equal(blob(unpatchedTown),"5399097e48f548956807cd93476fefe03e4dee28",
 "T28-P2 town preview must be precisely reversible to unchanged original town UI");
console.log("PASS T28-P2-TOWN-PREVIEW: opt-in guarded town storefront, legacy default, preserved props, zero original world-map/shared-commerce mutations");

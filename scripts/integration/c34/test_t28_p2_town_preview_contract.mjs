#!/usr/bin/env node
// C34 T28-P2: actual town Profile/Shop handoff, default OFF, no map change.
// Executable source checks are NOT a signed browser or production approval.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const src=p=>readFileSync(path.join(root,p),"utf8");
const blob=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");
for(const [p,expected] of [
 ["components/MerchantPanel.js","22e4d0810603bc0322904573cb5fe0c14bad1f88"],
 ["utils/useWallet.js","f34b99f1d6eee66420d57bdcefdc6d3427092e25"],
 ["components/MapPageClient.js","61f8738da2ca3d8635b5a413bfdc18c094228a0a"]
]) assert.equal(blob(src(p)),expected,"Protected original commerce/map source changed: "+p);

// The previous TownSheet opt-in was dead: Browse Wares goes via
// MarketDrawer -> onOpenCharacterProfile -> CharacterInteractionPanel ->
// NpcPanel Shop tab, not via TownSheet's local activeMerchant modal.
const town=src("components/TownSheet.js");
const page=src("pages/town/[id].js");
const interaction=src("components/character/CharacterInteractionPanel.js");
const npcPanel=src("components/NpcPanel.js");
const candidate=src("components/c34/MerchantPanelT28P2Research.jsx");
assert.equal(blob(town),"5399097e48f548956807cd93476fefe03e4dee28",
 "Restore ORIGINAL TownSheet instead of feature-flagging an unreachable modal");
assert.match(town,/onOpenShop=\{onOpenCharacterProfile\}/);
assert.match(town,/onClick=\{\(\) => onOpenShop\(merchant, "shop"\)\}/);
assert.match(town,/onBrowseWares=\{setActiveMerchant\}/);
assert.match(page,/onOpenCharacterProfile=\{handleOpenTownProfile\}/);
assert.match(page,/initialView=\{activeTownProfileView\}/);
assert.match(interaction,/React\.createElement\(NpcPanel, \{\s*\.\.\.props,/);
assert.match(npcPanel,/const MerchantPanel = dynamic\(\(\) => import\("\.\/MerchantPanel"\), \{ ssr: false \}\);/);
assert.match(npcPanel,/const GuardedTownMerchantPanel = dynamic\(\(\) => import\("\.\/c34\/MerchantPanelT28P2Research"\), \{ ssr: false \}\);/);
assert.match(npcPanel,/useGuardedTownMerchant = false/,
 "World-map/shared Profile defaults MUST keep original MerchantPanel");
assert.match(npcPanel,/\{useGuardedTownMerchant \? \(\s*<GuardedTownMerchantPanel/);
assert.match(npcPanel,/\) : \(\s*<MerchantPanel/);
assert.match(npcPanel,/onBackToProfile=\{\(\) => setPanelView\("profile"\)\}/);
assert.match(page,/const T28_P2_TOWN_SHOP_ENABLED = process\.env\.NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP === "1";/);
assert.match(page,/useGuardedTownMerchant=\{T28_P2_TOWN_SHOP_ENABLED\}/,
 "Only the town Profile handoff should opt into guarded merchant+wallet");
assert.match(candidate,/import useWallet from "\.\.\/\.\.\/utils\/c34\/useWalletT28P2Research"/);
assert.match(candidate,/supabase\.rpc\("buy_from_merchant"/);

const baseImport='const MerchantPanel = dynamic(() => import("./MerchantPanel"), { ssr: false });';
const candidateImport=baseImport+'\n// Town Profile→Shop opt-in only; default map/NPC behavior stays on MerchantPanel.\nconst GuardedTownMerchantPanel = dynamic(() => import("./c34/MerchantPanelT28P2Research"), { ssr: false });';
const originalShop='<MerchantPanel merchant={view} isAdmin={isAdmin} locations={locations} showTravelTools={false} onBackToProfile={() => setPanelView("profile")} />';
const guardedShop='{useGuardedTownMerchant ? (\n          <GuardedTownMerchantPanel merchant={view} isAdmin={isAdmin} locations={locations} showTravelTools={false} onBackToProfile={() => setPanelView("profile")} />\n        ) : (\n          '+originalShop+'\n        )}';
const oldNpc=npcPanel.replace(candidateImport,baseImport)
 .replace('hasCraftCapability = false, useGuardedTownMerchant = false','hasCraftCapability = false')
 .replace(guardedShop,originalShop);
assert.equal(blob(oldNpc),"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db",
 "Shared NpcPanel must be precisely reversible; don't change world-map defaults");
const oldTownRouteImport='const CharacterInteractionPanel = dynamic(() => import("../../components/character/CharacterInteractionPanel"), { ssr: false });';
const newTownRouteImport=oldTownRouteImport+'\n// Only this town route opts its Profile→Shop tab into the guarded candidate.\nconst T28_P2_TOWN_SHOP_ENABLED = process.env.NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP === "1";';
const oldPage=page.replace(newTownRouteImport,oldTownRouteImport)
 .replace('                  useGuardedTownMerchant={T28_P2_TOWN_SHOP_ENABLED}\n',"");
assert.equal(blob(oldPage),"a4e790e5941afb16660a112ee9189e4a84d4afb7",
 "Town route must be exactly reversible to its original Profile-first path");
for(const p of ["pages/map.js","components/MapPageClient.js","pages/npcs.js","pages/inventory.js",
 "utils/useWallet.js","components/MerchantPanel.js","components/character/CharacterInteractionPanel.js"]){
 assert.doesNotMatch(src(p),/NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP|useGuardedTownMerchant|GuardedTownMerchantPanel/,
  "Town-only preview must not change world-map, NPC manager, inventory or original commerce: "+p);
}
console.log("PASS T28-P2-TOWN-PROFILE: actual Market→Profile/Shop handoff opt-in, default original map, byte-reversible NpcPanel/town route and untouched TownSheet");

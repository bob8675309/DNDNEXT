#!/usr/bin/env node
// C34 T28-P2: actual town Profile/Shop opt-in, preserve source-authentic
// shared NpcPanel/CharacterInteractionPanel and all world-map consumers.
// Passing this source test is not a full Next/Chromium approval.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const source=p=>readFileSync(path.join(root,p),"utf8");
const hash=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");

const originalBlobs=[
 ["components/MerchantPanel.js","22e4d0810603bc0322904573cb5fe0c14bad1f88"],
 ["utils/useWallet.js","f34b99f1d6eee66420d57bdcefdc6d3427092e25"],
 ["components/MapPageClient.js","61f8738da2ca3d8635b5a413bfdc18c094228a0a"],
 ["components/TownSheet.js","5399097e48f548956807cd93476fefe03e4dee28"],
 ["components/NpcPanel.js","e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db"],
 ["components/character/CharacterInteractionPanel.js","28a2dde5696376ee39c01a498b76a146f30aaffa"]
];
for(const [file,expected]of originalBlobs)
 assert.equal(hash(source(file)),expected,"Original world-map/Profile/merchant source must stay untouched: "+file);
const town=source("components/TownSheet.js");
const page=source("pages/town/[id].js");
const interaction=source("components/character/CharacterInteractionPanel.js");
const npc=source("components/NpcPanel.js");
const derivedInteraction=source("components/character/CharacterInteractionPanelTownT28P2Research.js");
const derivedNpc=source("components/NpcPanelTownT28P2Research.jsx");
const guardedShop=source("components/c34/MerchantPanelT28P2Research.jsx");

// The actual town shop path: Market Browse Wares -> selected character
// Interaction panel -> NpcPanel Shop. The former TownSheet activeMerchant
// overlay is not the route users actually take.
assert.match(town,/onOpenShop=\{onOpenCharacterProfile\}/);
assert.match(town,/onClick=\{\(\) => onOpenShop\(merchant, "shop"\)\}/);
assert.match(page,/onOpenCharacterProfile=\{handleOpenTownProfile\}/);
assert.match(page,/initialView=\{activeTownProfileView\}/);
assert.match(page,/const T28_P2_TOWN_SHOP_ENABLED = process\.env\.NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP === "1"/);
assert.match(page,/const GuardedTownCharacterInteractionPanel = dynamic\(\(\) => import\("\.\.\/\.\.\/components\/character\/CharacterInteractionPanelTownT28P2Research"\)/);
assert.match(page,/const TownProfilePanel = T28_P2_TOWN_SHOP_ENABLED \? GuardedTownCharacterInteractionPanel : CharacterInteractionPanel/);
assert.match(page,/<TownProfilePanel\s+key=/);
assert.match(page,/useGuardedTownMerchant=\{T28_P2_TOWN_SHOP_ENABLED\}/);
assert.match(interaction,/React\.createElement\(NpcPanel, \{\s*\.\.\.props,/);
assert.match(derivedInteraction,/import NpcPanel from "\.\.\/NpcPanelTownT28P2Research"/);
assert.match(derivedInteraction,/React\.createElement\(NpcPanel, \{\s*\.\.\.props,/);
assert.match(derivedNpc,/useGuardedTownMerchant = false/);
assert.match(derivedNpc,/\{useGuardedTownMerchant \? \(\s*<GuardedTownMerchantPanel/);
assert.match(derivedNpc,/\) : \(\s*<MerchantPanel/);
assert.match(derivedNpc,/onBackToProfile=\{\(\) => setPanelView\("profile"\)\}/);
assert.match(guardedShop,/import useWallet from "\.\.\/\.\.\/utils\/c34\/useWalletT28P2Research"/);
assert.match(guardedShop,/typeof onBackToProfile === "function"/);
assert.match(guardedShop,/Return to Profile/);

// A derivative must be exactly the original source plus explicit,
// reversible, isolated changes, not an accidental fork losing features.
const interactionPrefix="// C34 T28-P2 town-only source-derived Interaction panel. Original shared module unchanged.\n";
const reversedInteraction=derivedInteraction.replace(interactionPrefix,"")
 .replace('import NpcPanel from "../NpcPanelTownT28P2Research";','import NpcPanel from "../NpcPanel";');
assert.equal(hash(reversedInteraction),"28a2dde5696376ee39c01a498b76a146f30aaffa",
 "Town Interaction shell must preserve every original view/tab/permission helper");
const npcPrefix="// C34 T28-P2 town-only source-derived copy of original NpcPanel. Never used by world map.\n";
const origImport='const MerchantPanel = dynamic(() => import("./MerchantPanel"), { ssr: false });';
const addedImport=origImport+'\n// Town Profile→Shop opt-in only; default map/NPC behavior stays on MerchantPanel.\nconst GuardedTownMerchantPanel = dynamic(() => import("./c34/MerchantPanelT28P2Research"), { ssr: false });';
const normalShop='<MerchantPanel merchant={view} isAdmin={isAdmin} locations={locations} showTravelTools={false} onBackToProfile={() => setPanelView("profile")} />';
const switchedShop='{useGuardedTownMerchant ? (\n          <GuardedTownMerchantPanel merchant={view} isAdmin={isAdmin} locations={locations} showTravelTools={false} onBackToProfile={() => setPanelView("profile")} />\n        ) : (\n          '+normalShop+'\n        )}';
const reversedNpc=derivedNpc.replace(npcPrefix,"")
 .replace(addedImport,origImport)
 .replace("hasCraftCapability = false, useGuardedTownMerchant = false","hasCraftCapability = false")
 .replace(switchedShop,normalShop);
assert.equal(hash(reversedNpc),"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db",
 "Derived NPC Profile must preserve the original merchant interactions and sheet");
const baseImport='const CharacterInteractionPanel = dynamic(() => import("../../components/character/CharacterInteractionPanel"), { ssr: false });';
const flaggedImport=baseImport+
 '\n// Only this town route opts its Profile→Shop tab into the guarded candidate.'+
 '\nconst T28_P2_TOWN_SHOP_ENABLED = process.env.NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP === "1";'+
 '\nconst GuardedTownCharacterInteractionPanel = dynamic(() => import("../../components/character/CharacterInteractionPanelTownT28P2Research"), { ssr: false });'+
 '\nconst TownProfilePanel = T28_P2_TOWN_SHOP_ENABLED ? GuardedTownCharacterInteractionPanel : CharacterInteractionPanel;';
assert.equal(page.split("T28_P2_TOWN_SHOP_ENABLED && requestedView === \"shop\" ? \"profile\" : requestedView").length-1,1,
 "Flagged Browse Wares must enter Profile before Shop");
const originalTownView="  setActiveTownProfileView(initialView || \"profile\");";
const guardedTownView="  const requestedView = initialView || \"profile\";\n  // T28-P2 opt-in: the Bazaar still requests \"shop\", but enter Profile\n  // first. Default OFF preserves the pre-research town navigation.\n  setActiveTownProfileView(\n    T28_P2_TOWN_SHOP_ENABLED && requestedView === \"shop\" ? \"profile\" : requestedView\n  );";
const reversedPage=page.replace(flaggedImport,baseImport)
 .replace('<TownProfilePanel\n                  key=','<CharacterInteractionPanel\n                  key=')
 .replace('                  useGuardedTownMerchant={T28_P2_TOWN_SHOP_ENABLED}\n',"")
 .replace(guardedTownView,originalTownView);
assert.equal(hash(reversedPage),"a4e790e5941afb16660a112ee9189e4a84d4afb7",
 "Actual town page must preserve Profile-first loader and be byte-reversible");
for(const file of ["pages/map.js","components/MapPageClient.js","pages/npcs.js","pages/inventory.js",
 "components/NpcPanel.js","components/character/CharacterInteractionPanel.js",
 "utils/useWallet.js","components/MerchantPanel.js"]){
 assert.doesNotMatch(source(file),/T28_P2_TOWN_SHOP_ENABLED|useGuardedTownMerchant|GuardedTownMerchantPanel|NpcPanelTownT28P2Research/,
  "Guarded town variant must not enter original map/NPC/inventory/commerce: "+file);
}
console.log("PASS T28-P2-TOWN-PROFILE: actual town Market→Profile/Shop uses isolated derived shell; all original merchant/map/NPC blobs preserved; flag OFF defaults original");

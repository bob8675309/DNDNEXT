#!/usr/bin/env node
// C34 T28-P2 ORIGINAL-SOURCE-SHAPED town Profile->Shop Chromium preview.
// Only a disposable local Next page may import isolated derived components.
import assert from "node:assert/strict";
import {readFileSync,existsSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const src=p=>readFileSync(path.join(root,p),"utf8");
const blob=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");
export const T28_P2_TOWN_TEMP_ROUTE="pages/__c34_t28_p2_town_profile_probe.jsx";
const originals=[
 ["components/NpcPanel.js","e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db"],
 ["components/character/CharacterInteractionPanel.js","28a2dde5696376ee39c01a498b76a146f30aaffa"],
 ["components/TownSheet.js","5399097e48f548956807cd93476fefe03e4dee28"],
 ["components/MapPageClient.js","61f8738da2ca3d8635b5a413bfdc18c094228a0a"]
];
export function deriveT28P2TownProfileRoute(merchantId){
 for(const [p,expected] of originals)
  assert.equal(blob(src(p)),expected,"C34 protected world-map/profile source drift: "+p);
 assert.match(merchantId,/^[0-9a-f-]{36}$/i);
 assert.ok(!existsSync(path.join(root,T28_P2_TOWN_TEMP_ROUTE)),
  "Cannot replace an existing or tracked town Profile probe route");
 const derived=src("components/character/CharacterInteractionPanelTownT28P2Research.js");
 assert.match(derived,/import NpcPanel from "\.\.\/NpcPanelTownT28P2Research"/);
 const npc=src("components/NpcPanelTownT28P2Research.jsx");
 assert.match(npc,/useGuardedTownMerchant = false/);
 assert.match(npc,/<GuardedTownMerchantPanel/);
 return [
  "// C34 GENERATED DISPOSABLE NONMAP Profile-first town Shop probe. NEVER COMMIT.",
  'import TownProfile from "../components/character/CharacterInteractionPanelTownT28P2Research";',
  "export default function T28P2TownProfileTest(){",
  " const merchant={id:"+JSON.stringify(merchantId)+
    ',name:"T26 Probe Merchant",kind:"merchant",storefront_enabled:true,role:"Merchant"};',
  ' return <main data-testid="t28p2-town-profile-probe">'+
    '<TownProfile character={merchant} initialView="profile" isAdmin={false}'+
    ' locations={[]} useGuardedTownMerchant={true} /></main>;',
  "}",
  ""
 ].join("\n");
}
export function writeT28P2TownProfileRoute(merchantId){
 const code=deriveT28P2TownProfileRoute(merchantId);
 writeFileSync(path.join(root,T28_P2_TOWN_TEMP_ROUTE),code,{flag:"wx"});
 return code;
}

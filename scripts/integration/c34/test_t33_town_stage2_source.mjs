import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const hash=p=>{const r=spawnSync("git",["hash-object",p],{cwd:root,encoding:"utf8"});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
test("T33-01 original protected map and original T28/Profile/Shop source unchanged",()=>{
 for(const [p,h] of Object.entries({
  "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a",
  "components/NpcPanel.js":"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db",
  "components/NpcPanelTownT28P2Research.jsx":"299720531abdbd8f9656e71ca501d7250283a7d2",
  "components/character/CharacterInteractionPanelTownT28P2Research.js":"c87f2081e8205e06ab6f86c271ac88ee182e6326",
  "components/MerchantPanel.js":"22e4d0810603bc0322904573cb5fe0c14bad1f88",
  "components/TownSheet.js":"5399097e48f548956807cd93476fefe03e4dee28",
  "utils/useWallet.js":"f34b99f1d6eee66420d57bdcefdc6d3427092e25",
 }))assert.equal(hash(p),h,p);
});
test("T33-02 real town only with both default-OFF research flags",()=>{
 const s=read("pages/town/[id].js");
 assert.match(s,/const T33_TOWN_SAFE_ENABLED = T28_P2_TOWN_SHOP_ENABLED && process\.env\.NEXT_PUBLIC_C34_T33_TOWN_STAGE2_SAFE_PROFILE === "1"/);
 assert.match(s,/TownProfileForRoute = T33_TOWN_SAFE_ENABLED \? T33TownSafeProfile : TownProfilePanel/);
 assert.match(s,/admin = role\.status === "ok" && role\.capabilities\.isGameManager === true/);
 assert.match(s,/onOpenCharacterProfile=\{handleOpenTownProfile\}/);
 assert.match(s,/T28_P2_TOWN_SHOP_ENABLED && requestedView === "shop" \? "profile" : requestedView/);
});
test("T33-03 safe NPC uses original Stage2 projection and canonical granted Sheet",()=>{
 const n=read("components/NpcPanelTownT33Research.jsx");
 assert.match(n,/readTownGameManagerNpcProfileCandidate\(supabase, npcId/);
 assert.match(n,/withDossier: true/);
 assert.match(n,/isCurrent: \(\) => active && requestEpochRef\.current === generation/);
 assert.doesNotMatch(n,/loadCharacterSecrets|\.from\("characters"\)\s*\.select\(/);
 assert.doesNotMatch(n,/supabase\.from\("character_sheets"\)\.select\("sheet"\)/);
 assert.match(n,/roleCapabilities\?\.isGameManager === true/);
 assert.match(n,/Object\.prototype\.hasOwnProperty\.call\(authorizedProfile\?\.profile\?\.lore/);
 assert.match(n,/data-testid="t33-stage2-profile-pending"/);
 assert.match(n,/data-testid="t33-stage2-profile-ready"/);
 for(const key of ["MerchantPanelT28P2Research","onBackToProfile","Let me browse your wares.","CharacterSheetPanel","EquipmentDiagram","toggleReveal"])
  assert.ok(n.includes(key),"T33 dropped original Profile feature "+key);
});
test("T33-04 interaction shell ignores parent isAdmin, validates fresh server role",()=>{
 const s=read("components/character/CharacterInteractionPanelTownT33Research.js");
 assert.match(s,/readTownGameManagerCapabilitiesCandidate\(supabase/);
 assert.match(s,/const effectiveIsAdmin = resolvedAdmin/);
 assert.doesNotMatch(s,/requestedIsAdmin \|\| resolvedAdmin|setResolvedAdmin\(true\)|\.rpc\("is_admin"/);
 assert.match(s,/actorGenerationRef\.current \+= 1/);
 assert.match(s,/import NpcPanel from "\.\.\/NpcPanelTownT33Research"/);
});
console.log("PASS T33-SOURCE: original map/T28, real town double flag, Stage2 RPC and signed game-manager UI preserved");

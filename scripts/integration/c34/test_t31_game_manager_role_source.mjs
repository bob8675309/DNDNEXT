// C34 T31 superseding owner-approved equal gameplay administration model.
// Prior T29/T30 historical negatives intentionally remain unchanged and run
// before the T31 scoped disposable policy update.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
 GAME_MANAGER_ROLES,expectedGameManagementCapabilities,
 validateGameManagementProjection,readTownGameManagerCapabilitiesCandidate,
 readTownGameManagerNpcProfileCandidate,
} from "../../../utils/c34/t31GameManagerRoleProfileCandidate.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const hash=p=>{const r=spawnSync("git",["hash-object",p],{cwd:root,encoding:"utf8"});
 assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const actor="00000000-0000-4000-8000-000000000001";
const npc="00000000-0000-4000-8000-000000000002";
const payload=role=>{
 const s=expectedGameManagementCapabilities(role);
 return Object.fromEntries(Object.entries(s).filter(([k])=>k!=="isAdmin"&&k!=="isGameManager"));
};
function mock(role){
 const calls=[];
 const client={
  auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},
  rpc:async(name,args)=>{
    calls.push(name);
    if(name==="c34_game_manager_capabilities_research_v1")
     return {data:payload(role),error:null};
    if(name==="get_npc_profile_visible_v1")
     return {data:{id:npc,name:"NPC",lore:{background:"revealed",secret:"PRIVATE_NOT_PUBLIC"}},error:null};
    if(name==="get_npc_dossier_admin_v1")
     return {data:{id:npc,secret:"GM_ONLY"},error:null};
    throw Error("unexpected RPC "+name+" "+JSON.stringify(args));
  },
  from:()=>{throw Error("Unexpected direct private table read");},
 };
 return {client,calls};
}
test("T31-C01 Admin, GM and DM receive identical in-game management capabilities",()=>{
 assert.deepEqual(GAME_MANAGER_ROLES,["admin","gm","dm"]);
 for(const role of GAME_MANAGER_ROLES){
  const capabilities=expectedGameManagementCapabilities(role);
  assert.equal(capabilities.isGameManager,true);
  assert.equal(capabilities.isAdmin,true);
  for(const k of ["canEditMerchantStock","canSetPlayerGold","canEditWorldTravel",
   "canReadNpcDossier","canEditCharacterPrivacy","canManageNpcPlayers",
   "canManageCharacterInventory"])assert.equal(capabilities[k],true,role+" "+k);
  assert.ok(Object.isFrozen(capabilities));
  assert.deepEqual(validateGameManagementProjection(payload(role)),capabilities);
 }
});
test("T31-N01 players, editor, unknown, uppercase and missing role never inherit GM",()=>{
 for(const role of ["player","editor","moderator","unknown","GM","DM","admin ","",null,undefined]){
  const x=expectedGameManagementCapabilities(role);
  assert.equal(x.isGameManager,false,String(role));
  assert.equal(x.canReadNpcDossier,false);
  assert.equal(x.canEditMerchantStock,false);
 }
});
test("T31-N02 reject forged extra privileged role fields and partial boolean responses",()=>{
 for(const bad of [
  null,{...payload("player"),canReadNpcDossier:true},
  {...payload("gm"),canEditWorldTravel:false},
  {...payload("dm"),canManageCharacterInventory:"true"},
  {...payload("admin"),canReadNpcDossier:undefined},
  {...payload("unknown"),canEditMerchantStock:true},
 ])assert.equal(validateGameManagementProjection(bad),null);
});
test("T31-C02 every Game Master gets source Stage2 dossier; public projection remains secret-free",async()=>{
 for(const role of ["admin","gm","dm","player"]){
  const {client,calls}=mock(role);
  const p=await readTownGameManagerNpcProfileCandidate(client,npc,{withDossier:true});
  assert.equal(p.status,"ok",role);
  assert.ok(!JSON.stringify(p.profile).includes("PRIVATE_NOT_PUBLIC"));
  assert.ok(!JSON.stringify(p.profile).includes("GM_ONLY"));
  assert.equal(p.dossier?.secret,GAME_MANAGER_ROLES.includes(role)?"GM_ONLY":undefined);
  assert.equal(calls.includes("get_npc_dossier_admin_v1"),GAME_MANAGER_ROLES.includes(role));
 }
});
test("T31-N03 logout/switch and same JWT role revocation invalidate private results",async()=>{
 const old=mock("gm"),original=old.client.rpc;
 let readCount=0;
 old.client.rpc=async(...args)=>{
  if(args[0]==="c34_game_manager_capabilities_research_v1")
   return {data:payload(++readCount<=1?"gm":"player"),error:null};
  return original(...args);
 };
 const p=await readTownGameManagerNpcProfileCandidate(old.client,npc,{withDossier:true});
 assert.equal(p.status,"session-or-role-changed");
 assert.equal(p.profile,null);assert.equal(p.dossier,null);
 const switched=mock("dm");let getCount=0;
 switched.client.auth.getUser=async()=>({data:{user:{id:++getCount===1?actor:npc}},error:null});
 assert.equal((await readTownGameManagerCapabilitiesCandidate(switched.client)).status,"session-changed");
 const obsolete=mock("admin");let epoch=true;
 obsolete.client.rpc=async()=>{epoch=false;return {data:payload("admin"),error:null};};
 assert.notEqual((await readTownGameManagerCapabilitiesCandidate(obsolete.client,{isCurrent:()=>epoch})).status,"ok");
});
test("T31-S01 preserve old source-original SQL, map and shared components unchanged",()=>{
 for(const [p,sha] of Object.entries({
  "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a",
  "components/NpcPanel.js":"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db",
  "components/MerchantPanel.js":"22e4d0810603bc0322904573cb5fe0c14bad1f88",
  "utils/useWallet.js":"f34b99f1d6eee66420d57bdcefdc6d3427092e25",
  "sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql":"afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac",
  "sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql":"01e48823ac3a46aa5880e98200e97c2595501ce7",
 }))assert.equal(hash(p),sha,p);
 for(const p of ["pages/_app.js","pages/npcs.js","pages/town/[id].js",
  "components/NpcPanel.js","components/MapPageClient.js"]) {
  const s=read(p);
  if(p==="pages/town/[id].js"){
    // T33 is separately double-flagged and still unmounted in all deployed apps.
    assert.match(s,/T33_TOWN_SAFE_ENABLED = T28_P2_TOWN_SHOP_ENABLED && process\.env\.NEXT_PUBLIC_C34_T33_TOWN_STAGE2_SAFE_PROFILE === "1"/);
    assert.match(s,/role\.capabilities\.isGameManager === true/);
    assert.doesNotMatch(s,/c34_game_manager_capabilities_research_v1/);
  } else {
    assert.doesNotMatch(s,/t31GameManagerRoleProfileCandidate|c34_game_manager_capabilities_research_v1/,p);
  }
 }
 const source=read("scripts/integration/c34/t31_disposable_game_manager_role_unification_pg17.sql");
 for(const s of ["T31_DISPOSABLE_LOCAL_CONFIRMED","private.current_user_is_admin()",
  "('admin','gm','dm')","get_npc_dossier_admin_v1","REVOKE ALL","auth.uid()"])
  assert.ok(source.includes(s),"T31 missing signed local guard "+s);
 const executable=source.split("\n").filter(line=>!line.trimStart().startsWith("--")).join("\n");
 assert.doesNotMatch(executable,/auth\.jwt\(|user_metadata|CREATE POLICY|ALTER POLICY|DROP POLICY|CASCADE/i);
});
console.log("PASS T31-SOURCE: equal Admin/GM/DM gameplay rights, Stage2 dossier and all old negative/provenance preserved");

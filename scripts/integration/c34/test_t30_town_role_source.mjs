// C34 T30 offline source-locked role/privacy and request generation negatives.
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateTownCapabilityProjection, readTownRoleCapabilitiesCandidate,
  readTownNpcProfileCandidate,
} from "../../../utils/c34/t30TownRoleProfileCandidate.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const hash=p=>{
  const o=spawnSync("git",["hash-object",p],{cwd:root,encoding:"utf8"});
  assert.equal(o.status,0,o.stderr);return o.stdout.trim();
};
const actor="00000000-0000-4000-8000-000000000001";
const npc="00000000-0000-4000-8000-000000000002";
function payload(role){
  return {role,canEditMerchantStock:["admin","gm","dm"].includes(role),
    canSetPlayerGold:["admin","gm","dm"].includes(role),
    canEditWorldTravel:role==="admin",canReadNpcDossier:role==="admin",
    canEditCharacterPrivacy:role==="admin"};
}
function mock(role, options={}){
 const calls=[];
 const client={
   auth:{getUser:async()=>({data:{user:{id:options.actorId||actor}},error:null})},
   rpc:async(name,args)=>{
     calls.push(name);
     if(name==="c34_town_role_capabilities_research_v1")
       return {data:options.rolePayload||payload(role),error:null};
     if(name==="get_npc_profile_visible_v1")
       return {data:{id:npc,name:"T30 NPC",lore:{background:"public",
         secret:"NEVER_PUBLIC",motivation:"reveal-only"}},error:null};
     if(name==="get_npc_dossier_admin_v1")
       return {data:{id:npc,secret:"ADMIN_ONLY"},error:null};
     throw Error("unexpected RPC "+name+" "+JSON.stringify(args));
   },
   from:()=>{throw Error("Unexpected raw SQL table read");},
 };
 return {client,calls};
}
test("T30-C01 exact canonical roles separate Admin dossier/travel from GM/DM commerce",()=>{
 for(const role of ["admin","gm","dm","player","editor","unknown","GM","dm ",""]){
  const caps=validateTownCapabilityProjection(payload(role));
  assert.ok(caps,role);assert.equal(caps.canReadNpcDossier,role==="admin");
  assert.equal(caps.canEditWorldTravel,role==="admin");
  assert.equal(caps.canEditMerchantStock,["admin","gm","dm"].includes(role));
  assert.equal(Object.isFrozen(caps),true);
 }
});
test("T30-N01 reject malformed or overprivileged server responses",()=>{
 for(const raw of [
  null,{...payload("gm"),canReadNpcDossier:true},
  {...payload("dm"),canEditWorldTravel:true},
  {...payload("player"),canSetPlayerGold:"false"},
  {...payload("GM"),canEditMerchantStock:true},
  {...payload("admin"),canReadNpcDossier:undefined},
 ])assert.equal(validateTownCapabilityProjection(raw),null);
});
test("T30-N02 only strict Admin requests dossier; all public Profiles strip revealed secret",async()=>{
 for(const role of ["admin","gm","dm","player"]){
  const {client,calls}=mock(role);
  const res=await readTownNpcProfileCandidate(client,npc,{withDossier:true});
  assert.equal(res.status,"ok",role);
  assert.equal(JSON.stringify(res.profile).includes("NEVER_PUBLIC"),false);
  assert.equal(JSON.stringify(res.profile).includes("ADMIN_ONLY"),false);
  assert.equal(calls.includes("get_npc_dossier_admin_v1"),role==="admin");
  assert.equal(res.dossier?.secret,role==="admin"?"ADMIN_ONLY":undefined);
 }
});
test("T30-N03 stale actor or signed-out auth MUST fail closed",async()=>{
 const {client}=mock("gm");
 let count=0;
 client.auth.getUser=async()=>({data:{user:{id:++count===1?actor:npc}},error:null});
 assert.equal((await readTownRoleCapabilitiesCandidate(client)).status,"session-changed");
 const revoked=mock("admin");let epoch=true;
 revoked.client.rpc=async()=>{epoch=false;return {data:payload("admin"),error:null}};
 assert.notEqual((await readTownRoleCapabilitiesCandidate(revoked.client,{isCurrent:()=>epoch})).status,"ok");
});
test("T30-N04 role demotion during an in-flight Profile clears dossier before returning",async()=>{
 const {client}=mock("admin");
 let count=0;
 const original=client.rpc;
 client.rpc=async(...args)=>{
  if(args[0]==="c34_town_role_capabilities_research_v1")
    return {data:payload(++count===1?"admin":"player"),error:null};
  return original(...args);
 };
 const res=await readTownNpcProfileCandidate(client,npc,{withDossier:true});
 assert.equal(res.status,"session-or-role-changed");
 assert.equal(res.profile,null);assert.equal(res.dossier,null);
});
test("T30-S01 original map/town and source-owned Stage2 SQL remain exact",()=>{
 for(const [p,sha] of Object.entries({
  "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a",
  "components/NpcPanel.js":"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db",
  "components/MerchantPanel.js":"22e4d0810603bc0322904573cb5fe0c14bad1f88",
  "utils/useWallet.js":"f34b99f1d6eee66420d57bdcefdc6d3427092e25",
  "sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql":"afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac",
 }))assert.equal(hash(p),sha,p);
 const town=read("pages/town/[id].js");
 assert.match(town,/NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP === "1"/);
 for(const p of ["pages/town/[id].js","pages/npcs.js","pages/_app.js",
  "components/NpcPanel.js","components/MapPageClient.js"])
  assert.doesNotMatch(read(p),/t30TownRoleProfileCandidate|c34_town_role_capabilities_research_v1/,p);
 const sql=read("scripts/integration/c34/t30_disposable_town_role_capabilities_pg17.sql");
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION/);
 assert.doesNotMatch(sql,/auth\.jwt\(|user_metadata|CREATE POLICY|ALTER POLICY|DROP POLICY/i);
});
console.log("PASS T30-SOURCE: exact role capabilities, Stage2 safe public Profile, stale actor/role negatives and no active cutover");

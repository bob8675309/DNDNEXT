#!/usr/bin/env node
// T30 disposable signed local Stage1+Stage2+T29 proof. Not production SQL.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readTownRoleCapabilitiesCandidate, readTownNpcProfileCandidate }
  from "../../../utils/c34/t30TownRoleProfileCandidate.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const env=process.env;
for(const [key,value] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  C34_T30_ROLE_CONFIRM:"SIGNED_TOWN_STAGE2_LOCAL_ONLY",
}))assert.equal(env[key],value,"Unsafe T30 environment: "+key);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
const sql=q=>{
 const x=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",q],
  {cwd:root,env,encoding:"utf8",timeout:30000});
 assert.equal(x.status,0,"T30 disposable SQL: "+x.stderr?.slice(-1200));
 return x.stdout.trim();
};
const q=id=>{assert.match(id,/^[0-9a-f0-9-]{36}$/i);return "'"+id+"'";};
const client=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
});
const installed=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1",
 "-v","T30_DISPOSABLE_LOCAL_CONFIRMED=true",
 "-f","scripts/integration/c34/t30_disposable_town_role_capabilities_pg17.sql"],
 {cwd:root,env,encoding:"utf8",timeout:30000});
assert.equal(installed.status,0,"T30 installation FAILED: "+installed.stderr?.slice(-1600));
const makeRole=async role=>{
 const who=client(),email="t30-"+role+"-"+randomUUID()+"@example.invalid";
 const password="T30-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const user=await who.auth.getUser();assert.ifError(user.error);
 const id=user.data.user.id;
 sql("INSERT INTO public.user_profiles(id,role) VALUES("+q(id)+",'"+role+
   "') ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role");
 return {who,id,email,password};
};
const actors={};
for(const role of ["admin","gm","dm","player","editor","unknown","GM"])
 actors[role]=await makeRole(role);
// This local fixture's original Stage2 Admin predicate uses test_admins;
// both strict Admin authorities must agree, never broaden is_admin(uid).
sql("INSERT INTO private.test_admins(id) VALUES("+q(actors.admin.id)+") ON CONFLICT DO NOTHING");
const npc=sql("SELECT id::text FROM public.characters WHERE name='T22 Profile NPC' AND kind='npc' LIMIT 1");
assert.match(npc,/^[a-f0-9-]{36}$/i,"T22 genuine signed NPC fixture missing");
const secret="T22_GM_DOSSIER_NEVER_PUBLIC";
const expectRole=async (who,role)=>{
 const cap=await readTownRoleCapabilitiesCandidate(who);
 assert.equal(cap.status,"ok",role+" "+JSON.stringify(cap));
 assert.equal(cap.capabilities.role,role);
 const full=role==="admin",commerce=["admin","gm","dm"].includes(role);
 assert.equal(cap.capabilities.isAdmin,full);
 assert.equal(cap.capabilities.canReadNpcDossier,full);
 assert.equal(cap.capabilities.canEditWorldTravel,full);
 assert.equal(cap.capabilities.canEditCharacterPrivacy,full);
 assert.equal(cap.capabilities.canEditMerchantStock,commerce);
 assert.equal(cap.capabilities.canSetPlayerGold,commerce);
 return cap;
};
for(const role of ["admin","gm","dm","player","editor","unknown","GM"]){
 const {who}=actors[role];
 await expectRole(who,role);
 const profile=await readTownNpcProfileCandidate(who,npc,{withDossier:true});
 assert.equal(profile.status,"ok",role+" public NPC profile "+JSON.stringify(profile));
 assert.ok(profile.profile);
 assert.equal(JSON.stringify(profile.profile).includes(secret),false,role+" public secret");
 assert.equal(profile.roleCapabilities.canReadNpcDossier,role==="admin");
 if(role==="admin"){
  assert.equal(profile.dossier?.secret,secret);
  console.log("PASS T30-ROLE-ADMIN: signed strict Admin dossier plus public profile without secret");
 }else{
  assert.equal(profile.dossier,null,role+" obtained forbidden dossier");
  const direct=await who.rpc("get_npc_dossier_admin_v1",{p_character_id:npc});
  assert.ok(direct.error,role+" direct Stage2 dossier incorrectly allowed");
  assert.notEqual(direct.error?.code,"PGRST202",role+" Stage2 RPC not exposed");
  if(role==="gm"||role==="dm")
   console.log("PASS T30-ROLE-"+role.toUpperCase()+": commerce true; strict travel/dossier false; source Stage2 denial");
 }
 if(role==="player"||role==="unknown"||role==="GM"){
  const edit=await who.rpc("get_character_editor_narrative_v1",{p_character_id:npc});
  assert.equal(edit.error,null,role+" Stage2 editor RPC");
  assert.equal(edit.data,null,role+" private editor lore leaked");
 }
}
const anon=client();
const anonRpc=await anon.rpc("c34_town_role_capabilities_research_v1");
assert.ok(anonRpc.error,"anonymous capability probe must not execute");
assert.equal((await readTownRoleCapabilitiesCandidate(anon)).status,"unauthenticated");
console.log("PASS T30-ANON: no anonymous role-probe or private Profile");
const gm=actors.gm;
sql("UPDATE public.user_profiles SET role='player' WHERE id="+q(gm.id));
const demoted=await expectRole(gm.who,"player");
assert.equal(demoted.capabilities.canEditMerchantStock,false);
const after=await readTownNpcProfileCandidate(gm.who,npc,{withDossier:true});
assert.equal(after.dossier,null);assert.equal(after.roleCapabilities.canReadNpcDossier,false);
console.log("PASS T30-REVOKE: same JWT GM demoted to player, commerce and private UI disappear on next read");
const shared=client();
let s=await shared.auth.signInWithPassword({email:actors.dm.email,password:actors.dm.password});
assert.ifError(s.error);
await expectRole(shared,"dm");
s=await shared.auth.signOut();assert.ifError(s.error);
assert.equal((await readTownRoleCapabilitiesCandidate(shared)).status,"unauthenticated");
s=await shared.auth.signInWithPassword({email:actors.player.email,password:actors.player.password});
assert.ifError(s.error);
await expectRole(shared,"player");
console.log("PASS T30-SWITCH: same client DM logout to player loses stock/dossier/travel rights");
assert.equal(sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))"),
 "1dbe8c24c4c718396d7256f6f7465354");
console.log("PASS T30-SIGNED: original Stage1/2 safe projection and T29 commerce role source on disposable signed PG17; no hosted SQL");

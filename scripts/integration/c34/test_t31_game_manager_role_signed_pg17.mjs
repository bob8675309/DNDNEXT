#!/usr/bin/env node
// C34 T31 GENUINE disposable PG17/GoTrue/PostgREST. Runs AFTER T30's old
// strict-Admin tests and T29's scoped-commerce negatives; both are preserved.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readTownGameManagerCapabilitiesCandidate,readTownGameManagerNpcProfileCandidate }
 from "../../../utils/c34/t31GameManagerRoleProfileCandidate.mjs";
const env=process.env,root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
for(const [k,v] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
 PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 C34_T31_ROLE_CONFIRM:"OWNER_REVISED_EQUAL_GAME_ADMIN_LOCAL_ONLY",
}))assert.equal(env[k],v,"T31 unsafe environment "+k);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
const sql=q=>{
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",q],
  {cwd:root,env,encoding:"utf8",timeout:30000});
 assert.equal(r.status,0,"T31 disposable SQL "+r.stderr?.slice(-1600));
 return r.stdout.trim();
};
const quoted=id=>{assert.match(id,/^[0-9a-f-]{36}$/i);return "'"+id+"'";};
const client=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
});
const install=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1",
 "-v","T31_DISPOSABLE_LOCAL_CONFIRMED=true",
 "-f","scripts/integration/c34/t31_disposable_game_manager_role_unification_pg17.sql"],
 {cwd:root,env,encoding:"utf8",timeout:30000});
assert.equal(install.status,0,"T31 SQL install failed "+install.stderr?.slice(-1600));
async function make(role){
 const who=client(),email="t31-"+role+"-"+randomUUID()+"@example.invalid";
 const password="T31-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const user=await who.auth.getUser();assert.ifError(user.error);
 const id=user.data.user.id;
 sql("INSERT INTO public.user_profiles(id,role) VALUES("+quoted(id)+",'"+role+
 "') ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role");
 return {who,id,email,password};
}
const actors={};
for(const role of ["admin","gm","dm","player","editor","unknown","GM"])
 actors[role]=await make(role);
const npc=sql("SELECT id::text FROM public.characters WHERE name='T22 Profile NPC' AND kind='npc' LIMIT 1");
const merchant=sql("SELECT id::text FROM public.characters WHERE name='T26 Probe Merchant' AND kind='merchant' LIMIT 1");
const creator=sql("SELECT id::text FROM public.characters WHERE name='T22 signed source creator' AND 'player-character'=ANY(tags) LIMIT 1");
for(const [key,id] of Object.entries({npc,merchant,creator}))
 assert.match(id,/^[a-f0-9-]{36}$/i,"missing T22/T26 original local "+key);
const expectedSecret="T22_GM_DOSSIER_NEVER_PUBLIC";
async function expectRole(who,role){
 const r=await readTownGameManagerCapabilitiesCandidate(who);
 assert.equal(r.status,"ok",role+" role query "+JSON.stringify(r));
 assert.equal(r.capabilities.role,role);
 const manager=["admin","gm","dm"].includes(role);
 for(const k of ["isGameManager","isAdmin","canEditMerchantStock","canSetPlayerGold",
 "canEditWorldTravel","canReadNpcDossier","canEditCharacterPrivacy",
 "canManageNpcPlayers","canManageCharacterInventory"])
  assert.equal(r.capabilities[k],manager,role+" "+k);
 return r;
}
for(const role of ["admin","gm","dm","player","editor","unknown","GM"]){
 const {who}=actors[role];
 await expectRole(who,role);
 const p=await readTownGameManagerNpcProfileCandidate(who,npc,{withDossier:true});
 assert.equal(p.status,"ok",role+" NPC profile "+JSON.stringify(p));
 assert.equal(JSON.stringify(p.profile).includes(expectedSecret),false,role+" public secret");
 if(["admin","gm","dm"].includes(role)){
  assert.equal(p.dossier?.secret,expectedSecret,role+" Stage2 dossier");
  const direct=await who.rpc("get_npc_dossier_admin_v1",{p_character_id:npc});
  assert.ifError(direct.error);assert.equal(direct.data?.secret,expectedSecret);
  const secrets=await who.rpc("get_character_secrets_v1",{p_character_ids:[npc]});
  assert.ifError(secrets.error);
  assert.equal(secrets.data?.find(x=>x.character_id===npc)?.secret,expectedSecret);
  const ownerProfile=await readTownGameManagerNpcProfileCandidate(who,creator,{
   withSheet:true,withPrivateBackstory:true,
  });
  assert.equal(ownerProfile.status,"ok",role+" player sheet/story");
  assert.ok(ownerProfile.sheet && typeof ownerProfile.sheet==="object",role+" sheet");
  // Earlier genuine T22 browser edits Story: verify persisted latest state, not the creation draft.
  assert.equal(ownerProfile.privateBackstory,"T22_CREATOR_EDITED_PRIVATE_STORY",role+" Story");
  assert.equal(ownerProfile.capabilities.canPrint,true);
  assert.equal(ownerProfile.capabilities.canEditBackstory,true);
  const staffWallet=await who.rpc("wallet_set",{p_user:actors.admin.id,p_amount:role==="admin"?31:role==="gm"?41:51});
  assert.ifError(staffWallet.error);
  assert.ok(Number(staffWallet.data)>=0);
  const crossWallet=await who.rpc("wallet_get",{p_user:actors.admin.id});
  assert.ifError(crossWallet.error);assert.equal(Number(crossWallet.data),Number(staffWallet.data));
  const stock=await who.from("character_stock").insert({
   character_id:npc,display_name:"T31 "+role+" NPC stock",price_gp:3,qty:2,
   card_payload:{item_type:"Potion",item_name:"T31 NPC stock"},
  }).select("id").single();
  assert.ifError(stock.error);
  assert.match(stock.data.id,/^[0-9a-f-]{36}$/i);
  const del=await who.from("character_stock").delete().eq("id",stock.data.id).select("id").single();
  assert.ifError(del.error);assert.equal(del.data.id,stock.data.id);
  console.log("PASS T31-ROLE-"+role.toUpperCase()+
   ": original Stage2 dossier, Stage3 GM secret, creator Story, canonical sheet, NPC stock and cross-staff GP");
 }else{
  assert.equal(p.dossier,null);
  const direct=await who.rpc("get_npc_dossier_admin_v1",{p_character_id:npc});
  assert.ok(direct.error,"unprivileged signed dossier must deny "+role);
  assert.notEqual(direct.error.code,"PGRST202");
  const secrets=await who.rpc("get_character_secrets_v1",{p_character_ids:[npc]});
  assert.ifError(secrets.error);assert.equal(secrets.data?.length,0);
  const wallet=await who.rpc("wallet_set",{p_user:actors.admin.id,p_amount:999});
  assert.ok(wallet.error,role+" wallet modification must deny");
  const inv=await who.from("character_stock").insert({
   character_id:npc,display_name:"T31 FORBIDDEN "+role,price_gp:3,qty:1,card_payload:{},
  }).select("id");
  assert.ok(inv.error,role+" NPC stock insert must deny");
 }
}
const anon=client();
assert.ok((await anon.rpc("c34_game_manager_capabilities_research_v1")).error);
assert.equal((await readTownGameManagerCapabilitiesCandidate(anon)).status,"unauthenticated");
console.log("PASS T31-ANON: cannot read game manager capabilities/dossier");
const gm=actors.gm;
sql("UPDATE public.user_profiles SET role='player' WHERE id="+quoted(gm.id));
await expectRole(gm.who,"player");
assert.equal((await readTownGameManagerNpcProfileCandidate(gm.who,npc,{withDossier:true})).dossier,null);
assert.ok((await gm.who.rpc("get_npc_dossier_admin_v1",{p_character_id:npc})).error);
assert.ok((await gm.who.rpc("wallet_set",{p_user:actors.admin.id,p_amount:999})).error);
console.log("PASS T31-REVOKE: demoted GM loses all game-master privileges in the same JWT");
const same=client();
let s=await same.auth.signInWithPassword({email:actors.dm.email,password:actors.dm.password});
assert.ifError(s.error);await expectRole(same,"dm");
s=await same.auth.signOut();assert.ifError(s.error);
assert.equal((await readTownGameManagerCapabilitiesCandidate(same)).status,"unauthenticated");
s=await same.auth.signInWithPassword({email:actors.player.email,password:actors.player.password});
assert.ifError(s.error);await expectRole(same,"player");
assert.ok((await same.rpc("get_npc_dossier_admin_v1",{p_character_id:npc})).error);
console.log("PASS T31-SWITCH: DM logout→player same session, no stale GM dossier or control");
assert.equal(sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))"),
 "1dbe8c24c4c718396d7256f6f7465354");
console.log("PASS T31-SIGNED: Admin/GM/DM equal GAME administration, source SQL unchanged, disposable only");

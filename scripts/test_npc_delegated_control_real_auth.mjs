#!/usr/bin/env node
// Three REAL GoTrue-issued sessions: GM + two players. Staging ONLY.
// Default: read-only identity preflight. Mutations require an isolated,
// prefixed staging NPC fixture and exact opt-in. NEVER accepts production.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const e=process.env;
const prodRef="ucggczovhmauhshvhusx";
const url=e.DNDNEXT_NPC_STAGING_URL;
const key=e.DNDNEXT_NPC_STAGING_PUBLISHABLE_KEY;
if(!url||!key) throw new Error("Separate staging URL and publishable key required");
const parsed=new URL(url);
const hosted=/^([a-z0-9-]+)\.supabase\.co$/.exec(parsed.hostname);
const local=(parsed.hostname==="127.0.0.1"||parsed.hostname==="localhost")
  && parsed.protocol==="http:" && parsed.port==="54321"
  && e.DNDNEXT_NPC_ALLOW_LOCAL==="YES_LOCAL_GOTRUE_ONLY";
if(parsed.pathname!=="/" || parsed.search || parsed.hash ||
   (hosted && (parsed.protocol!=="https:"||hosted[1]===prodRef)) ||
   (!hosted&&!local))
  throw new Error("Only separate Supabase staging or explicitly enabled local GoTrue is permitted");
if(/^eyJ|service_role/i.test(key)) throw new Error("Never provide a service/secret/JWT key");
const principals=["ADMIN","A","B"].map(label=>({
  label,
  email:e["DNDNEXT_NPC_TEST_"+label+"_EMAIL"],
  password:e["DNDNEXT_NPC_TEST_"+label+"_PASSWORD"]
}));
if(principals.some(p=>!p.email||!p.password))
  throw new Error("Admin and two distinct player staging credentials required");
assert.equal(new Set(principals.map(p=>p.email.toLowerCase())).size,3,
  "Three distinct staging accounts are required");
async function signIn(person){
  const client=createClient(url,key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
  const {data:login,error:loginError}=await client.auth.signInWithPassword({
    email:person.email,password:person.password
  });
  if(loginError || !login?.session?.access_token)
    throw new Error(person.label+" GoTrue sign-in failed");
  const {data:checked,error:authError}=await client.auth.getUser();
  const {data:claims,error:claimsError}=await client.auth.getClaims();
  if(authError||claimsError||!checked?.user?.id||!claims?.claims||
     checked.user.id!==login.user.id ||
     claims.claims.sub!==checked.user.id ||
     claims.claims.role!=="authenticated" ||
     checked.user.is_anonymous===true || claims.claims.is_anonymous===true)
    throw new Error(person.label+" GoTrue claims failed verification");
  return {client,uid:checked.user.id,label:person.label};
}
const [admin,a,b]=await Promise.all(principals.map(signIn));
assert.equal(new Set([admin.uid,a.uid,b.uid]).size,3);
const [adminCheck,aCheck,bCheck]=await Promise.all([
  admin.client.rpc("is_admin"),a.client.rpc("is_admin"),b.client.rpc("is_admin")
]);
if(adminCheck.error||adminCheck.data!==true||
   aCheck.error||aCheck.data!==false||
   bCheck.error||bCheck.data!==false)
  throw new Error("Expected one genuine Admin and two ordinary users (no service role)");
console.log("PASS: 3 genuine non-anonymous Supabase Auth identities and Admin/player separation");
const confirm="YES_DISPOSABLE_NPC_GRANTS_ONLY";
if(e.DNDNEXT_NPC_MUTATING_TEST_CONFIRM!==confirm){
  console.log("PREFLIGHT ONLY: no permissions altered; set exact opt-in with disposable staging IDs for further tests");
  process.exit(0);
}
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const npc=e.DNDNEXT_NPC_DISPOSABLE_CHARACTER_ID;
const participant=e.DNDNEXT_NPC_DISPOSABLE_PARTICIPANT_ID;
const encounter=e.DNDNEXT_NPC_DISPOSABLE_ENCOUNTER_ID;
if(![npc,participant,encounter].every(x=>uuid.test(x||"")))
  throw new Error("All three explicit disposable staging UUIDs required");
const {data:char,error:charError}=await admin.client.from("characters")
  .select("id,name,kind").eq("id",npc).single();
if(charError || !char || char.kind!=="npc" ||
   !char.name.startsWith("NPC CTRL TEST - "))
  throw new Error("Refusing non-disposable NPC target");
const {data:token,error:tokenError}=await admin.client.from("encounter_participants")
  .select("id,character_id,encounter_id,is_hidden,controller_user_id")
  .eq("id",participant).single();
if(tokenError||!token||token.character_id!==npc||
   token.encounter_id!==encounter||token.is_hidden!==true||
   token.controller_user_id===a.uid||token.controller_user_id===b.uid)
  throw new Error("Test requires named disposable hidden NPC token without direct player controllers");
const {data:existing,error:readError}=await admin.client
 .from("character_permissions").select("user_id,can_control,can_edit")
 .eq("character_id",npc).in("user_id",[a.uid,b.uid]);
if(readError||!Array.isArray(existing)||existing.some(x=>x.can_control||x.can_edit))
  throw new Error("Test requires both players to start without delegated/editor access");
// Verify staging RLS is configured to allow only assigned players to see
// hidden encounter tokens, not unrestricted player SELECT.
for(const actor of [a,b]){
  const {data, error}=await actor.client.rpc("encounter_can_control_participant_v1",
    {p_participant_id:participant});
  if(error||data!==false)
    throw new Error("Already controls NPC before opt-in: "+actor.label);
}
async function assign(actor,flag){
  const {data,error}=await admin.client.rpc("admin_set_npc_control_v1",{
    p_character_id:npc,p_user_id:actor.uid,p_can_control:flag
  });
  if(error||data?.userId!==actor.uid||
     data?.characterId!==npc||data?.canControl!==flag||data?.canEdit!==false)
    throw new Error("Admin delegated grant result invalid: "+actor.label);
}
async function verify(actor,allowed){
  const [{data:canControl,error:controlError},{data:rows,error:rowError}]=await Promise.all([
    actor.client.rpc("encounter_can_control_participant_v1",
      {p_participant_id:participant}),
    actor.client.from("encounter_participants").select("id")
      .eq("id",participant)
  ]);
  if(controlError||rowError||canControl!==allowed||
     !Array.isArray(rows)||(allowed?rows.length!==1:rows.length!==0))
    throw new Error("NPC control/hidden-token visibility mismatch for "+actor.label);
}
let changed=false;
try{
  await assign(a,true);
  changed=true;
  await assign(b,true);
  await Promise.all([verify(a,true),verify(b,true)]);
  await assign(a,false);
  await Promise.all([verify(a,false),verify(b,true)]);
  console.log("PASS: real signed-in Admin granted 2 players one hidden NPC, revoked one, and server RLS preserved the other");
}finally{
  if(changed){
    const cleanups=await Promise.allSettled([assign(a,false),assign(b,false)]);
    if(cleanups.some(r=>r.status==="rejected"))
      throw new Error("STAGING CLEANUP FAILED: manually inspect both NPC delegated grants");
  }
}
console.log("NOTE: This is grant/RLS acceptance only. Actual two-controller combat Action race requires a separate disposable staging fixture.");

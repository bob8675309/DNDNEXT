#!/usr/bin/env node
// I2-F: private sourceChoices + species runtime helper source-RED and isolated
// owner Option A no-account-mirror GREEN, AFTER unchanged signed I1B..O,
// I2C-01..10, I2D-01..11 and I2E-01..11 regression acceptance.
// The CHARACTERS are signed v3/Story-created; PRIVATE helper invocations
// are LOCAL PRIVILEGED PG17 SQL, NOT signed exposed RPCs. Do not mislabel.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";

const e=process.env;
for(const [k,v] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"55622",
 PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_I1G_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 DNDNEXT_I2C_LOCAL_CONFIRM:"DISPOSABLE_I2C_OPTION_A_CREATION_ONLY",
 DNDNEXT_I2D_LOCAL_CONFIRM:"DISPOSABLE_I2D_PRIVATE_V3_STORY_ONLY",
 DNDNEXT_I2E_LOCAL_CONFIRM:"DISPOSABLE_I2E_HP_ADMIN_RAGE_ONLY",
 DNDNEXT_I2F_LOCAL_CONFIRM:"DISPOSABLE_I2F_PRIVATE_SOURCE_SPECIES_ONLY"
}))assert.equal(e[k],v,"I2-F must NEVER use a hosted or non-CI database: "+k);
assert.match(e.DNDNEXT_I1G_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:55621\/?$/);
assert.ok(e.DNDNEXT_I1G_LOCAL_ANON_KEY);
const make=()=>createClient(e.DNDNEXT_I1G_LOCAL_URL,e.DNDNEXT_I1G_LOCAL_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const local=(args,expectFailure=false)=>{
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1",...args],{
  encoding:"utf8",env:e,timeout:45000
 });
 if(expectFailure){assert.notEqual(r.status,0,"SQL unexpectedly succeeded");return (r.stderr||"")+" "+(r.stdout||"");}
 assert.equal(r.status,0,"I2F disposable psql: "+(r.stderr||"").slice(-2300)+"\n"+(r.stdout||"").slice(-700));
 return r.stdout.trim();
};
const sql=q=>local(["-qAt","-c",q]);
const failSql=q=>local(["-qAt","-c",q],true);
const fixture=p=>local(["-q","-f",p]);
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
const md5=sig=>sql("SELECT md5(pg_get_functiondef("+lit(sig)+"::regprocedure))");
const sheet=id=>sql("SELECT sheet::text FROM public.character_sheets WHERE character_id="+lit(id));
const legacy=w=>sql("SELECT sheet::text FROM public.players WHERE user_id="+lit(w.id));
const stamp=w=>sql("SELECT updated_at::text FROM public.players WHERE user_id="+lit(w.id));
const profile=w=>sql("SELECT name FROM public.players WHERE user_id="+lit(w.id));
const story=id=>sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id="+lit(id));
const sourceChoices=id=>sql("SELECT coalesce(jsonb_typeof(sheet->'sourceChoices'),'null') FROM public.character_sheets WHERE character_id="+lit(id));
const projection=(id,key)=>sql("SELECT (sheet#>"+lit("{runtimeProficiencies,"+key+"}")+")::text FROM public.character_sheets WHERE character_id="+lit(id));
const snapshot=actors=>actors.map(w=>({actor:w,sheet:legacy(w),stamp:stamp(w)}));
const unchanged=(snaps,label)=>{
 for(const x of snaps){
  assert.equal(legacy(x.actor),x.sheet,label+" must preserve "+x.actor.name+" players.sheet");
  assert.equal(stamp(x.actor),x.stamp,label+" must preserve "+x.actor.name+" players.updated_at");
 }
};
async function actor(name) {
 const client=make(),email="i2f-"+randomUUID()+"@example.invalid";
 const password="I2F-"+randomUUID()+"-X!";
 assert.ifError((await client.auth.signUp({email,password,options:{data:{display_name:name}}})).error);
 const login=await client.auth.signInWithPassword({email,password});
 assert.ifError(login.error);
 const claims=await client.auth.getClaims();assert.ifError(claims.error);
 assert.equal(claims.data.claims.role,"authenticated");
 assert.equal(claims.data.claims.sub,login.data.user.id);
 const w={name,client,id:login.data.user.id};
 assert.equal(legacy(w),"{}");
 assert.equal(profile(w),name);
 return w;
}
const wait=ms=>new Promise(ok=>setTimeout(ok,ms));
async function rpc(w,name,args) {
 for(let i=0;i<35;i++){
  const r=await w.client.rpc(name,args);
  if(r.error?.code==="PGRST202"){await wait(200);continue;}
  return r;
 }
 throw Error("I2F signed local RPC unavailable: "+name);
}
async function create(w,label) {
 const nonce=randomUUID(),privateStory="I2F synthetic private Story: "+label;
 const payload={
  name:label,creation_request_id:nonce,secret:null,
  sheet:{classKey:"fighter",level:1,hp:12,maxHp:12,tempHp:0,
    startingEquipmentSelections:{mode:"package",classOption:"A",ruleset:"vanilla"}}
 };
 const r=await rpc(w,"create_player_character_with_private_backstory_v1",{
  p_payload:payload,p_spell_choices:[],p_magic_selections:[],p_private_backstory:privateStory
 });
 assert.ifError(r.error);
 assert.ok(r.data,"no signed Fighter");
 const id=r.data;
 assert.equal(JSON.parse(sheet(id)).meta.creationRequestId,nonce);
 assert.equal(story(id),privateStory);
 assert.equal(Number(sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='character' AND owner_id="+lit(id)+" AND card_payload->>'startingEquipment'='true'")),1);
 return {id,nonce,story:privateStory};
}
const injectOld=(actor,id)=>{
 sql("UPDATE public.players SET sheet=(SELECT sheet FROM public.character_sheets WHERE character_id="+lit(id)+"),updated_at=now() WHERE user_id="+lit(actor.id));
 assert.equal(legacy(actor),sheet(id));
};
const ensure=id=>sql("SELECT private.ensure_character_source_choices_v1("+lit(id)+")");
const species=(id,key,state)=>sql("SELECT private.set_species_runtime_projection_v1("+lit(id)+","+lit(key)+","+
 (state===null?"NULL":lit(JSON.stringify(state))+"::jsonb")+")");
const removeSourceChoices=id=>{
 sql("UPDATE public.character_sheets SET sheet=sheet-'sourceChoices' WHERE character_id="+lit(id));
 assert.equal(sourceChoices(id),"null","synthetic original sourceChoices missing for "+id);
};
const sigA="private.ensure_character_source_choices_v1(uuid)",
 sigB="private.set_species_runtime_projection_v1(uuid,text,jsonb)";
const originalA="69bedf66148d2ce3dab97baa5de606cc",
 originalB="7f6e7d7d99ff79db1372462b4320c21b";
const deniedPrivate=()=>{
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+lit(sigA)+",'EXECUTE')"),"f");
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+lit(sigB)+",'EXECUTE')"),"f");
};
fixture("scripts/fixtures/i2f_original_source_species_projection_shared_forge_pg17.sql");
assert.equal(md5(sigA),originalA);assert.equal(md5(sigB),originalB);
assert.equal(md5("public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)"),
 "6e39477f971c9d40c6726c9f4dbc456e");
deniedPrivate();
console.log("PASS I2F-01: installed both exact original deployed private helper MD5s, authenticated EXECUTE denied and inherited public v3/private Story source unchanged");

const owner=await actor("I2F signed owner"),
 editor=await actor("I2F signed delegated editor"),
 outsider=await actor("I2F signed outsider"),
 historical=await actor("I2F signed historical archive");
const A=await create(owner,"I2F owner canonical Fighter A");
const B=await create(owner,"I2F owner canonical Fighter B");
const D=await create(editor,"I2F editor canonical Fighter D");
sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert) VALUES ("+
 lit(B.id)+","+lit(editor.id)+",false,true,false)"+
 " ON CONFLICT(character_id,user_id) DO UPDATE SET can_edit=true");
assert.equal(sql("SELECT count(*) FROM public.character_permissions WHERE character_id="+lit(B.id)+" AND can_edit"),"2");
const canonicalA=sheet(A.id),canonicalD=sheet(D.id);
injectOld(owner,A.id);injectOld(editor,D.id);
sql("UPDATE public.players SET sheet="+lit(JSON.stringify({archive:"I2F synthetic historical, no creation marker",level:11}))+
 "::jsonb WHERE user_id="+lit(historical.id));
const archived=legacy(historical),oldName=profile(historical);
assert.equal(sql("SELECT sheet#>>'{meta,creationRequestId}' FROM public.players WHERE user_id="+lit(historical.id)),"");
assert.equal(legacy(outsider),"{}");
removeSourceChoices(B.id); // only local synthetic sourceChoices absence
const redBaseline=snapshot([owner,editor,historical,outsider]);
console.log("PASS I2F-02: real signed private-Story Forge Fighter A/B/D, two editable accounts, canonical sourceChoices absence fixture, and unmarked archived snapshot");

ensure(B.id); // PRIVILEGED LOCAL SQL, NOT signed RPC
assert.equal(sourceChoices(B.id),"object");
assert.equal(legacy(owner),sheet(B.id));
assert.equal(legacy(editor),sheet(B.id));
assert.notEqual(legacy(owner),redBaseline[0].sheet);
assert.notEqual(legacy(editor),redBaseline[1].sheet);
assert.equal(sheet(A.id),canonicalA);
assert.equal(sheet(D.id),canonicalD);
assert.equal(legacy(historical),archived);
console.log("PASS I2F-03 EXPECTED ORIGINAL SOURCECHOICES RED: private helper invoked locally on SIGNED-created B fills canonical sourceChoices but overwrites BOTH unrelated owner/editor legacy snapshots");

injectOld(owner,A.id);injectOld(editor,D.id);
const speciesState={testOnly:true,source:"I2F synthetic species runtime projection",prof:"Arcana"};
species(B.id,"i2f-species-test",speciesState); // PRIVILEGED LOCAL SQL
assert.deepEqual(JSON.parse(projection(B.id,"i2f-species-test")),speciesState);
assert.equal(legacy(owner),sheet(B.id));
assert.equal(legacy(editor),sheet(B.id));
assert.equal(legacy(historical),archived);
assert.equal(sheet(A.id),canonicalA);
console.log("PASS I2F-04 EXPECTED ORIGINAL SPECIES PROJECTION RED: private helper writes canonical runtime state and overwrites BOTH unrelated legacy account sheets");

// Only after original REDs install new scratch no-account-writer candidate.
fixture("scripts/fixtures/i2f_option_a_source_species_projection_scratch_pg17.sql");
for(const [sig,original] of [[sigA,originalA],[sigB,originalB]]){
 const body=sql("SELECT lower(pg_get_functiondef("+lit(sig)+"::regprocedure))");
 assert.ok(!body.includes("update public.players"),"I2F original account writer not removed: "+sig);
 assert.ok(body.includes("i2f_option_a_no_legacy_projection_write"));
 assert.notEqual(md5(sig),original);
}
deniedPrivate();
console.log("PASS I2F-05: source-reversible scratch two-writer Option A freeze installed AFTER original REDs; private direct EXECUTE still denied, original v3/Story/nonce intact");

// Match owner account to A (target), match editor to B (target for species).
injectOld(owner,A.id);injectOld(editor,B.id);
const frozen=snapshot([owner,editor,historical,outsider]);
removeSourceChoices(A.id);
const beforeA=sheet(A.id);
ensure(A.id);
assert.equal(sourceChoices(A.id),"object");
assert.notEqual(sheet(A.id),beforeA);
unchanged(frozen,"same-character canonical sourceChoices ensure A");
assert.equal(sourceChoices(B.id),"object","B must have valid source choices before synthetic removal");
removeSourceChoices(B.id);
const beforeB=sheet(B.id);
ensure(B.id);
assert.equal(sourceChoices(B.id),"object");
assert.notEqual(sheet(B.id),beforeB);
unchanged(frozen,"coeditor matching sourceChoices ensure B");
console.log("PASS I2F-06: sourceChoices absence repaired canonically for matching owner+editor characters while legacy sheets and timestamps remain frozen");

// The helper is idempotent for a valid existing object and should not update
// either canonical or old sheet when invoked repeatedly.
const afterA=sheet(A.id),canStamp=sql("SELECT updated_at::text FROM public.character_sheets WHERE character_id="+lit(A.id));
ensure(A.id);
assert.equal(sheet(A.id),afterA);
assert.equal(sql("SELECT updated_at::text FROM public.character_sheets WHERE character_id="+lit(A.id)),canStamp);
unchanged(frozen,"idempotent sourceChoices existing object");
console.log("PASS I2F-07: sourceChoices helper is idempotent for already-valid canonical state with no canonical timestamp or account mirror mutation");

const state1={testOnly:true,origin:"I2F synthetic runtime",skills:["Perception"]};
species(B.id,"i2f-species-test",state1);
assert.deepEqual(JSON.parse(projection(B.id,"i2f-species-test")),state1);
unchanged(frozen,"same-character synthetic species runtime set");
const state2={testOnly:true,origin:"I2F second runtime state",skills:["Survival"]};
species(A.id,"i2f-species-other",state2);
assert.deepEqual(JSON.parse(projection(A.id,"i2f-species-other")),state2);
unchanged(frozen,"different-character species runtime set");
console.log("PASS I2F-08: two locally invoked species runtime projection writes update only intended canonicals; both matching/unrelated legacy accounts remain byte/timestamp-identical");

species(B.id,"i2f-species-test",null);
assert.equal(projection(B.id,"i2f-species-test"),"");
assert.ok(JSON.parse(sheet(B.id)).runtimeProficiencies);
unchanged(frozen,"species runtime projection removal");
const nonexistent=randomUUID();
species(nonexistent,"i2f-species-test",state1);
assert.equal(sql("SELECT count(*) FROM public.character_sheets WHERE character_id="+lit(nonexistent)),"0");
unchanged(frozen,"species no-op missing canonical sheet");
console.log("PASS I2F-09: null state removes only selected runtime projection and missing canonical character is a no-op, without touching any old account sheet");

// Missing sheet for sourceChoices remains an error; illegal cross-user
// direct sheet updates remain denied. Private helpers never become RPCs.
const noSheet=randomUUID();
const err=failSql("SELECT private.ensure_character_source_choices_v1("+lit(noSheet)+")");
assert.match(err,/Character sheet is unavailable/i);
const outsiderWrite=await outsider.client.from("players")
 .update({sheet:{attack:"I2F"}}).eq("user_id",outsider.id).select("user_id");
assert.ok(outsiderWrite.error);
assert.equal(outsiderWrite.error.code,"42501");
deniedPrivate();
unchanged(frozen,"missing sourceChoices and signed sheet-write rejection");
assert.equal(story(A.id),A.story);assert.equal(story(B.id),B.story);
assert.equal(story(D.id),D.story);
assert.equal(legacy(historical),archived);
assert.equal(profile(historical),oldName);
console.log("PASS I2F-10: original missing-character guard, signed client sheet-update denial, private EXECUTE isolation, historical archive and private Story remain safe");

// Existing account/profile name editing remains available after freeze;
// the helper never changes account name or relevant app metadata.
const rename=await owner.client.from("players")
 .update({name:"I2F new profile display"}).eq("user_id",owner.id)
 .select("name").single();
assert.ifError(rename.error);
assert.equal(rename.data.name,"I2F new profile display");
unchanged(frozen,"legitimate account-name edit");
assert.equal(md5("private.create_player_character_v2_source_20261105(jsonb,jsonb)"),
 "00b2167041b9c2e4e1a98d3873839f37");
assert.equal(md5("public.create_player_character_v3(jsonb,jsonb,jsonb)"),
 "ab48d46376075a79b3f5a5de21fdada6");
assert.equal(md5("public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)"),
 "6e39477f971c9d40c6726c9f4dbc456e");
console.log("PASS I2F-11: signed profile-name edits and original public v3/Story/private source fingerprints intact; no legacy sheet mutation");
console.log("I2F RESULT: 2 ORIGINAL private projection functions on genuine signed-created chars, PRIVILEGED local invocations reproduce old-account overwrite REDs; exact-source scratch GREEN proves zero legacy writes while preserving canonical source/species projection. 9/34 original writer families bounded, 25 original UPDATE writers untested. NOT signed private helper RPC/production/full 31-trigger acceptance, NO hosted SQL/app changes.");

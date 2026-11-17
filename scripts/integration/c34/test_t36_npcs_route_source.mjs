#!/usr/bin/env node
// C34 T36 exact-source default-OFF full NPC manager real-route research.
import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
 makeT36Source,t36ResearchEnabled,reconcileT36Route,T36_LOCAL_ROUTE,T36_MARKER,
 T36_REWRITE,T36_FLAG,T36_RESEARCH_CONFIRM,
} from "./prepare_t36_npcs_route.mjs";
import {deriveT35FullManager} from "./derive_t35_full_npc_manager.mjs";
import {T25_BASE_BLOB} from "./derive_t25_current_npc_manager.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>readFileSync(path.join(root,p),"utf8");
const blob=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");
test("T36-01 original /npcs page is byte identical and no generated research route is committed",()=>{
 assert.equal(blob(read("pages/npcs.js")),T25_BASE_BLOB);
 assert.equal(T25_BASE_BLOB,"7fc00b9b3ace6233d1648a3d017f8a05e072d722");
 assert.equal(existsSync(path.join(root,T36_LOCAL_ROUTE)),false);
 assert.equal(existsSync(path.join(root,"pages/__c34_t35_probe.jsx")),false);
 assert.equal(existsSync(path.join(root,"pages/__c34_t25_probe.jsx")),false);
 const conf=read("next.config.mjs");
 assert.match(conf,/reconcileT36Route\(process\.env\)/);
 assert.ok(conf.includes("beforeFiles:[{...T36_REWRITE}]"),
  "Only Next beforeFiles can override the existing physical /npcs page");
 assert.ok(conf.includes(": [];"),
  "Flag OFF must return empty rewrites");
 assert.doesNotMatch(read("pages/npcs.js"),/T36_REWRITE|NEXT_PUBLIC_C34_T36_NPCS_RESEARCH/);
});
test("T36-02 default OFF is strictly opt-in; hosted flags and unsigned roles cannot turn on the route",()=>{
 const blank={};
 for(const flag of [undefined,"","0","false","true","yes","01","2","on"]){
  assert.equal(t36ResearchEnabled({...blank,[T36_FLAG]:flag}),false);
 }
 const signed={CI:"true",GITHUB_ACTIONS:"true",
  PGHOST:"127.0.0.1",PGPORT:"54322",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  C34_T36_LOCAL_CONFIRM:T36_RESEARCH_CONFIRM,
  [T36_FLAG]:"1",VERCEL:"0"};
 assert.equal(t36ResearchEnabled(signed),true);
 for(const key of ["CI","GITHUB_ACTIONS","PGHOST","PGPORT","PGDATABASE",
    "DNDNEXT_C34_LOCAL_URL","C34_T36_LOCAL_CONFIRM"]){
   assert.throws(()=>t36ResearchEnabled({...signed,[key]:"wrong"}),
    /T36 refuses hosted\/unsigned route/,key);
 }
 assert.throws(()=>t36ResearchEnabled({...signed,VERCEL:"1"}),/research cannot be enabled in Vercel/);
 assert.deepEqual(T36_REWRITE,{source:"/npcs",destination:"/__c34_t36_npcs"});
});
test("T36-03 generated full manager is exact T35 output plus only a diagnostic route marker",()=>{
 const original=read("pages/npcs.js");
 const prior=deriveT35FullManager(original).output;
 const candidate=makeT36Source();
 const direct='const upd = await supabase.from("characters").update(patch).eq("id", selected.id);';
 const guarded=[
  'const narrativePatch = { ...patch };',
  '                           delete narrativePatch.updated_at;',
  '                           const upd = await supabase.rpc("c34_npc_narrative_save_research_v1", {',
  '                             p_character_id: selected.id, p_patch: narrativePatch',
  '                           });'
 ].join("\n");
 const originalWithMarker=prior.replace(
  '<div className="npcs-page-root">',
  '<div className="npcs-page-root" '+T36_MARKER+'>');
 assert.equal(originalWithMarker.split('// Save narrative fields').length-1,1);
 assert.equal(originalWithMarker.split('// Save sheet overlay').length-1,1);
 const saveStart=originalWithMarker.indexOf('// Save narrative fields');
 const saveEnd=originalWithMarker.indexOf('// Save sheet overlay',saveStart);
 assert.ok(saveStart>0&&saveEnd>saveStart);
 assert.equal(originalWithMarker.slice(saveStart,saveEnd).split(direct).length-1,1);
 const expectedBody=originalWithMarker.slice(0,saveStart)+
   originalWithMarker.slice(saveStart,saveEnd).replace(direct,guarded)+
   originalWithMarker.slice(saveEnd);
 assert.ok(candidate.endsWith(expectedBody),
  "T36 must preserve every original full manager byte apart from the root marker and exactly one guarded narrative writer");
 const preface=candidate.slice(0,-expectedBody.length);
 assert.match(preface,/T36 EXACT SOURCE generated from ORIGINAL current NPC manager/);
 assert.ok(preface.length<240);
 const saveBlock=candidate.slice(candidate.indexOf('// Save narrative fields'),
   candidate.indexOf('// Save sheet overlay'));
 assert.doesNotMatch(saveBlock,/from\("characters"\)\.update\(patch\)/);
 assert.match(saveBlock,/c34_npc_narrative_save_research_v1/);
 assert.equal((candidate.match(/data-c34-t36="source-derived-stage2"/g)||[]).length,1);
 assert.equal((candidate.match(/\.select\(C34_T25_PUBLIC_ROSTER_FIELDS\)/g)||[]).length,3);
 assert.doesNotMatch(candidate,/\.rpc\("is_admin",\s*\{\s*uid:/);
 assert.match(candidate,/readTownGameManagerCapabilitiesCandidate/);
 assert.match(candidate,/readTownGameManagerNpcProfileCandidate/);
 assert.match(candidate,/CharacterSheetPanel/);
 assert.match(candidate,/PortraitPickerModal/);
 assert.match(candidate,/SpritePickerModal/);
 assert.match(candidate,/saveCharacterSecret/);
 assert.match(candidate,/setCharacterLocation/);
 assert.match(candidate,/get_character_editor_narrative_v1|readTownGameManagerNpcProfileCandidate/);
 assert.match(candidate,/printNotes=\{\(notes \|\| \[\]\)\.filter\(canSeeNote\)\}/);
 assert.match(candidate,/selectedPrivateResult\?\.capabilities\?\.canPrint/);
});
test("T36-04 no world-map, shared app, commerce and original town source edited",()=>{
 const h={
  "pages/_app.js":"e5f68c0abb293089d6ad09d4e3e4035612eac598",
  "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a",
  "components/NpcPanel.js":"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db",
  "components/MerchantPanel.js":"22e4d0810603bc0322904573cb5fe0c14bad1f88",
  "utils/useWallet.js":"f34b99f1d6eee66420d57bdcefdc6d3427092e25",
 };
 for(const [p,sha] of Object.entries(h))assert.equal(blob(read(p)),sha,p);
});
test("T36-05 signed real /npcs test must check OFF and ON and never leak generated file",()=>{
 const t=read("scripts/integration/c34/test_t36_real_npcs_route_signed_browser.mjs");
 for(const s of ["T36-ROUTE-OFF","T36-ROUTE-ON","T36-MANAGER-","T36-REVOCATION","T36-UNKNOWN",
 "T36-SIGNED-CHROMIUM","T36_LOCAL_ROUTE","NEXT_PUBLIC_C34_T36_NPCS_RESEARCH",
 "reconcileT36Route"])assert.ok(t.includes(s),s+" signed assertion missing");
 assert.match(t,/for\(const role of \["ADMIN","DM"\]\)/,
  "T36 actual signed manager must exercise both Admin and DM");
 assert.ok(!t.includes('pages/__c34_t35_probe.jsx'));
});
test("T36-06 scoped Stage2 narrative writer changes NO original global RLS or other data",()=>{
 const sql=read("scripts/integration/c34/t36_disposable_npc_narrative_save_pg17.sql");
 assert.match(sql,/current_database\(\)<>'postgres'/);
 assert.match(sql,/server_version_num/);
 assert.match(sql,/has_column_privilege\('authenticated','public.characters','background','SELECT'\)/);
 assert.match(sql,/private.can_access_character_v1\(p_character_id,'edit'\)/);
 assert.match(sql,/private.can_access_character_v1\(c.id,'edit'\)/);
 assert.match(sql,/c.kind IN \('npc','merchant'\)/);
 assert.match(sql,/auth.uid\(\) IS NULL/);
 assert.match(sql,/jsonb_each\(p_patch\)/);
 assert.match(sql,/jsonb_typeof\(fields.value\) NOT IN \('string','null'\)/);
 assert.match(sql,/fields.key NOT IN/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public.c34_npc_narrative_save_research_v1/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public.c34_npc_narrative_save_research_v1/);
 assert.doesNotMatch(sql,/\bALTER\s+TABLE\s+public\.characters\b|\bGRANT\s+(?:ALL|UPDATE|SELECT)\s+ON\s+(?:TABLE\s+)?public\.characters\b/i);
 const t=read("scripts/integration/c34/test_t36_real_npcs_route_signed_browser.mjs");
 for(const proof of ["T36-NARRATIVE-ORIGINAL-RED","T36-NARRATIVE-WRITER-",
   "T36-NARRATIVE-NONMANAGER","T36-NARRATIVE-SECRET-DENY",
   "T36-NARRATIVE-GM","T36-REVOCATION"]){
   assert.ok(t.includes(proof),"Missing signed narrative proof "+proof);
 }
 assert.match(t,/for\(const label of \["ADMIN","GM","DM"\]\)/,
  "T36 signed narrative writer must test every owner-approved game manager");
});
test("T36-06 read-only Next config cannot regenerate a generated route",()=>{
 const config=read("next.config.mjs");
 assert.match(config,/reconcileT36Route\(process\.env\)/);
 assert.doesNotMatch(config,/\{prepare:true\}|\{cleanup:true\}/);
 const source=read("scripts/integration/c34/prepare_t36_npcs_route.mjs");
 assert.match(source,/\{prepare=false,cleanup=false\}/);
 assert.match(source,/assert\.ok\(prepare,/);
 assert.match(source,/assert\.ok\(cleanup,/);
 const b=read("scripts/integration/c34/test_t36_real_npcs_route_signed_browser.mjs");
 assert.ok(b.includes("reconcileT36Route(signedOn,{prepare:true})"));
 assert.ok(b.includes('reconcileT36Route({...env,NEXT_PUBLIC_C34_T36_NPCS_RESEARCH:"0"},{cleanup:true})'));
 assert.ok(!existsSync(path.join(root,T36_LOCAL_ROUTE)));
 const env={CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
  PGPORT:"54322",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  C34_T36_LOCAL_CONFIRM:T36_RESEARCH_CONFIRM,
  [T36_FLAG]:"1",VERCEL:"0"};
 assert.throws(()=>reconcileT36Route(env),/explicit --prepare/);
 assert.ok(!existsSync(path.join(root,T36_LOCAL_ROUTE)));
});
test("T37-P1 actual /npcs Admin and DM original Forge entry, Stage2 UI narrative saves and revocation",()=>{
 const browser=read("scripts/integration/c34/test_t36_real_npcs_route_signed_browser.mjs");
 for(const required of [
  "T37-CREATOR-ENTRY-","T37-NARRATIVE-","T37-CREATOR-REVOKED",
  "T37-CREATOR-UNKNOWN","get_npc_dossier_admin_v1",
  "t37LastBackground=t37Next","forge.getByRole"
 ])assert.ok(browser.includes(required),"T37 genuine browser assertion absent: "+required);
 assert.match(browser,/for\(const role of \["ADMIN","DM"\]\)/);
 assert.match(browser,/await page\.getByRole\("button",\{name:"Done",exact:true\}\)\.click\(\)/);
 assert.match(browser,/assert\.equal\(t37Saved\.data\?\.secret,secret/);
 assert.match(browser,/await forge\.waitFor\(\{state:"detached"/);
 assert.equal(blob(read("pages/npcs.js")),T25_BASE_BLOB);
 assert.equal(existsSync(path.join(root,T36_LOCAL_ROUTE)),false);
 const sql=read("scripts/integration/c34/t36_disposable_npc_narrative_save_pg17.sql");
 assert.match(sql,/fields\.key NOT IN/);
 assert.doesNotMatch(sql,/GRANT\s+(?:ALL|SELECT|UPDATE)\s+ON\s+(?:TABLE\s+)?public\.characters/i);
});
test("T37-P2 source-original NPC Forge submit, nonce, signed denial, rollback and unchanged Stage2",()=>{
 const browser=read("scripts/integration/c34/test_t36_real_npcs_route_signed_browser.mjs");
 for(const marker of ["T37-P2-CATALOG","T37-P2-CREATE-DENIED",
 "T37-P2-ROLLBACK","T37-P2-FORGE-SUBMIT","T37-P2-NONCE","T37-P2-REVOKED",
 "npc-forge-step-species","npc-forge-step-background",
 "T37-P2-SPECIES","npc-forge-catalog-list > button.npc-forge-species-catalog-row",
 "availableSpecies","chosenSpecies","T37-P2-CATALOG-SETTLED",
 "character_option_catalog_preferred","Astral Elf",
 'advance("species","background")','advance("background","class")',
 'advance("class","abilities")','advance("abilities","training")',
 'advance("training","identity")','advance("identity","story")',
 'advance("story","review")',
 "npc-forge-ability-methods",'name:"Standard Class Array",exact:true',
 "npc-forge-step-identity","npc-forge-step-story","originalCreateRequests",
 "create_character_v1","get_npc_dossier_admin_v1"])
  assert.ok(browser.includes(marker),"Missing T37-P2 genuine signed browser evidence: "+marker);
 assert.match(browser,/page\.on\("request",recordCreate\)/);
 assert.match(browser,/const catalogReply=await catalogPromise/);
 assert.match(browser,/await page\.waitForFunction\(/);
 assert.ok(browser.indexOf("const catalogReply=await catalogPromise")<
   browser.indexOf("const availableSpecies="),
   "T37 must await the original source catalog before selecting a species");
 assert.match(browser,/source==="AAG"/);
 assert.doesNotMatch(browser,/actualSpecies\.click\(\{\s*force\s*:\s*true/);
 assert.match(browser,/page\.off\("request",recordCreate\)/);
 assert.match(browser,/getByRole\("button",\{name:"Create NPC",exact:true\}\)\.click\(\)/);
 assert.match(browser,/assert\.equal\(originalCreateRequests\.length,1/);
 assert.match(browser,/assert\.equal\(submitted\?\.portrait_library_id/);
 const fixture=read("scripts/integration/c34/t37_disposable_original_npc_forge_catalog_pg17.sql");
 assert.match(fixture,/current_database\(\)<>'postgres'/);
 assert.match(fixture,/server_version_num/);
 assert.match(fixture,/md5\(pg_get_functiondef\('public\.create_character_v1/);
 assert.match(fixture,/has_column_privilege\('authenticated','public\.characters','background','SELECT'\)/);
 assert.match(fixture,/security_invoker=true/);
 // Original authority fixture already provides a real preferred option view.
 // Retain its source-qualified feat/skill rows; do not create an empty stub.
 assert.match(fixture,/to_regclass\('public.character_option_catalog_preferred'\) IS NULL/);
 assert.match(fixture,/table_name='character_option_catalog_preferred'/);
 assert.doesNotMatch(fixture,/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+public\.character_option_catalog_preferred/i);
 // Original J154 starting-spell fixture already installed an XPHB-only
 // 5-column class_catalog_preferred view; preserve its original leading
 // columns/filter and append only the real /npcs browser projection.
 assert.match(fixture,/to_regclass\('public.class_catalog_preferred'\) IS NULL/);
 assert.match(fixture,/CREATE OR REPLACE VIEW public.class_catalog_preferred WITH \(security_invoker=true\)/);
 assert.match(fixture,/SELECT id,class_key,class_name,source,spellcasting_ability,/);
 assert.match(fixture,/FROM public.class_catalog WHERE source='XPHB'/);
 assert.doesNotMatch(fixture,/\bCREATE VIEW public.class_catalog_preferred/);
 // The original Forge materializer and T29 merchant test already installed
 // items_catalog. Never create an empty replacement for those inherited rows.
 assert.match(fixture,/to_regclass\('public.items_catalog'\) IS NULL/);
 assert.doesNotMatch(fixture,/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.items_catalog/i);
 assert.match(fixture,/table_name='items_catalog'/);
 // Existing signed original fixtures add portrait name/sort_order and sprite
 // overworld_scale earlier; the T37 scratch fixture MUST NOT add them twice.
 assert.match(fixture,/column_name='name' AND data_type='text'/);
 assert.match(fixture,/column_name='sort_order' AND data_type='integer'/);
 assert.match(fixture,/column_name='overworld_scale' AND data_type='numeric'/);
 // Scope negative column checks to their own original table:
 // the visual-assets picker DOES need a new "name" column.
 const portraitAlter=fixture.split("ALTER TABLE public.npc_portrait_library\n")[1]?.split(";")[0];
 const spriteAlter=fixture.split("ALTER TABLE public.npc_visual_assets\n")[1]?.split(";")[0];
 assert.ok(portraitAlter&&spriteAlter,"Missing T37 local catalog ALTER sections");
 assert.doesNotMatch(portraitAlter,/\bADD COLUMN (?:name|sort_order) (?:text|integer)/);
 assert.doesNotMatch(spriteAlter,/\bADD COLUMN overworld_scale numeric/);
 for(const originalName of ["sprite_bucket","sprite_format","frame_width","frame_height",
   "direction_order","idle_frame","walk_frames","fps"]){
   assert.doesNotMatch(spriteAlter,new RegExp("\\bADD COLUMN "+originalName+"\\s"),
      "T37 fixture duplicated original Forge sprite column "+originalName);
 }
 assert.match(fixture,/column_name IN \('sprite_bucket','sprite_format'\)/);
 assert.match(fixture,/column_name='walk_frames' AND udt_name='_int4'/);
 // The actual original portrait picker does one SELECT of every metadata
 // column. Pin all the missing fields to prevent PostgREST 42703 failure.
 const picker=read("components/NpcForgePortraitPickerModal.js");
 const assetSelect=picker.match(/\.from\("npc_visual_assets"\)\s*\.select\("([^"]+)"\)/);
 assert.ok(assetSelect,"Original portrait sprite SELECT source drift");
 const preexisting=new Set(["id","is_active","portrait_library_id","sprite_path","default_scale","overworld_scale",
   "sprite_bucket","sprite_format","frame_width","frame_height",
   "direction_order","idle_frame","walk_frames","fps"]);
 for(const column of assetSelect[1].split(",")){
   if(preexisting.has(column))continue;
   assert.ok(new RegExp("\\bADD COLUMN "+column+"\\s").test(fixture),
     "T37 scratch visual asset picker column missing: "+column);
 }
 assert.match(fixture,/T37-P2-LOCAL-CATALOG/);
 assert.doesNotMatch(fixture,/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)\s+ON/i);
 assert.doesNotMatch(fixture,/CREATE OR REPLACE FUNCTION|ALTER POLICY|DISABLE ROW LEVEL SECURITY/i);
 assert.equal(blob(read("pages/npcs.js")),T25_BASE_BLOB);
 assert.ok(!existsSync(path.join(root,T36_LOCAL_ROUTE)));
});

console.log("PASS T36-SOURCE: original /npcs bytes intact, local-only default-OFF Next rewrite and full T35 source retained");

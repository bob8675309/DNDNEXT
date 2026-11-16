#!/usr/bin/env node
// C34 T36 exact-source default-OFF full NPC manager real-route research.
import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
 makeT36Source,t36ResearchEnabled,T36_LOCAL_ROUTE,T36_MARKER,
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
 assert.match(conf,/return t36Enabled \? \[T36_REWRITE\] : \[\]/);
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
 assert.ok(candidate.includes(prior.replace(
  '<div className="npcs-page-root">',
  '<div className="npcs-page-root" '+T36_MARKER+'>'
  )),"T36 must preserve entire T35 full source and all previous security checks");
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
console.log("PASS T36-SOURCE: original /npcs bytes intact, local-only default-OFF Next rewrite and full T35 source retained");

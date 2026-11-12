#!/usr/bin/env node
// Read-only audit guard. Verifies COMPLETE file-level inventories and protected
// main assets. Never connects to Supabase, invokes casting, or changes data.
import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";
const base="docs/audits/";
const read=f=>JSON.parse(fs.readFileSync(base+f,"utf8"));
const mainSha="00c5c4416b99ac256913b48ef96387f3eabfde44";
const manifest=read("SPELL_ENGINE_PR309_PR312_EXACT_SOURCE_MANIFEST_2026-11-12.json");
const original=read("ORIGINAL_20_PR_DOSSIER_MAIN_BLOB_PARITY_2026-11-12.json");
const archived=read("SPELL_EFFECTS_ARCHIVED_RESEARCH_MAIN_BLOB_PARITY_2026-11-12.json");
const report=fs.readFileSync(base+"SPELL_ENGINE_AND_ORIGINAL_PR_NO_LOST_WORK_AUDIT_2026-11-12.md","utf8");
assert.equal(manifest.sourceRefs.main,mainSha);
assert.equal(original.mainHead,mainSha);
assert.equal(archived.mainCommit,mainSha);
for(const [pr,num] of [["pr309",47],["pr312",65]]){
 const p=manifest.components[pr];
 assert.equal(p.immediateDiffCount,num);
 assert.equal(p.rows.length,num);
 assert.equal(new Set(p.rows.map(r=>r.path)).size,num);
}
for(const [pr,absent,different] of [["pr309",35,19],["pr312",95,21]]){
 const p=manifest.wholeTreeCrosswalk[pr];
 assert.equal(p.absentOnMain.length,absent);
 assert.equal(p.differentOnMain.length,different);
 for(const r of p.absentOnMain){
  assert.equal(r.status,"absent_on_main");assert.equal(r.mainBlob,null);
  assert.match(r.sourceBlob,/^[a-f0-9]{40}$/);
 }
 for(const r of p.differentOnMain){
  assert.equal(r.status,"different_blob_on_main");
  assert.match(r.sourceBlob,/^[a-f0-9]{40}$/);
  assert.match(r.mainBlob,/^[a-f0-9]{40}$/);
  assert.notEqual(r.sourceBlob,r.mainBlob);
 }
}
assert.equal(manifest.inheritance.p309_to_p312.added.length,60);
assert.equal(manifest.inheritance.p309_to_p312.changed.length,5);
assert.equal(manifest.inheritance.p309_to_p312.removed.length,0);
const missingCode=manifest.wholeTreeCrosswalk.pr312.absentOnMain.filter(r=>/^(pages|components|utils|sql|scripts|\.github\/workflows)\//.test(r.path));
assert.equal(missingCode.length,82);
const counts={ui:0,sql:0,scripts:0,utils:0,workflows:0};
for(const r of missingCode){
 if(/^(pages|components)\//.test(r.path))counts.ui++;
 if(r.path.startsWith("sql/"))counts.sql++;
 if(r.path.startsWith("scripts/"))counts.scripts++;
 if(r.path.startsWith("utils/"))counts.utils++;
 if(r.path.startsWith(".github/workflows/"))counts.workflows++;
}
assert.deepEqual(counts,{ui:2,sql:10,scripts:61,utils:5,workflows:4});
assert.equal(original.reviewed_original_pr_count,20);
assert.equal(original.totalPRScopedRows,584);
assert.equal(original.prs.length,20);
const rows=original.prs.flatMap(p=>p.rows);
assert.equal(rows.length,584);
assert.deepEqual(original.summary,{
 exact_blob_on_main:185,different_blob_on_main:130,absent_on_main:269
});
for(const r of rows){
 assert.match(r.sourceBlob,/^[0-9a-f]{40}$/);
 if(r.pathStatus==="exact_blob_on_main")assert.equal(r.mainBlob,r.sourceBlob);
 if(r.pathStatus==="different_blob_on_main"){
  assert.match(r.mainBlob,/^[0-9a-f]{40}$/);
  assert.notEqual(r.mainBlob,r.sourceBlob);
 }
 if(r.pathStatus==="absent_on_main")assert.equal(r.mainBlob,null);
}
const expectedIds=[309,312,317,318,320,321,322,323,324,325,328,329,330,331,332,333,334,335,345,347];
assert.deepEqual(original.prs.map(p=>p.pr).sort((a,b)=>a-b),expectedIds);
assert.deepEqual(archived.cases.map(x=>x.pr),[250,251,253,255,294,299,304,307]);
for(const c of archived.cases){
 assert.equal(c.rows.length,c.immediateChangedFileCount);
 assert.equal(c.counts.exact+c.counts.diverged+c.counts.absent,c.rows.length);
}
for(const name of ["Eldritch Blast","Fire Bolt","NPC","19","584","95","82","unmerged","REST"]){
 assert.ok(report.includes(name),"Missing material preservation boundary "+name);
}
const hashBlob=path=>{
 const r=spawnSync("git",["hash-object","--",path],{encoding:"utf8",timeout:10000});
 assert.equal(r.status,0,"Unable to hash checked-out file "+path);
 return r.stdout.trim();
};
// The five exact source validator/test blobs from original #309 already
// merged to main via #374, and the separate no-executor workflow.
const p1=[
 "utils/spellRecipes/validateSpellRecipe.mjs",
 "utils/spellRecipes/preflightSpellRecipe.mjs",
 "scripts/fixtures/spell_recipe_p1_examples.mjs",
 "scripts/validate_spell_recipe_schema_p1.mjs",
 "scripts/validate_spell_recipe_preflight_p1.mjs"
];
for(const path of p1){
 const row=manifest.components.pr309.rows.find(r=>r.path===path);
 assert.ok(row,"Original P1 file not in 309");
 assert.equal(row.status,"exact_blob_on_main","P1 original SHA not copied byte-identically "+path);
 assert.equal(hashBlob(path),row.sourceBlob,"Checked out P1 source no longer original blob "+path);
}
assert.ok(fs.existsSync(".github/workflows/validate-spell-recipe-p1-extraction.yml"));
const combat=fs.readFileSync("pages/encounters/combat.js","utf8");
const m=combat.match(/const SUPPORTED_SPELL_KEYS = new Set\(\[([\s\S]*?)\]\);/);
assert.ok(m,"No deployed spell whitelist");
const keys=[...m[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]);
assert.equal(keys.length,19,"Deployed original 19 adapter count changed");
assert.equal(new Set(keys).size,19);
assert.ok(!keys.includes("eldritch-blast|xphb"),"Unreleased EB cast accidentally marked supported");
assert.ok(fs.existsSync("scripts/data/tactical_spell_preservation_20261107.json"));
console.log("PASS exact complete main/source audit: PR309 47, PR312 65, full 35/19 and 95/21, inherited 60/5/0; 20 original PRs=584 rows, 8 archived research PRs; P1 source blob parity and deployed 19 preserved.");

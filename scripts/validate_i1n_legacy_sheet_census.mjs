#!/usr/bin/env node
// I1-N: source-only guard over an exact read-only Supabase census snapshot.
// NO network, DB connection, SQL execution, migration or user data access.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const census = JSON.parse(fs.readFileSync(
  "docs/I1_N_LEGACY_SHEET_LIVE_SOURCE_CENSUS_2026-11-11.json","utf8"));
assert.equal(census.schema_version,"i1n-legacy-player-sheet-census-v1");
assert.equal(census.source_kind,"read_only_live_pg_get_functiondef");
assert.equal(census.writers.length,34);
assert.equal(census.inserts.length,3);
assert.equal(census.database_player_row_lookups.length,6);
assert.equal(census.totals.updaters,34);
assert.equal(census.totals.inserters,3);
assert.equal(census.totals.functions_looking_up_player_rows,6);
assert.equal(census.writers.filter(x=>x.update_filters_edit).length,4);
assert.equal(census.writers.filter(x=>!x.update_filters_edit).length,30);
assert.equal(census.writers.filter(x=>!x.update_mentions_permissions).length,1);
const groups = census.writers.reduce((acc,x)=>{
  acc[x.group_key]=(acc[x.group_key]||0)+1; return acc;
},{});
assert.deepEqual(groups,{
  progression_or_class_choice:18,
  projection_or_source:9,
  feature_or_other:3,
  resource_or_action:3,
  legacy_creator:1
});
const fingerprint=/^[a-f0-9]{32}$/;
const seen = new Set();
for(const item of census.writers){
  assert.match(item.fingerprint,fingerprint);
  assert.ok(item.security_definer);
  assert.ok(item.sig && !seen.has(item.sig),"Duplicate writer "+item.sig);
  seen.add(item.sig);
  assert.match(item.update_excerpt,/update public\.players/i);
  assert.match(item.update_excerpt,/set (?:name=.*?,)?\s*sheet\s*=/i);
  assert.ok(!/(?:\bpassword\b|\bsecret_text\b|\bsb_secret_)/i.test(item.update_excerpt));
  if(item.sig.startsWith("public.create_player_character_v1(")){
    assert.equal(item.update_mentions_permissions,false);
    assert.equal(item.update_filters_edit,false);
  } else assert.equal(item.update_mentions_permissions,true);
}
for(const item of [...census.inserts,...census.database_player_row_lookups]){
  assert.match(item.fingerprint,fingerprint);
  assert.ok(item.sig);
}
assert.ok(census.writers.some(x=>
  x.sig.startsWith("private.sync_character_artificer_plan_projection_v1(")
  && x.fingerprint==="5ebf572db01143e9b523c7dba0d43ad5"),
  "Live original Artificer source fingerprint must remain distinct from disposable repair");
assert.ok(census.inserts.some(x=>
  x.sig.startsWith("public.create_player_character_v2(") &&
  x.fingerprint==="0351f0a00acae023278e1b8b065b00c9"),
  "Live public v2 is original source; the #319 guarded clause is research only");
assert.equal(census.app_player_row_reads.length,7);
for(const item of census.app_player_row_reads){
  assert.ok(!path.isAbsolute(item.path));
  const code=fs.readFileSync(item.path,"utf8");
  assert.match(code,/\.from\(["']players["']\)/,"Missing reader "+item.path);
  assert.ok(item.fields.every(x=>["id","user_id","name"].includes(x)),
    "An App player-row consumer claims unexpected sheet fields");
  // Check only the immediate chained .select after .from("players").
  // This is a reviewed-source regression tripwire, NOT a complete code search.
  const pattern=/\.from\(["']players["']\)([\s\S]{0,190}?)\.select\((["'])(.*?)\2/g;
  for(const m of code.matchAll(pattern)){
    const fields=m[3].split(",").map(x=>x.trim());
    assert.ok(!fields.includes("*") && !fields.includes("sheet"),
      "Direct player sheet projection introduced in "+item.path);
  }
}
const profile=fs.readFileSync("components/PlayerCharacterProfilePanelUnified.js","utf8");
assert.match(profile,/supabase\.rpc\("get_my_player_characters_v2"\)/);
const canonicalSource=fs.readFileSync("sql/20260804_01_multi_player_character_forge_v2.sql","utf8").toLowerCase();
assert.match(canonicalSource,/create or replace function public\.get_my_player_characters_v2\(\)/);
assert.match(canonicalSource,/join public\.character_sheets cs/);
const plan=fs.readFileSync("docs/I1_N_LEGACY_PLAYER_SHEET_AUTHORITY_REVIEW_2026-11-11.md","utf8");
for(const token of ["34","Six database","nonempty", "31", "#361",
  "canonical","isolated restore","unrelated","owner approval"]){
  assert.ok(plan.toLowerCase().includes(token.toLowerCase()),"Missing risk/hand-off token "+token);
}
console.log("PASS I1N-CENSUS: 34 source-hashed legacy writers (4 edit-restricted update predicates, 29 broad permission updates, 1 direct v1 account writer), 3 insert sources, 6 DB player-row lookups, 7 named app identity consumers; canonical character-sheet path and held-original fingerprints preserved.");
console.log("I1N LIMIT: static snapshot and named app-source guard; not full dynamic SQL or external-reader coverage, no live migration/authoritative mirror policy approved.");

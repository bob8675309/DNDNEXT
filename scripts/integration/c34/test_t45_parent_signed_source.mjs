#!/usr/bin/env node
// T45-P1 source-only guard: signed runtime test is separate, original game sources unchanged.
import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const run=read("scripts/integration/c34/test_t45_parent_signed_next_browser.mjs");
test("T45-P1 source-only must mount actual original parent with server RPC, never synthetic review",()=>{
 assert.match(run,/import\("\.\.\/components\/CharacterClassPanel"\)/);
 assert.match(run,/get_character_level_up_review_v1/);
 assert.match(run,/get_character_progression_v1/);
 assert.match(run,/begin_character_level_up_v1/);
 assert.match(run,/cancel_character_level_up_v1/);
 assert.doesNotMatch(run,/review=\{synthetic|setReview|syntheticReview|mockGetLevelUpReview/);
});
test("T45-P1 source-only requires exact source hashes and original SQL bodies",()=>{
 for(const s of ["d39d2bceab944d3d4ec42cc2cfda92609ce51a2b",
  "b1b9781e06e9210a30c520b7f531bce7cbdbd82a",
  "81bce9bec9c59b3b673aeaada913cd054e4b74c7",
  "4a39927c667fab9a2dd87ef1785aadb785e47d38",
  "aa71d3dc8cad6e679bdd95b32f857207621597cb"])
  assert.ok(run.includes(s),s);
 for(const name of ["public.get_character_progression_v1","public.get_character_level_up_review_v1",
  "public.begin_character_level_up_v1","public.cancel_character_level_up_v1",
  "private.cancel_invalid_level_up_session_v1"])
  assert.ok(run.includes(name),name);
});
test("T45-P1 source-only requires local-signed host isolation and accountable negative cases",()=>{
 for(const token of ["127.0.0.1:54321","GITHUB_ACTIONS","T45_ORIGINAL_REVIEW_PARENT_LOCAL_PG17",
  "createClient","signUp","signInWithPassword","anon","outsider","viewer","editor",
  "same JWT","pending_level_up=false","canonical(id)","originalHistory",
  "__c34_t45_parent_probe.jsx","to_regprocedure('public._force_depart_on_route_assign()')",
  "source-original","release"])
  assert.ok(run.toLowerCase().includes(token.toLowerCase()),token);
});

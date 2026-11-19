#!/usr/bin/env node
// T45-P0: read-only source-custody and parent review RPC-graph guard.
// NO signed/browser acceptance is claimed by this source-only test.
import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const gitBlob=p=>{
 const b=fs.readFileSync(path.join(root,p));
 return crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
};
function sourceFn(src,name){
 const anchor="create or replace function "+name.toLowerCase()+"(";
 const start=src.toLowerCase().indexOf(anchor);
 assert.ok(start>=0,"Missing original function "+name);
 const body=src.slice(start),end=/\n(?:\$function\$|\$\$);/.exec(body);
 assert.ok(end,"Missing original terminator "+name);
 return body.slice(0,end.index+end[0].length);
}
const foundation="sql/20260710_02_character_progression_foundation.sql";
const firstReview="sql/20260710_04_character_xp_level_up_review.sql";
const fullReview="sql/20260710_07_transactional_level_up_completion.sql";
const latestBegin="sql/20260808_15_level_up_review_fail_closed_choice_deltas.sql";
const parent="components/CharacterClassPanel.js";
test("T45-P0/01 original SQL and current unchanged parent are source-pinned",()=>{
 for(const [p,sha] of [
  [foundation,"b1b9781e06e9210a30c520b7f531bce7cbdbd82a"],
  [firstReview,"81bce9bec9c59b3b673aeaada913cd054e4b74c7"],
  [fullReview,"4a39927c667fab9a2dd87ef1785aadb785e47d38"],
  [latestBegin,"aa71d3dc8cad6e679bdd95b32f857207621597cb"],
  [parent,"d39d2bceab944d3d4ec42cc2cfda92609ce51a2b"]
 ])assert.equal(gitBlob(p),sha,p);
});
test("T45-P0/02 parent uses real reader/capability/begin/get/cancel and passes SERVER review",()=>{
 const ui=read(parent);
 for(const name of [
  "get_character_progression_v1","can_manage_character_progression_v1",
  "get_character_level_up_review_v1","begin_character_level_up_v1",
  "cancel_character_level_up_v1"
 ])assert.ok(ui.includes('supabase.rpc("'+name+'"'),name);
 assert.match(ui,/setLevelUpReview\(data \|\| null\)/);
 assert.match(ui,/<CharacterLevelUpChoices character=\{character\} review=\{levelUpReview\}/);
 assert.match(ui,/canManage && progression.pending_level_up/);
});
test("T45-P0/03 original source reader authenticates but does not check character access",()=>{
 const reader=sourceFn(read(foundation),"public.get_character_progression_v1");
 assert.match(reader,/security definer/i);
 assert.match(reader,/if auth\.uid\(\) is null and not private\.current_user_is_admin\(\)/);
 assert.match(reader,/select \* into v_progression from public\.character_progression/);
 assert.match(reader,/'events', v_events/);
 assert.doesNotMatch(reader,/character_permissions|can_manage_character_progression_v1/i);
 const grants=read(foundation);
 assert.match(grants,/grant execute on function public\.get_character_progression_v1\(uuid\) to authenticated;/i);
});
test("T45-P0/04 original review actions check edit authority and retain open-session identity",()=>{
 const first=read(firstReview),full=read(fullReview),latest=read(latestBegin);
 const cap=sourceFn(first,"public.can_manage_character_progression_v1");
 const get=sourceFn(full,"public.get_character_level_up_review_v1");
 const begin=sourceFn(latest,"public.begin_character_level_up_v1");
 const cancel=sourceFn(first,"public.cancel_character_level_up_v1");
 for(const body of [cap,get,begin,cancel])assert.match(body,/private\.can_manage_character_progression_v1/);
 for(const body of [get,begin,cancel])assert.match(body,/status='open'|status = 'open'/);
 assert.match(begin,/for update/i);
 assert.match(begin,/not v_progression\.pending_level_up/);
 assert.match(begin,/if v_created then/i);
 assert.match(begin,/level_up_review_started/);
 assert.match(cancel,/level_up_review_cancelled/);
 assert.match(full,/canComplete', v_session\.metadata_ready/);
 const trigger=sourceFn(first,"private.cancel_invalid_level_up_session_v1");
 assert.match(trigger,/not new\.pending_level_up or new\.class_level is distinct from old\.class_level/);
});
test("T45-P0/05 inherited P1.3 and T44 are truthful about missing parent review graph",()=>{
 const p13=read("scripts/fixtures/p1_3_levelup_v5_local_auth_pg17.sql");
 const t44=read("scripts/integration/c34/test_t44_level_up_signed_next_browser.mjs");
 assert.match(p13,/CREATE FUNCTION public\.get_character_progression_v1\(uuid\)/);
 assert.doesNotMatch(p13,/CREATE (?:OR REPLACE )?FUNCTION public\.begin_character_level_up_v1/i);
 assert.match(t44,/const OriginalLevelUp=dynamic/);
 assert.match(t44,/metadataReady:true,canComplete:true/);
 assert.match(t44,/get_character_level_up_review_v1/);
 assert.match(t44,/not fetched/i);
});

// Source-only gate for the REAL GoTrue staging harness.
// Never call the network or attempt real credentials from free CI.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const code=readFileSync(new URL("./test_npc_delegated_control_real_auth.mjs",import.meta.url),"utf8");
for(const marker of [
  'prodRef="ucggczovhmauhshvhusx"',
  'DNDNEXT_NPC_STAGING_URL',
  'DNDNEXT_NPC_STAGING_PUBLISHABLE_KEY',
  'YES_LOCAL_GOTRUE_ONLY',
  'DNDNEXT_NPC_MUTATING_TEST_CONFIRM',
  'YES_DISPOSABLE_NPC_GRANTS_ONLY',
  'signInWithPassword',
  'auth.getUser()',
  'auth.getClaims()',
  'checked.user.is_anonymous===true',
  'claims.claims.is_anonymous===true',
  'admin.client.rpc("is_admin")',
  'a.client.rpc("is_admin")',
  'b.client.rpc("is_admin")',
  'startsWith("NPC CTRL TEST - ")',
  'token.is_hidden!==true',
  'existing.some(x=>x.can_control||x.can_edit)',
  'encounter_can_control_participant_v1',
  'admin_set_npc_control_v1',
  'await assign(a,false)',
  'await Promise.all([verify(a,false),verify(b,true)])',
  'Promise.allSettled([assign(a,false),assign(b,false)])',
  'STAGING CLEANUP FAILED',
  'grant/RLS acceptance only'
]) assert.ok(code.includes(marker),"Missing real Auth staging safety/coverage: "+marker);
for(const forbidden of ["service_role_key","createUser(", "auth.admin", ".from(\"character_permissions\").update(", "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE"])
  assert.ok(!code.includes(forbidden),"Unsafe staging Auth harness pattern: "+forbidden);
assert.ok(code.indexOf('if(e.DNDNEXT_NPC_MUTATING_TEST_CONFIRM!==confirm)') <
          code.indexOf('const npc=e.DNDNEXT_NPC_DISPOSABLE_CHARACTER_ID'));
assert.ok(code.indexOf('if(![npc,participant,encounter].every') <
          code.indexOf('await assign(a,true)'));
console.log("P2 real GoTrue NPC acceptance harness contracts PASS (source-only; staging not connected)");

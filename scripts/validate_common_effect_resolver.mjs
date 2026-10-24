import fs from "node:fs";
import assert from "node:assert/strict";
const sql=fs.readFileSync("sql/20261023_08_common_effect_resolver_v1.sql","utf8");
const docs=fs.readFileSync("docs/Common_Character_Effects_Engine_Design_2026-10-23.md","utf8");
const fixture=fs.readFileSync("scripts/fixtures/common_effect_resolver_behavior.sql","utf8");
for(const term of ["private.resolve_effect_bundle_v1","immutable security invoker",
  "suppressedDuplicates","skippedConditional","stackKey",
  "op in ('add','minimum','multiply')","op in ('advantage','disadvantage')",
  "from jsonb_each_text(e->'when')",
  "revoke all on function private.resolve_effect_bundle_v1(jsonb,jsonb,jsonb)"])
  assert.ok(sql.toLowerCase().includes(term.toLowerCase()),`Missing contract: ${term}`);
for(const term of ["security definer","create table","create trigger","update public.",
  "insert into public.","delete from public."])
  assert.ok(!sql.toLowerCase().includes(term),`Pure resolver may not mutate database: ${term}`);
for(const term of ["equipment","source adapter","stacking","parity","paper-style"])
  assert.ok(docs.toLowerCase().includes(term),`Missing architecture explanation: ${term}`);
assert.ok(fixture.includes("Unknown target accepted"));
console.log("Common effect resolver contracts validated.");

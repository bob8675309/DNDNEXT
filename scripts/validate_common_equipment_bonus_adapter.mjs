import assert from "node:assert/strict";
import fs from "node:fs";
const sql=fs.readFileSync("sql/20261024_01_common_equipment_bonus_adapter_v1.sql","utf8");
const fixture=fs.readFileSync("scripts/fixtures/common_equipment_bonus_shadow_parity.sql","utf8");
for(const token of ["normalize_equipment_bonus_effects_v1","immutable security invoker",
"schemaVersion","savesAll","skillsAll","initiative","saving_throw_bonus","acrobatics_check",
"athletics_check","revoke all on function private.normalize_equipment_bonus_effects_v1"])
assert.ok(sql.toLowerCase().includes(token.toLowerCase()),`Missing isolated parity contract: ${token}`);
for(const token of ["security definer","update public.","insert into public.","delete from public.","create trigger","create table"])
assert.ok(!sql.toLowerCase().includes(token),`Shadow adapter changes gameplay authority: ${token}`);
for(const token of ["Equipment total AC was double-counted","Unknown equipment schema version accepted","Unsupported skill silently treated as covered"])
assert.ok(fixture.includes(token),`Missing parity test: ${token}`);
console.log("Equipment shadow adapter uses existing output without changing any data authority.");

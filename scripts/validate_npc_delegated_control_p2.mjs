// Research-only source/permission contract; true Auth acceptance is still
// required. The PG16 job imports SQL, so source assertions do not substitute
// for actual database execution or frontend compile.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sql=read("sql/candidates/20261101_npc_delegated_control_candidate.sql");
const page=read("pages/npcs.js");
const panel=read("components/NpcControlPermissionsPanel.js");
const harness=read("scripts/fixtures/npc_delegated_control_p2_pg16_checks.sql");
for (const s of [
 "add column if not exists can_control boolean not null default false",
 "Only explicit Admin assignments may ever set can_control=true",
 "public.admin_set_npc_control_v1(",
 "private.current_user_is_admin()",
 "v_kind not in ('npc','merchant')",
 "on conflict(character_id,user_id) do update",
 "set can_control=excluded.can_control",
 "revoke all on function public.admin_set_npc_control_v1",
 "grant execute on function public.admin_set_npc_control_v1",
 "encounter_can_control_participant_v1(",
 "cp.can_control",
 "cp.can_edit",
 "v_participant.controller_user_id=v_uid",
 "drop policy if exists encounter_participants_authenticated_read",
 "create policy encounter_participants_authenticated_read",
 "for select to authenticated",
]) assert.ok(sql.includes(s),"Missing SQL candidate invariant: "+s);
assert.ok(!sql.includes("set can_control=true\nwhere can_edit=true"),"Existing editors must not receive irreversible ghost NPC control");
assert.ok(!sql.includes("alter table public.character_sheets"));
assert.ok(!sql.includes("grant all on table"));
assert.ok(!sql.includes("grant execute on function public.encounter_can_control_participant_v1(uuid)\n  to anon"));
assert.ok(page.includes('import NpcControlPermissionsPanel from "../components/NpcControlPermissionsPanel";'));
assert.ok(page.includes('isAdmin && selected.type === "npc"'));
assert.ok(page.includes('key={selected.id} characterId={selected.id} isAdmin={isAdmin}'));
assert.ok(!panel.includes('.from("character_permissions").upsert('));
assert.ok(panel.includes('supabase.rpc("admin_set_npc_control_v1"'));
assert.ok(panel.includes('.from("user_profiles").select("id,role")'));
assert.ok(panel.includes('.from("players").select("user_id,name")'));
assert.ok(panel.includes(".filter(row => String(row.role || \"player\").toLowerCase() === \"player\""));
assert.ok(panel.includes(".eq(\"character_id\", characterId)"));
assert.ok(panel.includes("if (!isAdmin || !characterId || busyUser || loading) return"));
assert.ok(panel.includes("setGrants(previous =>"));
assert.ok(panel.includes("This switch changes only delegated NPC battle-control permission"));
assert.ok(panel.includes("const effectiveControl = granted || legacyEdit || direct"));
assert.ok(panel.includes("Other access"));
assert.ok(panel.includes("onChange={event => { void setControl(player.id, event.target.checked); }}"));
for (const s of [
 "\\i sql/candidates/20261101_npc_delegated_control_candidate.sql",
 "public.p2_id(41)",
 "public.p2_id(43)",
 "public.p2_id(44)",
 "Ordinary player administered NPC permission",
 "Revoked player can still view hidden companion encounter token",
 "NPC-only admin API granted PC control",
 "Legacy edit permission was silently copied into permanent NPC combat control",
 "Revoked legacy editor retained ghost NPC combat control",
 "Battle control inadvertently granted edit",
]) assert.ok(harness.includes(s),"Missing disposable SQL test invariant: "+s);
console.log("P2 delegated NPC battle control source contract PASS: independent admin toggle, two concurrent controllers, editor-revoke compatibility without permission backfill, server-authorized grants and visibility");

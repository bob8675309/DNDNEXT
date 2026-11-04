#!/usr/bin/env node
// Additive notice candidate: source-level checks, not production acceptance.
import fs from "node:fs";
import assert from "node:assert/strict";
const sql=fs.readFileSync("sql/candidates/20261104_admin_character_creation_notices_v1.sql","utf8");
const ui=fs.readFileSync("pages/admin/activity.js","utf8");
const fixture=fs.readFileSync("scripts/fixtures/admin_character_creation_notice_candidate_pg17.sql","utf8");

for(const token of [
 "CREATE TABLE private.admin_character_creation_notice_reviews",
 "ALTER TABLE private.admin_character_creation_notice_reviews ENABLE ROW LEVEL SECURITY",
 "REFERENCES public.character_level_events(id)",
 "ON CONFLICT (event_id, admin_user_id) DO NOTHING",
 "IF auth.uid() IS NULL OR NOT private.current_user_is_admin() THEN",
 "WHERE e.event_type = 'player_character_created'",
 "r.admin_user_id = auth.uid()",
 "REVOKE ALL ON FUNCTION public.get_admin_character_creation_notices_v1",
 "REVOKE ALL ON FUNCTION public.review_admin_character_creation_notice_v1",
 "TO authenticated",
]) assert.ok(sql.includes(token),`Missing permission/event contract: ${token}`);
assert.equal((sql.match(/IF auth\.uid\(\) IS NULL OR NOT private\.current_user_is_admin\(\) THEN/g)||[]).length,2,
  "Both reads and writes must independently check signed-in Admin");
for(const forbidden of [
 /\bDROP\s+TABLE\b/i,/\bTRUNCATE\b/i,
 /\bDELETE\s+FROM\s+public\./i,
 /\bALTER\s+TABLE\s+public\.character_level_events\b/i,
 /\be\.details\b/i,/\bcs\.sheet\b/i,/\bto_jsonb\(c\)/i
]) assert.ok(!forbidden.test(sql),`Unsafe or unscoped notice SQL: ${forbidden}`);
for(const token of [
 'supabase.rpc("is_admin")',
 'supabase.rpc("get_recent_site_activity_v1")',
 '"get_admin_character_creation_notices_v1"',
 '"review_admin_character_creation_notice_v1"',
 'Open in NPC manager',
 'Mark reviewed',
 'encodeURIComponent(notice.character_id)',
 'notice.creator_email',
]) assert.ok(ui.includes(token),`Missing Admin UI event contract: ${token}`);
assert.ok(!ui.includes('.from("character_level_events")'),
  "Raw player-level events must not be browsed from the client");
for(const token of [
 "SET ROLE authenticated;",
 "EXCEPTION WHEN insufficient_privilege THEN NULL;",
 "coalesce(max(unread_total),0)",
 "v_repeat IS DISTINCT FROM v_reviewed",
 "ROLLBACK;",
]) assert.ok(fixture.includes(token),`Missing disposable assertion: ${token}`);
console.log("Additive Admin character-creation notice candidate source/ACL contracts PASS. Database/browser release is NOT implied.");

import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260730_08_tactical_durable_encounter_start.sql";
const guardMigrationPath = "sql/20260730_09_tactical_encounter_lifecycle_guard.sql";
const livePath = "pages/encounters/live.js";

for (const rel of [migrationPath, guardMigrationPath, livePath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) {
    throw new Error(`Durable encounter start validation failed: missing/empty ${rel}`);
  }
}

const migration = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
for (const token of [
  "create or replace function public.admin_start_encounter_v1(p_encounter_id uuid)",
  "security definer",
  "public.is_admin(v_uid)",
  "Only staged encounters can be started",
  "Every non-defeated participant needs initiative before starting",
  "A participant is staged outside the encounter map",
  "A participant is staged on a blocked hex",
  "Two participants cannot start on the same hex",
  "order by p.initiative desc, p.initiative_tiebreaker desc nulls last, p.created_at, p.id",
  "movement_spent_ft = 0",
  "action_available = true",
  "bonus_action_available = true",
  "reaction_available = true",
  "active_participant_id = v_first_participant_id",
  "event_type, summary, detail",
  "'encounter_started'",
  "revoke all on function public.admin_start_encounter_v1(uuid) from public, anon",
  "grant execute on function public.admin_start_encounter_v1(uuid) to authenticated, service_role",
]) {
  if (!migration.includes(token)) throw new Error(`Durable encounter start validation failed: migration missing ${token}`);
}

const guardMigration = fs.readFileSync(path.join(process.cwd(), guardMigrationPath), "utf8");
for (const token of [
  "create or replace function public.admin_set_encounter_status_v1(",
  "if p_status='active' and v_current in ('draft','ready','initiative') then",
  "perform public.admin_start_encounter_v1(p_encounter_id);",
  "return;",
  "revoke all on function public.admin_set_encounter_status_v1(uuid,text) from public, anon",
  "grant execute on function public.admin_set_encounter_status_v1(uuid,text) to authenticated, service_role",
]) {
  if (!guardMigration.includes(token)) throw new Error(`Durable encounter start validation failed: lifecycle guard missing ${token}`);
}

const live = fs.readFileSync(path.join(process.cwd(), livePath), "utf8");
for (const token of [
  "TACTICAL ENCOUNTER SYSTEM • MILESTONE 2",
  "Encounter Staging & Control",
  'href="/encounters/play"',
  'href="/encounters/combat"',
  'p_settings: { workflow: "durable-encounter" }',
  'p_state: { stagedFrom: "encounter-staging" }',
  'const [controllerOptions, setControllerOptions] = useState([])',
  'const [controllerDraft, setControllerDraft] = useState("")',
  'supabase.from("players").select("user_id,name").order("name")',
  "if (nextIsAdmin)",
  "p_controller_user_id: controllerDraft || null",
  "GM controlled / unassigned",
  "Save position + initiative + controller",
  "const initiativesReady = participants.length > 0",
  "function startEncounter()",
  'supabase.rpc("admin_start_encounter_v1", { p_encounter_id: activeSession.id })',
  "Start encounter",
  "function pauseEncounter()",
  "function resumeEncounter()",
  "function resolveEncounter()",
  "function archiveEncounter()",
  "Turn ownership advances through the guarded End Turn command.",
]) {
  if (!live.includes(token)) throw new Error(`Durable encounter start validation failed: staging UI missing ${token}`);
}
for (const forbidden of [
  "PHASE 1C",
  'phase: "1C"',
  'stagedFrom: "phase1c"',
  "Manual initiative marker",
  "presentation state only",
  "admin_set_encounter_turn_marker_v1",
  'supabase.from("auth.users")',
  'supabase.from("encounter_participants").update(',
]) {
  if (live.includes(forbidden)) throw new Error(`Durable encounter start validation failed: stale staging contract remains: ${forbidden}`);
}


for (const source of [migration, guardMigration, live]) {
  for (const forbidden of [
    "map_routes",
    "map_route_points",
    "map_route_edges",
    "world_state",
    "world_events",
    "town_map_flags",
    "town_map_labels",
    "advance_all_characters",
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`Durable encounter start validation failed: tactical milestone must not reference ${forbidden}`);
    }
  }
}

console.log("Tactical durable encounter start validation passed.");

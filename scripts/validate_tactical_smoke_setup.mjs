import fs from "node:fs";
import path from "node:path";

const pagePath = "pages/encounters/smoke.js";
const absolute = path.join(process.cwd(), pagePath);
if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) {
  throw new Error(`Tactical smoke setup validation failed: missing/empty ${pagePath}`);
}

const source = fs.readFileSync(absolute, "utf8");
for (const token of [
  "export default function EncounterSmokeSetupPage()",
  'const SMOKE_MAP_KEY = "milestone2-smoke-arena-v1"',
  'const SMOKE_SESSION_KEY = "milestone2-smoke-session-v1"',
  'name: "Letho"',
  'name: "Aurelia Dawnmere"',
  'name: "Pip Quillspark"',
  'name: "Raska Stonejaw"',
  'supabase.rpc("admin_upsert_encounter_map_v1"',
  'supabase.rpc("admin_set_encounter_hex_v1"',
  'supabase.rpc("admin_upsert_encounter_map_object_v1"',
  'supabase.rpc("admin_create_encounter_v1"',
  'supabase.rpc("admin_add_encounter_participant_v1"',
  'supabase.rpc("admin_update_encounter_participant_staging_v1"',
  'supabase.rpc("admin_set_encounter_status_v1"',
  'p_status: "initiative"',
  'async function ensureSmokeEncounter(mapId)',
  '.in("status", ["draft", "ready", "initiative", "active", "paused"])',
  'if (["active", "paused"].includes(encounter.status))',
  'Reusing it without restaging participants or resetting initiative.',
  "Prepare / repair smoke encounter",
  "It does not start combat or modify world/town state.",
]) {
  if (!source.includes(token)) throw new Error(`Tactical smoke setup validation failed: missing ${token}`);
}

const activeReuseIndex = source.indexOf('if (["active", "paused"].includes(encounter.status))');
const participantRepairIndex = source.indexOf('await ensureParticipants(encounter.id)');
if (activeReuseIndex < 0 || participantRepairIndex < 0 || activeReuseIndex > participantRepairIndex) {
  throw new Error("Tactical smoke setup validation failed: active/paused reuse must return before participant restaging.");
}

for (const forbidden of [
  'supabase.rpc("admin_start_encounter_v1"',
  ".insert(",
  ".update(",
  ".upsert(",
  ".delete(",
  "map_routes",
  "map_route_points",
  "advance_all_characters",
  "time_scale",
  "camp_started_at",
]) {
  if (source.includes(forbidden)) throw new Error(`Tactical smoke setup validation failed: forbidden ${forbidden}`);
}

console.log("Tactical smoke setup validation passed.");

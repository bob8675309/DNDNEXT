import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const navbar = read("components/AppNavbar.js");
const page = read("pages/encounters/multiplayer-smoke.js");
const suite = read("scripts/validate_tactical_spell_suite.mjs");

for (const token of [
  "Encounters",
  'href="/encounters/combat"',
  'href="/encounters/play"',
  'href="/encounters/live"',
  'href="/encounters"',
  'href="/encounters/multiplayer-smoke"',
  "Battle Board",
  "Multi-User Smoke Setup",
]) {
  assert(navbar.includes(token), `Navbar is missing encounter navigation contract: ${token}`);
}
assert(navbar.includes("{user && <li className=\"nav-item dropdown\">"), "Encounter navigation must require an authenticated session");
assert(navbar.includes("{isAdmin ? <>"), "GM-only encounter tools must remain admin-gated");

for (const token of [
  'const SESSION_FIXTURE_KEY = "milestone2-multiplayer-smoke-v1"',
  'name: "Leso Varen"',
  'name: "Dawn Whiteflame"',
  'name: "Varges"',
  'controller: "admin"',
  'controller: "player"',
  'supabase.rpc("admin_create_encounter_v1"',
  'supabase.rpc("admin_add_encounter_participant_v1"',
  'supabase.rpc("admin_update_encounter_participant_staging_v1"',
  'supabase.rpc("admin_set_encounter_status_v1"',
  'p_status: "initiative"',
  'supabase.rpc("admin_start_encounter_v1"',
  "Preparation and combat start are separate guarded commands",
  "Active-encounter conflict",
  "otherActive",
]) {
  assert(page.includes(token), `Multi-user smoke setup is missing: ${token}`);
}

assert(!page.includes('.from("encounters").insert'), "Multi-user setup must not write encounters directly");
assert(!page.includes('.from("encounter_participants").insert'), "Multi-user setup must not write participants directly");
assert(!page.includes('.from("encounters").update'), "Multi-user setup must not update encounter state directly");
assert(!page.includes('.from("encounter_participants").update'), "Multi-user setup must not update staging directly");
assert(!page.includes("MapPageClient"), "Multi-user smoke setup must not introduce world-map behavior");
assert(!page.includes("map_routes") && !page.includes("map_route_points") && !page.includes("locations"), "Multi-user setup must not touch protected world tables");
assert(page.includes('encounter?.status !== "initiative"'), "Start Encounter must require initiative staging");
assert(page.includes("window.confirm"), "Starting the multi-user encounter must require explicit confirmation");
assert(page.includes("conflicts.length > 0"), "Preparation and start controls must block active-character conflicts");
assert(suite.includes('"scripts/validate_encounter_navigation_multiplayer_smoke.mjs"'), "Tactical suite must run the encounter navigation and multiplayer smoke validator");

console.log("Encounter navigation and multiplayer smoke setup validation passed.");

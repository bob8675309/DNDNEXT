import fs from "node:fs";

const migrationPath = "sql/20260721_02_map_world_rls_phase_2.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const cleanup = fs.readFileSync("sql/20260721_03_map_world_rls_phase_2_policy_cleanup.sql", "utf8");
const debugPanel = fs.readFileSync("components/MapDebugPanel.js", "utf8");

const required = [
  "alter table public.map_routes enable row level security",
  "alter table public.world_state enable row level security",
  "alter table public.world_events enable row level security",
  "town_map_labels_admin_write",
  "alter view public.v_route_adjacent_points set (security_invoker = true)",
  "alter view public.v_trade_stops set (security_invoker = true)",
  "admin_advance_all_characters_v1",
  "revoke execute on function public.advance_world_time",
  "revoke all on table public.locations",
];

for (const token of required) {
  if (!migration.toLowerCase().includes(token.toLowerCase())) {
    throw new Error(`Missing map/world security contract: ${token}`);
  }
}

if (!debugPanel.includes('rpc("admin_advance_all_characters_v1"')) {
  throw new Error("MapDebugPanel must use the guarded admin simulation RPC.");
}

if (debugPanel.includes('rpc("advance_all_characters_v3"')) {
  throw new Error("MapDebugPanel must not call the internal simulation RPC directly.");
}

for (const token of [
  "world_events_admin_select",
  "for insert to authenticated",
  "for update to authenticated",
  "for delete to authenticated",
  "alter function public.set_updated_at_town_map_labels()",
]) {
  if (!cleanup.toLowerCase().includes(token.toLowerCase())) {
    throw new Error(`Missing Phase 2 policy cleanup contract: ${token}`);
  }
}

console.log("Map/world RLS phase 2 contracts passed.");

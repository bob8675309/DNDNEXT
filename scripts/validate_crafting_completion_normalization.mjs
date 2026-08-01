import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationPath = path.join(root, "sql/20260801_01_crafting_completion_normalization.sql");
const source = fs.readFileSync(migrationPath, "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

for (const token of [
  "private.complete_craft_plan_v1_impl(uuid,uuid)",
  "Craft completion declaration anchor mismatch",
  "Craft completion item-type anchor mismatch",
  "Craft completion rarity anchor mismatch",
  "Craft completion report anchor mismatch",
  "Craft completion receipt actor anchor mismatch",
  "nullif(v_source_payload->>'uiType', '')",
  "position('|' in coalesce(v_source_payload->>'item_type', '')) > 0",
  "position('|' in coalesce(ii.card_payload->>'item_type', '')) > 0",
  "lower(coalesce(v_output_rarity, '')) in ('', 'none', 'mundane')",
  "v_plan.plan_payload->'crafter'->>'id'",
  "v_plan.plan_payload->'crafter'->>'name'",
  "v_crafter_id := coalesce(v_crafter_id, v_attempt.actor_character_id, v_plan.target_character_id)",
  "v_crafter_name",
  "join public.inventory_items ii on ii.id = cp.completion_output_item_id",
  "left join public.crafting_attempts success_attempt on success_attempt.id = cp.completed_attempt_id",
  "lower(coalesce(cp.discipline, '')) = 'smithing'",
  "result_tier = 'completed'",
  "item_type = v_row.normalized_type",
  "item_rarity = v_row.normalized_rarity",
]) {
  expect(source.includes(token), `Migration missing required token: ${token}`);
}

const anchorGuards = source.match(/v_occurrences <> 1/g) || [];
expect(anchorGuards.length === 5, `Expected 5 fail-closed anchor checks, found ${anchorGuards.length}`);
expect(!source.includes("4b515b01-c6de-41f4-91d8-af294535988c"), "Migration must not hardcode the pilot craft plan ID");
expect(!source.includes("a8de7feb-1912-482d-90be-7f307eba4f93"), "Migration must not hardcode the pilot inventory item ID");
expect(!source.includes("a7a06890-8ff1-4f64-8e6c-aa4bbbf9d67f"), "Migration must not hardcode the pilot attempt ID");

for (const forbidden of [
  "map_routes",
  "map_route_points",
  "locations",
  "encounter_participants",
  "encounter_move_active_participant_v1",
  "encounter_weapon_attack_v1",
  "admin_set_encounter_status_v1",
]) {
  expect(!source.includes(forbidden), `Crafting normalization must not reference ${forbidden}`);
}

if (failures.length) {
  console.error("Crafting completion normalization validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Crafting completion normalization validation passed.");

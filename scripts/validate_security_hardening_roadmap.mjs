import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "sql/20260724_01_security_hardening_roadmap.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const driftMigrationPath = "sql/20260724_02_database_drift_followup.sql";
const driftMigration = fs.readFileSync(driftMigrationPath, "utf8");
const walletHook = fs.readFileSync("utils/useWallet.js", "utf8");
const merchantPanel = fs.readFileSync("components/MerchantPanel.js", "utf8");
const playerCreator = fs.readFileSync("components/PlayerCharacterCreatorV2.js", "utf8");

function includesAll(text, values, label) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} is missing required contract: ${value}`);
  }
}

includesAll(migration, [
  "REVOKE ALL ON TABLE public.player_wallets FROM PUBLIC, anon, authenticated",
  "GRANT SELECT ON TABLE public.player_wallets TO authenticated",
  "REVOKE EXECUTE ON FUNCTION public.wallet_add(uuid, numeric) FROM PUBLIC, anon, authenticated",
  "DROP FUNCTION IF EXISTS public.wallet_add_self(numeric)",
  "DROP FUNCTION IF EXISTS public.wallet_set_self(numeric)",
  "ALTER TABLE public.spells_catalog ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE public.spell_effects ENABLE ROW LEVEL SECURITY",
  "target_table || '_public_read'",
  "Only an administrator can clear character dwell time.",
  "Only an administrator can force a character action.",
  "Only an administrator can run simulation ticks.",
  "DROP FUNCTION IF EXISTS public.reroll_merchant_inventory(uuid, text, integer)",
  "DROP FUNCTION IF EXISTS public.reroll_merchant_inventory(uuid, text, integer, integer)",
  "DROP INDEX IF EXISTS public.alchemy_recipe_options_recipe_option_key",
  "CREATE INDEX IF NOT EXISTS inventory_items_user_id_idx",
  "CREATE POLICY player_wallets_select_self_or_admin",
], "security migration");

includesAll(driftMigration, [
  "ALTER FUNCTION %s SET search_path = pg_catalog, public, private, auth, extensions",
  "AND d.deptype = 'e'",
  "REVOKE EXECUTE ON FUNCTION public.create_character_v1(jsonb) FROM PUBLIC, anon",
  "REVOKE EXECUTE ON FUNCTION public.delete_character_v1(uuid) FROM PUBLIC, anon",
  "REVOKE EXECUTE ON FUNCTION public.set_character_portrait_v1(uuid, text, text, text, text, text) FROM PUBLIC, anon",
  "ALTER POLICY \"trade: select own\"",
  "WHERE p.user_id = (SELECT auth.uid())",
  "CREATE INDEX IF NOT EXISTS characters_last_known_location_id_idx",
  "CREATE INDEX IF NOT EXISTS map_route_edges_a_point_id_idx",
  "CREATE INDEX IF NOT EXISTS player_recipes_recipe_id_idx",
  "application-owned public functions still have a mutable search_path",
], "database drift migration");

for (const [text, label] of [[migration, "security migration"], [driftMigration, "database drift migration"]]) {
  assert.ok(!text.includes("CREATE OR REPLACE FUNCTION public.advance_all_characters_v3"),
    `${label} must not replace world movement logic`);
  assert.ok(!text.includes("CREATE OR REPLACE FUNCTION public.sim_tick_v1"),
    `${label} must not replace simulation logic`);
  assert.ok(!text.includes("CREATE OR REPLACE FUNCTION public.route_next_seq"),
    `${label} must not replace route progression logic`);
}
assert.ok(!driftMigration.includes("CREATE OR REPLACE FUNCTION"),
  "database drift migration must change function metadata only, not bodies");

includesAll(walletHook, [
  "supabase.rpc(\"wallet_get\"",
  "supabase.rpc(\"wallet_set\"",
  "Purchases, trades, and rewards must use their purpose-specific transactional RPCs.",
], "wallet hook");
assert.ok(!walletHook.includes("supabase.rpc(\"wallet_add\""),
  "wallet hook must not expose generic wallet mutation");
assert.ok(!/\basync function (add|spend)\s*\(/.test(walletHook),
  "wallet hook must not export add/spend helpers");

includesAll(merchantPanel, [
  "supabase.rpc(\"buy_from_merchant\"",
  "refreshWallet()",
], "merchant purchase flow");

includesAll(playerCreator, [
  "backgroundFeatChoice: originFeat || null",
  "backgroundExpandedSpells",
  "backgroundSpellList",
  "selectedBackgroundFeat",
  "resolveBackgroundFeatOptions",
  "spellMatchesExpandedList",
], "player character background persistence");

console.log("Security hardening roadmap source contracts validated.");

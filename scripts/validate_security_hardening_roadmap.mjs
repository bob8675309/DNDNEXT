import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "sql/20260724_01_security_hardening_roadmap.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
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
  "spells_catalog_public_read",
  "spell_effects_public_read",
  "Only an administrator can clear character dwell time.",
  "Only an administrator can force a character action.",
  "Only an administrator can run simulation ticks.",
  "DROP FUNCTION IF EXISTS public.reroll_merchant_inventory(uuid, text, integer)",
  "DROP FUNCTION IF EXISTS public.reroll_merchant_inventory(uuid, text, integer, integer)",
  "DROP INDEX IF EXISTS public.alchemy_recipe_options_recipe_option_key",
  "CREATE INDEX IF NOT EXISTS inventory_items_user_id_idx",
  "CREATE POLICY player_wallets_select_self_or_admin",
], "security migration");

assert.ok(!migration.includes("CREATE OR REPLACE FUNCTION public.advance_all_characters_v3"),
  "security migration must not replace world movement logic");
assert.ok(!migration.includes("CREATE OR REPLACE FUNCTION public.sim_tick_v1"),
  "security migration must not replace simulation logic");
assert.ok(!migration.includes("CREATE OR REPLACE FUNCTION public.route_next_seq"),
  "security migration must not replace route progression logic");

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

import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const includesAll = (source, tokens, label) => {
  for (const token of tokens) {
    assert.ok(source.includes(token), `${label} is missing required contract: ${token}`);
  }
};

const docs = read("docs/Security_Hardening_Roadmap_Status.md");
const apiAssetMetadata = read("pages/api/asset-metadata.js");
const importScripts = read("scripts/import_class_catalog.mjs") + read("scripts/import_2024_class_features.mjs");
const supplementalClassScript = read("scripts/import_supplemental_class_features.mjs");
const featScript = read("scripts/import_phb2024_option_catalog.mjs");
const catalogMigration = read("sql/20260525_01_gameplay_reference_catalogs.sql");
const optionMigration = read("sql/20260525_05_character_option_catalog.sql");
const duplicateAuditMigration = read("sql/20260525_10_character_option_duplicate_audit.sql");
const merchantMigration = read("sql/20260523_07_purchase_inventory_flow.sql");
const walletHook = read("hooks/useWallet.js");
const merchantPanel = read("components/MerchantPanel.js");
const playerCreatorAdapter = read("components/PlayerCharacterCreatorV2.js");
const sharedForgeAdapter = read("components/NewNpcModalV3.js");
const sharedForge = read("components/useNpcForgeDerivedModel.js");
const playerForgeMagic = read("sql/20260808_47_player_forge_starting_magic_v3_completion.sql");

includesAll(docs, [
  "Security Hardening Roadmap Status",
  "security_definer",
  "wallet",
], "security roadmap documentation");

includesAll(apiAssetMetadata, [
  "createClient",
  "SUPABASE_SERVICE_ROLE_KEY",
  "Authorization",
], "asset metadata route");

includesAll(importScripts, [
  "class_catalog",
  "class_level_progression",
], "class catalogue imports");
includesAll(supplementalClassScript, ["class_feature_catalog"], "supplemental class feature imports");
includesAll(featScript, ["character_option_catalog"], "option catalogue import");

includesAll(catalogMigration, [
  "create table if not exists public.class_catalog",
  "create table if not exists public.class_level_progression",
], "catalogue migration");
includesAll(optionMigration, [
  "create table if not exists public.character_option_catalog",
], "option migration");
includesAll(duplicateAuditMigration, ["duplicate"], "duplicate audit migration");

includesAll(merchantMigration, [
  "buy_from_merchant",
], "merchant purchase migration");

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

includesAll(playerCreatorAdapter, [
  'import NewNpcModalV3 from "./NewNpcModalV3";',
  'mode="player"',
], "player creator shared-Forge adapter");

includesAll(sharedForgeAdapter, [
  "function playerPayload(payload = {}, spellChoices = [], magicSelections = [])",
  "...payload,",
  "...sheet,",
  "playerForgeProxySpellChoices",
  "const createCharacter = useCallback",
  'supabase.rpc("create_player_character_v3"',
  "p_payload: playerPayload(payload, proxySpellChoices, magicSelections)",
  "p_spell_choices: proxySpellChoices",
  "p_magic_selections: magicSelections",
], "guarded player payload and multi-source starting-magic forwarding");
assert.ok(!sharedForgeAdapter.includes('supabase.rpc("create_player_character_v2"'),
  "shared Forge must not stop at the legacy v2 starting-magic boundary");
assert.ok(!sharedForgeAdapter.includes("supabase.rpc ="),
  "guarded player payload forwarding must not replace the shared Supabase client method");
assert.ok(!sharedForgeAdapter.includes("MutationObserver"),
  "player-mode presentation must not depend on post-render DOM mutation");

includesAll(sharedForge, [
  "resolveBackgroundFeatOptions",
  "const selectedBackgroundFeat = useMemo",
  "const backgroundSpellList = selectedBackground?.spellList || []",
  "const backgroundExpandedSpellNames = selectedBackground?.expandedSpellNames || []",
  "originFeat: selectedBackgroundFeat?.name || null",
  "backgroundFeatChoice: selectedBackgroundFeat?.name || null",
  "backgroundExpandedSpells: backgroundExpandedSpellNames",
  "backgroundSpellList",
  "serializeStartingMagicSelections",
  "startingMagicSelections",
], "shared Character Forge background and starting-magic persistence");

includesAll(playerForgeMagic, [
  "create_player_character_v3",
  "p_magic_selections",
  "background-expanded",
  "v_source_type = 'subclass'",
  "shared_character_forge_player_v3",
  "validate_player_forge_starting_spells_v1",
], "guarded Player Forge v3 starting-magic authority");

for (const source of [playerCreatorAdapter, sharedForgeAdapter, sharedForge, playerForgeMagic]) {
  for (const forbidden of ["MapPageClient", "map_routes", "route_segment_progress", "advance_all_characters", "weather"]) {
    assert.ok(!source.includes(forbidden), `security/Forge slice crossed protected world boundary: ${forbidden}`);
  }
}

console.log("Security hardening roadmap, guarded Player Forge v3 starting magic, wallet/purchase authority, catalogue imports, and protected boundaries validated.");
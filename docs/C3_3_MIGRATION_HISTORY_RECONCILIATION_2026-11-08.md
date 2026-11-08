# C3.3 Supabase migration-history reconciliation (read-only inventory)

**2026-11-08 · DnDWeb project `ucggczovhmauhshvhusx` · Draft PR #345 · Not a migration or backup**

## What we confirmed

Connected Supabase PostgreSQL 17.4 reports **243 applied migration records**, latest `20261019013551 grim_hollow_pg24_species_catalog`. The GitHub tree at `62854da256854444d2b56fa711b2958d1c4e305e` holds **270 SQL files under `sql/`**, and **zero tracked files under `supabase/migrations/`**. Case-insensitive normalized **filenames only** provide plausible matches for **208 remote migration records**, leave **35 unmatched remote records**, and yield **1 ambiguous name(s)**. There are **62 local SQL files** not selected by those name matches (including several November draft candidates).

**A filename match does not prove the migration SQL was identical, nor can old SQL scripts be safely replayed just because their names resemble recorded migrations.** This inventory does not modify or repair history.

The exact complete 243-entry remote history and possible local file paths are captured in [the metadata-only snapshot](data/c33_migration_history_snapshot_2026-11-08.json). Local-only validator `scripts/diagnostics/c33_migration_history_audit.mjs` verifies the snapshot still matches repository filenames. It never contacts Supabase.

## Unmatched recorded migration names (35)

- `20260613193529 smithing_material_quality_v5_functions`
- `20260613193640 smithing_material_quality_v5_catalog`
- `20260614034425 crafting_virtual_stock_hotfix_v3`
- `20260614192328 phase_a_reference_table_rls`
- `20260614192358 phase_a_inventory_ownership_rls`
- `20260614192453 phase_a_rpc_accept_trade`
- `20260614192527 phase_a_non_map_rpc_exposure_remaining`
- `20260614192755 phase_a_rpc_reroll_merchant_inventory_overload`
- `20260614193004 phase_a_inventory_transfer_compatibility`
- `20260614235248 player_inventory_owner_alignment_v2`
- `20260615202924 smithing_base_dice_scaling_v4`
- `20260616170936 merchant_crafted_alchemy_stock_v1`
- `20260616172505 merchant_stock_item_alchemy_v1`
- `20260616180519 merchant_alchemy_stock_backfill_v2`
- `20260619160848 npc_portrait_foundation_v1`
- `20260619175130 npc_portrait_art_pack_v1`
- `20260630183725 npc_known_recipes_recipe_key`
- `20260711053434 prefer_canonical_spell_and_class_versions_in_progression`
- `20260803010138 tactical_character_resource_bridge_profile_v2`
- `20260808173831 normalize_xphb_battle_master_maneuvers`
- `20260808221807 weapon_master_feat_runtime`
- `20260814160725 enable_http_for_grim_hollow_pg24_import`
- `20260814161314 grim_hollow_heritage_catalog_support`
- `20261011164321 starting_market_merchant_expansion_20261011`
- `20261011164440 merchant_catalog_reroll_variety_20261011`
- `20261011232211 dawn_storefront_metadata_20261011`
- `20261012044433 dawn_whiteflame_media_20261012`
- `20261013022225 merchant_stock_distribution_20261012`
- `20261013022332 merchant_recipe_rarity_cap_20261012`
- `20261016160931 campaign_item_pool_merchant_balance`
- `20261016161158 campaign_item_pool_relic_repair_fix`
- `20261016161316 merchant_high_rarity_ten_percent`
- `20261016161805 merchant_theme_constraint_rebalance`
- `20261016164541 merchant_theme_type_diversity_final`
- `20261016164734 merchant_future_specialty_routing_final`

## Ambiguous local name (1)

- `wizard_spell_mastery_runtime` → `sql/20260808_43_wizard_spell_mastery_runtime.sql` or `sql/20260808_44_wizard_spell_mastery_runtime.sql`

## Safe next release strategy

- **Do not** copy or rename 243 recorded migrations based on filename guesses, mark old migrations applied/reverted, use `supabase migration repair`, reset `supabase_migrations.schema_migrations`, or run `supabase db push` against the connected project. `db push` uses local versioned `supabase/migrations` sources, which this repository does not have.
- Keep the existing remote migration ledger intact. For the owner-approved new SQL, use a **newly named migration through the connected Supabase migration action**, which creates its own history entry, only after its exact SQL is reviewed, backup is verified, dry-run role tests pass and the matching website release is ready. The migration history must be rechecked immediately before use.
- Separately plan a future schema-baseline capture and source-controlled migration strategy; do not make this privacy release a historical re-import of hundreds of ad hoc SQL scripts.
- The draft PR's four original privacy/inventory SQL candidates and its source-fingerprinted `scripts/release/c33_compose_disposable_joint_sql.mjs` remain **disposable-only** research until replaced by owner-reviewed, production-guarded migration SQL.
- Source of external backup/migration practice: Supabase [Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations), [Local Development Workflow](https://supabase.com/docs/guides/local-development/cli-workflows), and [migration repair warning](https://supabase.com/docs/reference/cli/supabase-migration-repair). Do not infer from docs that project-specific backup entitlement is verified.

## Protected-storage backup inventory (DB read-only metadata)

The connected project's Storage metadata reports **4 buckets, 340 objects**, with no object downloads: `location-icons` 136 (1,181,743 reported bytes); `map-icons` 18 (75,760); `npc-portraits` 185 (448,421,335); `town-maps` 1 (3,474,842). Bucket labels and sizes alone are not recoverable backups. Storage **object bytes are not included in ordinary database-only backup/restore**; they must be separately copied and verified by a trusted operator, without publishing assets or private links to GitHub logs.

The real content-preservation inventory covers 21 spell/item/recipe/inventory/stock families, including 1,037 spells, 2,739 items, 1,037 spell effects, 132 recipes, 23 inventory records and 240 merchant stock entries. See [protected data policy](C3_3_PROTOTYPE_SPELL_ITEM_PRESERVATION_2026-11-08.md).

**Backups cannot be declared verified here:** the connected app exposes project metadata, SQL, branches and migrations but **no authenticated backup inventory/download/restore action**. Before release, an owner with dashboard permissions must verify a restorable database backup and a separately recoverable Storage copy, and capture the restore procedure in a private location. Do not paste database credentials or backup files into public PR artifacts.

## Remaining owner-approved release gates

1. Recheck remote migration history, DB function/policy/trigger fingerprints and current production Vercel SHA.
2. Review one **production-guarded, versioned** SQL transaction that bundles the four exact source candidates and compatible ACL grants; reject any spell/item/stock loss.
3. Verify a protected database backup and Storage object export/restore, then perform a disposable restore/recovery rehearsal including newly written creator-secret data.
4. Coordinate the temporary prototype maintenance window, apply the reviewed migration, validate roles/catalog hashes, then deploy compatible UI.
5. Ask owner **before** live Supabase SQL, `main` merge, or Vercel release; separately confirm the proposed world-map NPC modal presentation change or leave it out.

**No live schema/data mutation, database reset, backup restore, Vercel deploy or `main` merge was performed to produce this report.**

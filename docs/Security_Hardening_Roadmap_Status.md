# Security Hardening Roadmap Status

This document tracks the bounded hardening work approved on 2026-07-24. It is a companion to the town/crafter and source-pipeline handoffs. It does not authorize unrelated feature changes.

## Guardrails

- World-map, town-map, route, travel, weather, camp, and simulation rules remain behaviorally unchanged.
- Manual world administrator RPCs may be authorization-hardened without replacing their state-update or tick logic.
- Crafting formulas, material consumption, merchant stock generation, purchase semantics, and inventory grants remain unchanged.
- Database cleanup must be caller-inventoried before removing an RPC, index, policy, or grant.
- Every migration includes postconditions and is validated by `scripts/validate_security_hardening_roadmap.mjs`.

## Patch 1 — Economy exploit closure

Status: complete.

- `utils/useWallet.js` no longer exposes generic `add` or `spend` helpers.
- Player and anonymous direct writes to `player_wallets` are revoked.
- `wallet_add` is an administrator/service internal primitive rather than a browser RPC.
- Unused `wallet_add_self` and `wallet_set_self` functions are removed.
- Merchant purchases continue through the atomic `buy_from_merchant` RPC.
- Administrator wallet editing continues through the internally authorized `wallet_set` RPC.

## Patch 2 — Spell catalog RLS

Status: complete.

- RLS is enabled on `spells_catalog` and `spell_effects`.
- Anonymous and authenticated clients retain read-only catalog access.
- Direct client writes are revoked.
- `spells_catalog_preferred` remains a `security_invoker` view and remains readable.
- Reviewed spell imports remain available to authenticated administrators through the internally authorized import RPC.

## Patch 3 — Manual world RPC permissions

Status: complete.

Authorization was added to:

- `admin_clear_dwell_and_force_due`
- `admin_force_character_due`
- `admin_sim_tick_n`

Anonymous execution is revoked. Authenticated administrators retain access. No route, movement, weather, camp, travel-time, or simulation function body was replaced.

## Patch 4 — Database drift cleanup

Status: complete for the approved low-risk batch.

`sql/20260724_01_security_hardening_roadmap.sql`:

- retires legacy merchant reroll overloads that reference removed tables;
- preserves `reroll_merchant_inventory_v2` as the active contract;
- removes only proven duplicate indexes while preserving constraint-backed indexes;
- adds the first high-value foreign-key indexes;
- explicitly documents and denies direct access to RPC-only progression tables.

`sql/20260724_02_database_drift_followup.sql`:

- pins `search_path` metadata on application-owned public functions without replacing function bodies;
- revokes anonymous access to character RPCs that require a signed-in caller internally;
- preserves RLS behavior while using one-time `auth.uid()` initialization in trade, plant, and recipe policies;
- adds every remaining foreign-key index reported by the advisor.

Low-confidence “unused index” notices are intentionally not used as deletion instructions. Storage bucket listing policies, Auth settings, and the managed PostgreSQL upgrade remain separate platform-administration work.

## Patch 5 — Character creation and background verification

Status: complete at the source, build-contract, and data-contract level for background mechanics and persistence.

- Fixed and selectable background feats are resolved by `utils/backgroundMechanics.js`.
- `NewNpcModalV3Refined` is the shared NPC/player Forge authority for background selection and payload construction.
- Expanded background spell lists are preserved in `backgroundExpandedSpells` and `backgroundSpellList`.
- The selected background feat is persisted as `backgroundFeatChoice` and `originFeat`.
- `PlayerCharacterCreatorV2` is a thin player-mode adapter, and `NewNpcModalV3` forwards the shared payload to the guarded `create_player_character_v2` command.
- The shared Forge continues to use the preferred class and character-option catalogs.
- Source-backed starting-spell selection parity is not part of this completed background-persistence contract; it remains explicitly pending in `Unified_Character_Forge_Status.md`.
- All preferred backgrounds have player-facing narrative text through `description` or the existing `metadata.lore` fallback.
- `scripts/test_background_mechanics.mjs` and `scripts/validate_security_hardening_roadmap.mjs` protect the mechanics, shared-Forge ownership, guarded forwarding, and persistence contracts.

## Validation sequence

1. Inventory all repository and database callers.
2. Run the migration in a rolled-back transaction.
3. Apply the reviewed migration.
4. Compare RLS, grants, function signatures, indexes, and data counts with the pre-patch snapshot.
5. Verify anonymous spell reads.
6. Run security and performance advisors.
7. Run the full Vercel validation pipeline and `next build`.
8. Fast-forward `main` only after the branch is green and the live database matches the migration contracts.

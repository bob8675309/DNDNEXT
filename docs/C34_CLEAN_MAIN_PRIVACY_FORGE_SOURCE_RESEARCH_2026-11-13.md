# C34 — Clean-main NPC privacy / Forge joint-source research (not deployed)

**Date:** 2026-11-13  
**Base:** `main` at `6637b14f807ebec79542deb7eef4b2bc3abfb5fd`  
**Research branch:** `research/c34-clean-main-privacy-forge-joint-source-20261112`  
**Scope:** Exact original source preservation and non-release validation. The original PRs stay open.

## What was actually implemented

This branch copies **six exact, unchanged Git blobs** from the original held PR HEADs. The content is kept under `scripts/integration/c34/sources/` and **is not imported by runtime, wired into migrations, or applied to any database**.

| Order | Blob / PR | Contract retained |
| --- | --- | --- |
| 01 | `99bceee24c1718570237e70a65fe3172f4c9fbc9` — #324 | Original public v2/v3 immutable nonce reservation plus source-original private Forge functions. Includes historical nonempty `players.sheet` protection inherited from #319; this is **not** Option A for all account writers. |
| 02 | `9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3` — #345 | NPC allowlisted profile and full-sheet RLS Stage 1. |
| 03 | `afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac` — #345 | GM dossier / editor projections and narrative-column ACL Stage 2. |
| 04 | `01e48823ac3a46aa5880e98200e97c2595501ce7` — #345 | Creator attribution, creator-private Story, GM-only original secret, separate public clues, original Story wrapper Stage 3. |
| 05 | `4532ddb8db642d0d0ab14646a3e87c034d4134c6` — #324 | All four inventory RLS policies paired with obsolete `inventory_items_owner_type_chk` removal, preserving the validated character-owner CHECK. |
| 06 | `91f5fb918bf205f2d4462e2ff0089f656601328e` — #351 | Complete private Story nonce intent and server wrapper replacement, rather than relying on Stage 3's incomplete replay identity. |

**Ordering is a research dependency proposal, NOT an executable migration recipe.** Stage scripts 02–05 each have independent BEGIN/COMMIT statements. Scripts 01 and 06 do not. Script 06 includes a `psql` meta command. No concatenated SQL is generated, since source guard compatibility, client wiring, full trigger graph and transactional atomicity have not been jointly proven.

`scripts/integration/c34/validate_source_contract.mjs` verifies raw Git blob SHA-1s, expected transaction shape, exact source-contract signatures and approved source order. `test_source_contract.mjs` checks source-drift rejection, missing-blob negative, release-denial and absence of database execution. `validate-c34-joint-source-research.yml` runs this on GitHub Actions with no Supabase or Vercel secrets. A PASS proves **T0 static integrity only**.

## Fresh live baseline verified read-only on November 13

- Supabase project `DnDWeb` `ucggczovhmauhshvhusx`, PostgreSQL 17.4.x; 243 migration entries.
- Original `public.create_player_character_v2(jsonb,jsonb)` MD5 `0351f0a00acae023278e1b8b065b00c9`.
- Original `public.create_player_character_v3(jsonb,jsonb,jsonb)` MD5 `6ba73e6f12fcf826cc0a739cce45ff40`.
- `private.can_access_character_v1(uuid,text)` MD5 `97b5e6b059e6467e24c4283fe420c83e`.
- `private.materialize_player_forge_starting_equipment_v1(uuid)` MD5 `653e1b9d7cc47dcff2cef33a674b97f4`.
- Both `inventory_items_owner_type_check` (validated, includes `character`) and `inventory_items_owner_type_chk` (NOT VALID, excludes `character`) still exist. Four original inventory RLS policies remain.
- NPC safe-profile, GM dossier and creator-story public RPCs are not installed; private creator attribution is absent. No production SQL mutation.

These live observations establish applicable original **function guards** and blockers, not successful migration or app operation.

## Open release blockers (must not be disguised by green static CI)

1. Joint original Forge trigger graph (**31 production triggers**, incomplete co-resident research fixture) and genuine signed PG17/GoTrue execution.
2. Original nonce transaction and creator private Story, inventory owner CHECK/RLS, immutable replay, grants and rollback must be proven together, including adversarial negative tests.
3. Option A canonical `character_sheets` authority with account `players.sheet` frozen still covers **12 of 34 original writers in isolated signed research**, leaving **22 untested**.
4. Full signed app-browser creation → Profile → Sheet → Town → Shop → Print, GM, creator, co-editor, inventory-only, outsider, anon and logout/change-user cases.
5. Distinct NPC/merchant `can_edit` / `can_inventory` / `can_control` permissions; #312 delegated-control and #317 lock/replay protections remain held.
6. Independent encrypted DB+Storage restoration, reviewed migration/rollback, manual world-map Profile visual approval, and owner release decision.
7. Main branch protection/required-status enforcement was observed disabled; passing workflows cannot be treated as automatic merge policy.

## Next single bounded task

On this C34 research branch (not main), build **one source-faithful disposable PG17 + genuine local GoTrue integration fixture** that assembles all original source guards and the relevant original Forge trigger graph; obtain original RED + corrected GREEN for immutable Story replay and character-owned inventory under authenticated, revocation and outsider cases. Keep original test artifacts and do not modify production. Integrate the Option A creation behavior only after checking the copied Forge source/nonce path against original `players.sheet` writers.

The **separate following phase** is client/browser integration including the original #345 presentation/consumer files and privacy APIs. Do not prematurely merge the Stage 1–3 UI or SQL in isolation, retire old PRs, alter world-map routes/sprites, change combat authority, enable AI, or deploy anything.

## Evidence vocabulary

- **Verified**: live read-only schema/functions, exact Git blobs, static test definitions.
- **Needs GitHub receipt**: exact HEAD CI results for this new branch.
- **Not tested**: combined disposable SQL, signed application browser, full 31-trigger matrix, production restore.
- **Not changed**: `main`, any live Supabase table, policies, grants, migrations, Vercel, all character/profile/map/runtime paths.

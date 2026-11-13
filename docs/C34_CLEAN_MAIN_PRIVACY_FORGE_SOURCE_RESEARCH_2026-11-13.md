# C34 — Clean-main NPC privacy / Forge joint-source research (not deployed)

**Date:** 2026-11-13  
**Base:** `main` at `6637b14f807ebec79542deb7eef4b2bc3abfb5fd`  
**Research branch:** `research/c34-clean-main-privacy-forge-joint-source-20261112`  
**Scope:** Exact original source preservation (T0) **and** source-faithful, signed disposable integration (T1). No rollout. The original PRs stay open.

## What was actually implemented

This branch preserves **six exact, unchanged SQL Git blobs** from the original held PR HEADs under `scripts/integration/c34/sources/`, and source-identical operational candidate paths for original signed tests. It includes the original #351 signed Story/nonce test and #345 source-qualified privacy fixtures without editing their bodies. None of these are runtime imports, migrations or changes to the hosted database. The operational SQL files are applied **only inside a throwaway local GitHub Actions PostgreSQL 17/GoTrue test database**.

| Order | Blob / PR | Contract retained |
| --- | --- | --- |
| 01 | `99bceee24c1718570237e70a65fe3172f4c9fbc9` — #324 | Original public v2/v3 immutable nonce reservation plus source-original private Forge functions. Includes historical nonempty `players.sheet` protection inherited from #319; this is **not** Option A for all account writers. |
| 02 | `9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3` — #345 | NPC allowlisted profile and full-sheet RLS Stage 1. |
| 03 | `afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac` — #345 | GM dossier / editor projections and narrative-column ACL Stage 2. |
| 04 | `01e48823ac3a46aa5880e98200e97c2595501ce7` — #345 | Creator attribution, creator-private Story, GM-only original secret, separate public clues, original Story wrapper Stage 3. |
| 05 | `4532ddb8db642d0d0ab14646a3e87c034d4134c6` — #324 | All four inventory RLS policies paired with obsolete `inventory_items_owner_type_chk` removal, preserving the validated character-owner CHECK. |
| 06 | `91f5fb918bf205f2d4462e2ff0089f656601328e` — #351 | Complete private Story nonce intent and server wrapper replacement, rather than relying on Stage 3's incomplete replay identity. |

**Ordering is a research dependency, NOT an executable production migration recipe.** Stage scripts 02–05 have independent BEGIN/COMMIT; scripts 01 and 06 do not; script 06 contains a `psql` meta command. The signed CI now proves the staged **source-faithful subset** can execute and interact in a disposable DB, including API-level per-call atomic Story rollback. A source-locked single-transaction **production release** and full 31-trigger/app/browser/recovery correctness are still unproven. No deployable combined SQL is generated.

`validate_source_contract.mjs` verifies six original SQL blob SHA-1s, transaction shapes, interface contracts and dependency order. `validate_joint_fixture_blobs.mjs` additionally pins **16 exact operational source/fixture blobs**, including the unchanged signed test and the physical SQL paths the test executes. `test_source_contract.mjs` runs **eight** positive/negative source and no-release checks (including source mutation rejection). `validate-c34-joint-source-research.yml` runs this with no external secrets. Its PASS proves **T0 static integrity**, independent of the T1 signed integration workflow.

## Completed T1 signed integration milestone (November 13, 2026)

**CI receipt:** [C34 genuine signed PostgreSQL 17/GoTrue workflow run #43378389720](https://github.com/bob8675309/DNDNEXT/actions/runs/43378389720) **SUCCESS** at exact tested head `cb4511b8b8eb691e46fec58a71c4dbeba1773c8b`. The source-only workflow plus inherited handoff, Class UI and tactical-spell read-only workflows were also green at that head. The later source-guard augmentation is separately checked by the newly triggered exact-head workflows; do not treat a historical green run as proof for untested subsequent commits.

- **Original immutable Forge and creator-private Story (source-original test unchanged from #351):** real GoTrue sign-ups/JWTs; signed authorized creator; nonce identity includes canonical private Story; modified payload/Story, cross-actor/nonced mixed-v3, spoofed server digest and revoked rights fail; same-intent and different-intent concurrency serialize; 16,001-character Story failure rolls back both original Forge character and reserved nonce; later explicit creator edits survive identical retry.
- **Inventory RED on the *same disposable database*:** source-original inventory policies reveal a historical character-owned item to a stale `user_id` with no current character permission; the legacy `NOT VALID` ownership CHECK rejects new character-owned inserts. These are demonstrated original defects, not guesses.
- **Inventory GREEN after applying the unchanged original #324 paired candidate:** stale-owner/outsider read blocked, inventory-only legitimate holder and Admin reads retained; direct non-Admin character INSERT/UPDATE/DELETE and owner-type laundering blocked; ordinary player-owned DML and Admin character-item inserts still work; the verified ownership CHECK remains and obsolete one is dropped.
- **Privacy GREEN after untouched #345 Stages 1–3:** an authenticated outsider gets safe public NPC projection, not the original GM secret; Admin dossier reveals GM-only data to Admin alone; independently published GM public clues appear to players; outsider cannot edit publication; anonymous role cannot read protected NPC Profile or inventory.
- **Original Forge and data preservation:** signed v3 creation with genuine source-original private nonce and the original deferred equipment materializer creates starting equipment through privileged server flow, while preserving an existing nonempty legacy account `players.sheet`, merchant stock, canonical per-character `character_sheets` and an unchanged legacy GM secret. Unauthorized character-sheet read is blocked.
- **Co-resident trigger scope:** exactly **six identified original triggers** are installed together in this C34 test fixture: creator attribution + GM Secret insert guard (characters), deferred starting equipment (progression), sheet-to-progression sync (character_sheets), and two inventory crafting handlers. This **is NOT the full 31-trigger production graph**; source-original helpers include deliberately narrowed disposable-only catalog/option/wallet fixtures.

**Files:** `scripts/integration/c34/c34_inventory_materializer_setup_pg17.sql`, `c34_inventory_original_policy_baseline_pg17.sql`, `test_joint_pg17_local_auth.mjs`, operational original fixtures, and `.github/workflows/validate-c34-joint-local-auth.yml`. The test uses pinned Supabase CLI v2.120.0, local-only URLs/ports, genuinely signed users, current-permission SQL and existing npm lockfile dependencies. **No secrets or production access, SQL migration, Vercel deployment, or runtime UI changes.**

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

1. Full source-faithful original Forge trigger graph (**31 production triggers**); C34 now proves six selected original triggers co-resident with genuine signed PG17/GoTrue, **not 31/31**.
2. The jointly signed original nonce, Story and inventory/RLS source-original subset **passed**. The production-shaped full materializer/catalog/wallet/options/feat trigger graph, migration transaction isolation/lock behavior, cross-feature rollback and load tests remain unaccepted.
3. Option A canonical `character_sheets` authority with account `players.sheet` frozen still covers **12 of 34 original writers in isolated signed research**, leaving **22 untested**.
4. Full signed app-browser creation → Profile → Sheet → Town → Shop → Print, GM, creator, co-editor, inventory-only, outsider, anon and logout/change-user cases.
5. Distinct NPC/merchant `can_edit` / `can_inventory` / `can_control` permissions; #312 delegated-control and #317 lock/replay protections remain held.
6. Independent encrypted DB+Storage restoration, reviewed migration/rollback, manual world-map Profile visual approval, and owner release decision.
7. Main branch protection/required-status enforcement was observed disabled; passing workflows cannot be treated as automatic merge policy.

## Next single bounded task

On the C34 branch, **expand the now-green signed six-trigger fixture toward all 31 original active Forge triggers** with source-exact dependencies and original RED/GREEN acceptance. Preserve the successful Story/nonce/inventory test as regression evidence; replace any deliberately simplified helper fixture only when it can be verified against original production functions. In parallel audit the outstanding **22 Option A account-level writers**; do not claim a complete conversion from the one proven nonempty legacy Forge snapshot case. Only then integrate full #345 consumers and signed browser flows. No hosted migrations.

The **separate following phase** is client/browser integration including the original #345 presentation/consumer files and privacy APIs. Do not prematurely merge the Stage 1–3 UI or SQL in isolation, retire old PRs, alter world-map routes/sprites, change combat authority, enable AI, or deploy anything.

## Evidence vocabulary

- **Verified**: live read-only baseline; six original SQL blobs, 16 source-original operational fixtures, source negative tests; signed disposable PG17/GoTrue original Story/nonce and inventory RED→GREEN at the cited exact tested head.
- **Recheck on future commits**: CI receipt for the final PR HEAD, because code/docs additions move the commit SHA.
- **Not tested**: production-shaped *single release transaction*, signed full application browser, complete 31-trigger Forge acceptance, all 34 Option A writers, production restore.
- **Not changed**: `main`, any live Supabase table, policies, grants, migrations, Vercel, all character/profile/map/runtime paths.

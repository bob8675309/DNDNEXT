# C34 T19 — original held #345 NPC privacy SQL and T18 29/31 original Forge co-residence

**Date:** November 14, 2026. **Status:** 7/7 exact-executable-head workflows GREEN at `910bc03aad4f473e9c851df7fd146021a8b8aecc`; production/UI release **HOLD**. [Draft PR #379](https://github.com/bob8675309/DNDNEXT/pull/379) on `research/c34-clean-main-privacy-forge-joint-source-20261112`, [real signed PostgreSQL 17 + GoTrue + PostgREST workflow #43625172792](https://github.com/bob8675309/DNDNEXT/actions/runs/43625172792) **SUCCESS**. Every one of six C34-T19-GREEN01–06 statements appears in the job log, with **no errors**. Earlier C34 T1–T18 and unchanged I1C original signed regressions completed before T19 in the same DB.

## What was actually done (important original source dependency discovery)

**No new privacy SQL installation was required.** The unchanged original I1C signed fixture `scripts/integration/c34/fixtures/original_i1c_forge_private_story_nonce_local_auth.mjs` already installs, in order and in disposable local PG17 only:

1. `sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql`, original held #345 blob `9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3`, tighter canonical sheet SELECT and allowlisted public NPC Profile;
2. `sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql`, original held #345 blob `afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac`, role-wide five-column SELECT revoke, GM-only dossier and signed editor narrative;
3. `sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql`, original held #345 blob `01e48823ac3a46aa5880e98200e97c2595501ce7`, immutable trusted creator attribution, GM-secret insert guard, separate RLS-protected creator backstory, private Story + nonce adapter, GM-public clue separation;
4. held #324 immutable nonce and held #351 original Story completion. C34's subsequent inventory/Forge T1–T18 then installs **29 of the original 31 non-map trigger definitions** onto that exact same disposable DB; the two owner-protected movement/rest/camp world-map definitions are deliberately excluded.

The stage1/2/3 candidate bytes remain unmodified and independently Git-blob-pinned in `scripts/integration/c34/validate_joint_fixture_blobs.mjs`. This task **appended only** T19 signed negative/positive regressions to `scripts/integration/c34/test_joint_pg17_local_auth.mjs`. There is no new DDL, no new browser import and no production connection.

## Exactly what passed after T18 in the shared database

| Signed checkpoint | Verified behavior |
|---|---|
| **GREEN01** | Original privacy RPCs, creator relations, stage2 private-column ACL and Admin-only function grants still installed and enabled; 29/31 source-original DDL plus held privacy hooks present |
| **GREEN02** | Genuine creator JWT creates character via original v3/private-Story wrapper with immutable creator attribution, canonical Sheet, one private Story, nonce idempotency and untouched historical `players.sheet` row |
| **GREEN03** | Separate genuine creator, co-editor, inventory-only, convert-only, outsider, GM and anonymous identities; only original creator with current edit permission and signed GM can query creator Story or gain `can_edit_creator_backstory_v1` |
| **GREEN04** | A noncreator `can_edit` co-editor can read canonical per-character Sheet and nonsecret editor narrative, but inventory/convert/outsider cannot; original authenticated direct private-column ACL denies, Admin-only dossier includes historic GM secret, public allowlisted Profile excludes it |
| **GREEN05** | Signed creator can update personal Story; unrelated co-editor cannot; revoking original creator's current `can_edit` immediately hides private Story and denies writes while GM retains the last authorized text; historical account unchanged |
| **GREEN06** | Original wrapper rejects forged player-supplied GM-only `secret` and oversize 16,001-character creator Story; character, Sheet, nonce, inventory, option-grant and creator-Story table counts remain exactly unchanged after atomic rollback |

Every genuine identity was created using local GoTrue and sent through signed PostgREST, not substituted by setting `auth.uid()`. Source-original RED baselines and malformed-payload tests in I1C/T1–T18 are retained and rerun; T19 itself asserts source authority after installing original protection, **not** a new unguarded production RED. No historical GM secrets were read from DnDWeb or altered. No original function body, world-map or application source was changed.

**Exact executable commit:** `910bc03aad4f473e9c851df7fd146021a8b8aecc`, with **all seven** CI workflows SUCCESS, including [signed run 43625172792](https://github.com/bob8675309/DNDNEXT/actions/runs/43625172792). The later docs/handoff-only commit must be independently CI-checked; it does not replace the precise code-bearing test receipt.

## Explicit limits and incomplete owner release requirements

This is **T2 disposable signed source/role evidence**, not a T4 real Next.js browser test using the now-unmounted #345 Profile UI. Four held UI source files are preserved byte-identically and inactive under `scripts/integration/c34/preserved/held345/`: global overlay, UUID event utility, private creator panel and centered CSS. The active `NpcPanel.js` on `main` still uses an older direct `characters` reader/legacy secret path. Never mount the global overlay before replacing that with the original server-safe reader and preserving full app consumers, including inventory, town and Print.

Other release blockers: source-authentic comprehensive XPHB/warlock equipment (T18 reduced fixture), 22 legacy account writer paths, 44 open / 80 closed-unmerged PR feature dispositions, seven-role real-Next user interface and PDF visual matrix, all non-Profile SECDEF/ACL direct readers, complete rollback/migration plan, and **independently verified encrypted PG17 plus 340 actual Storage-object bytes restored**. The two original world-map triggers remain owner-protected and intentionally excluded; no maps changed. Production Supabase SQL, RLS, Storage, Vercel and `main` untouched. No PR closed, merged or retired. No paid automation enabled.

## ONE NEXT BOUNDED TASK

Perform **disposable real-Next.js browser compatibility rehearsal** of original held #345 secure Profile/creator panel/town and inventory consumers against T19's 29/31 original source + stage1–3 signed DB, preserving source/role/negative cases `C3B`, `C3P`, `C3T`, `C3I`. Do this in an isolated research/browser harness: **no active application import, no map offcanvas change, no production deployment** unless separately owner-approved; if the current app cannot safely mount the UI in the test harness, identify the missing consumer and SQL preflight and hold rather than weakening auth. Verify real logout/account-switch wipe and public Profile→Shop→Profile, canonical editor Sheet vs GM-only Story/secret, and actual Print visual QA. Maintain the original held #345 27-green workflow evidence at its own SHA `4f5f8ff7587aff1a68f21581ad68a4752789f54a`; do not call it equivalent to a new T19-app browser run.

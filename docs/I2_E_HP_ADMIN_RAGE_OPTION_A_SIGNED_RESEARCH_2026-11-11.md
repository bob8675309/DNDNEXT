# I2-E — Original HP, Admin progression, and Rage action-state Option A no-mirror research

**Research only — November 11, 2026 America/Chicago.** Stacked directly on [I2-D #368](https://github.com/bob8675309/DNDNEXT/pull/368). **Owner-approved Option A:** individual `public.character_sheets` records are authoritative, all current legacy `public.players.sheet` snapshots (empty or populated) remain byte-identical, and every automatic account-sheet mirror must eventually retire after its callers, permissions, and consumers are audited. No production data, function, ACL/RLS, frontend, map, merge, or deployment changes are authorized.

> **2026-11-11 America/Chicago (Nov 12 UTC) signed acceptance VERIFIED:** [dedicated PostgreSQL 17/GoTrue/PostgREST Actions run #43146151864](https://github.com/bob8675309/DNDNEXT/actions/runs/43146151864), job `130944312890`, **SUCCESS**, code/test source commit `1e757834d7c14876d9729cbccae8a9e2f20fbb22`. Unchanged full historical I1-B–O signed Forge/nonce/Story, I2C-01–10 and I2D-01–11 ran first; then **I2E-01–11 all PASS**. Source-original REDs I2E-03 (HP), I2E-04 (Admin progression) and I2E-05 (Rage action) independently show each original function overwrites two unrelated editable accounts' populated legacy sheets while canonical target and other unrelated canonical sheets remain correct. After all three REDs, exact-source-reversible private scratch candidate I2E-06 disables just their three account UPDATEs. Signed I2E-07–11 prove matching/unrelated snapshot freeze, HP/temporary HP, canonical Admin XP and events, Rage resource counts, owner/delegate/Admin rights and negative/rollback checks, unchanged private Story and preserved profile name updates. **This is not a production fix; 27 other original account UPDATE functions remain untested.** The Rage-specific canonical state is deliberately a **privileged-local synthetic Barbarian sheet**, not signed Barbarian Forge creation. Final documentation-inclusive exact-head CI must still be verified.

## Source-original read-only audit

The following **exact deployed PostgreSQL 17** function bodies were retrieved through SELECT-only `pg_get_functiondef`, without reading live character/account content:

| Original function | MD5 | Responsibility and side effect |
|---|---|---|
| `public.adjust_character_hit_points_v1(uuid,integer,integer)` | `f855be60d971aa63e32ade327d14c369` | Canonical HP, maxHP and temporary HP calculations, then legacy UPDATE to every can_edit account |
| `public.set_character_progression_v2(uuid,text,text,integer,bigint,text,text)` | `c4ea1c7993912f6b4c6fe9ee7b25343f` | Delegates Admin entitlement and canonical progression/event/class sheet changes to original v1, then repeats an account-wide mirror UPDATE |
| `public.update_character_sheet_action_state_v1(uuid,text,text)` | `313a533250724b2e2abc754899d0f8d4` | Source-original Barbarian Rage activation/deactivation/reset and canonical action state, then legacy account-wide UPDATE |

All three are `SECURITY DEFINER`. They use character permissions/admin controls before the canonical operation, but then write the resulting character sheet into *every editable account* for that character, even when an account's populated legacy snapshot belongs to a different character. Direct authenticated column-grant restrictions do not prevent a privileged function from executing this UPDATE.

The original Admin dependency `public.set_character_progression_v1(uuid,text,text,integer,bigint,text,text)`, **MD5 `eb467b7c7a8d548581a36cfcb0d8f77b`**, itself changes canonical progression, character sheets and level-event history but has no direct `public.players` update. Source inspection confirms none of these three account UPDATEs is followed by `IF FOUND`, `ROW_COUNT`, or other control-flow dependence on its row count; all continue to their original return. Therefore the **exact one statement** can be replaced by a `NULL;` no-op *in isolated research* while preserving original canonical calculation and entitlement code. This cannot be generalized to all remaining functions.

## Bounded signed acceptance design

The dedicated disposable PG17/GoTrue/PostgREST workflow runs the **entire unchanged** original I1-B–O Forge/Story/nonce/Artificer/HP/Admin research, then unchanged I2C-01–10 and I2D-01–11, and **only afterward** stages the three exact original live-source RPCs for new source RED tests.

The new independent `scripts/test_i2e_signed_hp_admin_rage_option_a_local_auth.mjs` signs in owner, coeditor, outsider, Admin and a synthetic historical account. It creates Fighter A/B/C/D through the actual signed v3 + private Story/nonce pathway with source-backed Fighter starting equipment; the signed owner/editor rights are granted locally for B/C, and Admin role is seeded only in the disposable test. For **Rage-specific tests only**, a locally privileged SQL update turns Fighter C's canonical JSON sheet into a source-shaped Barbarian Rage state. **This is not source-authentic Barbarian Forge creation;** it verifies the live Rage action RPC against an appropriate synthetic sheet and retains the original v3 character/Story/nonce witnesses.

| ID | Acceptance required |
|---|---|
| I2E-01 | Exact original live HP/Admin-v2/Rage RPC source hashes and Admin-v1/modern Story dependencies in isolated DB |
| I2E-02 | Real signed v3/Story + equipment A/B/C/D, owner/coeditor/outsider/GM actors, two editor permissions, historical unmarked legacy account, synthetic Rage sheet ready |
| I2E-03 — ORIGINAL RED | Signed owner HP on B changes B canonical sheet but overwrites both unrelated owner's A and coeditor's D populated legacy sheets |
| I2E-04 — ORIGINAL RED | Signed Admin progression-v2 on B changes canonical XP/event while overwriting both unrelated editor accounts |
| I2E-05 — ORIGINAL RED | Signed Rage activation on C changes canonical use count but overwrites both unrelated editor accounts |
| I2E-06 | After all original REDs, replace exactly three account UPDATE statements with source-reversible no-ops in disposable PostgreSQL; original canonical Admin-v1, v3, Story/nonce fingerprints unchanged |
| I2E-07 | Signed **same-character** HP and different-character coeditor HP change only canonical sheets; legacy contents and gameplay account updated_at unchanged |
| I2E-08 | Signed coeditor Rage deactivate/reset maintains original resource semantics while matching and unrelated account snapshots remain unchanged |
| I2E-09 | Signed Admin v2 class/XP progression and event updates work on both unrelated and matching historical snapshot accounts without any sheet/updated_at mirror |
| I2E-10 | Outsider HP/Rage, non-Admin progression, invalid HP and unsupported operation, plus direct client legacy write rejected atomically without sheet, history or private Story mutation |
| I2E-11 | Authenticated player-profile display name edit remains supported while historical sheet bytes remain unchanged |

The two source fixtures are `scripts/fixtures/i2e_original_hp_admin_rage_shared_forge_pg17.sql` and `scripts/fixtures/i2e_option_a_hp_admin_rage_scratch_pg17.sql`. The scratch fixture checks all three original MD5s, requires exactly one original legacy account statement per function, checks for downstream `FOUND/ROW_COUNT` dependencies, replaces that statement with an explicit `NULL;` sentinel, and demands exact MD5 recovery when reverting the sentinel. It also source-pins original canonical Admin-v1 and v3/Story so unrelated functions cannot be changed silently.

**Signed I2E-01–11 behavior accepted in local CI #43146151864; final documentation-inclusive PR head requires separate verification.** Source-only checks alone do not prove this result. All original SOURCE RED witnesses and historical I2C/I2D regression tests must be retained unchanged.

## Scope limitations and release gates

- Only **three original account UPDATE writers** are under investigation in I2-E. Together with earlier I2-B and I2-C bounded evidence this brings the ledger to **7 of 34 original account UPDATE functions**, leaving **27 untested** under Option A. Separate private copied v2 used by modern v3/Story is tracked as its own source path in I2-D rather than miscounted as one of the original 34 UPDATE functions.
- HP and Admin tests use genuinely signed source-created characters. The Rage-specific canonical data is a locally reshaped Barbarian sheet and **does not prove signed Barbarian Forge creation or every class-resource/state materializer**.
- This reduced disposable database does not execute the entire original **31-trigger Forge creation graph**, complete source/class/feature catalog, all 34 writers together, unmodeled dynamic/external SQL, full production RLS/Admin/service-role grants, real browser UX, whole-system concurrent locks, production rollback, second encrypted DB+Storage backup, or verified independent restore.
- Previous I1-M/I1-O/I1-P matching-nonce conditional same-character mirror GREEN results remain historically preserved, but **do not satisfy owner-approved Option A**. The new stronger contract requires **zero automatic legacy-sheet updates even when that sheet already belongs to the target character**.
- **No hosted database, live account/character data, runtime app files, protected world/town/tactical maps, Vercel deployment, production migration, branch merge, or paid agent change.**

**Next bounded step:** inspect the exact signed I2E-01–11 logs and update the append-only handoff; then advance to a separately source-audited group of remaining class-feature / level-up projector writers, preserving original REDs and all release gates. No blanket automated SQL replacement or deployment without new owner authorization.

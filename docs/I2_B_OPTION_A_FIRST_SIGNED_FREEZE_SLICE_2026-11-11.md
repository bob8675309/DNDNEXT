# I2-B — Owner Option A first signed legacy-freeze acceptance slice

**Research only.** Stacked on [I2-A #365](https://github.com/bob8675309/DNDNEXT/pull/365), which records the owner's approved Option A: **canonical per-character `character_sheets` is authoritative; preserve historical `players.sheet` exactly and eventually retire every automatic mirror writer**. This draft changes no hosted database function, production ACL, browser runtime, migration or deployment. It deliberately does **not** modify the previously signed I1-P RED/GREEN historical research.

> **2026-11-11 signed acceptance verified:** Dedicated local PG17/GoTrue/PostgREST [run #43026156045](https://github.com/bob8675309/DNDNEXT/actions/runs/43026156045), job `130541255466`, **SUCCESS** at source/test commit `744c344917f824487509ad392aa574b28182677b`: unchanged original P1.3 F06–F28 and all I1P-01–08 pass, then **I2B-01–08 PASS**. New Option A tests prove matching-character *and* other-character earned level-up/rest keep owner, coeditor and synthetic unmarked historical `players.sheet` contents and gameplay-side `updated_at` unchanged, while canonical sheets, level events, rest/Rage work; authenticated direct sheet INSERT/UPDATE and anonymous read are denied in scratch; signed profile-name UPDATE, ON CONFLICT UPSERT, identity INSERT and historical-name edit succeed with zero sheet change. The first [run #43025654174](https://github.com/bob8675309/DNDNEXT/actions/runs/43025654174) passed all original P1.3/I1P cases and the new I2B-01 source freeze, but failed on a *scratch seed* duplicate progression row: existing test trigger provisioned progression automatically. Corrected only the new test seed to use the existing I1P-compatible `ON CONFLICT(character_id) DO UPDATE` pattern. Preserve this failed receipt; no original source, candidate or RED control was weakened. **Final docs-inclusive CI still requires exact-head check.**

## Scope and chain of evidence

The new dedicated CI must run the original P1.3 authenticated earned-v5 tests **F06–F28** first, then the entire historical **I1P-01–08** (including original-source RED, conditional nonce-match GREEN and its same-character mirror update), and **only then** install this new Option A first-slice candidate and run **I2B-01–08**. This is a separate contract: under Option A, *even correctly associated same-character* historical snapshots must not be automatically updated.

The candidate covers exactly three of the 34 source-fingerprinted stored-function `UPDATE public.players` writers:

| Original live private function | Source MD5 | Verified original dependency |
|---|---|---|
| `complete_character_level_up_base_v3(uuid,jsonb)` | `e33639d549ef557976a3970ea51f5238` | Source-original player-earned v5 completion; canonical level/session/event path |
| `sync_player_forge_class_spell_summary_v1(uuid)` | `5b1b275a268a57591a2e35a05ce7480d` | Original class-spell summary/character sheet projection during level-up |
| `restore_character_rest_action_state_v1(uuid,text)` | `d75edf2ac583e3790882155c702e2165` | Original noncaster Barbarian Rage short/long rest |

For these three original source bodies, read-only introspection verified that the exact account `UPDATE` is not followed by a branch that uses its `FOUND` or `ROW_COUNT` result. The candidate fixture first *reconstructs and hashes* each exact original body from its previous I1-P guarded scratch form, then replaces that one complete account `UPDATE` with a `NULL;` no-op. It requires that restoring exactly the original statement produces the original live MD5. Public `complete_character_level_up_v5`, public `complete_character_rest_v1`, original rest spell-slot/profile logic, permission guards and canonical source remain unchanged. A no-op avoids issuing an `UPDATE WHERE false` that might still require privileges or accidentally affect statement-dependent behavior.

The **v1 character creator is deliberately excluded**: its direct legacy `UPDATE public.players` is followed immediately by `IF NOT FOUND THEN INSERT ...`. Dropping this UPDATE without restructuring its account-name/identity-row creation path could introduce a regression. The original v2 UPSERT and signup profile insertion also require separate source-preserving work.

## Signed local acceptance

The new runner `scripts/test_i2b_option_a_first_slice_local_auth.mjs` uses real local GoTrue sign-in/JWT and PostgREST after the complete earlier tests. Locally privileged SQL seeds character specimens; actual level-up and rest actions are **signed**. No actual signed full Forge v2/v3 character creation is claimed.

| Test | Expected acceptance |
|---|---|
| I2B-01 | Existing I1-P scratch source identified; reconstructed live MD5 for all three; exact mirror statement replaced only after previous RED/GREEN; public earned-v5/rest hashes preserved |
| I2B-02 | Signed users and independent canonical character IDs; unrelated populated account snapshots plus a deliberately unmarked historical snapshot |
| I2B-03 | **Same-character** signed Fighter earned level-up and Barbarian long rest update canonical sheets and histories, while the original matching legacy sheets and `updated_at` remain unchanged |
| I2B-04 | **Different-character** signed earned level-up and short rest advance their canonical sheets while owner, coeditor and historical account snapshots remain byte-identical |
| I2B-05 | Outsider, invalid rest and repeated level-up denied without additional mutations |
| I2B-06 | Disposable players RLS and authenticated privileges disallow direct sheet INSERT/UPDATE, but allow profile-column writes |
| I2B-07 | Real signed direct legacy sheet UPDATE/INSERT denied; anonymous read denied |
| I2B-08 | Real signed player-name UPDATE, same-user ON CONFLICT UPSERT, new identity INSERT and renaming a historical unmarked account remain working; no sheet content changes |

The scratch ACL fixture uses the reduced P1.3 `players` table, adds its `name` column, enables self-row RLS and restricts `authenticated` to `INSERT(user_id,name)`, `UPDATE(user_id,name,updated_at)`, and SELECT. Including `UPDATE(user_id)` supports the existing application's `ON CONFLICT(user_id)` UPSERT shape; RLS `USING` and `WITH CHECK` still forbid changing the owner to another user. These are **disposable role tests only**, not a complete production Admin/service-role/default-grant parity audit.

### Explicit gaps

The [full source-identity coverage ledger](I2_B_OPTION_A_SOURCE_WRITER_COVERAGE_2026-11-11.json) enumerates all 34 original UPDATE functions and three INSERT/UPSERT paths from I1-N and marks only three as belonging to this first signed freeze test. **31 UPDATE writers and all 3 INSERT/UPSERT paths are not Option-A-tested**. The 34 original source fingerprints still refer to deployed originals. This research has not frozen a single production writer.

No **signed Forge creation+earned level-up/rest co-residency**, full 31 original Forge triggers, live-role Admin/service privilege parity, full caster and encounter-rest veto, actual browser name flow, backup+Storage isolated restore, external client review or global cross-writer concurrency certification is claimed. No player data, user identifiers, historical sheet payloads or private Story were copied from production. The legacy row with no creation marker is a **synthetic local specimen only**.

### Owner release constraints

Do not ship the Option A mirror freeze until the owner approves the complete coordinated release after a reversible, source-hash-locked **all 34+3 writers** test suite, genuine client ACL/actor tests, role/RLS Admin checks, preserved account/profile name behavior, browser and original gameplay acceptance, explicit concurrency and verified independent database+Storage restore. Prior I1-M/O/P research allowing same-character mirrors remains historically true for those candidates, but **does not define Option A production behavior**.

**Acceptance status:** I2B-01–08 source/test acceptance VERIFIED by signed run #43026156045, with original source cases preserved; the complete documentation-inclusive PR head requires separate exact-head verification. This is a disposable first slice, not production acceptance.

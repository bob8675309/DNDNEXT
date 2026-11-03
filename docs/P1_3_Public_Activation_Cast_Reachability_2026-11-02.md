# P1.3 — Public Encounter Activation/Resume Versus Healing Word v13

> **Validated source-fidelity PostgreSQL 16 research, NOT a production incident or approved migration.** Tested in scratch PG16 at GitHub [run 41560428459](https://github.com/bob8675309/DNDNEXT/actions/runs/41560428459), job [125669464564](https://github.com/bob8675309/DNDNEXT/actions/runs/41560428459/job/125669464564), commit `cebc04adcc2651ea9e38db1a9d815798d8cfcd3d`. All three cases **PASS** and **all seven GitHub checks passed** on the tested SHA. No production SQL, combat resources, grants or runtime files changed.

## Source provenance and fidelity limits

The [verbatim function snapshot](../scripts/fixtures/p1_3_public_cast_v13_source_pg16.sql) includes these SELECT-only deployed definitions:

| Deployed function | Source MD5 | Role in test |
| --- | --- | --- |
| `public.encounter_cast_spell_v13` | `03ea7bd00bcd9734ef70ebc035c54a8d` | Exact **Healing Word XPHB** branch, including request-ledger insert, P→E locks, active-turn validation, S decrement and combat logging |
| `private.encounter_enforce_spell_slot_cast_turn_v1` | `78195a807865efdbf74122a3d562a095` | Exact slotted-cast turn guard |
| `public.admin_start_encounter_v1` | `ce7bb040cb09d9dac85517ea8206b44e` | Exact encounter start E→P updates and status change |
| `public.admin_set_encounter_status_v1` | `ab4592dc22632d646886f0d808cfb95f` | Exact paused→active handling |
| `private.refresh_encounter_spell_slots_from_characters_v1` | `d16af751b63fc3214b2b5d6cc9621160` | Exact C→S refresh helper |
| `private.mirror_encounter_spell_slot_spend_v1` | `b30565d75b05b042c1ad8f9803284486` | Exact S→C bridge when spending |
| `private.sync_character_spell_slots_v1` | `6c276ab2135fb90894fd8684e39ce1c3` | Exact canonical pool synchronization |

The fixture installs the live `encounter_spell_slots_refresh_on_activation` **AFTER UPDATE OF status** trigger into the scratch database, using its deployed trigger statement. The separate **AFTER INSERT active** trigger was inspected previously but not installed in this particular test.

**Mocked dependencies:** map/participant/class/ledger schema projections; `auth.uid()`, `auth.role()` and Admin controller identity; `encounter_spellcasting_profile_v1`, ability score and healing application helpers; other live triggers and all actual GoTrue/JWT sessions. The earlier **test-only TC1 status trigger** remains in the shared scratch workflow. Every new character is distinct and in a single encounter, so the test does not intentionally exercise TC1 conflicting activation. The Healing Word self-target avoids external targeting helpers, and the spell metadata is a *synthetic reviewed-format XPHB cleric assignment*. These tests do not assert the whole production healing implementation, true login entitlements or availability of every spell branch.

[Scratch setup](../scripts/fixtures/p1_3_public_cast_start_setup_pg16.sql), [exact v13 and turn guard](../scripts/fixtures/p1_3_public_cast_v13_source_pg16.sql), [two-session runner](../scripts/fixtures/p1_3_public_cast_start_race_pg16.sh), [CI workflow](../.github/workflows/validate-p1-3-real-admin-paths.yml).

## Three executed cases

**Case 19 — valid cast AFTER public Start: PASS.** Calls the exact Admin Start RPC on a staged encounter; deployed activation trigger executes canonical spell slot refresh C→S, populating the snapshot. Then the exact public Healing Word v13 source casts on its actor's valid active turn. One bonus action and spell slot are spent, the persistent C pool and S snapshot both reach zero, and exactly one `spell_cast` log and completed command request are present. This validates **sequential** public-function compatibility in the mock schema.

**Case 20 — concurrent Start versus v13 Cast: PASS, deadlock reproduced.** Session A holds encounter E for a controlled interval before calling the **exact** Admin Start RPC (E→P). Session B starts the **exact** Healing Word v13 RPC, creates its ledger request and locks caster P before waiting for encounter E. Start attempts to update the same P while holding E; PostgreSQL reports `deadlock detected`, aborting a transaction. The test asserts no partial spell cast, no persistent slot decrement, no spent bonus action, and a consistent final staged or active state depending on which transaction was aborted. **Crucial reachability qualification:** the cast RPC was *submitted while the encounter was still staged and uncommitted*. It could have passed its turn check only if activation committed before that check; therefore this test proves a **concurrent public RPC lock-path conflict**, **not** a deadlock between two already-valid, committed gameplay actions or a production exploit.

**Case 21 — Resume E lock versus queued v13 Cast: PASS without deadlock.** Session A locks a paused encounter E then calls the exact `admin_set_encounter_status_v1(...,'active')` RPC, causing activation refresh. Session B submits exact Healing Word v13 and waits for E after taking P. Resume completes, then the cast passes active-turn validation, spends exactly one canonical/snapshot slot and writes exactly one cast log. This demonstrates a **serialized outcome** for this particular paused→active interleaving, not an assurance that all resume/reaction/spell combinations are deadlock-free. Notably, the spell call began while the encounter was paused and became valid under the server's active-turn check after resume committed.

## Interpretation for the prior C↔S inversion

Earlier [private refresh-versus-spend case 17](P1_3_Refresh_vs_Spend_Source_Lock_2026-11-02.md) reproduced a scratch C→S / S→C deadlock by manually prelocking C and directly calling the refresh helper. **The current public activation and v13 path do not establish that same C↔S deadlock is reachable as a pair of valid public commands.** The public Start/status functions lock E, and v13 locks P→E **before its S decrement**. With a single encounter, the E lock can serialize later S/C work; however it also introduces the separately reproduced Start E→P / Cast P→E deadlock when an early cast attempt races with activation. Other spell versions, active-encounter refresh entry points, and cross-encounter canonical resources remain outside this proof.

The first integration CI run [41560249154](https://github.com/bob8675309/DNDNEXT/actions/runs/41560249154) executed Cases 19 and 20 successfully but failed on a malformed assertion *message string* in Case 21; it did not indicate a gameplay or database transaction failure. After fixing the test-only quote, the exact suite at 41560428459 passed all three tests.

## Unresolved gates and next action

- Verify valid active-turn **attack, reaction, movement, end-turn and v10–v13 delegated spell writers** under concurrent status/turn changes; cover same-participant P and E as well as all affected target IDs and timing triggers.
- Trace permission edits/revocation through actual Admin or direct table writes, then test replay and permission freshness using **genuine distinct signed-in JWT sessions**, not the mock `auth.uid()`.
- Complete TC1 Option A active-encounter admission design (Start and paused Resume), preserve the one historical live overlap for explicit GM review, and coordinate lock roots with E/P/L/W/X/S/C and permission rows.
- Propose a single global order only after full source/trigger/grant coverage and rollback fixtures. **Do not treat a one-pair positive control as an approved universal order.**

**P1.3 and P1.5 remain OPEN. PR #317 is a draft, not deployable combat SQL.** No owner manual test is required for the scratch CI work.

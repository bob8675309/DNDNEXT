# P1.3 — Exact turn-start effect trigger E→X→P race

> **TESTED PASS in disposable PostgreSQL 16; NOT a production incident or safe global ordering proof.** Verified 2026-11-01 against draft PR #317 at commit `b2db2f8af7c5d2d745072422adf2e5317e65ba82`. [Exact-head GitHub run 41394548206](https://github.com/bob8675309/DNDNEXT/actions/runs/41394548206), [job 125112944491](https://github.com/bob8675309/DNDNEXT/actions/runs/41394548206/job/125112944491). All seven GitHub checks passed.

## Source provenance and trigger conditions

The fixture uses unmodified `pg_get_functiondef` snapshots taken SELECT-only from DnDWeb:

- `private.expire_encounter_timed_effects_on_turn_start_v1` MD5 `e8e898f3a427897863f31c64b2e1a4ea`. Its live `AFTER UPDATE OF active_participant_id` trigger runs when the active participant changes, locks timed effects X with `FOR UPDATE`, deletes source-turn-start expiry effects, then updates **another target participant P's speed** and writes an `effect_expired` log.
- `private.encounter_timed_speed_penalty_ft_v1` MD5 `3f400bb98f340bde58f13f39d05273a8`. This source-derived helper reads remaining speed penalty metadata.
- The exact live trigger `encounter_timed_effects_turn_start_expiry` is installed in the scratch schema.
- [Source snapshot](../scripts/fixtures/p1_3_turn_expiry_live_source_pg16.sql), [setup](../scripts/fixtures/p1_3_turn_expiry_setup_pg16.sql), [two-session test](../scripts/fixtures/p1_3_turn_expiry_race_pg16.sh).

**Dependency boundary:** PostgreSQL 16 is real, source trigger/SQL helper bodies and trigger definition are exact, but full DnDNext schemas, authorization, class speed function, other triggers and character resources are **mocks**. The tests do not connect to DnDWeb.

## Two independent sessions — actual outcomes

**Case 10: SOURCE-DERIVED NEGATIVE CONTROL (PASS).** Session A takes an exclusive lock on target participant P, sleeps, and attempts to update encounter E. Session B concurrently changes `encounters.active_participant_id` (holding E); the exact turn-start trigger locks X, deletes the expiring effect and attempts to update the **same target P**. PostgreSQL reported **`ERROR: deadlock detected`** in the scratch database and aborted one transaction. Test asserts the final log/effect state is consistent with whichever transaction committed: no orphan log or half-expired effect. This establishes a real **E→X→P vs P→E** two-row identity cycle in the source-equivalent model, not a production occurrence.

**Case 11: ENCOUNTER-FIRST POSITIVE CONTROL (PASS).** Both sessions acquire encounter E before target P/effect work. The source trigger completed and wrote exactly one effect-expiration log. The effect was removed and the active participant changed. No deadlock arose **in this particular interleaving**. This is not a universal safe order across spell slots, reactions or Admin/staging mutations.

GitHub job logs explicitly include: `TRIGGER CASE 10`, `PASS: exact turn-start expiry trigger produced a PostgreSQL deadlock with same target P in scratch DB`, `TRIGGER CASE 11`, and `PASS: E-first positive control committed the expiry and log`.

## Other live source facts — untested concurrency

The `encounter_spell_slot_character_spend_bridge` trigger fires on decrement of `public.encounter_spell_slots.slots_remaining`. Its deployed `private.mirror_encounter_spell_slot_spend_v1` MD5 `b30565d75b05b042c1ad8f9803284486` reads the caster/encounter, calls `private.sync_character_spell_slots_v1` MD5 `6c276ab2135fb90894fd8684e39ce1c3` (which may INSERT ... ON CONFLICT or DELETE persistent slot pools) and then locks the canonical `character_spell_slots` pool C `FOR UPDATE`. This means the **S→C edge includes an internal synchronization step and potential uniqueness waits**; do not model it as a single direct C lock or assume one E-first root is sufficient. **No S→C concurrent test was run in this iteration.**

## Release gates and next task

P1.3 remains **open**. Next perform source-derived disposable PG16 races for slot bridge S→C (including `sync_character_spell_slots_v1`), participant deletion, permission revocation and historic spell wrapper/attack/reaction paths. Evaluate a global order across E/P/W/L/X/S/C and permission locks and actual trigger identities, then test genuine signed-in users. The TC1 Option A admission guard and one existing production overlap still require explicit review and **are not deployed**. No runtime code, database migrations, grants, production data or protected maps changed.

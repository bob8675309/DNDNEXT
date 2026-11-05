# P1.3 — Exact-source Start/Staging row-lock deadlock

**Verified in isolated PostgreSQL 16; not a production incident.** [GitHub run 41392432969](https://github.com/bob8675309/DNDNEXT/actions/runs/41392432969), [job 125106533413](https://github.com/bob8675309/DNDNEXT/actions/runs/41392432969/job/125106533413), commit `30c646ee8a235e21036548f6f3796133fc1b4b2b`: both additional race cases **PASS**. All seven GitHub checks passed at that commit.

## Source identity and actual lock ordering

- `admin_start_encounter_v1` (live pg_get_functiondef MD5 `ce7bb040cb09d9dac85517ea8206b44e`): encounter **E FOR UPDATE** then participant **P UPDATE**.
- `admin_update_encounter_participant_staging_v1` (live pg_get_functiondef MD5 `190bbed26d2067905b00000686c17176`): participant **P FOR UPDATE OF p** then encounter **E UPDATE**.

The [verbatim staged-update source](../scripts/fixtures/p1_3_staging_lock_race_pg16_live_source.sql), [scratch setup](../scripts/fixtures/p1_3_staging_lock_race_pg16_setup.sql) and [two-session script](../scripts/fixtures/p1_3_staging_lock_race_pg16.sh) run in the existing disposable [PG16 CI workflow](../.github/workflows/validate-p1-3-real-admin-paths.yml). Both routines contend for **the same encounter E and participant P row**, not just their abstract table classes.

**Race case 8 — negative control:** Session A explicitly pre-locks E, pauses to establish the interleaving, then calls the **unaltered Start source**. Session B concurrently calls the **unaltered staging-update source**, taking P then waiting for E. A subsequently waits for P. PostgreSQL logged an actual `ERROR: deadlock detected`; one transaction rolled back and an assertion checked active-status/combat-log consistency.

**Race case 9 — positive control:** Both sessions explicitly pre-lock E first, then call the original routines. Start commits once; staging observes active play and is rejected with the existing error `Staging changes are locked after active play begins`. Its hex is unchanged, the log is singular, and no deadlock is reported.

**Interpretation:** This demonstrates a **reachable source-derived row-lock inversion in a deliberately scheduled two-session scratch test**. It does **not** demonstrate a production deadlock, establish its frequency, or prove encounter-first locking safe for the whole application. The schema and `auth.uid()/role` are mocks; real combat triggers, FK interactions, revocation races and spell resource writes are not reproduced.

## Remaining blockers

P1.3 remains unchecked. Expand exact-source tests to participant removal, turn-start timed-effect expiry E→X→P, slot bridge S→C, permission-row revocation and all legacy spell/reaction/attack entry points. TC1 Option A requires concurrency-safe admission on both Start and Resume, with the existing live overlap retained for explicit GM reconciliation. No production SQL, grants, world/town map changes or merge are authorized.

**Next one task:** Design and execute source-derived trigger/resource/permission two-session races, then decide a **global** ordering with a reversible rollout; do not promote the E-first positive control alone.

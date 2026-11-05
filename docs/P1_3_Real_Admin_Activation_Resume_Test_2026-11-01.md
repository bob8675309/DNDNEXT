# P1.3 — Exact Live Admin Function Snapshot in Disposable PG16

**Status: VERIFIED SUCCESS in GitHub Actions [run 41389394032](https://github.com/bob8675309/DNDNEXT/actions/runs/41389394032), [job 125097217840](https://github.com/bob8675309/DNDNEXT/actions/runs/41389394032/job/125097217840), source commit `2f8c42deee0d85b36793b74b1ea1b488ac2b220a`.** Job logs explicitly show PASS for all seven cases (including expected `TC1_CONFLICT` and transaction rollback errors); all other six GitHub checks passed at this SHA. **Research only; no production SQL modification.** The SQL in `scripts/fixtures/p1_3_live_admin_source_pg16.sql` is a verbatim, dated read-only `pg_get_functiondef` snapshot of the deployed `public.admin_start_encounter_v1` and `public.admin_set_encounter_status_v1`, along with their database fingerprints. The contents are only installed in GitHub Actions' disposable PostgreSQL 16 service.

The supporting schema and fixed Admin identities are intentionally **mocks**. Only the two named function bodies are exact; this is not the full DnDNext schema, deployed trigger set, live Auth, RLS, item/spell-slot mechanics, or an end-to-end permission test. The test-only `private.tc1_fixture_guard` trigger illustrates possible admission serialization **without asserting it is compatible with the existing global E/P/L/W/S/C lock order**.

## Seven acceptance checks

1. Without any TC1 trigger, run two concurrent calls to the **exact original** `admin_start_encounter_v1` on separate staged encounters sharing one canonical character: both succeed. This reproduces missing exclusivity in the isolated dependencies.
2. Without TC1 trigger, the exact original `admin_set_encounter_status_v1` can change a paused encounter with the same character to active, confirming the separate resume path.
3. Install a *scratch-only* `BEFORE UPDATE OF status` TC1 guard. It locks canonical character rows and checks other active encounters; **not a proposed production migration or a proven global lock scheme**.
4. Run concurrent original Start Encounter functions with the scratch guard: one succeeds, the other gets `TC1_CONFLICT`, exactly one log commits.
5. Test paused-to-active and direct SQL status-update paths: both reject a second active encounter, leaving original status/version intact.
6. Separate characters can activate in separate encounters.
7. A simulated transactional error after the actual Start Encounter body rolls back encounter, participant action reset, and log; a subsequent retry succeeds.

**Expected engineering insight:** guarding only `admin_start_encounter_v1` is insufficient, because the existing `admin_set_encounter_status_v1` has a separate paused-to-active update. An admission mechanism must cover **all** transitions to active and the eventual participant mutators, without introducing a new C↔E/P conflict.

**Remaining P1.3 blockers:** source-complete cross-command and trigger lock graph, concurrent privilege revocation and two-controller NPC authority, the live participant mutation race, spell-slot S→C and timed-expiry E→X→P, old and new spell cast routing, multi-encounter pre-existing data reconciliation, paused reservation lifecycle, and a safe rollback/migration proposal. Passing scratch tests cannot establish actual production enforcement or complete P1.3/P1.5.

**Verified evidence:** [exact-source CI job](https://github.com/bob8675309/DNDNEXT/actions/runs/41389394032/job/125097217840) completed successfully. Log shows cases 1–7; baseline two unguarded starts both succeed; unguarded paused resume succeeds; guarded concurrent starts produce one successful start and one TC1 conflict, with one combat log; guarded paused resume and direct status UPDATE raise TC1_CONFLICT; unrelated actors both start; forced error rolls back all state and later retry succeeds. This is **real PostgreSQL execution of source-equivalent Admin function bodies with mock dependencies**, not a signed-in application test.

**Next:** Extend to exact-source participant-add/update/remove, encounter status/turn triggers, and transaction-wide permission/character reservations; run mixed-version and cross-command races before selecting a universal lock protocol. No owner manual tests or production database action are required for this verified research pass.
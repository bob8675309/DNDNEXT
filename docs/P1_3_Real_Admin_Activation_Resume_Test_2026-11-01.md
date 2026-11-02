# P1.3 — Exact Live Admin Function Snapshot in Disposable PG16

**State at authoring:** CI not yet run for this new fixture. **Research only; no production SQL modification.** The SQL in `scripts/fixtures/p1_3_live_admin_source_pg16.sql` is a verbatim, dated read-only `pg_get_functiondef` snapshot of the deployed `public.admin_start_encounter_v1` and `public.admin_set_encounter_status_v1`, along with their database fingerprints. The contents are only installed in GitHub Actions' disposable PostgreSQL 16 service.

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

**Next:** inspect the exact GitHub CI run and logs. If it passes, record SHA/run in the handoff ledger; if it fails, correct only the isolated fixture. No user manual tests or production database action are required for this pass.
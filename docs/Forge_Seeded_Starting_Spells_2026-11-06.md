# Forge original deferred starting spells — seeded signed-in research

**Date:** 2026-11-06. **Status:** initial genuine JWT CI **FAILED at J157**, correction scoped, full new-head CI **PENDING**; not production/test acceptance. Branch `research/forge-starting-spells-seeded-20261106` stacked on [draft PR #328](https://github.com/bob8675309/DNDNEXT/pull/328) exact source `16ebd9ba1b952d8f21505c91782d0d18aa0c8263`, transitively on Forge #324 and privacy #321; no game release implied.

## Source authority verified read-only

Live DnDWeb Supabase PG17 was queried only for PostgreSQL function/trigger definitions. The live `private.validate_player_forge_starting_spells_v1()` `pg_get_functiondef` MD5 is **`6870e810de909209c44aecd02f5c72e2`**. The original trigger is `character_progression_validate_player_forge_spells_v1`, on `public.character_progression`: **AFTER INSERT OR UPDATE OF class_id, class_level, DEFERRABLE INITIALLY DEFERRED, FOR EACH ROW**. The source text is preserved **without edits** in `scripts/fixtures/forge_starting_spells_original_pg17.sql`. The local install SQL asserts the original source hash and trigger event/deferral; it will fail if either drifts.

**Reduced dependency:** The real handler queries `public.class_catalog_preferred`, absent from the earlier local reduced harness. The extension installs only an **XPHB-only class view with the columns the validator needs**, explicitly not the full live source-prioritized preferred-catalogue view. Two progression count columns are added in local PG17 to match the handler's expected type surface. Original SQL body remains intact. This first slice does **not** certify the Wizard, Warlock, Eldritch Knight/Arcane Trickster prepared-count logic or all full class/spell catalogues.

## Implementation and test mechanism

- `scripts/fixtures/forge_starting_spells_local_auth_pg17.sql` installs the untouched body and exact deferred constraint trigger **after** the already-accepted baseline J153 and seeded S001–S003. No fixture rewrites or reorders the existing tests.
- `scripts/fixtures/forge_seeded_starting_spells_v1.json` defines stable source-qualified scenario IDs and seeds 63154, 63155, 63156 with three strictly bounded behaviors.
- `scripts/validate_forge_seeded_starting_spells.mjs` compiles those inputs using the **existing** `compileScenario` deterministic compiler, refuses unknown modes and extra fields, and verifies changed seeds produce distinct request identities. Static results are NOT authenticated acceptance.
- `scripts/test_forge_immutable_creation_replay_local_auth.mjs` appends actual signed-in Player v2 RPC cases after S003. J154 checks original hash and deferral; J155 expects successful Fighter/Champion no-magic creation, one CP/CS/G/GI/I/C/event, and immutable identical replay. J156 submits an invalid non-array starting-magic value and requires the **original** deferred message plus no nonce or canonical global-state/stock leaks. J157 submits a class Fire Bolt for noncasting Fighter; genuine signed-in CI showed **the original v2 class-list guard intercepts first** with exact error `Fire Bolt is not on the Fighter class spell list.`. The corrected test asserts that earlier guard and full rollback; **J157 is NOT counted as a deferred starting-spells handler execution**. This protects source authority without overriding legal class spell rules.
- The test writes `FORGE_STARTING_SPELL_SCENARIOS.json`, containing only scenario names/seeds and booleans/canonical counts, never signed JWTs, actual created UUIDs, original character sheets or raw SQL rows. CI uploads via existing short-retention diagnostics.

## Acceptance and release boundaries

Before claiming PASS, check exact SHA and real [Forge research CI workflow](https://github.com/bob8675309/DNDNEXT/actions/workflows/validate-forge-immutable-creation-replay.yml): original PG17, genuine local GoTrue/PostgREST, J00–J153, S001–S003, J154–J157, static tests, and the source-original trigger matrix must all pass. Any failure in earlier tests is a regression, even if the new cases pass. The original matrix previously reported 15/31 staged and 16 missing; if this handler is independently verified, update to 16/31 staged, 15 missing, and a fourth focused real-JWT trigger receipt—but only with exact-head evidence.

No live Supabase writes/grants, `main` merges, Vercel previews/production deployments, paid AI, world/town maps, browser acceptance, or full live security/RLS parity. Preserve research draft dependency topology and prior J00–J153/S001–S003 evidence.

**Next task:** Verify exact-head CI, inspect failure cause or successful J154–J157 evidence, update both living `ACTIVE_WORK.md` and append-only `HANDOFF_LOG.md` with actual run IDs, then select one next missing original trigger from a newly verified source/coverage matrix.

## First CI diagnosis (retain failure history)

At executable candidate SHA `5ab887fe9293fcf0cb4c67eee62ec43949b5e01a`, [run 42303937461](https://github.com/bob8675309/DNDNEXT/actions/runs/42303937461) reported original PG17 job **SUCCESS**, genuine local JWT job **FAILURE**. Source-authenticated J00–J153 and S001–S003 completed first, and J154 hash/deferral, J155 valid no-magic Fighter/nonce replay, J156 malformed `startingMagicSelections` exact deferred-source error with full rollback all explicitly **PASS**. J157 expected an error from the deferred handler, but the server returned **"Fire Bolt is not on the Fighter class spell list."** from the earlier legitimate original v2 selection guard. This is a real failed test expectation, not missing authentication or a changed live handler.

**Correction:** Keep strict matching of the *actual original earlier class-list rejection* and full rollback for J157. Flag `deferredStartingSpellHandlerReached:false` in the sanitized case report. Do not substitute a fake Fighter spell-list row, relax the original starting-spell validator, or claim that J157 independently exercises the deferred handler. J156 already supplies genuine signed-in deferred handler execution. The next substantive expansion needs a real allowed caster/spell-catalog source pair and valid prepared-count fixtures, separately reviewed.

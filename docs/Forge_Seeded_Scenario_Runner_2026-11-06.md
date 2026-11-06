# Forge seeded deterministic scenarios — first executable research slice

**Decision:** 2026-11-06. **Status:** reviewed *implementation candidate*, NOT an accepted/executed real JWT result until new exact-head CI passes. Work branch `research/forge-seeded-scenarios-20261106`, based on held draft PR #324 at `f1a2c564046ab93a0bfa0732e3acc2179da9c064` (itself stacked on unmerged creator/privacy PR #321). Current `main` checkpoint when prepared: `79a6340c08e743e71e1072e40e6ba7204f735a29`. No production SQL, model, deployment or feature changes.

## What is executable

- `scripts/fixtures/forge_seeded_scenarios_v1.json`: strict v1 source-qualified Fighter Champion manifest, signed-in PLAYER only, real v2 and v3 RPCs, expected canonical one-row counts and exact error/rollback expectations. No real character payloads, tokens, credentials or secrets.
- `scripts/agents/forge_seeded_scenarios.mjs`: pure SHA-256 seed-to-name/request-UUID compiler and a *thin assertion runner*. Seeds 61021/61022 produce deterministic inputs; re-running in separate Node processes must yield identical serialized plans. Seed 61022 on the v2 case's 61021 identifier produces a distinct legal request. Does not implement game rules or choose classes from a fabricated catalogue.
- `scripts/validate_forge_seeded_scenarios.mjs`: offline test that launches **two separate Node processes** to compare identical plans, proves different seed/ID, and rejects unexpected actor, edition, counts or manifest fields. **This is contract-only, not authenticated acceptance.**
- `scripts/test_forge_immutable_creation_replay_local_auth.mjs`: existing untouched J00-J153 test sequence followed by S001-S003. Reuses its already authenticated PLAYER actor, existing `subclassDraft` positive XPHB Champion source/feat/equipment fixture, source-original subclass trigger, and actual `create_player_character_v2/v3` PostgREST calls.
- `.github/workflows/validate-forge-immutable-creation-replay.yml`: adds strict static schema/seed checks, and an artifact path for `research-agent-artifact/FORGE_SEEDED_SCENARIOS.json`; retained original PG17, real local GoTrue, source hash, J00-J153 and cleanup gates.

## First exact-head acceptance matrix (CI evidence required)

| Test | Expected invariant |
| --- | --- |
| Static v1 schema | Same manifest+seed equals across two independent Node processes; changed seed changes name+nonce but keeps XPHB legal input |
| Source original SQL | Function `private.apply_character_forge_subclass_choice_v1()` retains live source MD5 `273be29420a7274d997642e302604cb7`; first J00-J153 original fixtures still pass |
| S001 source v2 | Signed-in PLAYER creates XPHB Fighter Champion 3, with one character, sheet, CP, level event, G, GI, I and C; original source and caller attribution are observed from real DB |
| S002 changed seed | Same valid v2 source case with seed+1 creates an independent legal request; equal-intent replay returns same character with identical row fingerprints; modified `subclassSource` on same nonce gives SQLSTATE `22023` |
| S003 source v3 | The original v3-v2 chain again creates a valid source-qualified Champion; same-intent replay inert and changed-source nonce rejected |
| New invalid nonce (each) | Original handler rejects unrecognized `Purple Dragon` subclass, leaves no intent reservation, and rolls back all canonical global row/stock deltas |
| Report | Sanitized JSON shows stable scenario IDs, seeds, RPC names, observed row counts and assertions; never serializes JWT, user UUID, real character UUID, sheet, SQL row content, private backstory or raw errors |

**Fail closed** on differences; do not loosen original regex/error checks or normalizing to hide regressions. New SHA must independently pass all existing GitHub checks; a prior green J153 does not certify the candidate. This fixture intentionally omits 16/31 original creation-adjacent trigger DDL entries and does not reproduce full production catalog/RLS/lock paths. No production/Browser acceptance is claimed.

## Design exclusions and next task

This minimal runner only compiles predetermined, **source catalog-validated** existing real cases. It does not guess an edition, generate missing grants, perform SQL source migration, provide an AI NPC, write to production, or invoke a paid model. Expand only after signed-in exact-head acceptance: the next bounded slice should add one original missing deferred trigger (e.g. Forge starting-spell validator) as an explicitly hash-pinned, authentic scenario with its own receipt and retained fixture gates. Preserve separate held #317 CP/CS global lock research and #321 RLS.

**Next gate:** inspect exact new CI jobs and artifact; if the live-auth job fails, diagnose the **actual** error, correct only fixture-interface/test assertions without editing original SQL bodies, and append factual results to `docs/HANDOFF_LOG.md` plus update `docs/ACTIVE_WORK.md`.

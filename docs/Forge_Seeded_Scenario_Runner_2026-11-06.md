# Forge seeded deterministic scenarios — first executable research slice

**Decision:** 2026-11-06. **Status:** **VERIFIED IN DISPOSABLE REAL LOCAL JWT/PG17 TESTS** at exact source SHA `c2a52ac1bac4a164b1ee6d50f95bde228509f33c` via [run 42300851501](https://github.com/bob8675309/DNDNEXT/actions/runs/42300851501) (both jobs SUCCESS); not production, RLS or browser acceptance. Work branch `research/forge-seeded-scenarios-20261106`, based on held draft PR #324 at `f1a2c564046ab93a0bfa0732e3acc2179da9c064` (itself stacked on unmerged creator/privacy PR #321). Current `main` checkpoint when prepared: `79a6340c08e743e71e1072e40e6ba7204f735a29`. No production SQL, model, deployment or feature changes.

## First independent acceptance receipt (2026-11-06)

**Source:** `c2a52ac1bac4a164b1ee6d50f95bde228509f33c`. [Authenticated GoTrue/PG17 workflow 42300851501](https://github.com/bob8675309/DNDNEXT/actions/runs/42300851501) **SUCCESS** in both original source PG17 and genuine local JWT jobs. The log confirms J00–J153 first and then:

- S001 `champion-xphb-v2`, seed 61021 — **PASS** signed-in source-qualified Fighter Champion, original class/subclass + grant/materialized item/currency persistence; same-ID replay inert; changed source denied `22023`; unknown fresh subclass atomically rolls back.
- S002 same reviewed source v2 contract with seed 61022 — **PASS** an independent deterministic valid creation with the same canonical invariants; different nonce/name and no extra rows after replay.
- S003 `champion-xphb-v3`, seed 61022 — **PASS** real signed original v3 to original v2 chain, identical replay, changed-source rejection and fresh invalid rollback.

Static validator, including two separate Node invocations for seed stability, passed in both jobs. Read-only [trigger audit 42300851428](https://github.com/bob8675309/DNDNEXT/actions/runs/42300851428), [handoff 42300851417](https://github.com/bob8675309/DNDNEXT/actions/runs/42300851417), [Class 42300851414](https://github.com/bob8675309/DNDNEXT/actions/runs/42300851414), and [automated docs 42300801139](https://github.com/bob8675309/DNDNEXT/actions/runs/42300801139) passed. Sanitized JSON report is included in short-retention `forge-jwt-diagnostics-42300851501` artifact; GitHub logs show all three case receipts. No independently verified production browser acceptance or full RLS/catalog parity.

**Follow-up after this receipt:** Because the new documentation evidence and narrow workflow docs-path trigger themselves change the HEAD, re-run exact-head CI and report that source SHA separately; do not borrow the earlier head's pass if a new executable regression occurs.

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

**Next gate:** Verify the CI for the updated documentation/trigger-path commit at its exact SHA. Then perform read-only source fingerprint introspection of the original deferred player starting-spells validator, and add one focused hash-gated authenticated scenario without modifying source handler SQL. Append the next factual HANDOFF_LOG receipt and update ACTIVE_WORK in the same reviewed patch.

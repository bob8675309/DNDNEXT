# Tactical combat follow-up — Oct 29, 2026

## Release baseline
Production `main` remains at `75c387e9276739f04b56d7fa96e4041931b3d9f4` (merged #301). No production database modifications, deployment, or encounter writes are part of this draft. Existing encounter tabs, rest dialog, server weapon RPC and spells stay untouched.

## Verified read-only evidence
- Live encounter log **New Tactical Encounter**, 2026-10-29 17:46 UTC: Varges Greataxe hit Macros for **11 damage**, target at **13 HP**. Thus successful weapon-hit path has an observed log; still require a fresh post-release admin/player acceptance test.
- Disposable encounter **newest1** verified prior: hostile team opportunity reaction triggered and resolved; Mind Sliver hit and applied 7 damage. Reactions do not auto-attack.
- Macros the Black (Warlock level 3) has class-sourced `eldritch-blast|XPHB`, CHA 20, and an `optional-feature:agonizing-blast|XPHB` grant with `choices.child.metadata.spellKey='eldritch-blast|XPHB'`. For him, an eligible beam is **1d10+5 Force**; cantrip costs Action and no slot. Official 2024 spell: https://www.dndbeyond.com/spells/2619161-eldritch-blast.

## What this draft contributes
1. A **non-deployable**, private, ungranted Eldritch Blast server **candidate**. Do not apply SQL. It requires a real authenticated-user context, checks participant controller/editor/admin and active turn under locks, verifies the assigned Warlock cantrip and specific Agonizing Blast selection, sizes beams at 1/5/11/17 (current one-class model), resolves each beam's own d20 roll, range/LOS/cover, advantage/disadvantage effects and Force mitigation, and records one action/log/command-request.
2. Pure deterministic ESM rules and tests for beam count, CHA and grant binding, plus a SQL source-contract validator.
3. This document and a focused Github Actions workflow; **no JavaScript UI calls this candidate** and no PostgREST or API grant is added.

## Release blockers — DO NOT SHIP THIS CANDIDATE YET
- **No authenticated transport/executable permission**. `private` is deliberately not exposed; EXECUTE revoked from PUBLIC, anon, authenticated and service_role. Do not grant service_role or spoof `auth.uid()`. Separate verified identity bridge, RLS ownership and security-definer privilege review required.
- **Not yet PostgreSQL integration tested**. Lexical/source-contract checks are not actual transaction/replay or concurrent-actor correctness tests. Build disposable PG16 fixture for level 3/5/11/17, per-beam miss/hit/critical, resistance, immunity, multiple targets, active-turn validation, revoked permission, duplicate request, target hiding, one action, item/condition effects, and simultaneous casters.
- Ensure 2024 ranged-in-melee edge cases, other invocations (Repelling Blast, Lance of Lethargy), multiclass total character level, targeting deadlocks, effect ordering, and duplicate request intent are complete. While not addressed, prevent release.
- Existing `encounter_can_control_participant_v1` unconditionally trusts `service_role`; code here does not use that shortcut for its own permission check.
- Never attach any UI button/whitelist for this SQL until full backend + signed-in tests pass.

## Separate acceptance work not silently marked passed
- **Rest UI**: Signed-in Short and Long Rest workflow and resource changes/locks require browser testing. Source contract `scripts/validate_player_rest_buttons.mjs` has passed historically, but not a real browser acceptance.
- **Player security**: Run two real user JWT sessions on a disposable encounter; editor controls own actor, unauthorized user rejects GM commands, revocation honored, no cross-player action, reaction control enforced. No fabricated auth context through service_role.
- **Combat**: Repeat a successful weapon hit and HP decrement in the newest production UI, not just historical combat log.
- **Persistent battlefield**: Next UI milestone is a shared encounter versioned store with one persistent `EncounterTurnBoard`, initiative dock, action palette and reaction drawer. Existing world-map and town-map components must remain isolated. Extract shared board first, move individual actions into it only behind parity gates, and avoid duplicate realtime subscriptions.
- **Vercel storage**: Keep draft branch batch commits infrequent; let 24-hour previews expire. No docs-only release.

## Replay-order correction

A source review found a duplicate cast would be rejected after the first cast spent the Action or the turn advanced. The candidate now returns the same user's and actor's stored request result **before** spent-Action and stale-turn checks. The unauthorized caller/actor check stays active. Full PG16 replay and two-session concurrency tests are required before any release.

## Disposable PG16 execution fixture and replay-intent hardening (draft)

The candidate now stores ordered `targetIds` in its result and validates `spellKey`, `assignmentId`, and the exact target array on every duplicate request path. A request ID cannot be reused with different targets or a different spell assignment. A disposable PostgreSQL 16 service CI job loads a minimal schema and deterministic mocks and tests: revoke grants, service-role rejection, level 3/5/11/17 beams, selected vs unselected invocation, action spending, hit/miss, Force immunity, out-of-range, hidden target, unauthorized controller, replay after turn change, and two separate PostgreSQL clients racing on the same request ID. **Synthetic `auth.uid()` and `auth.role()` settings are not verified user JWTs**. Real signed-in integration, multiclass, other invocations and production ACL review remain blockers.

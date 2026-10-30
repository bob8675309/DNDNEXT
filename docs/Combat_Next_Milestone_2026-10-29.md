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

## First PG16 red test: fail-closed authorization fix

The actual PostgreSQL fixture revealed an authorization flaw rather than a syntax error: with a null admin lookup, `NOT public.is_admin(uid)` is SQL UNKNOWN and an IF condition could skip denial. Fixed both controller and hidden-target checks to use `NOT COALESCE(public.is_admin(uid),false)`. The disposable fixture intentionally leaves the admin function null for nonadmins to prevent regression. Rerun the full executable and two-client replay tests; do not apply this SQL live.

## Shared invocation milestone — Warlock damaging cantrips (draft)

The 2024 Agonizing Blast rule is **not exclusive to Eldritch Blast**. A repeatable invocation selects one known damaging Warlock cantrip per grant, and a character may legitimately have separate grants for different cantrips. Source: [D&D Beyond 2024 Warlock](https://www.dndbeyond.com/classes/2190885-warlock).

This branch now extracts `private.encounter_warlock_agonizing_bonus_candidate_v1(character_id, spell_id)` from Eldritch Blast. It verifies the authoritative class-sourced spell assignment, XPHB Warlock damaging cantrip classification, Warlock level 2+, currently selected invocation grant and canonical Charisma. It returns typed provenance (`applies`, `damageModifier`, `spellKey`, `featureKey`) for future **attack-roll or saving-throw cantrip** adapters; no browser-submitted modifier is used. Repeatable invocation grants for **different cantrips** are honored; duplicate grants choosing the same cantrip do **not** double-stack. Tests cover Eldritch Blast plus Toll the Dead, non-Warlock Fire Bolt, non-damaging cantrip, level gating, revocation, non-stacking and SQL EXECUTE revocation.

**Scope:** This is one reusable modifier, NOT a finished generic casting/resolution framework. Toll the Dead would still need an independent authoritative saving-throw/damage adapter; the modifier must apply **per damage roll**, not automatically once per target or once per cast. Other invocations (Eldritch Spear, Repelling Blast, Lance of Lethargy) are separate verified feature hooks, not implemented by this patch. Candidates stay in `private` with EXECUTE revoked from API roles; no production schema/application change. Tests use synthetic auth and are not real signed JWTs. Do not deploy or merge without authorization and concurrency approval.

### Known-spell eligibility hardening

Live read-only inspection confirmed the canonical `character_spells.known` flag and Macros's Eldritch Blast is `known=true`. The shared invocation helper now additionally requires `COALESCE(known,false)`, failing closed when a formerly assigned spell is no longer known. The PG16 fixture includes a negative test for toggling `known=false` while leaving the invocation's choice intact, and verifies the benefit disappears until knowledge is restored. No production data was changed.

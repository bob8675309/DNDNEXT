# P2 — Transaction-Integrated Attack Spell Resolver Candidate (Research Only)

_2026-10-31. Owner-approved boundary: **no production migration, role grant, public entry-point edit or merge**. This is a held, private, ungranted function tested only in a disposable PostgreSQL 16 container. It is **not** real GoTrue/Auth acceptance._

## Source fidelity and scope

- Read-only `pg_get_functiondef(public.encounter_cast_spell_v11_pre_1v)` retrieved from live DnDWeb was compared with `sql/20260729_04_tactical_guiding_bolt.sql` on the research branch. The complete **16,658-character PL/pgSQL body from `declare` through `end;` matched exactly**, not merely similar comments or function signatures. That provides a concrete live body provenance for this candidate as of the cross-check. Recheck fingerprint before using later.
- The current public `encounter_cast_spell_v1` and `encounter_cast_spell_v11` remain **thin wrappers** invoking the existing spell-slot-turn guard, then their `*_pre_1v` implementation. Our candidate is **not** installed behind either wrapper; the existing live functions and their privileges remain unchanged.
- New `sql/candidates/20261031_fire_bolt_transaction_integrated_candidate.sql` introduces `private.encounter_cast_spell_v11_transaction_candidate_v1(uuid,uuid,uuid,integer,uuid)`, retaining the full original attack resolver rather than calling it from a separate authorization preflight.
- The original v11 dispatch and effect branches survive: Fire Bolt (120 ft, d10, fire), Poison Spray (30 ft, d12, poison), Shocking Grasp (5 ft, d8, opportunity suppression), Ray of Frost (60 ft, d8, speed effect), Chill Touch (5 ft, d10, anti-healing), Guiding Bolt (120 ft, d6 with a consumed spell slot and an attack advantage effect); otherwise dispatch to `encounter_cast_spell_v10`. No generalized spell recipes are executed.

## Intended transactional change

The candidate makes the caster, encounter and target **row locks** part of the same function as controller authorization, request-ledger replay and damage. It locks in this order:

1. Caster row `FOR UPDATE`, owned spell assignment `FOR SHARE`.
2. Encounter row `FOR UPDATE`.
3. Target row `FOR UPDATE`.
4. Authenticate caster-control and target visibility **inside the acquired row locks**, before inserting or returning a command ledger result.
5. Insert request ID `ON CONFLICT DO NOTHING`; if already present, validate `requested_by`, actor, encounter, cast type, target, assignment, source spell, source key and normalized slot level against the stored result. Missing or pending results and changed intent **fail closed**. Valid exact replay returns original result *without rerolling damage or re-spending the Action/slot*.
6. New commands continue through the **original existing turn/action/condition, slot, LOS/range/cover, attack/critical, mitigation/effect, combat log, version increment and request-result update** in one transaction.

The new **Fire Bolt-only** source grant validation requires `known=true`, `source_type='class'`, an XPHB canonical class progression, matching `source_key` and `source_label`, and membership of that class in `spells_catalog.classes`. It explicitly **does not** require `prepared=true` for cantrips: this is an important existing behavior. Other reviewed v11 spell families preserve their current grant policy until individually audited; **do not interpret this as a universal grant fix**.

## Why this is not production-safe yet

- **Coexisting lock orders:** existing installed v11 writes a request row **before** caster/encounter/target locks; this candidate locks first. If both old and new paths are concurrently reachable, the inversion may deadlock. The ungranted candidate intentionally avoids mixed deployment. A release candidate must unify entry-point routing/locking across all participating attacks and verify old/new version interoperability or perform a controlled cutover.
- **Legacy delegations:** unreviewed v11 keys still return through v10. A complete release audit must cover v1/v2/v10 through v13 and other specialist cast RPCs; changing one ungranted private implementation cannot secure all cast routes.
- **Authorization freshness:** `SECURITY DEFINER` bypasses ordinary table RLS. The candidate uses `auth.uid()`, `auth.role()` and the existing `encounter_can_control_participant_v1`. Its mock test role/GUC does **not** verify provider-issued tokens. Permission changes via other tables are not all locked, so revocation/concurrency needs a separate authenticated transactional audit.
- **Idempotency history:** cached requests without the necessary result fields, including pending results, fail closed instead of returning `{duplicate:true,pending:true}`. This changes historical retry behavior by design; review UX/retry expectations and rollback strategy.
- **Source completeness:** canonical source identity matching can reject unusual legitimate historical class grant labels. Before rollout, audit real saved assignment migrations/Forge grants, allow explicit canonical mappings where justified, and keep feat/species/subclass grants GM-assisted until independently implemented.
- **Rules completeness:** Fire Bolt creature-only targeting and class-based scaling follow current tactical/single-class model. Object ignition and hypothetical multiclass total-level scaling remain unsupported and must not be silently automated.
- **Security review:** matched request intent and controller identity mitigate the previously reproduced replay-result disclosure, but do **not** prove all result visibility/knowledge filtering or hostile cross-actor UUID collisions safe. Keep canary tests and fail-closed behavior.

## Disposable tests

`scripts/fixtures/fire_bolt_p2_disposable_pg16.sql` and earlier baseline tests first load historical v11 (intentionally characterizing its replay/grant weakness). `scripts/fixtures/fire_bolt_p2_transaction_candidate_pg16_checks.sql` then loads the private transactional candidate and grants it to `authenticated` **only inside the disposable fixture**, testing known but unprepared class Fire Bolt, exact replay, another controller's replay, changed target/assignment/slot, hidden target, revoked controller, malformed class grants, Poison Spray regression and Guiding Bolt slot consumption/replay. It asserts no extra combat log, encounter-version or slot spend.

`scripts/fixtures/fire_bolt_p2_transaction_candidate_race.sh` runs two independent PostgreSQL sessions against the isolated `fire_bolt_p2` database, verifying identical-request exactly-once and competing-request one-Action serialization. These are **mock identity**, not signed-in acceptance. Evidence is only complete after checking the **exact current** GitHub SHA and successful job logs.

## Real Auth test prerequisite

As of inspection, the accessible Supabase project list contains **only DnDWeb**, the active production project `ucggczovhmauhshvhusx`. No separately verified, disposable Supabase Auth/PostgREST environment was available. **No casts, test users, grants, migrations or experimental RPC installations were made there.** A genuine signed-in acceptance test requires isolated GoTrue-issued JWTs (two non-anonymous accounts, `getUser()` and `getClaims()` verification), PostgREST-exposed **staging-only reviewed entry point**, real encounter fixture data, revocation and invisible-target tests, concurrent requests, RLS/visibility and command-ledger accounting. An HS256 test token created locally is not a Supabase Auth-issued session. The existing staging-only `scripts/test_eldritch_blast_real_auth.mjs` is a reference design, **not evidence that this candidate passed real Auth**.

## One next task

Audit **mixed-path lock ordering and full public spell RPC delegation** against the deployed v1–v13 contracts, then prepare a carefully scoped release candidate and genuine two-user nonproduction Auth acceptance plan. Reconcile legitimate historical grant identities and pending/retry semantics. Require explicit owner approval before deploying any SQL, grants, paid environment or merge.

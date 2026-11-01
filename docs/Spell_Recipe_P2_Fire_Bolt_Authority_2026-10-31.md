# P2 Fire Bolt — Progression, Grants, and Auth Acceptance Gate (Research Only)

_Reviewed 2026-10-31 against live DnDWeb metadata/functions by read-only SQL, current draft PR #312, and 2024 D&D Beyond Basic Rules. Recheck current head and CI before relying on this document._

## Actual progression authority (vs future multiclass design)

- `public.character_progression` has **PRIMARY KEY (`character_id`)**, a required `class_id` and integer `class_level` constrained to 1–20. One record represents one class for a character. This is a single-class progression schema; no separate per-class rows or aggregate multiclass level currently exist here.
- The authoritative `public.encounter_spellcasting_profile_v1` loads `character_progression.class_level`, `class_catalog` spellcasting properties, a matching `class_level_progression` row and returns `classLevel`. It does **not** return `characterLevel` or `totalCharacterLevel`.
- `public.character_sheets.sheet` contains presentation-level level fields. They are not an authorized replacement for canonical progression. The spellcasting profile must not be changed to trust unverified JSON fields.
- At review, the nine live progression records have class levels 1–6. This aggregated observation is **not proof that multiclass support is impossible elsewhere**, but the current database progression authority supports one class per character.
- The Fire Bolt branch in live `public.encounter_cast_spell_v11_pre_1v` uses `v_profile->>'classLevel'` for 1/5/11/17 damage tiers. In this single-class model this agrees with total level; it is a **latent multiclass parity defect**, not a reproduced bug in a stored multiclass character. Official 2024 rules base cantrip increases on total character level, unless the spell specifies otherwise. <https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character>

**Do not patch Fire Bolt scaling alone.** Future multiclass support requires a canonical `totalCharacterLevel` derived server-side from normalized per-class progression, source-qualified class feature levels, and source-dependent casting/slot pools. Until that authority exists, retaining the current single-class resolution is safer than using editable sheet level. Cantrip class availability must be checked separately from damage level.

## Spell assignment source and live Fire Bolt eligibility

The unique spell grant identity is `(character_id, spell_id, source_type, source_key)`; `source_label` denotes readable/provenance metadata, `known` denotes current knowledge/access, `prepared` and `always_available` describe casting availability. This allows class, feat and subclass grants of the same canonical spell to coexist. See `sql/20260808_08_character_spell_source_identity.sql`, `docs/Character_Progression_and_Higher_Level_Forge.md`.

The observed Fire Bolt server chain is UI `encounter_cast_spell_v1` → canonical `encounter_cast_spell_v11` → `encounter_cast_spell_v11_pre_1v`. The live implementation checks that assignment belongs to the caster character, `source_type='class'`, spell source XPHB and cantrip level, controlled participant/turn, range/LOS/cover, action availability, hostile adjacent creatures/conditions, server-owned rolls and resource/action/log transaction.

**Important absence in the reviewed Fire Bolt branch:** it does **not explicitly** assert `character_spells.known=true`, `source_key`/class identity, `source_label` equals canonical class, or `spells_catalog.classes` contains the class. The Guiding Bolt branch checks `source_label='cleric'`, but Fire Bolt's cantrip branch does not. A deliberately inconsistent stored class grant may therefore be accepted by this resolver. This is a **defense-in-depth / malformed-data validation gap**, not proof that an ordinary player can manufacture that grant: live `character_spells` has admin-write RLS and a `guard_direct_character_authority_mutation_v1` trigger; `character_progression` is RPC-only, not client writable. Audit the trusted ingestion and privileged editor routes before alleging player-accessible forgery.

## Request replay / visibility finding — release blocker

The current `v11_pre_1v` inserts `encounter_command_requests`, then on existing `request_id` returns the prior result if the **request's participant matches the requested caster**. The `encounter_can_control_participant_v1` test, active-turn checks, target visibility check, source access and action spend checks occur **after** that return. The wrapper `private.encounter_enforce_spell_slot_cast_turn_v1` returns early for cantrips and does not close this gap.

Consequently, the code order can return the previous cast result to a different authenticated controller that knows the request identifier and caster/assignment. A changed target intent with the same request ID can also hit that early replay path. This is a **potential result-disclosure and semantic-idempotency bug**; it does not by itself imply a second damage transaction. Read-only inspection also found `encounter_combat_log` has authenticated SELECT with encounter and hidden-participant filtering, and cast log `detail` includes `requestId`. Do not treat IDs as a permission boundary or rely on unpredictability alone.

**Required future fix (candidate only after review):** verify caller control, source entitlement, canonical request intent/target identity and visibility **before** returning cached output. Preserve lock ordering, atomic duplicate resolution, and no duplicate damage/log/action/slot. Include foreign controller, changed target same UUID, hidden target and revoked editor regression cases. Do not hot-edit production functions until the owner approves a reviewed patch and dedicated tests.

## Disposable PG16 SQL integration (not signed JWT)

Files:

- `scripts/fixtures/fire_bolt_p2_disposable_pg16.sql`: creates a completely separate disposable database schema and loads **the original full `public.encounter_cast_spell_v11` source** from `sql/20260729_04_tactical_guiding_bolt.sql`; uses constrained stubs for Auth identity, canonical spellcasting profile, attack RNG, geometry and damage.
- `scripts/fixtures/fire_bolt_p2_disposable_pg16_checks.sql`: runs mock `authenticated` and `anon` role checks, fresh wrong-controller rejection, authorized cast and idempotent replay, feat grant fail-closed, deliberately invalid class-grant acceptance probe, and logged action/version effects.
- Existing free `validate-eldritch-blast-candidate.yml` workflow creates a separate PostgreSQL 16 database for these tests, leaving the Eldritch Blast research fixture database independent.

These tests **do not** use Supabase Auth, verify cryptographic JWT signatures, run deployed `...v11_pre_1v` wrapper from PostgREST, fully simulate combat effects, or establish legitimate multiclass representation. Test failures are not automatically bugs in production; investigate helper fidelity. A known-gap probe is a characterization, **not a security acceptance pass**.

## True signed-in acceptance requirement — NOT performed

Require a completely disposable **non-production** Supabase environment with GoTrue Auth, PostgREST, two distinct actual non-anonymous users and separate participant permissions. Use normal publishable credentials and `signInWithPassword`; verify each user's identity using `getUser()` and `getClaims()`, pass the provider-issued JWT via the ordinary Supabase client, then test:

1. Rejected anonymous / other-user fresh cast with zero mutation; positive owner Fire Bolt with action and ledger exactly once.
2. Rejected other-user replay, changed-intent same-ID replay, hidden-target reads and revoked editor replay (do not log or expose sensitive responses).
3. Class-grant source membership and `known`/prepared/access gates; feat/subclass grants remain explicitly GM-assisted until supported, never silently treated as class grants.
4. Actual real-DB geometry, cover/LOS, near-hostile / condition fail-closed, spell cantrip no-slot, damage/mitigation/critical and total-level 5/11/17 cases **only when multiclass authority exists**.
5. Concurrent duplicate and competing commands, signed-in request IDs, RLS visible logs versus restricted command ledger, rollback on errors and consistent persistent state.
6. Candidate approval, exact-SHA CI, browser acceptance and explicit owner permission before production migrations/grants/merge.

**Do not** mint a test JWT and label it a Supabase Auth session; PostgreSQL `set role` plus `request.jwt.claims` is a mock, not signature verification. No paid staging, live Auth accounts, prod test encounter or public exposed helper were created during this checkpoint.

## Held private replay and grant guard — research candidate (2026-10-31)

A narrowly scoped, **ungranted** candidate exists in `sql/candidates/20261031_fire_bolt_guarded_replay_candidate.sql` as `private.encounter_fire_bolt_guarded_candidate_v1`. It calls the original `public.encounter_cast_spell_v11` after independent, fail-closed checks; it changes **no** production RPC or migration. Only a disposable PostgreSQL test grants `authenticated` the right to execute this private function.

New negative regression probes in `scripts/fixtures/fire_bolt_p2_guarded_candidate_pg16_checks.sql` include:

- Previously valid caster and source-qualified, `known=true` unprepared cantrip: preserve successful cast and exact owner replay, without extra action/roll/log.
- Foreign authenticated controller: reject replay and fresh casts; no disclosure of the cached result.
- Same request ID with different target or different assignment: reject, rather than returning an unrelated cached cast.
- Stored class grant with `known=false`, inconsistent source key or label, or a feat-owned grant: fail closed. Canonical XPHB class and `spells_catalog.classes` membership are required.
- Target now hidden from caller, caller no longer controls caster, or ledger row is pending/unbound: fail closed before returning any cached result.
- Original resolver, unchanged, owns attack rolls, cover, damage, action spending and command-log atomics. The negative probes must not add any combat logs or encounter version changes.

**Critical limitation:** A wrapper cannot remove the existing public `v1` and `v11` entry points, or guarantee permission/target visibility remains stable between its preflight and the original transaction. Read-only live grants show `authenticated` has EXECUTE on public `encounter_cast_spell_v1` and `v11`, but **not** on the `_pre_1v` internals (service role only). It **does not fix production security**. A release candidate must put these checks into the actual server-authoritative transaction, preserve all existing spell-family delegates, lock order and exactly-once idempotency, and cover other affected RPC families. Neither mocked `SET ROLE` nor a locally forged JWT equals actual Supabase-issued signed-in proof.

The prior public Fire Bolt RPC's replay and grant-acceptance behavior is separately characterized in a disposable PG test, but **known-failing historical behavior is not acceptable security evidence**. The candidate passes only when its own fail-closed regression cases pass at the exact GitHub head SHA.

**Verified CI checkpoint:** Research SHA `aab57a091fbef1c1f25fa9ffdecb3c37b16d90de` passed both [Eldritch Blast candidate rules/PG integration](https://github.com/bob8675309/DNDNEXT/actions/runs/41265072980) and [class browser polish](https://github.com/bob8675309/DNDNEXT/actions/runs/41265072982), including this held Fire Bolt candidate's disposable test suite. The original v11 historical authorization/invalid-grant results remain intentionally documented as pre-hardening behavior; **a green characterization check is not a security certification**. Reverify after later documentation commits.

## Single next engineering task

**NEXT: design a transaction-integrated, held resolver hardening patch (not a wrapper), preserve cross-spell behavior and lock ordering, and create two real-auth user tests in a completely separate non-production environment.** Verify exact-head GitHub CI, RLS, revocation, hidden targets, same-ID changed intent, legacy-function direct access and concurrent requests before requesting owner approval for any production change.

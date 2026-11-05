# P1.3 — Deployed Opportunity Attack and v13→v12 Delegated Spell Replay

**Research-only result:** Six additional isolated PostgreSQL 16 cases **PASS** (30–35) using exact deployed combat function bodies with mocked dependencies. [GitHub run 41564947213](https://github.com/bob8675309/DNDNEXT/actions/runs/41564947213), job [125684105834](https://github.com/bob8675309/DNDNEXT/actions/runs/41564947213/job/125684105834), commit beba0cbebca0b0787d90185a5f96b8abd1e4b9ce. **All seven checks passed**. No live DnDWeb write, grant, migration or gameplay changes occurred. These are source-fidelity *functional/lock/replay* tests, **not** real user authorization or full combat-mechanics tests.

## Deployed source snapshots and mock boundaries

| Deployed function | pg_get_functiondef MD5 | Fixture use |
| --- | --- | --- |
| `public.encounter_opportunity_attack_internal_v1` | `276e5fd1c210b3e6f532b0819b87a62b` | Exact Reaction Attack branch |
| `private.encounter_has_timed_effect_v1` | `017c626c4147737161742daedceaa694` | Exact attack suppression check |
| `public.encounter_resolve_opportunity_reaction_v1` | `70cbfda404644c1000a6541ce8bf9c30` | Exact window locking, resolved return, attack/pass |
| `public.encounter_cast_spell_v13` | `03ea7bd00bcd9734ef70ebc035c54a8d` | Exact v13 delegation to v12 when not Healing Word |
| `public.encounter_cast_spell_v12` | `2e8bef22f86dca97100e7299d746cef7` | Exact Bard Vicious Mockery branch |
| `private.encounter_apply_target_turn_end_effect_v1` | `29a1ded6e5159d38f46613a25f7c6f3d` | Exact timed-effect upsert |
| `public.encounter_move_active_participant_v1` | `1f7fc81b307800f70ab412872473aa14` | Exact movement-created opportunity window |
| `public.encounter_end_turn_v1` | `2785f688af8e200f64f18b6c421f19a6` | Exact turn advance / Action lock |

Source files: [OA source](../scripts/fixtures/p1_3_opportunity_attack_live_source_pg16.sql), [OA setup](../scripts/fixtures/p1_3_opportunity_attack_setup_pg16.sql), [OA concurrency script](../scripts/fixtures/p1_3_opportunity_attack_race_pg16.sh), [v12 and target-end source](../scripts/fixtures/p1_3_spell_v13_to_v12_source_pg16.sql), [delegated spell setup](../scripts/fixtures/p1_3_spell_v13_to_v12_setup_pg16.sql), [delegated script](../scripts/fixtures/p1_3_spell_v13_to_v12_race_pg16.sh), [PG16 CI workflow](../.github/workflows/validate-p1-3-real-admin-paths.yml).

**Faithfulness:** PostgreSQL row locks, original named public/privileged function bodies, command ledger inserts, opportunity reaction windows, Action/Reaction consumption and timed-effect upsert run as deployed-source definitions. Synthetic character/encounter rows and mock Admin identity replace real GoTrue credentials. Weapon profile, reach, line of sight, deterministic attack roll/damage and Bard saving-throw/profile/ability helpers are mocked. The delegated spell uses intentionally forced failed target save; it does **not** prove all genuine saving-throw, class or damage mechanics. Original private reaction attack function uses a mocked weapon/damage helper when a fixture weapon UUID is supplied, so the unarmed and genuine inventory-ownership branches remain untested.

## Opportunity reaction cases

**30 — valid Move → Reaction Attack → End Turn (PASS).** Exact movement triggers a pending window. Exact `encounter_resolve_opportunity_reaction_v1` calls the original opportunity-attack internals, deals one deterministic point of damage, consumes the reactor's Reaction and logs a single attack. The test **checks the spent Reaction before ending the turn**; then End Turn makes the reactor the next participant and legitimately **refreshes** their Reaction. One completed move/reaction/end request each, no duplicate damage.

**31 — concurrent Reaction Attack versus End Turn (PASS).** A scheduled session holds the window W and relevant reactor/mover participant P rows, then invokes the deployed Attack reaction; a concurrent End Turn waits on mover P. Attack commits, then End Turn succeeds; final window is resolved once, deterministic damage once and next-turn Reaction refreshed. This is scoped W/P/E **serialization**, **not** proof of universal deadlock avoidance across all reaction/attack callers.

**32 — resolved-window replay with changed choice, request and mock identity (PASS, source-level gap).** After one Attack reaction resolves the window, another connection uses mock `auth.uid` 998, chooses **pass** instead of attack and supplies a **new request UUID**. The deployed `encounter_resolve_opportunity_reaction_v1` returns the prior **Attack** result from the resolved window **before current control authorization**. No additional ledger request or combat mutation occurs. This demonstrates an unbound cached-result/intent exposure path within the deployed function source, **not** that a real unauthorized signed-in player can call and observe it. Exposure, grants and JWT behavior must be tested separately.

The initial [OA run 41564342429](https://github.com/bob8675309/DNDNEXT/actions/runs/41564342429) failed one overly strict fixture assertion that assumed a reactor's Reaction would remain spent **after their new turn began**. The source correctly refreshed it. After checking consumed Reaction before End Turn and refreshed Reaction afterward, [run 41564589628](https://github.com/bob8675309/DNDNEXT/actions/runs/41564589628) and the final [run 41564947213](https://github.com/bob8675309/DNDNEXT/actions/runs/41564947213) passed cases 30–32. **The earlier fixture failure was not a production bug.**

## Legacy/delegated spell cases

**33 — v13 delegates to v12 Vicious Mockery (PASS).** A valid XPHB Bard class assignment invoking `encounter_cast_spell_v13` is delegated to the exact `v12` Vicious Mockery branch. It spends one Action, applies psychic damage and a target-turn-end disadvantage effect, records one `spell_cast` log and charges **no spell slot**. Save bonus and damage calculations are mocked, so this verifies source routing/side effects/lock structure, not complete spell rules.

**34 — cached cast request with a different target and slot argument (PASS, typed-intent gap).** Reusing the original `request_id` through v13→v12, but targeting another participant and changing the cantrip slot argument from `NULL` to `0`, returns the **previous target's result**. The different target takes no damage, no second log is written and one completed ledger row remains. The v12 duplicate branch checks the command type and original **caster participant**, but not original target, exact slot input, assignment and original requester. This is a source-verified typed-intent mismatch under mocked Admin identity, not a real cross-user data-leak or unauthorized casting proof.

**35 — delegated cast versus End Turn (PASS).** Controlled simultaneous calls take the same caster P. The exact v13→v12 Vicious Mockery action commits first with a single effect/damage/log, then the exact End Turn advances. No duplicated Action, turn advancement, or ledger row was observed in this schedule.

## Read-only routing map: still untested descendants

The live source graph confirms v13 handles Healing Word or delegates to v12; v12 handles Vicious Mockery or delegates to v11; the v11 public wrapper invokes `private.encounter_enforce_spell_slot_cast_turn_v1` and then `encounter_cast_spell_v11_pre_1v`; this legacy processor can delegate further to v10; v10 handles Mind Sliver or delegates to v9; v9 may route Chill Touch back into the v11 processor or continue to v8. MD5 snapshots for read-only routing review: v11 `73b12d083ef540d308932f2b89a11d88`; v11_pre `c810a3015c7e17dc594a39d8aa7306f3`; v10 `00d51eafc5eac574f979b88b277c6bb6`; v9 `82f14736b1761ff3a2f9316157d84a4a`. **Those delegated descendants and their real status/slot/target dependencies were not executed in cases 33–35.** In particular, do not assume the original v11 turn guard, older v8/v9 or direct `_pre_1v` functions have shared replay/permission behavior.

## What remains before P1.3 and P1.5 acceptance

- Source-derived disposable concurrency through **v11 wrapper, v11_pre, v10, v9/v8**, including a slotted Guiding Bolt path and normal/GM-assisted fallback. Confirm direct `_pre_1v` grants and any reachable legacy-only bypass; do not silently make a broad spell substitution.
- Real GoTrue signed-in PC, shared delegated-NPC and GM accounts to verify permission revocation, replay ownership and hidden-result privacy. Mock identities do **not** constitute real-user acceptance tests.
- A unified immutable typed-intent/authorization contract covering ledger replays, the **separate resolved reaction-window cache**, original actor/requester/choice/target/slot inputs, and legacy rows with missing provenance.
- Globally proven E/P/W/L/X/S/C/grant row locking with actual triggers, direct resource writers, multi-target participant order, rollback/timeout behavior, and the already approved **TC1 Option A** one-active-encounter-per-character policy including paused Resume. Preserve the known historical active overlap for GM review.
- **No production SQL, grants, live combat modifications, maps or AI changes** were made. PR #317 remains a draft and **P1.3/P1.5 remain open**. No owner manual testing required for this disposable research.

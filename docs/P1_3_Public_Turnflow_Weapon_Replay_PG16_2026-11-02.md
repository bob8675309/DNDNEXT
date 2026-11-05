# P1.3 — Public Movement, Turn, Reaction, Weapon and Replay Integration

**Status: 8/8 additional tests PASSED in disposable PostgreSQL 16, not production.** GitHub [run 41563202836](https://github.com/bob8675309/DNDNEXT/actions/runs/41563202836) job [125678417863](https://github.com/bob8675309/DNDNEXT/actions/runs/41563202836/job/125678417863) on source commit `e508649689e7b4a2f2c41823ceb0dbf86974d973`. All seven GitHub checks passed. These checks run against original function bodies in synthetic supporting tables; no DnDWeb production data or live combat RPC was changed.

## Verified original public function snapshots

| Function | Live MD5 of pg_get_functiondef | Executed test scope |
| --- | --- | --- |
| `encounter_move_active_participant_v1` | `1f7fc81b307800f70ab412872473aa14` | Valid movement and OA window creation |
| `encounter_end_turn_v1` | `2785f688af8e200f64f18b6c421f19a6` | Turn advancement, pending-window gate, cross-actor replay |
| `encounter_use_core_action_v1` | `74a43a001247f5fa491b057c97ca4014` | Dodge competing with turn/weapon actions |
| `encounter_resolve_opportunity_reaction_v1` | `70cbfda404644c1000a6541ce8bf9c30` | Reaction Pass only; not the weapon attack reaction branch |
| `encounter_are_hostile_internal_v1` | `4c0b1321182f6a86425bdd03e1634102` | Original hostility predicate for OA window |
| `encounter_weapon_attack_v1` | `14433e4e379ae811edd9d9d8345711f8` | Exact public attack command with deterministic helper stubs |

[Turn-flow setup](../scripts/fixtures/p1_3_turnflow_setup_pg16.sql), [exact function snapshots](../scripts/fixtures/p1_3_turnflow_public_source_pg16.sql), [turn-flow test](../scripts/fixtures/p1_3_turnflow_race_pg16.sh), [weapon setup](../scripts/fixtures/p1_3_weapon_attack_setup_pg16.sql), [weapon source](../scripts/fixtures/p1_3_weapon_attack_live_source_pg16.sql), [weapon test](../scripts/fixtures/p1_3_weapon_attack_race_pg16.sh), [GitHub CI](../.github/workflows/validate-p1-3-real-admin-paths.yml).

The tests use independent PostgreSQL 16 sessions and real transactional locks. The supporting map, character, permission, slot and combat data are synthetic. Mock functions supply line of sight, melee reach, weapon profile, deterministic attack roll and damage calculation; the weapon test therefore **does not validate actual D&D combat formulas, targeting, equipment ownership or damage resistance**. Authentication is a mock Admin identity, not real signed-in tokens. Tests are source-fidelity **for the listed public command bodies**, not for every nested helper.

## Case-by-case results

**22 — Move then End Turn (PASS).** Exact public Move accepts an adjacent unoccupied hex and advances position by one hex, costing five feet; exact End Turn moves turn control to the next actor. Both command requests have finalized results. No OA window is created for same-team neighbors.

**23 — concurrent Dodge versus End Turn (PASS).** Two sessions contend for the same acting participant P. A controlled prelock lets the original Core Action Dodge commit first; the exact End Turn waits, then commits. There is one core-action log, a single turn advancement and no duplicate ledger entries.

**24 — real Move creates OA window, blocks End Turn, then Reaction Pass allows it (PASS).** The exact Move command detects a hostile reactor and creates a pending opportunity window. Mover remains at its old hex. The original End Turn refuses with the pending-reaction message, and its failed command-ledger insert rolls back. Original Reaction Pass resolves the window and allows a subsequent End Turn. Reach and LOS helper values were mocked; the window and command transitions were genuine source.

**25 — concurrent Reaction Pass versus End Turn (PASS).** A test session holds the exact window W, reactor P and mover P, then calls the original Reaction Pass; End Turn simultaneously waits for the same mover P. After the reaction commits, End Turn sees no pending window and advances correctly. This is a scoped **W→P / P→E serialization success**; it does not prove every W/E/P permutation is deadlock-safe.

**26 — wrong-actor End Turn request replay (PASS, source-level integrity finding).** After End Turn for actor A creates a completed ledger result, a subsequent call to the original **encounter_end_turn_v1** using a **different participant in another encounter** but the **same request ID** returns A's cached result. The ledger remains owned by A and no second turn is performed. The function's duplicate-request branch checks only `command_type = 'end_turn'`, **not participant, encounter, requested_by, exact intent or authorization freshness**. This demonstrates a real function-source replay identity weakness under mock Admin authentication. It is **not a proven external user exploit**; real GoTrue/RLS/role access and visibility still require signed-in acceptance tests. Do not ship a guard that checks only participant and ignores original request intent.

**27 — Weapon Attack then End Turn (PASS).** The exact public Weapon Attack locks acting and target participants, applies one deterministic point of mocked damage, consumes an Action and writes one weapon-attack log. End Turn advances to the next actor. Two ledger rows carry results.

**28 — concurrent Weapon Attack versus End Turn (PASS).** A controlled attacker P prelock puts the original attack first. End Turn waits, then commits. Target damage applies exactly once; encounter advances and the command ledger is consistent. This covers one P-attacker→P-target→E versus P-attacker→E ordering, **not all target-order inversions**.

**29 — Weapon Attack versus Dodge race (PASS).** Original Weapon Attack takes the acting participant P first and spends the Action. Concurrent public Dodge waits on P, then rejects with the existing `Action already spent` exception. The rejected Dodge's command ledger insert rolls back; only one weapon-attack log and one damage application remain.

The negative-control failures intentionally asserted in the suite—pending End Turn and second competing Action—are **expected outcomes**, not failed CI tests.

## Source-derived transaction implications

- Movement, Core Action and End Turn insert command ledger L, then lock actor P and encounter E. Weapon Attack inserts L, then locks attacker P, target P, and E. Reaction Pass takes reaction window W **before** reactor P, mover P, E, and only then inserts L. These are **nonuniform class orders** and require a common global protocol; scoped passing schedules do not prove the absence of cycles.
- Original End Turn's replay branch returns a cached result before locking a participant or performing a current authorization check, and only verifies the command type. This requires the original typed-intent and current-controller contract from P1.2, including cross-actor, cross-encounter, cross-requester, changed-argument and legacy-row tests.
- The weapon test uses a deterministic damage stub, not original damage/resistance or weapon-profile logic; the Reaction Pass branch avoids attack resolution entirely. Do not conflate these fixtures with full PvP combat, opportunity-attack damage or hidden-target authorization acceptance.

## Remaining gates

1. Extend exact-source two-session tests to **opportunity reaction attack choice**, multi-target affected participant ordering, genuine weapon/profile and damage dependencies, and slotted/legacy spell wrappers v10–v13.
2. Test true signed-in GM, PC and shared delegated NPC grants, revocation of can_edit/controller authority, replay visibility, and JWT role handling with **actual** original combat RPCs; synthetic auth alone is not sufficient.
3. Design a globally consistent E/P/L/W/X/S/C/permission lock order, typed replay, TC1 Option A single-active-character admission including paused Resume, deterministic legacy behavior, and a reversible migration/rollback plan; require explicit owner approval before any production write.
4. Preserve the existing production same-character active encounter overlap for GM decision—no automatic deletion or reconciliation.

**P1.3 and P1.5 remain OPEN.** PR #317 is still an isolated **draft research PR**. No runtime or production SQL changes, grants, migrations, maps or AI work were carried out.

# P1.3 — Global Tactical Transaction Lock-Order Research

> **IN RESEARCH — NOT PROVEN OR APPROVED FOR DEPLOYMENT.** 2026-11-01. Source reference: merged `main` `51c351a142d03378dff8e47e05182afe21a15622`, DnDWeb SQL definitions and trigger metadata read using SELECT only. Earlier held PR #312 contains independent disposable PostgreSQL research, **not** a live patch. The owner approved proceeding with P1.3 *design*, not a live migration or permission change.

## Aim and boundaries

Establish a **single compatible transaction/lock discipline across all public command entry points and side effects**, not only the experimental private core-action/Fire Bolt executor. Retain the approved P1.2 immutable typed requester+intent contract, server-side action/slot authority, 2024 XPHB-first spell identity, GM-assisted unsupported effects, independent NPC combat-control permissions and world/town-map protection. No AI or world-map changes. All 22 spell-cast RPC names (14 direct ledger writers + eight wrappers), eight non-spell ledger writers, Admin staging, spell slot/character-rest resources, and triggers must ultimately be covered.

## Source lock vocabulary

| Class | Row/lock domain | Precision caution |
| --- | --- | --- |
| L | `encounter_command_requests` UUID unique index/row | Even `INSERT ... ON CONFLICT` can block on another transaction |
| E | `encounters` row | One encounter may interact with resources shared with other encounters |
| P | `encounter_participants` row | Actor, target, reactor and mover are often **different P UUIDs** |
| W | `encounter_reaction_windows` row | May already be resolved, with a stored response |
| X | `encounter_conditions` / `encounter_timed_effects` | Expiry can update a different participant |
| S | `encounter_spell_slots` snapshot row | AFTER UPDATE spend trigger runs |
| C | Persistent `character_spell_slots` pool | May be shared by two simultaneous active encounters |

**Evidence classification:** [machine-readable graph](../scripts/fixtures/p1_3_lock_order_graph.json) records either `first-lock` (direct first ordering), `schematic` (selected trigger/helper expansion), or `partial`. Its [CI checker](../scripts/validate_p1_3_lock_graph.mjs) detects **source-class inversions only**; this is not a Postgres concurrency test.

**Disposable two-session expansion: PASS (model only).** [TC1 Option A PG16 isolated concurrency model](P1_3_Option_A_Concurrency_Model_2026-11-01.md) passed eight cases in [run 41385726293](https://github.com/bob8675309/DNDNEXT/actions/runs/41385726293). A synthetic reversed L/E path produced an actual PostgreSQL deadlock; consistent E/L order did not. No live combat RPC was run and P1.3 is still unproven.


## Deployed ordering observed in function definitions

| Command family | Observed ordering and caveat |
| --- | --- |
| Core action, movement | **L → actor P → E**; duplicate result may be returned before reauthorization. Movement may create W |
| End turn | **L → actor P → E → X**; E active-participant UPDATE invokes expiry trigger that can update another P |
| Weapon/unarmed attack | **L → attacker P → target P → E**; the two P rows must be treated by exact UUID, not as one node |
| Opportunity reaction | **W → reactor P → mover P → E → L**; a resolved W can return its cached result before control |
| Save | Control check precedes L; no explicit row FOR UPDATE in the own function body |
| Admin effect | Admin check → L → target P through effect helper → E version UPDATE |
| Admin start | **E → participant P**, then setup/activation slot work can touch S and canonical resources |
| Legacy slotted spell wrapper v11 | **E (slot-turn guard) → L → caster P** in delegated implementation |
| Allocated spells and v13 Healing Word branch | **L → caster P → E → targets P**, then S update → C bridge. Some branch order remains schematic. Other v13 spells delegate to v12 |
| Turn-start timed-effect trigger | **E already held → X → possible other P**, including Speed updates |
| Spell-slot spend trigger | **S → C** through persistent pool sync and decrement |

*Date-bounded live fingerprints:* core action `74a43a001247f5fa491b057c97ca4014`; movement `1f7fc81b307800f70ab412872473aa14`; end turn `2785f688af8e200f64f18b6c421f19a6`; reaction `70cbfda404644c1000a6541ce8bf9c30`; v11 wrapper `73b12d083ef540d308932f2b89a11d88`; trigger expiry `e8e898f3a427897863f31c64b2e1a4ea`; slot bridge `b30565d75b05b042c1ad8f9803284486`. These are source evidence, not runtime acceptance.

## Candidate wait-cycle inversions — NOT observed deadlocks

1. **L ↔ E:** ledger-first core action versus the E-first slotted v11 wrapper. Mixed requests can encounter opposing acquisition order; demonstrate actual same-resource overlap before calling a deadlock proven.
2. **P ↔ E:** actor-first commands versus Admin encounter activation. Staging/active status restrictions may prevent a real overlap; fixture needs valid interleavings.
3. **P ↔ E through trigger:** attack target P before E versus turn-start expiry E before another P. **Exact target UUID equality** must be arranged in a disposable test; P-class equality alone is not proof.
4. **L ↔ E in reaction:** reaction handler takes E before ledger while other commands take L before E, but windows and active-turn checks limit reachable schedules.

The graph test checks contradictory **class-level** order. It deliberately cannot infer row UUIDs, PostgreSQL implicit FK locks, index waits, transaction aborts or caller entitlement.

## Proposed design direction — not an adopted lock algorithm

Read encounter/window/participant routing information without row locks for discovery only; validate it **again under transaction locks**. Candidate encounter-first E serializes ordinary encounter mutations; pre-acquire all affected P rows in sorted UUID order to prevent actor/target reversal; define a **single explicit global order** for W, L, X, S and C and for foreign-key and permission-row locks. Do not select that final order until every trigger and legacy wrapper is traced.

Hard blockers: expiry trigger E→X→P may access unanticipated P; spell S→C bridge and direct character rest/slot writers may acquire resources in a different order; wrapper v11 E-first preflight conflicts with L-first processors; unique-request insertion can wait before ordinary row locks. Grant revocation must be serialized with control checks. **Owner policy TC1 (Option A, 2026-11-01): prevent a canonical character from participating in two active encounters simultaneously.** The [permanent decision](TACTICAL_ENCOUNTER_OWNER_DECISIONS.md) is approved; the database currently has one such overlap, which must be GM-reviewed, not automatically changed. A per-character reservation/serialization gate may be needed for concurrent activation and must fit the still-unproven E/P/L/S/C global lock order. Handling paused states remains an implementation detail requiring review.

**Never ship an isolated private core-action fix alongside live old-version paths** or silently revoke old grants. All public spell wrappers, Admin setup, effect/reaction/turn helpers and character resource writers must be coordinated.

## Proof gates before P1.3 can be checked complete

| Gate | Required evidence | Status |
| --- | --- | --- |
| 1. Full lock graph | All 22 cast entry names, eight other ledger writers, non-ledger Admin/character/slot/trigger/permission side effects with exact row-UUID overlap | **Partial** |
| 2. Global acyclic order | Coherent lock/transaction protocol including unique-index, FK, effect-trigger and revocation locks | **Unproven** |
| 3. Disposable concurrency | Actual two-session PostgreSQL 16/17 races: L↔E, P↔E, W/ledger, expiry P, S→C, cross-encounter C and rollback/timeouts | **Not run for this proposal** |
| 4. Mixed-version compatibility | Old public v1–v13 spell routing plus all nonspell/GM writers covered; no reachable bypass or unsafe split cutover | **Unproven** |
| 5. Signed-in acceptance | Genuine distinct JWT users, revoked controller, two players authorized for one NPC, hidden result, same-UUID changed intent | **Not run for new proposal** |
| 6. Shared character policy | Owner selected **Option A / TC1**: no canonical character in two active encounters; review existing overlap, safely serialize competing activations; paused lifecycle semantics not yet finalized | **POLICY APPROVED; ENFORCEMENT NOT IMPLEMENTED** |
| 7. Rollback and release | Versioned migration/ledger, fail-closed legacy rows, resource parity, exact-head checks and owner approval | **Not authorized** |

**Manual testing:** None required from the owner for this source-only pass. Once an isolated test candidate is actually available, provide an exact local/staging URL or command, two test-user setup instructions, expected results and what evidence to return. Do **not** request passwords or production game encounters.

**One next action:** Expand the effective graph and disposable two-session concurrency schedules, **including two GM activations of distinct encounters containing the same canonical character under approved TC1 / Option A**. Design the candidate per-character reservation without bypassing the coordinated lock order. **Leave P1.3 unchecked; P1.5 enforcement is not implemented.**

## Additional live TC1 entry paths (SELECT-only inspection, 2026-11-01)

- `admin_start_encounter_v1`: locks E, validates participants, initiative, map/hex placement, updates participants and sets E active. Its inspected body has no cross-encounter canonical-character exclusivity guard; nested helpers must still be examined.
- `admin_set_encounter_status_v1`: for **draft/ready/initiative → active** delegates to `admin_start_encounter_v1`; for **paused → active** it directly updates E through a separate path. A Start Encounter-only TC1 guard would miss this resume path.
- `admin_add_encounter_participant_v1` locks E and stages only before active play. `admin_remove_encounter_participant_v1` and `admin_update_encounter_participant_staging_v1` lock P before updating E; their order must be included in the P1.3 lock graph.
- At the SELECT-only checkpoint, two encounters were active and one canonical character appeared in both. No record was changed. TC1 requires reviewing this overlap before any future enforcement migration.

**Research constraint:** The scratch fixture locks a canonical character row before E, proving only the modeled admission race. It does **not** prove that a C→E acquisition order can coexist safely with the live E→P and S→C/trigger paths; both activation and resume must be evaluated under the eventual unified order.

## Exact-source Admin Start/Resume test — PASS in isolated PostgreSQL 16

**Verified:** [exact-source test run 41389394032](https://github.com/bob8675309/DNDNEXT/actions/runs/41389394032), on `2f8c42d`, installed the **verbatim deployed** `admin_start_encounter_v1` and `admin_set_encounter_status_v1` bodies into a minimal mock schema. All seven cases PASS: unguarded baseline TC1 conflicts are possible; a **test-only** trigger rejects conflicting starts, paused resume and direct writes; independent characters remain valid; transaction rollback restores state. Mocked dependencies/Auth and absent full combat triggers mean there is still **no globally accepted E/P/L/W/S/C order**, no production TC1 guard, and no P1.3/P1.5 completion.

## Verified same-row E/P inversion — disposable exact-source test

[Run 41392432969](https://github.com/bob8675309/DNDNEXT/actions/runs/41392432969) at `30c646e` **passed** two new source-derived race tests: deployed Admin Start (E→P) and Admin Staging Update (P→E) deadlocked in a deliberately coordinated scratch PG16 transaction; E-first prelocking serialized only this pair. Full [evidence and limitations](P1_3_Staging_Start_Lock_Race_2026-11-01.md). **Not a live production deadlock and not a globally certified order.**

## Verified turn-start trigger E→X→P inversion in disposable PostgreSQL

The exact live [turn-start expiry trigger race report](P1_3_Turn_Start_Expiry_Lock_Race_2026-11-01.md) documents two additional isolated PostgreSQL cases. [Run 41394548206](https://github.com/bob8675309/DNDNEXT/actions/runs/41394548206) on `b2db2f8` passed: a target P-first transaction and E-triggered X→P speed reset deadlocked on the **same target row**; an E-first positive control finished safely for that pair. This confirms another **source-derived** incompatible lock interleaving, not a live production incident. Slot bridge S→C, unique-index upserts and permission locks remain outstanding. **P1.3 stays open.**

## Spell-slot S/C and permission-revocation fixture: verified

[Five-case source-derived research report](P1_3_Spell_Slot_and_Revocation_PG16_2026-11-01.md) passed on [run 41395991124](https://github.com/bob8675309/DNDNEXT/actions/runs/41395991124), tested SHA 0ffcd12. Persistent slots rejected one overspend across two historical snapshots; two available spends succeeded. The original S-to-C bridge deadlocked against a **synthetic C-first** transaction. The original control helper demonstrated a stale permission check only when followed by a **simulated action**, while a row lock serialized the positive control. These are not production incidents or a safe universal order. P1.3 remains open.

## Source-derived refresh C→S against spend S→C — two isolated PG16 cases PASS

[Detailed source and exact CI evidence](P1_3_Refresh_vs_Spend_Source_Lock_2026-11-02.md), [run 41558043789](https://github.com/bob8675309/DNDNEXT/actions/runs/41558043789) at `4831a8e`: unlike the earlier synthetic C-first writer, the **deployed `refresh_encounter_spell_slots_from_characters_v1`** function itself takes C before upserting S. Opposing original spend S→C deadlocked on the same rows under deliberately scheduled external C prelock; scoped S-first prelock was a positive control. **This does NOT prove both paths overlap during valid activation/casting or select a universal order.** Exact active-status/turn/trigger reachability and real JWT races remain P1.3 blockers.

## Public Admin Start/Resume versus Healing Word v13 — exact command integration results

[Source-backed three-case report](P1_3_Public_Activation_Cast_Reachability_2026-11-02.md) passed in [GitHub run 41560428459](https://github.com/bob8675309/DNDNEXT/actions/runs/41560428459) at `cebc04a`: Start then valid Healing Word commits and spends one C/S slot; concurrently *attempted* Healing Word during uncommitted Start produces a real scratch PostgreSQL **E→P / P→E deadlock** with no partial spell; paused→active Resume holds E and queues Healing Word until active-turn validation succeeds, without a deadlock in that pair. Real public v13/Admin/refresh/bridge definitions were used with mock schema, Auth and some healing/profile helpers. **The earlier direct helper C↔S deadlock was not shown reachable between already valid public activation/cast commands.** P1.3 remains open.

## Exact public Move/Core/End/Reaction/Weapon race and end-turn replay fixture

[Eight-case source-derived evidence](P1_3_Public_Turnflow_Weapon_Replay_PG16_2026-11-02.md) passed in [GitHub run 41563202836](https://github.com/bob8675309/DNDNEXT/actions/runs/41563202836) on SHA `e508649`. Cases 22–25 exercise original movement, core Dodge, turn advancement, created opportunity window, Reaction Pass and scoped W/P serialization. Case 26 shows original End Turn cached replay **returns a prior result for a different participant and encounter** under mock Admin authentication; its branch does not bind actor, requester or intent. Cases 27–29 verify original Weapon Attack request and action/turn contention with **mock damage, weapon profile and targeting**. No real signed-in exploit or full attack damage rules were validated. P1.3 remains open.

## Real Opportunity Attack and v13→v12 delegated replay: six scratch PG16 cases verified

[Live-source test evidence](P1_3_Opportunity_Attack_Delegated_Spell_Replay_2026-11-02.md), [run 41564947213](https://github.com/bob8675309/DNDNEXT/actions/runs/41564947213) at SHA `beba0cb`: cases 30–32 exercised the **real opportunity Attack branch**, post-turn Reaction refresh, concurrent Reaction Attack/End Turn, and a **resolved-window cached result returned for altered choice/request and mock caller before authorization**. Cases 33–35 exercised **v13→v12 Bard Vicious Mockery** cast/target-end effect, its **changed-target/slot replay returning the original result**, and Cast/End Turn serialization. Source bodies exact; auth, weapon/damage/save helpers mocked. These are **replay integrity findings, not proven cross-user exploits**. v11/v10/v9 descendants and real JWT revocation remain untested. P1.3/P1.5 open.

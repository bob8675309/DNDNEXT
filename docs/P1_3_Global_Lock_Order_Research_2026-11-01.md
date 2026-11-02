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

**Disposable two-session expansion:** [TC1 Option A PG16 isolated concurrency model](P1_3_Option_A_Concurrency_Model_2026-11-01.md) covers competing GM admission, rollback, historic overlap preservation, and a **synthetic** inverted-lock example. It does not run deployed DnDNext RPCs or resolve the global transaction lock root.


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

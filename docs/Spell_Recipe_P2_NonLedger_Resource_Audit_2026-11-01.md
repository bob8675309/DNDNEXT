# P2 — Non-Ledger Encounter and Shared Character Resource Audit

_1 November 2026. Draft research PR #312 stacked on held #309; source read from the live DnDWeb database using SELECT-only metadata and aggregate queries. **Do not deploy, merge, grant, or call any mutating production RPC on the basis of this report.**_

## Why this was the next task

The preceding [Shared Encounter Lock Graph](Spell_Recipe_P2_Shared_Encounter_Lock_Graph_2026-10-31.md) traced 22 cast RPC names, eight additional non-spell command-ledger writers, their immediate helper calls, and six encounter-runtime triggers. Its next task was to examine writers **outside** the ledger that can alter encounter status, participants, character spell slots, and sheet/rest state. These operate without the same `request_id` protocol, so a ledger-only cutover cannot serialize every authoritative write.

The spell-first, XPHB-first and GM-assisted owner decisions in `SPELL_ENGINE_DECISIONS.md` remain binding. No alternate AI actor, recipe executor, map feature, Forge rewrite, or production migration has been introduced.

## Ten verified public non-ledger mutating RPCs

| Runtime area | Live functions inspected | Lock/resource implications |
| --- | --- | --- |
| Encounter creation and activation | `admin_create_encounter_v1`, `admin_start_encounter_v1`, `admin_set_encounter_status_v1` | Encounter INSERT/UPDATE and activation/turn-start triggers; starting an encounter locks E and updates its participant rows |
| Participant administration | `admin_add_encounter_participant_v1`, `admin_remove_encounter_participant_v1`, `admin_update_encounter_participant_staging_v1`, `admin_set_encounter_damage_affinities_v1` | Staging can lock a participant then update E; participant INSERT initializes spell slots from persistent character pools |
| Turn-marker administration | `admin_set_encounter_turn_marker_v1` | Direct encounter UPDATE may fire turn-start timed-effect expiry, including updates of another participant's Speed |
| Character rest | `complete_character_rest_v1` | Synchronizes and restores persistent spell slots, uses and sheet action-state, then inserts a rest log. The rest-log BEFORE INSERT guard rejects characters in an active encounter, rolling back the transaction if the guard raises |
| Sheet spell-slot mutation | `update_character_spell_slot_v1` | Synchronizes slots, locks the persistent pool row FOR UPDATE, and triggers the active-encounter resource guard |

These are **ten selected public entry points** with direct encounter or persistent-slot effects, not a claim that no other public functions can affect health, resources, conditions, inventory or authorization. The live function MD5s are frozen in `scripts/fixtures/encounter_nonledger_resource_snapshot_p2.mjs`; re-run `scripts/audits/encounter_nonledger_resource_readonly_p2.sql` to verify changes.

Seven private helpers were also reviewed: `character_active_encounter_v1`, `assert_character_resource_not_active_v1`, `guard_character_rest_insert_v1`, `guard_character_spell_slot_update_v1`, `mirror_encounter_spell_slot_spend_v1`, `sync_character_spell_slots_v1` and `refresh_encounter_spell_slots_from_characters_v1`. This includes live trigger wiring, not merely documentation of intended behavior.

## Confirmed existing safeguards

- `encounter_participants` has a **unique index (`encounter_id`, `character_id`) where character_id is not null**. It prevents duplicating the same character in one encounter but **does not** prohibit the same character in two different active encounters.
- The persistent `character_spell_slots` pool has primary key **(`character_id`, `pool_key`, `slot_level`)**; encounter snapshots are unique **(`participant_id`, `pool_key`, `slot_level`)**.
- `encounter_spell_slot_character_spend_bridge` is an AFTER UPDATE trigger on a decreasing encounter slot. It calls `private.sync_character_spell_slots_v1`, obtains the persistent pool row **FOR UPDATE**, and rejects a spend exceeding persistent remaining slots. The persistent update is in the **same transaction** as the encounter update; an exception rolls back the attempted encounter slot decrement as well. This protects the observed ledger-linked casting route against a straightforward double spend; it is not proof of all concurrency interleavings.
- `character_spell_slots_active_encounter_guard` checks ordinary sheet-side slot adjustments. `character_rest_active_encounter_guard` checks the rest log on insertion; `character_spell_uses_active_encounter_guard` protects limited use changes. Their helper `private.assert_character_resource_not_active_v1` finds any active encounter for the character and refuses the write.
- The helper skips this restriction only when internal `dndnext.resource_bridge_context` is `encounter_spend` or `maintenance`; privilege and transaction context must be audited, **not** interpreted as an authorization model for arbitrary clients.
- The rest RPC does its slot and other resource updates **before** the rest log insert. The AFTER work does not commit if its BEFORE INSERT guard rejects the rest. This correct rollback relies on PostgreSQL transactional semantics. It should be regression-tested under genuine signed-in concurrency rather than assumed from ordering alone.

## Read-only live state observed at this checkpoint

No participant IDs, user IDs, player names, or character details were retrieved or stored.

| Aggregate | Live observation |
| --- | ---: |
| Active encounter participations linked to characters | 4 |
| Distinct characters participating in active encounters | 3 |
| Characters appearing in more than one active encounter | **1** |
| Active encounter slot snapshot rows | 3 |
| Active slot snapshots missing a persistent pool | 0 |
| Active snapshots differing from persistent pools | **0** |

The database **already permits overlapping active participation**. There are currently no observed slot snapshot mismatches, but one cast can immediately leave the other encounter's independently stored snapshot stale. A second cast attempting to spend more than the remaining persistent pool should fail at the spend bridge and roll back. **That outcome has been modeled, not exercised against production.**

### Cross-encounter implications

- Proposed universal encounter-first ordering (`E → participants → effects → slots`) serializes operations **within one encounter only**. Two different encounters can still contend on the *same persistent character slot* after holding different encounter rows.
- The spend bridge is a necessary final resource guard; other non-ledger writers such as encounter initialization, activation refresh, rest and sheet-slot changes can acquire **persistent character slots before or after encounter-local locks**. A universal cross-encounter lock order requires a separate character/resource-level contract or an explicit prevention policy for overlapping active participation.
- The character-active helper returns **one** active encounter for reporting (ordered by last update), even if two exist. This suffices for a yes/no rest guard but **must not be treated as a uniqueness guarantee** or as a complete list of active character uses.
- Activation refresh overwrites encounter snapshots from persistent pools; another active encounter can still retain its old snapshot. The design must specify whether stale snapshots are refreshed on successful spend, on next action, or shown as a provisional UI value.
- Admin turn-marker writes can trigger encounter turn-start effects outside the command ledger. Admin staging/activation functions also need stable lock ordering; their admin-only grant checks are not equivalent to player request authorization.
- None of these findings authorizes editing player character progression, Forge spell-source grants, world movement, or the existing combat system.

## Disposable two-session regression (synthetic model)

`scripts/fixtures/encounter_shared_character_slot_p2_pg16.sh` uses **local PostgreSQL 16 only**, guarded to require `PGDATABASE=fire_bolt_p2` and `PGHOST=localhost/127.0.0.1`. It creates independent small tables, two encounter snapshots of one shared character with one persistent slot, and a mirror trigger that locks the persistent row.

Two separate database clients concurrently attempt to spend one slot each. Expected: **exactly one succeeds**; the other fails due to persistent exhaustion; no negative balance; the loser’s encounter snapshot rolls back; the old independent snapshot remains stale. The script does **not** invoke DnDNext functions, load Supabase Auth, create actual encounters, or demonstrate full live behavior. Previous synthetic encounter-first and Fire Bolt tests remain unchanged.

The frozen snapshot validator `scripts/validate_encounter_nonledger_resource_p2.mjs` prevents undocumented removal of reviewed entry points, helper fingerprints, and test fixture safeguards. A passing static inventory is not a fresh live database audit.

## Release gates, migration direction, and one next task

**Do not activate the existing caster-first candidate or construct a parallel player-visible executor.** A production-safe design requires:

1. An explicit decision about **overlapping active encounters for the same character**—reject activation, serialize all shared-character resources, or build a coherence protocol. Current stored data proves the condition exists; an unconditional uniqueness constraint could invalidate real records and is **not** an acceptable unreviewed fix.
2. A complete call/lock graph for **all** encounter status, administration, rest and resource writers (including triggers), with per-character persistent-slot ownership. Assess cross-encounter deadlock cycles and differences between staging and active encounters. Reconcile existing Admin operations, effects and weapon attacks.
3. Versioned request intent binding for the 30 ledger-touching paths and a compatibility/expiry policy for historical pending results; do not infer client intent from visible combat results.
4. Disposable tests for same-character two-encounter slot contention, admin status transition versus casting, rest refusal/rollback, activation refresh versus spend, and mixed encounter/effect trigger interactions. Prefer genuine source functions over simplified models as the design advances.
5. Actual two-user nonproduction Supabase GoTrue + PostgREST acceptance with real signed-in JWTs, revocation, hidden targets and authorization, and a documented reversible cutover. Connected Supabase exposes only DnDWeb production; no production casts or new paid staging should be created without approval.

**Single next engineering task:** design the **shared-character multi-encounter resource policy and source-backed safe transaction/rollback plan** before implementing an encounter-wide executor. A free local GoTrue/PostgREST test harness is a potential next evidence step, but it must be separate from DnDWeb and must not masquerade as a production approval.

All work remains held on draft PR #312; no production SQL, grants, migrations, accounts, games or deployments have been changed.

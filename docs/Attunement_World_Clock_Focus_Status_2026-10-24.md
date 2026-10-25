# World-clock attunement focus sessions — staged foundation (2026-10-24)

**Status:** Draft, not production deployed. This PR stacks on #262 → #261 → #260 → #257, separate from common effect arithmetic #251 → #253 → #255. No live database, public RPC, existing rest/bond command, character sheet, combat, maps, or AI runtime has been changed.

## Why two clocks matter

Live DNDNext stores authoritative simulated game time in public.world_state(id=1).world_time at time_scale=4 (1 second real = 4 seconds game), and the calendar may be years ahead of wall time. The existing character_rest_log.completed_at is **real server time**, and PR #262's focused-rest evidence read model currently checks **one hour of real elapsed time**. Do not mix those without an explicit, tested conversion. The 2024 Short Rest rule is 1 hour of **game-world downtime**. During normal time_scale=4 progression, that would correspond to around 15 minutes real time **if the world clock continues advancing**, but never accept a client-side elapsed-time claim.

## This PR's guarded internal foundation

sql/20261024_06_attunement_world_focus_session_foundation.sql creates a table in the **private schema** to track active item-focus attempts. All functions are SECURITY INVOKER and restricted to service_role, with no access for anon/authenticated. A focus attempt:
- Uses exact character, inventory item and idempotent UUID request identity; locks per character to prevent duplicate simultaneous focus attempts.
- Reuses the active-encounter resource guard, canonical source/ownership (including multiple-characters-one-player ambiguity) and verified class prerequisites. Equipping is not required for attunement: item contact is a later verified stage.
- Captures authoritative world_time from the database. Only one active attempt per character. A repeated start request does not reset the start time. Abort is separate and idempotent.
- A **read-only** inspection reports whether one complete **world-time** hour has elapsed or the source/owner/class becomes invalid. It does NOT verify contact, interruption/initiative/spells/damage, identification on a separate rest, or an existing completed canonical Short Rest, and returns attunementQualified=false / canCreateBond=false **always**.

The current private.attunement_rest_class_evidence_v1 from #262 is unchanged; it still distinguishes server-authored **real timestamp** focus receipts from ordinary generic logs. The new world-time attempt does NOT generate that receipt or silently satisfy the old helper.

## Test/compatibility gates

Isolated PostgreSQL16 tests simulate advancing/reversing world_time, 59 minutes vs a full game hour, same UUID replay, duplicate simultaneous attempts, foreign identity, wrong source, transfer, active encounter start denial, abort/retake, no false character_rest_log or attunement bond creation, and restricted role privileges. All synthetic records use the parent stack fixture.

## Remaining production gate

1. Agree on world clock treatment when paused, time_scale changed, travel/rest interrupted, and on active encounter or spell/damage events. The world map's clock and route systems must **not** be modified.
2. Build one **trusted** canonical completed Short Rest flow that validates the server-world-time focus attempt and contact/no-interruption/identification separately, commits canonical rest resources in the same guarded transaction, then writes a **single-use, auditable evidence receipt** with separate world-vs-real timestamp semantics and no user-authored event JSON.
3. Add source/item/class/cap/Artificer/curse/transfer gates to #257 bond writes, eliminating the old boolean-only/fuzzy item source path.
4. Only after side-by-side genuine actor/sheet/tactical effect parity, turn on source-aware magic bonuses. Existing mundane armor/weapon effects and Resistance-before-flat-DR order remain authoritative.

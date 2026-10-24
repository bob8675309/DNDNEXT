# Physical Specimen — Tactical integration gate (2026-10-23)

**Status:** implementation design and rollout gate only; does not change tactical execution or UI.

## Verified current authorities

The current live database was inspected read-only before drafting an encounter feature command:

- `public.encounter_use_core_action_v1`: request-id deduplication via `encounter_command_requests`; locks participant and encounter; enforces active turn, controller authorization, defeat/action availability; writes an encounter combat log and increments encounter version.
- `public.encounter_can_control_participant_v1`: uses owner/controller/GM authorization and is **different** from the persistent progression `private.can_manage_character_progression_v1` permission.
- `public.encounter_participants`: `bonus_action_available`, `current_hp`, `max_hp`, `speed_ft`, `movement_spent_ft`, `state`, and encounter-scoped turn snapshots are separate from character_sheets.
- `public.encounter_command_requests_command_type_check`: currently allows only `move`, `end_turn`, `core_action`, `attack`, `weapon_attack`, `save`, `reaction`, `effect`, `spell_cast`. A new feature-specific command type is **not permitted** without a schema change; do not silently overload an existing type without checking its callers and idempotency semantics.
- `public.encounter_canonical_speed_ft_v1` computes persistent base Speed from sheet; `public.encounter_canonical_combat_snapshot_v1` reads persistent base current HP and equipment AC. They do not yet consume runtime Physical Specimen buffs.
- `character_rest_log` has an active-encounter guard; runtime Physical Specimen uses per-Long-Rest activation and one replacement after each Short Rest.
- The staging `get_character_physical_specimen_effective_stats_v1` in PR #250 is a **read-only sidecar**, not a drop-in tactical snapshot replacement. It explicitly reports `effectsIntegrated=false`, and marks HP reconciliation without mutating the saved sheet.

## Required encounter command invariants

1. **Authorization first**: validate caller controls the participant through the existing participant-control function; do not assume edit permission implies permission to spend a combat turn, or vice versa. Source/subclass/level gate must also pass.
2. **Single serialized command**: lock the participant, encounter, and relevant progression/runtime state in a documented consistent order; fail closed on a stale or ineligible turn.
3. **Bonus Action economy**: only the active, non-defeated participant with `bonus_action_available=true` can activate; consume it in the **same transaction** as activation. No free activation through the outside-encounter RPC while an encounter is active.
4. **Idempotency and audit**: use `encounter_command_requests` and its allowed command types properly. Retries with the same request id must return the original result without double-spending. Log the feature and update encounter version. Collision with an unrelated command must fail.
5. **Stat snapshots**: apply nonpermanent max HP and effective Speed to the tactical snapshot once, not to persistent base sheet; preserve current HP and temporary HP. Ensure other tactical save/heal/turn functions do not later overwrite or recompute the snapshot from unmodified base values.
6. **Further benefits**: darkvision grant versus existing range extension must consult canonical species/equipment vision; Athletics/Acrobatics, Poisoned saves, jumping and climbing must feed their existing gameplay checks rather than remaining decorative. An action is not fully integrated until each of the six benefits is accurately reflected.
7. **Rest and expiration**: no rests during active encounters; when a Long Rest ends Physical Specimen outside combat, reconcile current HP if above the new effective maximum in the existing HP mutation authority (never in a getter).
8. **No UI redesign**: keep the paper-style character sheet and the original Forge. Before any new activation selector or navigation control, make mock-ups from the actual current components and get approval.

## Required tests before exposing a tactical activation command

- Nonowner request; owner with no participant control; GM and service-role boundaries.
- Not active participant; inactive encounter; defeated participant; already spent Bonus Action.
- Valid activation, wrong subclass, low/high Charisma limits, unknown/duplicate benefit IDs.
- Two simultaneous requests and duplicate `request_id` retry, plus command-type collision.
- Correct combat log, encounter version increment, no permanent sheet mutation.
- Effective max HP/Speed once only; no reset of HP/speed on next turn, spell/heal/damage, or re-sync.
- Correct Vision/Poisoned/skill/movement tests, long-rest expiration, and no swapping during an encounter.
- Run in an isolated PostgreSQL fixture and separate browser-level tactical smoke before merging or deploying.

**Do not infer that the staged stat projection or outside-encounter activation is already playable through a character UI.**


## Verified staging/canonical refresh slice (migration `_06`, staged only)

- `private.physical_specimen_active_bonuses_v1` reads canonical progression/source and the active, valid runtime selection, rejects invalid JSON or expired use, and reports only HP/Speed deltas to internal encounter consumers.
- `encounter_canonical_speed_ft_v1` now includes the active +5 Speed benefit. The same helper is already called by participant staging, encounter start and multiple turn/spell Speed recalculations, eliminating loss or stacking of that particular bonus.
- Existing `encounter_participant_max_hp_guard` continues to populate a **missing** `max_hp` field from the permanent sheet and now adds the active temporary Warlock-level bonus. It does not add again to an initialized encounter snapshot.
- The existing paper-style sheet's `get_character_physical_specimen_effective_stats_v1` was adjusted to subtract that same active Speed bonus before reporting `baseStats.speedFt`, avoiding +5 being counted twice.
- Isolated PostgreSQL 16 tests pass for activation before staging, first HP/Speed snapshot, repeated canonical Speed refresh, Long-Rest expiry in a newly staged encounter, and malformed benefit keys. These tests are in the scoped PR workflow; nothing has been run against live character data.

### Remaining release gates

1. **Staged-then-activated:** If a character is staged in a draft encounter **before** activating Physical Specimen, their initialized `max_hp` is not automatically recalculated by the current `admin_start_encounter_v1` procedure. Do not expose pre-encounter activation in the player UI until this has a safe, idempotent reconciliation at encounter start.
2. **Remaining benefit consumers:** Poisoned saving throw advantage, vision range, Athletics/Acrobatics bonuses, jump distance and climbing movement must feed their actual resolution systems before claiming the six options fully work.
3. **Turn/command integration:** Do not expose the staged tactical RPC until live schema compatibility, full downstream effects, and browser regression checks are complete.
4. **Permission/production:** Keep the feature on a draft branch; current tests use isolated fixture grants, not production permissions. Confirm procedure owner and search-path constraints, source catalogue match, and staging/rest edge cases before migration.
5. **No UI redesign:** Actual current Forge cards, overlays and the paper-style sheet must be reused, and a UI mock-up approved before implementing any player-facing control.

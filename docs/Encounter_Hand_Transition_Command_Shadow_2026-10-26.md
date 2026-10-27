# Transactional Encounter Hand Transition — Shadow Ledger (2026-10-26)

**Draft #288 (stacked on #287). Not a live D&D action or an implemented spell focus.**

## Purpose and existing boundaries

DNDNext's canonical battleboard movement/end-turn SQL (`20260727_04_authoritative_encounter_turn_movement.sql`) uses a guarded participant-turn authority and an idempotent request ledger. The existing Equipment Manager holds physical gear in `weapon_1`–`weapon_3`, not main/off hands. Draft #286 stages a character's intended hands; #287 copies those intentions to a **versioned, encounter-participant-scoped shadow snapshot** and provides a dry-run of transitions.

This increment supplies the **atomic write/duplicate-request/replay/race** half that a future real hand action will require, while keeping live gameplay entirely unchanged.

## Added shadow-only command

`sql/20261026_07_encounter_hand_transition_command_shadow.sql` introduces `encounter_hand_transition_requests_shadow_v1` (secure RLS table, no direct anon/authenticated rights) and one guarded authenticated RPC:

`commit_encounter_hand_transition_shadow_v1(participantId, hand, targetItemId, expectedSnapshotVersion, expectedRound, expectedTurnIndex, requestId)`.

The RPC:
- Authorizes `auth.uid()`, exact encounter participant control, progression management and character inventory access;
- Locks the **participant, encounter, then ordered inventory items, then snapshot header** in a single transaction; validates the current undefeated participant, active encounter, exact round and turn index, non-invalidated snapshot/version, both existing hand items, and target physical item ownership/equipment/custody;
- Forbids the same exact inventory UUID in both hands, ambiguous shared account ownership, and stale/foreign source identities;
- Atomically modifies **only the #287 shadow encounter-hand item table**, increments its version on change, and appends an authenticated command ledger entry; no-change operations keep the current version;
- Checks an exact request UUID against the complete payload and actor, returning the **original stored result** for identical retries even after the turn advances, and rejecting a reused UUID with different command parameters;
- Restricts experimental applied changes to **one per participant per round+turn index**, through a partial unique index and an explicit guard. This is a testing safeguard, **not a claim about the 2024 D&D rules**; the final action economy must be established separately.

Returns `shadowHandStateTransitioned=true` only if the *shadow record* changed. `canonicalActionSpent=false`, `canonicalBonusActionSpent=false`, `canonicalReactionSpent=false`, `combatLogWritten=false`, `activeHandsVerified=false`, `actionCostVerified=false`, `focusBonusApplied=false`, and `combatConsumerEnforced=false` remain mandatory.

### Why this is not real draw/stow

No consumer is connected. The actual game cannot yet treat the new record as authoritative for weapon attacks, spell materials/somatics, shields, dual-wielding or magical focus effects. No inventory equip slot or physical ownership changes, and canonical `encounter_participants`, `encounters`, movement, turn order, HP, action/bonus/reaction resources, spell slots and combat logs remain untouched. The one-per-turn experimental quota is not a substitute for the rules governing Attack-action draw/stow, free object interactions, two-handed properties or reactions.

## Disposable PostgreSQL16 verification

`scripts/fixtures/encounter_hand_transition_command_shadow.sql` composes #287's complete inventory/permissions/spell and encounter fixtures, adds real-shape encounter round/turn and action fields, then checks:

- Anonymous/direct-table denial; authenticated participant-only access and cross-user replay denial;
- No-change command and exact UUID retry are byte-equivalent; reuse of a UUID for another hand is rejected;
- A real **shadow-only** stow deletes just one hand, increments version, leaves the other hand and existing equip unchanged;
- Duplicate retry never double-applies; a second changed command in the same exact participant-turn is rejected, but a new turn permits a new change;
- Stale snapshot version, outdated round/turn, other-hand same-item collision and ambiguous account-owned physical item are rejected;
- Previous turn's successful request returns its stored result on a later turn without modifying the present state;
- Inventory source edit invalidates the entire capture and prohibits another request even with the updated invalidated version;
- Out-of-turn, defeated and unauthorized control remain fail-closed; no encounter resources or spell-slot rows were consumed.

Node source-contract validation verifies real canonical turn-RPC lock/ledger patterns, all safety fields, table grants and no replacements to equipment/combat/spellcasting writers. GitHub Actions use isolated PG16 plus existing staged regressions.

## Remaining release blockers

1. Define and implement **actual 2024 D&D gameplay costs** for swapping equipment and use in Attack/Spell actions, including two-handed, shields, drawing ammunition, material and somatic components, features and reactions. This draft chooses **no canonical charge** deliberately because the rules aren't settled.
2. Action-time focus effects must consume the same authoritative **actual held/worn state** as the exact versioned cast writer; currently all spell/cast and equipment effects are unchanged.
3. Resolve account-shared physical equipment custody, canonical character-specific spell grants, focus magic stacking, attunement server-rest authorization, shield and spell-slot interactions, and encounters with multiple participant references to one character.
4. Decide how to surface a real hand action in the battleboard UI after the server-side effect contract is verified; keep the existing combat log, HP, turn, UI and maps stable.
5. Complete signed-in player/admin and combat regression testing, reconcile #251→#255 generic effects work, and seek explicit production merge/migration approval.

**The full #267→#288 chain remains staged, draft, unmerged and undeployed.** No world/town map, Character Forge or live character-sheet changes.

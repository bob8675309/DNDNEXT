# Encounter-Scoped Hand Snapshot & Turn Transition Preflight — 2026-10-26

**Status:** Stacked draft PR #287, NOT a released battle-board action or live character-hand system. No production Supabase migration/merge.

## Architecture and authority

- The Equipment Manager's `weapon_1/2/3` are **physical equipped gear locations**, not actual active hands. Draft #286 separately allows authenticated characters to declare intended main/off-hand equipped UUIDs, with strict character custody and no live consumer.
- A tactical encounter uses `encounters.status` (`draft`/`ready`/`initiative` before `active`), `encounter_participants.encounter_id`, `encounters.active_participant_id`, participant control/character permissions, and turn action/bonus/reaction fields. The combat page's real spell/weapon/damage RPCs remain separate.
- A user's staged precombat hand choice cannot be treated as a statement about **the item they were holding at a later attack or cast**, particularly after draw/stow/switch/transfer or another creature's turn. Shield/two-hand/focus-somatic/material rules and action costs remain unresolved.

## New isolated shadow data

`sql/20261026_06_encounter_hand_snapshot_transition_shadow.sql` adds two secured tables:

- `public.encounter_hand_snapshot_header_shadow_v1`: one participant ID, version, invalidation state, capture actor/time.
- `public.encounter_hand_snapshot_items_shadow_v1`: at most one exact equipped inventory UUID per `main`/`off` hand, unique per participant/item. The actual equipment manager remains unchanged.

All direct anon/authenticated table privileges are revoked and RLS enabled. Restricted authenticated `SECURITY DEFINER` RPCs re-check the actual encounter participant and access authority, with fixed search paths.

`get_encounter_hand_snapshot_shadow_v1(participant)` returns an authorized read-only audit and explicitly reports `activeHandsVerified=false`, `actionEconomyVerified=false`, `focusBonusApplied=false`, `combatConsumerEnforced=false`. An absent capture is not silently filled in.

`capture_encounter_hand_snapshot_shadow_v1(participant)` is **precombat only** (`draft`, `ready`, `initiative`). It requires encounter participant control plus character progression management and inventory access. It locks participant/encounter, serializes against the #286 character staging setter using its advisory lock, locks exact inventory items, and validates they are still equipped, owned, and in canonical weapon slots. A recapture increments its version; once combat is active, captures are refused. The copy is not triggered automatically when starting battle, which avoids altering current game flow.

`preview_encounter_hand_transition_shadow_v1(participant,hand,targetItem,expectedVersion)` is **read-only**. It requires an active encounter, the undefeated active participant, current authorization and an initialized/non-invalidated exact-version capture. It proposes `no_change`, `draw`, `stow`, or `replace` for an exact permitted inventory item, rejects trying to use the item already assigned to the other hand, and returns both current and proposed IDs. The preview **does not** draw, stow, swap, spend an Action, decrement Bonus Action/Reaction, roll dice, or change a single existing gameplay field. It reports `weaponSwapApplied=false`, `actionCostVerified=false`, `twoHandedAndShieldRulesVerified=false`, `activeHandsVerified=false`, `focusBonusApplied=false`, and `combatConsumerEnforced=false`.

### Stale snapshot fail-closed behavior

A separate inventory-change trigger watches ownership, equipped state and slot, source identity, rarity, and card payload. When an item previously captured in an encounter changes, the trigger **increments the entire capture version and sets `invalidated=true`** before removing its old item row. This is deliberate: clearing only the affected hand could make a partial snapshot look valid. A preview refuses any invalidated snapshot, including when supplied with the new version. Active combat forbids a blind recapture; future rules must explicitly resolve stale state through authorized in-combat transitions before enabling any consumer.

## Disposable PostgreSQL16 verification

`scripts/fixtures/encounter_hand_snapshot_transition_shadow.sql` composes all previous source/attunement, staged hand, spellcasting and combat ownership fixtures. It creates a disposable encounter with two participants and checks:

- no snapshot means uninitialized; precombat capture copies two staged hands and recapture increments version;
- another editable character does not inherit the first character's hands;
- unauthorized account cannot capture/read; ambiguous shared-account item cannot be staged;
- capture never modifies inventory and active encounter cannot recapture;
- only undefeated active participant may preview an action; out-of-turn and precombat previews fail;
- dry-run `no_change`, `stow`, `replace` outputs, physical item duplicate refusal, unowned/shared target refusal, optimistic stale-version refusal;
- previews do not write hand snapshots or change existing action resources;
- equip-slot/source changes invalidate the full snapshot and version; no sneaky active recapture;
- combat participant data and spell-slot snapshot rows remain identical through capture/preview.

A Node source validator checks the exact active-turn gates, permission rules, version invalidation, no live combat consumer imports or modifications, and untouched equipment/slot writes.

## Remaining requirements before actual battle-board hand state

1. Transactional **active-turn command** with exact draw/stow/switch costs, weapon item interactions, two-handed and shield rules; decide how actions, bonus actions, free object interactions, reactions and event ordering will be spent and logged. Do **not** treat these read-only previews as such a command.
2. Full owner/controller and encounter lifecycle locking; check concurrency against item transfer and simultaneous character appearances. A stale snapshot must never silently be re-enabled.
3. Character spell provenance, attunement selection, focus eligibility and stacking must read the *same cast-time item/hand identity* as the spell writer. Current profiles/casting RPCs do not.
4. Worn focus statuses and somatic/material component prerequisites; no NPC/merchant or other map behavior may be altered accidentally.
5. Server-authorized rest selection and shared-account physical custody, active combat snapshot reconciling, signed-in end-to-end roll/HP/action/slot/log tests and exact-head CI.

**All gameplay effect/readiness flags remain false**; all draft migrations #267→#287 are staged, not production deployed. No changes to world map, town map, Character Forge, ItemCard, or live combat UI.

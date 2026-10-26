# Character Hand Loadout Staging — October 26, 2026

**Staged draft only. No consumer integration, production schema deployment, or live gameplay change.**

## Architecture discovery

The **canonical player Equipment Diagram** permits `weapon_1`, `weapon_2`, `weapon_3` as *equipment positions* (alongside `throat`, `body`, rings, etc.). The original `set_character_inventory_equipment_v1` validates those slots; it does **not** accept the `main_hand` and `off_hand` hand names sometimes used in old/diagnostic fixture rows. Weapon slots contain gear candidates (including backup weapons and foci), not a record of what is actively held in either hand while casting.

`get_character_inventory_v1` also projects **account-owned player inventory** into every character editable by that account. This means a shared item can appear as equipped for two characters simultaneously. The attunement selection's exclusive magical claim is not enough to prove exclusive *physical custody*. Actual encounter snapshots also must not be rewritten when precombat declarations change.

## New narrowly scoped source layer

Migration `sql/20261026_05_character_hand_loadout_staging.sql` adds `character_hand_loadout_staging_v1` with exact character UUID, `main`/`off` intention, an equipped inventory UUID and declaration timestamp. It is a **precombat staging record**, not a truth source for held/worn-at-action-time or focus effects.

Authenticated RPCs, **not direct table access**, provide:

- `get_character_hand_loadout_staging_v1(character_id)` to see the existing declaration. Explicit `activeHoldVerified=false`, `combatSnapshotVerified=false`, `focusConsumerEnforced=false` and `physicalInventoryChanged=false` prevent false readiness.
- `set_character_hand_loadout_staging_v1(character_id, main_item_id, off_item_id)` to replace two independent hand intentions. Null clears one or both, while duplicate IDs are refused. The caller must be authenticated, able to manage the exact character progression, and authorized for its inventory. The same existing canonical combat/rest resource guard rejects writes during an active encounter.

Validation is **against server inventory rows**, not caller-supplied item names/card metadata. Candidates must be physically equipped in one of the canonical `weapon_1/2/3` slots and belong to the specified character. Ambiguous account-owned inventory attached to more than one editable character is conservatively rejected pending a physical custody redesign. Item locks and a per-character advisory transaction lock serialize replacements; primary-key and unique-item constraints defend against duplicate hand/item claims. Table RLS is enabled and all anonymous/authenticated direct table rights revoked; only authenticated RPC execution is granted.

A transaction-scoped inventory trigger invalidates the corresponding staged record on equipment state or slot changes, transfer, item identity/rarity or source payload edits. Existing items remain physically equipped/unequipped exactly as before: the trigger deletes **only the staged hand record**. Item deletion cascades. No active turn order, spell slot, HP, combat log, focus bonus, action roll or canonical sheet calculation is changed.

**Note:** Staging a rod in `main` is a user intention, not independently witnessed holding during a specific cast. The future encounter action must explicitly consume and validate a safe, character-controlled hand state (including conflicts and swaps) before granting any focus bonus; this migration does not authorize that consumer. Worn conditions and focus stacking are similarly unresolved.

## Isolated PostgreSQL verification

`scripts/fixtures/character_hand_loadout_staging.sql` builds on exact source/ownership, selection, focus and spell execution fixtures, then tests empty/preselected state, two hands, clearing/replacement, duplicate item prevention, foreign item and unequipped item rejection, a ring refusing to become a hand item, account-shared ambiguity, authenticated RPC-only access, active encounter write lock, invalidation after move/unequip/source edit/transfer, and byte-equal encounter spell-slot rows before and after all operations. An independent Node source validator checks no live item/encounter writer or slot synchronizer was patched. CI runs both in a disposable PostgreSQL 16 environment.

## Unresolved release decisions

1. Decide whether main/off-hand choices should be persisted per character, per encounter participant, or captured as a versioned **action-time** loadout. A character-wide precombat declaration alone is not combat-time truth.
2. Establish exact rules for drawing/stowing/swapping weapons and foci, two-handed items, shields, Somatic/Material components, reactions and class/item exceptions. The current Equipment Diagram still has only gear slots, not hand-action controls.
3. Model character-exclusive *physical custody* for account-owned items safely, including transfers and simultaneous character use, without redesigning unrelated inventories or auto-unequipping gear.
4. Prove exact spell acquisition and class-specific focus applicability, source bonuses and legal stacking. Even a matching `spells_catalog.classes` array is not proof how a particular character acquired that spell.
5. Reconcile all staged equipment/weapon/spell/Resistance-DR shadows, server-authorized rest opportunity, active encounter snapshots, authoritative spell writers, authorization and signed-in gameplay tests before changing Admin readiness or switching effects.

See [Attunement_Effects_Integration_Current_Handoff_2026-10-26.md](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md) for the complete draft PR dependency ledger (#266–#286) and protected systems. No changes to world map, town map, Forge presentation, or production Supabase.

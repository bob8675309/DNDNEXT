# Tactical Character Resource Bridge Status

Reconciled: 2026-08-02

## Implemented

- Persistent character spell-slot state remains owned by `character_spell_slots`.
- Tactical encounter spell-slot state remains owned by `encounter_spell_slots` and all existing spell-cast RPCs remain unchanged.
- New encounter participants snapshot the character ledger's current remaining slots rather than receiving a fresh maximum.
- Moving a staged encounter to `active` refreshes its participant slot snapshots from persistent character resources.
- Any active-encounter decrement of `encounter_spell_slots` is mirrored to `character_spell_slots` in the same database transaction.
- If the persistent ledger cannot satisfy the tactical decrement, the full tactical transaction is rejected.
- Sheet-side slot use, restoration, limited-use spell changes, and rest recording are blocked while that character participates in an active encounter.
- The tactical UI compares battle-board and persistent sheet counts through `encounter_spellcasting_profile_v2`.
- The sheet resource tracker reads active-encounter ownership through `character_sheet_resource_profile_v2`, disables conflicting controls, and refreshes through Supabase Realtime.

## Existing active encounter policy

The active `Milestone 2 Durable Smoke Encounter` predates this bridge. Its existing tactical slot counts are deliberately preserved rather than silently rewritten. The battle-board UI identifies the mismatch and explains that:

- future tactical casts spend both ledgers;
- the current tactical snapshot remains authoritative for this encounter;
- newly activated encounters begin from the persistent character totals.

This avoids retroactively changing a live encounter while establishing a single forward path.

## Rest boundary

- Short Rest and Long Rest remain character-sheet operations outside active combat.
- Rest controls are unavailable while a linked encounter is active.
- This bridge does not yet add an encounter-level rest action.
- HP, Hit Dice, and class-feature resource restoration remain separate future slices.

## Protected boundaries

- No world-map source or state is changed.
- No town/city-map source or state is changed.
- No tactical spell RPC dispatch is replaced.
- Encounter version ownership remains unchanged.
- Inventory, crafting, merchant, and equipment systems are unchanged.

## Validation

`npm run check:tactical-character-resource-bridge` verifies:

- persistent seeding and activation refresh source contracts;
- atomic tactical-to-character slot mirroring;
- active-encounter sheet guards;
- versioned tactical and character profile APIs;
- battle-board comparison presentation;
- sheet lock and realtime refresh behavior;
- preserved tactical spell dispatch and map boundaries.

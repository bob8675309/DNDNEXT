# Player Sheet Weapon Action Attunement Shadow — 2026-10-26

**Draft only; no live character-sheet, inventory, roll, spell or tactical consumer is changed.**

## Why a second weapon comparison is necessary

The tactical profile and the player's sheet use different authority paths. The current player quick-action list is built by `buildCharacterSheetActions` in `utils/characterSheetActions.js`; it includes warlock Pact/Hexblade Charisma weapon use, Barbarian Rage damage, Long-Limbed reach, finesse ability choice, thrown dual-mode presentation, proficiencies, and weapon mastery text. The tactical PG function audited in #279 does not model all of these. Reusing a tactical shadow output directly in the sheet would skip class behavior.

## New pure, read-only comparator

`compareAttunedPlayerSheetWeaponActions` in `utils/attunedPlayerSheetWeaponShadow.js` invokes the **existing, unmodified** player sheet builder twice: once with `abilityShadow.baseline.abilities[*].effectiveMod`, and once with `abilityShadow.shadow.abilities[*].effectiveMod` after masking only unselected **direct magical weapon enhancement fields**. The typed input requires matching explicit character UUID, `schemaVersion=1`, `consumerEnforced=false`, and matching campaign ON/OFF values from prior server-side shadow snapshots and source gate.

Important: **the client-supplied function arguments do not themselves authenticate the data.** If this function is ever exposed through the browser, it is diagnostic only; only the trusted server may resolve ownership, provenance and actual effective contributions. This function does not fetch secrets or perform writes, and no component currently imports it.

When campaign attunement is OFF, the candidate actions are **exactly** the canonical `buildCharacterSheetActions` output. When ON, the comparison:
- Preserves item IDs, equipped flags, weapon dice, damage types, proficiency, equipment and character-feature rows.
- Recalculates attack/damage using the same existing selection of STR/DEX, Pact/Hexblade CHA, Rage Strength bonus, finesse, thrown modes, and Long-Limbed reach.
- Applies source eligibility only to exact equipped inventory item identities; never lets one character's selected bonus authorize another's.
- Does **not** discard a physical weapon when its magical enhancement is unselected.
- Masks the high-priority `bonusWeapon` value as `"0"` rather than simply removing a field, which would accidentally reveal a `smith_tier` fallback and stack/restore an unclassified source.
- Preserves an item with only `smith_tier` while flagging `smith_tier_physical_or_magic_unknown`; mixed `smith_tier`+magic enhancement is explicitly unresolved.
- Rejects missing, duplicated or unverified equipped item IDs rather than assuming eligibility.
- Does not change spell actions. Spell attack/DC and spell save proficiency/override are independent consumers that require their own audit.

Outputs explicitly state `consumerEnforced=false`, `sheetWeaponParityReady=false`, `spellConsumerParityReady=false`, `catalogInstanceParityReady=false`, and `serverRestOpportunityVerified=false`. This comparator cannot serve as a real attunement rules switch.

## Executable regression cases

The new Node 22 test runs alongside `validate_player_sheet_actions.mjs`. Scenarios exercise actual player sheet action rendering:

- **Attunement OFF:** byte-equal canonical weapon and Rage action objects.
- **Bugbear Barbarian (Varges-style):** active Rage and Long-Limbed, +2 sword masked when not selected, ranged longbow, mundane finesse Rapier and a tempered Maul. Class action state and weapon dice do not change.
- **Warlock (Leso-style):** Hexblade / Pact of the Blade retains CHA attack ability, proficiency and 1d8 damage while an unselected +2 weapon enhancement is excluded.
- **Thrown Javelin:** the existing melee/thrown mode pill, ranged description, reach and Rage damage remain intact.
- **Trusted selection:** chosen sword and bow enhancements restore their own bonuses, without restoring suppressed STR/DEX bonuses from other items.
- **Unverified magic source and account-shared weapon:** unrelated character selection does not grant magic bonuses; missing, duplicate and mismatched source IDs fail closed.
- **Crafting exception:** `smith_tier` remains an unresolved potential physical enhancement instead of being blindly treated as magical; mixed source fields are recorded for future provenance work.

## Release blockers

1. **No full catalogue payload merge proof for player action rows.** `get_character_inventory_v1` and sheet action data may provide catalogue-backed attributes differently from the tactical query. Do not promote this diagnostic until catalogue+instance+VAR/crafting precedence is proven end-to-end.
2. Class exceptions beyond the existing sheet builder, weapon masteries, rider dice, attack saves, action economy, and damage mitigation/encounter snapshots remain to be verified.
3. The current builder also lists carried weapons, while the authoritative source gate only permits equipped items. This draft reports carried magic-enhancement records as unresolved and does not silently change an unequipped row's action.
4. Spell attack, spell save DC, overrides, concentration and casting bonuses still require the next consumer comparison.
5. Multi-character account physical equipment custody, server-verified rest opportunity, signed-in browser and tactical acceptance, and unresolved magic armor sources block production integration.

The source comparator has no map, inventory mutation, Supabase migration, weapon/card presentation or live roll modifications. Continue to leave attunement OFF by default and Admin Dashboard readiness flags false until all consumer and authorization gates are complete.

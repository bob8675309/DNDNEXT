# Attunement-aware character AC and saving throw shadow — 2026-10-25

**Status:** Draft, non-mutating, comparison-only. No production tables, character sheets, equipment placements, combat snapshots or consumers are changed.

## Existing numeric authority

The legacy `private.character_equipment_effects_v1(uuid)` calculates physical armor base and Dexterity caps, shield bonuses, direct item `bonusAc`, global/per-ability saving throw bonuses, adjusted ability scores and effective modifiers from `items_catalog.payload || inventory_items.card_payload` (inventory instance wins for the same key). The tactical snapshot and character sheet currently consume that authoritative output. This staged work does not replace it.

## New private comparison

`private.character_attuned_ac_saves_shadow_v1(character_id)` reads the exact existing resolver as `baseline` and the #274 server-side item selection/ownership gate. **OFF** returns baseline as shadow *without recomputation*. **ON** calculates a narrow shadow subtracting unselected magic sources' *direct* `bonusAc`, `acBonus`, `bonus_ac`, `bonusSavingThrow`, `saveBonus`, `bonus_saving_throw` and numeric `modifiers.saves`, following the legacy first-recognized-key parsing and per-ability rules.

The shadow preserves the existing physical armor, shield, Dexterity maximum, equipment IDs, and all unmodified legacy keys. Unknown indirect score/ability modifiers or shield/armor AC enhancement classifications remain explicitly unresolved in `unresolvedItemIds`. All outputs declare `consumerEnforced=false`, `fullEffectConsumerParityReady=false`; the direct-bonus comparison may not be promoted to a complete gameplay resolver.

## Isolated PostgreSQL16 regression

A byte-equal extract of the *real* 2026-08-01 canonical private resolver is compiled in the disposable database; CI verifies exact text equality with the source-controlled original. Existing account/inventory/selection fixtures seed player/shared inventory, and the new suite adds:
- A mundane Breastplate, physical AC 14 plus DEX cap 2;
- An Animated Shield with physical AC +2, plus +1 magical saving throw rider;
- A Cloak of Protection, with catalog `bonusAc=1` overridden by this instance's `bonusAc=2`;
- A separate magic staff with +3 AC/+2 global saving throw/+1 DEX save that must disappear unselected;
- An unknown rare item with misleading +4 AC/+5 save claims, which must be rejected while ON.

The expected fixture baseline is AC 23 and global saving throws +4. With only the cloak selected, the proposed direct-bonus shadow is AC 20 and saves +1, while preserving breastplate AC 16 and shield +2. With nothing selected, AC 18 and saves 0, with both physical pieces still present. Selecting all three relevant magical rider sources restores direct-bonus parity. OFF must return the exact unchanged original result.

## Remaining blockers

1. Magic armor and shield numeric `ac` fields can mix physical baselines and magical enhancement; these cannot be blindly gated. The shadow explicitly reports an unresolved source when this is encountered.
2. DEX/ability-score changes, class-specific saving throw roll modes, spells, weapon profiles and typed mitigation require independent normalization/parity. This adapter only handles direct AC/save numeric additions.
3. Account-shared equipment physical custody and server-verified rest opportunity are still unresolved. A rest URL query is not an authorization token.
4. Tactical participants are immutable snapshots; do not rewrite active encounters when changing equipment or magic selection.
5. Signed-in admin/player, multi-character, responsive and combat smoke must pass before production promotion. **Attunement OFF remains the production baseline.**

This work leaves world/town maps, Forge, equipment drag/drop, ItemCard styling and live database unchanged.

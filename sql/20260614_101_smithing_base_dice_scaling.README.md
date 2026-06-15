# Smithing base-dice scaling v4

The live Supabase migration `smithing_base_dice_scaling_v4` was applied on 2026-06-15.

It changes elemental temper calculations so every percentage is evaluated against the weapon's stored original damage dice. For a Battleaxe, 225% therefore resolves from `1d8` and versatile `1d10` to `3d8` and `3d10`, rather than scaling from an already-tempered result.

The migration also:

- stores `original_base_dmg1` and `original_base_dmg2` in the structured smithing payload;
- recalculates converted base damage and elemental rider descriptions from those original dice;
- backfills existing structured smithing inventory from the item catalog;
- advances the trigger payload version to `structured-materials-v4-base-dice-scaling`.

The canonical SQL is tracked in Supabase migration history under `smithing_base_dice_scaling_v4`.

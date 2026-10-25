# Attunement: indirect ability-score/modifier and Dexterity AC shadow (2026-10-25)

**Draft only — no production SQL, no live statistics changes.** This follows the direct AC/saving-throw parity shadow in #276.

## What the legacy resolver actually does

`private.character_equipment_effects_v1(uuid)` merges verified catalogue payload with inventory instance card payload and consumes `modifiers.abilities` or `modifiers.abilityScores` (first object wins), and `modifiers.abilityMods` or `modifiers.abilityModifiers` (first object wins). Numeric extraction takes the first signed integer substring. The resolver calculates `effectiveScore = clamp(base+scoreBonus,1,30)` and `effectiveMod = floor((score-10)/2)+modBonus`; armor applies DEX for light, `min(DEX,2)` for medium, and 0 for heavy. Unarmored AC falls back to 10+DEX unless an explicit nonzero sheet AC override exists.

## New private comparison

`private.character_attuned_ability_shadow_v1(character_id)` takes the exact existing legacy result and the verified prior shadow's selected-item gate. OFF returns baseline byte-for-byte as the candidate. ON removes ONLY score and modifier contributions from unequipped/not-selected/unverified magic sources already excluded by the source gate. It recomputes all six abilities' effective scores and modifiers, plus DEX-dependent AC for light and medium armor and ordinary unarmored AC. It does not change equip slots, the shield's physical +2, or direct AC/saving-throw bonuses already handled in #276.

Custom manual sheet AC is deliberately not rewritten: `acDexRecalculationComplete=false` and `unresolvedAcRule=manual_sheet_ac_override`. In all states, `consumerEnforced=false` and `fullEffectConsumerParityReady=false`. The prior shadow's unresolved magic armor/shield enhancements remain an explicit independent blocker (`legacyUnresolvedItemIds`). Spell DC, saving throw roll construction, weapon attack and damage, class exceptions, skill and initiative modifiers and encounter snapshots still require their own source-level audits.

## Isolated PostgreSQL16 tests

The fixture imports the real, byte-verified legacy equipment resolver, player inventory, item provenance, account-shared attunement and direct AC/save scenarios, then uses legitimate catalogue-backed Boots with +4 DEX score/+1 DEX modifier and a Staff with +2 STR score/+1 STR modifier. Regression cases include:

- OFF = exact legacy JSON without attunement claims;
- only Cloak selected: DEX score 20→16, DEX effective modifier 6→3, STR score 14→12 and mod 3→1, Breastplate medium AC 16 unchanged and physical shield +2 retained;
- select all three magic sources: recomputed score/modifier fields equal original legacy state;
- Light Armor: uncapped DEX changes armor base from 17 to 14 and total candidate AC to 18;
- custom manual sheet AC: remain unchanged and explicitly unresolved;
- standard unarmored AC: 10+DEX is properly recomputed;
- fake/unverified rare item with DEX ability bonuses cannot contribute when campaign rule ON;
- a base Dexterity of 28 with item bonuses reaching the score cap of 30 is recomputed from base 28 rather than subtracting from the clamped result;
- Heavy Armor AC 18 stays unaffected by either the selected or suppressed Dexterity modifier;
- revoking selection and toggling OFF returns exact original output.

## Release gate

This remains a read-only SHADOW with real ownership/selection predicates, not a rewritten `character_equipment_effects_v1` or a combat/sheet integration. Full physical-versus-magical armor enhancement provenance, campaign-specific spell/weapon resolution, verified server rest opportunity, shared-account physical item custody, active combat snapshots and signed-in browser smoke are outstanding. Do not merge until the integrated effects stack is fully verified. No world or town map changes.

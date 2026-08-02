# Character Sheet Formula Reference

Updated: 2026-08-02
Status: required reading before changing character-sheet ability, save, skill, AC, Initiative, Passive Perception, or equipment-derived calculations.

## Authority boundary

- `character_sheets.sheet` stores base character data and optional explicit overrides.
- Equipped-item numeric effects come from the shared equipment pipeline documented in `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md`.
- `utils/characterSheetRules.js` owns the pure browser-side formula helpers used for sheet presentation.
- `components/CharacterSheet5e.js` combines base sheet data, authoritative equipment effects, and the pure helpers.
- Tactical combat remains server-authoritative. Character-sheet display calculations must not replace guarded tactical RPC calculations or rewrite active encounter snapshots.

## Ability modifiers

```text
ability modifier = floor((effective ability score - 10) / 2)
```

Effective ability score includes structured equipped-item score bonuses. Direct ability-modifier bonuses are added after the score-derived modifier.

## Saving throws

```text
saving throw modifier
= effective ability modifier
+ proficiency bonus when proficient
+ all-save equipment bonus
+ ability-specific save equipment bonus
```

Expertise does not apply to saving throws unless a future explicit rule says otherwise.

## Skill checks

```text
skill check modifier
= effective linked ability modifier
+ proficiency bonus when proficient
+ a second proficiency bonus when Expertise applies
+ all-check/skill equipment bonus
+ skill-specific equipment bonus
```

Advantage and Disadvantage cancel each other and produce a normal roll.

## Armor Class

Only one base AC calculation can apply at a time.

### No armor

When no armor is equipped and no explicit alternative base is stored:

```text
AC = 10 + effective Dexterity modifier + shield bonus + other AC bonuses
```

When the character has a supported class feature and wears no armor, replace that base formula as follows:

```text
Barbarian Unarmored Defense = 10 + effective Dexterity modifier + effective Constitution modifier
Monk Unarmored Defense = 10 + effective Dexterity modifier + effective Wisdom modifier
```

Armor still replaces these formulas. A shield remains compatible with Barbarian Unarmored Defense; class-specific restrictions must remain explicit rather than being inferred from unrelated sheet prose.

`null`, `undefined`, blank text, numeric `0`, and string `"0"` mean no alternative base was stored. They must not be converted into AC 0.

An explicit nonzero stored value is a complete alternative unarmored base calculation, such as one supplied by a class feature. Do not add Dexterity again unless that feature's stored calculation requires the caller to do so.

### Light armor

```text
AC = armor base + full effective Dexterity modifier + shield + other AC bonuses
```

### Medium armor

```text
AC = armor base + min(effective Dexterity modifier, 2) + shield + other AC bonuses
```

A negative Dexterity modifier remains negative.

### Heavy armor

```text
AC = armor base + shield + other AC bonuses
```

Dexterity is not added.

## Initiative

Initiative is a Dexterity check, not a Dexterity saving throw.

```text
Initiative modifier
= effective Dexterity modifier
+ initiative-only equipment bonuses
+ optional initiative-only sheet bonus
```

Do not add Dexterity saving-throw proficiency, all-save bonuses, or Dexterity-save bonuses.

The one-off Advantage control may still apply to the next Initiative roll because it modifies the roll itself rather than the modifier.

## Passive Perception

```text
Passive Perception = 10 + Wisdom (Perception) check modifier
```

Then apply:

- `+5` when the creature has Advantage on Wisdom (Perception) checks;
- `-5` when the creature has Disadvantage;
- `0` when Advantage and Disadvantage cancel.

## Regression examples

The executable validator `scripts/validate_character_sheet_rules.mjs` protects these examples:

- Pip: no armor, Dexterity 12 (`+1`) → AC 11.
- Varges: Barbarian, no armor, Dexterity 14 (`+2`) and Constitution 16 (`+3`) → AC 15.
- Monk example: no armor, Dexterity 18 (`+4`) and Wisdom 16 (`+3`) → AC 17.
- Letho: Studded Leather 12 + Dexterity `+5` → AC 17.
- Raska: Chain Mail 16 + Shield 2 → AC 18.
- Aurelia: Scale Mail 14 + Dexterity `-1` + Shield 2 → AC 15.
- Initiative with Dexterity `+1`, gear `+2`, and sheet `+1` → `+4`; saving-throw proficiency is irrelevant.
- Passive Perception with Perception `+4` → 14 normal, 19 with Advantage, and 9 with Disadvantage.

## Safe-change checklist

Before changing formulas:

1. inspect `CharacterSheet5e.js`, `characterSheetRules.js`, and the shared equipment pipeline;
2. preserve the active encounter snapshot boundary;
3. add or update pure formula tests;
4. register the validator in the production suite;
5. verify equipped and unarmored characters in the browser;
6. do not persist computed equipment overlays into `character_sheets.sheet`;
7. do not touch world-map or town/city-map behavior.

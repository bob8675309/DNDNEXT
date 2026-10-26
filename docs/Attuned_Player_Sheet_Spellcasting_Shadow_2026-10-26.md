# Player Sheet Spellcasting Attunement Shadow — 2026-10-26

**Status: draft, diagnostic-only. No live spell rolls, sheets, casting records, or encounter spells are changed.**

## Existing source contract

`utils/characterSheetActions.js` currently constructs a quick-action spell attack or save using the assigned `character_spells` row and its `spells_catalog` entry. The original function `spellAction` computes:

- `castingAbility`: assignment `casting_stat` first, then `sheet.spellcasting.ability`, then `sheet.meta.spellcastingAbility`.
- `attackBonus`: valid numeric `attack_bonus_override` if present; otherwise eligible casting modifier + proficiency bonus.
- `saveDc`: valid numeric `save_dc_override` if present; otherwise 8 + eligible casting modifier + proficiency bonus.
- Cantrips appear even when `prepared=false`; unprepared leveled spells do not appear unless `always_available` is true. Spell damage dice and healing, pact-slot display, assignment use counters, ranges and descriptions are independent of the attack/DC ability arithmetic in this builder.

The current player quick-action builder **does not** consume stored `sheet.spellcasting.spellAttackBonus` or `spellSaveDc`, and does not include all possible magic-item spell attack/DC enhancement sources. The printable sheet, tactical spell APIs and some stored spell overrides follow other paths; this draft cannot certify their correctness.

## New pure comparison

`compareAttunedPlayerSheetSpells` in `utils/attunedPlayerSheetSpellShadow.js` runs the **unchanged** original `buildCharacterSheetActions` for the same character, spells, proficiency and sheet twice: once with the server-derived character equipment **baseline** ability modifiers and once with the source-selected **shadow** effective modifiers from the stacked private ability projection.

The input must include a matching character ID, `schemaVersion=1`, coherent campaign ON/OFF values, and diagnostic-only flags from the source and ability snapshots. These checks are consistency guards, **not authentication**: browser-provided lookalike objects must never grant real spell effects.

When attunement OFF, the comparison returns the original quick-action spell output **exactly**, even with no saved attunement item choices or populated shadow ability scores. When ON:
- Spell attack and saving throw DC changes derive solely from the eligible casting ability modifier and existing proficiency formula;
- A valid explicit per-spell attack or save override stays unchanged, including zero. Since the override can come from different rules or manual values, the comparator marks its **origin unverified**, not necessarily magical or wrong;
- An invalid nonnumeric override preserves the legacy fallback and is reported separately;
- Identity, grouping, spell preparation, damage dice, healing, pact slots, resource-use display, range, and nonspell class-feature actions remain as the original builder provides;
- Missing/unknown casting-stat keys and stored `spellAttackBonus`/`spellSaveDc` values ignored by quick actions are explicitly reported;
- Duplicate visible spell identities or source/character mismatch fail closed rather than silently pairing different spells.

Every ON response reports `consumerEnforced=false`, `sheetSpellParityReady=false`, `tacticalSpellParityReady=false`, `equipmentSpellBonusProvenanceVerified=false`, `spellDamageRidersVerified=false`, `spellAssignmentProvenanceVerified=false`, and `serverRestOpportunityVerified=false`. No source proof or actual consumer readiness should be inferred.

## Executable regressions

The new Node 22 test runs alongside `validate_player_sheet_actions.mjs` and the prior weapon shadow regression. It covers:

- Warlock/Pact: Eldritch Blast baseline +7 versus proposed +5 after eligible CHA changes, Sacred Flame-like DEX save DC15→13, Witch Bolt with its 2 level-3 Pact slots preserved;
- Explicit numeric overrides +11 attack and DC19, **zero** attack/DC overrides, invalid text override falling back to ordinary ability math, and origin audit;
- Prepared and unprepared leveled spells, unprepared cantrips, healing dice/limited uses and unchanged spell summaries;
- Wizard INT and a per-spell WIS assignment overriding the class default casting stat;
- Unknown casting ability reported rather than assumed valid;
- Nonspell Rage feature unchanged; input assignments not mutated;
- OFF exact canonical output without attunement choices; duplicate/mismatched character identities and malformed projected abilities fail closed.

The workflow prevents this module from being imported by the live character sheet, NPC panel, tactical combat page or action builder. These are *source-level and pure-logic* tests, not signed-in browser acceptance.

## Remaining gates

1. Server-side provenance for `character_spells` assignments and explicit attack/DC overrides; verify whether overrides include magic item contributions and whether they should respond to attunement.
2. Magic item direct spell attack/DC bonuses, focus items, spell effect riders, casting-stat exceptions, action/resource consequences and concentration.
3. **Tactical** spell profile/attack/save RPCs and active encounter snapshot semantics; these are separate authoritative consumers.
4. Printable and character profile spell stats, UI roll logs and canonical effect normalizer/source catalog parity.
5. Shared-account item custody, rest authorization on the server, signed-in player/admin acceptance and regression across multiple characters.

No production merge, Supabase schema/data change, world/town map, Forge, inventory drag/drop or live character-sheet behavior is performed by this patch.

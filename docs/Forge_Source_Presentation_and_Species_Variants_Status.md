# Forge Source Presentation and Species Variants — Status

Status date: 2026-08-11
PR: #170 (`agent/character-forge-resilience-presentation`)
Validated code head: `6106eea26f5de0f43b435a1d41563b8549daeb95`
Database authority: `20260811062025 genasi_subrace_catalog` (migration 91) deployed.
Database changes in this continuation pass: none.
Merge status: open/unmerged; merge only after explicit user approval.

## Scope

This continuation is limited to Character Forge source presentation across Species, Background, and Class. It does not modify or authorize world-map, town/city-map, route/travel/weather, tactical combat, crafting, inventory, merchant, or unrelated NPC runtime behavior. `components/MapPageClient.js` remains protected and untouched.

## Live catalogue audit before implementation

The live Supabase catalogue was re-audited before patching instead of assuming the previous handoff prose was complete.

### Species

- 164 live Species rows.
- Zero blank descriptions.
- Five stored descriptions contain raw 5etools markup: four MPMM Genasi child rows plus Custom Lineage.
- The four Genasi child rows are intentionally grouped beneath the parent in the Forge.
- Custom Lineage exposed a shared formatter defect: `{@5etools feat|feats.html}` used an alphanumeric tag name while the fallback formatter recognized alphabetic tag names only.

`utils/playerFacingText.js` now accepts alphanumeric source tag names and removes pipe-delimited internal targets, so that example renders as ordinary `feat` text rather than source syntax.

### Background

- 161 live Background rows.
- Zero blank descriptions.
- Zero raw 5etools markup tokens in stored descriptions.
- Live raw Background source structures use the existing `entries`, `section`, `inset`, `list`, `item`, and `table` families.

No Background-specific database or one-off content patch was justified. Existing presentation continues to keep mechanical source table/list rows organized while suppressing optional/random flavor-generation tables.

### Class

- 30 live Class rows.
- 2,118 live Class feature rows.
- 75 Class feature rows have a blank flattened `description`, but all 75 retain structured `entries`; zero rows are both blank and structureless.
- The five blank class summaries are legacy/sidekick/UA catalogue records: EFA Artificer, Expert Sidekick, Spellcaster Sidekick, Warrior Sidekick, and Mystic.

Recursive live `class_feature_catalog.entries` contain:

- `entries` — 1,178;
- `refSubclassFeature` — 1,052;
- `refOptionalfeature` — 306;
- `table` — 284;
- `list` — 184;
- `item` — 118;
- `options` — 76;
- `refClassFeature` — 64;
- `abilityDc` — 32;
- `abilityAttackMod` — 26;
- `inset` — 20;
- `quote` — 10;
- `refFeat` — 4;
- `statblock` — 2.

This identified the remaining shared Class presentation gap: detailed Class features already preserved exact source `entries`, but reference/formula/options/quote/statblock nodes could render incompletely despite valid source data.

## Shared Class/source renderer correction

`components/SourceRuleContent.js` remains the single shared source renderer. It now explicitly handles:

- paragraphs;
- named sections;
- `item` and `itemSpell`;
- nested entries/insets;
- lists;
- tables with captions/headers/rows/footnotes;
- `refClassFeature`;
- `refSubclassFeature`;
- `refOptionalfeature`;
- `refFeat`;
- `statblock` references;
- `abilityDc` formulas;
- `abilityAttackMod` formulas;
- source `options` and their choose count;
- source `quote` blocks.

When the Class guide supplies its existing detail callback, reference labels route into the established canonical/fallback detail resolver. No second Class rules authority was created. `ClassFeatureText` and `NpcForgeClassGuide` continue to pass exact `class_feature_catalog.entries`.

## Compact persistent Species choices

`components/NpcForgeEmbeddedSourceChoices.js` no longer repeats long rich option descriptions inside every choice button when the same mechanics are already available in selected detail metadata. The initial button stays compact; `SelectedOptionDetail` remains the full comparison/result surface after selection.

This improves Tiefling Fiendish Legacy, Goliath Giant Ancestry, Genasi Elemental Lineage, and Dragonborn ancestry choices without changing their stored option keys/descriptions/metadata.

### Tiefling — Fiendish Legacy

The XPHB source still produces Abyssal, Chthonic, and Infernal packages with their row-specific resistance and level 1/3/5 spells. Buttons are concise, while the selected package retains the full source row.

### Goliath — Giant Ancestry

All six XPHB options remain source-owned: Cloud's Jaunt, Fire's Burn, Frost's Chill, Hill's Tumble, Stone's Endurance, and Storm's Thunder. Their full mechanics remain available after selection without making the initial six-button grid a wall of text.

## Genasi — selected lineage presentation projection

The existing family remains one MPMM Genasi parent plus Air/Earth/Fire/Water child rows restored by migration 91.

The continuation adds a **display-only projection** from the currently selected source-choice option into the right-hand Species information panel. It may update displayed movement, size, darkvision, creature type, and child-specific trait cards from the selected child row.

It does not replace or rewrite:

- the persisted parent Species ID/name/source;
- the source-choice key;
- the save payload;
- Species magic authority.

Example: Water Genasi keeps the parent Genasi identity while the information panel shows Water movement/traits, including swimming movement, rather than generic or Air-lineage detail.

Species-granted magic remains owned by the Spells step/source-magic system.

## Dragonborn — FTD Gem projection without XPHB leakage

The creation flow remains one XPHB Dragonborn parent selector with ten standard XPHB colors plus five explicitly labeled FTD Gem choices.

The audit found a real presentation mismatch: selecting an FTD Gem option could show the Gem selected-detail card while the surrounding Species panel still showed XPHB-only Dragonborn cards such as XPHB Damage Resistance, Darkvision, and Draconic Flight.

The same display-only projection bridge now uses the FTD Gem family presentation for an FTD Gem selection while retaining the unified parent identity and Draconic Ancestry selector.

For a Gem selection the surrounding panel can show the FTD Gem source traits, including Draconic Resistance, Psionic Mind, Gem Flight, and the Gem-family Breath Weapon, while removing incompatible XPHB-only Damage Resistance/Draconic Flight/Darkvision presentation when the FTD family does not provide them.

Standard XPHB color selections do not use the Gem projection and retain the ordinary XPHB parent presentation.

This is presentation grouping only, not a rules merge or persistence rewrite.

## Other potential Species families

The live catalogue was checked for other parenthetical/subtype rows. Remaining candidates are largely setting/source-specific variants such as Kaladesh/Zendikar/Ixalan/Innistrad rows, plus Deep Gnome and Dankwood Goblin. They were intentionally **not** collapsed into generic parents because that would blur distinct source/setting rules rather than clarify a true nested ancestry decision.

Existing source-owned choices such as Elven Lineage and Gnomish Lineage continue through their established structured-choice path.

## Validation

`scripts/validate_forge_source_presentation.mjs` now checks:

- explicit renderer coverage for the live Class source-node families;
- compact rich-choice buttons with full selected detail preserved;
- alphanumeric `5etools` tag cleanup;
- Water Genasi selected presentation;
- unchanged persisted Genasi parent identity;
- no cross-lineage Genasi trait leakage;
- FTD Gem Dragonborn selected presentation;
- no XPHB Damage Resistance/Draconic Flight/Darkvision leakage into the FTD Gem presentation;
- ordinary XPHB Dragonborn presentation for standard colors;
- existing Background mechanical/random-table policy;
- Genasi importer/migration guards;
- protected map/travel boundaries.

The Forge workflow now watches `NpcForgeContextPanel.js` and `playerFacingText.js` in addition to the existing source-presentation files.

## Validated code checkpoint

Code commit:

`6106eea26f5de0f43b435a1d41563b8549daeb95` — `Tighten Forge source and species variant presentation`

It is one fast-forward commit from the previous accepted head and changes exactly seven files:

- `.github/workflows/validate-forge-source-presentation.yml`;
- `components/NpcForgeContextPanel.js`;
- `components/NpcForgeEmbeddedSourceChoices.js`;
- `components/SourceRuleContent.js`;
- `scripts/validate_forge_source_presentation.mjs`;
- `utils/playerFacingText.js`;
- `utils/speciesVariantFamilies.js`.

No SQL/migration/map/combat/crafting/inventory file changed.

### Exact-head CI result

For `6106eea26f5de0f43b435a1d41563b8549daeb95`:

- **33/33 PR-triggered GitHub workflows completed successfully**;
- `Validate Forge source presentation` passed its focused contract and production build;
- `Validate PR170 browser smoke corrections` passed its contract and production build;
- NPC Forge, nested choices, source magic, equipment, progression, runtime, portrait, currency, Artificer, and related PR gates all completed successfully.

The documentation reconciliation commit that follows this tested code head is prose-only. The tested code checkpoint remains `6106eea...`.

## Live database state

No Supabase write was necessary for this continuation. Live authority remains:

`20260811062025 genasi_subrace_catalog`

Migration 91 remains the latest production migration. This pass did not change characters, sheets, spells, progression, inventory, locations, routes, encounters, maps, or campaign state.

## Focused signed-in browser re-smoke

On a deployment containing `6106eea...` or a later code-identical descendant, verify:

1. Tiefling Fiendish Legacy uses compact Abyssal/Chthonic/Infernal choices and selected detail shows the coherent resistance + level 1/3/5 package.
2. Goliath Giant Ancestry keeps six compact choices and selected detail shows the full chosen mechanic.
3. Genasi appears once with Air/Earth/Fire/Water Elemental Lineage options.
4. Changing Genasi lineage updates the surrounding Species information cards/facts immediately.
5. Water Genasi shows swimming movement correctly.
6. Dragonborn exposes ten XPHB colors plus five clearly labeled FTD Gem options.
7. Selecting an FTD Gem option shows the FTD Gem-family surrounding mechanics and leaves no XPHB-only Darkvision/Damage Resistance/Draconic Flight cards behind.
8. Returning to a standard XPHB color retains/restores normal XPHB Dragonborn information.
9. Custom Lineage Feat text contains no visible `{@5etools ...}` or `|feats.html` syntax.
10. Representative Class features containing references, source options, ability DC/attack formulas, quotes, and statblock references display readable content rather than empty headings.
11. Background mechanical tables/lists remain organized and optional/random flavor-generation tables remain excluded.
12. Existing Species skill routing remains in Training and Species magic remains in Spells.

## Merge rule

PR #170 remains open. Before merge:

- confirm a deployment containing the validated code;
- complete the focused signed-in browser re-smoke;
- perform final live migration/ACL/residue checks;
- obtain explicit user approval to merge.

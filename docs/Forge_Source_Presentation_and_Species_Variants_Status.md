# Forge Source Presentation and Species Variants — Status

Status reconciled: 2026-09-15

Historical implementation chain:

- PR #170 — merged at `599c4de7397ba6e4bbbb0a061d551d80c3570be7`;
- PR #171 — Species artwork/presentation continuation — **merged** at `ed93331b946dffee1e63183e969f115d0c8a1a18`.

The former “PR #171 open/unmerged” merge gate is obsolete. Current `main`, live Supabase, and current Forge source are authoritative.

## Scope

This ledger covers source presentation across Species, Background, and Class. It does not authorize world-map, town/city-map, route/travel/weather, tactical combat, crafting, inventory, merchant, economy, or unrelated runtime changes. `components/MapPageClient.js` remains protected outside explicit world-map work.

## Durable source-presentation architecture

The Forge should render rich imported source structures without creating duplicate mechanical authority.

Key rules:

- preserve exact source/catalogue identity and structured entries;
- use shared source rendering rather than one-off hardcoded prose when data already exists;
- compact initial choice controls may defer long mechanics to selected-detail surfaces;
- display projection may change what the information panel shows after a choice without rewriting the persisted source identity;
- source choices remain owned by the existing source-choice contexts and save/creation/progression authority;
- spell-centric source benefits remain routed through the Spells/source-magic system;
- presentation grouping must not merge rules from incompatible source families.

## Shared source renderer

`components/SourceRuleContent.js` is the shared structured-source renderer. It supports the imported structure families needed by Class/Background/Species content, including paragraphs/entries, sections, lists, tables, items, source references, options, ability DC/attack formulas, quotes, and statblock/reference labels.

When detail callbacks are available, references should route into the established detail resolver rather than creating a new Class/feature authority.

Do not flatten valid structured source data merely because a pre-flattened `description` is blank.

## Compact persistent Species choices

`NpcForgeEmbeddedSourceChoices` and related detail presentation keep initial option controls compact while retaining the complete selected mechanics in the detail surface.

This pattern is appropriate for source-owned persistent choice families such as:

- Tiefling Fiendish Legacy;
- Goliath Giant Ancestry;
- Genasi Elemental Lineage;
- Dragonborn ancestry;
- similar current source-choice families.

The option key/metadata/save contract remains source-owned.

## Display-only Species projection

Some parent-persisted family choices project selected child/source detail into the right information panel.

Examples:

### Genasi

Selecting Air/Earth/Fire/Water may project child movement/traits/facts into the information panel while preserving the parent Genasi identity and existing source-choice key. Species-granted magic remains owned by Spells.

### Dragonborn

Gem ancestry presentation must show the correct Gem-family traits and avoid leaking incompatible XPHB-only presentation. Standard XPHB ancestry choices retain their appropriate parent rules presentation.

This is display projection, not a rules/persistence merge.

## Species/source variants

A setting/source child that exists as a real catalogue row keeps its own database ID, source, mechanics, source-choice groups, and persistence identity even when visually nested beneath a semantic parent.

Parent-persisted lineage choices and real source-row children are different models. Do not conflate them.

## Background source presentation

Background source grants/choices should stay source-derived. Structured list/table content can remain organized while optional/random flavor-generation material may be deemphasized according to the accepted Background presentation.

When a variable Background choice resolves in Training or Spells, the Background panel should explain that routing rather than creating a competing chooser.

## Class source presentation

Class feature rows may carry rich `entries` even when flattened summary text is blank. Render the preserved source structure and route references through existing detail authority.

Class presentation must not create a parallel subclass/feature eligibility or persistence system.

## Database-history note

The 2026-08 implementation period referenced catalogue/migration checkpoints in the low 90s. The live migration ledger has since advanced to **214 rows**, latest `20260814161314 grim_hollow_heritage_catalog_support`.

Historical row counts/migration IDs in older evidence documents remain useful provenance but are not the current database ceiling.

## Current acceptance stance

Source presentation across Species/Background/Class is mature. Prefer auditing live/source data and reproducing a concrete presentation defect before adding hardcoded exceptions.

## Validation expectations

When extending source presentation:

- preserve exact source identities and serialization keys;
- preserve source-choice ownership;
- verify parent/child display projection does not alter persisted identity;
- verify spell routing remains in Spells/source-magic authority;
- test representative structured entries/references/formulas/options/tables;
- run current Forge/source-presentation validators;
- verify no unrelated system boundary is crossed.

## Protected boundaries

No world-map, town/city-map, route/travel/weather/camp/clock, tactical, crafting, inventory, merchant, economy, or unrelated runtime work is authorized by this ledger.

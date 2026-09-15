# Forge Species Family Submenus — Status

Status reconciled: 2026-09-15

Historical implementation chain:

- PR #170 — merged at `599c4de7397ba6e4bbbb0a061d551d80c3570be7`;
- PR #171 — Species artwork/presentation continuation — **merged** at `ed93331b946dffee1e63183e969f115d0c8a1a18`.

The former “PR #171 open/unmerged” merge gate in this document is obsolete. Current `main`, current Species source-choice code, and live Supabase are authoritative.

## Purpose

The Species browser distinguishes three different concepts without creating parallel Forge state:

1. persistent lineage/subrace/family choices that substantially change one Species presentation;
2. full alternate Species rows from another setting/source that may be visually nested under a familiar parent while retaining their own rules/source identity;
3. narrower trait-level choices that remain inside the Species feature/runtime surface.

## Parent-persisted family choices

### Genasi

Genasi exposes Elemental Lineage with Air, Earth, Fire, and Water. The Genasi parent remains the persisted identity while the selected lineage projects movement/traits. Species-granted magic remains owned by the Spells step.

### Dragonborn

Base Dragonborn exposes ancestry choices through the established source-choice authority. Standard and Gem ancestry presentations must project the correct source package without mixing incompatible family rules. Do not replace source-owned ancestry state with artwork/UI-only state.

### Aven

Aven exposes Hawk-Headed and Ibis-Headed subrace presentation sourced from the restored catalogue data. The Forge presents one Aven family while preserving the source-choice/persistence model.

## Existing source choices promoted into the family UI

### Elf

Elven Lineage presents Drow, High Elf, and Wood Elf through the existing lineage field. Related spellcasting/source fields remain separately available where required.

### Gnome

Gnomish Lineage presents Forest Gnome and Rock Gnome through the existing lineage field.

### Shifter

Shifting Form presents Beasthide, Longtooth, Swiftstride, and Wildhunt through the existing source field.

### Fairy / Kithkin

Lorwyn/Shadowmoor presentation uses the established standalone Species-variant source-choice bridge rather than inventing a second persistence path.

## Setting/source variants

Setting/source children remain real catalogue rows when the database models them as separate Species. Visual nesting must not merge their source/rules identity into the modern parent.

Examples historically grouped under familiar parents include Human, Dwarf, Elf, Orc, Minotaur, and Goblin setting/source variants. Always inspect current catalogue visibility before assuming every historical child is still shown; presentation policy has changed over time (for example, Zendikar Elf was later intentionally removed from the Forge display).

Selecting a true source child must continue through the normal Species row selection path so its own database ID/source/mechanics remain authoritative.

## Species intentionally independent

Name similarity is not enough reason to collapse a Species. Independently published rows such as Astral Elf, Sea Elf, Eladrin, Shadar-Kai, Duergar, Deep Gnome, and similar entries remain top-level unless current source explicitly groups them.

## Trait-level choices remain inline/runtime appropriate

Examples:

- Goliath Giant Ancestry remains a trait-level Species choice;
- Tiefling Fiendish Legacy remains a trait package;
- Aasimar transformation is not a permanent catalogue subtype merely because it offers multiple forms;
- Simic Hybrid adaptations and similar choices keep their existing lifecycle authority.

Do not promote rest-configurable or per-use choices into permanent Species identity merely to match the visual family pattern.

## Implementation authority

Family expansion/presentation remains centralized in the existing Species catalogue expansion/menu helpers and source-choice contexts. Durable invariants:

- source-choice context owns parent-persisted family selections;
- existing serialization field IDs remain stable;
- setting/source children remain real rows;
- the right information panel may suppress only the field promoted into the left family UI while preserving sibling choices;
- selected-variant projection remains presentation of existing authority, not a second save path;
- no new controller/save/RPC/progression/runtime authority should be introduced for presentation convenience.

## Database history note

This feature family was built across migrations including restored Genasi/Aven source detail/catalogue work. The live migration ledger is now **214** rows with latest registered migration `20260814161314 grim_hollow_heritage_catalog_support`. Old “migration 93” wording in the historical implementation period is evidence for that time, not the current database ceiling.

## Current acceptance stance

The Species tab is mature. Preserve the family/child behavior unless a concrete browser/runtime defect is reproduced or Paul explicitly requests new Species presentation work.

## Protected boundaries

Species-family work does not authorize changes to world-map behavior, town/city-map behavior, route/travel/weather/camp/clock systems, tactical combat, crafting, inventory, merchants, economy, or unrelated runtime systems.

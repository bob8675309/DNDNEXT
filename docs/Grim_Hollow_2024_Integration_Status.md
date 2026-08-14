# Grim Hollow 2024 Integration Status

Updated: 2026-08-14

## Scope

This continuation adds the 2024-compatible Grim Hollow Player's Guide material requested for Character Forge use without touching world-map, town/city-map, travel, combat, crafting, merchant, or inventory behavior.

Authoritative source identifier: `GrimHollowPG24` (`Grim Hollow: Player's Guide (2024)`). The live import was verified against the pinned TheGiddyLimit/homebrew commit `3df4dd3910d5ec8efac18a5c513a537e014b2719`; the pinned payload and current upstream payload were byte-for-byte identical at import time (MD5 `0b0a6c9f9497d82dcca37ea0f46d0154`).

## Live Supabase catalogue

The live `ucggczovhmauhshvhusx` project now contains:

- 9 Grim Hollow Origin feats.
- 14 Grim Hollow General feats. The structured source contains both General and Fighting Style forms of Advanced Weapon Proficiency, so the structured catalogue has one more General feat than the chapter summary list implies.
- 7 Grim Hollow Fighting Style feats.
- 12 Grim Hollow Epic Boons, stored with `option_type = boon` and category `EB`.
- 107 Heritage Traits: 48 Combat, 28 Exploration, and 31 Roleplaying.
- Monster Hunter as a 2024 class with all 20 progression rows.
- 22 Monster Hunter base-class feature rows.
- Four guilds: Carver, Devourer, Occultist, and Trapper.
- 29 Monster Hunter subclass-feature rows across those four guilds.
- 36 Monster Hunter optional-feature rows: 13 Monster Grimoire specializations, 11 Devourer mutations, 6 Trapper gadgets, and 6 Trapper armor modifications.

The character-option catalogue now permits `heritage_trait` as an option type. `import_character_option_batch_v1` accepts the same type so future admin imports do not disagree with the table constraint.

A private `flatten_5etools_entries_v1(jsonb)` helper was added for source-backed imports. The PostgreSQL `http` extension was enabled so the authoritative structured source could be imported directly without copying or inventing rules text.

## Custom Lineage

Tasha's `Custom Lineage` retains its original rules package and now offers a second rules mode:

- **Standard Custom Lineage** — original TCE Feat plus Variable Trait behavior.
- **Heritage Custom Lineage** — replaces the TCE mechanical package with exactly eight Grim Hollow Heritage Trait picks.

The two packages do not stack.

The Custom Lineage Species catalogue row carries a compact `heritageTraitCatalog` built from the canonical `heritage_trait` rows. `utils/playerForgeSpeciesChoices.js` consumes that catalogue through the existing Species source-choice authority; it does not introduce a parallel React state or save path.

Each Heritage pick is stored as a stable catalogue key. A normal trait may be selected up to its source-defined repeat limit (normally twice, with improved-trait naming preserved in metadata); source text that explicitly supports additional selections is recorded with the higher repeat allowance. `utils/playerForgeSourceChoices.js` enforces the group repeat limits during selection and completeness validation.

No Grim Hollow ability-score increase is added by the Heritage mode. DNDNext continues to use the site's existing 2024 Origin/background ability-score flow, preventing double-dipping.

## Setting-specific Human overlays

The underlying imported Species rows are preserved. DNDNext adds a homebrew `metadata.heritageProfile` overlay to the setting-specific Human variants so their source identity remains intact while their campaign presentation can differ mechanically.

Current fixed eight-pick profiles:

- **Human (Innistrad)** — Brave, Hunter's Instinct, Relentless Endurance, Darkvision, Even in Sleep, Keen Survivor, Moved by Faith, Inborn Perception.
- **Human (Zendikar)** — Burst of Speed, Climber, Environmental Awareness, Natural Movement, Standing Leap, Keen Survivor, Inborn Perception, Athlete's Spirit.
- **Human (Ixalan)** — Swimmer, Hold Breath, Environmental Awareness, Driver, Weapon Aptitude, Keen Survivor, Polyglot, Persuasive Knack.
- **Human (Kaladesh)** — Artifice Expertise, Driver, Artisanal Focus, Crafter's Eye, Impromptu Artisan, Magical Insight, Magical Savvy, Skill Prowess.

Each overlay is explicitly marked `homebrew: true`, `system: GrimHollowPG24`, and `mode: traditional-fixed`. Standard PHB/XPHB Human rows were not overwritten.

## Monster Hunter

The imported Monster Hunter class uses source `GrimHollowPG24`, ruleset `2024`, d10 Hit Die, Dexterity and Intelligence saving throws, and preserves the structured primary-ability rule in the raw payload (Strength + Intelligence or Dexterity + Intelligence).

Progression imported through level 20 includes Monster Grimoire and Weapon Mastery at level 1, Fighting Style and Studied Response at level 2, Guild choice at level 3, Expert Strike at 5, Improved Monster Grimoire at 6 and 13, Knowledgeable Defense at 9, Extra Attack at 11, Lair Sense at 14, Slayer's Aid at 17, Epic Boon at 19, and Grave Strike at 20.

Monster Grimoire choice nodes are materialized in the canonical `class_feature_catalog.entries` while the untouched source payload remains in `raw_payload`. This lets the existing generic class-choice parser present the 13 creature-type specializations at level 1 and the additional choices at levels 6 and 13 instead of introducing a Monster-Hunter-only state system.

The four Guilds and their source features are stored in the existing subclass representation inside `class_feature_catalog`.

## Feat and Boon audit

The structured source contains 42 feat records total:

- Origin: 9
- General: 14
- Fighting Style: 7
- Epic Boon: 12

The chapter summary lists Advanced Weapon Proficiency under Fighting Style, while the structured source also includes a distinct General form (`Advanced Weapon Proficiency (G)`). DNDNext imports both structured records rather than silently dropping the General form.

Epic Boons remain `option_type = boon`, so they use the site's existing Boon catalogue/known/runtime architecture rather than being mixed into ordinary feat rows.

## Validation checkpoint

Code head after the Custom Lineage source-choice work: `4fb5fa57ea948dcf44aba3e7972a4835d2e00853` before this documentation commit.

All 15 GitHub workflows triggered for that exact code head completed successfully, including the NPC Forge foundation, nested-choice, Forge source-presentation, Player Forge source-magic-routing, character progression, Species runtime, and Eladrin/Astral Trance suites.

PR #171 remains open and unmerged. Do not merge until the user explicitly approves it.

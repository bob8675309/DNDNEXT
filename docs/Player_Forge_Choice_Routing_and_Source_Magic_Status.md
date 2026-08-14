# Player Forge Choice Routing and Source Magic — Status

Status: **implemented; migrations 86-88 deployed and rollback-accepted; post-rest presentation follow-up completed by migration 89.** PR #170 is historical/merged; current interactive follow-up belongs to PR #171 or a later dedicated continuation.

## Player-facing routing model

The Forge distinguishes where a feature is explained from where its mechanical decision is resolved:

- **Species** — identity, lore, and feature explanations;
- **Background** — formative history and source-owned grants;
- **Class** — class/subclass explanation and progression preview;
- **Abilities** — score generation and allocation only;
- **Training / Skills & Proficiencies** — skills, Expertise, tools, professions, and similar training;
- **Training / Feats & Class Abilities** — feats, Invocations, Artificer plans, and persistent class/feature option families;
- **Spells** — class spells plus spell-centric Species/Feat/Background/Class-feature decisions;
- **Review** — manual decisions and automatic source-policy resolutions.

## Species behavior

### Fixed languages

Species-provided fixed languages are source authority rather than being overwritten by the generic XPHB origin-language rule. Aven is the regression fixture: Common + Aven stays fixed and the player does not receive a generic additional two-language picker.

### Catalog lineage vs rules choices

The generic imported `Lineage / ancestry` selector is not player-facing. Genuine rules-bearing ancestry/lineage/legacy choices remain owned by their actual features.

### Species magic

The Species page explains the feature; spell/cantrip decisions resolve in Spells.

- **Astral Elf / Astral Fire** — Dancing Lights, Light, or Sacred Flame; best final permitted INT/WIS/CHA is resolved automatically.
- **Deep Gnome / Gift of the Svirfneblin** — Disguise Self at level 3 and Nondetection at level 5; best permitted final casting ability is automatic.

Astral Trance remains Long-Rest runtime authority rather than creation-time Species spell state.

## Background / Strixhaven behavior

A Strixhaven Student background fixes its college for Strixhaven Initiate. Witherbloom Student therefore exposes only Witherbloom source choices:

- two cantrips from Chill Touch, Druidcraft, and Spare the Dying;
- one level-1 Druid or Wizard spell;
- automatic best permitted INT/WIS/CHA casting ability.

The Witherbloom expanded spell list is access, not automatic knowledge/preparation.

## Training behavior

Training is split into:

1. **Skills & Proficiencies**
2. **Feats & Class Abilities**

Persistent option families such as higher-level advancement feats, Warlock Invocations, Artificer Magic Item Plans, Fighting Styles, Maneuvers, and Metamagic route into the second tab. The Class step remains primarily explanatory. Higher-level feat replay no longer appears on Abilities.

Content-heavy option families use searchable description-first presentation instead of context-poor dropdowns where practical.

## Unified Spells step

Spells is useful even when the base class is a noncaster. It can resolve source-owned Species, feat, Background-feature, and class/subclass-feature magic while preserving distinct provenance from ordinary class spell selection.

## Automatic casting ability policy

When source text permits multiple casting abilities but choosing a weaker permitted stat provides no gameplay benefit, the Forge uses:

1. highest modifier;
2. tied permitted class spellcasting ability;
3. highest raw score;
4. stable final tie order INT, WIS, CHA, STR, DEX, CON.

Imported source text is not rewritten; Review exposes the automatic result.

## Live source-magic authority

### Migration 86 — `player_forge_source_magic_materialization`

Materializes routed source magic into `character_spells` after source-owned feat/progression authority exists. Server checks canonical Species/feat ownership, source identity, preferred spell identity, source level, exact choice counts, legal spell lists, provenance, and recharge/free-use metadata.

### Migration 87 — `source_magic_level_parser_fix`

Additively corrects PostgreSQL-safe numeric level matching and choice-count whitespace parsing discovered by rollback QA.

### Migration 88 — `source_magic_feat_name_normalization_fix`

Additively aligns Magic Initiate and Strixhaven Initiate comparisons with the live canonical normalizer keys `magic initiate` and `strixhaven initiate`.

## Deployed rollback acceptance

Rollback-only fixtures proved:

- Astral Elf level 1 Sacred Flame with Species provenance and deterministic casting stat;
- Deep Gnome level 3 Disguise Self with grant level 3 and Long-Rest recharge;
- Deep Gnome level 5 Disguise Self + Nondetection with grant levels 3/5;
- Witherbloom Student with exactly two legal college cantrips + one legal level-1 Druid/Wizard spell and automatic casting stat;
- Magic Initiate with canonical spell-list validation, two cantrips + one level-1 spell, automatic permitted casting ability retained in server-required state, and Long-Rest free-cast recharge.

All fixtures rolled back. Protected production counts remained 7 characters, 7 sheets, 30 character-spell rows, 7 progression rows, 18 inventory rows, 20 locations, 4 routes, and 9 route points.

## Post-rest follow-up — completed

Migration 89 and `CharacterRestChoiceNotice` now provide the generic post-rest affordance requested after the routing pass. It is driven by unresolved runtime state rather than by a generic rest event:

- inactive/current-cycle choices such as Astral Trance can pulse for attention;
- persistent selections such as Wild Heart remain active and only appear as quiet optional replacements;
- optional post-rest actions are quiet/collapsed.

Rollback acceptance directly proved Astral Trance attention versus Wild Heart non-flashing persistence. Read `Pending_Rest_Runtime_Choices_Status.md`.

## Protected boundaries

No world-map, town/city-map, route/travel/weather, unrelated crafting/inventory, or tactical combat execution behavior is part of this slice.

## Current continuation

PR #170 is historical and merged. This routing/source-magic authority remains active beneath PR #171. Any new browser defect should be reproduced against the current PR #171 deployment; PR #171 remains open and must not be merged without explicit user approval.

# Player Forge Choice Routing and Source Magic — Status

Status: implemented on PR #170 branch; migrations 86-88 deployed and rollback-accepted; interactive browser smoke still required before merge.

## Why this pass exists

The August 9 Forge smoke showed that the rules engine often knew **what** a choice was, but the UI did not consistently distinguish **where the feature should be explained** from **where the decision should be resolved**. That produced noisy Species/Class pages, context-poor dropdowns, and spell/feat decisions appearing on mechanically unrelated steps.

This pass establishes the following player-facing routing model:

- **Species** — species identity, lore, and feature explanations;
- **Background** — formative history and source-owned grants;
- **Class** — class/subclass explanation and progression preview;
- **Abilities** — score generation and allocation only;
- **Training / Skills & Proficiencies** — skills, Expertise, tools, professions, and similar training;
- **Training / Feats & Class Abilities** — feats, Invocations, Artificer plans, and persistent class/feature option families;
- **Spells** — class spells plus spell-centric Species/Feat/Background/Class-feature decisions;
- **Review** — both manual decisions and automatic source-policy resolutions.

## Species behavior

### Fixed languages

Species-provided fixed languages are read from source rather than overwritten by the generic XPHB origin-language rule.

Regression fixture: **Aven**.

- PSA/PSD Aven source grants Common and Aven.
- The player Forge does not add the generic `Common + choose two Standard languages` rule to that source version.
- Fixed languages are represented as source-owned, automatically selected authority.

### Catalog lineage vs. rules choices

The generic imported `Lineage / ancestry` selector is no longer player-facing. It remains available to NPC mode where needed for administrative/catalog purposes.

This does **not** remove real rules-bearing choices such as a feature that explicitly asks the character to choose an ancestry, lineage, legacy, etc. Those remain owned by their actual feature.

### Species magic

The Species feature card explains the feature. Spell/cantrip selection is routed to Spells.

Regression fixtures:

- **Astral Elf / Astral Fire** — choose Dancing Lights, Light, or Sacred Flame in Spells; allowed casting ability is INT/WIS/CHA and the Forge automatically resolves the best final eligible ability.
- **Deep Gnome / Gift of the Svirfneblin** — no meaningless INT/WIS/CHA button choice. Disguise Self becomes available at level 3; Nondetection at level 5; the highest eligible final ability is used automatically.

Astral Trance is not treated as creation-time Species spell state. Its temporary proficiency choice remains in the existing guarded Long-Rest runtime system.

## Background / Strixhaven behavior

A Strixhaven Student background fixes its college for Strixhaven Initiate.

Example: **Witherbloom Student**.

- Background explanation is Witherbloom-specific.
- Other colleges are not presented as candidate decisions.
- The actual two-cantrip + one-level-1-spell decision is completed in Spells.
- Witherbloom cantrips are limited to Chill Touch, Druidcraft, and Spare the Dying.
- The level-1 spell must come from the Druid or Wizard list.
- The feat's INT/WIS/CHA casting ability is resolved automatically from final scores.
- The separate Witherbloom expanded spell list remains expanded access, not automatic knowledge/preparation.

## Training behavior

Training now separates:

1. **Skills & Proficiencies**
2. **Feats & Class Abilities**

Persistent class/source option families route into the second tab. The Class step remains primarily explanatory.

Current intended families include higher-level advancement feats, Warlock Invocations, Artificer Magic Item Plans, Fighting Styles, Maneuvers, Metamagic, and similar permanent decision catalogues. Existing source/prerequisite/acquisition authority is preserved.

Higher-level feat replay no longer appears as a context-poor dropdown on Abilities.

## Rich choice presentation

Content-heavy option kinds use a search/list/detail pattern rather than a bare select when practical. The Feats & Boons and Spellbook Profile panels are the interaction reference: the player can inspect name, source, description, prerequisites or structured spell details before choosing.

## Unified Spells step

Spells is no longer useful only when the base class has a normal starting spell model.

A noncaster can still receive and resolve:

- Species magic;
- feat magic;
- background-feature magic;
- class/subclass feature magic.

Class spell selection and source-owned magic remain separate authorities with distinct provenance.

## Automatic casting ability policy

For source text that permits a choice among abilities and where picking the weaker stat provides no gameplay benefit, the Forge uses a deterministic campaign usability policy:

1. highest modifier;
2. if tied, prefer the character's class spellcasting ability when it is permitted;
3. if still tied, highest raw score;
4. stable final tie order: INT, WIS, CHA, STR, DEX, CON.

This automation does not rewrite imported source text. Review shows the automatic result.

## Live source-magic authority

### Migration 86 — `player_forge_source_magic_materialization`

Adds private canonical helpers and a deferred progression trigger that materializes routed source magic into `character_spells` after the character's source-owned feat instances/progression authority exists.

Server checks include:

- exact Species owner and source;
- exact canonical Species feature;
- preferred spell identity;
- spell must actually be named by the Species source feature;
- source-level grant gating;
- exact choice count for choice-based Species magic;
- all currently eligible fixed Species spells for fixed grants;
- canonical feat grant instance for feat magic;
- existing Magic Initiate source validator;
- Strixhaven college-specific cantrip/list validation;
- source provenance in `character_spells`;
- Long-Rest free-cast/resource metadata where applicable.

Private helpers are not direct anon/authenticated RPC surfaces.

### Migration 87 — `source_magic_level_parser_fix`

Rollback QA caught two parser details before acceptance:

- JSON numeric level keys needed PostgreSQL-safe numeric matching;
- choice-count whitespace matching needed PostgreSQL-safe POSIX character classes.

The additive correction resolves Deep Gnome grant levels as 3 and 5 and Astral Fire choice count as exactly one.

### Migration 88 — `source_magic_feat_name_normalization_fix`

Rollback QA also confirmed the existing canonical name normalizer returns `magic initiate` and `strixhaven initiate` with spaces. Migration 88 additively replaces the trigger function with those live canonical comparison keys.

## Deployed rollback acceptance

After deployment, rollback-only fixtures proved:

- Astral Elf level 1: Sacred Flame, Species source, best eligible casting stat;
- Deep Gnome level 3: exactly Disguise Self, grant level 3, Long Rest recharge;
- Deep Gnome level 5: Disguise Self + Nondetection, grant levels 3/5, Long Rest recharge;
- Witherbloom Student: two valid Witherbloom cantrips + one valid level-1 Druid/Wizard spell, automatic best stat, level-1 free cast recharge;
- Magic Initiate: source validator passes canonical Wizard-list choices, two cantrips + one level-1 spell, automatic permitted casting ability retained in the server-required choice state, level-1 free cast recharge.

All fixtures rolled back.

## Production integrity after acceptance

- characters: 7
- character_sheets: 7
- character_spells: 30
- character_progression: 7
- inventory_items: 18
- locations: 20
- map_routes: 4
- map_route_points: 9
- QA86 residue: 0

## Protected boundaries

No world-map, town/city-map, route/travel/weather, unrelated crafting/inventory, or tactical combat execution behavior is part of this slice.

## Remaining presentation follow-up

A generic **pending runtime choice after rest** affordance is still desirable. It must be driven by actual unresolved runtime state rather than by a generic rest event.

It should notify/flash for features whose prior temporary state genuinely expires (for example Astral Trance and Bestial Soul) while avoiding false prompts for persistent-across-rest families such as Wild Heart Aspect, Hunter runtime choices, and Whispers of the Dead.

## Remaining acceptance

A real signed-in browser smoke is still required before merge. PR #170 remains open and must not be merged without explicit user approval.

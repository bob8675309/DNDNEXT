# Character Forge Training Browser-Review Implementation Checkpoint

Updated: 2026-08-21

Status: implemented on PR #176 (`agent/training-tab-redesign`) and ready for browser review. Do **not** merge until the visual/behavior acceptance pass is complete.

This document supersedes the implementation-status portions of `Character_Forge_Training_Browser_Review_2026-08-21.md`. The earlier document remains the approved requirements contract; this file records what was actually implemented and validated.

## Exact validated runtime checkpoint

- PR: #176 — `agent/training-tab-redesign`
- base: `main` at the accepted post-Background baseline
- exact validated runtime/validator head: `f660fe899722e34e1a72cb9333c623642633d84e`
- GitHub Actions: **15/15 triggered workflows passed** on that exact head
- exact Vercel deployment: `dpl_VZztopxT1b2W6ZqvjzT78ZgLtJt7`
- deployment state: `READY`
- exact preview host: `dndnext-ozve4lb9d-pauls-projects-2016aa54.vercel.app`
- branch alias: `dndnext-git-agent-training-tab-redesign-pauls-projects-2016aa54.vercel.app`

The green workflow set includes the focused Training redesign validator plus NPC Forge foundation, profession crafting source, Species/Human/Heritage, Species rest proficiency, Background source choices, nested Forge choices, source-magic routing, starting magic, starting equipment, character-scoped equipment, starting-equipment guard, portrait authority, Forge source presentation, and PR170 browser-smoke checks.

## Implemented browser-review changes

### 1. Player Training isolated from NPC Forge

`components/NpcForgeTrainingStep.js` is now a small router:

- NPC Forge continues to `NpcForgeTrainingStepBase`;
- Character Forge uses `NpcForgeTrainingStepPlayer`.

This prevents the player presentation redesign from silently changing NPC creation/service behavior.

### 2. Training presentation

Player Training now uses:

- one compact expandable `Skill & Training Selections` tally;
- an inline `Skills` section;
- an inline `Trade Skills` section;
- `Other Training Choices` only when unresolved source/feature choices genuinely remain;
- a compact `Feat & Class Choices` section;
- a sticky right-side `Current Selection` dossier.

The redundant visible `Training Picks` heading was removed.

Each major subsection exposes its own concise completion/provenance count on the right side of the heading.

### 3. Inline granted skills and source provenance

Background fixed skills, Background variable skill choices, and source-granted skill choices are rendered in the same Skills list rather than in a separate grant-chip block.

Rows distinguish:

- granted proficiency;
- paid Class Skill selection;
- unresolved Background/source choice availability;
- the source that granted or can grant the proficiency.

A Background/source-granted skill does not consume a paid Class Skill / Trade Skill choice.

### 4. Eight player Trade Skills

Character Forge now exposes these eight campaign proficiencies:

1. Alchemy ↔ Alchemist's Supplies
2. Smithing ↔ Smith's Tools
3. Scribe ↔ Calligrapher's Supplies
4. Enchanting ↔ Enchanter's Tools
5. Cooking ↔ Cook's Utensils
6. Tinkering ↔ Tinker's Tools
7. Jewelcraft ↔ Jeweler's Tools
8. Brewing ↔ Brewer's Supplies

`TRADE_SKILL_KEYS` is the player-facing eight-skill catalogue.

The existing `PROFESSION_KEYS` contract remains intentionally limited to the four currently implemented crafting-runtime/service disciplines:

- Alchemy
- Smithing
- Scribe
- Enchanting

Cooking, Tinkering, Jewelcraft, and Brewing are persisted player proficiencies now, but `runtimeEnabled: false` prevents this Forge work from pretending their dedicated recipe/workshop systems already exist.

### 5. Tool ↔ Trade Skill unification

`utils/craftingToolProfessions.js` derives mapped tool-to-Trade-Skill relationships from the eight player Trade Skill definitions.

For Character Forge:

- selecting a paid Trade Skill includes the mapped proficiency;
- a source-granted mapped tool grants the matching Trade Skill for free;
- a mapped source grant does not consume a second Training choice;
- if a player previously paid for a Trade Skill and then changes an earlier source so the same Trade Skill becomes granted, the controller excludes it from the paid allowance.

NPC workshop/provider discovery still uses only the four existing runtime professions and still requires explicit service authority. Merely being proficient does not make an NPC a crafter/storefront provider.

### 6. Skilled and mixed skill-or-tool source choices

The player Training resolver now understands source fields of kind:

- `skill`;
- `tool`;
- `skill-or-tool`.

This is important for feats such as Skilled. Skill options are routed into the inline Skills list; mapped crafting-tool options are routed into the inline Trade Skills list.

Other valid source options remain in the generic source-choice surface when they still need to be chosen.

### 7. Unsupported artisan-tool browser policy

The underlying imported source catalogue is not deleted or rewritten.

For a mixed player-facing source field that contains both supported mapped Trade Skills and unsupported generic Artisan's Tool choices:

- mapped Trade Skills are offered through the Trade Skill rows;
- unsupported artisan entries are suppressed from the generic player picker for this browser-review pass;
- non-artisan choices such as instruments, gaming sets, vehicles, languages, or other required tools remain available.

Safety rule: if a source field contains **only** unsupported artisan options, those options are left resolvable rather than creating a deadlocked character-creation step. Full expansion of those crafts belongs to the later crafting-system project.

### 8. Current Selection behavior

On the player Training step, the right-side `Current Selection` dossier is sticky while the Training choices scroll.

The dossier contains descriptions for all eight Trade Skills. The four future-facing skills explicitly state `Proficiency now • recipes later` rather than claiming unfinished crafting mechanics exist.

### 9. Species Origin Languages compaction

The player Species Origin Languages fact card and embedded two-language chooser were tightened with player-Species-only CSS:

- smaller summary footprint;
- reduced internal padding/gaps;
- two compact side-by-side language dropdowns on normal desktop widths;
- single-column fallback on narrow screens;
- existing selections and outside-click collapse behavior preserved.

### 10. Character Forge window reset gesture

The existing app-window reset event is reused; no second geometry system was introduced.

Player Character Forge supports:

- desktop double-click on a non-interactive part of the Forge header;
- touch/pen double-tap on the same top band.

Interactive header controls are excluded, so Reset/Close/buttons/inputs do not accidentally trigger geometry restore.

The gesture dispatches `dndnext:reset-app-window` with `scope: "forge"`, which targets Forge window geometry only. It does not reset browser zoom, page state, maps, or unrelated windows.

## Validation changes

`validate_training_tab_redesign.mjs` now validates the live isolated player Training component and explicitly guards:

- NPC fallback isolation;
- inline Skills and Trade Skills;
- absence of the rejected visible `Training Picks` heading;
- Background/source grant provenance;
- `skill-or-tool` routing;
- bounded source-choice presentation overrides;
- safe artisan suppression behavior;
- eight player Trade Skills;
- four-discipline crafting-runtime/service isolation;
- sticky Current Selection;
- compact Species languages;
- Forge header geometry reset;
- protected map boundaries.

Older cross-feature validators that historically inspected `NpcForgeTrainingStep.js` retain compatibility markers in the router, while the focused validator checks the actual player implementation.

The Species/Heritage validator was widened only enough to allow the informational reset-hint attribute on the `Character Forge` heading; the actual compact-header, Heritage, Human Versatile, and protected-boundary checks remain intact.

## Database / runtime scope

No Supabase migration or live database write was required for this browser-review follow-up.

This pass did **not** change:

- recipe tables or crafting formulas;
- material catalogues;
- crafting-attempt RPCs;
- merchants/storefronts/economy;
- inventory execution;
- tactical combat;
- world map;
- town/city map;
- travel/weather/camp/clock logic.

## Browser acceptance checklist

Before merging PR #176, verify at minimum:

- Species Origin Languages is visibly smaller and still selects exactly two additional languages;
- completed Species language choice collapses correctly after clicking outside;
- moving/resizing the Forge and then double-clicking the non-button header restores default geometry;
- Training has no redundant visible `Training Picks` heading;
- right Current Selection remains useful/sticky while scrolling Training;
- Background fixed skills appear inline as granted;
- a Background variable skill choice can be resolved from the Skills list;
- a mapped Background/feat/class tool choice can be resolved from the matching Trade Skill row without consuming a paid pick;
- all eight Trade Skills appear;
- Cooking/Tinkering/Jewelcraft/Brewing clearly read as proficiency-ready with dedicated recipes deferred;
- Charlatan/Skilled mixed `skill-or-tool` choices resolve without duplicate or hidden required work;
- Folk Hero or another mixed fixed+choice tool Background remains understandable;
- Bonus Feat catalogue selection and nested follow-up choices still complete normally;
- Continue correctly points the player toward any remaining required decision.

Suggested source-heavy cases: Athlete, Mist Wanderer, Clan Crafter, Rune Carver, Folk Hero, Charlatan/Skilled, Haunted One/Investigator, Rewarded/Ruined, and an Artificer/crafting-heavy character.

## Merge gate

PR #176 remains **unmerged** until the browser acceptance pass is approved. If a browser issue is found, patch the same branch, rerun the focused and triggered regression gates, and verify the exact-head Vercel deployment before merge.

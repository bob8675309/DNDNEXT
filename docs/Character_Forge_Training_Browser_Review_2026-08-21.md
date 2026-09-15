# Character Forge Training Browser Review Follow-up — 2026-08-21

Status reconciled: 2026-09-15

Classification: **historical browser-review requirements / acceptance evidence**.

This document records the user-approved Training/Species browser-review changes that were implemented during PR #176 (`agent/training-tab-redesign`). PR #176 is now merged. The checkboxes and “before requesting browser acceptance” language below were the acceptance gate at that historical checkpoint, not the current project TODO list.

For current Training status, use `Character_Forge_Training_Redesign_Status.md` plus current source/validators.

## User-approved changes from the 2026-08-21 review

### Species presentation

- Keep the Origin Languages chooser compact at rest while preserving the two-Origin-language rule and collapse behavior.
- Desktop double-click / touch double-tap on the non-interactive Forge top band may restore default Forge geometry; it must not trigger from normal buttons/inputs or attempt to control browser zoom.

### Training layout

- No redundant visible `Training Picks` intro when subsections already carry labels/tallies.
- Decisions stay on the left; the right `Current Selection` surface remains contextual/detail presentation.
- `Current Selection` should stay usefully visible while Training scrolls.
- Skills, Trade Skills, and Feat/Class sections expose their own local selected/granted/required state.
- Background/Class/source-granted skills and Trade Skills appear inline with provenance rather than duplicated grant-chip rows.
- The compact overall Training summary may remain, but local subsection tallies make each list understandable.

## Trade Skill expansion approved in this review

The player-facing target was eight mapped craft disciplines:

1. Alchemy ↔ Alchemist's Supplies
2. Smithing ↔ Smith's Tools
3. Scribe ↔ Calligrapher's Supplies
4. Enchanting ↔ Enchanter's Tools
5. Cooking ↔ Cook's Utensils
6. Tinkering ↔ Tinker's Tools
7. Jewelcraft ↔ Jeweler's Tools
8. Brewing ↔ Brewer's Supplies

A mapped tool proficiency and its Trade Skill are one campaign proficiency for Training accounting. Source-granted mapped tools must not consume a second paid Training choice; paid Trade Skill selection consumes the appropriate allowance and recognizes the associated tool proficiency.

Always inspect the current profession/tool mapping source before changing the list, because later crafting work may refine which disciplines are implemented.

## Unsupported-tool policy from this checkpoint

The long-term goal was a broader craft catalogue, but PR #176 deliberately did not expand the whole crafting runtime.

The accepted boundary was:

- supported artisan/craft tool choices should route through the mapped Trade Skill presentation;
- unsupported artisan craft options may be deferred/hidden from the generic player-facing craft picker without deleting source data;
- genuinely required non-crafting source tool/instrument/vehicle/etc. choices must remain resolvable through existing source-choice authority so creation cannot deadlock;
- this is presentation/routing policy, not a source-data rewrite;
- recipes, material formulas, craft attempts, storefronts, merchants, and economy remain separate projects.

## Feat presentation

- Keep the compact searchable Training feat catalogue.
- Keep the Feat/Class tally local to that subsection.
- Keep feat source/prerequisite/rule/nested-choice detail contextual/readable rather than returning to a giant native dropdown.

## Historical acceptance checklist

The original review expected all of these before PR #176 browser acceptance:

- compact Origin Languages card with working expand/collapse;
- Forge geometry reset gesture working only on the safe top-band target;
- sticky/useful Current Selection while scrolling;
- no redundant Training Picks heading;
- inline granted Skills/Trade Skills with provenance;
- correct local Skills/Trade Skills/Feat-Class tallies;
- eight mapped Trade Skills with correct tool association;
- mapped artisan choices routed through Trade Skills rather than a large duplicate dropdown;
- required non-crafting source choices still resolvable;
- source-granted mapped tools do not consume the paid allowance;
- paid Trade Skill selections do consume the allowance;
- NPC Forge legacy Training behavior remains protected;
- no crafting recipe/material/economy, world/town-map, travel, or tactical scope creep;
- exact-head validation/Preview acceptance.

PR #176 later merged, so these items are retained as historical review evidence rather than unchecked current tasks.

## Protected boundaries

The review did not authorize world-map/town-map/travel behavior, tactical combat, inventory/equipment authority, crafting recipes/material formulas/attempt RPCs, merchants, economy, or unrelated rest/runtime changes. Those boundaries remain valid.

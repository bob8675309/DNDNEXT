# Character Forge Training Redesign Status

Updated: 2026-08-20

Status: implementation is substantially complete on PR #176 (`agent/training-tab-redesign`). The exact runtime code checkpoint `4cfa889d36df465d0ee6e892991e5cfa816b3aeb` passed every triggered GitHub workflow and has an exact Vercel deployment in `READY` state. Later commits in this file are documentation-only. Do not merge until Paul browser-reviews the preview and the remaining browser acceptance items below are complete or explicitly deferred.

## Current accepted Forge baseline

- Species is accepted/frozen unless a concrete regression is reproduced.
- Background is accepted and merged to `main` in commit `a2aecdd354346926afdf33efb1af320581563b68` (PR #175). Its shared banner/crest/icon art system is part of the baseline.
- Training is the active slice. PR #176 is the only intended work branch for this redesign.
- NPC Forge continues through the preserved legacy Training implementation in `NpcForgeTrainingStepBase.js`; the new player Training surface must not silently alter NPC creation behavior.
- No world-map, town/city-map, travel, crafting-runtime, inventory, merchant, or economy behavior is authorized by this Training work.

## Current exact-head checkpoint

Runtime code checkpoint validated on 2026-08-20:

- `main`: `a2aecdd354346926afdf33efb1af320581563b68` — accepted Background merge;
- PR: #176 — `agent/training-tab-redesign`;
- validated runtime code head: `4cfa889d36df465d0ee6e892991e5cfa816b3aeb`;
- all **15** workflows triggered for that exact code head completed successfully;
- exact code-head Vercel deployment: `dpl_BYdVTAAjWzfbKmaRurXZ2PgJq62T`;
- code-head deployment state: `READY`;
- code-head preview host: `dndnext-b7wcjb4un-pauls-projects-2016aa54.vercel.app`;
- branch alias: `dndnext-git-agent-training-tab-redesign-pauls-projects-2016aa54.vercel.app`.

The first handoff refresh commit after that code checkpoint, `69072dc46a1a3925c9cf249803eb3500dd7a31b1`, was documentation-only and also deployed `READY` as `dpl_8WKv2dubyTLqoQy8NZ6WmxfboeMu`. This feat-audit documentation commit advances the branch again without changing runtime source.

The green exact-head workflow set includes Training redesign, Background source choices, unified Forge production-build gates, Character Forge nested choices, NPC Forge foundation, profession crafting source, starting equipment, character-scoped equipment, starting-equipment guard, starting magic, source-magic routing, Forge source presentation, Species/Human checks, Species rest proficiency runtime, portrait authority, and PR170 browser-smoke contracts.

Re-read the remote PR head and deployment metadata before merge. If later commits are documentation-only, use the validated runtime code checkpoint above when deciding whether runtime behavior changed after the green build.

## User-approved Training visual contract

The approved layout is deliberately quieter than the earlier dashboard-style attempts:

1. one compact expandable top tally rather than four independent dashboard cards;
2. one left-side `Training Picks` surface containing every decision;
3. one right-side `Current Selection` surface used only for explanation/context;
4. no decision controls portaled into the right rail;
5. compact section rows rather than oversized independent dashboards;
6. subtle use of the repo-owned Training asset kit under `public/ui/forge/training/`;
7. responsive collapse without changing ownership or persistence.

Current player selection flow is:

- Background fixed grants and unresolved Background proficiency choices;
- shared Class Skill / Trade Skill allowance;
- source/feature Training choices;
- Feat & Class choices, including the Bonus Feat catalogue and source-owned follow-ups.

## Locked modeling decisions

### Bonus Feat

- Abilities chooses only the **Bonus Feat package** as an alternative to the ability-score bonus packages.
- The actual feat is resolved in **Training**.
- Training counts an unresolved Bonus Feat in completion state and blocks Continue until it is chosen.
- The giant native `<select>` was replaced by `NpcForgeTrainingFeatPicker`: searchable, category-filterable, compact, and connected to `Current Selection` for prerequisite/source/rule detail.
- Feat-owned nested choices remain source-owned and reuse existing class/source-choice authority rather than parallel state.

### Tool proficiency and Trade Skill

For the four currently modeled campaign crafting disciplines, the canonical tool proficiency and Trade Skill are **one campaign proficiency**:

- Alchemy ↔ Alchemist's Supplies;
- Smithing ↔ Smith's Tools;
- Scribe ↔ Calligrapher's Supplies;
- Enchanting ↔ Enchanter's Tools.

Rules implemented in PR #176:

- selecting a Trade Skill with the shared Training allowance includes its associated tool proficiency;
- a Background/class/feat/source grant of one of the mapped tools grants the matching Trade Skill without requiring a second Training pick;
- mapped source-granted Trade Skills are excluded from the paid Training-choice count, preventing double-spend;
- unmapped tools such as Carpenter's Tools remain ordinary tool proficiencies and do not invent a campaign Trade Skill;
- `utils/craftingToolProfessions.js` derives the mapping from `PROFESSION_DEFINITIONS`, avoiding a second hand-maintained mapping list;
- `professionModifierFromSheet` recognizes a persisted canonical tool as rank-1 proficiency while preserving explicit higher rank, chosen ability, and service flags;
- workshop/storefront provider discovery is unchanged: proficiency alone does **not** make an NPC a service provider or town crafter.

Longer-term design goal: every meaningful crafting tool could eventually become its own craft skill with recipes/progression. That is a larger crafting-system project and is **not required to finish this Training tab**.

## Background ownership and Training routing

Variable Background tool choices keep `ownerType: "background"` and their source provenance, but `NpcForgeSourceChoiceContext` normalizes their resolver placement to Training. Metadata preserves the original Background placement.

The Background presentation bridge in `NpcForgeContextPanel`:

- suppresses the old variable tool chooser from the Background decision surface;
- projects `Choose in Training` when a Background has only a routed variable tool choice;
- when fixed and variable tools coexist, keeps the fixed grant visible and injects a `Resolved in Training` explanation for the remaining source-owned choice;
- explains that the Background grant does not consume the Class Skill / Trade Skill allowance.

Fixed Background tool/language grants remain automatic. Non-crafting tools, vehicles, gaming sets, and instruments remain source proficiencies and are not coerced into the four campaign craft families.

## Live 75-Background audit checkpoint

Live Supabase project: `DnDWeb` / `ucggczovhmauhshvhusx`.

Read-only audit on 2026-08-20 compared all 75 preferred Background rows in `character_option_catalog_preferred`:

- Background rows: **75**;
- `metadata.skills` vs `raw_payload.skillProficiencies`: **0 mismatches**;
- `metadata.tools` vs `raw_payload.toolProficiencies`: **0 mismatches**;
- `metadata.languages` vs `raw_payload.languageProficiencies`: **0 mismatches**;
- `metadata.feats` vs `raw_payload.feats`: **0 mismatches**;
- Backgrounds with skills: **75**;
- Backgrounds with source skill choices: **7**;
- Backgrounds with tools: **60**;
- Backgrounds with source tool choices: **34**;
- Backgrounds with at least one fixed tool entry: **31**;
- Backgrounds with languages: **38**;
- Backgrounds with source language choices: **37**;
- Backgrounds with at least one fixed language entry: **3**;
- Backgrounds with a non-empty feat grant structure: **39**;
- every direct Background feat reference resolves to an imported preferred feat: **0 missing direct feat names**.

Feat distribution across the 75 preferred Backgrounds:

- **36** have no feat grant structure;
- **33** have one fixed direct feat;
- **2** have a direct one-of feat pool: Rewarded and Ruined;
- **4** have a category-driven Dark Gift pool: Haunted One, Investigator, Mist Wanderer, and Spirit Medium;
- the preferred `DG` catalogue currently contains **9** eligible Dark Gift feats.

The complex source rules were checked against their actual source text rather than inferred from JSON shape:

- **Haunted One (RHW):** explicitly `Survivor` **or** a Dark Gift feat of your choice. The resolver's unioned choice pool is correct.
- **Investigator (RHW):** explicitly `Sharp Eye` **or** a Dark Gift feat of your choice. The resolver's unioned choice pool is correct.
- **Mist Wanderer (RHW):** a Dark Gift feat of your choice; Mist Walker is only recommended, not forced.
- **Spirit Medium (RHW):** a Dark Gift feat of your choice; Gathered Whispers is only recommended, not forced.
- **Rewarded (BMT):** source feature text explicitly grants Lucky, Magic Initiate, **or** Skilled, player's choice.
- **Ruined (BMT):** source feature text explicitly grants Alert, Skilled, **or** Tough, player's choice.
- **Acolyte/Guide/Sage (XPHB):** their Magic Initiate list is explicitly fixed to Cleric/Druid/Wizard respectively; the Background resolver preserves those fixed list labels while spell choices route to Spells.

The seven source skill-choice Backgrounds are: Cloistered Scholar, Custom Background, Faction Agent, Inheritor, Knight of the Order, Planar Philosopher, and Urban Bounty Hunter.

The 34 source tool-choice Backgrounds are: Artisan, Clan Crafter, Entertainer, Failed Merchant, Far Traveler, Feylost, Folk Hero, Gambler, Guard, Guild Artisan, Haunted One, Inheritor, Inquisitor, Knight of the Order, Mercenary Veteran, Mist Wanderer, Noble, Outlander, Prismari Student, Quandrix Student, Rewarded, Ruined, Rune Carver, Soldier, Spirit Medium, Urban Bounty Hunter, Uthgardt Tribe Member, Variant Criminal (Spy), Variant Entertainer (Gladiator), Variant Guild Artisan (Guild Merchant), Variant Noble (Knight), Variant Noble (Retainers), Waterdhavian Noble, and Witchlight Hand.

Other confirmed source oddities remain source truth rather than importer defects:

- **Athlete (MOT)** contains one Standard-language choice plus Vehicles (land).
- **Mist Wanderer (RHW)** contains an Artisan's Tool choice.
- **Clan Crafter (SCAG)** contains an Artisan's Tool choice, Dwarvish, and another Standard-language choice.
- **Rune Carver (BGG)** contains an Artisan's Tool choice and Giant.

Result: the all-75 Background source audit is complete for skill, tool, language, and feat grant structures at the import/catalogue-resolution level. Remaining acceptance work is browser behavior/presentation, not a known catalogue-loss issue.

## Unified Skill & Training tally

Implemented as one expandable primary completion tally:

`Skill & Training Selections — X / Y`

Its breakdown derives from existing authorities and shows:

- Background fixed/variable grant provenance;
- shared Class Skill / paid Trade Skill allowance;
- source-owned Training choices;
- Feat & Class choices, including Bonus Feat completion.

Fixed/free grants do not consume paid allowance. Outstanding Background/source/feat choices still contribute to unresolved completion.

## Implementation checklist

### A. Documentation / handoff

- [x] Record accepted Background merge and Training PR #176 as the active slice.
- [x] Record Bonus Feat ownership: package in Abilities, specific feat in Training.
- [x] Record tool/Trade Skill unification and the longer-term granular crafting-tool goal.
- [x] Record source-audit rule and confirmed source oddities.
- [x] Update `DNDNext_Current_Handoff_Prompt.md`, `docs/README.md`, and `Documentation_Refresh_Manifest.md` to point to this ledger.
- [x] Record exact-head CI and Vercel checkpoint here.
- [ ] Optional historical cleanup: `Character_Forge_Background_Audit.md` still identifies PR #175 as the active formatting pass in its opening status line. Its audit content is accepted/merged history; update that one historical line when that large document is next edited.

### B. Background proficiency routing into Training

- [x] Inventory all 75 preferred Background skill/tool/language source structures from the live preferred catalogue.
- [x] Verify normalized metadata parity against raw source payload for skills, tools, and languages: zero mismatches.
- [x] Distinguish fixed grants from unresolved choices without changing source data.
- [x] Remove player-facing variable Background tool dropdowns from Background decision ownership and acknowledge their Training resolver.
- [x] Preserve fixed tools as source-owned automatic grants.
- [x] Map canonical crafting-tool grants/choices to the corresponding Trade Skill.
- [x] Preserve non-crafting tool, vehicle, instrument, and gaming-set proficiencies without forcing them into the four craft families.
- [x] Add focused regression coverage for Background → Training proficiency ownership.
- [ ] Browser-confirm mixed fixed+variable Background tool presentation (for example Folk Hero) is visually clear; mechanically it is already routed/persisted.

### C. Unified Skill & Training tally

- [x] Replace the four confusing headline counters with one primary resolved/required tally.
- [x] Make the tally expandable to show provenance by Background/Class/Feature/Craft/Feat.
- [x] Ensure fixed/free grants do not consume selectable allowance.
- [x] Ensure unresolved variable Background/source grants count as outstanding work.
- [x] Ensure Bonus Feat contributes to unresolved Training completion.
- [x] Keep Continue guidance pointed at unresolved required work.

### D. Trade Skill presentation and authority

- [x] Use `Trade Skills` consistently for the campaign crafting subsection.
- [x] Keep it visually parallel to Class Skills rather than a separate oversized crafting dashboard.
- [x] Add canonical tool ↔ Trade Skill helper derived from `PROFESSION_DEFINITIONS`.
- [x] Treat mapped crafting-tool source grants as matching Trade Skill proficiency.
- [x] Prevent double-spending when the source tool grant and craft proficiency are the same mapped proficiency.
- [x] Preserve explicit service/provider authority so proficiency does not create storefront access.
- [x] Do not change recipe tables, material formulas, crafting attempt RPCs, merchants, inventory, or economy.

### E. Feat selection presentation

- [x] Replace the giant native Bonus Feat dropdown with a compact catalogue/list-detail chooser.
- [x] Add search and category filtering.
- [x] Show source/category/prerequisite information.
- [x] Publish selected/hovered feat rules to `Current Selection`.
- [x] Preserve nested feat-owned source-choice authority rather than duplicating state.
- [x] Keep Profile-only admin grant/remove behavior out of the Training picker.
- [x] Audit all preferred Background feat references/pools against live source structures and preferred feat catalogue resolution.
- [ ] Browser-verify Bonus Feat selection plus nested follow-up choices end to end.
- [ ] Independently browser-verify Origin/background/class-feature feat routing cases during acceptance.

### F. Source audit / balance verification

- [x] Audit all 75 preferred Backgrounds for skill/tool/language/feat metadata-vs-raw source parity.
- [x] Verify all direct Background feat references resolve to preferred feat catalogue entries.
- [x] Verify category-driven Dark Gift pools resolve to populated eligible catalogues.
- [x] Verify complex feat-choice source text for Haunted One, Investigator, Mist Wanderer, Spirit Medium, Rewarded, and Ruined.
- [x] Record actual source oddities rather than "fixing" them by feel.
- [x] Make no balancing/data rewrite based solely on uneven Background power.
- [x] Keep any campaign rebalance proposals in a separate documented backlog.

### G. Validation / acceptance

- [x] Verify new helpers, hooks, props, callbacks, and state references through focused and production-build validation gates.
- [x] Training redesign validator green on exact runtime code head.
- [x] Nested Character Forge choice validator green.
- [x] Background source-choice validator green.
- [x] Unified Forge / PR170 browser-smoke build gates green.
- [x] Species/Human, starting-equipment, starting-magic, portrait, source-magic, profession, source-presentation, rest-runtime, and NPC Forge regression gates green.
- [x] Exact runtime code-head Vercel deployment is `READY`.
- [ ] Browser-test at minimum: Athlete, Mist Wanderer, Clan Crafter, Rune Carver, Folk Hero mixed fixed+choice tools, Charlatan/Skilled, Haunted One/Investigator Dark Gift choice, Rewarded/Ruined feat choice, an ordinary class, Artificer/crafting-heavy case, and Bonus Feat flow.
- [x] Confirm PR changed-file scope contains no world-map, town/city-map, travel, tactical, crafting-runtime, inventory, merchant, or economy implementation files.
- [x] Keep PR #176 unmerged pending user visual/behavior acceptance.

## Protected boundaries

This Training work does **not** authorize changes to:

- `components/MapPageClient.js` or world map/travel/weather/camp/clock logic;
- town/city map behavior;
- encounter action execution;
- crafting recipe/material/attempt formulas or consumption;
- inventory/equipment authority;
- merchants/economy;
- unrelated runtime/rest systems.

The future unified crafting-material redesign remains a separate post-Forge project.

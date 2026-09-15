# Character Forge Training Redesign Status

Updated: 2026-09-15

Status: **implemented and merged through PR #176 on 2026-09-11.**

This document now records the durable Training architecture and acceptance decisions. The older exact PR-head/Vercel details in the dated browser-review files remain historical evidence; they are no longer active merge gates.

## Current authority

Training is part of the shared Player/NPC Character Forge, but player and NPC presentation paths remain intentionally isolated where their workflows differ.

Primary ownership rules:

- Player Training uses the redesigned player Training surface.
- NPC Forge preserves the NPC-oriented Training path rather than inheriting every player-only layout decision.
- Source-owned grants/choices keep their provenance and persistence authority even when their resolver UI is shown in Training.
- Training must not create parallel save state for Background/Class/Feat source choices.

## Player Training presentation

The accepted player direction remains:

- compact overall Training tally rather than dashboard-card sprawl;
- Skills and Trade Skills as the primary visible decision surfaces;
- Feat/Class choices grouped separately when present;
- one useful right-side Current Selection/detail surface;
- no duplicate visible Training heading/chrome;
- responsive layout with reachable controls and clear completion state.

## Bonus Feat ownership

Abilities may select the **Bonus Feat package** when that campaign option is available, but the actual feat identity is resolved in Training.

Training completion must account for an unresolved Bonus Feat and block Continue until the required feat is chosen.

Feat-owned nested choices remain owned by the existing source/feature choice system. Do not flatten them into ad-hoc Training component state.

## Tool proficiency and Trade Skills

The redesign established campaign Trade Skill/tool relationships so the same proficiency is not paid for twice.

Core mapped families include:

- Alchemy ↔ Alchemist's Supplies;
- Smithing ↔ Smith's Tools;
- Scribe ↔ Calligrapher's Supplies;
- Enchanting ↔ Enchanter's Tools;
- later accepted Training expansion also exposes Cooking, Tinkering, Herbalism, and Poisoncraft/tool relationships where current source defines them.

The durable rules are:

- a mapped tool/source grant can satisfy its matching Trade Skill without consuming a second paid Training choice;
- choosing a mapped Trade Skill grants/recognizes the associated canonical tool proficiency through the established mapping authority;
- unmapped tools remain ordinary source proficiencies and do not invent a campaign profession;
- proficiency alone does not make an NPC a crafter/service provider;
- current craft/service-provider authority remains in the crafting/town systems.

Always inspect `utils/craftingToolProfessions.js`, current profession definitions, and current Training source before changing the mapping list.

## Background/source routing

Background fixed grants remain automatic. Variable Background skill/tool choices may resolve in Training while preserving Background ownership/provenance.

The Background presentation should explain when a choice is resolved in Training rather than presenting a second competing chooser.

A Background/source-granted skill or mapped Trade Skill does not consume the paid Class Skill / Trade Skill allowance unless current rules explicitly say it should.

## Skills / proficiency accounting

Preserve the distinction between:

- fixed granted proficiency;
- source-owned variable choice;
- paid Class/Training selection;
- Expertise or higher-rank effects;
- Trade Skill/tool equivalence.

Do not infer that two visually similar rows consume the same budget without checking their source ownership.

## Feats and class-feature choices

Training remains the home for proficiency/feat/class-acquisition decisions that depend on Training context. Spell-centric choices belong in Spells; equipment choices belong in Equipment; rest-configurable/per-use features belong at runtime.

Choice placement follows lifecycle/dependency, not whichever tab is easiest to render.

## Historical browser-review evidence

These files preserve the detailed 2026-08-21 implementation/acceptance checkpoints:

- `Character_Forge_Training_Browser_Review_2026-08-21.md`;
- `Character_Forge_Training_Browser_Implementation_2026-08-21.md`.

Their statements that PR #176 was open/unmerged describe that historical checkpoint. PR #176 is now merged.

## Current validation expectations

When modifying Training:

- preserve Player/NPC isolation;
- preserve fixed/source/paid choice accounting;
- preserve mapped tool↔Trade Skill no-double-spend behavior;
- preserve Bonus Feat routing;
- preserve source provenance/persistence;
- preserve completion/Continue authority;
- run current focused Training/Forge validators plus relevant crafting/profession regressions;
- verify no unrelated Character Forge source-choice behavior regressed.

## Larger future crafting work

The idea of expanding many individual tools into deeper craft-skill/recipe systems remains a **separate crafting project**. Do not use Training cleanup as authority to redesign recipes, materials, crafter storefronts, or economy.

## Protected boundaries

Training work does not authorize changes to world-map behavior, town/city-map behavior, routes/travel/weather/camps/clock, tactical movement/combat, crafting execution, inventory, merchants, economy, or unrelated runtime systems.

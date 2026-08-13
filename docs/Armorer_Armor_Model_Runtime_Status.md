# Artificer Armorer Armor Model Runtime Status

Updated: 2026-08-09

Status: **live and rollback-accepted through migration 78**

## Source authority

Armor Model is source-matched to the Artificer Armorer at level 3.

- EFA Armorer: Dreadnaught, Guardian, Infiltrator.
- TCE Armorer: Guardian, Infiltrator.

The source allows the armor model to be changed after a Short Rest or Long Rest while Smith's Tools are in hand.

## Accepted lifecycle

Armor Model is not a permanent one-time Character Forge choice. The existing Forge parser classifies it as rest-reconfigurable and permanent class-choice output remains creation-only.

Accepted behavior:

1. the initial model can be selected immediately once a source-matched Armorer reaches the source-defined feature level;
2. Smith's Tools must be present in effective character inventory;
3. later changes require a strictly newer Short Rest or Long Rest;
4. one qualifying rest authorizes one completed replacement;
5. invalid attempts do not consume the rest opportunity;
6. active encounters block configuration.

The live inventory schema represents possession but has no dedicated tool-in-hand slot. The runtime therefore records `toolsRequirementMode='inventory_possession_proxy'`; inventory possession is the explicit current-schema proxy for the source phrase “Smith's Tools in hand.”

## Runtime authority

Migration 78: `armorer_armor_model_runtime` (`20260809220732`).

Functions:

- `private.character_has_smiths_tools_v1(uuid)`;
- `private.armorer_armor_model_options_v1(text)`;
- `private.armorer_armor_model_context_v1(uuid)`;
- `private.sync_armorer_armor_model_projection_v1(uuid,jsonb)`;
- `public.get_character_armorer_armor_model_v1(uuid)`;
- `public.configure_character_armorer_armor_model_v1(uuid,text)`.

Normalized state:

- feature key: `artificer-armorer-armor-model`;
- cadence: `short_or_long_rest`;
- projection: `runtimeFeatures.armorerArmorModel`.

The option resolver derives the exact EFA/TCE model set from `class_feature_catalog`. It constrains referenced descriptions to the Armor Model feature level so later Armorer features that reuse names such as Guardian/Infiltrator cannot be mistaken for the level-3 model text.

## Explicit non-goals

This slice stores the source-backed current model only. It does not:

- create or transform an Arcane Armor inventory item;
- equip/unequip armor;
- change Armor Class;
- consume or mutate Smith's Tools;
- add Dreadnaught/Guardian/Infiltrator attacks/effects to combat;
- change crafting behavior.

Those consumers can read the normalized model later when inventory/action integration is explicitly in scope.

## Shared cadence compatibility repair

During candidate acceptance, live `character_runtime_feature_choices` allowed `long_rest`, `short_rest`, `per_use`, and `informational`, but the already-deployed Fiendish Resilience configure RPC writes `short_or_long_rest`.

Migration 78 additively extends the cadence check to allow `short_or_long_rest` while preserving all existing valid values. It does not rewrite Fiendish source logic.

A rollback smoke test against the deployed database proved `configure_character_fiendish_resilience_v1` can now store a Fire resistance receipt with `cadence='short_or_long_rest'`.

## Validation and deployed proof

Before deployment, rollback testing caught and corrected:

- a TCE cross-level description collision in the source resolver;
- the shared cadence-constraint mismatch.

After migration 78 was applied, a rolled-back EFA Armorer 3 / TCE Armorer 3 / non-Armorer / Fiend cadence fixture proved:

- EFA exposes exactly three source models;
- TCE exposes exactly two;
- non-Armorer is ineligible;
- missing tools reject initial configuration;
- EFA Dreadnaught can be chosen initially;
- immediate replacement without a newer rest is rejected;
- TCE Dreadnaught is rejected while TCE Guardian is accepted;
- a Short Rest authorizes one EFA replacement to Guardian;
- the same Short Rest cannot be reused;
- a Long Rest creates the next replacement opportunity;
- missing tools and active encounter both reject without consuming it;
- restoring tools after leaving the encounter allows Guardian → Infiltrator;
- the same Long Rest cannot be reused;
- runtime receipt and sheet projection are deterministic;
- Fiendish Resilience can store `short_or_long_rest` after the constraint repair;
- public/private ACL expectations pass.

## Production integrity

After rollback-only acceptance:

- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 18 inventory rows;
- 0 live Armor Model runtime rows;
- 0 Armor QA characters;
- 20 locations;
- 4 map routes;
- 9 map route points.

No world-map, route/travel/weather, crafting, inventory mutation, or tactical action state was changed.

## Status

Armor Model is **closed/accepted**. Do not reopen it without contradictory source/live evidence.

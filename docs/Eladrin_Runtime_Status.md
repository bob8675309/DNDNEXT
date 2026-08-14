# Eladrin Runtime Status

Status date: 2026-08-09
PR: #170 (`agent/character-forge-resilience-presentation`)
Live migration: 68

## Purpose

This ledger records MPMM Eladrin choices that are not permanent Character Forge locks:

- current seasonal identity, which needs an initial state and may later change after a Long Rest;
- Trance training, which grants two temporary Player's Handbook weapon/tool proficiencies after a completed Long Rest and expires at the next Long Rest.

The two families use independent runtime rows so a persistent season cannot be overwritten by temporary training state.

## Season authority

Feature key: `eladrin-season`.

Shared Player Forge collects exactly one initial season:

- Autumn;
- Winter;
- Spring;
- Summer.

In the Species step, each season's flavor and level-3 Fey Step effect are presented directly inside its selectable option. The raw source prompt is suppressed from the surrounding feature list, so `Eladrin Seasons` remains the single creation-time season card. This is presentation only: the four stored keys and the source-owned selection path are unchanged.

That selection is serialized as source-owned runtime-initial state (`species-runtime-eladrin-season`) and deferred-materialized after Player Forge creation into `character_runtime_feature_choices`. It is projected under `sheet.runtimeFeatures.eladrinSeason`.

The current season persists across Long Rests. A newer completed Long Rest opens one explicit replacement opportunity. Choosing the same season is rejected as a no-op, and after one change on a qualifying rest another change requires a still newer Long Rest.

At character level 3+, the current season determines the extra effect of Fey Step. Migration 68 stores/presents that source state but does not implement or modify tactical Fey Step execution; spell/combat execution remains outside this slice.

## Trance training authority

Feature key: `eladrin-trance-training`.

Trance training is not a creation-time Forge choice.

After a completed Long Rest/Trance, an eligible MPMM Eladrin may choose exactly two **different** proficiencies from the same source-legal PHB equipment catalogue used by Astral Trance/Githyanki:

- weapons;
- tools;
- 74 total eligible entries;
- campaign firearm exclusions remain intact.

The pair is stored in `character_runtime_feature_choices` and projected under `sheet.runtimeProficiencies.eladrinTrance`.

`utils/characterRuntimeProficiencies.js` consumes both training entries additively for weapon/tool proficiency checks. Permanent Species/class/Background/feat training is not rewritten.

When the next Long Rest completes, the Trance runtime row and projection are automatically deleted. The new Long Rest then opens a fresh two-choice configuration.

## UI / reachability

`CharacterEladrinRuntimePanel` presents both families:

- current season and post-Long-Rest replacement;
- current temporary Trance pair or a two-selector post-rest form.

The Eladrin panel is an always-reachable downstream child of `CharacterSpeciesReplaceableCantripPanel`. The Species runtime composition therefore now behaves as:

`CharacterSpeciesRestProficiencyPanel → CharacterSpeciesReplaceableCantripPanel → CharacterEladrinRuntimePanel`

Each parent renders its child even when its own Species family is ineligible. An Eladrin therefore reaches its controls without needing Githyanki/Khoravar proficiency state or High Elf/Khoravar cantrip state.

## Security / guards

All four public RPCs explicitly revoke `PUBLIC` and `anon`, then grant only `authenticated` and `service_role`:

- `get_character_eladrin_season_v1`;
- `configure_character_eladrin_season_v1`;
- `get_character_eladrin_trance_v1`;
- `configure_character_eladrin_trance_v1`.

Private helpers/materializers are service-role only.

Runtime mutations use existing character ownership/admin authority and reject changes while the character is in an active encounter.

Canonical rest timing uses `character_rest_log.rest_type='long_rest'` through the existing Species rest helper.

## Pre-deploy evidence

The migration-68 candidate compiled against the live schema inside rollback before deployment.

The exact branch head preserved every workflow that was green on the preceding 19-workflow Species-cantrip head and added the dedicated `Validate Eladrin runtime` workflow. Every required latest workflow completed successfully before migration 68 was applied.

The Eladrin gate includes:

- dedicated semantic validation;
- Species proficiency regression validation;
- Species replaceable-cantrip regression validation;
- unified Character Forge validation;
- production build.

## Deployed rollback acceptance

### Season

Passed:

- shared-Forge Autumn deferred materialization;
- `runtimeFeatures.eladrinSeason` projection;
- no replacement before a newer Long Rest;
- Autumn persists through canonical `complete_character_rest_v1(...,'long_rest')`;
- newer Long Rest opens replacement;
- replacement to Winter succeeds;
- projection updates to Winter;
- second same-rest replacement rejected;
- same-season no-op rejected;
- serialized initial Forge source choice remains unchanged;
- transaction rolled back.

### Trance training

Passed:

- unavailable before first completed Long Rest;
- canonical Long Rest opens configuration;
- duplicate two-choice submission rejected;
- invalid item ID rejected;
- one weapon + one tool pair accepted;
- exactly two runtime training entries projected;
- permanent `sheet.proficiencies` unchanged;
- second configuration on the same Long Rest rejected;
- next canonical Long Rest deletes runtime row and projection;
- selection reopens after expiry;
- transaction rolled back.

## Final zero-residue checkpoint

After both deployed rollback fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 18 inventory rows;
- 0 live Eladrin season/trance runtime rows;
- 0 Eladrin QA characters;
- 20 locations;
- 4 routes;
- 9 route points.

Migration 68 is registered live.

## Remaining source-choice audit

Eladrin is closed. Remaining audited candidates include:

- Boon of Energy Resistance Long-Rest resistance pair;
- Echoing Soul / Zhentarim Tactics Long-Rest Expertise;
- Cartomancer Hidden Ace;
- Echoing Soul permanent acquisition count if confirmed under-modeled;
- remaining class/subclass runtime families already excluded from permanent Forge state.

## Protected boundaries

Migration 68 does not modify world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting behavior. Fey Step execution is deliberately untouched. `components/MapPageClient.js` remains outside scope.

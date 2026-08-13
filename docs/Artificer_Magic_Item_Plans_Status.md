# Artificer Magic Item Plans — Runtime / Progression Status

Status: **live and rollback-proven through migrations 60–62**

## Scope

This slice normalizes EFA Artificer **Replicate Magic Item / Magic Item Plans** for shared Player Forge and earned progression.

A learned Magic Item Plan is **knowledge**, not a created inventory item. Learning, replacing, or selecting a plan does not insert an `inventory_items` row.

## Source authority

The plan catalogue is derived from the imported EFA `Replicate Magic Item` source tables in `class_feature_catalog`. Migration 60 does not maintain a hand-written list of plans.

The source progression is:

- Artificer 2: 4 learned plans;
- Artificer 6: 5;
- Artificer 10: 6;
- Artificer 14: 7;
- Artificer 18: 8.

Direct level-N Forge therefore uses slot acquisition chronology:

`[2, 2, 2, 2, 6, 10, 14, 18]`

Whenever the Artificer gains an Artificer level, one learned plan may optionally be replaced with another plan legal for the new level.

## Normalized authority

Migration 60 source-normalizes **56 EFA plans** into `class_feature_option_catalog` with:

- `option_type='artificer-plan'`;
- `source='EFA'`;
- `class_key='artificer'`.

Each learned plan is an independent row in `character_class_option_grant_instances`.

Fixed plans store no dependent child choice. Wildcard plans store one canonical `items_catalog.id` under `choices.child`.

The sheet projection is maintained under:

`sheet.classFeatureChoices['artificer-magic-item-plans']`

Migration 61 defensively creates the parent `classFeatureChoices` object for legacy sheets before writing that projection.

## Wildcard plan families

Exactly three source rows are repeatable wildcard plans:

1. level 2 — **Common magic item that isn't a Potion, a Scroll, or cursed**;
2. level 10 — **Uncommon Wondrous Item that isn't cursed**;
3. level 14 — **Rare Wondrous Item that isn't cursed**.

Each repeat of the same wildcard must choose a **different concrete item**.

The child choice is validated server-side against canonical item rows; the browser does not get to define an item by label.

### Migration 62 correction

The first post-deploy eligibility audit found that rarity alone admitted non-magic Common catalogue rows such as an alchemy reagent. No character had configured an Artificer plan yet, so no user data was affected.

Migration 62 changed wildcard eligibility to require positive magic-item identity:

- imported magic-item `payload.type`, or
- `wondrous=true`, or
- canonical `item_type='Wondrous Item'`.

This rejects alchemy ingredients, recipes, and other non-magic catalogue rows while preserving official/custom magic items.

Final live wildcard candidate counts:

- Common non-Potion/non-Scroll/non-cursed magic items: **105**;
- Uncommon non-cursed Wondrous Items: **173**;
- Rare non-cursed Wondrous Items: **200**.

## Player Forge

`NpcForgeFeatChoiceRegistrar` registers normalized source-owned Artificer plan slots in Player mode for EFA Artificers.

`NpcForgeClassGuideModel` suppresses the older legacy `artificer-plan` presentation only when the normalized `artificer-plan` source family is active. NPC mode remains on the existing presentation path.

Wildcard parent plans expose a dependent concrete-item selector. Fixed plans do not.

## Earned progression

`get_character_level_class_choice_options_v2` appends:

- a new plan group when the next Artificer level increases plan capacity;
- one optional `artificer-plan-replacement` group when the character already knows plans.

`complete_character_level_up_v5` peels Artificer plan groups from the shared payload and delegates them to `private.apply_level_up_artificer_plans_v1` before forwarding unrelated class choices through the established progression path.

Replacement preserves the existing grant `instance_key` and swaps its normalized plan/child authority rather than creating a parallel plan history object.

## Direct Forge authority

The deferred constraint trigger

`character_progression_materialize_player_forge_artificer_plans_v1`

runs only for:

- EFA Artificer progression;
- sheets created through shared Player Forge (`meta.creator='shared_character_forge_player_v2'`).

It reads the exact serialized `sourceChoices[group].fields[field].selections[]` payload and materializes one normalized grant instance per plan slot.

## Regression / build gate

`.github/workflows/validate-artificer-magic-item-plans.yml` runs:

1. `scripts/validate_artificer_magic_item_plans.mjs`;
2. unified Character Forge validation;
3. `npm run build:vercel`.

The validator covers:

- 4/5/6/7/8 plan chronology;
- source-derived catalogue authority;
- wildcard child requirements;
- Common Potion/Scroll/cursed exclusions;
- positive magic-item identity;
- alchemy/recipe exclusion;
- repeatable parent + distinct concrete items;
- fixed-plan non-repeatability;
- no inventory materialization;
- active v5 progression integration;
- legacy duplicate-group suppression.

The deployment candidate passed all **17 relevant PR workflows**, including the dedicated Artificer production build and the shared Forge/progression/runtime gates.

## Deployed rollback proofs

### Direct level-2 Forge-style materialization

Inside a rollback transaction:

- created a synthetic EFA Artificer 2 sheet using the shared Player Forge creator marker;
- selected the Common wildcard twice with two different canonical items;
- selected two fixed plans;
- forced only the Artificer deferred constraint trigger;
- confirmed exactly 4 normalized plan instances;
- confirmed 2 wildcard instances with 2 distinct concrete item IDs;
- confirmed sheet projection count = 4;
- confirmed EFA Artificer 2 progression derivation;
- confirmed inventory count did not change.

The transaction rolled back with zero residue.

### Earned Artificer 5 → 6

Inside a rollback transaction:

- seeded four normalized learned plans on a synthetic EFA Artificer 5;
- confirmed exactly one new slot group for `artificer-plan-slot-5`;
- confirmed one optional replacement group;
- added one new plan and replaced exactly one existing plan;
- confirmed replacement preserved the instance key;
- confirmed final normalized plan count = 5;
- confirmed sheet projection count = 5;
- confirmed inventory count did not change.

Fail-closed assertions also proved rejection of:

- an alchemy reagent submitted to the Common wildcard;
- a wildcard plan without a concrete item;
- a fixed plan submitted with a child item;
- repeating the same wildcard with the same concrete item;
- Artificer plan payload supplied for a non-Artificer.

All transactions rolled back.

## Production integrity checkpoint

After migrations 60–62 and all rollback fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 0 open level-up sessions;
- 18 inventory rows;
- 0 live Artificer plan grant instances;
- 0 QA Artificer/non-Artificer proof characters;
- 56 normalized EFA plan options;
- 3 wildcard families;
- 20 locations;
- 4 map routes;
- 9 route points.

## ACL note

Artificer private helper/validation functions are service-role only.

`complete_character_level_up_v5` is authenticated/service-role only.

`get_character_level_class_choice_options_v2` still inherits an older anonymous execute grant. Migration 60 did not introduce that grant. It remains a separate progression-ACL cleanup item and should be reconciled with the other obsolete/authenticated progression RPCs before PR #170 closes.

## Protected boundaries

This slice does **not** create Magic Item Plan inventory, craft items, alter smithing/enchanting, or touch world-map, town/city-map, route/travel/weather, encounter/combat, or tactical damage authority.

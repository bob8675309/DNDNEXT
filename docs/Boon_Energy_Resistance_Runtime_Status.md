# Boon of Energy Resistance Runtime Status

Status date: 2026-08-09
PR: #170 (`agent/character-forge-resilience-presentation`)
Live migrations: 69-70

## Scope

This ledger is the controlling evidence for XPHB **Boon of Energy Resistance** runtime authority.

The source feature grants two chosen resistances from:

- Acid
- Cold
- Fire
- Lightning
- Necrotic
- Poison
- Psychic
- Radiant
- Thunder

Both choices may be changed after a Long Rest.

## Authority model

The Boon is owned by the existing per-feat acquisition instance in `character_option_grant_instances`.

The nested acquisition field uses a dedicated choice kind:

`energy-resistance`

This is intentionally **not** `damage-type`, because that existing kind is reserved by the advancement validator for Elemental Adept.

Current runtime state is stored separately in `character_runtime_feature_choices` under a deterministic per-instance key:

`boon-energy-resistance:<instance hash>`

This preserves acquisition history while allowing the current pair to change.

## Direct Forge / earned progression convergence

`normalizeFeatSourceChoiceGroups` adds the required two-choice acquisition field for Boon of Energy Resistance.

Both direct Player Forge feat-instance serialization and earned progression use the same nested feat-choice model.

The existing acquisition systems store the pair in `character_option_grant_instances.choices`.

Migration 69 adds an `AFTER INSERT` trigger on that normalized instance table. A valid Boon instance therefore materializes the same runtime pair regardless of whether the grant came from direct Forge or earned progression.

The acquisition choices are immutable history. Long-Rest replacement updates runtime state only.

## Runtime replacement

`get_character_boon_energy_resistance_v1(character_id)` exposes:

- normalized feat-instance identity;
- current pair;
- all nine legal options;
- whether a newer Long Rest is available;
- combined character runtime resistance projection.

`configure_character_boon_energy_resistance_v1(character_id, instance_key, damage_types[])` enforces:

- authenticated character management;
- exact XPHB Boon instance ownership;
- exactly two choices;
- distinct choices;
- only the nine source damage types;
- active-encounter lock;
- a newer canonical `long_rest` before replacing an existing pair.

Submitting the same current pair is a no-op.

Migration 70 stores an explicit `v_had_runtime` boolean so audit provenance cannot be corrupted by PL/pgSQL's implicit `FOUND` flag being overwritten by later aggregate queries.

## Sheet/runtime projection

The current pair is projected to:

`sheet.runtimeFeatures.boonEnergyResistance`

The shared private runtime-resistance helper now combines:

- Dread Allegiance;
- Fiendish Resilience;
- Boon of Energy Resistance.

No encounter participant or combat snapshot is written by this slice. Tactical consumption of the canonical runtime-resistance helper remains a protected combat integration item.

## UI

`CharacterBoonEnergyResistancePanel` is mounted through the established character-sheet runtime composition beneath `CharacterCurrencyBadge`.

The panel:

- shows the current two resistances;
- prevents duplicate selections in the browser;
- enables replacement only when the server reports it is available;
- still relies on the RPC for final authority.

## Validation gates

Before deployment:

- migration 69 compiled against the live Supabase schema inside rollback;
- migration 70 compiled against live Supabase inside rollback;
- the dedicated Boon semantic validator passed;
- unified Character Forge validation passed;
- character progression v3 validation passed;
- the dedicated Boon production `build:vercel` gate passed.

The exact deployment head also passed all 21 relevant GitHub workflows.

During that gate, the existing Eladrin workflow caught three later-overwrite regressions unrelated to the Boon SQL:

1. missing Eladrin Season Player Forge source group;
2. missing `CharacterEladrinRuntimePanel` composition under the Species cantrip panel;
3. missing Eladrin Trance weapon/tool proficiency projection.

All three were restored before Boon deployment, and the Eladrin semantic + production build gate returned green.

## Live rollback proofs

### Normalized acquisition lifecycle

A synthetic normalized Boon grant instance used Fire + Psychic.

Verified:

- the acquisition trigger materialized one runtime row;
- runtime resistance projection included both types;
- duplicate choices rejected;
- Force rejected;
- replacement before a newer Long Rest rejected;
- real `complete_character_rest_v1(...,'long_rest')` unlocked replacement;
- replacement to Cold + Radiant succeeded;
- `configuredBy='long_rest_replacement'`;
- `previousResistances=['fire','psychic']`;
- acquisition `choices` remained unchanged;
- a second replacement on the same rest was rejected;
- inventory count did not change.

### Earned level-19 advancement

A synthetic character called the existing `private.apply_character_level_advancement_v1` helper with:

- one normal Epic Boon ability choice;
- Lightning + Poison as `energy-resistance` choices.

Verified:

- the +1 ability increase applied;
- one normalized Boon feat instance was created;
- the energy-resistance choices were preserved on the instance;
- the Boon trigger materialized Lightning + Poison runtime state;
- sheet runtime projection matched;
- the shared runtime-resistance helper included both;
- inventory count did not change.

### Fail-closed encounter / instance proof

Verified:

- active encounter participant state blocks replacement;
- a non-Boon instance key is rejected.

All fixtures were rolled back.

## Final production integrity

After all rollback fixtures:

- migrations 69 and 70 registered;
- 0 live Boon runtime rows;
- 0 live Boon grant-instance QA rows;
- 0 synthetic Boon characters;
- 0 synthetic Boon encounters;
- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 18 inventory rows;
- 20 locations;
- 4 routes;
- 9 route points.

No world-map, route/travel/weather, inventory, crafting, or tactical-combat mutation was introduced by this slice.

## Status

Boon of Energy Resistance acquisition + Long-Rest replacement authority is **live and rollback-proven** through migrations 69-70.

Next source-choice runtime work should continue with the remaining feat families, particularly Echoing Soul / Zhentarim Tactics Long-Rest Expertise and Cartomancer Hidden Ace, while keeping combat/action-only effects outside this PR unless explicitly authorized.

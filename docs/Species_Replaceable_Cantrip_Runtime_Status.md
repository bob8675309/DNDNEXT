# Species Replaceable Cantrip Runtime Status

Status date: 2026-08-09
PR: #170 (`agent/character-forge-resilience-presentation`)
Live migration: 67

## Purpose

This ledger records source-correct authority for Species traits whose spellcasting ability is a permanent creation choice but whose cantrip may be replaced after a Long Rest.

This slice covers:

- XPHB High Elf — Elven Lineage cantrip;
- EFA Khoravar — Fey Gift cantrip.

The permanent casting-ability choice remains in shared Character Forge source-choice authority. The cantrip itself is normalized Species spell authority with Long-Rest replacement timing.

## XPHB High Elf

Source semantics:

- High Elf starts with **Prestidigitation**;
- Intelligence, Wisdom, or Charisma is chosen permanently for Elven Lineage spells;
- after finishing a Long Rest, the current cantrip may be replaced with a different Wizard cantrip.

DNDNext authority:

- feature key: `high-elf-lineage-cantrip`;
- initial spell: preferred-catalogue Prestidigitation;
- legal replacement pool: 31 preferred Wizard cantrips;
- spell assignment: `character_spells.source_type='species'`;
- casting stat remains the permanent Elven Lineage choice;
- the source-choice lineage/casting-ability payload is never rewritten by replacement.

## EFA Khoravar — Fey Gift

Source semantics:

- Khoravar starts with **Friends**;
- Intelligence, Wisdom, or Charisma is chosen permanently for Fey Gift;
- after finishing a Long Rest, the current cantrip may be replaced with a different cantrip from the Cleric, Druid, or Wizard spell list.

DNDNext authority:

- feature key: `khoravar-fey-gift-cantrip`;
- initial spell: preferred-catalogue Friends;
- legal replacement pool: 44 preferred Cleric/Druid/Wizard cantrips;
- spell assignment: `character_spells.source_type='species'`;
- casting stat remains the permanent Fey Gift choice;
- the source-choice casting-ability payload is never rewritten by replacement.

## Creation behavior

The source-fixed initial cantrip is **not** another Player Forge choice.

`private.materialize_player_forge_species_replaceable_cantrip_v1()` is a deferred `character_progression` trigger. For shared Player Forge creation it runs after the serialized Species source choices are present and:

1. resolves the eligible Species/trait;
2. reads the already-selected permanent spellcasting ability;
3. resolves the source-fixed initial cantrip from `spells_catalog_preferred`;
4. creates exactly one Species-owned `character_spells` assignment;
5. creates the matching `character_runtime_feature_choices` row;
6. writes a display/runtime projection under `sheet.runtimeFeatures.speciesReplaceableCantrip`.

The preferred spell view has the exact same 47-column shape/order/types as `spells_catalog`, so its row is compatible with the canonical spell rowtype used by the materializer.

## Replacement behavior

Public authority:

- `get_character_species_replaceable_cantrip_v1(character_id)`;
- `configure_character_species_replaceable_cantrip_v1(character_id, spell_id)`.

A replacement requires:

- character owner/editor/admin authority;
- an already-materialized source-fixed initial/current cantrip;
- no active encounter;
- a newer canonical `long_rest` than the current replacement anchor;
- a different cantrip from the current one;
- membership in the feature's legal class-list cantrip pool.

Replacement removes only the old Species assignment with the same stable source key, writes one replacement Species spell assignment, preserves the permanent casting stat, updates runtime state/projection, and advances the replacement anchor to the qualifying Long Rest.

## UI

`CharacterSpeciesReplaceableCantripPanel` shows:

- current cantrip;
- permanent spellcasting ability;
- Long-Rest replacement status;
- a replacement selector only when a newer Long Rest permits it.

It is composed downstream of `CharacterSpeciesRestProficiencyPanel` using the same always-reachable child pattern as the established runtime panel chain. Therefore:

- High Elf reaches the cantrip panel even though it has no Species proficiency runtime panel;
- Khoravar can render Skill Versatility and Fey Gift cantrip controls together;
- one Species runtime family cannot hide another.

## Security

Migration 67 explicitly revokes `PUBLIC` and `anon` EXECUTE from both public RPCs before granting `authenticated` and `service_role`.

Post-deploy verification:

- anonymous EXECUTE count: 0;
- authenticated EXECUTE count: 2.

Private helpers/materializer are service-role only.

## Pre-deploy evidence

The exact migration-67 source candidate passed all 19 relevant GitHub workflows, including the dedicated Species replaceable-cantrip semantic gate and production build.

Live rollback source-extraction proof verified:

- High Elf source payload → Prestidigitation + Intelligence;
- Khoravar source payload → Friends + Wisdom;
- High Elf legal pool = 31;
- Khoravar legal pool = 44;
- synthetic source sheets rolled back.

The preferred spell view was independently verified to have the same 47 columns, order, and data types as `spells_catalog`.

## Deployed rollback acceptance

### High Elf

Passed:

- deferred shared-Forge materialization creates exactly one Species-owned Prestidigitation assignment;
- casting stat is the permanent Intelligence choice used by the fixture;
- runtime projection contains Prestidigitation;
- replacement is closed before a newer Long Rest;
- real `complete_character_rest_v1(..., 'long_rest')` opens replacement after the synthetic anchor is moved into the past to compensate for transaction-stable `now()`;
- same-cantrip replacement rejected;
- Druidcraft rejected because it is not a Wizard cantrip;
- Acid Splash accepted as a legal replacement;
- exactly one stable `high-elf-lineage-cantrip` spell assignment remains;
- casting stat remains Intelligence;
- runtime projection updates to Acid Splash;
- permanent lineage/casting-ability `sourceChoices` unchanged;
- transaction rolled back.

### Khoravar

Passed:

- deferred shared-Forge materialization creates exactly one Species-owned Friends assignment;
- casting stat is the permanent Wisdom choice used by the fixture;
- runtime projection contains Friends;
- replacement is closed before a newer Long Rest;
- real canonical Long Rest opens replacement;
- same-cantrip replacement rejected;
- Eldritch Blast rejected because it is Warlock-only;
- Acid Splash accepted from the Cleric/Druid/Wizard union via its Wizard membership;
- exactly one stable `khoravar-fey-gift-cantrip` spell assignment remains;
- casting stat remains Wisdom;
- runtime projection updates to Acid Splash;
- permanent Fey Gift casting-ability `sourceChoices` unchanged;
- transaction rolled back.

## Final zero-residue checkpoint

After both deployed rollback fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 18 inventory rows;
- 0 live High Elf/Khoravar replaceable-cantrip runtime rows;
- 0 live High Elf/Khoravar replaceable-cantrip Species spell rows;
- 0 cantrip QA characters;
- 20 locations;
- 4 routes;
- 9 route points.

Migration 67 is registered live.

## Remaining source-choice audit

This milestone closes only High Elf and Khoravar replaceable cantrips. Separate remaining families include:

- Eladrin season and Trance-granted training choices;
- Boon of Energy Resistance;
- Echoing Soul / Zhentarim Tactics Long-Rest Expertise;
- Cartomancer Hidden Ace;
- remaining class/subclass runtime families already excluded from permanent Forge state;
- Echoing Soul's separate permanent acquisition count if confirmed under-modeled.

## Protected boundaries

This slice does not modify world-map, town/city-map, route/travel/weather, tactical encounter/combat, or unrelated crafting behavior. The active-encounter state is read only as a replacement guard. `components/MapPageClient.js` remains outside scope.

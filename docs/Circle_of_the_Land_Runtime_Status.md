# Circle of the Land Runtime Status

Status date: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)
Live migrations: 58-59

## Scope

This document is the controlling evidence for XPHB Druid / Circle of the Land **Circle Spells** runtime authority.

Circle Spells is not a permanent Character Forge land choice. The source cadence is tied to Long Rest: after gaining the feature, the Druid finishes a Long Rest and chooses Arid, Polar, Temperate, or Tropical for that rest cycle. The selected land's Circle Spells are always prepared. At the next Long Rest, the prior package ends and the character chooses again.

This makes Circle Spells an expiring Long-Rest runtime package rather than a persistent-until-replaced choice like Primal Companion, Dread Allegiance, or Fiendish Resilience.

## Source-derived spell matrix

The migration does **not** hardcode a remembered Circle spell list.

`private.circle_land_source_table_v1()` finds the imported XPHB `Circle Spells` feature row and recursively locates the raw source table containing:

- Druid level;
- Arid;
- Polar;
- Temperate;
- Tropical.

`private.circle_land_spell_names_from_cell_v1(cell)` parses imported `{@spell ...}` tags. A guarded preferred-XPHB name fallback exists for importer-shape changes.

`private.circle_land_spell_matrix_v1()` converts the imported source table into four land packages with level-based unlock rows and preferred `spells_catalog` IDs.

A live-schema rollback proof executed the parser before deployment and established:

- exactly four lands;
- every land has source unlock rows;
- every resolved spell ID exists in `spells_catalog_preferred` with source XPHB.

Migration 59 corrects two pre-deployment parser/aggregation issues found during review:

- land column ordinal uses a dedicated scalar rather than a record-field assumption;
- level-filtered spell lists are deduplicated by canonical spell ID with PostgreSQL-safe ordering.

The corrected parser was compiled and executed successfully against live production data before deployment.

## Eligibility

`private.character_has_circle_land_spells_v1(character_id)` derives eligibility from canonical progression plus imported source data:

- class = Druid;
- class source = XPHB;
- subclass normalized to the subclass owning the imported XPHB `Circle Spells` feature;
- class level at or above the imported feature level;
- subclass source = XPHB.

No display-only sheet text is trusted as the final authority.

## Feature-acquisition anchor

`private.circle_land_spells_acquired_at_v1(character_id)` derives when the Circle Spells feature became available:

1. earned progression uses the first level event crossing the imported feature level;
2. the helper reads compatible event fields through `to_jsonb(event)`;
3. direct higher-level Forge creation falls back to the character creation timestamp.

A historical Long Rest from before feature acquisition cannot authorize the first land choice.

## Long-Rest lifecycle

Before a qualifying Long Rest after acquisition:

- `configured=false`;
- `canConfigure=false`.

After a newer Long Rest:

- `canConfigure=true`;
- one of Arid / Polar / Temperate / Tropical may be chosen;
- only spells unlocked at or below the character's current Druid level are included.

After configuration, the package is tied to that exact Long-Rest cycle through `configuredRestAt`.

### Automatic expiry

Migration 58 installs `character_rest_expire_circle_land_v1` on `character_rest_log`.

Whenever a Long Rest is inserted for an eligible Circle Druid, `private.clear_circle_land_runtime_v1`:

- deletes only `character_spells` rows whose source is the Circle runtime feature;
- marks the generic runtime row unconfigured and retains previous-land/spell audit data;
- clears `sheet.runtimeFeatures.circleOfTheLand`.

Short Rest does not clear the package.

The old package is therefore gone before the next land is selected. This is deliberate source cadence, not a user-facing permanent replacement workflow.

## Circle spell materialization

The selected current-level spell set is materialized as real `character_spells` rows:

- `source_type='class-feature'`;
- `source_key='circle-of-the-land'`;
- `source_label='Circle Spells'`;
- `known=true`;
- `prepared=true`;
- `always_available=true`;
- `casting_stat='wis'`;
- `raw_payload.runtimeFeatureKey='circle-of-the-land'`;
- selected land identity retained in raw payload.

These rows are separate from ordinary Druid `source_type='class'` prepared-spell authority. The Circle package does not consume or rewrite normal prepared-spell counts.

The character-sheet runtime projection is:

`sheet.runtimeFeatures.circleOfTheLand`

No Circle land is written into permanent `classFeatureChoices`.

## Active-encounter lock

`configure_character_circle_land_v1` checks `private.character_active_encounter_v1`.

A delayed land selection is rejected while the character is a non-defeated participant in an active encounter. This prevents a rest-cycle package from being selected/swapped mid-encounter through the sheet UI.

The Circle migration does not otherwise change tactical encounter/combat functions.

## Public RPCs

### `get_character_circle_land_v1(character_id)`

Returns:

- availability;
- acquisition timestamp;
- latest Long Rest;
- configured/canConfigure state;
- current runtime state;
- four source-derived land options;
- each land's current-level preferred spell list.

Caller must satisfy `can_manage_character_progression_v1`.

### `configure_character_circle_land_v1(character_id, land_key)`

Validates:

- caller permission;
- XPHB Circle-of-the-Land source eligibility;
- no active encounter;
- a qualifying post-acquisition Long Rest;
- one current-rest-cycle land choice;
- Arid / Polar / Temperate / Tropical option;
- preferred XPHB spell catalogue resolution.

It materializes the exact class-feature spell set, stores runtime state, and updates the character-scoped sheet projection atomically.

## Character-sheet UI

`CharacterCircleLandPanel.js` is composed through the existing runtime-choice stack.

The panel:

- lets the server verify exact subclass/source eligibility;
- shows current land and always-prepared Circle Spells;
- displays four land buttons whose spell names come from the server-parsed source table;
- exposes `Choose Land for this Long Rest` only when the server reports a qualifying rest cycle;
- explains that the package expires when the next Long Rest finishes.

No spell names are hardcoded in the UI authority path.

## Validation / build gate

`scripts/validate_circle_land_runtime.mjs` enforces:

- source-table recursion and all four land columns;
- spell-tag parsing through the preferred XPHB catalogue;
- no representative remembered spell names baked into migrations;
- acquisition-time handling;
- Long-Rest expiry trigger;
- deletion limited to Circle feature-spell rows;
- Wisdom `class-feature` spell provenance;
- no ordinary Druid class-spell mutation;
- no permanent Forge Circle state;
- active-encounter lock;
- no tactical participant/combat patch;
- protected world boundaries.

The dedicated workflow also runs unified Character Forge validation and the repository production build gate.

Before deployment, the exact corrected runtime stack compiled against live Supabase in an explicit rollback transaction and executed the source-derived matrix successfully.

Migrations 58 and 59 were then applied back-to-back so the corrected parser/getter replaced the reviewed pre-correction functions before any Circle character configuration was accepted.

## Rollback-only deployed lifecycle proof

The deployed runtime was exercised with a synthetic XPHB Druid whose Circle feature level and subclass identity were dynamically resolved from `class_feature_catalog`.

Because PostgreSQL `now()` is transaction-stable inside a single rollback fixture, synthetic Long-Rest timestamps were advanced after public rest calls to model genuinely later API transactions. Where needed, the same deployed private expiry helper was re-run at the adjusted proof timestamp to model the trigger firing at that later timestamp. Runtime semantics were not weakened.

### Before Long Rest

Verified:

- available=true;
- configured=false;
- canConfigure=false;
- four source-derived land options;
- every land has at least one current-level source-derived spell.

Direct Arid configuration was rejected.

A Short Rest did not unlock the feature.

### First qualifying Long Rest / Arid

After a post-acquisition Long Rest:

- configuration opened;
- invalid `swamp` choice was rejected without consuming the opportunity.

Arid then configured successfully.

Verified:

- exact feature-spell row count equals the server-returned Arid spell count;
- canonical spell ID set exactly matches the Arid option;
- every Circle row uses `class-feature`, `circle-of-the-land`, Wisdom, known/prepared/always-available authority;
- no Circle-created ordinary Druid class spell row;
- sheet runtime projection contains Arid;
- no permanent `classFeatureChoices` land choice.

A second land selection on the same Long Rest was rejected.

Short Rest preserved Arid and its exact spell rows.

### Next Long Rest / automatic expiry

At the next Long Rest:

- all old Circle class-feature spell rows were removed;
- the sheet runtime projection was removed;
- getter returned `configured=false`, `canConfigure=true`;
- runtime audit retained `previousLandKey='arid'`.

Polar then configured successfully with an exact canonical spell-ID set matching the current server option. This checks the complete package replacement rather than assuming land spell sets are disjoint.

### Later Long Rest / encounter lock

A third Long Rest expired Polar and reopened configuration.

An active encounter containing the Druid was created inside the rollback fixture. Temperate selection was rejected while the encounter was active.

After resolving the encounter, Temperate configured successfully.

### Non-Land Druid

A synthetic XPHB Circle of the Moon Druid:

- receives `available=false`;
- cannot configure Circle Spells.

### Fail-closed cases

Five rejected cases were proven:

1. configuration before a post-acquisition Long Rest;
2. invalid land key;
3. second land choice using the same Long Rest;
4. configuration during an active encounter;
5. non-Circle-of-the-Land configuration.

## Final production integrity

After rollback:

- migrations 58 and 59 registered;
- source-derived land count = 4;
- live QA `circle-of-the-land` runtime rows = 0;
- live QA Circle class-feature spell rows = 0;
- synthetic Circle proof characters = 0;
- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 0 open level-up sessions;
- 20 locations;
- 4 map routes;
- 9 map route points.

ACL design:

- public getter/configure: owner/postgres + authenticated + service_role;
- private source-parser, eligibility, acquisition, expiry, and trigger helpers: owner/postgres + service_role only.

## Status

Circle of the Land Long-Rest land/spell-package authority is **complete and live**.

Do not add Arid/Polar/Temperate/Tropical as a permanent Character Forge choice, and do not duplicate the Circle spell matrix in application code.

The remaining cadence-specific feature to inspect is Steps of the Fey, whose source choice is expected to be per-use rather than rest-stored; its exact live source row must be inspected before implementation.

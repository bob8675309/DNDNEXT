# Primal Companion Runtime Status

Status date: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)
Live migration: 55

## Scope

This document is the controlling evidence for XPHB Ranger / Beast Master **Primal Companion** runtime choice authority.

Primal Companion is not a permanent Character Forge form selection. The feature exists at Ranger 3 / Beast Master and the character can choose an initial primal beast immediately. Later, whenever a newer Long Rest has been completed, the current companion may be replaced once.

The current beast **persists until changed**. Long Rest does not automatically expire or dismiss it.

This persistence model intentionally differs from Astral Trance, whose temporary proficiencies expire when the next Long Rest finishes.

## Source-backed runtime state

Eligibility is derived from canonical `character_progression` plus `class_catalog`:

- class = Ranger;
- class source = XPHB;
- class level >= 3;
- subclass = Beast Master after canonical normalization;
- subclass source = XPHB.

The runtime row uses:

- `feature_key='primal-companion'`;
- `feature_name='Primal Companion'`;
- `source='XPHB'`;
- `cadence='long_rest'`.

The character-sheet projection is:

`sheet.runtimeCompanions.primalCompanion`

No value is written to permanent `classFeatureChoices`.

## Companion forms

Migration 55 exposes exactly three source forms:

- Beast of the Land;
- Beast of the Sea;
- Beast of the Sky.

The player also records the companion's animal appearance as 1-80 characters, such as `gray wolf`, `giant otter`, or `red-tailed hawk`.

There is currently no normalized creature/bestiary table in the production schema. This cadence slice therefore owns only the source choice and current companion identity. It does not invent a duplicate creature-statblock database or create a tactical/minion entity.

Actual companion creature/minion/tactical materialization remains a later integration concern.

## Initial summon semantics

An eligible Beast Master with no current runtime row receives:

- `configured=false`;
- `canConfigure=true`;
- `canReplace=false`.

The initial Land/Sea/Sky + appearance choice can be configured immediately. A prior Long Rest is not required.

The initial selection's replacement anchor is its configuration time, so only a future Long Rest can authorize the first replacement.

## Long-Rest replacement semantics

The getter compares the latest completed Long Rest with the runtime row's `replacement_anchor_at`.

When a current companion exists:

- no newer Long Rest → replacement rejected;
- newer Long Rest → `canReplace=true`;
- one replacement succeeds and moves the replacement anchor to that Long Rest;
- another replacement using the same Long Rest is rejected.

Long Rest does **not** clear `runtimeCompanions.primalCompanion` and does not set the current companion to unconfigured.

If the player does not use the replacement opportunity, the current companion remains active.

The replacement state retains `previousCompanion` with the prior stat-block key/name and appearance for audit/history.

## Short Rest

Short Rest does not unlock replacement and does not change the current companion.

## Active-encounter lock

`configure_character_primal_companion_v1` calls `private.character_active_encounter_v1`.

If the character is a non-defeated participant in an active encounter, companion initial/replacement configuration is rejected.

This prevents the delayed sheet-side post-rest UI from being used to swap the combat companion mid-encounter.

## Public RPCs

### `get_character_primal_companion_v1(character_id)`

Returns:

- availability;
- current configured state;
- initial `canConfigure` state;
- `canReplace` state after a newer Long Rest;
- latest Long-Rest timestamp;
- replacement anchor;
- current companion state;
- the three source form options;
- helper text describing the persistence/replacement cadence.

Caller must satisfy `can_manage_character_progression_v1`.

### `configure_character_primal_companion_v1(character_id, stat_block_key, appearance)`

Validates:

- caller progression permission;
- XPHB Ranger 3+ / Beast Master eligibility;
- no active encounter;
- Land/Sea/Sky source form;
- 1-80 character appearance;
- newer Long Rest for replacements;
- one replacement per Long-Rest anchor.

It updates only the generic runtime feature row and the character-scoped sheet projection.

## Character-sheet UI

`CharacterPrimalCompanionPanel.js` is mounted by `CharacterSheetPanel.js`.

The panel:

- only probes Ranger 3+ sheets, then lets the server verify Beast Master eligibility;
- shows the current form and appearance;
- offers `Summon Initial Companion` before first configuration;
- offers `Summon Replacement` only when the server reports a newer Long-Rest opportunity;
- explains that the current beast persists until replaced;
- refreshes the canonical character sheet after configuration.

No Primal Companion form state was added to Character Forge core/controller/derived state. The dedicated validator enforces that exclusion.

## Validation / build gate

`scripts/validate_primal_companion_runtime.mjs` validates:

- canonical XPHB Ranger 3+ / Beast Master eligibility;
- Land/Sea/Sky source options;
- immediate initial configuration;
- newer-Long-Rest replacement requirement;
- current-companion persistence;
- no Long-Rest expiry trigger;
- one replacement per rest anchor;
- active-encounter lock;
- appearance validation;
- runtime sheet projection;
- Forge persistent-choice exclusion;
- protected world-map/travel boundaries.

The dedicated `Validate Primal Companion runtime` workflow runs that semantic validator, unified Character Forge validation, and the full repository production build gate.

Before deployment, migration 55 also compiled successfully against the live Supabase schema inside an explicit rollback transaction.

The exact deployment candidate was green across all twelve relevant shared workflows, including Primal Companion, Astral Trance, starting magic/equipment, Spell Mastery, NPC Forge, and progression validators.

## Rollback-only behavior proof

The deployed migration was exercised with a synthetic XPHB Ranger 3 / Beast Master whose progression row was automatically derived from canonical sheet metadata.

Because PostgreSQL `now()` is transaction-stable inside one rollback transaction, the synthetic Long-Rest timestamps were advanced after the public rest RPC calls to model genuinely later API transactions. Runtime code was not weakened for the test.

### Initial state

Verified:

- available=true;
- configured=false;
- canConfigure=true;
- canReplace=false;
- exactly three forms.

### Initial companion

Configured:

- Beast of the Land;
- appearance `gray wolf`.

Verified:

- runtime sheet projection exists;
- no permanent `classFeatureChoices` entry is created;
- immediate replacement is rejected because no newer Long Rest exists.

### Short Rest

After `complete_character_rest_v1(..., 'short_rest')`:

- Land / gray wolf remains current;
- replacement remains unavailable.

### First newer Long Rest

After a genuinely newer Long-Rest timestamp:

- Land / gray wolf remains current;
- replacement becomes available.

Before the successful replacement, the proof also verified that:

- invalid stat-block key is rejected;
- appearance longer than 80 characters is rejected;
- those failed submissions do not consume the replacement opportunity.

Then Land / gray wolf was replaced with:

- Beast of the Sea;
- appearance `giant otter`.

Verified:

- previous Land / gray wolf state retained in `previousCompanion`;
- replacement opportunity closes for that same rest;
- a second same-rest replacement is rejected.

### Second newer Long Rest

Sea / giant otter persisted through the rest and replacement reopened.

An active encounter containing the character was created inside the rollback fixture. Replacement was rejected while the encounter was active.

After resolving that encounter, replacement to:

- Beast of the Sky;
- appearance `red-tailed hawk`

succeeded.

### Non-Beast-Master

A synthetic XPHB Ranger 3 / Hunter:

- receives `available=false`;
- cannot configure Primal Companion.

### Fail-closed cases

Six rejected cases were proven:

1. immediate replacement without a newer Long Rest;
2. invalid companion form;
3. overlong appearance;
4. second replacement using the same Long Rest;
5. replacement during an active encounter;
6. non-Beast-Master configuration.

## Final production integrity

After rollback:

- migration 55 registered;
- source options = 3;
- live QA `primal-companion` runtime rows = 0;
- synthetic Primal Companion characters = 0;
- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 0 open level-up sessions;
- 20 world locations;
- 4 map routes;
- 9 map route points.

ACL audit:

- public getter/configure: owner/postgres + authenticated + service_role;
- private eligibility/options helpers: owner/postgres + service_role only.

## Status

Primal Companion runtime choice/replacement authority is **complete and live**.

Do not add Land/Sea/Sky as a permanent Character Forge choice.

A future companion/minion/tactical slice may materialize the selected runtime identity into an actual controlled creature, but that should consume this authority rather than create a second companion-choice source of truth.

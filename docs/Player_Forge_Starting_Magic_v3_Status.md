# Player Forge v3 Starting Magic Status

Status date: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)
Live migrations: 47-48

## Scope

This document is the controlling evidence for the shared Player Forge Spell-step creation boundary after migration 47 (`player_forge_starting_magic_v3_completion`) and migration 48 (`player_forge_v3_acl_cleanup`). It covers native class spells, Background-expanded class access, and XPHB Eldritch Knight / Arcane Trickster starting spellcasting.

Species, feat, and unrelated class-feature spell grants remain owned by their separate source systems. This slice did not merge those sources into the Spell-step RPC.

## Frontend authority

The shared Player Forge now completes player creation through:

`public.create_player_character_v3(p_payload, p_spell_choices, p_magic_selections)`

The Forge serializes the exact Spell-step state into `sheet.startingMagicSelections` with canonical spell id, source type, source key, access type, prepared state, level, source, and name.

The three Spell-step source models are:

- native class list: `source_type='class'`, `access_type='class-list'`;
- Background-expanded class access: `source_type='class'`, `access_type='background-expanded'`;
- Eldritch Knight / Arcane Trickster: `source_type='subclass'`, `access_type='subclass'` or `fixed`.

Arcane Trickster's fixed Mage Hand is included in the exact starting-magic payload rather than hidden from server authority.

`sheet.spells` intentionally remains a **class-source-only summary**. Subclass-source spell rows are represented authoritatively by `startingMagicSelections` / `character_spells` rather than being forced into the old class-only summary guard.

## v2 compatibility boundary inside v3

`create_player_character_v3` still delegates common character creation to the guarded v2 function, but v2 is no longer the frontend endpoint.

The client supplies v2-compatible proxy choices only for ordinary native class-list spells. It does not pass subclass spells or Background-expanded spells as native class choices.

For a Background-expanded selection, v3 temporarily supplies a same-level preferred native class spell solely so v2 can perform its historical spell-count/preparation validation. After v2 succeeds, migration 47 removes only rows created by `shared_character_forge_player_v2` and materializes the exact v3 rows.

The deletion is deliberately narrow; it does not wipe unrelated species, feat, Savant, class-feature, or future source-owned spell rows.

## Server validation

Migration 47 validates every exact starting-magic row against preferred spell catalogue data and rejects duplicate canonical spell ids.

### Native class spell

Requires the selected spell to be on the chosen class list. The server normalizes source key/label and casting stat from the canonical class record.

### Background-expanded class spell

Requires the exact spell name to appear in `sheet.backgroundExpandedSpells`. The spell still consumes the normal class spell-count slot and is stored as class-source spellcasting with `accessType='background-expanded'`.

The spell does not need to appear on the native class list; that is the purpose of the expanded access.

### Eldritch Knight / Arcane Trickster

Only XPHB Fighter + Eldritch Knight and XPHB Rogue + Arcane Trickster may submit subclass-source Spell-step rows.

All selected spells must be Wizard-list spells and use Intelligence as the casting stat.

The deferred starting-spell validator now understands the subclass progression model instead of rejecting Fighter/Rogue merely because the base class has no `spellcasting_ability`.

At level 3:

- Eldritch Knight: 2 cantrips + 3 prepared level-1 spells;
- Arcane Trickster: 3 cantrips total, including fixed Mage Hand exactly once, + 3 prepared level-1 spells.

The validator also models the higher-level cumulative cantrip, leveled-spell, preparation, and maximum-spell-level requirements through level 20.

## Exactness / ownership

Every v3 Spell-step assignment is marked:

- `raw_payload.creator='shared_character_forge_player_v3'`;
- `raw_payload.startingMagic=true`;
- `raw_payload.grantedAtCreationLevel=<starting level>`;
- `raw_payload.accessType=<class-list|background-expanded|subclass|fixed>`.

The existing exactness validator compares `sheet.startingMagicSelections` to the materialized starting-magic rows, including spell id, source type, source key, and prepared state.

Cantrips are prepared/always available. Leveled preparation remains source/model-driven.

## ACL boundary

Migration 47 retained a stale explicit `anon` execute grant inherited from the earlier v3 function. The function itself still rejected anonymous callers through `auth.uid() IS NULL`, so the grant did not provide an anonymous creation bypass.

Migration 48 removes that stale grant.

`create_player_character_v1`, `v2`, and `v3` now expose the same intended execute surface:

- `authenticated`;
- `service_role`;
- owner/postgres.

No `anon` execute grant remains on v3.

## CI / build evidence

Exact-head validation for this slice includes:

- `scripts/validate_player_forge_starting_magic_v3.mjs`;
- `scripts/validate_unified_character_forge.mjs`;
- updated Character Forge resilience/security/tactical-resource regression contracts;
- dedicated `Validate Player Forge v3 starting magic` GitHub Action;
- dependency installation through `npm ci`;
- repository production `npm run build:vercel` gate with validation environment variables.

The dedicated starting-magic workflow passed its semantic validators and full production build before migration 47 was applied. Migration 47's replacement functions were also compiled against live production schema inside an explicit transaction and rolled back before deployment.

## Rollback-only production proofs

All successful and rejected cases were executed through the real authenticated public `create_player_character_v3` RPC inside rollback transactions.

### Native Wizard

A level-1 XPHB Wizard was created with:

- 3 Wizard cantrips;
- 6 level-1 Wizard spellbook spells;
- exactly 4 prepared leveled spells.

Verified:

- 9 exact v3 starting-magic rows;
- all rows used class source and Intelligence;
- no `shared_character_forge_player_v2` proxy row survived;
- cantrip/preparation counts passed every deferred Player Forge guard.

### Background-expanded Wizard

A level-1 Wizard used **Entangle** as a Background-expanded spell. Entangle's preferred catalogue row is Druid/Ranger, not Wizard, making this a real non-native expansion proof.

Verified:

- Entangle consumed one of the Wizard's six normal level-1 spellbook selections;
- the temporary native proxy did not survive;
- exact Entangle row was `source_type='class'`, `source_key='wizard'`, `casting_stat='int'`, `accessType='background-expanded'`;
- exact Wizard preparation count remained valid.

### Eldritch Knight

A level-3 Fighter / Eldritch Knight was created through v3 with no native Fighter spell proxy.

Verified:

- 5 exact subclass-source rows;
- 2 Wizard cantrips;
- 3 prepared level-1 Wizard spells;
- Intelligence casting;
- no class-source spell residue.

### Arcane Trickster

A level-3 Rogue / Arcane Trickster was created through v3.

Verified:

- 6 exact subclass-source rows;
- Mage Hand exactly once with `accessType='fixed'`;
- 2 additional Wizard cantrips;
- 3 prepared level-1 Wizard spells;
- Intelligence casting.

### Fail-closed cases

Rollback proofs also rejected atomically:

- a Background-expanded spell not declared by the sheet's expanded list;
- an invalid Arcane Trickster `fixed` spell;
- duplicate exact starting-magic spell selection.

Each rejection left no character or spell-row residue from v2's temporary work.

## Final production integrity

After all rollback fixtures and migration 48:

- 7 characters;
- 7 character sheets;
- 30 character-spell assignments;
- 7 character-progression rows;
- 0 open level-up sessions;
- 0 synthetic `__v3_*` characters;
- 0 live `startingMagic=true` rows from QA fixtures;
- 20 world locations;
- 4 map routes;
- 9 map route points.

No world-map, town/city-map, travel/weather, tactical combat, or crafting behavior was changed.

## Status

Guarded multi-source Player Forge Spell-step integration is **complete and live**. Do not return the frontend to `create_player_character_v2`.

The next broader PR #170 blockers are source-backed starting equipment / higher-level starting wealth, character-scoped starting currency, remaining runtime cadence families, Artificer wildcard Magic Item Plan instances, final persistent-choice/conditional-UI audit, legacy progression RPC cleanup, and authenticated browser acceptance.

# Dread Allegiance Runtime Status

Status date: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)
Live migration: 56

## Scope

This document is the controlling evidence for XPHB Rogue / Scion of the Three **Dread Allegiance** runtime authority.

Dread Allegiance is not a permanent Character Forge choice. The initial allegiance can be chosen immediately when the level-3 subclass feature exists. The current allegiance persists until changed. A newer Long Rest permits one change.

Changing allegiance changes one linked package atomically:

- Bane -> Psychic resistance + Minor Illusion;
- Bhaal -> Poison resistance + Blade Ward;
- Myrkul -> Necrotic resistance + Chill Touch.

The cantrip uses Intelligence as its spellcasting ability, matching the source feature.

## Eligibility

`private.character_has_dread_allegiance_v1(character_id)` uses canonical progression state:

- class = Rogue;
- class source = XPHB;
- class level >= 3;
- subclass = Scion of the Three after canonical normalization;
- subclass source = XPHB.

A non-Scion Rogue receives `available=false` and cannot configure the feature.

## Runtime state

The generic runtime row uses:

- `feature_key='dread-allegiance'`;
- `feature_name='Dread Allegiance'`;
- `source='XPHB'`;
- `cadence='long_rest'`.

The character-sheet projection is:

`sheet.runtimeFeatures.dreadAllegiance`

The current state includes allegiance identity, resistance, cantrip id/name, Intelligence casting stat, configuration timestamps, and previous-allegiance audit state after replacement.

No Dread Allegiance value is written into permanent Character Forge choice fields.

## Persistence / replacement cadence

The initial choice requires no prior rest.

The initial runtime row anchors replacement eligibility at its configuration timestamp. The current allegiance then remains active until the player actually changes it.

A later completed Long Rest opens one replacement opportunity when its timestamp is newer than `replacement_anchor_at`.

Successful replacement moves the anchor to that Long Rest. A second change using the same rest is rejected.

Short Rest does not unlock replacement and does not change the current allegiance.

Long Rest does not auto-expire the current allegiance.

This persistence model matches Primal Companion and intentionally differs from Astral Trance.

## Linked cantrip authority

Migration 56 materializes the selected cantrip as a real `character_spells` row so normal sheet/spell/action readers consume the same source of truth.

The assignment uses:

- `source_type='class-feature'`;
- `source_key='dread-allegiance'`;
- `source_label='Dread Allegiance'`;
- `known=true`;
- `prepared=true`;
- `always_available=true`;
- `casting_stat='int'`;
- `raw_payload.runtimeFeatureKey='dread-allegiance'`.

On allegiance change, only the prior Dread Allegiance feature-spell row is deleted and the new preferred XPHB cantrip row is inserted.

This does not create a Rogue `source_type='class'` spell row and therefore does not contaminate ordinary Rogue/starting-spell authority.

## Runtime resistance authority

`private.character_runtime_damage_resistances_v1(character_id)` currently derives configured Dread Allegiance resistance from generic runtime state.

This helper is the canonical runtime-resistance source for this feature.

Protected-boundary note: migration 56 does **not** modify `encounter_participants`, tactical participant snapshot functions, or combat damage functions. Therefore the resistance is authoritative runtime/sheet state but is not yet copied into tactical encounter snapshots by this Character Forge/runtime slice.

A later tactical integration may consume `character_runtime_damage_resistances_v1`; it should not create a second Dread Allegiance source of truth.

## Active-encounter lock

`configure_character_dread_allegiance_v1` uses `private.character_active_encounter_v1`.

If the character is a non-defeated participant in an active encounter, allegiance changes are rejected. This prevents the delayed sheet-side Long-Rest UI from swapping resistance/cantrip packages mid-encounter.

## Public RPCs

### `get_character_dread_allegiance_v1(character_id)`

Returns:

- availability;
- configured state;
- initial `canConfigure` state;
- newer-Long-Rest `canReplace` state;
- latest Long Rest;
- replacement anchor;
- current allegiance package;
- all three source options;
- derived runtime resistance array.

Caller must satisfy `can_manage_character_progression_v1`.

### `configure_character_dread_allegiance_v1(character_id, allegiance_key)`

Validates:

- caller permission;
- XPHB Rogue 3+ / Scion eligibility;
- no active encounter;
- Bane/Bhaal/Myrkul source option;
- preferred XPHB cantrip availability;
- newer Long Rest for replacements;
- one replacement per rest anchor.

It changes the runtime row, exact feature-spell assignment, and character-scoped sheet projection in one transaction.

## Character-sheet UI

`CharacterDreadAllegiancePanel.js` shows:

- current allegiance;
- current damage resistance;
- current Intelligence-based cantrip;
- the three linked allegiance packages;
- `Choose Allegiance` for initial configuration;
- `Change Allegiance` after a server-authorized newer Long Rest.

It is composed through the already-mounted runtime-choice surface rather than adding a new permanent Forge step.

The dedicated validator confirms no `dreadAllegiance` / `Dread Allegiance` choice state was added to Character Forge core/controller/derived state.

## Validation / build gate

`scripts/validate_dread_allegiance_runtime.mjs` validates:

- canonical XPHB Rogue 3+ / Scion eligibility;
- exact Bane/Bhaal/Myrkul source packages;
- preferred XPHB cantrip resolution;
- `class-feature` spell provenance;
- Intelligence casting;
- runtime resistance helper;
- immediate initial configuration;
- persistent current allegiance;
- newer-Long-Rest one-change rule;
- active-encounter lock;
- no auto-expiry trigger;
- no tactical participant/combat mutation in this protected slice;
- Forge persistent-choice exclusion;
- protected world boundaries.

The dedicated workflow also runs unified Character Forge validation and the full repository production build gate.

Before deployment, migration 56 compiled successfully against the live Supabase schema inside an explicit rollback transaction, including the feature-spell delete/insert path.

## Rollback-only behavior proof

The deployed migration was exercised with a synthetic XPHB Rogue 3 / Scion of the Three whose progression row was derived from canonical sheet metadata.

As with the Primal Companion single-transaction proof, synthetic Long-Rest timestamps were advanced after public rest calls because PostgreSQL `now()` is transaction-stable. Runtime code was not weakened.

### Initial Bane allegiance

Configured immediately:

- allegiance = Bane;
- resistance = Psychic;
- cantrip = Minor Illusion;
- casting stat = Intelligence.

Verified:

- exactly one Dread Allegiance `class-feature` spell row;
- no ordinary Rogue class-spell row created;
- runtime resistance helper returns only `psychic`;
- sheet runtime projection contains Bane.

Immediate replacement was rejected.

### Short Rest

Bane remained active and replacement stayed locked.

### Newer Long Rest / Bhaal

The newer Long Rest preserved Bane and opened replacement.

An invalid `cyric` submission was rejected without consuming the opportunity.

Replacing Bane with Bhaal atomically changed:

- resistance -> Poison;
- cantrip -> Blade Ward.

Verified:

- previous Bane state retained in `previousAllegiance`;
- only one Dread feature-spell row exists;
- Minor Illusion Dread row is gone;
- runtime resistance helper now returns only `poison`;
- a second same-rest replacement is rejected.

### Second newer Long Rest / Myrkul

The current Bhaal package persisted through the rest and replacement reopened.

An active encounter containing the character was created inside the rollback fixture. Replacement was rejected while the encounter was active.

After resolving the encounter, Myrkul succeeded:

- resistance -> Necrotic;
- cantrip -> Chill Touch.

### Non-Scion

A synthetic XPHB Rogue 3 / Thief:

- receives `available=false`;
- cannot configure Dread Allegiance.

### Fail-closed cases

Five rejected cases were proven:

1. immediate replacement without a newer Long Rest;
2. invalid allegiance key;
3. second replacement using the same Long Rest;
4. replacement during an active encounter;
5. non-Scion configuration.

## Final production integrity

After rollback:

- migration 56 registered;
- source options = 3;
- live QA `dread-allegiance` runtime rows = 0;
- live QA Dread `class-feature` spell rows = 0;
- synthetic Dread characters = 0;
- protected character/sheet/spell/progression counts returned to baseline;
- world baseline remained 20 locations / 4 routes / 9 route points.

ACL design:

- public getter/configure: owner/postgres + authenticated + service_role;
- private eligibility/options/runtime-resistance helpers: owner/postgres + service_role only.

## Status

Dread Allegiance runtime choice/replacement and feature-cantrip authority are **complete and live**.

Do not add Bane/Bhaal/Myrkul as a permanent Character Forge choice.

Tactical resistance snapshot integration remains deliberately deferred to a tactical-authority slice because this runtime work does not authorize encounter/combat function changes.

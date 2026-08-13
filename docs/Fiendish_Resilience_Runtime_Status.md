# Fiendish Resilience Runtime Status

Status date: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)
Live migration: 57

## Scope

This document is the controlling evidence for XPHB Warlock / Fiend Patron **Fiendish Resilience** runtime authority.

Fiendish Resilience is not a permanent Character Forge choice. Its source cadence requires a Short or Long Rest before a resistance can be chosen. The current resistance then persists until changed, and a later Short or Long Rest permits one replacement.

Force is excluded from the selectable damage types.

## Eligibility

`private.character_has_fiendish_resilience_v1(character_id)` is source-driven rather than hardcoding a display subclass label.

It requires canonical progression whose class/source matches the imported XPHB `Fiendish Resilience` feature row and whose normalized subclass matches that feature's normalized subclass identity.

The character must have reached the feature's imported class level.

## Feature-acquisition anchor

The first resistance is intentionally **not** available immediately on gaining the feature.

`private.fiendish_resilience_acquired_at_v1(character_id)` derives when the feature became available:

1. for earned progression, it looks for the first `character_level_events` row crossing the imported Fiendish Resilience level;
2. the helper reads common level/timestamp keys from `to_jsonb(level_event)` so it remains compatible with the live audit schema;
3. for direct higher-level Forge creation where no earned level event exists, `characters.created_at` is the acquisition fallback.

A qualifying Short or Long Rest must have `completed_at > acquiredAt` before the initial resistance can be configured.

This prevents a historical rest completed before the feature was gained from authorizing the first choice.

## Damage-type options

Migration 57 exposes the 12 standard non-Force damage types:

- Acid
- Bludgeoning
- Cold
- Fire
- Lightning
- Necrotic
- Piercing
- Poison
- Psychic
- Radiant
- Slashing
- Thunder

Force is not present in the option list and a direct Force submission is rejected by the configure RPC.

## Runtime storage

The generic runtime row uses:

- `feature_key='fiendish-resilience'`;
- `feature_name='Fiendish Resilience'`;
- `source='XPHB'`;
- `cadence='short_or_long_rest'`.

The character-sheet projection is:

`sheet.runtimeFeatures.fiendishResilience`

Current state includes resistance key/name, configuration/rest timestamps, and previous resistance after replacement.

No permanent Character Forge class-feature choice is written.

## Shared runtime resistance authority

Migration 57 extends:

`private.character_runtime_damage_resistances_v1(character_id)`

so it derives configured runtime resistances from both:

- `dread-allegiance`;
- `fiendish-resilience`.

This helper is the canonical runtime-resistance adapter for these Character Forge/runtime features.

Protected-boundary note: this migration does **not** modify `encounter_participants`, encounter snapshot functions, or combat damage functions. Tactical code therefore does not yet consume this runtime helper automatically. A later tactical-authority slice may consume the helper; it should not create a second resistance source of truth.

## Initial configuration semantics

An eligible character with no runtime row receives:

- `configured=false`;
- `canConfigure=false` until a qualifying rest completed after acquisition;
- `canReplace=false`.

After a post-acquisition Short or Long Rest:

- `canConfigure=true`;
- one non-Force damage type can be selected;
- the runtime replacement anchor is set to that qualifying rest.

## Replacement semantics

The current resistance persists through later rests until the player actually changes it.

When the latest Short/Long Rest is newer than the runtime replacement anchor:

- `canReplace=true`;
- one replacement may be made;
- successful replacement moves the anchor to that rest;
- a second change using the same rest is rejected.

Both Short Rest and Long Rest can open the next replacement opportunity.

There is no auto-expiry rest trigger.

## Active-encounter lock

`configure_character_fiendish_resilience_v1` calls `private.character_active_encounter_v1`.

If the character is a non-defeated participant in an active encounter, changing resistance is rejected. This prevents the sheet-side rest UI from swapping a combat-relevant resistance mid-encounter.

## Public RPCs

### `get_character_fiendish_resilience_v1(character_id)`

Returns:

- availability;
- feature-acquisition timestamp;
- latest qualifying Short/Long Rest;
- configured state;
- initial `canConfigure` state;
- replacement `canReplace` state;
- replacement anchor;
- current runtime resistance;
- all 12 legal options;
- the combined runtime-resistance projection.

Caller must satisfy `can_manage_character_progression_v1`.

### `configure_character_fiendish_resilience_v1(character_id, damage_type)`

Validates:

- caller progression permission;
- imported XPHB Fiend subclass/level eligibility;
- no active encounter;
- legal non-Force damage type;
- a qualifying rest after feature acquisition for the first choice;
- a newer Short or Long Rest for replacement;
- one replacement per rest anchor.

It updates only the generic runtime row and character-scoped sheet projection.

## Character-sheet UI

`CharacterFiendishResiliencePanel.js` is composed through the existing runtime-choice host.

The panel:

- probes Warlock level 10+ sheets, while the server remains authoritative for the exact imported feature level/subclass;
- shows the current resistance;
- explains that the first choice requires a Short/Long Rest after gaining the feature;
- offers all legal non-Force damage types when configuration/replacement is allowed;
- explains that the current resistance persists until changed.

The dedicated validator confirms no Fiendish Resilience state was added to Character Forge core/controller/derived persistent state.

## Validation / build gate

`scripts/validate_fiendish_resilience_runtime.mjs` validates:

- source-driven XPHB eligibility;
- feature-acquisition timestamp handling;
- direct-higher-level fallback;
- exactly 12 non-Force damage types;
- Force exclusion;
- Short-or-Long-Rest cadence;
- first-use post-acquisition rest requirement;
- persistent current resistance;
- one replacement per newer rest;
- active-encounter lock;
- shared runtime-resistance helper;
- no rest-expiry trigger;
- no tactical participant/combat mutation;
- Forge persistent-choice exclusion;
- protected world boundaries.

The dedicated workflow also runs unified Character Forge validation and the full repository production build gate.

Before deployment, migration 57 compiled successfully against the live Supabase schema inside an explicit rollback transaction. The acquisition-time adapter compiled against the current level-event schema and the runtime table accepted the `short_or_long_rest` cadence value.

The exact branch candidate also passed the clean local Fiendish semantic validator, unified Forge validator, and production `build:vercel` gate before deployment.

## Rollback-only behavior proof

The deployed migration was exercised with a synthetic XPHB Warlock at the imported Fiendish Resilience feature level and with the imported Fiend subclass name.

The fixture resolved both level and subclass from `class_feature_catalog`, avoiding hardcoded source identity.

As with the earlier single-transaction cadence proofs, synthetic rest timestamps were advanced after public rest calls because PostgreSQL `now()` is transaction-stable. Runtime code was not weakened.

### Before qualifying rest

Verified:

- feature eligibility is true;
- acquisition timestamp exists;
- `canConfigure=false`;
- direct Fire configuration is rejected because no post-acquisition rest exists.

### First Short Rest / Fire

A Short Rest was advanced to a timestamp later than acquisition.

Verified:

- initial configuration becomes available;
- direct Force submission is rejected;
- Fire configures successfully;
- shared runtime-resistance helper returns only `fire`;
- sheet runtime projection contains Fire;
- no permanent `classFeatureChoices` field is created;
- same-rest Cold replacement is rejected.

### Later Long Rest / Cold

The newer Long Rest preserved Fire and opened replacement.

Replacing Fire with Cold:

- succeeds;
- records `previousResistance='fire'`;
- updates the shared runtime-resistance helper to only `cold`.

### Later Short Rest / Lightning

A later Short Rest preserved Cold and opened another replacement.

An active encounter containing the character was then created inside the rollback fixture. Lightning replacement was rejected while the encounter was active.

After resolving the encounter:

- Cold -> Lightning succeeds;
- `previousResistance='cold'`;
- shared runtime helper returns only `lightning`.

### Non-Fiend Warlock

A synthetic XPHB Warlock with a different subclass:

- receives `available=false`;
- cannot configure Fiendish Resilience.

### Fail-closed cases

Five rejected cases were proven:

1. configuration before a post-acquisition rest;
2. Force selection;
3. second change using the same qualifying rest;
4. replacement during an active encounter;
5. non-Fiend configuration.

## Final production integrity

After rollback:

- migration 57 registered;
- option count = 12;
- Force present = false;
- live QA `fiendish-resilience` runtime rows = 0;
- synthetic Fiendish proof characters = 0;
- protected character/sheet/spell/progression counts returned to baseline;
- world baseline remained 20 locations / 4 routes / 9 route points.

ACL design:

- public getter/configure: owner/postgres + authenticated + service_role;
- private eligibility/acquisition/options/runtime-resistance helpers: owner/postgres + service_role only.

## Status

Fiendish Resilience runtime choice/replacement authority is **complete and live**.

Do not add Fiendish Resilience as a permanent Character Forge choice.

Tactical consumption of `character_runtime_damage_resistances_v1` remains intentionally deferred until encounter/combat work is explicitly in scope.

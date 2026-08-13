# Cartomancer Runtime Status

Status date: 2026-08-09
PR: #170 (`agent/character-forge-resilience-presentation`)
Live migrations: 72-73

## Scope

This ledger is the controlling evidence for BMT **Cartomancer** permanent Card Tricks spell authority and Long-Rest **Hidden Ace** selection/runtime state.

The source feature has two separate authority types:

- **Card Tricks** permanently grants Prestidigitation.
- **Hidden Ace** is selected when a Long Rest finishes, must be a spell from the character's class spell list with a casting time of 1 Action and a level for which the character has spell slots, and remains imbued in the card for 8 hours.

The source also permits casting the imbued spell as a Bonus Action, after which the card loses its magic. That cast/consume behavior belongs to spell/action execution and is intentionally **not implemented in this non-combat slice**.

## Permanent Prestidigitation parity

The imported feat originally stored Prestidigitation under generic `metadata.additionalSpells`.

That generic advancement path rejects unsupported feat families before the normalized feat instance is created. Migration 72 therefore normalizes Cartomancer differently without changing the raw source payload:

- `metadata.cartomancerFixedSpells = ['Prestidigitation|XPHB']`
- `metadata.additionalSpells = []`
- `raw_payload.additionalSpells` remains the imported source data.

`normalizeFeatSourceChoiceGroups` restores `Prestidigitation|XPHB` to the direct Forge `fixedSpellTokens` presentation/serialization.

A Cartomancer-specific `AFTER INSERT` trigger on `character_option_grant_instances` materializes exactly one normalized `character_spells` row for Prestidigitation:

- `source_type='feat'`
- `source_key=<feat instance key>`
- `source_label='Cartomancer • Card Tricks'`
- known/prepared/always-available
- casting stat = the character's canonical class spellcasting ability.

Because both direct Forge and earned advancement create the same normalized feat-instance row, both paths converge on the same Prestidigitation trigger.

## Hidden Ace spell eligibility

`private.cartomancer_hidden_ace_spell_options_v1(character_id)` derives the option list only from canonical normalized authority:

- active class from `character_progression` + `class_catalog`;
- preferred spells from `spells_catalog_preferred`;
- class membership from `spells_catalog.classes[]`;
- spell level 1-9;
- actual character slot level from `character_spell_slots` with `slots_max > 0`;
- casting time JSON containing exactly `1 action`.

Hidden Ace does not require the spell to already be known/prepared and does not create permanent `character_spells` membership for the selected card.

## Hidden Ace runtime state

Each Cartomancer feat instance owns one runtime key:

`cartomancer-hidden-ace:<instance hash>`

A qualifying Long Rest after feat acquisition opens a selection window.

`configure_character_cartomancer_hidden_ace_v1` enforces:

- authenticated character management;
- exact Cartomancer feat-instance ownership;
- active-encounter lock;
- a completed canonical `long_rest` after feat acquisition;
- selection within 8 hours of that Long Rest;
- exact server-derived eligible spell ID;
- one Hidden Ace selection per Long-Rest cycle.

The state records:

- selected spell ID/name/source/level/school/casting time;
- `selectedAt` = qualifying Long Rest completion;
- `expiresAt = selectedAt + 8 hours`;
- `consumed=false`;
- `actionIntegration='deferred'`.

The selected card is projected under:

`sheet.runtimeFeatures.cartomancerHiddenAce`

A subsequent Long Rest removes the prior Hidden Ace runtime row and projection before opening a fresh selection cycle.

If the 8-hour window expires without another Long Rest, the getter reports the card inactive/expired and does not allow a replacement on the same rest cycle.

## Getter state correction

Migration 73 replaces `get_character_cartomancer_v1` with explicit `v_had_runtime` state detection so later SELECT statements cannot overwrite PL/pgSQL's implicit `FOUND` flag and misreport whether a Hidden Ace row exists.

## UI

`CharacterCartomancerPanel` is mounted through the shared character-sheet runtime host.

The panel shows:

- whether Prestidigitation is permanently owned;
- the current Hidden Ace spell and expiration;
- server-derived eligible spells grouped by level;
- whether the current Long Rest permits selection.

It intentionally provides **no cast/consume button**. The UI explicitly labels Bonus Action casting/consumption as deferred action integration.

## ACL / protected boundaries

Public Cartomancer RPCs explicitly revoke anonymous execute and grant authenticated/service-role execution only.

Private helpers/triggers are service-role-only.

This slice does not:

- modify inventory;
- touch `player_wallets`;
- write encounter participant state;
- implement Bonus Action casting/consumption;
- modify world-map, route, travel, weather, or crafting systems.

## Validation gates

Before deployment:

- migrations 72-73 compiled together against the live Supabase schema inside rollback;
- metadata normalized to fixed Prestidigitation + empty generic additional-spell dispatch while raw source stayed intact;
- permanent Prestidigitation trigger compiled against the character-spell authority guard;
- Hidden Ace class-list/slot/action-time filter compiled;
- grant/rest triggers and getter/configure RPCs compiled;
- dedicated Cartomancer semantic validation passed;
- unified Forge and progression v3 validation passed;
- dedicated production `build:vercel` gate passed;
- all shared workflows on the deployment head completed successfully.

## Live rollback proofs

### Earned permanent Card Tricks spell

A synthetic level-3 XPHB Wizard gained Cartomancer through the real `private.apply_character_level_advancement_v1(...,4,...)` helper.

Verified:

- normalized Cartomancer feat instance created with `instance_key='level-4-advancement'`;
- exactly one permanent feat spell row materialized;
- the spell was Prestidigitation;
- source ownership was the normalized feat instance;
- no other permanent Cartomancer spell row was created.

### Hidden Ace lifecycle

A synthetic XPHB Wizard used canonical spell-slot authority and the real Long-Rest command.

Verified:

- Hidden Ace unavailable before a qualifying Long Rest;
- qualifying Long Rest opened selection;
- Magic Missile was present as a valid level-1 Wizard 1-Action spell;
- Shield was absent/rejected because its casting time is Reaction;
- Magic Missile selection succeeded;
- runtime state reported active;
- `expiresAt` was exactly 8 hours after `selectedAt`;
- Magic Missile did not become permanent `character_spells` feat membership;
- second same-rest selection was rejected;
- synthetic expiration made the card inactive without reopening same-rest selection;
- next Long Rest removed the old runtime row and reopened a new cycle.

All fixtures were rolled back.

## Final production integrity

After all rollback fixtures:

- migrations 72 and 73 registered;
- 0 live Cartomancer Hidden Ace runtime rows;
- 0 live Cartomancer grant-instance QA rows;
- 0 live Cartomancer feat-spell QA rows;
- 0 synthetic Cartomancer characters;
- protected character/sheet/spell/progression/inventory and world-route baselines remained unchanged.

## Status

Cartomancer permanent Prestidigitation + Hidden Ace selection/runtime authority is **live and rollback-proven** through migrations 72-73.

Bonus Action casting/consumption remains intentionally deferred until spell/action execution is explicitly in scope.

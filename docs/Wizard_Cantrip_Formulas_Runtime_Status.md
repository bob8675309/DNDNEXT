# Wizard Cantrip Formulas Runtime Status

Updated: 2026-08-09

Status: **live and rollback-accepted through migration 77**

## Source authority

The imported source record is:

- feature: `Cantrip Formulas`;
- feature source: `TCE`;
- class: Wizard;
- class source: `PHB`;
- feature level: 3;
- `isClassFeatureVariant=true`;
- cadence: after finishing a Long Rest, one Wizard cantrip the character knows may be replaced with another cantrip from the Wizard spell list.

This source record is explicitly attached to the legacy PHB Wizard. It is **not** an XPHB Wizard feature. Current XPHB Wizards therefore remain ineligible.

No separate live optional-class-feature enablement state exists in the current platform. The imported TCE variant record is the source-backed PHB Wizard feature authority.

## Runtime model

Cantrip Formulas is not a one-time Character Forge choice. It is modeled as Long-Rest runtime authority.

Migration 77 adds:

- `private.wizard_cantrip_formulas_feature_level_v1()`;
- `private.wizard_cantrip_formulas_context_v1(character_id)`;
- `private.wizard_cantrip_formulas_options_v1(character_id)`;
- `private.sync_wizard_cantrip_formulas_projection_v1(character_id,state)`;
- `public.get_character_wizard_cantrip_formulas_v1(character_id)`;
- `public.configure_character_wizard_cantrip_formulas_v1(character_id,from_assignment_id,to_spell_id)`.

Normalized runtime receipt:

- table: `character_runtime_feature_choices`;
- feature key: `wizard-cantrip-formulas`;
- source: `TCE`;
- cadence: `long_rest`;
- replacement anchor: the Long Rest that authorized the successful replacement.

Sheet projection:

- `runtimeFeatures.wizardCantripFormulas`.

## Eligibility and acquisition

The runtime derives the feature level from `class_feature_catalog`; it does not hardcode an XPHB Wizard rule.

A character is eligible only when:

- the character progression row is Wizard;
- the selected class source is exactly `PHB`;
- the class level is at least the imported Cantrip Formulas feature level.

Acquisition timing uses the shared migration-76 helper:

`private.character_class_feature_acquired_at_v1(character_id,'wizard','PHB',feature_level)`.

That preserves earned-level chronology from `character_level_events` and direct higher-level creation from `character_progression.created_at`.

A Long Rest must be strictly newer than feature acquisition before the first replacement is allowed.

## Spell-assignment authority

Cantrip Formulas changes an existing **class-owned cantrip assignment in place**.

The outgoing row must:

- belong to the character;
- have `source_type='class'`;
- be `known=true`;
- resolve to a level-0 Wizard-list spell.

The replacement must:

- resolve through `spells_catalog_preferred`;
- be level 0;
- be on the Wizard spell list;
- not already be known by the character from any source;
- differ from the outgoing spell.

On success, migration 77 updates the selected `character_spells.spell_id` in place and preserves:

- the `character_spells.id` assignment identity;
- `source_type`;
- `source_key`;
- `source_label`;
- `known`;
- `prepared`;
- `always_available`;
- casting stat;
- any other ownership/resource columns not explicitly changed.

The runtime never inserts or deletes `character_spells` rows. This prevents Cantrip Formulas from manufacturing an extra known cantrip or detaching the assignment from its class authority.

## Rest and encounter rules

A successful replacement consumes the latest qualifying Long Rest for Cantrip Formulas.

The same Long Rest cannot authorize another successful replacement.

A strictly newer Long Rest reauthorizes one replacement.

Configuration is blocked while the character is in an active encounter.

Invalid attempts such as selecting an already-known replacement or attempting configuration during an encounter do not consume the Long-Rest replacement opportunity.

## Client composition

`CharacterWizardCantripFormulasPanel` is mounted downstream of `CharacterWizardMemorizeSpellPanel` through the always-reachable runtime chain hosted by `CharacterCurrencyBadge`.

The panel:

- loads `get_character_wizard_cantrip_formulas_v1`;
- remains absent for ineligible characters, including XPHB Wizards;
- shows the current PHB Wizard level/source context;
- allows selection of the outgoing class-owned assignment and a server-derived legal replacement;
- calls `configure_character_wizard_cantrip_formulas_v1` with the exact assignment ID and target spell ID;
- refreshes from the authoritative RPC result after a successful replacement.

All component state variables and RPC arguments are locally defined, and `characterId` is passed explicitly by the host.

## Validation gates

Before deployment:

- migration 77 compiled against the live schema inside `BEGIN ... ROLLBACK`;
- the source-derived feature level resolved to 3;
- a synthetic rollback lifecycle passed;
- exact-head Vercel passed;
- all 25 relevant GitHub Actions workflows passed;
- the dedicated Cantrip Formulas semantic validator passed;
- the dedicated production build gate passed.

The dedicated validator protects:

- PHB/TCE source gating;
- level-0 Wizard-list replacement rules;
- Long-Rest cadence;
- in-place assignment mutation;
- duplicate-known rejection;
- active-encounter lock;
- ACLs;
- host wiring;
- absence from permanent Forge choice groups;
- map/travel protected boundaries.

## Deployed rollback lifecycle proof

After migration 77 was applied, a synthetic direct-created PHB Wizard 3 and a control XPHB Wizard 3 were created inside a transaction and fully rolled back.

The deployed proof established:

- source-derived feature level = 3;
- PHB Wizard 3 is eligible;
- XPHB Wizard 3 is ineligible;
- before a qualifying Long Rest, configuration is locked;
- the first Long Rest was completed through `public.complete_character_rest_v1`;
- the Long Rest unlocks one replacement;
- Acid Splash → Fire Bolt succeeds;
- the exact `character_spells.id` survives the replacement;
- `source_type='class'`, `source_key='wizard'`, and `casting_stat='int'` survive the replacement;
- the character still has exactly two class cantrip rows;
- a second replacement on the same rest is rejected;
- attempting to replace Fire Bolt with the already-known Chill Touch is rejected without consuming the next valid opportunity;
- active encounter configuration is rejected;
- after a strictly newer Long Rest, Fire Bolt → Booming Blade succeeds;
- the assignment ID/source/casting stat still remain unchanged;
- another replacement on that same newer rest is rejected;
- exactly one normalized runtime receipt exists inside the fixture;
- `runtimeFeatures.wizardCantripFormulas.toSpell.name` resolves to `Booming Blade`.

As with prior rollback rest tests, the second synthetic rest receipt was given an explicitly later timestamp because PostgreSQL `now()` is transaction-stable inside one rollback transaction.

## ACL proof

Deployed ACL checks passed:

- `anon` cannot execute the getter;
- `anon` cannot execute the configure RPC;
- `authenticated` can execute both guarded public RPCs;
- `anon` cannot execute the private Cantrip Formulas context helper.

## Zero-residue production integrity

After the deployed rollback proof:

- characters: **7**;
- character sheets: **7**;
- character-spell rows: **30**;
- progression rows: **7**;
- inventory rows: **18**;
- live Cantrip Formulas runtime rows: **0**;
- Cantrip Formulas QA characters: **0**;
- locations: **20**;
- map routes: **4**;
- map route points: **9**.

No world-map, route/travel/weather, inventory/crafting, or tactical action state was changed.

## Deployment

Supabase registered migration 77 as:

- version: `20260809213738`;
- name: `wizard_cantrip_formulas_runtime`.

Source commit for the accepted migration/client/gate candidate:

- `1e9a9b59306a1e38c8a04bb484aa602f01a817d3` — `Model PHB Wizard Cantrip Formulas runtime`.

## Next work

Cantrip Formulas is accepted and should not be reopened without contradictory live/source evidence.

Continue the remaining class/subclass feature-family audit one bounded source-cadence slice at a time. The next candidate family should be inspected from source before deciding whether it belongs to permanent progression, rest runtime, or action-layer execution.

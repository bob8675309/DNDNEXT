# Species Rest Proficiency Runtime Status

Status date: 2026-08-09
PR: #170 (`agent/character-forge-resilience-presentation`)
Live migrations: 63-66

## Purpose

This ledger records the source-correct runtime authority for Species proficiency choices that can change after a Long Rest and therefore must not be frozen into permanent Character Forge state.

This slice covers:

- MPMM Githyanki — Astral Knowledge;
- EFA Khoravar — Skill Versatility.

The governing rule is unchanged: permanent creation choices belong to Forge/progression authority; Long-Rest-configurable choices belong to guarded runtime state.

## Githyanki — Astral Knowledge

Astral Knowledge is not a Character Forge proficiency choice.

After a completed Long Rest, an eligible MPMM Githyanki may choose:

- one skill proficiency; and
- one Player's Handbook weapon or tool proficiency.

The pair lasts until the next Long Rest finishes. That next Long Rest automatically removes both the runtime row and the sheet projection, after which a new pair may be chosen.

The option catalogues reuse the already-proven Astral Trance sources:

- 18 canonical skills;
- 74 source-legal PHB-equivalent weapon/tool choices;
- campaign firearm exclusions remain intact.

No permanent skill, weapon, or tool proficiency field is rewritten.

## Khoravar — Skill Versatility

EFA Khoravar Skill Versatility grants one skill or tool proficiency initially and allows that proficiency to be replaced after a Long Rest.

The initial choice is still made during Player Forge because the character begins with one active proficiency. However, the choice is serialized as a source-owned runtime selection and materialized into runtime authority rather than becoming a permanent proficiency mutation.

Current semantics:

- exactly one initial skill or tool choice;
- current choice persists until explicitly changed;
- an immediate replacement is rejected;
- a newer completed Long Rest opens one replacement opportunity;
- the replacement may switch between a skill and a tool;
- invalid catalogue keys fail closed.

Khoravar source identity is EFA throughout Forge, runtime UI, deferred materialization, and server validation.

## Storage and projection

Canonical runtime state is stored in `public.character_runtime_feature_choices`.

Feature keys:

- `githyanki-astral-knowledge`;
- `khoravar-skill-versatility`.

Display projections live under:

- `sheet.runtimeProficiencies.githyankiAstralKnowledge`;
- `sheet.runtimeProficiencies.khoravarSkillVersatility`.

The character sheet applies temporary skill proficiency additively through `utils/characterRuntimeProficiencies.js`. Runtime weapon/tool checks are also additive. Underlying permanent `sheet.proficiencies`, class training, Background training, and feat training are not replaced or rewritten.

## Character Forge integration

`utils/playerForgeSpeciesRuntimeChoices.js` post-processes the ordinary Species source-choice groups without rewriting the generic Species parser.

It:

- removes Githyanki Astral Knowledge from permanent Forge groups;
- removes the generic Khoravar Skill Versatility permanent group;
- adds the source-correct Khoravar mixed skill/tool runtime-initial group.

`NpcForgeFeatChoiceRegistrar` explicitly applies that post-processor and forwards the canonical tool catalogue.

A deferred `character_progression` constraint trigger materializes the initial Khoravar choice for shared Player Forge creation after the serialized source-choice payload exists.

## Sheet runtime UI

`CharacterSpeciesRestProficiencyPanel` is mounted directly from `CharacterSheetPanel`.

It exposes:

- Githyanki post-Long-Rest skill + PHB weapon/tool configuration;
- Khoravar current skill/tool state and post-Long-Rest replacement.

The existing Astral → Dread → Fiendish → Circle → Currency composition remains intact. Primal Companion remains a separate direct sheet mount.

## Migration history

### Migration 63 — Species runtime foundation

Added:

- Species/source eligibility helpers;
- canonical option helpers;
- encounter guard;
- public guarded getter/configuration RPCs;
- Githyanki expiry trigger;
- Khoravar Player Forge materializer;
- runtime projection helper.

Pre-deployment review caught and corrected source/client integration problems before this migration was applied: Khoravar is EFA, encounter participants use `is_defeated`, the Forge registrar must invoke the Species runtime post-processor, and the sheet must mount the runtime panel.

### Migration 64 — explicit RPC ACL cleanup

Supabase public-schema default privileges left explicit `anon` EXECUTE on the four newly created public RPCs even after revoking PostgreSQL `PUBLIC`.

Migration 64 explicitly revokes `anon` and `PUBLIC`, then grants only `authenticated` and `service_role`.

Live verification after migration 64:

- anonymous EXECUTE count: 0;
- authenticated EXECUTE count: 4.

### Migration 65 — canonical Long Rest key

DNDNext's canonical rest log values are `short_rest` and `long_rest`.

Migration 63 used the prose shorthand `long`; migration 65 corrected both:

- latest-Long-Rest lookup;
- Githyanki automatic-expiry trigger.

No real Species runtime row existed before this correction.

### Migration 66 — runtime projection parent compatibility

Rollback lifecycle testing exposed that a clean/legacy sheet without `runtimeProficiencies` did not receive a projection because `jsonb_typeof(missing_key)` returns SQL NULL.

Migration 66 normalizes that NULL with `coalesce(...)`, creates the parent object when absent, and then writes/removes the nested Species projection.

Again, no real Species runtime state existed when this correction was applied.

## Acceptance evidence

Dedicated CI:

- `Validate Species rest proficiency runtime`;
- Species semantic validator;
- Astral regression validator;
- unified Character Forge validator;
- production build gate.

The final migration-66 candidate was green across all 18 relevant PR workflows before deployment.

### Githyanki rollback lifecycle proof

Passed against deployed migrations 63-66:

- configuration before a Long Rest rejected;
- canonical `complete_character_rest_v1(..., 'long_rest')` unlocked configuration;
- one runtime row created;
- sheet projection created on a sheet that initially lacked `runtimeProficiencies`;
- permanent proficiencies unchanged;
- next canonical Long Rest deleted the runtime row;
- next canonical Long Rest removed the projection;
- transaction rolled back.

### Khoravar rollback lifecycle proof

Passed against deployed migrations 63-66:

- direct shared-Forge source selection materialized through the deferred progression trigger;
- initial `skill:acrobatics` runtime state and projection verified;
- immediate replacement rejected;
- invalid option rejected;
- newer canonical Long Rest unlocked replacement;
- replacement from skill to canonical tool succeeded;
- permanent proficiencies unchanged;
- transaction rolled back.

## Final zero-residue checkpoint

After all Species rollback fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 18 inventory rows;
- 0 live Githyanki/Khoravar runtime rows;
- 0 Species QA characters;
- 20 world locations;
- 4 routes;
- 9 route points.

Migrations 63, 64, 65, and 66 are registered live.

## Remaining related coverage audit

This milestone closes only the proficiency families above. The final source-choice audit still includes separate runtime/acquisition work such as:

- XPHB High Elf replaceable Wizard cantrip;
- EFA Khoravar Fey Gift replaceable cantrip;
- Eladrin season/trance choices;
- Boon of Energy Resistance;
- Echoing Soul / Zhentarim Tactics rest-configurable Expertise;
- Cartomancer Hidden Ace;
- remaining class/subclass runtime families already excluded from permanent Forge state.

Those should be handled as separate bounded slices rather than added to this accepted proficiency authority.

## Protected boundaries

No world-map, town/city-map, route/travel/weather, tactical encounter/combat, or unrelated crafting behavior is modified by this Species runtime slice. `components/MapPageClient.js` remains outside scope.

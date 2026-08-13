# Wizard Memorize Spell Runtime Status

Updated: 2026-08-09

Status: **live and rollback-accepted through migration 76**

## Scope

This ledger documents XPHB Wizard **Memorize Spell** and the compatibility repair required to make the already-deployed Wizard runtime RPCs executable against the live DNDNext schema.

Protected boundaries remained unchanged: no world-map, town/city-map, route/travel/weather, crafting/inventory, or tactical action-resolution behavior was modified by this slice.

## Source/cadence model

Memorize Spell is a **Short-Rest preparation-state feature**, not a permanent Character Forge choice.

At Wizard level 5, after a qualifying Short Rest, the character may replace one currently prepared level-1+ Wizard spell with another unprepared level-1+ spell already present in that Wizard's actual spellbook.

The runtime operation:

- changes only `character_spells.prepared` on the two existing spell rows;
- never inserts or deletes spellbook membership;
- never changes source identity, `known`, or `always_available` metadata;
- never allows an `always_available` spell to be chosen as the spell being unprepared;
- allows only one completed swap for a given qualifying Short Rest;
- blocks configuration while the character is in an active encounter.

## Migration sequence

### 74 — `wizard_memorize_spell_runtime`

Added:

- `private.wizard_memorize_spell_feature_level_v1()`;
- `private.wizard_memorize_spell_context_v1(character_id)`;
- `private.wizard_memorize_spell_options_v1(character_id)`;
- `private.sync_wizard_memorize_spell_projection_v1(character_id)`;
- `public.get_character_wizard_memorize_spell_v1(character_id)`;
- `public.configure_character_wizard_memorize_spell_v1(character_id, from_spell_id, to_spell_id)`;
- normalized runtime receipt under `character_runtime_feature_choices.feature_key='wizard-memorize-spell'`;
- sheet projection at `runtimeFeatures.wizardMemorizeSpell`.

### 75 — `wizard_memorize_spell_state_fix`

Made runtime-state detection deterministic by preserving whether the runtime row was found in an explicit `v_had_runtime` boolean before later SQL statements could change PL/pgSQL's implicit `FOUND` value.

### 76 — `wizard_runtime_helper_repair`

Post-deployment acceptance exposed two helper references that were absent from live Supabase:

- `private.can_manage_character_spell_resources_v1(uuid)`;
- `private.character_class_feature_acquired_at_v1(uuid,text,text,integer)`.

Migration 76 adds those contracts compatibly rather than rewriting deployed migration history.

The spell-resource authorization helper delegates to the existing canonical character edit rule in `private.can_manage_character_progression_v1(character_id)`. This also repairs the same previously unresolved dependency used by Wizard Spell Mastery.

The generic class-feature acquisition helper:

1. verifies the character currently has the requested class/source at or above the feature level;
2. uses the first `character_level_events` crossing of the feature level for earned progression;
3. falls back to `character_progression.created_at` for direct higher-level Forge creation.

The fallback deliberately does **not** use `characters.created_at`: that column does not exist in the live schema.

## Client composition

`CharacterWizardMemorizeSpellPanel` is mounted as an always-reachable downstream runtime panel from `CharacterCurrencyBadge` after the established Boon / feat-runtime / Cartomancer panels.

The currency badge continues to render its downstream runtime children even when no character currency balance exists, so currency eligibility cannot hide Memorize Spell.

## Validation and deployment evidence

Before migration 76 was applied:

- the candidate helper DDL compiled successfully inside a rolled-back live-schema transaction;
- a full candidate synthetic Wizard lifecycle passed inside rollback;
- the exact PR head passed all 24 relevant GitHub Actions workflows;
- the dedicated Memorize workflow passed semantic validation and its production build gate;
- the Wizard Spell Mastery workflow passed with migration 76 included in its dependency contract;
- Vercel reported success.

Migration 76 was then applied to production as `wizard_runtime_helper_repair`.

## Deployed rollback lifecycle proof

A synthetic direct-created XPHB Wizard 5 fixture was created and fully rolled back.

The deployed proof established:

- feature level resolves to 5;
- direct-created acquisition time resolves through `character_progression.created_at`;
- before a qualifying Short Rest, the getter is available but `canConfigure=false`;
- an actual `complete_character_rest_v1(character_id,'short_rest')` unlocks the feature;
- Burning Hands → Charm Person succeeds as the first preparation swap;
- the same Short Rest cannot authorize a second swap;
- Detect Magic marked `always_available=true` cannot be selected as the spell to unprepare;
- an active encounter blocks configuration;
- a newer Short-Rest timestamp reauthorizes exactly one swap;
- Charm Person → Burning Hands succeeds after that newer rest;
- that same newer rest cannot authorize another swap;
- the sheet runtime projection follows the final swap;
- spellbook membership/source identity remains byte-for-byte unchanged apart from the intended `prepared` flags;
- the fixture still has exactly three spellbook rows and one normalized runtime receipt before rollback.

Because PostgreSQL `now()` is transaction-stable, the rollback harness used the real public rest RPC for the first rest and advanced the second QA rest receipt by an explicit later timestamp so the newer-rest branch could be exercised without committing synthetic state.

## ACL proof

Deployed ACL checks passed:

- `anon` cannot execute the Memorize getter;
- `anon` cannot execute the Memorize configure RPC;
- `authenticated` can execute both guarded public RPCs;
- `anon` cannot execute either private helper added by migration 76.

## Shared Spell Mastery compatibility proof

A separate rolled-back level-18 Wizard fixture called `public.configure_character_spell_mastery_v1(...)` after migration 76.

The call succeeded through the repaired shared authorization helper, produced one Spell Mastery state row, kept exactly two spellbook rows, applied the expected prepared/always-available overlay, and returned an eligible/configured profile. The fixture was rolled back.

## Zero-residue production integrity

After both rollback fixtures:

- characters: **7**;
- character sheets: **7**;
- character-spell rows: **30**;
- progression rows: **7**;
- inventory rows: **18**;
- live Memorize runtime rows: **0**;
- Memorize QA characters: **0**;
- locations: **20**;
- map routes: **4**;
- map route points: **9**.

No world-map or tactical production state was changed.

## Next work

Memorize Spell migrations 74-76 are accepted and should not be reopened without contradictory live/source evidence.

The next bounded source-choice/runtime audit slice is **Cantrip Formulas**, followed by remaining class/subclass runtime families. Keep action-layer-only mechanics separate from non-combat rest/runtime storage.

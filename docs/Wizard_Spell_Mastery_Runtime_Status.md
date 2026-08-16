# Wizard Spell Mastery Runtime Status

Status date: 2026-08-14 historical reconciliation
Historical implementation PR: #170 (`agent/character-forge-resilience-presentation`) — merged at `599c4de7397ba6e4bbbb0a061d551d80c3570be7`
Live migration: `wizard_spell_mastery_runtime` (`sql/20260808_44_wizard_spell_mastery_runtime.sql`)

## Authority / precedence

This document remains the controlling evidence for XPHB Wizard **Spell Mastery** established during PR #170. Any older document that says Spell Mastery is pending predates migration 44 and should be read as historical.

This slice does not change the governing creation/progression parity rule: Spell Mastery is **not** a permanent level-18 Forge or level-up lock because the selected spells can change after a Long Rest.

## Source rule implemented

The live imported XPHB Wizard level-18 feature states that the Wizard chooses:

- one level-1 spell in the Wizard's spellbook with a casting time of an Action; and
- one level-2 spell in the Wizard's spellbook with a casting time of an Action.

Those spells are always prepared and can be cast at their lowest level without expending a spell slot. To cast either at a higher level, normal spell-slot rules still apply.

After each completed Long Rest, the Wizard may replace **one** mastered spell with another eligible spell of the same level.

## Runtime model

Migration 44 adds normalized runtime state in private schema:

`private.character_spell_mastery`

One row per character stores:

- current level-1 mastered spell;
- current level-2 mastered spell;
- initial configuration time;
- the Long Rest token consumed by the most recent replacement;
- update metadata.

The table is not exposed directly to `anon` or `authenticated` clients. Configuration goes through the guarded public RPC `configure_character_spell_mastery_v1`.

## Eligibility authority

`private.wizard_spell_mastery_candidate_v1` requires all of the following:

1. XPHB Wizard level 18+;
2. exact expected spell level (1 for the first slot, 2 for the second);
3. Wizard spell-list membership;
4. casting time normalized to `Action` / `1 Action`;
5. actual normalized Wizard spellbook membership through `wizard_spellbook_has_spell_v1`.

The final requirement means ordinary Wizard spellbook rows and Savant `class-feature` rows marked `wizardSpellbook=true` can qualify. A spell that merely exists in the global Wizard catalogue cannot be mastered unless this character actually has it in the spellbook.

## Spellbook / preparation overlay

Spell Mastery does **not** create another `character_spells` row and does not replace the original spellbook source identity.

The existing authoritative spellbook row is overlaid with:

- `prepared=true`;
- `always_available=true`;
- `raw_payload.spellMastery=true`;
- mastered spell level / feature metadata;
- the prior `prepared` and `always_available` values so they can be restored if that spell is later replaced.

Unlike Signature Spells, Spell Mastery has no finite `uses_max` / `uses_remaining` counter. It is an at-will lowest-level casting rule, so adding a fake one-use resource would be incorrect.

When a mastered spell is replaced, the old row has its prior preparation/availability state restored before the new same-level spell receives the overlay.

## Long-Rest replacement authority

Initial level-18+ configuration does not require a Long Rest. It also does not bank an old Long Rest as a future replacement token.

After configuration:

- the latest completed `character_rest_log` Long Rest must be newer than both the original configuration and the Long Rest consumed by the previous replacement;
- zero changes is a no-op;
- two changed mastered spells are rejected;
- exactly one same-level change is accepted when a fresh Long Rest token exists;
- the accepted replacement consumes that Long Rest token;
- a second replacement requires another completed Long Rest.

This uses the existing `complete_character_rest_v1` / `character_rest_log` authority rather than inventing another rest system.

## Active-encounter boundary

`configure_character_spell_mastery_v1` uses the existing character spell-resource permission guard and rejects configuration while `private.character_active_encounter_v1` reports an active encounter.

That preserves the existing rule that active battle-board state controls character spell resources/configuration while the encounter is active. No world-map, town-map, route, travel, weather, crafting, or unrelated encounter mutation was added.

## Character-sheet UI

`CharacterSheetResourceTracker` is the single player-facing runtime surface for this feature.

For an eligible level-18+ XPHB Wizard it now:

- derives level-1 and level-2 dropdowns entirely from the guarded resource profile;
- shows the initial `Set Spell Mastery` action when unconfigured;
- shows current mastered spells after configuration;
- unlocks exactly one selector after a new Long Rest;
- prevents changing both selectors in one replacement action;
- disables configuration while an active encounter owns the resource state;
- refreshes `character_sheet_resource_profile_v2` immediately after a completed rest;
- listens for `character_spells` changes for cross-client/runtime reconciliation;
- rewrites mastered spell quick-action text to `Spell Mastery • at will` rather than showing normal slot consumption.

No new wrapper prop chain or second resource component was introduced.

## Resource profile

Migration 44 extends the existing `character_sheet_resource_profile_v2` response with a `spellMastery` object while preserving its existing slot, limited-use, active-encounter, and Signature-resource behavior.

The profile reports:

- eligibility / reason;
- configured state;
- current level-1 and level-2 mastered spells;
- source-legal current spellbook options for both levels;
- latest Long Rest;
- whether one replacement is currently available;
- the one-spell same-level replacement rule;
- `atWill=true`.

Migration 43 (`wizard_signature_resource_labels`) remains separate and precedes this migration. Spell Mastery was renumbered to migration 44 specifically to avoid duplicate migration numbering and preserve that Signature-label work.

## Validation gates

Before production DDL was applied:

- the staged migration compiled successfully inside an explicit production transaction and was rolled back;
- `scripts/validate_wizard_spell_mastery_runtime.mjs` passed;
- existing Wizard Signature, Wizard Savant, and broader character-progression validators passed against the exact PR branch;
- the repository's full `npm run build:vercel` production build passed locally against the exact branch;
- the dedicated GitHub Action `Validate Wizard Spell Mastery runtime` passed, including its own `npm run build:vercel` gate;
- the duplicate staged `20260808_43_wizard_spell_mastery_runtime.sql` file was removed; migration 43 remains the Signature resource-label migration and migration 44 is Spell Mastery.

## Rollback-only production proofs

After migration 44 was applied, rollback fixtures verified the live functions against production schema/data contracts.

### Initial configuration / at-will overlay

A synthetic XPHB Wizard level 18 received multiple real level-1/2 Wizard spellbook rows.

Verified:

- the pre-configuration profile reported `eligible=true`, `configured=false`;
- initial configuration created exactly one private normalized configuration row;
- exactly the chosen level-1 and level-2 spellbook rows became prepared/always available;
- both rows carried `spellMastery=true`;
- neither received `uses_max` nor `uses_remaining`;
- total spellbook membership row count did not change.

### Long-Rest replacement chronology

Verified:

- replacing one mastered spell before a new Long Rest was rejected;
- a real `complete_character_rest_v1(..., 'long_rest')` call unlocked one replacement;
- replacing the level-1 mastered spell succeeded;
- the old level-1 spell's prior prepared/availability state was restored;
- the unchanged level-2 mastered spell remained intact;
- a second replacement without another Long Rest was rejected;
- after another Long Rest token, attempting to replace both mastered spells at once was rejected;
- replacing only the level-2 mastered spell then succeeded;
- the replaced level-2 spell's prior state was restored.

The proof adjusted synthetic rest timestamps only because PostgreSQL `now()` is transaction-stable inside one rollback transaction; real user Long Rests occur in later transactions and naturally have later timestamps.

### Fail-closed eligibility

Verified atomic rejection of:

- a wrong-level spell in the level-1 slot;
- a Wizard spell whose casting time is not an Action;
- an otherwise eligible Wizard Action spell that is not in this character's spellbook.

No rejected attempt created additional spellbook membership or changed the number of normalized mastery rows.

### Active encounter

Using an existing active encounter participant under the admin test identity, configuration was rejected through the existing active-encounter resource lock before any Spell Mastery mutation occurred.

## Final integrity

After all rollback fixtures:

- no synthetic Spell Mastery character survived;
- no rollback fixture left a real `character_spell_mastery` row;
- existing character/sheet/spell/progression counts remained at their protected baseline;
- world baseline remained 20 locations / 4 map routes / 9 map route points;
- no world-map source or `components/MapPageClient.js` change was made.

## Wizard progression status after migration 44

The Wizard-specific parity/runtime sequence is now:

- Savant earned progression — live;
- Savant higher-level Forge chronology — live;
- Signature Spells earned level-20 progression — live;
- Signature Spells direct level-20 Forge — live;
- Signature character-sheet free-cast resource labels — live (migration 43);
- Spell Mastery Long-Rest runtime configuration — live (migration 44).

Spell Mastery must remain runtime-configurable. Do not reintroduce it as a permanent Forge or level-up choice.

## Historical broader-PR blockers at this checkpoint

Wizard-specific feature parity is no longer the leading blocker. Remaining PR #170 work continues with the broader Forge closure items already tracked by the Character Forge status documents:

1. complete guarded multi-source starting-magic frontend integration where still incomplete;
2. source-backed starting equipment packages and higher-level starting wealth/equipment;
3. character-scoped starting currency for multi-character accounts;
4. Artificer wildcard Magic Item Plan concrete-item instances;
5. final preferred Species / Background / Class / Feat / Subclass persistent-choice coverage audit and conditional-choice UI polish;
6. audit/revoke obsolete authenticated progression RPC generations once confirmed unused;
7. final authenticated browser acceptance was still pending at this historical checkpoint; use the current handoff for present status.

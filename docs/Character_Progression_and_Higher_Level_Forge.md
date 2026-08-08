# Character Progression and Higher-Level Forge

Status: active architecture handoff for PR #170, reconciled 2026-08-08.

This document defines the shared authority contract between ordinary earned level-up and Character Forge creation above level 1. It describes **authoritative character-state transitions**, not the general class guide or player-facing presentation.

## Core invariant

There is one progression model for permanent acquisitions.

- Creating a character at level `N` must replay permanent decisions attained from level 1 through level `N`.
- Leveling a live character from `N` to `N + 1` applies only the next unresolved delta.
- Both paths use canonical class progression, source catalogues, normalized option instances, prerequisite semantics, and spell-source identity.
- Runtime/rest/per-use configuration is not persisted as a creation or level-up acquisition merely because source text contains choices.

Examples intentionally outside permanent progression include Weapon Mastery configuration, Astral Trance temporary proficiencies, Circle of the Land terrain choice, Fiendish Resilience damage type, Spell Mastery selections, and similar rest/per-use decisions.

## Current level-up authority

The active UI completion target is `public.complete_character_level_up_v5`.

The progression stack is layered for compatibility:

- v1 established the original review/base transition;
- v3 added source-owned advancement and persistent-choice application;
- v4 added normalized class-option/subclass families and Origin-feat instances;
- v5 is the current public completion path and composes replacements, Battle Master, Wizard Savant, ordinary v4/v3 progression, final-spellbook-dependent Wizard Signature Spells, and projection/history updates in one transaction.

Authenticated execute on v3/v4 has been revoked. Legacy v1/v2 completion grants remain a tracked cleanup item. Do not move the UI back to an older generation.

## XP and one-level-at-a-time chronology

`character_progression` is authoritative for current class, class level, XP, `pending_level_up`, subclass identity, and historical `level_choices`.

XP can make a level available but does not directly change class level. Each transition opens its own review, resolves choices against the correct chronological state, commits atomically, and then determines whether another earned level remains pending.

This one-level-at-a-time rule is important for prerequisites and replacements. A later choice may depend on an ability increase, feat, spell, Invocation, subclass choice, or other permanent state gained at an earlier level.

## Shared prerequisite and option authority

Browser/shared-model resolvers provide presentation and preview filtering, while Supabase remains the trust boundary.

Important normalized authorities include:

- `character_option_grant_instances` for feat/boon acquisitions and repeatable per-instance choices;
- `class_feature_option_catalog` for canonical optional class-feature identities;
- `character_class_option_grant_instances` for normalized class options such as Eldritch Invocations and Battle Master maneuvers;
- `character_spells` for spell source identity, spellbook membership, preparation, and limited-use resource state.

Unknown or unsupported prerequisite shapes fail closed instead of being guessed.

## Connected permanent advancement families

Current reviewed authority includes:

- General feats and Epic Boons
- fixed/chosen ability increases and Constitution-derived HP correction
- skill/tool/armor/weapon/saving-throw proficiency effects
- Skill Expert expertise
- repeatable Elemental Adept distinctness
- supported feat-owned spell choices and per-instance Magic Initiate replacement
- persistent simple class choices
- Bard Magical Secrets expanded spell access
- Lore Magical Discoveries
- Draconic Elemental Affinity
- Champion Additional Fighting Style
- Sorcerer Metamagic acquisition/replacement
- Warlock Mystic Arcanum acquisition/replacement
- Warlock Eldritch Invocation acquisition/replacement, prerequisites, dependent choices, repeatability, and legacy recovery
- Lessons of the First Ones Origin-feat ownership/reversal
- Battle Master maneuver acquisition/replacement
- XPHB Wizard Savant spellbook chronology
- XPHB Wizard Signature Spells

The older blocker list that described Metamagic, Invocations, Mystic Arcanum, source-aware spell access, and subclass choices as not yet connected is historical and must not be used as the current roadmap.

## Spell-source identity

`character_spells` uses `(character_id, spell_id, source_type, source_key)` source identity so the same spell can be granted independently by different sources without collapsing provenance.

Starting-magic exactness is scoped to starting-magic rows. Later progression spells therefore do not invalidate a Forge-created character's starting-magic proof.

For Wizard spellbook-specific features, normalized membership is narrower than “all character spells”:

- ordinary level-1+ Wizard class rows; and
- class-feature rows explicitly marked `wizardSpellbook=true`, currently Savant.

Wizard cantrips remain separate from the spellbook.

## Higher-level Forge replay

The Forge builds cumulative permanent state while retaining acquisition chronology where later eligibility depends on earlier levels.

Examples:

- Ability Score Improvement / feat / Epic Boon acquisitions are replayed chronologically for prerequisite evaluation.
- cumulative class-choice counts are normalized into their attained slots rather than flattened into a single current-level choice.
- Eldritch Invocation and Battle Master instances preserve original acquisition levels through later replacements.
- Wizard Savant uses separate acquisition groups at levels 3/5/7/9/11/13/15/17.
- Wizard Signature Spells is a level-20 permanent group placed on the Spells step because its options depend on the final spellbook being built.

## Explicit cadence / placement model

The shared Forge no longer interprets every `options` / `count` structure as a permanent creator lock.

- `creation` cadence → permanent creation/attained-level acquisition
- `training` placement → choices that depend on proficiency state, such as Expertise
- `spells` placement → permanent choices whose options depend on assembled spellbook state, such as Signature Spells
- Long/Short-Rest configurable choices → runtime configuration
- per-use choices → action/runtime UI
- informational features → guide/display only

This is why Weapon Mastery and Spell Mastery are not permanent Forge selections.

## Wizard Savant chronology

Migrations 40-41 connect Savant across earned progression and direct higher-level Forge.

Savant additions are `source_type='class-feature'` rows with `wizardSpellbook=true`; they are known but not auto-prepared. The historical acquisition sequence is:

- level 3: two matching-school level-1/2 Wizard spells;
- levels 5/7/9/11/13/15/17: one matching-school Wizard spell legal up to spell levels 3/4/5/6/7/8/9.

A deferred uniqueness invariant prevents ordinary Wizard and Savant provenance from creating duplicate spellbook membership.

## Wizard Signature Spells

Migration 42 connects the permanent Wizard-20 selection.

Exactly two level-3 Wizard spells must already be in the **final normalized spellbook**. The client restricts the visible choices to actual spellbook selections; the server revalidates membership transactionally.

Earned 19→20 ordering is deliberate:

1. validate the Signature submission shape;
2. apply ordinary v4/v3 level-20 class-spell acquisition;
3. validate/apply Signature Spells against that resulting spellbook;
4. record the Signature delta in progression/session/event history.

Thus a level-3 spell learned as one of the two ordinary level-20 Wizard additions may immediately become a Signature Spell.

Direct level-20 Forge ordering is also deliberate:

1. materialize the eight historical Savant acquisition groups (nine total spell rows);
2. materialize Signature Spells against the resulting spellbook.

A Savant-granted level-3 spell can therefore be a Signature Spell. Signature does not add another spell row; it overlays the existing membership row while preserving source provenance.

The overlay marks the spell prepared/always available and adds one `short_rest` free-use resource. The existing character-rest authority restores that free use on Short or Long Rest. Tactical battle-board consumption of this special free cast is a separate combat concern and is not implied by this progression work.

## Current transaction boundary

A successful v5 transition can commit, as applicable:

- class level and XP/pending state
- proficiency bonus and slot progression
- HP increase
- subclass entry
- ordinary class spell acquisition
- General feat / Epic Boon instance and canonical effects
- persistent simple/class/subclass choices
- normalized class-option acquisitions/replacements
- Battle Master maneuvers
- Wizard Savant additions
- Wizard Signature Spells
- source-owned sheet projections
- `character_progression.level_choices`
- completed level-up session
- level event history

If validation fails, the transition rolls back atomically.

## Production validation checkpoint

Migration 42 is live as `wizard_signature_spells_authority`.

Runtime source head `9740d66a45b215805a6c988c25874a01d1e35e55` passed all five PR GitHub Actions workflows. The full repository `npm run build:vercel` command also passed inside the NPC Forge workflow. Hosted Vercel remained rate-limited, so no hosted deployment success is claimed for that head.

Rollback production proofs established:

- Signature overlay does not create duplicate spellbook membership;
- Short Rest restores spent Signature free uses;
- duplicate/wrong-level/non-spellbook selections fail closed;
- direct level-20 Forge can use a Savant-granted level-3 spell as Signature while preserving all acquisition chronology;
- authenticated Wizard 19→20 v5 progression can use level-3 spells learned in the same transition as Signature;
- session/event/progression histories agree;
- no synthetic data or Signature rows survived rollback;
- world baseline remained 20 locations / 4 routes / 9 route points.

## Remaining progression / higher-level Forge work

The current remaining work is substantially narrower than older versions of this document:

1. Implement guarded runtime Long-Rest configuration for Wizard Spell Mastery and other genuinely rest-reconfigurable families without converting them into permanent acquisitions.
2. Complete guarded multi-source starting-magic frontend integration where still incomplete.
3. Add source-backed starting equipment packages and higher-level starting wealth/equipment.
4. Add character-scoped starting currency for multi-character accounts.
5. Resolve Artificer wildcard Magic Item Plan choices into concrete item instances.
6. Finish the preferred Species / Background / Class / Feat / Subclass persistent-choice coverage audit and conditional-choice UI polish.
7. Reconcile/revoke obsolete authenticated progression RPC generations once confirmed unused.
8. Run final authenticated browser acceptance across low/high-level, martial/caster, nested-feat, subclass, and rest-configuration cases before merging PR #170.

## Validation

Primary active workflows include the character progression authority and progression-v3 suites plus the shared Forge/nested-choice validations. `scripts/validate_wizard_signature_spells.mjs` is the dedicated Signature regression contract.

Automated validation and rollback fixtures are regression/authority evidence. They are not substitutes for final authenticated browser acceptance.

## Protected boundaries

This architecture does not authorize changes to world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting runtime behavior. `components/MapPageClient.js` remains outside PR #170.

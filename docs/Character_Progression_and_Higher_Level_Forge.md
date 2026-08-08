# Character Progression and Higher-Level Forge

Status: active authority design for PR #170.

This document defines the shared progression contract between ordinary earned level-up and Character Forge creation above level 1. It is intentionally narrower than the general class guide: this document describes **authoritative character-state transitions**.

## Core invariant

There is one progression model.

- Creating a character at level `N` replays the permanent decisions attained from level 1 through level `N`.
- Leveling a live character from `N` to `N + 1` applies only the next unresolved delta.
- Both paths use the same canonical class progression, feat/boon catalogues, source-choice structures, prerequisite semantics, and spell-source identity.
- Runtime/rest/per-use configuration is not persisted as a creation or level-up acquisition merely because the source feature contains choices.

Examples of runtime/reconfigurable state that remains outside permanent progression acquisition include Weapon Mastery configuration, Astral Trance proficiencies, Circle of the Land terrain, Fiendish Resilience damage type, Pact of the Tome Book of Shadows spell selections, and similar rest/per-use decisions.

## XP and the level-up gate

`character_progression` is authoritative for:

- current class
- current class level
- experience points
- `pending_level_up`
- historical `level_choices`

`add_character_xp_v1` can make the next level available by setting `pending_level_up`, but XP never directly changes the character level.

A level transition is deliberately one level at a time:

1. XP reaches the next threshold.
2. `pending_level_up = true`.
3. The player opens a level-up review.
4. The next level's required permanent choices are resolved against the character **as it exists before that level**.
5. `complete_character_level_up_v3` applies the transition atomically.
6. If the remaining XP already reaches the following threshold, `pending_level_up` remains true.
7. The player opens a fresh review for the following level.

This is required for chronological prerequisites. A level-4 ability increase can make a level-8 feat legal, but the level-8 choice must not be evaluated against benefits that are not yet part of the level-4 character.

A rollback test against production data verified this catch-up behavior with enough XP for two levels: the simulated character completed 3→4, remained pending, opened a separate 4→5 review, and only then reached level 5.

## Shared prerequisite resolver

`utils/characterProgressionResolver.js` is the browser/shared-model resolver for advancement previews.

It handles the currently imported prerequisite patterns for:

- acquisition level
- minimum ability scores
- Spellcasting/Pact Magic
- required class features
- armor or weapon training
- prior feats
- background/species/campaign requirements when represented by the imported metadata

Unknown prerequisite keys fail closed rather than being guessed.

`private.character_option_prerequisites_met_v1(...)` independently checks the live character on the server before a General feat or Epic Boon is offered/committed.

Client filtering is therefore presentation; Supabase remains the trust boundary.

## General feats and Epic Boons

The imported catalogue distinguishes:

- General feats: `option_type = 'feat'`, category `G`
- Epic Boons: `option_type = 'boon'`, category `EB`

This distinction matters. Epic Boons are not ordinary feat rows.

`character_option_grant_instances` is the per-acquisition authority used by the Forge and earned progression. It supports repeatable options and child choices without collapsing repeated acquisitions into a single feat name.

Level 19 now accepts an eligible Epic Boon or another eligible General feat when the source feature permits it. Ability effects from an Epic Boon use the Epic cap rather than the normal feat cap.

## Advancement effect authority

`private.apply_character_level_advancement_v1(...)` materializes canonical option effects from the catalogue rather than trusting client-supplied effect text.

Current permanent effects include:

- fixed and chosen ability increases
- Constitution-derived retroactive hit-point adjustment
- skill proficiency
- fixed tool proficiency
- armor/weapon training
- Resilient saving-throw proficiency
- Skill Expert expertise
- repeatable Elemental Adept damage-type distinctness
- supported feat spell grants

Current exact feat-spell validators include Fey-Touched, Shadow-Touched, Ritual Caster, Telekinetic, and Telepathic.

## Spell-source identity

`character_spells` now has:

- `source_type`
- `source_key`
- `known`
- prepared/availability/resource metadata

The `(character_id, spell_id, source_type, source_key)` identity allows the same spell to be granted independently by a class, subclass, species, background, or repeatable feat instance.

Starting-magic exactness is scoped to rows marked `raw_payload.startingMagic = true`. Later progression spells therefore do not invalidate a Forge-created character's starting-magic proof.

`private.sync_player_forge_class_spell_summary_v1(...)` keeps the legacy sheet-level class spell summary aligned with authoritative `character_spells` after earned level-up so deferred Forge validators continue to pass.

## Higher-level Forge advancement replay

`utils/playerForgeAdvancement.js` builds attained Ability Score Improvement / General feat / Epic Boon acquisitions for a starting character above level 1.

The replay is chronological for prerequisite evaluation. Earlier selected advancement effects are folded into the progression state used to evaluate later options.

`utils/characterClassChoiceDeltaPlan.js` performs the analogous current-level versus next-level comparison for persistent class-feature choices. It:

- builds the legal class-choice state at the current level
- builds it again at the next level
- emits only the required count delta
- excludes already-selected nonrepeatable options from required additions
- recognizes optional level-up replacements for replaceable choice families such as Metamagic, Eldritch Invocations, and Mystic Arcanum
- can merge a resolved delta back into the cumulative class-choice authority

## Persistent class-choice safety gate

The original level-up review only noticed certain choice-bearing feature names on the next progression row. That is insufficient for cumulative systems.

Example: Warlock Eldritch Invocation count increases at multiple later levels even though the original feature is not necessarily repeated as a new feature row.

`private.level_up_persistent_choice_gaps_v1(...)` explicitly detects unresolved permanent base-class deltas so the server fails closed rather than silently leveling past them.

The guard currently identifies at least:

- Barbarian: Primal Knowledge
- Bard: Expertise deltas; Magical Secrets spell-access transition
- Cleric: Blessed Strikes choice
- Druid: Elemental Fury choice
- Paladin: Fighting Style
- Ranger: Fighting Style, Deft Explorer Expertise/languages, later Expertise delta
- Rogue: later Expertise delta
- Sorcerer: Metamagic count increases
- Warlock: Eldritch Invocation count increases and Mystic Arcanum levels
- Wizard: Scholar Expertise

Improved Blessed Strikes and Improved Elemental Fury do not create duplicate new choices; they improve the already-owned level-7 decision.

Until each remaining class-choice family is connected to v3 authority, the review is intentionally blocked at that choice point rather than constructing an incomplete character.

## Runtime level-up UI

`components/CharacterLevelUpChoices.js` now uses:

- `get_character_level_advancement_options_v1`
- `buildRuntimeAdvancementChoiceModel`
- reusable `SourceChoiceFields`
- `complete_character_level_up_v3`

The old static feat list and standalone ASI controls are no longer the advancement authority.

The same nested feat-choice structures used by higher-level creation are used by earned level-up.

## Transaction boundary

A successful v3 level-up commits the relevant transition together:

- class level
- proficiency bonus
- HP increase
- class spell progression
- subclass selection when required by the base transition
- General feat/Epic Boon instance and canonical effects
- sheet summaries required for compatibility
- `character_progression.level_choices`
- completed level-up session
- level event history
- `pending_level_up` for any subsequent earned level

If validation fails, the level transition is not partially applied.

Production rollback tests have forced deferred constraints immediately for both a normal Fighter 3→4 General-feat transition and a Fighter 18→19 Epic-Boon transition.

## Remaining progression blockers

The progression system is not yet declared acceptance-complete. Remaining work includes:

1. Materialize the class-choice deltas currently protected by the fail-closed gap guard, starting with Fighting Style, Expertise/Scholar, Primal Knowledge, Blessed Strikes, and Elemental Fury, then Metamagic/Invocations/Mystic Arcanum.
2. Preserve optional replacement semantics for Metamagic, Invocations, Mystic Arcanum, and any other source feature that permits replacement on gaining a level.
3. Extend earned class-spell validation to authoritative Background-expanded class access and Magical Secrets access rather than requiring raw `spells_catalog.classes` membership.
4. Resolve nested subclass choices at the level a subclass is chosen and at later subclass feature levels.
5. Wire Character Forge creation to `create_player_character_v3` for complete multi-source starting magic authority.
6. Replay all high-level creation effects into the same canonical tables used by earned progression, including class-choice instances once that authority is normalized.
7. Complete starting equipment and character-scoped currency authority, which are also needed for a truly complete higher-level creation path.
8. Run the final full preferred-catalogue coverage audit, then authenticated browser acceptance.

## Validation

Dedicated CI: `.github/workflows/validate-character-progression.yml`

Primary regression script: `scripts/validate_character_class_progression.mjs`

The workflow watches the shared resolver, runtime level-up plan/UI, class-choice delta planner, relevant progression migrations, and the progression regression script.

Automated validation is a regression guard. It is not a substitute for the final authenticated browser acceptance pass.

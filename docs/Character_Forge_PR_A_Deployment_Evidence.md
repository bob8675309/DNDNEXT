# Character Forge PR A — Deployment Evidence

Status date: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)

## Current acceptance state

PR #170 remains **open and unmerged**. Automated checks, production builds, and rollback SQL proofs are not final authenticated browser acceptance.

The active acceptance rule is creation/progression parity for persistent source-owned choices. Runtime/rest/per-use configuration is kept separate rather than being frozen into Character Forge state.

## Current production progression boundary

The current Level Up UI submits to `complete_character_level_up_v5`. v5 wraps the reviewed v4 transition with normalized source-owned acquisition/replacement work that must occur transactionally around it, and it now also applies Wizard Signature Spells after the base level-20 spellbook transition.

Current production progression includes:

- one-level-at-a-time XP advancement
- fixed/rolled HP
- subclass entry
- class spell additions
- General feat / Epic Boon advancement
- persistent simple class choices
- Bard Magical Secrets access
- Lore Magical Discoveries
- Draconic Elemental Affinity
- Champion Additional Fighting Style
- Metamagic acquisition/replacement
- Mystic Arcanum acquisition/replacement
- Magic Initiate spell replacement
- Eldritch Invocation acquisition/replacement
- Lessons of the First Ones Origin-feat ownership/reversal
- Battle Master maneuver acquisition/replacement
- XPHB Wizard Savant spellbook additions in earned progression and higher-level Forge creation
- XPHB Wizard Signature Spells in earned progression and level-20 Forge creation

Direct authenticated v3/v4 completion is revoked. Legacy v1/v2 completion RPCs still retain authenticated execute and are tracked as an authority-cleanup item; the current level-up component does not use them as its normal completion path.

## Invocation and Lessons evidence

Production rollback coverage includes:

- simple and repeatable Invocation acquisition
- dependent cantrip selections
- nonrepeatable duplicate rejection
- prerequisite-protected replacement rejection
- same-level prerequisite resolution
- current-level replacement eligibility while preserving original acquisition chronology
- final `sheet.eldritchInvocations` projection after replacement plus a newly gained slot
- legacy Invocation recovery
- Lessons acquisition and removal for Alert, Tough, Magic Initiate, Skilled, Crafter, and Tavern Brawler effect shapes
- preservation of pre-existing/other-source proficiencies
- Expertise-blocked removal with full transaction rollback

## Battle Master evidence

Migrations 38-39 derive the 20 XPHB Battle Master maneuver identities from imported `Maneuver Options` and use `character_class_option_grant_instances` for shared higher-level Forge / earned-progression authority.

Verified cumulative counts are 3 / 5 / 7 / 9 at Fighter levels 3 / 7 / 10 / 15. Later gains require two new maneuvers and permit one optional replacement while preserving the original maneuver-slot acquisition level.

Rollback proofs cover higher-level Forge normalization, Fighter 2→3 Battle Master entry, incomplete-selection rejection, non-Battle-Master progression, Fighter 6→7 acquisition plus replacement, and normalized sheet/history agreement.

Known presentation debt: Fighter-3 pending-subclass UI still displays a clearly labeled Battle-Master-only group before subclass selection is resolved. Server enforcement is correct; conditional hide/require polish remains for browser acceptance.

## Wizard Savant evidence

Migrations 40 and 41 are live.

Migration 40 connected earned XPHB Savant progression for Abjurer, Diviner, Evoker, and Illusionist. Migration 41 corrected the level-1+ spellbook boundary and completed direct higher-level Forge chronology/materialization.

Savant spells preserve their feature provenance rather than becoming ordinary base Wizard rows:

- `source_type='class-feature'`
- `raw_payload.wizardSpellbook=true`
- known, but not auto-prepared
- not always available
- source key tied to the acquisition level/group

Wizard Spellcasting defines the spellbook as level 1+ spells, so cantrips are excluded. Higher-level Forge serializes historical acquisitions at 3/5/7/9/11/13/15/17, while a deferred uniqueness rule treats ordinary Wizard level-1+ rows and Savant `wizardSpellbook` rows as one membership set.

Migration-41 production proofs include correct level-3/5 option ranges, school enforcement, no cantrip leakage, no ordinary-count inflation, duplicate-provenance rejection, higher-level Forge replay, and zero-residue rollback cleanup.

## Wizard Signature Spells evidence

Migration 42 is live as `wizard_signature_spells_authority` (`20260808213723`).

### Source / UI contract

The source rule is a permanent Wizard-20 selection of exactly two level-3 Wizard spells already in the character's spellbook. Because eligibility depends on spellbook membership, the shared Forge group is placed on the **Spells** step rather than the Class step.

The direct Forge UI limits Signature choices to level-3 spell IDs actually present in the draft spellbook through either:

- ordinary Wizard starting spellbook selections; or
- Savant selections already made in the shared class-choice state.

If an underlying spell leaves the draft spellbook, the stale Signature selection is removed. The Spells step cannot advance while its required Signature group is incomplete.

The shared class-choice engine marks Signature Spells `allowRepeatAcrossGroups=true` so a spell selected earlier by the different Savant feature can legitimately be selected again as a Signature Spell. This does not allow duplicate spellbook membership.

Earned level-up loads ordinary Wizard rows plus Savant `wizardSpellbook` rows as existing spellbook membership, preventing Savant spells from reappearing as ordinary new-spell candidates. At Wizard 19→20, Signature eligibility also includes level-3 Wizard spells selected as the two ordinary new spells in that same transition.

### Storage / resource contract

Signature Spells overlays the existing `character_spells` row rather than inserting another membership row. The original `source_type` and `source_key` remain unchanged.

Each selected row becomes:

- `prepared=true`
- `always_available=true`
- `uses_max=1`
- `uses_remaining=1`
- `recharge='short_rest'`
- `raw_payload.signatureSpell=true` with level/feature/resource provenance

The existing `complete_character_rest_v1` authority restores `short_rest` spell-use resources on both a Short Rest and Long Rest. The existing character-sheet limited-use spell control can consume/restore those free uses. This migration does not claim a new tactical battle-board free-cast adapter.

### Transaction ordering

Earned Wizard 19→20 progression applies ordinary v4/v3 class spell acquisition first, then validates/applies Signature Spells against the resulting final spellbook. This permits a level-3 Wizard spell learned at level 20 to become a Signature Spell in the same atomic transaction.

Higher-level Forge uses a deferred Wizard finalizer that runs Savant chronology first and Signature materialization second, allowing a level-3 Savant spell to qualify at Wizard 20.

### CI / build evidence

Runtime source head `9740d66a45b215805a6c988c25874a01d1e35e55` passed all five PR GitHub Actions workflows:

- Validate character progression v3
- Validate character progression authority
- Validate Character Forge nested choices
- Validate NPC Forge foundation
- Validate character portrait authority

The NPC Forge workflow also completed the repository's exact `npm run build:vercel` production build successfully. Hosted Vercel itself was blocked by the account build-rate limit; this checkpoint therefore claims a successful repository production build, not a successful hosted Vercel deployment.

The dedicated Signature validator covers Forge placement, final-spellbook eligibility, Savant-to-Signature reuse, earned progression ordering, source-provenance preservation, and Short/Long Rest recharge behavior.

### Production migration / rollback proofs

Migration 42 compiled successfully and replaced the Savant-only deferred progression insert trigger with `character_progression_materialize_player_forge_wizard_final_v1`.

Rollback-only production evidence:

1. **Shared overlay/resource proof**
   - two existing level-3 Wizard class spellbook rows were selected;
   - spellbook row count remained exactly two;
   - original class source identity remained intact;
   - both became prepared/always available with one `short_rest` free use;
   - after setting both uses to zero, `complete_character_rest_v1(..., 'short_rest')` restored exactly two uses;
   - rollback returned production to 7 characters / 30 spell assignments.

2. **Fail-closed proof**
   - duplicate Signature selections rejected;
   - a level-2 Wizard spell rejected;
   - a level-3 Wizard spell absent from the spellbook rejected;
   - all three attempts left zero Signature overlay residue.

3. **Direct level-20 Forge chronology proof**
   - synthetic Abjurer replayed nine Savant spellbook additions at acquisition levels `3/3/5/7/9/11/13/15/17`;
   - no Savant cantrip was materialized;
   - Savant-granted Counterspell successfully became one Signature Spell;
   - ordinary-spellbook Bestow Curse became the other;
   - Counterspell retained `source_type='class-feature'` / Savant provenance;
   - Bestow Curse retained its original `source_type='class'` provenance;
   - total spellbook rows were 10 (1 ordinary + 9 Savant), proving Signature added zero membership rows;
   - rollback left zero synthetic rows.

4. **Authenticated earned Wizard 19→20 proof**
   - `begin_character_level_up_v4` returned a metadata-ready review requiring the ordinary two new Wizard spells;
   - `get_character_level_class_choice_options_v2` exposed exactly one level-20 Signature group;
   - Animate Dead and Bestow Curse were learned as the two ordinary level-20 Wizard spellbook additions;
   - `complete_character_level_up_v5` then made both Signature Spells, proving same-transaction final-spellbook eligibility;
   - progression reached level 20 inside the rollback transaction;
   - the completed session, level event, and `character_progression.level_choices` each recorded two Signature deltas;
   - rollback restored the production baseline.

Final integrity after every proof:

- 7 characters
- 7 character sheets
- 30 character-spell assignments
- 7 progression rows
- 0 open level-up sessions
- 0 production Signature rows from the rollback fixtures
- 0 synthetic proof characters
- protected world baseline unchanged at 20 locations / 4 routes / 9 route points

## Wizard work still pending

### Spell Mastery

Spell Mastery remains intentionally excluded from permanent Forge/level-up choice authority because its selected spells can be changed after a Long Rest. It belongs in guarded runtime Long-Rest configuration.

## Remaining acceptance blockers

1. Implement guarded runtime Long-Rest configuration for Wizard Spell Mastery and other rest-reconfigurable features instead of Forge lock-in.
2. Complete guarded multi-source starting-magic frontend use where still incomplete.
3. Finish source-backed starting equipment packages and higher-level starting wealth/equipment.
4. Finish character-scoped starting currency.
5. Resolve Artificer wildcard Magic Item Plan concrete-item instances.
6. Finish remaining persistent subclass/cumulative choice audit and conditional-choice polish.
7. Audit/revoke obsolete authenticated level-up completion RPC generations when confirmed unused.
8. Run authenticated browser acceptance after the remaining blockers and applicable build/deployment gates are complete.

## Protected boundaries

This work has not modified world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting runtime behavior. `components/MapPageClient.js` remains outside this PR slice.

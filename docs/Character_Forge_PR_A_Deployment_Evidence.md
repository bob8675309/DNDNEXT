# Character Forge PR A — Deployment Evidence

Status date: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)

## Current acceptance state

PR #170 remains **open and unmerged**. Automated checks and rollback SQL proofs are not final authenticated browser acceptance.

The active acceptance rule is creation/progression parity for persistent source-owned choices. Runtime/rest/per-use configuration is kept separate rather than being frozen into Character Forge state.

## Current production progression boundary

The current Level Up UI submits to `complete_character_level_up_v5`. v5 wraps the reviewed v4 transition with the normalized source-owned acquisition/replacement work that must occur transactionally around it.

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

### Source normalization

Migration 38 derives the XPHB Battle Master maneuver catalogue from imported `Maneuver Options` references rather than maintaining a second hard-coded maneuver list.

Verified live:

- 20 canonical XPHB maneuver identities
- identity-only normalized rows
- cumulative maneuver count helper: 3 / 5 / 7 / 9 at Fighter 3 / 7 / 10 / 15

### Shared authority

Migration 39 uses `character_class_option_grant_instances` for Battle Master maneuver instances in both higher-level Forge and earned progression.

Rollback proofs:

- level-7 Forge-created Battle Master → five normalized instances at acquisition levels 3/3/3/7/7
- Fighter 2→3 Battle Master + exactly three maneuvers succeeds
- incomplete Fighter 2→3 Battle Master selection fails atomically
- Champion 2→3 succeeds without maneuver state
- Battle Master 6→7 learns two maneuvers and optionally replaces one
- replacement keeps the original slot acquisition level and records `lastReplacementLevel`
- normalized rows, sheet projection, and progression history agree

Known presentation debt: Fighter-3 pending-subclass UI still displays a clearly labeled Battle-Master-only group before subclass selection is resolved. Server enforcement is correct; conditional hide/require polish remains for browser acceptance.

## Wizard Savant evidence

Migrations 40 and 41 are live.

Migration 40 connected the earned XPHB Savant path for Abjurer, Diviner, Evoker, and Illusionist. Migration 41 corrected the spellbook-level boundary and completed direct higher-level Forge chronology/materialization.

### Storage contract

Savant spells are **not** ordinary base-Wizard `source_type='class'` rows because Forge validates the exact normal Wizard spell count. They are stored as:

- `source_type='class-feature'`
- `raw_payload.wizardSpellbook=true`
- known, but not auto-prepared
- not always-available
- source key tied to the Savant acquisition level/group

The Spellbook panel reads all `character_spells` assignments, so these rows appear in the character spellbook without corrupting the base Wizard count.

### Level-1+ spellbook boundary

The resumed production audit caught a migration-40 bug before browser acceptance: the level-3 Savant option query allowed level-0 spells. Wizard Spellcasting defines the spellbook as level 1+ spells, so cantrips were not legal Savant spellbook additions.

Migration 41 corrected both earned progression and Forge authority:

- Wizard 3 Savant choices: two spells, each level 1-2;
- Wizard 5 / 7 / 9 / 11 / 13 / 15 / 17: one additional spell at maximum spell levels 3 / 4 / 5 / 6 / 7 / 8 / 9 respectively;
- every choice must be a Wizard spell from the matching Savant school;
- higher-level Forge serializes each historical acquisition as its own group rather than one cumulative current-level bucket;
- the ordinary Wizard Spells step excludes spells already selected by Savant.

### Duplicate authority

A deferred uniqueness trigger treats normal level-1+ Wizard class rows and Savant rows marked `wizardSpellbook=true` as one spellbook membership set. A normal Wizard spell therefore cannot be selected again as a Savant spell, or vice versa. Ordinary Wizard cantrips are not treated as spellbook membership.

### Migration / CI evidence

The first migration-41 apply attempt failed safely during PL/pgSQL compilation; no DDL committed. The parser issue was isolated to a `CASE` expression in a comparison, corrected on the branch, and parser-proven directly before retry.

The corrected source head `057b22ece3aeb084bbbd02dde9779378d1e4e7e6` then passed all five PR workflows and Vercel. Migration 41 compiled successfully afterward and is recorded in production as `wizard_savant_forge_chronology`.

Production migration records now include:

- `wizard_savant_spellbook_progression`
- `wizard_savant_forge_chronology`

### Production proofs after migration 41

Read-only / rollback tests verified:

- pending Wizard 2→3 Savant group requires exactly two choices;
- level-3 option minimum = 1, maximum = 2, cantrip count = 0;
- simulated Abjurer 4→5 returns exactly one Abjuration choice and every option is level 1-3;
- direct valid Abjuration Savant materialization creates two class-feature spellbook rows, both unprepared/not always available, while the ordinary Wizard class-spell count is unchanged;
- mismatched-school submission is rejected atomically;
- deferred uniqueness rejects the same spell as both ordinary Wizard progression and Savant provenance;
- higher-level Forge level-5 replay materializes exactly three feature-granted spellbook rows at acquisition levels 3/3/5 with zero level-0 spells;
- the higher-level Forge test initially appeared to normalize level 5 back to 2 because the fixture edited progression before sheet state; inspection showed the existing sheet/progression synchronization projected the sheet's old level back into progression. Reordering the rollback fixture to sheet first, progression second produced the expected Savant proof without changing runtime synchronization behavior;
- final residue sweep restored the live test Wizard to the original level 2, no subclass, original creator marker, and zero Forge-Savant rows.

## Wizard work still pending

### Signature Spells

Signature Spells is persistent and must choose two level-3 Wizard spells already present in the normalized Wizard spellbook. Its free-cast uses/recharge are runtime resource state and must not be conflated with spellbook membership.

### Spell Mastery

Spell Mastery remains intentionally excluded from permanent Forge/level-up choice authority because its selected spells can be changed after a Long Rest. It belongs in guarded runtime Long-Rest configuration.

## CI evidence

The progression workflow now watches migrations 38-41 plus the relevant Forge spell/class-choice files and executes dedicated contracts for:

- Battle Master progression
- Wizard Savant earned progression
- higher-level Player Forge Wizard Savant chronology/materialization

These run alongside the existing progression, Invocation, feat-instance, replacement, and reversible-effect validators.

Documentation-only commits after the `057b22ec…` runtime checkpoint do not alter deployed semantics. Re-run exact-head checks after the next runtime change.

## Remaining acceptance blockers

1. Implement Wizard Signature Spells using normalized spellbook membership.
2. Implement runtime Long-Rest configuration for Spell Mastery and other rest-reconfigurable features instead of Forge lock-in.
3. Complete guarded multi-source starting-magic frontend use where still incomplete.
4. Finish source-backed starting equipment packages and higher-level starting wealth/equipment.
5. Finish character-scoped starting currency.
6. Resolve Artificer wildcard Magic Item Plan concrete-item instances.
7. Finish remaining persistent subclass/cumulative choice audit.
8. Audit/revoke obsolete authenticated level-up completion RPC generations when confirmed unused.
9. Run authenticated browser acceptance after exact CI/Vercel is green.

## Protected boundaries

This work has not modified world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting runtime behavior. `components/MapPageClient.js` remains outside this PR slice.

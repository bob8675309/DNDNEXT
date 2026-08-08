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
- earned XPHB Wizard Savant spellbook additions

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

Migration 40 is live and connects earned XPHB Savant spellbook additions for Abjurer, Diviner, Evoker, and Illusionist.

### Storage contract

Savant spells are **not** ordinary base-Wizard `source_type='class'` rows because Forge validates the exact normal Wizard spell count. They are stored as:

- `source_type='class-feature'`
- `raw_payload.wizardSpellbook=true`
- known, but not auto-prepared
- not always-available
- source key tied to the Savant acquisition level/group

The Spellbook panel reads all `character_spells` assignments, so these rows appear in the character spellbook without corrupting the base Wizard count.

### Duplicate authority

A deferred uniqueness trigger treats both normal Wizard class rows and Savant rows marked `wizardSpellbook=true` as one spellbook membership set. A normal Wizard spell therefore cannot be selected again as a Savant spell, or vice versa.

### Rollback proofs

- pending Wizard 2→3 review returns the Savant entry group with two choices
- school mapping is Abjurer→Abjuration, Diviner→Divination, Evoker→Evocation, Illusionist→Illusion
- simulated Abjurer 4→5 returns exactly one Savant choice because maximum slot level rises 2→3
- Wizard 5→6 returns no Savant group because maximum slot level remains 3
- duplicate normal-Wizard + Savant spellbook provenance is rejected by the deferred trigger
- direct successful Abjuration Savant materialization stores two source-owned, unprepared spellbook rows
- mismatched-school submission is rejected
- authenticated v5 Wizard 2→3 transaction completed in rollback with:
  - Abjurer subclass
  - fixed HP 12→16
  - two ordinary Wizard spell rows
  - two Savant spellbook rows (Alarm, Mage Armor)
  - two-entry Savant class-choice projection
  - completed review
  - level-history record
- authenticated v5 Wizard 4→5 transaction completed in rollback with:
  - fixed HP 20→24
  - Counterspell as one Abjuration Savant spellbook addition
  - one-entry Savant class-choice projection
  - `wizard_savant_delta` in level history
  - completed review
- integrity sweep after tests: zero synthetic characters, zero synthetic Savant rows, Pip unchanged at Wizard 2 with no subclass/Savant rows

### Remaining Wizard parity gap

Earned Savant progression is live, but direct higher-level Forge parity is **not yet complete**. Forge already has the initial level-3 Savant selector; it still needs recurring Savant groups/materialization for later starting levels where a new Wizard spell-slot level would have been reached.

Spell Mastery remains intentionally excluded from permanent progression because it is Long-Rest reconfigurable. Signature Spells remains pending and must select from the character's actual level-3 Wizard spellbook entries before its Short/Long Rest free-cast resource is modeled.

## CI evidence

At the migration-40 checkpoint, the progression workflow was corrected to watch migrations 38-40 and execute both:

- `scripts/validate_battle_master_progression.mjs`
- `scripts/validate_wizard_savant_progression.mjs`

The exact migration-40 source head `90c20b56305b7f606693a91c749ddb67edb4caad` completed all five PR workflows successfully and Vercel reported success before migration 40 was applied.

Subsequent documentation commits intentionally do not change runtime code. Re-run exact-head checks after the next code/migration change before applying production DDL.

## Remaining acceptance blockers

1. Complete higher-level Forge recurring Savant materialization.
2. Implement Wizard Signature Spells using normalized spellbook membership.
3. Implement runtime Long-Rest configuration for Spell Mastery and other rest-reconfigurable features instead of Forge lock-in.
4. Complete guarded multi-source starting-magic frontend use where still incomplete.
5. Finish source-backed starting equipment packages and higher-level starting wealth/equipment.
6. Finish character-scoped starting currency.
7. Resolve Artificer wildcard Magic Item Plan concrete-item instances.
8. Finish remaining persistent subclass/cumulative choice audit.
9. Audit/revoke obsolete authenticated level-up completion RPC generations when confirmed unused.
10. Run authenticated browser acceptance after exact CI/Vercel is green.

## Protected boundaries

This work has not modified world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting runtime behavior. `components/MapPageClient.js` remains outside this PR slice.

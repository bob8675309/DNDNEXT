# Unified NPC and Player Character Forge Status

Status date: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)

## Current state

The shared Character Forge remains the intended creation surface for NPCs and player-owned characters. PR #170 is still open and unmerged. Automated validation and rollback SQL are not final browser acceptance.

The governing parity rule is: a character created directly at level N and a character that earns level N through XP should resolve the same persistent source-owned decisions. Rest-configurable, per-use, and informational features must not be converted into permanent Forge choices.

## Choice semantics

Persistent choice groups distinguish cadence and placement rather than treating every imported `options`/`count` structure as a permanent creator decision.

- `creation` / persistent level choices belong in authoritative Forge/progression state.
- `training` placement is used where a decision depends on established proficiency, such as Expertise.
- Long-Rest, Short-Rest, per-use, and informational features are not permanent Forge locks.
- Weapon Mastery is runtime/Long-Rest configuration, not a one-time creator choice.
- Spell Mastery is also Long-Rest configurable and must not be permanently locked at Wizard 18.

## Player creation authority

Player creation is server-authoritative. Current live creation RPC generations include `create_player_character_v1`, `v2`, and `v3`; the current Forge work uses the newer guarded creation path where source-owned spell/magic payloads require it.

Protected player-owned state includes feats/boons, class/species/source choices, authoritative spells, weapon mastery state, Expertise, and related source metadata. Direct authenticated mutation of those sheet fields is blocked by server guards.

## Earned progression authority

The current level-up UI submits to `complete_character_level_up_v5`. v5 composes the reviewed v4 level transition with source-owned replacement/acquisition logic in one transaction.

Connected persistent families include:

- General feat / Epic Boon advancement
- persistent simple class choices
- Bard Magical Secrets spell-list expansion
- Lore Magical Discoveries
- Draconic Elemental Affinity
- Champion Additional Fighting Style
- Sorcerer Metamagic acquisition/replacement
- Warlock Mystic Arcanum acquisition/replacement
- Magic Initiate per-instance spell replacement
- Warlock Eldritch Invocation acquisition/replacement, prerequisites, repeatability, dependent choices, and Lessons of the First Ones
- Battle Master maneuver acquisition/replacement
- XPHB Wizard Savant spellbook additions in earned progression and higher-level Forge creation

Direct authenticated v3/v4 completion is revoked. Legacy `complete_character_level_up_v1/v2` still retain authenticated execute grants and remain an explicit authority-cleanup item; current UI code does not use them as its completion path.

## Eldritch Invocation / Lessons status

Invocation slots use normalized `character_class_option_grant_instances` authority. Replacement validates against the new current Warlock level while preserving original slot acquisition chronology and recording `lastReplacementLevel`.

`Lessons of the First Ones` owns a canonical Origin-feat instance and reversible effects. Removal preserves benefits that predated the feat or remain claimed by another normalized source, and it fails closed when removal would invalidate Expertise. Tough, Magic Initiate, Skilled, Crafter, Tavern Brawler, and empty-effect Origin-feat shapes have rollback coverage.

## Battle Master status

Live migrations 38-39 normalize the 20 XPHB maneuver identities directly from imported `Maneuver Options` and use generic class-option instances as authority.

Cumulative maneuver counts are 3 / 5 / 7 / 9 at Fighter levels 3 / 7 / 10 / 15. At the later gain levels, two new maneuvers are required and one existing maneuver may optionally be replaced. Replacement preserves the original maneuver-slot acquisition level.

Rollback coverage includes higher-level Forge normalization, Fighter 2→3 Battle Master entry, Fighter 6→7 acquisition plus replacement, non-Battle-Master Fighter progression, and incomplete-selection rejection.

Known UI polish debt: at Fighter 3 the generic level-up renderer currently shows a clearly labeled Battle-Master-only group before the pending subclass choice is resolved. The server only requires it when Battle Master is actually selected.

## Wizard Savant status

Live migrations 40-41 connect XPHB Savant spellbook additions for Abjurer, Diviner, Evoker, and Illusionist across both earned progression and higher-level direct Forge creation.

### Spellbook representation

Savant spells are not ordinary base-Wizard `source_type='class'` rows. They use `source_type='class-feature'` plus `raw_payload.wizardSpellbook=true`, so the exact base Wizard spell-count validator remains intact while the Spellbook panel still sees the feature-granted spell.

Savant rows are `known=true`, `prepared=false`, and `always_available=false`. A deferred uniqueness invariant treats ordinary level-1+ Wizard class rows and Savant `wizardSpellbook` rows as one spellbook membership set.

### Acquisition chronology

Wizard spellbook additions are level 1+ spells; cantrips remain separate Wizard Spellcasting choices.

- Wizard 3: choose two matching-school Wizard spells, each level 1 or 2.
- Wizard 5: choose one matching-school Wizard spell at level 1-3.
- Wizard 7: one at level 1-4.
- Wizard 9: one at level 1-5.
- Wizard 11: one at level 1-6.
- Wizard 13: one at level 1-7.
- Wizard 15: one at level 1-8.
- Wizard 17: one at level 1-9.

Higher-level Forge now replays those acquisitions as separate historical groups rather than one cumulative current-level bucket. The normal Wizard Spells step excludes spells already selected through a Savant group, preventing a duplicate choice before the server guard is reached.

### Production evidence

Migration 41 corrected the migration-40 level-3 cantrip leak before browser acceptance and added the deferred Forge materializer. Production rollback/read-only checks verified:

- level-3 Savant review requires 2 choices with option levels 1-2 and zero cantrips;
- a simulated Abjurer level-5 review exposes one Abjuration choice at level 1-3;
- a valid level-3 Savant application creates two unprepared class-feature spellbook rows without changing the ordinary Wizard class-spell count;
- a mismatched-school selection is rejected atomically;
- the deferred spellbook invariant rejects duplicate ordinary-Wizard + Savant provenance;
- a level-5 higher-level Forge replay materializes exactly two level-3 Savant grants and one level-5 grant, with no level-0 spells;
- rollback fixtures left the live test Wizard at the original level/subclass/creator with zero Forge-Savant residue.

## Wizard features still pending

- Signature Spells at Wizard 20, restricted to level-3 spells already in that Wizard's normalized spellbook; free-cast/rest state must be modeled separately from spellbook membership.
- Spell Mastery runtime Long-Rest configuration; it is intentionally excluded from permanent Forge/level-up lock-in.

## Other remaining Forge blockers

- source-backed starting equipment packages and higher-level starting wealth/equipment
- character-scoped starting currency for multi-character accounts
- complete frontend use of guarded multi-source starting-magic authority where still incomplete
- Artificer wildcard Magic Item Plan concrete-item instances
- final preferred Species / Background / Class / Feat / Subclass coverage audit
- final conditional-choice UI polish, including pending-subclass groups
- audit/revoke obsolete authenticated level-up completion RPC generations when confirmed unused
- authenticated browser acceptance

## Validation checkpoint

The syntax-corrected Savant chronology head `057b22ece3aeb084bbbd02dde9779378d1e4e7e6` passed all five PR workflows and Vercel before migration 41 was applied. Migration 41 then compiled successfully in production and the rollback/read-only proofs above passed.

Documentation commits after that checkpoint do not change runtime semantics; exact-head checks should be repeated after the next runtime change.

## Protected boundaries

This work does not change world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting runtime behavior. `components/MapPageClient.js` remains outside this Forge/progression work.

## Acceptance gate

Do not merge PR #170 yet. Finish the remaining creation/progression parity blockers, reconcile legacy RPC grants, require exact CI/Vercel success, then run authenticated browser acceptance across representative low-level, higher-level, spellcaster, martial, nested-feat, and subclass-choice cases.

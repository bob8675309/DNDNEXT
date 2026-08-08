# Unified NPC and Player Character Forge Status

Status date: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)

## Current state

The shared Character Forge remains the intended creation surface for NPCs and player-owned characters. PR #170 is still open and unmerged. Automated validation is not final browser acceptance.

The governing parity rule is: a character created directly at level N and a character that earns level N through XP should resolve the same persistent source-owned decisions. Rest-configurable, per-use, and informational features must not be converted into permanent Forge choices.

## Choice semantics

Persistent choice groups now distinguish cadence and placement rather than treating every imported `options`/`count` structure as a permanent creator decision.

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
- Wizard XPHB Savant spellbook additions on earned progression

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

Live migration 40 connects **earned** XPHB Savant spellbook additions for Abjurer, Diviner, Evoker, and Illusionist.

- Wizard 2→3: selecting one of those subclasses requires two source-legal Wizard spells from the matching school, no higher than level 2.
- Later Wizard levels: whenever the maximum Wizard spell-slot level increases, Savant requires one additional Wizard spell from that school at a level for which the Wizard has slots.
- Savant spells use `source_type='class-feature'` with `wizardSpellbook=true`; they do not inflate the exact base-Wizard `source_type='class'` spell count.
- A deferred uniqueness invariant prevents the same spell from appearing twice in the Wizard spellbook through ordinary Wizard progression plus Savant provenance.
- Savant entries are not auto-prepared and are not marked always available.

Production rollback proofs cover level-3 entry, level-5 recurring acquisition, school mismatch rejection, duplicate-provenance rejection, no-grant cadence at Wizard 6, session/history recording, and cleanup.

**Forge parity is not complete yet.** The Forge already exposes the initial level-3 Savant selector, but higher-level direct creation still needs recurring Savant groups/materialization for each newly available spell-slot level. Do not mark the Wizard family complete until that side is connected and rollback/browser tested.

## Wizard features still pending

- Higher-level Forge recurring Savant additions and Forge materialization into `character_spells`
- Signature Spells at Wizard 20, restricted to level-3 spells already in that Wizard's spellbook; free-cast/rest state must be modeled separately from spellbook membership
- Spell Mastery runtime Long-Rest configuration; it is intentionally excluded from permanent Forge/level-up lock-in

## Other remaining Forge blockers

- source-backed starting equipment packages and higher-level starting wealth/equipment
- character-scoped starting currency for multi-character accounts
- complete frontend use of guarded multi-source starting-magic authority where still incomplete
- Artificer wildcard Magic Item Plan concrete-item instances
- final preferred Species / Background / Class / Feat / Subclass coverage audit
- final conditional-choice UI polish, including pending-subclass groups
- authenticated browser acceptance

## Protected boundaries

This work does not change world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting runtime behavior. `components/MapPageClient.js` remains outside this Forge/progression work.

## Acceptance gate

Do not merge PR #170 yet. Finish the remaining creation/progression parity blockers, reconcile legacy RPC grants, require exact CI/Vercel success, then run authenticated browser acceptance across representative low-level, higher-level, spellcaster, martial, nested-feat, and subclass-choice cases.

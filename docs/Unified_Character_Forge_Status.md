# Unified NPC and Player Character Forge Status

Status date: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)

## Current state

The shared Character Forge remains the intended creation surface for NPCs and player-owned characters. PR #170 is still open and unmerged. Automated validation, production builds, and rollback SQL are not final authenticated browser acceptance.

The governing parity rule is: a character created directly at level N and a character that earns level N through XP should resolve the same persistent source-owned decisions. Rest-configurable, per-use, and informational features must not be converted into permanent Forge choices.

## Choice semantics

Persistent choice groups distinguish cadence and placement rather than treating every imported `options`/`count` structure as a permanent creator decision.

- `creation` / persistent level choices belong in authoritative Forge/progression state.
- `training` placement is used where a decision depends on established proficiency, such as Expertise.
- `spells` placement is used for permanent choices whose eligible options depend on the spellbook currently being assembled, such as Wizard Signature Spells.
- Long-Rest, Short-Rest, per-use, and informational features are not permanent Forge locks.
- Weapon Mastery is runtime/Long-Rest configuration, not a one-time creator choice.
- Spell Mastery is also Long-Rest configurable and must not be permanently locked at Wizard 18.

## Player creation authority

Player creation is server-authoritative. Current live creation RPC generations include `create_player_character_v1`, `v2`, and `v3`; the shared Forge still creates through the guarded player path used by PR #170 while source-owned choices are serialized into the sheet and materialized by protected database authority.

Protected player-owned state includes feats/boons, class/species/source choices, authoritative spells, Weapon Mastery state, Expertise, and related source metadata. Direct authenticated mutation of protected sheet fields is blocked by server guards.

## Earned progression authority

The current level-up UI submits to `complete_character_level_up_v5`. v5 composes the reviewed v4 transition with source-owned replacement/acquisition logic in one transaction.

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
- XPHB Wizard Signature Spells at level 20 in earned progression and higher-level Forge creation

Direct authenticated v3/v4 completion is revoked. Legacy `complete_character_level_up_v1/v2` still retain authenticated execute grants and remain an explicit authority-cleanup item; current UI code does not use them as its completion path.

## Eldritch Invocation / Lessons status

Invocation slots use normalized `character_class_option_grant_instances` authority. Replacement validates against the new current Warlock level while preserving original slot acquisition chronology and recording `lastReplacementLevel`.

`Lessons of the First Ones` owns a canonical Origin-feat instance and reversible effects. Removal preserves benefits that predated the feat or remain claimed by another normalized source, and it fails closed when removal would invalidate Expertise. Tough, Magic Initiate, Skilled, Crafter, Tavern Brawler, and empty-effect Origin-feat shapes have rollback coverage.

## Battle Master status

Live migrations 38-39 normalize the 20 XPHB maneuver identities directly from imported `Maneuver Options` and use generic class-option instances as authority.

Cumulative maneuver counts are 3 / 5 / 7 / 9 at Fighter levels 3 / 7 / 10 / 15. At the later gain levels, two new maneuvers are required and one existing maneuver may optionally be replaced. Replacement preserves the original maneuver-slot acquisition level.

Rollback coverage includes higher-level Forge normalization, Fighter 2→3 Battle Master entry, Fighter 6→7 acquisition plus replacement, non-Battle-Master Fighter progression, and incomplete-selection rejection.

Known UI polish debt: at Fighter 3 the generic level-up renderer currently shows a clearly labeled Battle-Master-only group before the pending subclass choice is resolved. The server only requires it when Battle Master is actually selected.

## Wizard spellbook status

### Savant

Live migrations 40-41 connect XPHB Savant spellbook additions for Abjurer, Diviner, Evoker, and Illusionist across both earned progression and higher-level direct Forge creation.

Savant spells are not ordinary base-Wizard `source_type='class'` rows. They use `source_type='class-feature'` plus `raw_payload.wizardSpellbook=true`, so the exact base Wizard spell-count validator remains intact while the Spellbook panel still sees the feature-granted spell.

Savant rows are `known=true`, `prepared=false`, and `always_available=false`. A deferred uniqueness invariant treats ordinary level-1+ Wizard class rows and Savant `wizardSpellbook` rows as one spellbook membership set.

Wizard spellbook additions are level 1+ spells; cantrips remain separate Wizard Spellcasting choices.

- Wizard 3: two matching-school Wizard spells, each level 1 or 2.
- Wizard 5 / 7 / 9 / 11 / 13 / 15 / 17: one matching-school Wizard spell legal at maximum spell levels 3 / 4 / 5 / 6 / 7 / 8 / 9 respectively.

Higher-level Forge replays those acquisitions as separate historical groups rather than one cumulative current-level bucket. The normal Wizard Spells step excludes spells already selected through a Savant group.

### Signature Spells

Live migration 42, `wizard_signature_spells_authority`, connects XPHB Wizard Signature Spells across direct level-20 Forge creation and earned Wizard 19→20 progression.

Signature Spells is a persistent selection of exactly two level-3 Wizard spells that are already members of the Wizard's **final spellbook**. It uses `placement='spells'` in the shared Forge so the eligible list can be derived from the spellbook being assembled rather than displayed as an unrelated Class-step catalogue.

Eligibility includes both:

- ordinary Wizard spellbook rows (`source_type='class'`), including a level-3 spell learned during the same 19→20 transaction; and
- source-owned Savant rows (`source_type='class-feature'` with `wizardSpellbook=true`).

The shared class-choice engine explicitly allows a Savant-granted spell to be selected again by the **different** Signature Spells feature. This does not duplicate spellbook membership: Signature Spells overlays the existing authoritative row and preserves its original `source_type` / `source_key` provenance.

Each Signature Spell is marked prepared/always available and receives one tracked free cast (`uses_max=1`, `uses_remaining=1`, `recharge='short_rest'`). The existing `complete_character_rest_v1` resource authority restores that free cast on either a Short Rest or Long Rest. This establishes character-sheet/rest resource state; it does **not** claim new battle-board spell-casting adapter behavior in this Forge/progression slice.

For higher-level Forge creation, the deferred Wizard finalizer materializes Savant chronology first and Signature Spells second. That ordering allows a level-3 Savant addition to be one of the level-20 Signature Spells without creating a duplicate spell assignment.

### Production evidence for migration 42

The runtime source head `9740d66a45b215805a6c988c25874a01d1e35e55` passed all five PR GitHub Actions workflows. The NPC Forge workflow also completed the repository's exact `npm run build:vercel` production build successfully. The hosted Vercel deployment itself was blocked by the account build-rate limit, so no hosted-deployment success is claimed for this checkpoint.

Migration 42 compiled and registered in production as `wizard_signature_spells_authority` (`20260808213723`). Rollback-only production proofs verified:

- applying Signature Spells to two existing level-3 Wizard spellbook rows preserves the two-row membership count and original class provenance;
- both rows become prepared/always available with one Short-Rest-recharging free use;
- the existing Short Rest RPC restored two spent Signature uses;
- duplicate Signature selections, a level-2 spell, and a level-3 Wizard spell not in the spellbook each fail closed with no residue;
- a direct level-20 Abjurer Forge replay materialized all nine Savant rows at acquisition levels `3/3/5/7/9/11/13/15/17`, then successfully overlaid Savant-granted Counterspell plus ordinary-spellbook Bestow Curse as the two Signature Spells;
- that direct Forge proof ended with 10 spellbook rows (1 ordinary + 9 Savant), proving Signature did not insert two additional membership rows;
- an authenticated synthetic Wizard 19→20 review/completion through `complete_character_level_up_v5` learned Animate Dead and Bestow Curse in the same transition and then made both Signature Spells, proving validation occurs against the final transactional spellbook;
- the v5 proof recorded the Signature delta in the completed level-up session, level event, and `character_progression.level_choices`;
- final integrity remained 7 characters, 7 sheets, 30 spell assignments, 7 progression rows, zero open level-up sessions, zero production Signature rows from the rollback fixtures, zero synthetic proof characters, and the protected world baseline remained 20 locations / 4 routes / 9 route points.

## Wizard feature still pending

- Spell Mastery runtime Long-Rest configuration. It is intentionally excluded from permanent Forge/level-up lock-in because the selected spells can be changed after a Long Rest.

## Other remaining Forge blockers

- source-backed starting equipment packages and higher-level starting wealth/equipment
- character-scoped starting currency for multi-character accounts
- complete frontend use of guarded multi-source starting-magic authority where still incomplete
- Artificer wildcard Magic Item Plan concrete-item instances
- final preferred Species / Background / Class / Feat / Subclass coverage audit
- final conditional-choice UI polish, including pending-subclass groups
- audit/revoke obsolete authenticated level-up completion RPC generations when confirmed unused
- authenticated browser acceptance

## Protected boundaries

This work does not change world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting runtime behavior. `components/MapPageClient.js` remains outside this Forge/progression work.

## Acceptance gate

Do not merge PR #170 yet. Finish the remaining Forge/progression blockers, reconcile legacy RPC grants, require the applicable source/build gates, then run authenticated browser acceptance across representative low-level, higher-level, spellcaster, martial, nested-feat, subclass-choice, and Wizard rest-configuration cases.

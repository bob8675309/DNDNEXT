# Unified NPC and Player Character Forge Status

Status date: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)

## Current state

The shared Character Forge is the intended creation surface for NPCs and player-owned characters. PR #170 remains open and unmerged. Source validation, production builds, live migrations, and rollback-only database proofs are strong regression evidence but are not final authenticated browser acceptance.

The governing parity rule remains:

> A character created directly at level N and a character that earns level N through XP should converge on equivalent **persistent** source-owned state.

Rest-configurable, Short-Rest, Long-Rest, per-use, and informational decisions are not converted into permanent Forge locks merely because imported source text contains choices.

## Choice semantics

The shared Forge distinguishes cadence and placement explicitly.

- `creation` / attained-level persistent choices → authoritative Forge/progression state.
- `training` → proficiency-dependent permanent choices such as Expertise.
- `spells` → permanent choices whose legal options depend on the assembled spellbook, such as Wizard Signature Spells.
- Long-/Short-Rest choices → guarded runtime configuration.
- per-use choices → runtime/action UI.
- informational features → display only.

Examples modeled correctly:

- Wizard Signature Spells → permanent spellbook-dependent choice.
- Wizard Spell Mastery → Long-Rest runtime configuration.
- class-granted Weapon Mastery → Long-Rest runtime configuration.
- Weapon Master feat weapon → per-feat-instance Long-Rest runtime configuration.
- Astral Trance → temporary Long-Rest skill + weapon/tool proficiency pair, not a Forge lock.
- Steps of the Fey → per-cast effect choice, not rest-stored state.

## Player creation authority

Player creation is server-authoritative. The shared Player Forge completes Spell-step authority through `create_player_character_v3` and no longer stops at v2.

### Starting magic — migrations 47-48

Exact `sheet.startingMagicSelections` covers:

- native class-list starting spells;
- Background-expanded class access;
- XPHB Eldritch Knight starting spellcasting;
- XPHB Arcane Trickster starting spellcasting, including fixed Mage Hand.

Species, feat, and unrelated class-feature spell grants remain separate source-owned systems.

Migration 48 removes the stale explicit anonymous execute grant from v3.

See `Player_Forge_Starting_Magic_v3_Status.md`.

### Starting equipment / currency — migrations 49-51

Player mode includes an Equipment step between Spells and Identity. NPC step order is unchanged.

Structured class starting packages are restored for the 12 XPHB core classes plus EFA Artificer. XPHB Background equipment comes from existing imported metadata.

Concrete starter items become canonical character-owned `inventory_items` rows and start unequipped. Starting/higher-level money is stored in `character_currency` as copper. `player_wallets` is not used.

Normal class + Background equipment remains the base at every starting level. Higher-level cash is additive. Higher-level magic-item quantities are a DM guide only and are not automatically granted.

Migration 50 adds Background/d10 tamper guards and currency RLS. Migration 51 removes the temporary account-wide sheet mirror so the final starter-equipment projection remains character-scoped.

See `Player_Forge_Starting_Equipment_Status.md`.

## Earned progression authority

The active Level Up UI submits to `complete_character_level_up_v5`. v5 composes reviewed v4/v3 progression with source-owned acquisition/replacement work in one transaction.

Connected persistent families include:

- one-level-at-a-time XP advancement;
- fixed/rolled HP;
- subclass entry;
- ordinary class spell acquisition;
- General feat / Epic Boon advancement;
- persistent simple class choices;
- Bard Magical Secrets;
- Lore Magical Discoveries;
- Draconic Elemental Affinity;
- Champion Additional Fighting Style;
- Sorcerer Metamagic acquisition/replacement;
- Warlock Mystic Arcanum acquisition/replacement;
- Magic Initiate per-instance spell replacement;
- Eldritch Invocation acquisition/replacement, prerequisites, dependent choices, repeatability, and Lessons of the First Ones;
- Battle Master maneuver acquisition/replacement;
- XPHB Wizard Savant spellbook chronology;
- XPHB Wizard Signature Spells.

Direct authenticated v3/v4 level-up completion is revoked. Legacy `complete_character_level_up_v1/v2` still retain authenticated execute and remain an explicit authority-cleanup item once confirmed unused.

## Battle Master — migrations 38-39

All 20 XPHB Battle Master maneuvers are normalized into generic class-option instances shared by higher-level Forge and earned progression.

Cumulative maneuver counts are 3 / 5 / 7 / 9 at Fighter levels 3 / 7 / 10 / 15. Later gains require two new maneuvers and permit one optional replacement while preserving original maneuver-slot acquisition level.

Known presentation debt remains: while Fighter-3 subclass selection is pending, the generic renderer can show a Battle-Master-only group before subclass selection resolves. Server enforcement is correct; conditional hide/require polish remains for final browser acceptance.

## Wizard authority

### Savant — migrations 40-41

Savant is live for Abjurer, Diviner, Evoker, and Illusionist across earned progression and direct higher-level Forge.

Savant spellbook additions use `source_type='class-feature'` plus `raw_payload.wizardSpellbook=true`; they do not inflate ordinary base-Wizard class spell counts.

Historical acquisitions are replayed at 3/3/5/7/9/11/13/15/17. Cantrips are not Wizard spellbook entries. Cross-provenance duplicate spellbook membership is rejected.

### Signature Spells — migrations 42-43

Signature Spells is a permanent Wizard-20 choice of exactly two level-3 spells already in the final normalized spellbook.

Direct Forge places the choice on the Spells step. Earned Wizard 19→20 applies ordinary level-20 Wizard spellbook acquisition first, then Signature validation.

Signature overlays the existing spell row, preserves original provenance, marks it prepared/always available, and adds one tracked free level-3 cast recharging on Short Rest.

### Spell Mastery — migration 44

Spell Mastery is guarded runtime state, not a permanent Wizard-18 Forge choice.

An XPHB Wizard 18+ configures one level-1 and one level-2 Action spell from the actual normalized spellbook. Both are always prepared and usable at their lowest level without a spell slot.

Initial configuration is immediate. A later replacement requires a newer Long Rest and may replace at most one mastered spell with an eligible same-level spell. The old spell's prior prepared/availability state is restored. Active encounter resource ownership blocks configuration.

See `Wizard_Spell_Mastery_Runtime_Status.md`.

## Weapon Mastery runtime authority

### Class-granted Weapon Mastery — migration 45

Class-granted XPHB Weapon Mastery is runtime cadence state rather than a permanent Forge selection.

Source-backed capacities include Barbarian, Fighter, Paladin, Ranger, and Rogue progression. Canonical options come from XPHB mundane item metadata and class-specific eligibility restrictions.

New capacity can be filled immediately. Replacing an existing active mastery requires a newer Long Rest; no-op preserves the opportunity; more than one old selection is rejected; a second change on the same rest is rejected.

### Weapon Master feat — migration 46

Every XPHB Weapon Master feat grant instance owns an independent Long-Rest runtime weapon selection while the permanent feat grant and original nested acquisition choices remain immutable audit history.

`sheet.weaponMasteries` is derived from class-granted runtime masteries plus every active Weapon Master feat instance.

## Astral Trance runtime authority — migrations 52-54

This blocker is **complete**.

AAG Astral Elf Astral Trance is a sheet-side runtime choice and is explicitly excluded from Character Forge persistent state.

After a completed Long Rest, the character chooses:

- one of all 18 skills; and
- one source-legal PHB-equivalent weapon or tool proficiency.

The pair is stored in `character_runtime_feature_choices` and projected under `sheet.runtimeProficiencies.astralTrance`.

### Expiry semantics

The current pair expires automatically when the **next Long Rest finishes**. Short Rest leaves it active. The character may then configure a new pair for the new Long-Rest cycle.

This differs intentionally from features whose current selection persists until the player chooses to change it.

### Non-destructive proficiency projection

Astral Trance does not mutate permanent:

- `sheet.proficiencies.skills`;
- `sheet.tools`;
- `sheet.weaponProficiencies`.

Normal sheet display receives a cloned skill-proficiency overlay. Edit mode uses the underlying permanent draft so the temporary skill cannot be accidentally saved as permanent.

Weapon actions check the exact runtime weapon before normal class/explicit proficiency fallback, so the temporary choice adds proficiency without suppressing Fighter/Monk/Rogue/etc. rules.

### Source options

Live state exposes:

- 18 skills;
- 74 source-legal weapon/tool options;
- firearms present: false.

Preferred XPHB catalogue rows represent PHB-equivalent items; Musket/Pistol are excluded by campaign policy.

Migration 53 corrects compact normalization for Animal Handling and Sleight of Hand. Migration 54 corrects Astral Elf eligibility to normalized `astralelf`.

### Runtime proof

The final deployed rollback proof verifies:

- no configuration before first Long Rest;
- configuration after Long Rest;
- same-rest second configuration rejected;
- Short-Rest persistence;
- automatic expiry/reopen at next Long Rest;
- second-rest Animal Handling + tool configuration;
- direct firearm rejection;
- non-Astral Elf rejection;
- no permanent proficiency mutation;
- zero runtime/synthetic residue after rollback.

See `Astral_Trance_Runtime_Status.md`.

## Current production integrity checkpoint

After migrations 52-54 and rollback fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell assignments;
- 7 progression rows;
- 0 open level-up sessions;
- 0 QA Astral Trance runtime rows;
- 0 synthetic Astral proof characters;
- 20 world locations;
- 4 map routes;
- 9 map route points.

No world-map, town/city-map, route/travel/weather, combat, or unrelated crafting behavior changed in this cadence slice.

## Remaining PR #170 blockers

Starting magic, starting equipment/currency authority, and Astral Trance runtime cadence are closed.

Remaining work:

1. remaining runtime cadence families:
   - Circle-of-the-Land choices — exact source cadence still needs classification;
   - Primal Companion — Long-Rest beast replacement;
   - Dread Allegiance — current choice persists until changed after Long Rest;
   - Fiendish Resilience — current resistance persists until changed after Short or Long Rest;
   - Steps of the Fey — per-use Misty Step effect selection, not rest-stored state;
2. compact post-create character-currency display in inventory/profile UI;
3. Artificer wildcard Magic Item Plan concrete-item instances;
4. remaining persistent Species / Background / Class / Feat / Subclass coverage and conditional-choice UI audit;
5. audit/revoke obsolete authenticated level-up completion RPC generations when confirmed unused;
6. authenticated browser acceptance across representative low/high-level, martial/caster, nested-feat, subclass, starting-magic, equipment, and runtime-rest cases;
7. merge PR #170 only after those gates are satisfied.

## Protected boundaries

This work does not authorize changes to world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting behavior. `components/MapPageClient.js` remains outside PR #170 Forge/progression/runtime work.

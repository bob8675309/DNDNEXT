# Unified NPC and Player Character Forge Status

Status date: 2026-08-09
PR: #170 (`agent/character-forge-resilience-presentation`)
Live migration checkpoint: 66

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
- Githyanki Astral Knowledge → temporary post-Long-Rest skill + PHB weapon/tool pair, not a Forge lock.
- Khoravar Skill Versatility → initial runtime skill/tool choice, then Long-Rest replacement authority.
- Steps of the Fey → per-cast effect choice, not rest-stored state.

## Player creation authority

Player creation is server-authoritative. The shared Player Forge completes through `create_player_character_v3`.

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

Post-create presentation is complete through `CharacterCurrencyBadge` and remains character-scoped.

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
- XPHB Wizard Signature Spells;
- EFA Artificer Magic Item Plans and replacements.

Direct authenticated v3/v4 level-up completion is revoked. Legacy `complete_character_level_up_v1/v2` still retain authenticated execute and remain an explicit authority-cleanup item once confirmed unused.

`get_character_level_class_choice_options_v2` also retains a pre-existing anonymous execute grant that must be reconciled during final progression RPC/ACL cleanup.

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

## Established runtime cadence families — migrations 52-59

### Astral Trance — 52-54

AAG Astral Elf Astral Trance is a sheet-side runtime choice and is excluded from persistent Forge state.

After a completed Long Rest, choose one of all 18 skills plus one source-legal PHB-equivalent weapon or tool proficiency. The pair expires automatically when the next Long Rest finishes.

Temporary skill/weapon/tool authority is additive and never rewrites permanent proficiency data.

See `Astral_Trance_Runtime_Status.md`.

### Primal Companion — 55

The Beast Master current companion persists until explicitly replaced. A newer Long Rest opens one replacement. Initial feature acquisition does not require a prior rest.

See `Primal_Companion_Runtime_Status.md`.

### Dread Allegiance — 56

The chosen allegiance, resistance, and cantrip are one linked runtime package. The package persists until replaced after a newer Long Rest.

See `Dread_Allegiance_Runtime_Status.md`.

### Fiendish Resilience — 57

The first resistance choice requires a qualifying Short or Long Rest after feature acquisition. The selected resistance persists; a later qualifying rest opens replacement.

See `Fiendish_Resilience_Runtime_Status.md`.

### Circle of the Land — 58-59

The current land spell package expires automatically at the next Long Rest and must be chosen for the new cycle. The spell matrix is source-derived.

See `Circle_of_the_Land_Runtime_Status.md`.

### Runtime panel reachability

The established chain remains:

`CharacterSheetPanel → CharacterAstralTrancePanel → CharacterDreadAllegiancePanel → CharacterFiendishResiliencePanel → CharacterCircleLandPanel → CharacterCurrencyBadge`

`CharacterPrimalCompanionPanel` and `CharacterSpeciesRestProficiencyPanel` are separate direct sheet mounts.

Every chained panel renders its downstream child even when its own feature is ineligible, preventing one species/class filter from hiding unrelated controls.

## Artificer Magic Item Plans — migrations 60-62

EFA `Replicate Magic Item` source tables are normalized into **56** `artificer-plan` catalogue rows.

Plan capacity is 4/5/6/7/8 at Artificer 2/6/10/14/18, with direct-Forge slot chronology `[2,2,2,2,6,10,14,18]`. Whenever an Artificer gains an Artificer level, one learned plan may optionally be replaced.

Each learned plan is one `character_class_option_grant_instances` row. Three repeatable wildcard families bind one canonical `items_catalog.id` under `choices.child`:

1. Common magic item except Potion/Scroll/cursed;
2. Uncommon non-cursed Wondrous Item;
3. Rare non-cursed Wondrous Item.

Each repeat of the same wildcard must bind a different concrete item. Learning/replacing a plan never creates inventory.

Migration 62 corrected wildcard eligibility before any user Artificer plan existed. Final live candidate pools remain 105 / 173 / 200.

Direct-Forge and earned-progression rollback proofs passed, including add/replacement parity and fail-closed tampering.

See `Artificer_Magic_Item_Plans_Status.md`.

## Species rest proficiency authority — migrations 63-66

This milestone is **complete**.

### MPMM Githyanki — Astral Knowledge

Astral Knowledge is explicitly excluded from permanent Forge proficiency state.

After a completed Long Rest, choose:

- one of all 18 skills; and
- one source-legal PHB weapon or tool proficiency.

The pair is stored in `character_runtime_feature_choices`, projected under `sheet.runtimeProficiencies.githyankiAstralKnowledge`, and automatically removed when the next Long Rest finishes.

### EFA Khoravar — Skill Versatility

The initial skill-or-tool choice is collected during Player Forge but materialized as runtime authority through a deferred progression trigger. It is not written into permanent proficiency arrays.

The current proficiency persists until explicitly replaced. A newer completed Long Rest permits replacement with another canonical skill or tool.

### Post-deploy corrections before user state

No real Githyanki/Khoravar runtime row existed while these corrections were made:

- migration 64 explicitly removed Supabase default anonymous EXECUTE from all four public Species runtime RPCs;
- migration 65 corrected the rest key to canonical `long_rest`;
- migration 66 fixed projection-parent creation for sheets that lacked `runtimeProficiencies`.

Khoravar source identity is EFA throughout server/client authority; Githyanki remains MPMM. Encounter checks use the live `is_defeated` field.

### Acceptance

The final migration-66 source candidate passed all 18 relevant GitHub workflows, including the dedicated Species semantic gate and production build.

Deployed rollback lifecycle proofs passed:

- Githyanki pre-rest rejection;
- canonical Long Rest unlock;
- runtime row + projection creation;
- no permanent proficiency mutation;
- automatic row + projection expiry next Long Rest;
- Khoravar direct shared-Forge materialization;
- immediate replacement rejection;
- invalid option rejection;
- newer Long Rest replacement unlock;
- skill-to-tool replacement;
- no permanent proficiency mutation;
- zero synthetic residue.

See `Species_Rest_Proficiency_Runtime_Status.md`.

## Current production integrity checkpoint

After migrations 63-66 and all rollback fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell assignments;
- 7 progression rows;
- 18 inventory rows;
- 0 live Githyanki/Khoravar runtime rows;
- 0 Species QA proof characters;
- 20 world locations;
- 4 map routes;
- 9 map route points.

Migrations 63, 64, 65, and 66 are registered live.

Vercel is presently blocked by the account build-rate limit; the exact source candidates are independently production-build gated in GitHub Actions.

## Remaining PR #170 blockers

Starting magic, starting equipment/currency, Artificer plan authority, the established runtime families through Circle of the Land, and the Githyanki/Khoravar proficiency slice are closed.

Remaining work:

1. continue the final source-choice coverage audit, currently including:
   - XPHB High Elf Long-Rest replaceable Wizard cantrip;
   - EFA Khoravar Fey Gift Long-Rest replaceable cantrip;
   - Eladrin season/trance choices;
   - Boon of Energy Resistance;
   - Echoing Soul / Zhentarim Tactics Long-Rest Expertise;
   - Cartomancer Hidden Ace;
   - remaining class/subclass runtime families already excluded from permanent Forge state;
2. confirm and correct Echoing Soul's separate permanent acquisition count if the imported/source audit proves it under-modeled;
3. audit/revoke obsolete authenticated level-up completion RPC generations and the anonymous class-choice getter grant when confirmed unused;
4. final authenticated browser acceptance across representative low/high-level, martial/caster, nested-feat, subclass, starting-magic, equipment, and runtime-rest cases;
5. Steps of the Fey per-cast integration only when spell/combat execution is explicitly brought into scope;
6. tactical consumption of canonical runtime damage resistance only when encounter/combat work is explicitly brought into scope;
7. merge PR #170 only after closure gates are satisfied.

## Protected boundaries

This work does not authorize changes to world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting behavior. `components/MapPageClient.js` remains outside PR #170 Forge/progression/runtime work.

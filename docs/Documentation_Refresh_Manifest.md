# Documentation Refresh Manifest

Updated: 2026-08-08

## Purpose

This manifest identifies the current documentation authority for DNDNext while PR #170 moves faster than older platform-wide roadmap prose. Current repository source and live Supabase remain higher-trust than historical documents.

## Authoritative PR #170 reading order

For active Character Forge / progression / runtime-choice work, read:

1. `Unified_Character_Forge_Status.md`
2. `Character_Progression_Foundation.md`
3. `Character_Forge_PR_A_Deployment_Evidence.md`
4. `Character_Progression_and_Higher_Level_Forge.md`
5. `Wizard_Spell_Mastery_Runtime_Status.md`
6. `Player_Forge_Starting_Magic_v3_Status.md`
7. `Player_Forge_Starting_Equipment_Status.md`
8. `Astral_Trance_Runtime_Status.md`
9. `Primal_Companion_Runtime_Status.md`
10. `Dread_Allegiance_Runtime_Status.md`
11. `Fiendish_Resilience_Runtime_Status.md`
12. `Circle_of_the_Land_Runtime_Status.md`
13. `Artificer_Magic_Item_Plans_Status.md`
14. `DNDNext_Current_Handoff_Prompt.md`

If these documents conflict with older Character Forge/progression prose, these PR #170 documents control until the broader roadmap is rewritten.

## Live Character Forge / progression checkpoint through migration 62

Production includes:

- 38-39 — Battle Master normalized maneuver authority;
- 40-41 — Wizard Savant;
- 42-43 — Wizard Signature Spells + explicit free-cast resources;
- 44 — Wizard Spell Mastery runtime;
- 45 — class Weapon Mastery runtime;
- 46 — Weapon Master feat runtime;
- 47-48 — Player Forge v3 starting magic + ACL correction;
- 49-51 — starting equipment, higher-level wealth, and character-scoped currency;
- 52-54 — Astral Trance runtime + normalization corrections;
- 55 — Primal Companion runtime;
- 56 — Dread Allegiance runtime + feature-cantrip authority;
- 57 — Fiendish Resilience Short/Long-Rest runtime authority;
- 58-59 — Circle of the Land source-derived Circle Spell packages + parser correction;
- 60 — source-derived EFA Artificer Magic Item Plan instances for direct Forge + earned progression;
- 61 — Artificer legacy-sheet projection parent guard;
- 62 — positive canonical magic-item identity for wildcard Artificer plans.

Character currency post-create presentation is also complete through `CharacterCurrencyBadge`, which reads character-scoped currency only and never falls back to `player_wallets`.

## Creation / progression / runtime split

Persistent decisions made by direct level-N Forge creation and earned level-N progression should converge.

Current model:

- persistent creation / attained-level choice → authoritative Forge/progression state;
- proficiency-dependent permanent choice → Training placement;
- permanent spellbook-dependent choice → Spells placement;
- Long-/Short-Rest configurable choice → guarded runtime state;
- per-use choice → spell/action resolver;
- informational feature → display only.

Examples:

- Wizard Savant / Signature Spells → persistent progression/spellbook state;
- Spell Mastery / Weapon Mastery → Long-Rest runtime state;
- Astral Trance → runtime pair that expires at the next Long Rest;
- Primal Companion → current beast persists until explicitly replaced after a newer Long Rest;
- Dread Allegiance → linked allegiance/resistance/cantrip package persists until replaced after a newer Long Rest;
- Fiendish Resilience → first choice requires a post-acquisition Short/Long Rest; current resistance persists until a later Short/Long-Rest replacement;
- Circle Spells → current land package expires automatically at the next Long Rest and must be chosen again;
- Steps of the Fey → per-Misty-Step choice, not rest-stored state;
- Artificer Magic Item Plans → persistent learned-plan instances; wildcard plan instances bind a canonical item identity but do not create inventory.

## Starting magic / equipment / currency

`create_player_character_v3` remains shared Player Forge creation authority.

Starting magic covers native class-list spells, Background-expanded access, Eldritch Knight, and Arcane Trickster including fixed Mage Hand.

Starting equipment is source-backed for the XPHB core classes plus EFA Artificer. Concrete starter gear becomes character-owned inventory and starts unequipped. Character cash is stored in `character_currency` as copper. Higher-level magic-item quantities remain a DM guide only and are not auto-granted.

The character-sheet currency badge now reads only `get_character_currency_v1(character_id)`, hides if no character balance row exists, and displays authoritative zero balances correctly.

See `Player_Forge_Starting_Magic_v3_Status.md` and `Player_Forge_Starting_Equipment_Status.md`.

## Runtime cadence families through 59

Detailed source/lifecycle evidence is recorded in the dedicated status documents.

Important final semantics:

- Astral Trance: expires at next Long Rest;
- Primal Companion: persists until changed; newer Long Rest opens one replacement;
- Dread Allegiance: persists until changed; newer Long Rest opens one linked replacement;
- Fiendish Resilience: persists until changed; newer Short or Long Rest opens replacement;
- Circle of the Land: package expires automatically at next Long Rest; source-derived land spell matrix;
- Steps of the Fey: per-cast Misty Step option and deliberately deferred from this non-combat slice.

Runtime damage resistance from Dread + Fiendish is canonical through `private.character_runtime_damage_resistances_v1`. Tactical encounter snapshot/damage consumption remains deliberately deferred until combat work is explicitly in scope.

## Runtime panel composition regression — corrected

During the Artificer gate, shared validators exposed that later full-file updates had overwritten earlier sheet-side runtime panel imports.

The actual sheet chain is now restored and exact-head CI-proven:

`CharacterSheetPanel → CharacterAstralTrancePanel → CharacterDreadAllegiancePanel → CharacterFiendishResiliencePanel → CharacterCircleLandPanel → CharacterCurrencyBadge`

`CharacterPrimalCompanionPanel` remains a separate direct sheet mount.

Each chained parent renders its downstream child even when its own feature is ineligible, so a species/class mismatch cannot hide later panels.

This was a real reachability regression and was fixed before Artificer migration deployment.

## Artificer Magic Item Plans — migrations 60-62

EFA `Replicate Magic Item` source tables are normalized directly into **56** `artificer-plan` rows in `class_feature_option_catalog`.

Plan capacity is 4/5/6/7/8 at Artificer levels 2/6/10/14/18, with direct-Forge slot acquisition chronology `[2,2,2,2,6,10,14,18]`.

Each learned plan is an independent `character_class_option_grant_instances` row.

Three wildcard families require a dependent canonical item:

- Common magic item except Potion/Scroll/cursed;
- Uncommon non-cursed Wondrous Item;
- Rare non-cursed Wondrous Item.

Each repeat of a wildcard must bind a different concrete item.

Migration 62 corrected the first post-deploy catalogue audit before any user Artificer plan existed: rarity alone had allowed a non-magic Common alchemy row. Final server/client filtering now requires positive magic-item identity using imported magic-item type, Wondrous marker, or canonical Wondrous Item type.

Final live wildcard pools:

- Common: **105**;
- Uncommon Wondrous: **173**;
- Rare Wondrous: **200**.

Direct Forge and earned progression rollback proofs passed, including add/replace parity and fail-closed tampering. Learning plans never changed inventory.

See `Artificer_Magic_Item_Plans_Status.md`.

## Current production integrity checkpoint

After migration 62 and all rollback fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell assignments;
- 7 progression rows;
- 0 open level-up sessions;
- 18 inventory rows;
- 0 live Artificer plan grant instances;
- 0 QA proof characters;
- 56 EFA Artificer plan options;
- 3 Artificer wildcard families;
- 20 world locations;
- 4 map routes;
- 9 map route points.

Private Artificer helpers are service-role only. `complete_character_level_up_v5` is authenticated/service-role only.

`get_character_level_class_choice_options_v2` still inherits a pre-existing anonymous execute grant. That grant was not introduced by migrations 60-62 and remains part of the progression-RPC/ACL cleanup before PR closure.

## Remaining active PR #170 work

Completed work should not be reopened without contradictory source/live evidence.

Remaining major work:

1. final persistent/conditional Species / Background / Class / Feat / Subclass source-choice coverage and UI audit;
2. obsolete/authenticated progression RPC + ACL cleanup, including the anonymous class-choice getter grant;
3. final authenticated browser acceptance;
4. Steps of the Fey per-cast integration only when spell/combat execution is explicitly in scope;
5. tactical consumption of runtime damage resistance only when encounter/combat is explicitly in scope;
6. merge PR #170 only after closure gates are satisfied.

## Protected boundaries

Character Forge/progression/runtime documentation does not authorize world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting changes. `components/MapPageClient.js` remains outside this work unless explicitly requested.

# Documentation Refresh Manifest

Updated: 2026-08-09

## Purpose and trust order

This manifest is the documentation-precedence overlay for active PR #170 Character Forge / progression / runtime work.

Trust order:

1. live Supabase schema, migration history, grants, and data;
2. current PR source plus exact-head CI/Vercel;
3. dedicated feature ledgers below;
4. broader roadmap prose and historical exports.

If prose conflicts with live source/database state, live source/database state controls until documentation is corrected.

## Active reading order

Read these before changing PR #170 runtime/progression behavior:

1. `Unified_Character_Forge_Status.md`
2. `Character_Progression_Foundation.md`
3. `Character_Forge_PR_A_Deployment_Evidence.md`
4. `Character_Progression_and_Higher_Level_Forge.md`
5. `Wizard_Spell_Mastery_Runtime_Status.md`
6. `Wizard_Memorize_Spell_Runtime_Status.md`
7. `Wizard_Cantrip_Formulas_Runtime_Status.md`
8. `Armorer_Armor_Model_Runtime_Status.md`
9. `Bestial_Soul_Runtime_Status.md`
10. `Player_Forge_Starting_Magic_v3_Status.md`
11. `Player_Forge_Starting_Equipment_Status.md`
12. `Astral_Trance_Runtime_Status.md`
13. `Species_Rest_Proficiency_Runtime_Status.md`
14. `Species_Replaceable_Cantrip_Runtime_Status.md`
15. `Eladrin_Runtime_Status.md`
16. `Primal_Companion_Runtime_Status.md`
17. `Dread_Allegiance_Runtime_Status.md`
18. `Fiendish_Resilience_Runtime_Status.md`
19. `Circle_of_the_Land_Runtime_Status.md`
20. `Artificer_Magic_Item_Plans_Status.md`
21. `Boon_Energy_Resistance_Runtime_Status.md`
22. `Feat_Runtime_Expertise_Status.md`
23. `Cartomancer_Runtime_Status.md`
24. `DNDNext_Current_Handoff_Prompt.md`

## Live checkpoint through migration 80

Recent normalized sequence:

- 68 — Eladrin seasonal Trance runtime;
- 69-70 — Boon of Energy Resistance + provenance fix;
- 71 — Echoing Soul / Zhentarim runtime Expertise;
- 72-73 — Cartomancer + deterministic state fix;
- 74-75 — Wizard Memorize Spell + deterministic state fix;
- 76 — shared Wizard runtime helper repair;
- 77 — TCE Cantrip Formulas for PHB Wizard;
- 78 — Artificer Armorer Armor Model + `short_or_long_rest` cadence compatibility repair;
- 79 — TCE Path of the Beast Bestial Soul runtime;
- 80 — Bestial Soul source-list option resolver fix.

Latest registered migration: `bestial_soul_option_resolver_fix` (`20260809231912`).

## Creation / progression / runtime split

- persistent source-owned acquisition choice → Forge/progression authority;
- permanent proficiency choice → Training placement;
- permanent spellbook-dependent choice → Spells placement;
- Short-/Long-Rest configurable choice → guarded runtime authority;
- per-use/per-cast choice → action/spell resolver;
- informational/always-on feature → display/consumer logic only.

Accepted examples:

- Wizard Spell Mastery → at-will overlay + Long-Rest replacement;
- Wizard Memorize Spell → one prepared-spell exchange per qualifying Short Rest;
- Wizard Cantrip Formulas → in-place class cantrip replacement per qualifying Long Rest;
- Armorer Armor Model → immediate initial model, then Short/Long-Rest replacement with Smith's Tools present;
- Bestial Soul → post-acquisition Short/Long-Rest selection that expires at the next Short/Long Rest;
- Astral Trance / Astral Knowledge → rest runtime;
- Fiendish Resilience → Short/Long-Rest runtime;
- Circle Spells → rest-created package expiring at the next Long Rest;
- Steps of the Fey → per-cast action choice and still deferred from runtime storage.

## Armor Model acceptance

Migration 78 is live/accepted.

- EFA models: Dreadnaught, Guardian, Infiltrator.
- TCE models: Guardian, Infiltrator.
- Initial selection is immediate once the source feature is available.
- Smith's Tools inventory possession is the explicit current-schema proxy for “tools in hand.”
- Later replacements require a newer Short Rest or Long Rest.
- Active encounters block configuration.
- Runtime key: `artificer-armorer-armor-model`.
- Projection: `runtimeFeatures.armorerArmorModel`.
- No armor inventory/AC/combat/crafting mutation occurs in this slice.

Migration 78 also adds `short_or_long_rest` to the runtime cadence check. A deployed rollback smoke test proves existing Fiendish Resilience can now store its intended cadence.

See `Armorer_Armor_Model_Runtime_Status.md`.

## Bestial Soul acceptance

Migrations 79-80 are live/accepted.

- PHB Barbarian / TCE Beast / level 6+ only;
- XPHB Barbarian is ineligible;
- magical Form of the Beast weapons are always-on feature text, not a choice;
- source list items resolve to exactly Swimming, Climbing, Jumping;
- first selection requires a Short/Long Rest newer than acquisition;
- selected benefit becomes inactive/expired at the next qualifying rest;
- the newer rest then authorizes one new selection;
- active encounters block configuration;
- runtime key: `barbarian-beast-bestial-soul`;
- projection: `runtimeFeatures.bestialSoul`;
- no movement/species/world-travel/combat fields are mutated.

Migration 80 exists because the imported source stores adaptations as plain list items, not named child entries. The correction is additive and does not rewrite migration 79 history.

See `Bestial_Soul_Runtime_Status.md`.

## Exact-head / production checkpoint

The migration-80 source head `d40371c2f2bf66d8dcf40141ada9cd62f8686517` passed all 27 PR workflows and Vercel before migration 80 deployment.

After final deployed rollback acceptance:

- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 18 inventory rows;
- 0 live Bestial runtime rows;
- 0 Bestial QA characters;
- 20 locations;
- 4 map routes;
- 9 map route points;
- Bestial source option count = 3.

## Remaining active PR #170 work

Completed slices should not be reopened without contradictory live/source evidence.

Next bounded source audit: **Wild Heart Aspect of the Wilds**. Then continue Hunter's Prey, Defensive Tactics, and Phantom Whispers of the Dead only after each exact source lifecycle is classified.

Broader closure work remains:

- progression RPC/ACL cleanup where live grants still prove a gap;
- final authenticated browser acceptance;
- action-layer integrations explicitly deferred from runtime state;
- final documentation reconciliation;
- merge PR #170 only after exact-head closure gates pass.

## Protected boundaries

This document does not authorize world-map, town/city-map, route/travel/weather, unrelated crafting/inventory, or tactical action changes. `components/MapPageClient.js` remains outside current scope unless explicitly requested.

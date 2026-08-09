# Documentation Refresh Manifest

Updated: 2026-08-09

## Purpose

This manifest identifies the current documentation authority for DNDNext while PR #170 continues the Character Forge / progression / runtime-choice normalization work.

Trust order remains:

1. live Supabase schema/data/migrations;
2. current PR source and exact-head validators/builds;
3. the dedicated status ledgers below;
4. older platform-wide roadmap prose and historical exports.

If documentation conflicts with live source/database state, live source/database state controls until the docs are corrected.

## Authoritative PR #170 reading order

For active Character Forge / progression / runtime-choice work, read:

1. `Unified_Character_Forge_Status.md`
2. `Character_Progression_Foundation.md`
3. `Character_Forge_PR_A_Deployment_Evidence.md`
4. `Character_Progression_and_Higher_Level_Forge.md`
5. `Wizard_Spell_Mastery_Runtime_Status.md`
6. `Wizard_Memorize_Spell_Runtime_Status.md`
7. `Wizard_Cantrip_Formulas_Runtime_Status.md`
8. `Player_Forge_Starting_Magic_v3_Status.md`
9. `Player_Forge_Starting_Equipment_Status.md`
10. `Astral_Trance_Runtime_Status.md`
11. `Species_Rest_Proficiency_Runtime_Status.md`
12. `Species_Replaceable_Cantrip_Runtime_Status.md`
13. `Eladrin_Runtime_Status.md`
14. `Primal_Companion_Runtime_Status.md`
15. `Dread_Allegiance_Runtime_Status.md`
16. `Fiendish_Resilience_Runtime_Status.md`
17. `Circle_of_the_Land_Runtime_Status.md`
18. `Artificer_Magic_Item_Plans_Status.md`
19. `Boon_Energy_Resistance_Runtime_Status.md`
20. `Feat_Runtime_Expertise_Status.md`
21. `Cartomancer_Runtime_Status.md`
22. `DNDNext_Current_Handoff_Prompt.md`

## Live Character Forge / progression checkpoint through migration 77

Production includes the normalized runtime/progression slices below:

- 38-39 — Battle Master maneuver normalization;
- 40-41 — Wizard Savant;
- 42-43 — Wizard Signature Spells + explicit free-cast resources;
- 44 — Wizard Spell Mastery runtime;
- 45 — class Weapon Mastery runtime;
- 46 — Weapon Master feat runtime;
- 47-48 — Player Forge v3 starting magic + ACL correction;
- 49-51 — starting equipment, higher-level wealth, character-scoped currency;
- 52-54 — Astral Trance runtime + normalization corrections;
- 55 — Primal Companion runtime;
- 56 — Dread Allegiance runtime + feature-cantrip authority;
- 57 — Fiendish Resilience Short/Long-Rest runtime authority;
- 58-59 — Circle of the Land source-derived Circle Spell packages + parser correction;
- 60-62 — EFA Artificer Magic Item Plans + wildcard corrections;
- 63-66 — Githyanki Astral Knowledge / Khoravar Skill Versatility runtime authority + ACL/rest/projection corrections;
- 67 — XPHB High Elf / EFA Khoravar replaceable Species cantrip authority;
- 68 — Eladrin seasonal Trance runtime;
- 69-70 — Boon of Energy Resistance runtime + provenance correction;
- 71 — Echoing Soul / Zhentarim expertise runtime normalization;
- 72-73 — Cartomancer runtime + deterministic state fix;
- 74-75 — Wizard Memorize Spell Short-Rest preparation runtime + deterministic state fix;
- 76 — shared Wizard runtime helper repair for Memorize Spell and Spell Mastery;
- 77 — TCE Cantrip Formulas Long-Rest runtime for the PHB Wizard.

Latest registered migration: `wizard_cantrip_formulas_runtime` (`20260809213738`).

## Creation / progression / runtime split

Persistent direct level-N Forge creation and earned level-N progression should converge on the same normalized authority.

Current model:

- persistent creation / attained-level choice → authoritative Forge/progression state;
- proficiency-dependent permanent choice → Training placement;
- permanent spellbook-dependent choice → Spells placement;
- Long-/Short-Rest configurable choice → guarded runtime state;
- per-use choice → spell/action resolver;
- informational feature → display only.

Representative examples:

- Wizard Savant / Signature Spells → persistent spellbook/progression state;
- Spell Mastery → at-will overlay with Long-Rest replacement;
- Memorize Spell → one prepared-spell replacement per qualifying Short Rest;
- Cantrip Formulas → one class-owned PHB Wizard cantrip assignment replaced in place per qualifying Long Rest;
- Weapon Mastery → rest-configurable runtime state;
- Astral Trance → runtime pair that expires at the next Long Rest;
- Githyanki Astral Knowledge → skill + PHB weapon/tool pair after Long Rest, expiring next Long Rest;
- Khoravar Skill Versatility → persistent runtime skill/tool choice, replaceable after a newer Long Rest;
- High Elf / Khoravar replaceable cantrips → fixed source spell initially, replaceable after newer Long Rest while permanent casting ability remains unchanged;
- Primal Companion → current beast persists until replaced after a newer Long Rest;
- Dread Allegiance → linked allegiance/resistance/cantrip package persists until replaced after a newer Long Rest;
- Fiendish Resilience → first choice after a post-acquisition Short/Long Rest, then replaceable after later Short/Long Rest;
- Circle Spells → land package expires automatically at the next Long Rest and must be selected again;
- Steps of the Fey → per-Misty-Step choice, not rest-stored state;
- Artificer Magic Item Plans → persistent learned plan instances; wildcard instances bind canonical item identity but do not create inventory;
- Boon of Energy Resistance → two source-valid resistances per feat instance, replaceable after a newer Long Rest;
- Echoing Soul → permanent acquisition choices plus Long-Rest-replaceable Expertise;
- Zhentarim Tactics → rest-limited Expertise that expires at the next Long Rest;
- Cartomancer Hidden Ace → temporary eight-hour spell access, never permanent spell membership.

## Wizard Memorize Spell / shared helper repair acceptance

Migrations 74-75 model Memorize Spell as Short-Rest preparation state. Migration 76 adds the shared private helper contracts the deployed audit found missing:

- `private.can_manage_character_spell_resources_v1(uuid)`;
- `private.character_class_feature_acquired_at_v1(uuid,text,text,integer)`.

Direct higher-level acquisition falls back to `character_progression.created_at`, not nonexistent `characters.created_at`.

Deployed rollback proofs cover Memorize Spell and shared Spell Mastery compatibility. See `Wizard_Memorize_Spell_Runtime_Status.md`.

## Wizard Cantrip Formulas acceptance

Migration 77 models the imported TCE Cantrip Formulas record exactly as a PHB Wizard level-3 Long-Rest runtime feature.

Important boundaries:

- PHB Wizard 3+ only; XPHB Wizard is ineligible;
- first use requires a Long Rest strictly newer than feature acquisition;
- one successful cantrip replacement per qualifying Long Rest;
- the outgoing row must be a known class-owned Wizard cantrip;
- the replacement comes from `spells_catalog_preferred`, is level 0, is on the Wizard list, and is not already known from any source;
- `character_spells.spell_id` is updated in place;
- assignment ID, class source identity, casting stat, and row count are preserved;
- no spell row is inserted or deleted;
- active encounters block configuration;
- normalized receipt key: `wizard-cantrip-formulas`;
- sheet projection: `runtimeFeatures.wizardCantripFormulas`.

Pre-deploy compile/rollback proof, all 25 exact-head GitHub Actions, Vercel, deployed rollback lifecycle, ACL checks, and zero-residue integrity all passed.

See `Wizard_Cantrip_Formulas_Runtime_Status.md`.

## Starting magic / equipment / currency

`create_player_character_v3` remains shared Player Forge creation authority.

Starting magic covers native class-list spells, Background-expanded access, Eldritch Knight, Arcane Trickster, and fixed Mage Hand where applicable. Species-owned replaceable cantrips are normalized separately and do not inflate class starting-magic counts.

Starting equipment is source-backed for XPHB core classes plus EFA Artificer. Concrete starter gear becomes character-owned inventory and starts unequipped. Character cash is stored in `character_currency` as copper. Higher-level magic-item quantities remain a DM guide only and are not auto-granted.

`CharacterCurrencyBadge` reads only character-scoped currency and also serves as an always-reachable downstream host for later runtime panels. Currency visibility must never hide unrelated runtime controls.

## Current runtime-panel composition

The established downstream sheet chain now includes:

`CharacterSheetPanel → ... → CharacterCurrencyBadge → Boon Energy Resistance → feat runtime Expertise → Cartomancer → Wizard Memorize Spell → Wizard Cantrip Formulas`

Other runtime panels retain their existing direct/indirect mounts. One eligibility check must never hide unrelated downstream runtime panels.

## Current production integrity checkpoint

After migration 77 and all rollback-only Cantrip Formulas acceptance fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell assignments;
- 7 progression rows;
- 18 inventory rows;
- 0 live Cantrip Formulas runtime rows;
- 0 Cantrip Formulas QA characters;
- 20 world locations;
- 4 map routes;
- 9 map route points.

The source head used for migration-77 acceptance (`1e9a9b59306a1e38c8a04bb484aa602f01a817d3`) passed all 25 relevant GitHub Actions workflows, including the Cantrip Formulas semantic validator and production build gate. Vercel also passed.

## Remaining active PR #170 work

Completed slices should not be reopened without contradictory source/live evidence.

Immediate next work:

1. continue the remaining class/subclass source-choice/runtime families one bounded slice at a time, inspecting source cadence before deciding implementation;
2. finish obsolete/authenticated progression RPC + ACL cleanup, including any pre-existing anonymous grants still confirmed live;
3. final authenticated browser acceptance;
4. keep Steps of the Fey per-cast integration deferred until spell/action execution is explicitly in scope;
5. keep tactical consumption of runtime damage resistance deferred until encounter/combat is explicitly in scope;
6. merge PR #170 only after closure gates are satisfied.

Known remaining family candidates from the PR ledger include Armorer Armor Model, Beast Bestial Soul, Wild Heart Aspect of the Wilds, Hunter's Prey / Defensive Tactics, and Phantom Whispers of the Dead. Treat that list as an audit queue, not as a pre-decided runtime model.

## Protected boundaries

This documentation does not authorize world-map, town/city-map, route/travel/weather, unrelated crafting/inventory, or encounter/action-layer changes.

`components/MapPageClient.js` remains outside the current Character Forge/progression/runtime scope unless explicitly requested.

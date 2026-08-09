# Documentation Refresh Manifest

Updated: 2026-08-09

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
9. `Species_Rest_Proficiency_Runtime_Status.md`
10. `Species_Replaceable_Cantrip_Runtime_Status.md`
11. `Primal_Companion_Runtime_Status.md`
12. `Dread_Allegiance_Runtime_Status.md`
13. `Fiendish_Resilience_Runtime_Status.md`
14. `Circle_of_the_Land_Runtime_Status.md`
15. `Artificer_Magic_Item_Plans_Status.md`
16. `DNDNext_Current_Handoff_Prompt.md`

If these documents conflict with older Character Forge/progression prose, the newest dedicated PR #170 status ledger plus live repository/database state controls until the broader roadmap is consolidated.

## Live Character Forge / progression checkpoint through migration 67

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
- 60-62 — source-derived EFA Artificer Magic Item Plans + wildcard corrections;
- 63-66 — Githyanki Astral Knowledge / Khoravar Skill Versatility runtime authority + ACL/rest-key/projection corrections;
- 67 — XPHB High Elf and EFA Khoravar source-fixed/Long-Rest-replaceable Species cantrip authority.

Character currency post-create presentation remains complete through `CharacterCurrencyBadge`, which reads character-scoped currency only and never falls back to `player_wallets`.

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
- Githyanki Astral Knowledge → post-Long-Rest skill + PHB weapon/tool pair that expires at the next Long Rest;
- Khoravar Skill Versatility → initial runtime skill/tool choice that persists until replaced after a newer Long Rest;
- High Elf Elven Lineage → permanent lineage/casting ability, source-fixed Prestidigitation, cantrip replaceable after newer Long Rest;
- Khoravar Fey Gift → permanent casting ability, source-fixed Friends, cantrip replaceable after newer Long Rest;
- Primal Companion → current beast persists until explicitly replaced after a newer Long Rest;
- Dread Allegiance → linked allegiance/resistance/cantrip package persists until replaced after a newer Long Rest;
- Fiendish Resilience → first choice requires a post-acquisition Short/Long Rest; current resistance persists until a later Short/Long-Rest replacement;
- Circle Spells → current land package expires automatically at the next Long Rest and must be chosen again;
- Steps of the Fey → per-Misty-Step choice, not rest-stored state;
- Artificer Magic Item Plans → persistent learned-plan instances; wildcard plan instances bind a canonical item identity but do not create inventory.

## Starting magic / equipment / currency

`create_player_character_v3` remains shared Player Forge creation authority.

Starting magic covers native class-list spells, Background-expanded access, Eldritch Knight, and Arcane Trickster including fixed Mage Hand. Species-owned replaceable cantrips are now separately normalized by migration 67 and do not inflate class starting-magic counts.

Starting equipment is source-backed for the XPHB core classes plus EFA Artificer. Concrete starter gear becomes character-owned inventory and starts unequipped. Character cash is stored in `character_currency` as copper. Higher-level magic-item quantities remain a DM guide only and are not auto-granted.

The character-sheet currency badge reads only `get_character_currency_v1(character_id)`, hides if no character balance row exists, and displays authoritative zero balances correctly.

See `Player_Forge_Starting_Magic_v3_Status.md` and `Player_Forge_Starting_Equipment_Status.md`.

## Runtime cadence authority through 67

Detailed source/lifecycle evidence is recorded in the dedicated status documents.

Important final semantics:

- Astral Trance: expires at next Long Rest;
- Githyanki Astral Knowledge: no Forge lock; choose one skill + one PHB weapon/tool after Long Rest; expires next Long Rest;
- Khoravar Skill Versatility: one initial skill/tool runtime choice; persists until a newer Long Rest permits replacement;
- High Elf cantrip: fixed Prestidigitation initially; Wizard-cantrip replacement after newer Long Rest; permanent lineage casting ability unchanged;
- Khoravar Fey Gift cantrip: fixed Friends initially; Cleric/Druid/Wizard-cantrip replacement after newer Long Rest; permanent Fey Gift casting ability unchanged;
- Primal Companion: persists until changed; newer Long Rest opens one replacement;
- Dread Allegiance: persists until changed; newer Long Rest opens one linked replacement;
- Fiendish Resilience: persists until changed; newer Short or Long Rest opens replacement;
- Circle of the Land: package expires automatically at next Long Rest; source-derived land spell matrix;
- Steps of the Fey: per-cast Misty Step option and deliberately deferred from this non-combat slice.

Runtime damage resistance from Dread + Fiendish is canonical through `private.character_runtime_damage_resistances_v1`. Tactical encounter snapshot/damage consumption remains deliberately deferred until combat work is explicitly in scope.

### Species proficiency correction evidence — migrations 63-66

The Species proficiency slice caught and corrected four defects before any real Githyanki/Khoravar runtime state existed:

1. Khoravar source identity and encounter-column wiring were corrected to EFA / `is_defeated` before migration 63 deployment.
2. Supabase default `anon` EXECUTE was explicitly removed in migration 64.
3. DNDNext's canonical rest key `long_rest` replaced the prose shorthand `long` in migration 65.
4. Missing `runtimeProficiencies` parents are now created safely by migration 66.

Rollback lifecycle proofs passed for both Githyanki and Khoravar. Permanent proficiency objects remained unchanged and all synthetic rows rolled back.

See `Species_Rest_Proficiency_Runtime_Status.md`.

### Species replaceable cantrip evidence — migration 67

Migration 67 separates the permanent spellcasting-ability decision from the replaceable cantrip:

- High Elf: fixed initial Prestidigitation, 31 legal Wizard-cantrip options after a newer Long Rest;
- Khoravar Fey Gift: fixed initial Friends, 44 legal Cleric/Druid/Wizard options after a newer Long Rest.

The fixed initial cantrip is deferred-materialized after shared Player Forge creation into one `character_spells` row with `source_type='species'`. Replacement preserves the stable Species source key and casting stat.

Exact-head CI was green across all 19 relevant workflows before deployment. Deployed rollback proofs passed fixed initial materialization, real canonical Long-Rest unlock, same-cantrip rejection, illegal-list rejection, valid replacement, projection update, permanent source-choice preservation, and zero residue for both Species families.

See `Species_Replaceable_Cantrip_Runtime_Status.md`.

## Runtime panel composition

The established sheet chain remains exact-head CI-proven:

`CharacterSheetPanel → CharacterAstralTrancePanel → CharacterDreadAllegiancePanel → CharacterFiendishResiliencePanel → CharacterCircleLandPanel → CharacterCurrencyBadge`

`CharacterPrimalCompanionPanel` and `CharacterSpeciesRestProficiencyPanel` are separate direct sheet mounts. `CharacterSpeciesReplaceableCantripPanel` is an always-reachable downstream child of the Species rest-proficiency panel, so High Elf can reach cantrip controls without having a proficiency-runtime family and Khoravar can render both Species runtime families.

One class/species eligibility check must never hide unrelated downstream runtime panels.

## Artificer Magic Item Plans — migrations 60-62

EFA `Replicate Magic Item` source tables are normalized directly into **56** `artificer-plan` rows in `class_feature_option_catalog`.

Plan capacity is 4/5/6/7/8 at Artificer levels 2/6/10/14/18, with direct-Forge slot acquisition chronology `[2,2,2,2,6,10,14,18]`.

Each learned plan is an independent `character_class_option_grant_instances` row. Three wildcard families require a dependent canonical item:

- Common magic item except Potion/Scroll/cursed;
- Uncommon non-cursed Wondrous Item;
- Rare non-cursed Wondrous Item.

Each repeat of a wildcard must bind a different concrete item. Learning plans never creates inventory.

Final live wildcard pools remain:

- Common: **105**;
- Uncommon Wondrous: **173**;
- Rare Wondrous: **200**.

See `Artificer_Magic_Item_Plans_Status.md`.

## Current production integrity checkpoint

After migration 67 and all rollback fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell assignments;
- 7 progression rows;
- 18 inventory rows;
- 0 live High Elf/Khoravar replaceable-cantrip runtime rows;
- 0 live High Elf/Khoravar replaceable-cantrip Species spell rows;
- 0 cantrip QA characters;
- 0 live Githyanki/Khoravar proficiency runtime rows;
- 56 EFA Artificer plan options;
- 3 Artificer wildcard families;
- 20 world locations;
- 4 map routes;
- 9 map route points.

Migration 67 is registered live. The pre-deployment migration-67 candidate passed all 19 relevant GitHub workflows including the dedicated cantrip semantic gate and production build.

Vercel remains blocked by the account build-rate limit rather than an application build failure.

`get_character_level_class_choice_options_v2` still inherits a pre-existing anonymous execute grant. That remains part of the progression-RPC/ACL cleanup before PR closure.

## Remaining active PR #170 work

Completed work should not be reopened without contradictory source/live evidence.

Remaining major work:

1. continue the final source-choice coverage audit, now focusing on Eladrin and remaining feat/class/subclass runtime families;
2. correct Echoing Soul's separate permanent-acquisition under-modeling if confirmed by the imported/source audit;
3. obsolete/authenticated progression RPC + ACL cleanup, including the anonymous class-choice getter grant;
4. final authenticated browser acceptance;
5. Steps of the Fey per-cast integration only when spell/combat execution is explicitly in scope;
6. tactical consumption of runtime damage resistance only when encounter/combat is explicitly in scope;
7. merge PR #170 only after closure gates are satisfied.

## Protected boundaries

Character Forge/progression/runtime documentation does not authorize world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting changes. `components/MapPageClient.js` remains outside this work unless explicitly requested.

# Character Forge PR A — Deployment Evidence

Status date: 2026-08-14 historical reconciliation
PR: #170 (`agent/character-forge-resilience-presentation`) — merged at `599c4de7397ba6e4bbbb0a061d551d80c3570be7`
Live migration checkpoint: 66

## Acceptance state

This is historical deployment evidence from the PR #170 cycle. CI/build success plus rollback-only production proofs remain regression/authority evidence, but current PR and transition state is controlled by `DNDNext_Current_Handoff_Prompt.md`.

The active design rule is creation/progression parity for persistent source-owned decisions, with rest/per-use/informational choices modeled separately as runtime state.

## Live migration checkpoint

- 38-39 — Battle Master maneuver normalization/progression;
- 40-41 — Wizard Savant progression + higher-level Forge chronology;
- 42-43 — Wizard Signature Spells + free-cast resource authority;
- 44 — Wizard Spell Mastery runtime;
- 45 — class Weapon Mastery runtime;
- 46 — Weapon Master feat runtime and combined projection;
- 47-48 — Player Forge v3 multi-source starting magic + ACL cleanup;
- 49-51 — source-backed starting equipment, higher-level wealth, character currency, and character-scoped projection;
- 52-54 — Astral Trance runtime + normalization corrections;
- 55 — Primal Companion runtime;
- 56 — Dread Allegiance runtime;
- 57 — Fiendish Resilience runtime;
- 58-59 — Circle of the Land source-derived runtime packages;
- 60-62 — EFA Artificer Magic Item Plan authority + wildcard eligibility corrections;
- 63 — Githyanki Astral Knowledge + Khoravar Skill Versatility runtime authority;
- 64 — explicit anonymous Species-RPC ACL cleanup;
- 65 — canonical `long_rest` key correction;
- 66 — Species runtime projection parent compatibility fix.

Detailed subsystem evidence lives in the dedicated status documents indexed by `Documentation_Refresh_Manifest.md`.

## Player Forge creation evidence

The shared Player Forge calls `create_player_character_v3`.

Starting-magic rollback proofs established native class-list, Background-expanded, Eldritch Knight, Arcane Trickster fixed Mage Hand, and fail-closed invalid submissions.

Starting-equipment rollback proofs cover concrete gear, cash-only packages, generic tool/instrument selectors, Wizard Spellbook resolution, higher-level d10 cash, DM-only magic-item allowance, and fail-closed tampering. Starter inventory begins unequipped and currency is character-scoped copper.

## Runtime cadence evidence through migration 59

### Astral Trance — 52-54

Deployed rollback proof verified:

- no configuration before first Long Rest;
- configuration after Long Rest;
- same-rest second configuration rejection;
- Short-Rest persistence;
- automatic expiry/reopen at next Long Rest;
- all 18 skills and 74 legal PHB-equivalent weapon/tool choices;
- firearm rejection;
- non-Astral-Elf rejection;
- no permanent proficiency mutation;
- zero synthetic/runtime residue.

### Primal Companion / Dread Allegiance / Fiendish Resilience / Circle Land — 55-59

Dedicated workflows, rollback proofs, and status ledgers verify their source-specific acquisition/replacement/expiry semantics. These remain separate from permanent Forge state.

The runtime sheet composition regression found during later Artificer work was repaired before Artificer deployment. The accepted chain is:

`CharacterSheetPanel → CharacterAstralTrancePanel → CharacterDreadAllegiancePanel → CharacterFiendishResiliencePanel → CharacterCircleLandPanel → CharacterCurrencyBadge`

Primal Companion and Species rest proficiency controls are separate direct mounts.

## Artificer Magic Item Plans — migrations 60-62

EFA `Replicate Magic Item` source data produces 56 normalized learned-plan options.

Rollback acceptance verified:

- direct EFA Artificer 2 four-plan materialization;
- direct higher-level slot chronology;
- same Common wildcard repeated with different concrete items;
- no inventory creation;
- Artificer 5→6 one new plan slot + optional replacement;
- replacement preserves instance key;
- alchemy/recipe/non-magic Common rows rejected;
- wildcard-without-child rejected;
- fixed-plan-with-child rejected;
- duplicate wildcard/concrete-item pair rejected;
- non-Artificer payload rejected;
- zero QA residue.

Final wildcard pools remain 105 Common / 173 Uncommon Wondrous / 200 Rare Wondrous.

See `Artificer_Magic_Item_Plans_Status.md`.

## Species rest proficiency authority — migrations 63-66

### Source/client correction before migration 63 deployment

Review of the staged migration/client caught source and integration defects before production state existed:

- Khoravar is EFA, not MPMM;
- encounter participants use `is_defeated`;
- `NpcForgeFeatChoiceRegistrar` must invoke the Species runtime-choice post-processor;
- `CharacterSheetPanel` must mount the Species runtime panel;
- the runtime proficiency utility must add Githyanki/Khoravar state without replacing Astral behavior.

A dedicated push/pull-request workflow was added to prevent regression.

### Migration 63

Installed runtime authority for:

- MPMM Githyanki Astral Knowledge;
- EFA Khoravar Skill Versatility.

Githyanki is absent from creation-time permanent proficiency choices. Khoravar's initial Forge skill/tool choice is deferred-materialized as runtime state rather than permanent training.

### Migration 64 — ACL correction

Post-deploy ACL inspection showed Supabase public-schema defaults had left explicit anonymous EXECUTE on the four new public RPCs even though PostgreSQL `PUBLIC` was revoked.

Migration 64 explicitly removed `anon` and restored only authenticated/service-role command access.

Live verification:

- anonymous EXECUTE count: 0;
- authenticated EXECUTE count: 4.

### Migration 65 — canonical rest key

Inspection of `complete_character_rest_v1` and existing runtime adapters established that the canonical rest-log key is `long_rest`, not `long`.

Migration 65 corrected both the Species latest-rest helper and Githyanki automatic-expiry trigger before any real Species runtime row existed.

### Migration 66 — projection parent compatibility

The first deployed lifecycle proof found that a clean sheet without `runtimeProficiencies` created the runtime row but not the sheet projection.

Cause: `jsonb_typeof(missing_key)` returns SQL NULL, so migration 63's direct comparison did not enter the parent-creation branch.

Migration 66 normalizes the NULL and creates the missing parent before writing the nested runtime state.

### Exact-head CI evidence

The final migration-66 source candidate passed all **18 relevant GitHub workflows**, including:

- dedicated Species rest proficiency semantic validation;
- Astral Trance regression validation;
- unified Character Forge validation;
- production build gate;
- progression authority/v3;
- nested choices;
- NPC Forge;
- starting magic/equipment/currency;
- Wizard Spell Mastery;
- Primal/Dread/Fiendish/Circle;
- Artificer.

Vercel remains separately blocked by the account build-rate limit; the application production build itself is green in GitHub Actions.

### Final deployed Githyanki rollback proof

Using actual `complete_character_rest_v1(..., 'long_rest')` and the public Species RPCs:

- pre-rest configuration rejected;
- canonical Long Rest unlocks configuration;
- runtime row created;
- clean-sheet `runtimeProficiencies.githyankiAstralKnowledge` projection created;
- permanent `sheet.proficiencies` unchanged;
- next canonical Long Rest removes runtime row;
- next canonical Long Rest removes projection;
- transaction rolled back.

### Final deployed Khoravar rollback proof

Using the shared Player Forge source-choice payload and deferred materializer:

- initial `skill:acrobatics` materialized as runtime state;
- sheet runtime projection created;
- immediate replacement rejected;
- invalid option rejected;
- newer canonical Long Rest unlocks replacement;
- replacement from skill to canonical tool succeeds;
- permanent `sheet.proficiencies` unchanged;
- transaction rolled back.

### Zero-residue checkpoint

After the deployed rollback proofs:

- 7 characters;
- 7 character sheets;
- 30 character-spell assignments;
- 7 progression rows;
- 18 inventory rows;
- 0 live Githyanki/Khoravar runtime rows;
- 0 Species QA proof characters;
- 20 locations;
- 4 map routes;
- 9 map route points.

Migrations 63, 64, 65, and 66 are registered live.

See `Species_Rest_Proficiency_Runtime_Status.md`.

## Remaining acceptance blockers

1. continue final source-choice coverage: High Elf/Khoravar replaceable cantrips, Eladrin, remaining feat/class/subclass runtime families, and any confirmed persistent acquisition gaps;
2. progression RPC/ACL cleanup, including the pre-existing anonymous `get_character_level_class_choice_options_v2` grant and legacy level-up completion generations when confirmed unused;
3. final authenticated browser acceptance;
4. Steps of the Fey per-cast integration only when spell/combat execution is explicitly in scope;
5. tactical consumption of runtime damage resistance only when encounter/combat is explicitly in scope;
6. merge PR #170 only after those gates close.

## Protected boundaries

This work has not modified world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting runtime behavior. `components/MapPageClient.js` remains outside this PR slice.

# Documentation Refresh Manifest

Updated: 2026-08-16

## Trust order

For current work, trust sources in this order:

1. live Supabase schema, migration ledger, grants, RPC definitions, and relevant data;
2. current GitHub `main`/active PR source, exact remote head, exact-head CI, and Vercel state;
3. `DNDNext_Current_Handoff_Prompt.md` and the dedicated ledger for the subsystem being changed;
4. broader roadmap/history prose;
5. raw SQL/text exports and old PR ledgers as historical snapshots only.

If prose conflicts with live source/database state, live authority wins until the documentation is corrected.

## Current GitHub checkpoint

Accepted runtime/code baseline:

`8c37e30063d2523a5f488073d3ea60c5571c7182` — merge of PR #173.

A later documentation-only merge may advance `main` without changing runtime behavior; always inspect the current ref before starting implementation.

Recent merged sequence:

- PR #170 — merged `599c4de7397ba6e4bbbb0a061d551d80c3570be7`;
- PR #171 — merged `ed93331b946dffee1e63183e969f115d0c8a1a18`;
- PR #172 — merged `8b62e38cc4de490dd4a02b57b0e9448baff3e5ef`;
- PR #173 — merged `8c37e30063d2523a5f488073d3ea60c5571c7182`.

Do not describe #170–#173 as open. Older ledgers that do so are historical evidence only.

PR #173 restored source-backed descriptions for Simic Hybrid Animal Enhancement while preserving the existing option keys, level-1/level-5 pools, and distinct second-pick rule. Its five triggered GitHub workflows succeeded, including the full Forge source-presentation production-build gate and the focused Simic regression. No Supabase write or migration was needed.

## Live database checkpoint

Supabase project: `DnDWeb` / `ucggczovhmauhshvhusx`.

At this refresh, `supabase_migrations.schema_migrations` contains 214 records. Latest registered migration:

`20260814161314 grim_hollow_heritage_catalog_support`

Recent registered entries:

- `20260814161314 grim_hollow_heritage_catalog_support`;
- `20260814160725 enable_http_for_grim_hollow_pg24_import`;
- `20260812042950 aven_subrace_catalog`;
- `20260812033649 genasi_source_detail_restore`;
- `20260811062025 genasi_subrace_catalog`;
- `20260810205646 rest_class_feature_restoration`;
- `20260810181530 pending_rest_runtime_choices`.

The old statement that migration 93 is the current live authority is obsolete.

Some repository SQL introduced after the numbered 91–93 sequence has live effects but is not represented in the Supabase migration ledger under the same repository filename. Treat that as **traceability drift**, not proof that the live effect is missing. Do not re-run already-correct production SQL just to make names line up.

## Controlling current documents

Read before modifying these areas:

- `DNDNext_Current_Handoff_Prompt.md` — current copy-ready takeover brief, accepted baseline, and next priority;
- `Forge_Post170_Species_Artwork_Status.md` — accepted/frozen Species presentation and artwork baseline;
- `Forge_Species_Family_Submenu_Status.md` — Species identity/family/persistence rules;
- `Forge_Source_Presentation_and_Species_Variants_Status.md` — structured source-rendering foundation/history;
- `Unified_Character_Forge_Status.md` — shared creation/progression/runtime architecture;
- `Eladrin_Runtime_Status.md` — Eladrin creation/runtime lifecycle;
- `Player_Forge_Choice_Routing_and_Source_Magic_Status.md` — placement and source-magic authority;
- `Pending_Rest_Runtime_Choices_Status.md` and matching `*_Runtime_Status.md` ledgers — runtime cadence;
- `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md` — item/equipment/crafting boundaries;
- `Tactical_Encounter_Combat_Roadmap_Blueprint.md` plus the latest tactical phase ledger — tactical authority;
- `CHATGPT_REPO_WRITE_PROCEDURE.md` — coherent GitHub/Supabase write procedure.

Historical PR #170/#171 ledgers remain useful for provenance but must not override current GitHub state.

## Core modeling rule

- permanent source-owned acquisition → Forge/progression authority;
- proficiency-dependent permanent choice → Training;
- spell-centric permanent choice → Spells;
- rest-configurable persistent choice → runtime authority whose current selection remains active until changed;
- next-rest-expiring choice → rest-cycle runtime state;
- first choice unlocked only by a rest → attention only while no benefit is active;
- per-use/per-cast choice → action/spell resolver;
- informational/always-on feature → presentation/consumer logic;
- future narrative unlocks → quest/dialogue authority when that subsystem exists, not improvised permanent Forge state.

Do not use visual similarity as permission to merge different lifecycles or persistence identities.

## Accepted Species presentation model

The Species tab is an accepted baseline after PRs #171–#173. Broad redesign is no longer an active task.

Current presentation classes remain:

1. **parent-persisted family choices** — Genasi, Dragonborn, Aven, Elf, Gnome, Shifter, Fairy, and Kithkin;
2. **real setting/source Species rows nested visually** — setting/source-specific rows keep their true catalogue identity;
3. **inline trait choices** — Goliath Giant Ancestry, Tiefling Fiendish Legacy, Simic Animal Enhancement, and similar trait-level decisions.

Species skill choices route to Training. Species magic routes to Spells. Runtime-only rest choices remain outside permanent Forge authority.

Accepted presentation includes the full-height catalogue, search-driven parent reveal, high-resolution Forge artwork, semantic portrait facts, canonical Size/Languages and Gender/Alignment controls, Darkvision guidance, affinity-aware Dragonborn copy, readable Aasimar/Hexblood structures, compact Goliath/Eladrin selected-detail choices, and source-backed Simic Animal Enhancement descriptions.

### Aetherborn future rule

`Gift of the Aetherborn` remains present and unchanged for now. Future acquisition/unlock authority belongs to quest/NPC dialogue progression. The Game Master decides what research, NPC, quest, payment, item, sacrifice, or other narrative prerequisite unlocks the dark Gift. Do not invent a universal requirement before the quest/dialogue system is designed.

## Protected boundaries

Forge work does not authorize world-map, town/city-map, route/travel/weather, tactical action execution, crafting/inventory execution, merchants, or unrelated runtime changes. `components/MapPageClient.js` remains outside scope unless Paul explicitly requests world-map work.

## Current work queue

Priority order after this documentation refresh:

1. **Background tab audit and bounded correction pass.** Inspect current source and live background data before changes.
2. **Class tab audit**, then continue Abilities → Training → Spells → Equipment → Identity → Story → Review as separate slices.
3. **Crafting issue #76** — simplify player-facing crafting/material cards and the smithing quality model without losing internal metadata or silently altering formulas/consumption.
4. **Repository housekeeping** — inspect stale issue #5 and old open PRs individually, then close or complete only with evidence; do not mass-close by age.
5. **Quest/NPC dialogue system** — when this work begins, include narrative unlock authority for Aetherborn's dark Gift.

A concrete production regression can supersede this queue, but otherwise keep each subsystem change isolated and exact-head validated.

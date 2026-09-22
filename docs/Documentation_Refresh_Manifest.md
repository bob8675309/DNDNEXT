# Documentation Refresh Manifest

Updated: 2026-09-21

## Trust order

For current work, trust sources in this order:

1. live Supabase schema, migration ledger, grants, RPC definitions, and relevant data;
2. current GitHub `main`/active PR source, exact remote head, exact-head CI, and Vercel state;
3. `DNDNext_Current_Handoff_Prompt.md` plus the dedicated active subsystem ledger;
4. broader roadmap/history prose;
5. raw exports and old PR ledgers as historical snapshots only.

If prose conflicts with live source/database state, live authority wins until documentation is corrected.


## 2026-09-21 current checkpoint override

This override was re-verified during the documentation reconciliation pass against live GitHub/Supabase state.

The older checkpoint sections below are retained as history. Current live authority is:

- accepted runtime checkpoint from merged PR #195: `320671a22b83432177dcc67e9efd035f3c3ccc5d`;
- documentation-only merges may place current `main` ahead of that runtime SHA, so re-fetch `main` before every write or merge;
- PR #195 is closed/merged: auth-gated navbar + admin activity view;
- production Vercel for that merge: `dpl_ETZZCzVZq8Cpw56Fndf9pfYmp5B8` — **READY** at handoff;
- active Character Forge presentation work: PR #194, branch `agent/subclass-carousel-drag-crisp-20260918`, reviewed head `f21a81435946b1ae8ec6112e5376062cfc2b62f4`, open/unmerged;
- PR #194 exact-head Vercel is READY, but GitHub `Validate Class browser polish` currently fails because the validator still asserts the superseded browsed-card dossier fallback; current source intentionally requires explicit click/inspection ownership;
- PR #194 is behind current `main`; its only overlap with post-base `main` changes is `docs/DNDNext_Current_Handoff_Prompt.md`, so runtime integration risk is narrow but the branch still needs an exact-head rebase/reconciliation before merge;
- PR #194 exact-head preview: `dndnext-86xs3s1d4-pauls-projects-2016aa54.vercel.app` — **READY** at handoff.

Current focused handoff/status documents:

- `Next_Chat_Handoff_2026-09-21.md` — concise copy-ready next-chat takeover note;
- `Auth_Navigation_Admin_Activity_Status.md` — merged PR #195 and live Supabase hardening;
- `Character_Forge_Subclass_Tarot_Flexible_Ring_Status.md` — active PR #194 flexible-ring architecture and acceptance target.

### Live database update

Live migration ledger count at this reconciliation: **218**.

Latest registered migration:

`20260921185225 admin_site_activity_hardening_v1`.

The PR #195 activity slice also includes:

- `20260921152546 admin_site_activity_v1`;
- `20260921153151 admin_site_activity_acl_fix`;
- `20260921153328 admin_site_activity_retention_v1`.

The previous `20260814161314 grim_hollow_heritage_catalog_support` checkpoint is no longer the latest migration.

### Current work queue override

1. Continue browser acceptance/refinement of PR #194 using its current flexible equal-angle table ring.
2. Test a small subclass catalogue (especially Monster Hunter's four cards) and Wizard's dense catalogue.
3. Preserve one hero position; do not reintroduce fixed visible-card-count rules.
4. If the existing cathedral/table assets still prevent matching the supplied target, replace/rework stage assets while preserving the Tarot card deck.
5. Merge PR #194 only after explicit user approval and exact-head validation.
6. Broader documentation standardization can follow the accepted Tarot checkpoint; reconcile old ledgers rather than deleting historical evidence.

## Historical 2026-08-30 GitHub checkpoint — retained for provenance

Accepted runtime/code baseline on `main`:

`a2aecdd354346926afdf33efb1af320581563b68` — merged Character Forge Background polish/art system (PR #175).

Active work:

- PR #176 — `agent/training-tab-redesign` — historical browser-review continuation; **merged 2026-09-11** as `b7f079fa2e0e69d5c025ea6d03205e9ea26c8d64`.

PR #176 began as the Training redesign and now includes later Forge browser-polish work as well. Immediately before the 2026-08-30 documentation-only Realistic Dice handoff updates, its remote head was:

`9447be566f8383e8227c6fccb37a0bde2bdbe078`

Documentation commits advance that head. Always re-fetch the current PR head before implementation or merge.

Recent accepted Forge sequence:

- PR #170 — merged `599c4de7397ba6e4bbbb0a061d551d80c3570be7`;
- PR #171 — merged `ed93331b946dffee1e63183e969f115d0c8a1a18`;
- PR #172 — merged `8b62e38cc4de490dd4a02b57b0e9448baff3e5ef`;
- PR #173 — merged `8c37e30063d2523a5f488073d3ea60c5571c7182`;
- PR #175 — merged `a2aecdd354346926afdf33efb1af320581563b68`;
- PR #176 — later merged `b7f079fa2e0e69d5c025ea6d03205e9ea26c8d64`.

Do not describe #170–#175 as open. Older ledgers that do so are historical evidence only.

## Historical 2026-08-30 live-database checkpoint

Supabase project: `DnDWeb` / `ucggczovhmauhshvhusx`.

Prior migration-ledger checkpoint: 214 records, latest registered migration `20260814161314 grim_hollow_heritage_catalog_support`.

Some repository SQL has live effects under different migration-ledger names. Treat that as traceability drift, not proof that the live effect is missing. Do not re-run already-correct production SQL by assumption.

PR #177 later merged the reusable Realistic Dice core without a Supabase migration. Tactical dice integration must continue to consume existing encounter RPC/combat-log outcomes rather than create a client-side roll authority.

## Controlling current documents

Read before modifying these areas:

- `DNDNext_Current_Handoff_Prompt.md` — current copy-ready takeover brief and immediate future plan;
- `Realistic_Dice_Roller_Architecture_Roadmap.md` — current implementation boundary plus historical/future expansion roadmap for reusable dice;
- `Character_Forge_Training_Redesign_Status.md` — PR #176 Training design/history subledger;
- `Character_Forge_Background_Audit.md` — accepted Background audit/history after PR #175;
- `Forge_Post170_Species_Artwork_Status.md` — accepted/frozen Species presentation/artwork baseline;
- `Unified_Character_Forge_Status.md` — shared creation/progression/runtime architecture;
- `Player_Forge_Choice_Routing_and_Source_Magic_Status.md` — placement and source-magic authority;
- `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md` — item/equipment/crafting boundaries;
- `Tactical_Encounter_Combat_Roadmap_Blueprint.md` — tactical roadmap, supplemented by current source/live RPC state;
- `CHATGPT_REPO_WRITE_PROCEDURE.md` — coherent GitHub/Supabase write procedure.

## Core modeling rule

- permanent source-owned acquisition → Forge/progression authority;
- proficiency-dependent permanent choice → Training;
- specific Bonus Feat selected from the Species Bonus package → Training;
- spell-centric permanent choice → Spells;
- rest-configurable persistent choice → runtime authority;
- next-rest-expiring choice → rest-cycle runtime state;
- per-use/per-cast choice → action/spell resolver;
- informational/always-on feature → presentation/consumer logic;
- future narrative unlocks → quest/dialogue authority when that subsystem exists;
- **dice physics/animation → presentation authority only, never rules authority.**

Do not use visual similarity as permission to merge different lifecycles or persistence identities.

## Realistic Dice implementation reconciliation

PR #177 merged on 2026-09-11 as `02854698298f357d2dfde21dd292ba7caf73e1c1`.

The current reusable core is source-owned under `components/dice/**` and `utils/dice/**`, with a Forge adapter and focused validators. It uses custom JavaScript physics plus DOM/CSS 3D cube presentation; package.json does not currently include Three.js, React Three Fiber, or Rapier.

The normalized type contract includes:

- d6;
- d8;
- d10;
- d12;
- d20;
- Forge aggregate `resultCube`.

The older preferred Three.js / React Three Fiber / direct Rapier stack remains a **future redesign option**, not current implementation authority. Any migration to that stack must be justified by a concrete need such as true polyhedral meshes or broader cross-site reuse and must preserve the existing authoritative-result boundary.

### Mandatory authority boundary

Mechanical outcomes come from the owning system:

- Forge generated roll object;
- Character Sheet structured roll result;
- tactical Supabase RPC/combat log;
- future server authority where applicable.

The Realistic Dice engine consumes those results and visualizes them. It must not independently reroll them.

### Tactical collision boundary

Rapier dice-body collisions must **not** be reused as the tactical movement/pathfinding authority.

Tactical combat remains discrete axial-hex logic with occupancy, movement cost, reach, range, LOS, cover, and turn/action rules owned by existing encounter code/RPCs.

A future token animation may interpolate along a server-approved path; it must not free-physics its way to a different legal position.

### Current integration sequence

1. Realistic Dice Core + Forge adapter — **merged/live in source**;
2. Character Sheet adapter — future;
3. tactical encounter adapter — future and visualization-only;
4. global overlay/replay host — future, only if multiple consumers justify it.

See `Realistic_Dice_Roller_Architecture_Roadmap.md` for contracts, files, physics design, fallbacks, validation, and acceptance criteria.

## Accepted Species baseline

Species is frozen unless a concrete regression is reproduced. Accepted presentation includes the full-height catalogue, search-driven parent reveal, high-resolution Forge artwork, semantic portrait facts, canonical Size/Languages and Gender/Alignment controls, Darkvision guidance, affinity-aware Dragonborn copy, readable Aasimar/Hexblood structures, compact Goliath/Eladrin selected-detail choices, and source-backed Simic Animal Enhancement descriptions.

`Gift of the Aetherborn` remains present and unchanged. Future acquisition belongs to quest/NPC dialogue progression with Game-Master-defined prerequisites.

## Accepted Background baseline

Background is accepted after merged PR #175. The reusable banner/crest/icon system and compact dossier are now baseline.

Current/remaining Training work may change **where unresolved proficiency/tool choices are resolved**, but should not broadly redesign the Background page again.

Audit for missing/incorrect parsing or choice routing, not subjective power normalization. Any Background rebalance is a separate explicit house-rule decision.

## Training subledger

`Character_Forge_Training_Redesign_Status.md` remains the detailed Training authority/history document for the Training portion of PR #176.

Preserve the current direction:

- player/NPC Training isolation;
- source-owned choices;
- Skills/Feats focused views;
- actual Bonus Feat selection in Training;
- canonical mapped tool↔Trade Skill no-double-spend behavior;
- existing completion/Continue authority.

Do not regress Training when working on Class/Abilities or future dice presentation.

## Protected boundaries

Forge/Realistic Dice work does not authorize world-map, town/city-map, route/travel/weather, tactical action/movement/path execution, crafting/inventory execution, merchants, or unrelated runtime changes. `components/MapPageClient.js` remains outside scope unless Paul explicitly requests world-map work.

World-map and town/city-map behavior remain separate systems.

## Current work queue

1. **Finish browser acceptance of the current PR #176 Forge checkpoint** using the exact current head/preview; do not reconstruct old work from chat history.
2. Keep the current CSS ability dice tray as the temporary prototype until the reusable system is ready.
3. After Paul accepts that Forge checkpoint, create a **dedicated Realistic Dice Core branch/PR** from the accepted commit.
4. Implement Realistic Dice Phase 1 from `Realistic_Dice_Roller_Architecture_Roadmap.md`:
   - normalized roll-resolution contract;
   - d6/d8/d10/d12/d20 + `resultCube` geometry;
   - Three/R3F/direct Rapier physics;
   - die-to-die and tray collisions;
   - predetermined-result face guidance during settling;
   - WebGL/WASM/reduced-motion fallback;
   - Forge adapter only;
   - no Supabase/map/tactical/crafting runtime changes.
5. Browser-tune repeated rolls and run focused physics/Forge/protected-boundary validation.
6. After Phase 1 acceptance, add Character Sheet dice presentation using the existing structured `onRoll` seam.
7. When tactical combat work resumes, add a tactical dice adapter that consumes authoritative encounter RPC/combat-log results; do not change movement/path/LOS authority.
8. Continue remaining Forge slices and broader crafting redesign according to user priority, but keep those projects isolated from the dice core unless explicitly authorized.
9. Repository housekeeping only with evidence; do not mass-close old PRs/issues by age.
10. Quest/NPC dialogue work later, including narrative Aetherborn Gift unlock authority.

A concrete production regression can supersede this queue, but otherwise keep each subsystem change isolated and exact-head validated.
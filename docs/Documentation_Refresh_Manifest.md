# Documentation Refresh Manifest

Updated: 2026-08-30

## Trust order

For current work, trust sources in this order:

1. live Supabase schema, migration ledger, grants, RPC definitions, and relevant data;
2. current GitHub `main`/active PR source, exact remote head, exact-head CI, and Vercel state;
3. `DNDNext_Current_Handoff_Prompt.md` plus the dedicated active subsystem ledger;
4. broader roadmap/history prose;
5. raw exports and old PR ledgers as historical snapshots only.

If prose conflicts with live source/database state, live authority wins until documentation is corrected.

## Current GitHub checkpoint

Accepted runtime/code baseline on `main`:

`a2aecdd354346926afdf33efb1af320581563b68` — merged Character Forge Background polish/art system (PR #175).

Active work:

- PR #176 — `agent/training-tab-redesign` — **Character Forge browser-review continuation**, open/unmerged.

PR #176 began as the Training redesign and now includes later Forge browser-polish work as well. Immediately before the 2026-08-30 documentation-only Realistic Dice handoff updates, its remote head was:

`9447be566f8383e8227c6fccb37a0bde2bdbe078`

Documentation commits advance that head. Always re-fetch the current PR head before implementation or merge.

Recent accepted Forge sequence:

- PR #170 — merged `599c4de7397ba6e4bbbb0a061d551d80c3570be7`;
- PR #171 — merged `ed93331b946dffee1e63183e969f115d0c8a1a18`;
- PR #172 — merged `8b62e38cc4de490dd4a02b57b0e9448baff3e5ef`;
- PR #173 — merged `8c37e30063d2523a5f488073d3ea60c5571c7182`;
- PR #175 — merged `a2aecdd354346926afdf33efb1af320581563b68`;
- PR #176 — active/unmerged.

Do not describe #170–#175 as open. Older ledgers that do so are historical evidence only.

## Live database checkpoint

Supabase project: `DnDWeb` / `ucggczovhmauhshvhusx`.

Prior migration-ledger checkpoint: 214 records, latest registered migration `20260814161314 grim_hollow_heritage_catalog_support`.

Some repository SQL has live effects under different migration-ledger names. Treat that as traceability drift, not proof that the live effect is missing. Do not re-run already-correct production SQL by assumption.

The planned Realistic Dice Phase 1 is presentation infrastructure and should require **no Supabase migration**. Later tactical dice integration must consume existing encounter RPC/combat-log outcomes rather than create a client-side roll authority.

## Controlling current documents

Read before modifying these areas:

- `DNDNext_Current_Handoff_Prompt.md` — current copy-ready takeover brief and immediate future plan;
- `Realistic_Dice_Roller_Architecture_Roadmap.md` — **controlling future architecture/implementation plan for the reusable dice subsystem**;
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

## Realistic Dice architecture decision

The current Character Forge Abilities tab has a CSS-based result-die/tray prototype. It should remain temporary until the reusable Realistic Dice subsystem is implemented on its own bounded branch/PR after the current Forge checkpoint is accepted.

The future core must support:

- d6;
- d8;
- d10;
- d12;
- d20;
- Forge aggregate `resultCube`.

Preferred initial stack, subject to a fresh compatibility check when implementation begins:

- Three.js;
- React Three Fiber;
- direct Rapier (`@dimforge/rapier3d-compat`).

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

### Planned integration sequence

1. Realistic Dice Core + Forge adapter;
2. Character Sheet adapter;
3. tactical encounter adapter when combat work resumes;
4. global overlay/replay host only if multiple consumers prove it useful.

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
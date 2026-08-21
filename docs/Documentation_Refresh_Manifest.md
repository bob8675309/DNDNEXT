# Documentation Refresh Manifest

Updated: 2026-08-20

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

- PR #176 — `agent/training-tab-redesign` — **Character Forge Training redesign**, unmerged.

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

For the active Training pass, the key live content authority is `character_option_catalog` plus preferred/configured views, especially Background `metadata` and imported `raw_payload` for skills/tools/languages/feats.

## Controlling current documents

Read before modifying these areas:

- `DNDNext_Current_Handoff_Prompt.md` — current copy-ready takeover brief;
- `Character_Forge_Training_Redesign_Status.md` — **active PR #176 checklist and design contract**;
- `Character_Forge_Background_Audit.md` — accepted Background audit/history after PR #175;
- `Forge_Post170_Species_Artwork_Status.md` — accepted/frozen Species presentation/artwork baseline;
- `Unified_Character_Forge_Status.md` — shared creation/progression/runtime architecture;
- `Player_Forge_Choice_Routing_and_Source_Magic_Status.md` — placement and source-magic authority;
- `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md` — item/equipment/crafting boundaries;
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
- future narrative unlocks → quest/dialogue authority when that subsystem exists.

Do not use visual similarity as permission to merge different lifecycles or persistence identities.

## Accepted Species baseline

Species is frozen unless a concrete regression is reproduced. Accepted presentation includes the full-height catalogue, search-driven parent reveal, high-resolution Forge artwork, semantic portrait facts, canonical Size/Languages and Gender/Alignment controls, Darkvision guidance, affinity-aware Dragonborn copy, readable Aasimar/Hexblood structures, compact Goliath/Eladrin selected-detail choices, and source-backed Simic Animal Enhancement descriptions.

`Gift of the Aetherborn` remains present and unchanged. Future acquisition belongs to quest/NPC dialogue progression with Game-Master-defined prerequisites.

## Accepted Background baseline

Background is accepted after merged PR #175. The reusable banner/crest/icon system and compact dossier are now baseline.

Current Training work may change **where unresolved proficiency/tool choices are resolved**, but should not broadly redesign the Background page again.

Live source spot checks on 2026-08-20 confirm:

- Athlete (MOT) really grants a language choice plus Vehicles (land);
- Mist Wanderer (RHW) really grants one artisan-tool choice;
- Clan Crafter (SCAG) really grants one artisan-tool proficiency plus its language rule;
- Rune Carver (BGG) really grants one artisan-tool proficiency plus Giant.

Therefore audit for missing/incorrect parsing or choice routing, not subjective power normalization. Any Background rebalance is a separate explicit house-rule decision.

## Active Training contract

See `Character_Forge_Training_Redesign_Status.md` for the complete checklist. Current locked direction:

- all decision controls stay on the left;
- right side is `Current Selection` context only;
- replace four confusing independent top counters with one resolved/required tally and clickable provenance breakdown;
- actual Bonus Feat selection occurs in Training;
- mapped crafting-tool proficiency and campaign Craft/Trade Skill should be the same player-facing proficiency so the player does not buy both;
- Background tool/craft choices should be acknowledged on Background and resolved in Training;
- Trade/Craft Skills should be compact like Class Skills;
- replace giant native feat dropdown with a catalogue/list-detail chooser inspired by Profile `Feats & Boons`;
- preserve source-owned nested choices and existing persistence authority.

## Protected boundaries

Forge work does not authorize world-map, town/city-map, route/travel/weather, tactical action execution, crafting/inventory execution, merchants, or unrelated runtime changes. `components/MapPageClient.js` remains outside scope unless Paul explicitly requests world-map work.

## Current work queue

1. **Finish PR #176 Training redesign** using `Character_Forge_Training_Redesign_Status.md`:
   - Background proficiency/tool choices → Training;
   - unified Skill & Training tally + provenance;
   - canonical tool↔craft mapping / no double-spend;
   - catalogue-style feat chooser;
   - all-75 Background source audit for omissions/routing errors;
   - exact-head regression + Vercel + browser acceptance.
2. Continue remaining Forge slices: Spells → Equipment → Identity → Story → Review, revisiting earlier tabs only for reproduced dependencies/defects.
3. After Forge completion, circle back to the broader crafting redesign: unified material list with craft-specific effects and possible expansion of individual tools into granular craft skills/recipe systems.
4. Repository housekeeping only with evidence; do not mass-close old PRs/issues by age.
5. Quest/NPC dialogue work later, including narrative Aetherborn Gift unlock authority.

A concrete production regression can supersede this queue, but otherwise keep each subsystem change isolated and exact-head validated.
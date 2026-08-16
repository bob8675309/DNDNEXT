# DNDNext Living Documentation Index

This directory contains the project's living handoff, roadmap, architecture, and evidence documents. For active work, live Supabase + current repository source/validators outrank prose if they conflict.

## Start here

- `DNDNext_Current_Handoff_Prompt.md` — **copy-ready next-chat brief**: current PR/Supabase checkpoint, site architecture, Character Forge/Species data flow, protected boundaries, validators, and publishing procedure.
- `Forge_Post170_Species_Artwork_Status.md` — **active Species artwork continuation authority after the PR #170 merge**: PR #171, completed Genasi/Dragonborn/Aven/Elf/Gnome artwork, exact validation checkpoint, binary-write procedure, remaining queue, and protected boundaries.
- `Forge_Species_Art_and_Collapse_Handoff.md` — **historical PR #170 Species-art handoff; superseded**. It now points to the post-#170 ledger and must not be treated as current status.
- `CHATGPT_REPO_WRITE_PROCEDURE.md` — **connector write authority and safe procedure**: GitHub/Supabase are directly writable from ChatGPT; use `create_blob → create_tree → create_commit → race-check → update_ref(force=false)` for coherent repo changes.
- `Documentation_Refresh_Manifest.md` — broader documentation precedence/history; newer focused ledgers supersede stale PR #170 status text.
- `PR170_Final_Acceptance_Status.md` — historical migration/build/database/authenticated acceptance evidence for the long-lived #170 work.
- `PR170_Browser_Smoke_Corrections_Status.md` — historical signed-in browser findings and corrections from the #170 cycle.
- `Forge_Species_Family_Submenu_Status.md` — controlling Species family/setting-variant rules/persistence ledger through migrations 91-93, including Genasi, Dragonborn, Aven, Elf, Gnome, Shifter, Fairy, Kithkin, and grouped setting variants.
- `Forge_Source_Presentation_and_Species_Variants_Status.md` — earlier source-presentation history, structured Species/Background/Class rendering, and the migration-91 Genasi source-catalog foundation.
- `Current_Development_Status_and_Roadmap.md` — broad platform roadmap/history; newer subsystem ledgers supersede older sections.
- `Unified_Character_Forge_Status.md` — controlling Forge/progression/runtime ledger.

## Active Character Forge / progression / runtime documents

- `Character_Progression_Foundation.md` — normalized creation/progression architecture.
- `Character_Progression_and_Higher_Level_Forge.md` — direct higher-level creation vs earned progression.
- `Character_Forge_PR_A_Deployment_Evidence.md` — migration/build/rollback evidence.
- `Player_Forge_Choice_Routing_and_Source_Magic_Status.md` — current player-facing choice placement plus migrations 86-88 source-magic authority.
- `Pending_Rest_Runtime_Choices_Status.md` — migration 89 post-rest attention vs persistent optional-replacement classification.
- `Progression_RPC_ACL_Cleanup_Status.md` — migration 85 bounded v2 compatibility getter ACL hardening.
- `Wizard_Spell_Mastery_Runtime_Status.md` — Spell Mastery runtime.
- `Wizard_Memorize_Spell_Runtime_Status.md` — Short-Rest prepared-spell replacement.
- `Wizard_Cantrip_Formulas_Runtime_Status.md` — PHB Wizard TCE Cantrip Formulas Long-Rest replacement.
- `Armorer_Armor_Model_Runtime_Status.md` — EFA/TCE Armorer model authority and migration-78 cadence repair.
- `Bestial_Soul_Runtime_Status.md` — PHB/TCE Beast Bestial Soul rest-created, next-rest-expiring adaptation authority through migrations 79-80.
- `Wild_Heart_Aspect_Runtime_Status.md` — XPHB Wild Heart Aspect of the Wilds immediate choice plus Long-Rest replacement authority through migration 81.
- `Hunters_Prey_Runtime_Status.md` — PHB permanent vs XPHB Short/Long-Rest Hunter's Prey authority through migration 82.
- `Defensive_Tactics_Runtime_Status.md` — PHB permanent vs XPHB Short/Long-Rest Defensive Tactics authority through migration 83.
- `Whispers_of_the_Dead_Runtime_Status.md` — TCE Phantom persistent borrowed proficiency authority through migration 84.
- `Player_Forge_Starting_Magic_v3_Status.md` — starting-magic authority.
- `Player_Forge_Starting_Equipment_Status.md` — starting equipment, wealth, currency.
- `Astral_Trance_Runtime_Status.md` — Astral Trance runtime.
- `Species_Rest_Proficiency_Runtime_Status.md` — Astral Knowledge / Skill Versatility.
- `Species_Replaceable_Cantrip_Runtime_Status.md` — replaceable Species cantrips.
- `Eladrin_Runtime_Status.md` — Eladrin initial season, post-Long-Rest replacement, Trance runtime, and current descriptive-season presentation.
- `Primal_Companion_Runtime_Status.md` — Beast Master companion runtime.
- `Dread_Allegiance_Runtime_Status.md` — linked allegiance/resistance/cantrip runtime.
- `Fiendish_Resilience_Runtime_Status.md` — Short/Long-Rest resistance runtime.
- `Circle_of_the_Land_Runtime_Status.md` — Circle Spell package runtime.
- `Artificer_Magic_Item_Plans_Status.md` — EFA learned-plan authority and canonical wildcard item pools.
- `Boon_Energy_Resistance_Runtime_Status.md` — Boon runtime resistance choices.
- `Feat_Runtime_Expertise_Status.md` — Echoing Soul / Zhentarim Expertise lifecycle.
- `Cartomancer_Runtime_Status.md` — Hidden Ace temporary access.

Current cadence rule: persistent source-owned decisions belong to Forge/progression; rest decisions belong to runtime; per-use choices belong to action UI. Do not turn runtime choices into permanent Forge locks. A post-rest replacement opportunity is not automatically a missing choice: migration 89 distinguishes an inactive rest-cycle benefit from a still-active persistent selection. Migration 90 adds source-aware standalone Rest restoration for the sheet-side Rage action state without altering tactical combat state. Migrations 91-93 are catalogue/source-presentation work: Genasi subrace restoration, Genasi source-detail restoration, and Aven subrace restoration. They do not authorize unrelated runtime changes.

## Character sheet / inventory / crafting

- `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md` — canonical item/inventory/equip/sheet/tactical authority.
- `Character_Sheet_Formula_Reference.md` — ability/save/skill/AC/initiative/passive formulas.
- `NPC_Character_Sheet_Selection_Reconciliation.md` — selection/stale-response ownership.
- `NPC_Profile_Inventory_Equipment_Reference.md` — profile/inventory/equipment presentation.
- `Town_Crafter_Current_Status.md` — town crafter/profile state.
- `Source_Patch_Pipeline_Audit.md` — source-bake / validator pipeline.
- `Deferred_UI_Polish_Backlog.md` — deferred UI work.

## Tactical encounter / sprites / security

Use the specific tactical phase ledger before changing encounter behavior; do not recreate existing tactical primitives.

- `Tactical_Encounter_Combat_Roadmap_Blueprint.md` and phase ledgers — combat roadmap/status.
- `Dawn_High_Quality_Prototype_Plan.md`, `Sprite_Production_Work_Map.md`, `Sprite_Production_Art_Bible.md`, `Sprite_Production_Run_Log.md` — sprite work.
- `Security_Hardening_Roadmap_Status.md` — security/database hardening.

Always inspect live grants/functions before modifying authenticated `SECURITY DEFINER` surfaces. Supabase advisor warnings outside the current audited slice are separate security backlog, not permission to scope-creep a Forge/runtime patch.

## Current exact Forge artwork checkpoint

### Main / historical PR #170

PR #170 is **merged**, not open. GitHub merge commit:

`599c4de7397ba6e4bbbb0a061d551d80c3570be7`

The merge occurred through an accidental connector invocation while branch-integration tooling was being searched for. No automatic revert was attempted because a blind revert could remove a large body of valid previously tested work.

### Active continuation / PR #171

Branch:

`agent/species-art-post170`

PR #171 is **OPEN / UNMERGED** and must not be merged without explicit user approval.

Latest validated code checkpoint:

`39a263e034db4023ed7d1a4950a185a832c08867` — `Polish Eladrin season selection`

For that exact head:

- all 14 triggered GitHub workflows completed successfully;
- `Validate Forge source presentation`, `Validate NPC Forge foundation`, `Validate Character Forge nested choices`, `Validate Eladrin runtime`, and the related progression/equipment/runtime gates passed;
- workflow production builds passed;
- Vercel deployment succeeded;
- the preceding-head compare is exactly one fast-forward commit with six scoped files and no protected-system file.

The earlier artwork-only checkpoint remains `f8f31534c157c9778f873e726551ac20cfdfd823`. Later Species layout/presentation commits preserve the same artwork and persistence boundaries while improving the shared Player/NPC Forge UI.

### Complete dedicated Genasi family

- `public/media/species/air-genasi.webp`
- `public/media/species/earth-genasi.webp`
- `public/media/species/fire-genasi.webp`
- `public/media/species/water-genasi.webp`

### Complete Dragonborn child artwork — all 15

Chromatic:

- `public/media/species/black-dragonborn.webp`
- `public/media/species/blue-dragonborn.webp`
- `public/media/species/green-dragonborn.webp`
- `public/media/species/red-dragonborn.webp`
- `public/media/species/white-dragonborn.webp`

Metallic:

- `public/media/species/brass-dragonborn.webp`
- `public/media/species/bronze-dragonborn.webp`
- `public/media/species/copper-dragonborn.webp`
- `public/media/species/gold-dragonborn.webp`
- `public/media/species/silver-dragonborn.webp`

Gem:

- `public/media/species/amethyst-gem-dragonborn.webp`
- `public/media/species/crystal-gem-dragonborn.webp`
- `public/media/species/emerald-gem-dragonborn.webp`
- `public/media/species/sapphire-gem-dragonborn.webp`
- `public/media/species/topaz-gem-dragonborn.webp`

### Complete Aven child artwork on PR #171

- `public/media/species/hawk-headed-aven.webp`
- `public/media/species/ibis-headed-aven.webp`

Canonical non-Forge Aven still resolves through `aven.webp`; canonical non-Forge Dragonborn children still resolve through the appropriate shared Chromatic/Metallic/Gem family art. Dedicated child files are Forge presentation only.

### Complete Elf / Gnome lineage artwork on PR #171

- `public/media/species/drow.webp`
- `public/media/species/high-elf.webp`
- `public/media/species/wood-elf.webp`
- `public/media/species/forest-gnome.webp`
- `public/media/species/rock-gnome.webp`

All five are validated 1536 × 2048 WebP portraits. Canonical non-Forge Elf/Gnome children still resolve through `elf.webp` / `gnome.webp`; only the Forge uses these dedicated lineage files.

### Complete Shifter form artwork on PR #171

- `public/media/species/beasthide-shifter.webp`
- `public/media/species/longtooth-shifter.webp`
- `public/media/species/swiftstride-shifter.webp`
- `public/media/species/wildhunt-shifter.webp`

All four are validated 1536 × 2048 WebP portraits. Canonical non-Forge Shifter forms still resolve through `shifter.webp`; only the Forge uses these dedicated files. The source-owned form choice remains on the existing parent `shifting` field.

### Complete Fairy / Kithkin lineage artwork on PR #171

- `public/media/species/lorwyn-fairy.webp`
- `public/media/species/shadowmoor-fairy.webp`
- `public/media/species/lorwyn-kithkin.webp`
- `public/media/species/shadowmoor-kithkin.webp`

All four are validated 1536 × 2048 WebP portraits. Canonical non-Forge Fairy/Kithkin children still resolve through `fairy.webp` / `kithkin.webp`; only the Forge uses these dedicated lineage files. The source-owned choices remain on the existing `faerie-lineage` and `kithkin-lineage` fields, with 120-foot Darkvision projected only for Shadowmoor.

The active continuation ledger is `Forge_Post170_Species_Artwork_Status.md`.

### Complete setting/source-alias artwork on PR #171

- `public/media/species/dwarf-kaladesh.webp`
- `public/media/species/goblin-dankwood.webp`
- `public/media/species/orc-ixalan.webp`

All three are validated 1536 × 2048 WebP portraits. Canonical non-Forge setting aliases remain on `dwarf.webp`, `goblin.webp`, and `orc.webp`; only the Forge uses the dedicated files. The existing catalogue-source grouping remains authoritative, with no new persistence state.

## Planned post-#170 dedicated-art queue — COMPLETE

- Dwarf (Kaladesh)
- Goblin (Dankwood)
- Orc (Ixalan)

Retain existing dedicated Human setting art, Elf Kaladesh/Zendikar art, and Amonkhet Minotaur art unless there is a specific reason to replace them.

## Live database authority

Migration 93 remains current for this Species artwork phase:

`20260812042950 aven_subrace_catalog`

Latest verified production counts:

- raw Species: 166
- preferred Species: 102
- characters: 7
- character_sheets: 7
- character_spells: 30
- character_progression: 7
- inventory_items: 18
- locations: 20
- map_routes: 4
- map_route_points: 9

No SQL write or migration was made for the Gem/Aven/Elf/Gnome/Shifter/Fairy/Kithkin/setting-variant artwork continuation.

## Protected-boundary rule

Character Forge/progression/runtime work does not authorize changes to world-map, town/city-map behavior, route/travel/weather simulation, tactical encounter behavior, crafting, inventory, merchants, or unrelated runtime systems. `components/MapPageClient.js` remains outside current scope unless explicitly requested.

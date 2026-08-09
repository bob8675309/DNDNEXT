# DNDNext Living Documentation Index

Live Supabase + current repository source/validators outrank prose if they conflict.

## Start here

- `DNDNext_Current_Handoff_Prompt.md` — current continuation prompt and protected boundaries.
- `Documentation_Refresh_Manifest.md` — current PR #170 checkpoint and documentation precedence.
- `Unified_Character_Forge_Status.md` — Forge/progression/runtime architecture ledger.
- `Current_Development_Status_and_Roadmap.md` — broad roadmap/history; dedicated ledgers supersede older sections.

## Recent Character Forge / runtime ledgers

- `Wizard_Memorize_Spell_Runtime_Status.md`
- `Wizard_Cantrip_Formulas_Runtime_Status.md`
- `Armorer_Armor_Model_Runtime_Status.md`
- `Bestial_Soul_Runtime_Status.md`
- `Wild_Heart_Aspect_Runtime_Status.md`
- `Boon_Energy_Resistance_Runtime_Status.md`
- `Feat_Runtime_Expertise_Status.md`
- `Cartomancer_Runtime_Status.md`
- `Astral_Trance_Runtime_Status.md`
- `Species_Rest_Proficiency_Runtime_Status.md`
- `Species_Replaceable_Cantrip_Runtime_Status.md`
- `Primal_Companion_Runtime_Status.md`
- `Dread_Allegiance_Runtime_Status.md`
- `Fiendish_Resilience_Runtime_Status.md`
- `Circle_of_the_Land_Runtime_Status.md`
- `Artificer_Magic_Item_Plans_Status.md`

Current rule: persistent acquisition choices belong to Forge/progression; rest choices belong to runtime; per-use choices belong to action UI. Do not freeze rest/runtime decisions into Character Forge.

## Protected boundary

Character Forge/progression/runtime work does not authorize changes to world-map, town/city-map behavior, route/travel/weather simulation, tactical encounter execution, or unrelated crafting systems. `components/MapPageClient.js` remains outside current scope unless explicitly requested.

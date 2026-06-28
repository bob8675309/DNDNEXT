# Town Crafter / Character Panel Current Status

Last updated after green deployment: `f027033e7f908c22e19bbad3e1a7350efe7c91f7`.

## Green active state

- `/items` extraction remains active and green through `scripts/extract_crafting_workspace_phase1.mjs`.
- `components/CraftingWorkspace.js` is produced during the build from the real `/items` workflow.
- Discipline-lock support remains active and green through `scripts/patch_crafting_workspace_lock_v1.mjs`.
- The shared profession resolver remains active and validated:
  - `utils/craftProfession.js`
  - `scripts/validate_craft_profession.mjs`
- `NpcPanel` craft integration is still not exposed.
- `NpcPanel` surface validation remains active and green:
  - `scripts/validate_npc_panel_craft_surface.mjs`
- `NpcPanel` accepts wrapper-owned props during the build:
  - `scripts/patch_npc_panel_wrapper_props_v1.mjs`
  - `scripts/validate_npc_panel_wrapper_props.mjs`
- `NpcPanel` now uses the wrapper-hosted tab renderer for non-crafter views while preserving the hardcoded fallback tabs for crafter-capable characters:
  - `scripts/patch_npc_panel_wrapper_tabs_v1.mjs`
  - `scripts/validate_npc_panel_wrapper_tabs.mjs`
- The Craft tab is still guarded off because crafter-capable characters keep the existing fallback tabs until the Craft body branch is ready.
- The non-user-facing wrapper remains active and green:
  - `components/character/CharacterInteractionPanel.js`
  - `scripts/validate_character_interaction_panel.mjs`
- NPC page profile panel caller is routed through the wrapper during the build, with both pre-patch and post-patch validations active:
  - `scripts/validate_npc_page_panel_surface.mjs`
  - `scripts/patch_npc_page_panel_wrapper_import_v1.mjs`
  - `scripts/validate_npc_page_panel_wrapper_adoption.mjs`
- The wrapper delegates to `NpcPanel`, normalizes the future shared view names, resolves craft capability through `utils/craftProfession.js`, owns safe wrapper-level interaction view state, provides an inert wrapper-hosted Craft shell renderer, builds a validated interaction tab model, provides a wrapper-hosted tab renderer, and includes an inactive wrapper-owned panel shell branch.
- The default wrapper path still returns `NpcPanel`; the wrapper shell branch only runs if `useCharacterInteractionShell` is explicitly passed.
- The wrapper does not import `CraftingWorkspace` yet.

## Active runner order

```text
scripts/generate_npc_portrait_pack.mjs
scripts/patch_town_merchant_storefront.mjs
scripts/patch_town_merchant_portraits_v1.mjs
scripts/patch_merchant_market_ui.mjs
scripts/patch_merchant_market_polish.mjs
scripts/patch_crafter_shop_presentation.mjs
scripts/patch_town_profile_crafter_ui_v1.mjs
scripts/patch_town_crafter_native_polish_v1.mjs
scripts/validate_craft_profession.mjs
scripts/extract_crafting_workspace_phase1.mjs
scripts/patch_crafting_workspace_lock_v1.mjs
scripts/validate_npc_panel_craft_surface.mjs
scripts/patch_npc_panel_wrapper_props_v1.mjs
scripts/validate_npc_panel_wrapper_props.mjs
scripts/patch_npc_panel_wrapper_tabs_v1.mjs
scripts/validate_npc_panel_wrapper_tabs.mjs
scripts/validate_character_interaction_panel.mjs
scripts/validate_npc_page_panel_surface.mjs
scripts/patch_npc_page_panel_wrapper_import_v1.mjs
scripts/validate_npc_page_panel_wrapper_adoption.mjs
scripts/patch_enchanting_bounds_v1.mjs
npx next build
```

## Current risk boundary

The failed area is still direct `NpcPanel` Craft-tab body wiring. Previous broad transforms failed Vercel, so they must remain inactive:

- `scripts/patch_npc_panel_craft_tab_v1.mjs`
- `scripts/patch_npc_panel_craft_capability_v1.mjs`

Do not reactivate those transforms as-is.

## Notes from this step

An initial wrapper-tab patch failed because the patch script used template literals containing JSX `${...}` expressions. That has been corrected by changing the patch script to single-quoted line arrays, and Vercel is green again.

## Next safest step

Continue the wrapper path:

1. Keep crafter-capable characters on fallback tabs until a Craft body branch exists.
2. Add a guarded Craft placeholder body branch using `renderCraftView`, with no `CraftingWorkspace` import.
3. Only after the placeholder body is green should crafter-capable characters be allowed to render the wrapper tabs with Craft visible.
4. Validate and build after each step.
5. Only after wrapper Craft placeholder behavior is stable should Craft render `CraftingWorkspace mode="panel" disciplineLock={profession}`.

## Still unchanged

- No iframe.
- No world-map behavior changes.
- No town movement, route, camp, or label changes.
- No crafting formula/DC/material/rule changes.
- No merchant stock changes.
- Legacy town `CrafterWorkshopModal` remains active until the replacement path is fully green.

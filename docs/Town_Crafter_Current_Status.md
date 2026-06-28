# Town Crafter / Character Panel Current Status

Last updated after green deployment: `d4e3134dada4edae0152713b978f14472f559776`.

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
- The non-user-facing wrapper remains active and green:
  - `components/character/CharacterInteractionPanel.js`
  - `scripts/validate_character_interaction_panel.mjs`
- NPC page profile panel caller is now routed through the wrapper during the build, with both pre-patch and post-patch validations active:
  - `scripts/validate_npc_page_panel_surface.mjs`
  - `scripts/patch_npc_page_panel_wrapper_import_v1.mjs`
  - `scripts/validate_npc_page_panel_wrapper_adoption.mjs`
- The wrapper still delegates to `NpcPanel` by default, so the NPC page profile overlay should remain visually unchanged.
- The wrapper delegates to `NpcPanel`, normalizes the future shared view names, resolves craft capability through `utils/craftProfession.js`, owns safe wrapper-level interaction view state, provides an inert wrapper-hosted Craft shell renderer, builds a validated interaction tab model, provides a wrapper-hosted tab renderer, and includes an inactive wrapper-owned panel shell branch.
- The default path still returns `NpcPanel`; the wrapper shell branch only runs if `useCharacterInteractionShell` is explicitly passed.
- The wrapper passes `craftProfession`, `hasCraftCapability`, `interactionView`, `interactionTabs`, `setInteractionView`, `renderInteractionTabs`, and `renderCraftView` forward for later use, but the visible panel still does not expose Craft.
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
scripts/validate_character_interaction_panel.mjs
scripts/validate_npc_page_panel_surface.mjs
scripts/patch_npc_page_panel_wrapper_import_v1.mjs
scripts/validate_npc_page_panel_wrapper_adoption.mjs
scripts/patch_enchanting_bounds_v1.mjs
npx next build
```

## Current risk boundary

The failed area is still direct `NpcPanel` Craft-tab wiring. Previous broad transforms failed Vercel, so they must remain inactive:

- `scripts/patch_npc_panel_craft_tab_v1.mjs`
- `scripts/patch_npc_panel_craft_capability_v1.mjs`

Do not reactivate those transforms as-is.

## Next safest step

Continue the wrapper path:

1. Keep `NpcPanel` unchanged.
2. Confirm the NPC page overlay behaves unchanged after wrapper adoption.
3. Move the next single caller only with the same pre-patch / narrow patch / post-patch validation pattern.
4. Validate and build after each step.
5. Only after wrapper adoption is stable should visible tabs be moved to the wrapper.
6. Only after that should the Craft tab render `CraftingWorkspace mode="panel" disciplineLock={profession}`.

## Still unchanged

- No iframe.
- No world-map behavior changes.
- No town movement, route, camp, or label changes.
- No crafting formula/DC/material/rule changes.
- No merchant stock changes.
- Legacy town `CrafterWorkshopModal` remains active until the replacement path is fully green.

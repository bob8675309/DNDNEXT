# Town Crafter / Character Panel Current Status

Last updated after green deployment: `99e4ea0befdd38928307756319a2f8763d4be6ae`.

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
- The wrapper delegates to `NpcPanel`, normalizes the future shared view names, and now resolves craft capability through `utils/craftProfession.js`.
- The wrapper passes `craftProfession` and `hasCraftCapability` forward for later use, but the visible panel still does not expose Craft.
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
2. Expand `CharacterInteractionPanel` in very small source-baked steps.
3. Add wrapper view state separately from `NpcPanel`.
4. Validate and build after each step.
5. Only after the wrapper is green should town/NPC callers be moved to the wrapper.
6. Only after that should the Craft tab render `CraftingWorkspace mode="panel" disciplineLock={profession}`.

## Still unchanged

- No iframe.
- No world-map behavior changes.
- No town movement, route, camp, or label changes.
- No crafting formula/DC/material/rule changes.
- No merchant stock changes.
- Legacy town `CrafterWorkshopModal` remains active until the replacement path is fully green.

# Town Handoff Bake Next Steps

Current green baseline before this note: `28ac3a302240f9d9d86c642a064ab38d4ff496ec`.

## Source-owned already

- `components/LocationSideBar.js` owns the town sidebar profile-button slice.
- `styles/npc-profile-panel.css` owns the town profile link, crafter storefront, and side-panel CSS.
- `scripts/patch_town_profile_crafter_ui_v1.mjs` no longer mutates those two areas, but still validates them.

## Active protection now in runner

- `scripts/diagnose_town_profile_patch_targets.mjs` runs before the first town profile/crafter patch.
- `scripts/validate_map_profile_offcanvas_handoff.mjs` runs after the first town profile/crafter patch and protects the map profile offcanvas handoff.
- `scripts/diagnose_town_shared_craft_patch_targets.mjs` runs before the shared Craft handoff patch.

## Important runner-order constraint

The town route has two staged states:

1. Intermediate state after `patch_town_profile_crafter_ui_v1.mjs`: the town route side panel still renders `NpcPanel` and passes `initialView`.
2. Final shared Craft state after `patch_town_crafter_shared_craft_panel_v1.mjs`: the town route side panel renders `CharacterInteractionPanel` and normalizes crafter profession data.

Do not source-bake the final town route state before moving or adjusting the intermediate validator, because `validate_town_profile_parent_panel.mjs` currently validates the intermediate `NpcPanel` boundary.

## Next safe runtime bake order

1. Bake only the `MapPageClient.js` offcanvas/profile-panel handoff hunks.
2. Bake `pages/town/[id].js` to the intermediate parent-profile state, not the final shared Craft state.
3. Bake the `TownSheet.js` parent callback and in-town profile/shop dispatch pieces.
4. Then bake the shared Craft patch output and remove or convert the shared Craft patch script.

## Guardrails

- Do not touch world movement, route advancement, camps, weather, or travel windows.
- Do not touch crafting formulas, DCs, inventory consumption, merchant stock, or DB behavior.
- Keep source-bakes narrow, one large file at a time, and validator-backed.

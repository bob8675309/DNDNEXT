# Town Route Profile Parent Bake Checklist

Purpose: keep the `pages/town/[id].js` source-bake boundary clear before removing or narrowing the remaining town profile patch.

## Required intermediate state

This is the state expected after `patch_town_profile_crafter_ui_v1.mjs` and before `patch_town_crafter_shared_craft_panel_v1.mjs`.

The town route should have:

- `dynamic` imported from `next/dynamic`.
- A dynamic `NpcPanel` import.
- `activeTownProfileCharacter` state.
- `activeTownProfileView` state.
- `handleOpenTownProfile(character, initialView = "profile")`.
- Roster and merchant selects including portrait URL/storage fields.
- `TownSheet` receiving `onOpenCharacterProfile={handleOpenTownProfile}`.
- A parent-owned side panel using `town-profile-sidepanel-backdrop` and `town-profile-sidepanel`.
- The intermediate side panel rendering `NpcPanel` with `initialView={activeTownProfileView}`.

## Must not be present yet in this intermediate state

- Direct `CharacterInteractionPanel` import in the town route.
- A `<CharacterInteractionPanel>` render in the town route.
- Any iframe path.
- Router pushes/replaces to `/npcs` for town profile/shop access.

## Why this boundary matters

The current Vercel runner validates this intermediate `NpcPanel` state before the later shared-Craft patch converts the side panel to `CharacterInteractionPanel`. Baking the final shared-Craft state too early would break the current runner order unless the intermediate validator is moved, adjusted, or retired at the same time.

## Safe next action

Bake one large file at a time only after the matching validator is protecting the exact boundary. The preferred order remains:

1. `MapPageClient.js` offcanvas/profile handoff.
2. `pages/town/[id].js` intermediate parent profile state.
3. `components/TownSheet.js` profile/shop callback dispatch.
4. Final shared-Craft handoff.

Do not touch world movement, route advancement, travel windows, camps, weather, crafting rules, merchant stock, inventory consumption, or DB behavior while doing this cleanup.

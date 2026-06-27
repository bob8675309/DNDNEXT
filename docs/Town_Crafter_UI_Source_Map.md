# Town Crafter UI Source Map

## Goal

Create a town crafter presentation that looks and feels like the merchant storefront/profile panel, but preserves the real crafting workflow and rules.

The desired behavior is:

- Town crafters use a portrait/shopfront presentation.
- The crafting workflow is the same as the main `/items` workflow.
- The selected crafter locks the discipline: alchemist -> Alchemy, smith -> Smithing, enchanter -> Enchanting.
- Opening a town crafter starts at the appropriate known/available recipe list, not an arbitrary first recipe.
- The preview card gets its own right-side column.
- No iframe/nested full page.
- No world-map logic changes.

## What went wrong

Two attempted approaches are not acceptable long-term:

1. Native town modal only
   - Fast and stable.
   - Uses `CrafterWorkshopModal` inside `components/TownSheet.js`.
   - But it is a separate lightweight workflow and does not match the full `/items` crafting UI.

2. `/items` iframe inside town modal
   - Restores the real workflow visually.
   - But it loads a full second page, creating slow/hanging behavior and nested layout issues.

The correct solution is a source-level component extraction/reuse path: the full crafting workflow must become a reusable component that can render inside both `/items` and the town crafter panel.

## Current active runtime path

The Vercel runner currently applies these transforms before `next build`:

```text
scripts/generate_npc_portrait_pack.mjs
scripts/patch_town_merchant_storefront.mjs
scripts/patch_town_merchant_portraits_v1.mjs
scripts/patch_merchant_market_ui.mjs
scripts/patch_merchant_market_polish.mjs
scripts/patch_crafter_shop_presentation.mjs
scripts/patch_town_profile_crafter_ui_v1.mjs
scripts/patch_town_crafter_native_polish_v1.mjs
scripts/patch_enchanting_bounds_v1.mjs
npx next build
```

The iframe/full-page town crafter transforms are intentionally not active in the runner.

## Important source files

### `components/TownSheet.js`

Owns the town page presentation, drawers, merchant/crafter lists, and current `CrafterWorkshopModal`.

Current town crafter modal flow:

- `CrafterWorkshopModal({ crafter, inventoryItems, playerPlants, onClose, onCraftWorkshop })`
- Infers crafter type through `inferCrafterTypes(crafter)`.
- Builds available services through `buildWorkshopServices(crafterTypes)`.
- Current service options include:
  - Smith: `forge_mundane`, `reforge`
  - Alchemy: `brew`
  - Enchanting: `imbue`

Problem: this modal has its own workflow/state and should not remain the authoritative town crafter workflow.

### `pages/items.js`

Owns the real full crafting UI and workflow. This is the workflow the user wants town crafters to keep.

Important responsibilities currently concentrated here:

- Recipe and material loading.
- Admin resource override.
- Recipe spreadsheet/list.
- Discipline/knowledge/rarity filters.
- Smithing/enchanting/alchemy crafting steps.
- Ingredient/material selection.
- Live preview card.
- Craft attempt submission.
- Recent enchanting bounds changes.

Problem: it is page-owned and not yet extracted into reusable components/hooks.

### `components/MerchantPanel.js`

Good presentation reference for the desired town crafter shape:

- Portrait/shop scene on one side.
- Stock/workspace on the other.
- Preview panel on the right.
- Profile-aware embedded behavior.

### `styles/npc-profile-panel.css`

Currently holds several global profile/town crafter/merchant presentation patches.

### `scripts/vercel_build_v2.mjs`

Temporary bridge runner. This should shrink as patches are baked into real source.

## Desired component architecture

### New component: `components/crafting/CraftingWorkspace.jsx`

Reusable, workflow-owning component extracted from `pages/items.js`.

Props:

```js
<CraftingWorkspace
  mode="page" | "town"
  disciplineLock="Alchemy" | "Smithing" | "Enchanting" | null
  crafterId={crafter?.id || null}
  crafter={crafter || null}
  startView="recipes"
  showPageChrome={mode === "page"}
  showDisciplineSwitcher={!disciplineLock}
  onCraftComplete={reloadCallbacks}
/>
```

Rules:

- Does not know about town/map layout.
- Owns or consumes the same crafting data hooks as `/items`.
- Does not mutate world-map or town-route state.
- If `disciplineLock` exists, the discipline selector is hidden/disabled and filters cannot jump to other disciplines.
- Default view is the recipe list/spreadsheet, not a forced craft route.

### New component: `components/town/TownCrafterPanel.jsx`

Merchant-style shell around `CraftingWorkspace`.

Layout:

```text
+-------------------------------------------------------------+
| portrait / shopfront    | crafter header + actions          |
|                         |-----------------------------------|
|                         | recipe list / selectors | preview |
|                         | workflow steps          | card    |
+-------------------------------------------------------------+
```

Props:

```js
<TownCrafterPanel
  crafter={activeCrafter}
  disciplineLock={resolveCrafterDiscipline(activeCrafter)}
  onClose={closeModal}
/>
```

Responsibilities:

- Resolve portrait URL using `portrait_shop_url`, `portrait_url`, `image_url`, then storage path.
- Provide merchant-like visual framing.
- Render `CraftingWorkspace` in `mode="town"`.
- No craft rules, no duplicate recipe logic.

### `/items` refactor

`pages/items.js` becomes a thin page shell:

```js
export default function ItemsPage() {
  return <CraftingWorkspace mode="page" />;
}
```

The page keeps navbar/global app context, but no longer owns the internals directly.

## Data flow target

```text
Town page
  -> selected crafter row
  -> TownCrafterPanel
      -> resolve portrait
      -> resolve disciplineLock
      -> CraftingWorkspace(mode="town", disciplineLock, crafterId)
          -> shared crafting data hooks
          -> recipe list
          -> recipe selection
          -> material/ingredient selection
          -> preview card
          -> craft attempt submission
```

## Discipline lock mapping

- `alchemist`, `alchemy`, herb/formula role -> `Alchemy`
- `blacksmith`, `smith`, forge role -> `Smithing`
- `enchanter`, `enchanting`, sorcerer/enchanter role -> `Enchanting`

When locked:

- Filter by that discipline.
- Hide or disable other discipline buttons.
- Hide cross-discipline counts if they create confusion.
- Do not allow user to switch discipline inside a town crafter interaction.

## Migration phases

### Phase 0: Stabilize current deployment

- Keep iframe transforms inactive.
- Keep current Vercel build green.
- Do not change world-map behavior.

### Phase 1: Extract read-only workspace shell

- Create `CraftingWorkspace` by moving the visible `/items` layout into a component without changing logic.
- `/items` still renders exactly the same.
- No town integration yet.
- Verify `/items` alchemy/smithing/enchanting views still match current screenshots.

### Phase 2: Add discipline lock support

- Add `disciplineLock` prop.
- Lock filters and initial discipline.
- Verify Alchemy cannot switch to Smithing/Enchanting when locked.
- Verify regular `/items` still can switch disciplines.

### Phase 3: Add `TownCrafterPanel`

- Replace current `CrafterWorkshopModal` render path with `TownCrafterPanel`.
- Use crafter portrait left, workspace right, preview column preserved by `CraftingWorkspace`.
- Start at recipe list.
- No iframe.

### Phase 4: Bake and remove temporary scripts

- Bake `patch_town_profile_crafter_ui_v1.mjs`, `patch_crafter_shop_presentation.mjs`, and related town crafter presentation patches into source.
- Remove only one script at a time after Vercel passes.

## Acceptance tests

### Alchroy / Alchemy

- Opens merchant-style crafter panel with Alchroy portrait.
- Starts on Alchemy recipe list/spreadsheet.
- Does not show Smithing or Enchanting as usable discipline switches.
- Selecting `Healing Potion` opens the same workflow as `/items`.
- Preview card remains in the right column.

### Gormek / Smithing

- Opens with Gormek portrait.
- Starts on Smithing recipe/pattern list.
- Cannot switch to Alchemy or Enchanting inside Gormek panel.
- Forge/reforge/temper workflow remains unchanged.

### Linn / Enchanting

- Opens with Linn portrait.
- Starts on Enchanting recipe list.
- Cannot switch to Smithing or Alchemy inside Linn panel.
- Enchanting bounds and catalyst slot rules remain enforced.

### Performance

- Opening a town crafter does not mount a nested `/items` page or navbar.
- No iframe.
- Town page remains responsive.

## Non-goals

- No world-map movement or route changes.
- No merchant stock behavior changes.
- No Supabase schema changes unless a later audit proves data is missing.
- No new crafting rules.
- No replacement of existing craft formulas, DCs, or material logic.

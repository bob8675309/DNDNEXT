# Town Crafter UI + Character Interaction Source Map

## Current implementation status

Last reviewed after green deployment: `387eb6cf87f22e5e189e8e5c921bd47d257df722`.

Current green state:

- The iframe/full `/items` embed approach is inactive and must remain inactive.
- The legacy town `CrafterWorkshopModal` is still active for town crafters. It has not been deleted.
- The `/items` crafting workflow is now being extracted into `components/CraftingWorkspace.js` during the Vercel build via `scripts/extract_crafting_workspace_phase1.mjs`.
- `pages/items.js` is wrapped around the extracted `CraftingWorkspace` during the build, and Vercel has passed with this extraction active.
- `scripts/patch_crafting_workspace_lock_v1.mjs` applies discipline-lock behavior to the full extracted workspace, not to the old adapter.
- `utils/craftProfession.js` exists as the shared data-driven profession resolver.
- `scripts/validate_craft_profession.mjs` runs during the build and validates the resolver source.
- `scripts/validate_npc_panel_craft_surface.mjs` now runs during the build and verifies the current `NpcPanel` anchor surface before future Craft-tab work.
- `scripts/patch_npc_panel_craft_tab_v1.mjs` and `scripts/patch_npc_panel_craft_capability_v1.mjs` exist for inspection only. They are not active in the runner because both attempts caused Vercel failures.

Most recent active runner order:

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
scripts/patch_enchanting_bounds_v1.mjs
npx next build
```

Immediate next plan:

1. Keep current green extraction path stable.
2. Do not reactivate either failed `NpcPanel` craft transform.
3. Use `validate_npc_panel_craft_surface.mjs` as the guard before touching the panel again.
4. Update docs before each risky phase.
5. Bake or wrap `NpcPanel` source more carefully instead of applying a broad transform directly into the panel.
6. Prefer a small wrapper/bridge component around the existing panel before replacing panel internals.
7. Only after a green build should the Craft tab be exposed to users.

## Decision

The correct long-term solution is a source-level refactor, not another visual patch.

Town crafters should use the same real crafting workflow as `/items`, but displayed inside the same kind of character/profile shell used by NPCs and merchants. The UI should feel like a merchant-style interaction panel with portrait, quick tabs, and a right-side preview column, while preserving the existing crafting rules and data flow.

## Hard requirements

- No iframe or nested `/items` page inside town.
- No duplicate lightweight town-only crafting workflow as the final answer.
- No hardcoded crafter names such as Alchroy, Gormek, or Linn.
- Discipline must lock by profession/crafter capability, not by NPC name.
- Do not delete legacy code until the new source path covers every call, state transition, and database request that legacy code handled.
- Do not touch world-map movement, routes, camping, town-map labels, or travel behavior.
- Do not create new crafting rules.
- Do not replace formulas, DCs, material logic, inventory ownership, or craft submission behavior.
- Update this document before and after risky implementation phases so the current plan and repo state are recoverable.

## User-facing target

The same top interaction bar should become the general character interaction model:

```text
Profile | Sheet & Rolls | Inventory | Shop | Craft
```

Buttons are data-driven:

| Button | Show when |
| --- | --- |
| Profile | Any player character, NPC, merchant, or crafter. |
| Sheet & Rolls | Character has a sheet or the viewer has permission/admin access. |
| Inventory | Character has inventory access or the viewer has permission/admin access. |
| Shop | Character has merchant/storefront data, stock, or storefront flag. |
| Craft | Character has a crafter profession/capability such as Alchemy, Smithing, Enchanting, or later Scribe. |

This same shell should be used from:

- map NPC clicks
- town NPC clicks
- NPC page list/detail
- merchant storefronts
- crafter storefronts
- player self-profile access from anywhere on the site

## Profession lock, not name lock

Do not implement logic like:

```text
Alchroy -> Alchemy
Gormek -> Smithing
Linn -> Enchanting
```

Instead resolve the discipline from character data:

```text
Profession/capability: Alchemy    -> disciplineLock = "Alchemy"
Profession/capability: Smithing   -> disciplineLock = "Smithing"
Profession/capability: Enchanting -> disciplineLock = "Enchanting"
Profession/capability: Scribe     -> disciplineLock = "Scribe" later
```

The resolver should read from the most canonical available character fields first, then fall back to role text only if needed. Acceptable source hints include:

- `profession`
- profession subfields in sheet/profile JSON
- crafter/capability flags
- `role`, `title`, or `tags` as fallback only

Current resolver source:

- `utils/craftProfession.js`
- `resolveCraftProfession(character, sheet)`
- `canCraft(character, sheet)`

When a town crafter is opened:

- Lock to the resolved discipline.
- Hide or disable other discipline buttons.
- Do not allow switching to another discipline inside that crafter interaction.
- Start on that discipline's recipe/list view.
- Enter the existing recipe workflow only after a recipe is selected.

## What went wrong

Three attempted approaches are not acceptable long-term:

### 1. Native town `CrafterWorkshopModal` only

Pros:

- Fast and stable.
- Uses existing `components/TownSheet.js` modal code.

Cons:

- It is a separate lightweight workflow.
- It does not match the real `/items` crafting UI.
- It feels like the old town crafting model.

### 2. `/items` iframe inside town modal

Pros:

- Visually restores the real crafting workflow.

Cons:

- Loads a second full page, causing lag and sometimes hanging on `Loading...`.
- Creates nested page chrome/layout problems.
- Does not behave like a true component inside the character panel.

### 3. Broad `NpcPanel` craft transforms before panel isolation

Pros:

- Would have added the desired Craft tab quickly.

Cons:

- Both the full Craft-tab transform and a smaller craft-capability transform failed Vercel.
- The active build was restored after each failure.
- This indicates `NpcPanel` needs a more careful source-bake or wrapper approach instead of another broad build-time transform.

## Correct architecture

### `components/character/CharacterInteractionPanel.jsx`

Canonical panel shell for character interactions.

Responsibilities:

- Render shared top bar: Profile / Sheet & Rolls / Inventory / Shop / Craft.
- Decide button visibility from character capabilities and permissions.
- Host subviews without each page inventing its own modal shape.
- Keep profile, sheet, inventory, shop, and craft navigation consistent across the site.

Non-responsibilities:

- Does not implement craft rules.
- Does not implement merchant stock rules.
- Does not own world/town movement.

### `components/CraftingWorkspace.js`

Reusable crafting workflow extracted from `pages/items.js`.

Current state:

- The repository still contains an adapter at rest, but the Vercel runner replaces it with the full workflow during build.
- This is a temporary bridge, not the final source-baked form.
- The extraction has passed Vercel without panel wiring.

Target props:

```js
<CraftingWorkspace
  mode="page" | "panel" | "town"
  disciplineLock="Alchemy" | "Smithing" | "Enchanting" | "Scribe" | null
  crafterId={crafter?.id || null}
  crafter={crafter || null}
  startView="recipes"
  showPageChrome={mode === "page"}
  showDisciplineSwitcher={!disciplineLock}
  onCraftComplete={reloadCallbacks}
/>
```

Rules:

- This component owns/reuses the real `/items` workflow.
- It must preserve recipe loading, material loading, inventory loading, preview calculation, and craft submission behavior.
- It must not duplicate or rewrite craft formulas.
- It must not know about town-map movement or route state.
- In locked mode, filters and discipline tabs cannot escape the lock.
- Default locked-mode view is recipe/list view, not forced first recipe.

### `components/town/TownCrafterPanel.jsx`

Merchant-style shell for town crafters.

Responsibilities:

- Resolve and display crafter portrait/shopfront art.
- Render crafter name, profession, flavor text, and actions.
- Render `CraftingWorkspace mode="town"` with the resolved `disciplineLock`.
- Present the workflow with enough room for the preview card column.

Layout target:

```text
+----------------------------------------------------------------------------+
| Portrait / shopfront | Header + quick actions                              |
|                      |-----------------------------------------------------|
|                      | Recipes / steps / selectors       | Preview card     |
|                      | Materials / ingredients           | DC/result panel   |
+----------------------------------------------------------------------------+
```

### `/items` page after final source bake

`pages/items.js` should become a page shell around `CraftingWorkspace`:

```js
export default function ItemsPage() {
  return <CraftingWorkspace mode="page" />;
}
```

The `/items` UI must remain visually and behaviorally unchanged after extraction.

## Source areas to audit before deleting or replacing

### `pages/items.js`

Must map and preserve:

- recipe loading
- known recipe loading
- material/reagent/plant loading
- inventory loading
- player resource/admin override behavior
- discipline filters
- knowledge filters
- rarity filters
- recipe spreadsheet/list
- recipe selection
- craft mode entry/exit
- alchemy ingredient family selectors
- smithing pattern/material/temper selectors
- enchanting owned item/trait/catalyst selectors
- preview-card calculation
- craft DC calculation
- target character selection
- craft roll input
- craft attempt submission
- post-craft reload/refresh behavior
- route query behavior

### `components/TownSheet.js`

Must map and preserve until superseded:

- town merchant list behavior
- town crafter list behavior
- active crafter selection
- crafter portrait/storefront art resolution
- `CrafterWorkshopModal` call sites
- `onCraftWorkshop` callback behavior
- town modal close behavior
- merchant modal behavior

### `components/NpcPanel.js`

Must map and extend carefully:

- current tab model
- profile tab
- sheet/rolls tab
- inventory tab
- shop tab
- initial view behavior
- embedded merchant shop behavior
- future craft tab behavior
- imports and dynamic imports
- hook ordering
- `activeView` branch order
- `CharacterSheetPanel` shop callback
- merchant-specific `isMerchantView` logic

Known warning: patching `NpcPanel` with direct build transforms has failed. Treat the current panel as sensitive. Prefer source-baking with smaller commits, or a wrapper component that composes `NpcPanel` and `CraftingWorkspace` without rewriting broad sections of the panel.

Current guard:

- `scripts/validate_npc_panel_craft_surface.mjs` verifies important panel anchors after active transforms.
- This validation is active in the runner and green.
- If this validation fails later, do not continue panel integration until the anchor drift is understood.

### `components/MerchantPanel.js`

Reference only for presentation:

- portrait/shop scene column
- workspace column
- preview/details column
- embedded mode behavior
- shop/player/admin action separation

## Migration phases

### Phase 0: Stabilize

Status: green.

- Keep Vercel green.
- Keep iframe town crafter path disabled.
- Do not delete legacy town crafter modal yet.
- Confirm admin build badge helps identify deployment.

### Phase 1: Extract `/items` workflow

Status: green as build-time extraction.

Goal: create `CraftingWorkspace` without changing behavior.

Steps:

1. Identify the smallest safe extraction boundary in `pages/items.js`.
2. Extract the render/workflow body into `components/CraftingWorkspace.js`.
3. `/items` renders `<CraftingWorkspace mode="page" />`.
4. Vercel must pass.
5. `/items` screenshots should match before/after.

Current implementation note:

- Extraction is active in the Vercel runner through `scripts/extract_crafting_workspace_phase1.mjs`.
- Final desired state is source-baked: committed `components/CraftingWorkspace.js` should contain the full workflow without relying on build-time extraction.

### Phase 2: Add lockable discipline support

Status: green.

Goal: make the extracted workflow support town/panel mode without changing `/items`.

Steps:

1. Add `disciplineLock` prop.
2. Set initial discipline from lock.
3. Prevent discipline buttons and filters from escaping the lock.
4. Start locked workspaces at recipe/list view.
5. Keep regular `/items` unlocked.

### Phase 3: Add `Craft` capability and tab to character interaction shell

Status: blocked at `NpcPanel` wiring; panel anchor validation is green.

Goal: make Craft available from the same top bar pattern.

Steps:

1. Shared resolver exists: `utils/craftProfession.js`.
2. Resolver validation exists and is green.
3. `NpcPanel` anchor validation exists and is green.
4. Do not reactivate the failed craft-tab or craft-capability transforms.
5. Next implementation must be smaller and safer:
   - source-bake a minimal import/memo only, or
   - build a wrapper component around the panel, or
   - add a separate town-specific crafter panel first and only fold it into `NpcPanel` after it is stable.
6. Show Craft tab only for crafters.
7. Render `CraftingWorkspace mode="panel" disciplineLock={profession}`.
8. Keep Shop tab independent and only visible for merchants/storefronts.

### Phase 4: Replace town crafter modal path

Status: not started.

Goal: clicking a town crafter opens the shared panel on Craft.

Steps:

1. Town crafter click opens shared character panel or town crafter wrapper with `initialView="craft"`.
2. Panel shows portrait and top bar.
3. Craft tab renders the locked `CraftingWorkspace`.
4. Remove only the superseded town modal path after this passes.

### Phase 5: Remove obsolete bridges one at a time

Status: not started.

Only after Phase 4 passes:

- Remove obsolete town crafter presentation patches.
- Remove no-longer-used native crafter modal code if no references remain.
- Shrink Vercel runner one script at a time.
- Verify Vercel after each removal.

## Acceptance tests

### Shared interaction panel

- Any NPC profile opens with top bar.
- Shop appears only for storefront/merchant characters.
- Craft appears only for profession/crafter characters.
- Player can open own profile panel from anywhere.

### Alchemy crafter

- Opens with portrait.
- Craft tab is visible.
- Discipline is locked to Alchemy by profession/capability.
- Smithing and Enchanting cannot be selected.
- Starts on Alchemy recipe/list view.
- Selecting Healing Potion enters the same workflow as `/items`.
- Preview card stays in a right-side column.

### Smithing crafter

- Opens with portrait.
- Craft tab is visible.
- Discipline is locked to Smithing by profession/capability.
- Alchemy and Enchanting cannot be selected.
- Forge/reforge/temper behavior remains unchanged.

### Enchanting crafter

- Opens with portrait.
- Craft tab is visible.
- Discipline is locked to Enchanting by profession/capability.
- Alchemy and Smithing cannot be selected.
- Enchanting bounds and catalyst slot rules remain enforced.

### Performance

- Opening a town crafter does not mount a nested page.
- No iframe.
- No nested navbar.
- Town page remains responsive.

## Non-goals

- No world-map movement or route changes.
- No merchant stock behavior changes.
- No Supabase schema changes unless a later audit proves data is missing.
- No new crafting rules.
- No replacement of existing craft formulas, DCs, or material logic.
- No name-specific crafter logic.

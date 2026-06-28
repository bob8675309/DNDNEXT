# TownSheet Trace and Migration Worklog

Created during Vercel build-rate-limit pause.

## Purpose

This document maps `TownSheet` and its surrounding town route in enough detail to finish the crafter-panel migration without guessing, breaking the current green NPC Craft path, or losing sight of the goal.

The goal is still:

```text
Town crafter click -> shared character/profile panel -> Craft tab -> real CraftingWorkspace -> profession-locked workflow
```

The goal is not:

```text
Town crafter click -> iframe
Town crafter click -> separate lightweight town-only crafting workflow
Town crafter click -> direct brittle TownSheet import of a heavy shared panel without understanding the boundary
```

## Current validation boundary

Last confirmed green deployment:

```text
093fc85b1ab8a5b95facacf967338b7a52c0316c
```

Latest cleanup/docs work has been pushed after that point, but Vercel is currently returning build-rate-limit rather than running a real build. Until a real build runs again, the last known-good executable boundary remains the green commit above.

No further risky source changes should be stacked while Vercel cannot validate them.

## Non-negotiable regression guardrails

- Do not touch world-map movement, world routes, camping, travel time, or world location behavior.
- Do not alter town map marker movement, map label persistence, map image upload/delete behavior, or admin label tools unless specifically working in that lane.
- Do not change crafting formulas, crafting DCs, material logic, enchant slot rules, inventory ownership, or item-consumption semantics.
- Do not restore iframe embedding.
- Do not re-enable old failed transforms:
  - `scripts/patch_npc_panel_craft_tab_v1.mjs`
  - `scripts/patch_npc_panel_craft_capability_v1.mjs`
  - `scripts/patch_town_crafter_full_workshop_frame.mjs`
  - `scripts/patch_items_embed_mode_v1.mjs`
- Keep the NPC-page shared Craft path intact.
- Preserve the legacy town `CrafterWorkshopModal` until the shared town path is green and verified.

## High-level town route ownership

### `pages/town/[id].js`

This page owns the town route data loading, player inventory loading, player plant loading, map image persistence, label persistence, and the legacy craft submission database writes.

Source-level imports at rest:

```js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import TownSheet from "../../components/TownSheet";
import { supabase } from "../../utils/supabaseClient";
import { pickId } from "../../utils/townData";
```

The page renders exactly one `TownSheet` and passes down:

- town/location data,
- roster characters,
- quests,
- map image/admin callbacks,
- market data,
- player inventory,
- player plants,
- `onCraftWorkshop={handleCraftWorkshop}`.

Important implication: `pages/town/[id].js` is already the parent shell that knows the authenticated player, inventory, plants, Supabase, and current town. It is the best candidate to own the next shared crafter/profile panel instead of forcing `TownSheet` to import heavy shared interaction code.

## Town page data/request trace

### 1. Router and local page state

`TownPage` reads `id` from `router.query`, then owns state for:

- loading,
- admin flag,
- current location,
- town roster,
- quests,
- stored town labels,
- pending town map image file,
- map upload/apply status,
- label save status,
- market data,
- player inventory,
- player plants,
- player user id.

### 2. Auth/session request

Inside the town route load effect:

```js
const { data: authData } = await supabase.auth.getSession();
const user = authData?.session?.user || null;
```

If a user exists, the page calls:

```js
supabase.rpc("is_admin", { uid: user.id })
```

That result controls `isAdmin` and map admin tooling.

### 3. Location request

The page loads the town/location row:

```js
supabase.from("locations").select("*").eq("id", id).single()
```

The returned `location` drives:

- town summary via `buildTownData`,
- stored town map image path,
- stored image dimensions,
- quest key extraction,
- back link target.

### 4. Roster request

The page loads current in-town NPCs/merchants:

```js
supabase
  .from("characters")
  .select("id,name,kind,race,role,affiliation,status,state,location_id,last_known_location_id,projected_destination_id,is_hidden,map_icon_id,tags")
  .in("kind", ["npc", "merchant"])
  .eq("location_id", id)
  .order("name", { ascending: true })
```

Current source at rest does not include portrait fields in this select. Build patches may add those during Vercel execution. Any source-baked refactor needs to account for portrait fields explicitly.

### 5. Merchant requests

The page builds a merchant select string and then makes two parallel requests:

- present merchants: `kind = merchant` and `location_id = id`,
- resident merchants: `kind = merchant` and `home_location_id = id`.

The results are normalized by `normalizeMerchantRow` and deduped by `dedupeMerchants`.

Current source-at-rest merchant normalization includes storefront fields and tags but not portrait fields. Build patches currently add portrait support.

### 6. Player inventory request

If a user is authenticated, the page loads player inventory:

```js
supabase
  .from("inventory_items")
  .select("id,user_id,item_id,item_name,item_type,item_rarity,item_description,item_weight,item_cost,created_at,card_payload,owner_type,owner_id,is_equipped")
  .eq("user_id", user.id)
  .or("owner_type.is.null,owner_type.eq.player")
  .order("item_name", { ascending: true })
```

This inventory is passed to `TownSheet` and used by legacy `CrafterWorkshopModal` and `handleCraftWorkshop`.

### 7. Player plant requests

`loadPlayerPlantsForUser(user.id)` attempts multiple fallback reads:

1. `player_plants` joined with `plants(*)` by `user_id`,
2. `player_plants` joined with `plants(*)` by `player_id`,
3. legacy `player_plants` by `user_id`,
4. legacy `player_plants` by `player_id`.

The fallback behavior is useful and should not be removed without replacing it.

### 8. Quest request

If the location has quest keys, the page loads:

```js
supabase.from("quests").select("id, title, status").in("id", rawQuestKeys)
```

### 9. Town map labels request

The page loads stored town-map labels:

```js
supabase
  .from("town_map_labels")
  .select("*")
  .eq("location_id", id)
  .order("sort_order", { ascending: true })
```

These labels feed the map overlay UI. This must stay separate from crafter panel work.

## Town page write/request trace

### 1. Label save

`handleSaveMapData({ labels })`:

1. maps labels to database rows,
2. deletes all existing labels for the current location,
3. inserts the new label set,
4. reloads labels ordered by `sort_order`,
5. updates local `storedLabels`.

This is town-map/admin behavior and should not be touched by the crafter migration.

### 2. Map image apply

`handleApplyMapImage()`:

1. reads the selected file,
2. determines image dimensions client-side,
3. uploads to Supabase storage bucket `town-maps`,
4. updates the `locations` row with path and dimensions,
5. removes previous stored image if applicable,
6. updates local `location` state.

This is also not part of the crafter migration.

### 3. Map image delete

`handleDeleteMapImage()`:

1. removes the stored object from `town-maps`,
2. clears `town_map_image_path`, `town_map_image_width`, and `town_map_image_height` on the `locations` row,
3. updates local state.

This is also out-of-scope for the crafter migration.

### 4. Legacy craft write

`handleCraftWorkshop(...)` is the current legacy town-crafting write path.

It accepts:

- `crafter`,
- `serviceId`,
- base/primary identifiers,
- forge template,
- secondary/material/catalyst identifiers,
- plant material inputs,
- bonus/tier,
- magic variant selections,
- `imbueDraft`.

The important write flow is:

1. require logged-in player,
2. map `playerInventory` by id,
3. map `playerPlants` into plant craft items,
4. resolve primary, secondary, material, and catalyst items,
5. validate selected service requirements,
6. validate enchanter restrictions for `imbue`,
7. reject duplicate item ids across crafting slots,
8. build crafted output with `buildCraftedResult`,
9. delete consumed inventory rows if any,
10. insert crafted row into `inventory_items`,
11. rollback consumed rows if insert fails,
12. update local `playerInventory`.

This is a major reason not to delete the legacy modal too early. Even when the UI moves to `CraftingWorkspace`, any town-specific craft completion path must preserve equivalent ownership, consumption, rollback, and local inventory refresh semantics.

## `TownSheet.js` source-at-rest map

### Imports

At rest, `TownSheet.js` imports only:

```js
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { buildTownData } from "../utils/townData";
import styles from "./TownSheet.module.scss";
```

Build patches currently mutate this file and add at least Supabase import/portrait behavior. That makes direct import changes fragile because patch anchors and import ordering matter.

### Early helpers

The first section defines general UI helpers and crafter role detection:

- `cls`,
- `toneKey`,
- `uid`,
- `normalizeOverlayItem`,
- `normalizeCrafterRoleToken`,
- `inferCraftTypeFromText`,
- `collectCrafterRoleValues`,
- `inferCrafterTypes`,
- `humanizeCraftType`.

Crafter discovery is data-driven and intentionally strict. Plain class text such as wizard should not make a character a crafter. Explicit role/tag/service language is the intended route.

### Workshop service model

`buildWorkshopServices(types)` maps inferred crafter types into legacy town service cards:

- `blacksmith` -> `forge_mundane`, `reforge`,
- `alchemist` -> `brew`,
- `enchanter` -> `imbue`,
- `scribe` -> `inscribe`,
- `jeweler` -> `socket`.

This is not the final shared workspace model, but it is the current town legacy model and still drives `CrafterWorkshopModal`.

### Large embedded crafting support

`TownSheet.js` contains large embedded support logic for:

- alchemy recipe library,
- item classification,
- workshop tab assignment,
- material/catalyst detection,
- magic variant catalog loading,
- enchant slot validation,
- crafted result composition,
- local modal previews.

This is why the file is fragile and hard to safely change by blind patching.

### `CrafterWorkshopModal`

The legacy modal is defined directly inside `TownSheet.js`.

It owns many hooks and local states:

- crafter type inference,
- service selection,
- active item tab,
- active workshop step,
- selected primary/secondary/material/catalysts,
- enchant slot selections,
- bonus/tier,
- craft state,
- magic variant catalog state,
- alchemy plant/material derived options.

It calls `onCraftWorkshop` back up to `pages/town/[id].js` for the actual database write.

### Default `TownSheet` component

`TownSheet` receives from the page:

- `location`,
- `rosterChars`,
- `quests`,
- `backHref`,
- `isAdmin`,
- `storedLabels`,
- town map callbacks,
- market data,
- player inventory,
- player plants,
- `onCraftWorkshop`.

It derives:

- `townData = buildTownData(location, rosterChars, quests)`,
- active drawer/panel state,
- editable label state,
- map admin state,
- `activeWorkshopCrafter`,
- `crafterData`.

### Crafter discovery inside `TownSheet`

`crafterData` is built from:

- in-town roster NPCs/merchants,
- present merchants,
- resident merchants.

Each row is passed through `inferCrafterTypes`; only rows with one of the accepted types are surfaced. Rows are deduped by id.

### Drawer and map flow

`TownSheet` renders a `SharedDrawer` and `TownMapPanel` side by side.

The drawer receives:

```js
onOpenWorkshop={setActiveWorkshopCrafter}
```

The current town crafter click flow is therefore:

```text
SharedDrawer / crafters panel
  -> onOpenWorkshop(crafter)
  -> setActiveWorkshopCrafter(crafter)
  -> activeWorkshopCrafter ? <CrafterWorkshopModal ... /> : null
```

The map panel independently handles map labels and can call `onOpenPanel(item.targetPanel)` for location labels. That is separate from crafter opening.

## Current successful shared NPC Craft path

The NPC-page/shared path is currently the more successful migration lane:

```text
Npc page panel caller
  -> CharacterInteractionPanel wrapper
  -> NpcPanel shell/branch host
  -> wrapper-owned Craft tab
  -> renderCraftView()
  -> dynamic CraftingWorkspace
  -> disciplineLock={craftProfession}
```

Important characteristics:

- `NpcPanel` does not directly import `CraftingWorkspace`.
- The real workspace is dynamically imported by `CharacterInteractionPanel`.
- `NpcPanel` accepts wrapper-owned props and acts as a host.
- View state is bridged between wrapper and panel.
- Craft tab visibility is based on resolved profession/capability, not names.

This path should not be destabilized by town work.

## Failed town import attempts and what they imply

### Attempt 1: direct shared panel import into `TownSheet`

A patch attempted to import `CharacterInteractionPanel` directly into `TownSheet` and replace the legacy active crafter modal render with the shared panel.

Result: Vercel failed.

Conclusion: too broad, too much risk, and likely created a brittle import/bundle/circular boundary.

### Attempt 2: isolated town interaction component

A new `components/town/TownCrafterInteractionPanel.js` was created. It validates by itself and dynamically imports `CharacterInteractionPanel`.

Result: component and validator are safe when not imported by `TownSheet`.

### Attempt 3: import-only test of isolated component into `TownSheet`

A patch imported `TownCrafterInteractionPanel` into `TownSheet` but did not render it.

Result: Vercel failed.

Conclusion: the failure is not necessarily the replacement render branch.

### Attempt 4: inert null import probe

A trivial `TownCrafterImportProbe` component was created and then imported/rendered as null in `TownSheet`.

Result: the probe failed Vercel before the rate-limit cleanup; then the probe files were removed.

Conclusion: even a simple new import under `components/town` can fail when added to `TownSheet`. That points to one of these issues:

1. `TownSheet` import boundary is sensitive to new imports because of existing patch order.
2. New import from `./town/...` may be failing due to path/bundler case or directory assumptions.
3. Vercel/Next may be treating unused or newly introduced imports differently in this patched build chain.
4. Existing patch scripts may expect the exact import block shape and silently leave the file in a partially patched state.
5. The failure may come from a later patch anchor mismatch, not from the import itself.

The most likely root cause is patch-order/anchor fragility, not the null component itself.

## Existing patch-script pressure on `TownSheet`

The active runner mutates `TownSheet` before build. Known patch pressure includes:

- `scripts/patch_town_profile_crafter_ui_v1.mjs`
  - adds Supabase import to `TownSheet`,
  - adds crafter portrait helpers,
  - dedupes resident merchants,
  - adds `town-crafter-storefront` class/style behavior.
- `scripts/patch_town_crafter_native_polish_v1.mjs`
  - adds CSS polish for the town crafter storefront.
- `scripts/validate_town_crafter_panel_surface.mjs`
  - now guards the current legacy surface before future town work.

Important anchor risk:

`patch_town_profile_crafter_ui_v1.mjs` expects this source-at-rest import sequence:

```js
import { buildTownData } from "../utils/townData";
import styles from "./TownSheet.module.scss";
```

If a new import is added between those two lines, the patch's import anchor may not match. If that patch then silently leaves Supabase unimported but still later code expects `supabase`, the build can fail.

That explains why adding an import to `TownSheet` can fail even when the imported component itself is inert.

## Working theory

The immediate problem is not `CharacterInteractionPanel` itself.

The immediate problem is that `TownSheet` is still being source-mutated by build scripts, and at least one active patch expects a narrow import anchor. Adding a new import line at the wrong place can break the later patch sequence.

Therefore the town migration should not proceed by blindly adding imports into `TownSheet` until the patch anchors are made resilient or source-baked.

## Safer architectural direction

Do not make `TownSheet` import the heavy shared panel.

Instead, change `TownSheet` into a dispatcher:

```text
TownSheet
  -> user clicks crafter in SharedDrawer
  -> TownSheet calls onOpenCrafterProfile(crafter)
  -> parent page owns activeCrafterProfile state
  -> pages/town/[id].js renders CharacterInteractionPanel outside TownSheet
```

Target flow:

```text
SharedDrawer crafters panel
  -> onOpenWorkshop(crafter)
  -> setActiveWorkshopCrafter(crafter) for legacy fallback OR onOpenCrafterProfile(crafter) for new path
  -> parent route renders shared panel
  -> CharacterInteractionPanel opens initialView="craft"
  -> CraftingWorkspace locked by profession
```

Why parent-owned is safer:

- `pages/town/[id].js` already imports `TownSheet` and owns Supabase/player state.
- Parent page can import or dynamically import the shared panel without editing `TownSheet`'s import block.
- The legacy `CrafterWorkshopModal` can remain as fallback inside `TownSheet` until parent path is verified.
- It avoids adding a heavy import to the most fragile file.

## Proposed next implementation plan after Vercel clears

### Phase 0: no-code verification

- Confirm Vercel can run again.
- Confirm the cleanup/docs commit builds or, if necessary, return to last known green commit.
- Do not continue if the status is build-rate-limit.

### Phase 1: harden patch anchors before source changes

Update `scripts/patch_town_profile_crafter_ui_v1.mjs` so the Supabase import insertion is resilient to extra imports.

Better rule:

- Do not require `buildTownData` to be directly followed by `styles`.
- Insert Supabase import after `buildTownData` if missing, regardless of whether other imports exist before `styles`.
- Fail loudly if `TownSheet` needs `supabase` but the import cannot be inserted.

Add a validator that checks post-patch `TownSheet` contains:

```js
import { supabase } from "../utils/supabaseClient";
```

and contains the portrait helper only if Supabase is imported.

### Phase 2: add parent callback prop without changing behavior

Add optional `onOpenCrafterProfile` prop to `TownSheet`.

Initial behavior-preserving logic:

```js
function openCrafter(crafter) {
  if (typeof onOpenCrafterProfile === "function") {
    onOpenCrafterProfile(crafter);
    return;
  }
  setActiveWorkshopCrafter(crafter);
}
```

Pass to `SharedDrawer`:

```js
onOpenWorkshop={openCrafter}
```

No parent passes the callback yet, so legacy behavior should remain unchanged.

### Phase 3: parent route owns shared panel state

In `pages/town/[id].js`:

- add `activeCrafterProfile` state,
- pass `onOpenCrafterProfile={setActiveCrafterProfile}` to `TownSheet`,
- render a parent-owned shared panel overlay when `activeCrafterProfile` is set.

Do this with a parent-local wrapper or dynamic import. Avoid importing the shared panel into `TownSheet`.

### Phase 4: normalize town crafter into character shape

Parent route must build a character-like object from the clicked crafter:

```js
{
  ...crafter,
  craft_profession: resolvedTownCraftProfession,
  profession: resolvedTownCraftProfession || crafter.profession || "",
  role: crafter.role || resolvedTownCraftProfession || "Crafter"
}
```

Prefer using the existing shared `resolveCraftProfession` if the fields are already available. If not, add a small town adapter that maps `crafterTypes` to canonical discipline:

- `blacksmith` -> `Smithing`,
- `alchemist` -> `Alchemy`,
- `enchanter` -> `Enchanting`,
- `scribe` -> `Scribe`,
- `jeweler` -> not Craft tab yet unless future discipline exists.

### Phase 5: verify shared panel behavior

Test/validate:

- town alchemist opens Craft locked to Alchemy,
- town smith opens Craft locked to Smithing,
- town enchanter opens Craft locked to Enchanting,
- non-crafters do not show Craft,
- Shop/Profile/Sheet/Inventory tabs remain available only when appropriate,
- closing panel returns to town sheet without changing map state.

### Phase 6: retire legacy modal

Only after the parent-owned shared path is verified:

- remove active legacy modal branch,
- remove unused legacy modal code if fully replaced,
- keep or migrate any needed craft completion callbacks,
- update docs and validators.

## Validator requirements before the next town migration attempt

Before changing runtime behavior, add validators that assert:

- `TownSheet` still exports the same default component.
- `TownSheet` still renders legacy `CrafterWorkshopModal` unless a new parent callback is explicitly supplied.
- `TownSheet` does not import `CharacterInteractionPanel` directly.
- `TownSheet` does not import `CraftingWorkspace` directly.
- `TownSheet` does not contain an iframe.
- `pages/town/[id].js` remains the only owner of Supabase craft writes.
- `handleCraftWorkshop` still inserts into `inventory_items` and preserves rollback logic.
- `TownMapPanel` map-label click and drag logic is untouched.

## Open questions to answer by trace, not guessing

1. Does the current active build patch fail if any import appears between `buildTownData` and `styles` in `TownSheet`?
2. Are there other scripts that assume exact `TownSheet` import ordering?
3. Is `components/town/` import resolution valid generally, or did the failure occur because of later patch anchors?
4. Should the parent shared panel use a new local component under `pages/town/` or a dynamic import directly in `pages/town/[id].js`?
5. How should `jeweler` be handled until the crafting workspace has a Jeweler discipline?
6. Should town crafters use the same `resolveCraftProfession` resolver or a small adapter from `crafterTypes` to canonical profession?

## Current best next move

When Vercel can build again:

1. Verify cleanup commit.
2. Harden `patch_town_profile_crafter_ui_v1.mjs` import insertion.
3. Add a post-patch TownSheet import validator.
4. Add behavior-preserving `onOpenCrafterProfile` callback support to `TownSheet`.
5. Keep legacy modal as fallback.
6. Only then add parent-owned shared crafter panel rendering in `pages/town/[id].js`.

This keeps the goal intact while reducing regression risk.

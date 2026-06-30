# Loading / Hydration Root-Cause Backlog

## Why this document exists

Several user tests showed routes sitting on a loading screen until refresh or showing panel sub-sections stuck on `Loading...` even when enough row data was already available to render a useful panel.

The profile/crafter redesign is now stable enough that this document should be treated as the current loading/performance handoff.

## Observed symptoms

- `/npcs` could sit on `Loading NPCs...` for too long.
- Map route startup could appear incomplete until refresh.
- Profile panel `About` could display `Loading...` even when the caller already supplied enough NPC/merchant/crafter row data to render a fallback description.
- The issue appeared across more than one route, so it was not only a single map/offcanvas bug.

## Current fix / mitigation state

Current script:

```text
scripts/patch_route_loading_guards_v1.mjs
```

This script now does more than a pure timeout bandage for `/npcs`:

- `/npcs` startup is split into critical and secondary data.
- Critical data:
  - auth/admin check;
  - NPC roster;
  - merchant roster.
- Secondary data:
  - players;
  - locations;
  - map icons;
  - merchant profile enrichment.
- The `/npcs` page releases its shell after critical data instead of blocking the entire route behind one large `Promise.all`.
- The old full-page `Loading NPCs...` render guard was removed so the route is less likely to appear hung.
- Secondary data hydrates after the page is already usable.
- `NpcPanel` falls back to supplied row data if the full detail request is slow.
- Map startup still uses partial-load timeout guards so one slow noncritical request does not dead-start the route.

This appears to have materially improved the hanging behavior based on user testing after commit `52dd16d5b33b4d9a953db2d4d3559b65c293fe27`.

## Remaining root-cause investigation

The `/npcs` cause was at least partly identified: the page blocked all rendering on a bundled startup load. Further cleanup should still audit these areas:

1. Supabase auth calls
   - `supabase.auth.getUser()` and `supabase.auth.getSession()` are called in several places.
   - Check whether routes wait on auth before rendering data that could render without admin state.

2. Supabase query shape and RLS behavior
   - Several pages make parallel `characters`, `locations`, `inventory_items`, and profile queries.
   - Check for slow queries, missing indexes, RLS policy overhead, or queries that fail silently and block UI state.

3. Dynamic import timing
   - Map and profile-side components use dynamic imports and client-only panels.
   - Check whether route-level loading components are masking module-load stalls.

4. Bootstrap/offcanvas timing
   - `window.bootstrap` can be missing on cold first interaction because Bootstrap is loaded by a deferred script in `_app.js`.
   - A retry guard was added for offcanvas opening, but this should be revisited during a full performance pass.

5. Realtime subscription startup
   - Map route subscribes to multiple Supabase realtime channels after initial load.
   - Verify subscriptions are not duplicating, blocking, or triggering expensive reload loops.

6. Oversized bundles / patch-time generated code
   - The build still runs several patch scripts that mutate source before `next build`.
   - Once the redesign is stable, source-bake the stable results and remove obsolete patch scripts to reduce startup and build fragility.

## Desired final state

The final performance pass should prefer source-level fixes over timeouts where possible. Acceptable outcomes include:

- faster parallel request scheduling;
- rendering above-the-fold shells immediately while data hydrates;
- shared auth/admin context instead of repeated per-route auth checks;
- fewer duplicate Supabase reads;
- missing DB indexes or RLS policy corrections if query traces justify them;
- source-baking stable patch outputs to reduce dynamic build mutation.

## Guardrail

Do not mix loading/performance work with world movement, travel, route progression, camping, merchant stock, or crafting-rule changes. Those systems should remain behaviorally unchanged while loading is diagnosed.

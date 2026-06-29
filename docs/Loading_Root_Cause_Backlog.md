# Loading / Hydration Root-Cause Backlog

## Why this document exists

Several user tests showed routes sitting on a loading screen until refresh or showing panel sub-sections stuck on `Loading...` even when enough row data was already available to render a useful panel.

A stabilization patch exists, but it is intentionally not considered the final fix.

Current stabilization script:

```text
scripts/patch_route_loading_guards_v1.mjs
```

That script adds timeout/partial-load guards so the site keeps rendering when one ancillary request is slow. This is a safety net, not a root-cause fix.

## Observed symptoms

- `/npcs` can sit on `Loading NPCs...` for too long.
- Map route startup can appear incomplete until refresh.
- Profile panel `About` can display `Loading...` even when the caller already supplied enough NPC/merchant/crafter row data to render a fallback description.
- The issue appears across more than one route, so it is probably not only a single map/offcanvas bug.

## Current mitigation

`patch_route_loading_guards_v1.mjs` currently:

- wraps the NPC page initial load requests with route-level timeouts;
- wraps map initial data requests with route-level timeouts;
- lets `NpcPanel` fall back to the supplied row data if the full character fetch is slow;
- logs partial-load warnings instead of leaving the route indefinitely blocked.

This keeps testing usable while the profile/crafter redesign continues.

## What still needs root-cause investigation

After the profile/crafter redesign is stable, audit these areas:

1. Supabase auth calls
   - `supabase.auth.getUser()` and `supabase.auth.getSession()` are called in several places.
   - Check whether any route waits on auth before rendering data that could render without admin state.

2. Supabase query shape and RLS behavior
   - Some pages make several parallel `characters`, `locations`, `inventory_items`, and profile queries.
   - Check for RLS retries, slow joins, missing indexes, or queries that fail silently and block UI state.

3. Dynamic import timing
   - Map and profile-side components use dynamic imports and client-only panels.
   - Check whether route-level loading components are masking module-load stalls.

4. Bootstrap/offcanvas timing
   - `window.bootstrap` can be missing on cold first interaction because Bootstrap is loaded by a deferred script in `_app.js`.
   - A retry guard was added for offcanvas opening, but this should be revisited during the root audit.

5. Realtime subscription startup
   - Map route subscribes to multiple Supabase realtime channels after initial load.
   - Verify subscriptions are not duplicating, blocking, or triggering expensive reload loops.

6. Oversized bundles / patch-time generated code
   - The build still runs several patch scripts that mutate source before `next build`.
   - Once the redesign is stable, source-bake the stable results and remove obsolete patch scripts to reduce startup and build fragility.

## Desired final state

The final fix should identify and remove the true blocker, not only mask it with timeouts. Acceptable outcomes include:

- faster parallel request scheduling;
- rendering above-the-fold shell immediately while data hydrates;
- replacing repeated auth/admin checks with a shared auth/admin context;
- removing duplicate or unnecessary Supabase reads;
- adding missing DB indexes or correcting RLS policy behavior if needed;
- source-baking stable patch outputs to reduce dynamic build mutation.

## Guardrail

Do not mix the loading root-cause pass with world movement, travel, route progression, camping, or crafting-rule changes. Those systems should remain behaviorally unchanged while loading is diagnosed.

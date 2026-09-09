# Character Forge viewport portal fix

Status date: 2026-09-08

Follow-up browser video showed that the first full-visibility drag clamp did not solve the actual coordinate-space problem. The player Character Forge was still rendered inside the centered persistent profile host. When the Forge was promoted to a fixed draggable desktop window, browser fixed-position geometry could therefore resolve against an offset containing block while the controller clamped against `window.innerWidth` / `window.innerHeight`. That mismatch produced the visible jump to the right/down and still allowed the Forge to be dragged partly or completely off-screen.

## Corrected boundary

`components/NewNpcModalV3Refined.js` now portals the **player** Forge window to `document.body` with React `createPortal`.

The portal wrapper preserves the existing `unified-player-character-forge` styling scope, so the approved Species/Class/Abilities presentation and cinematic Class artwork selectors continue to apply. React providers remain intact across the portal. NPC Forge keeps its established non-portal rendering path.

The shared `ProfilePanelDragController` now operates in the same true viewport coordinate system as `getBoundingClientRect()`, so its existing full-window drag/reclamp bounds can work as intended rather than being offset by the profile-shell containing block.

## Validation

Validated implementation commit:

`4814f0225176acac0a172ab903cdf8b88cc5d978` — `Portal Player Forge into viewport coordinate space`

Validated stacking follow-up:

`b67ff8a31eb646c7ed82eac5268bd77d8b69cd8e` — `Keep portalled Forge above profile host`

The guarded materializers required exact starting heads, exact bounded changed-file lists, and `git diff --check`. They ran the profile/window adoption validator, Character Forge resilience validator, Class hero framing validator, and Player Forge source-magic routing validator before either implementation commit was pushed.

The Vercel exact-head build and normal PR validation suite remain the final integration checks.

## Portal stacking boundary

Because the persistent profile backdrop remains mounted while Character Forge is open and uses a higher application-layer stack than the legacy Forge backdrop, the body-level player Forge portal explicitly raises its own backdrop to `z-index: 4900`. This keeps the portalled Forge above the inert profile host while leaving the global navbar and unrelated page systems unchanged.

## Protected boundaries

No Supabase writes or migrations were made. No Class/subclass rules or persistence authority changed. No world-map, town/city-map, travel, route, crafting, inventory, merchant, tactical, or encounter behavior was touched.
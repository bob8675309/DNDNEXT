# NPC Profile-first / Centered Overlay From All Interaction Surfaces (2026-11-04)

> **DRAFT UI ONLY — not merged, not deployed.** Owner clarified after selecting the wide screenshot-inspired Profile: **NPC interactions everywhere should open the selected character's Profile**, not only from the world map. The NPC management page `/npcs` is explicitly **different** and must remain separate. No database changes, world-map movement/route/sprite changes, combat authority, inventory transfer rules, grants or GM-note migrations are proposed.

## Current access points audited

| Entry point | Existing behavior | Draft change |
| --- | --- | --- |
| World map sprites and NPC/merchant/location roster/Drawer | `MapPageClient.js` routes to Bootstrap `#npcPanel` and shared `CharacterInteractionPanel`; merchant Shop is a subsequent choice | **Keep every selection/callback, ID and Bootstrap lifecycle**, add centered overlay geometry/backdrop to `#npcPanel`; no change to map position/render/interpolation or merchant storefront routing |
| Town market/residents and crafters | `TownSheet` delegates `onOpenCharacterProfile` to town page; direct Browse Wares can request `shop` and Open Workshop can request `craft` | Town page always begins in `profile` and retains the shared panel tabs for Shop/Craft; center town modal and support Escape, focus restore and keyboard focus cycling; dormant `TownCrafterInteractionPanel` also defaults to Profile |
| Inventory character header | Operational NPC and merchant inventory selections, then a `Back` link routed to `/npcs?focus=...` | Inventory **name and explicit Open Profile action** open the global centered Profile panel for the same canonical NPC/merchant; Admin keeps explicit `Manage in NPC page` link. **Inventory selection, equipment, transfer and ownership controls do not auto-open Profile** |
| Other future NPC name/portrait links | No single cross-page NPC Profile event existed | New `openNpcProfile(characterId)` utility and one lazily opened global `GlobalNpcProfileOverlay` at `_app.js`, so future surfaces use one Profile-first entry point instead of linking into the Admin NPC manager |
| `/npcs` | GM authoring, permissions, notes and admin controls; own profile overlay | **No changes to `pages/npcs.js`**. Global event host explicitly ignores this route |
| Tactical combat participant targets | Target selections are operational, and masked participants must not expose identities | **Do not reinterpret target-selection controls as profile navigation or load hidden combatant identities**. Future explicit visible-combatant Profile affordances require P1.3 safe player-visible identity authorization first |

## Geometry & behavior

- Desktop: centered dark broad panel, `min(1260px, 100vw − 40px)` wide and viewport-height bounded, portrait plus Profile fields/lore like the screenshot, map/town background visible but dimmed.
- Mobile: full-width panel beneath the navigation strip, one-column scrolling; escape/backdrop/close support appropriate to each host.
- The world-map NPC host **remains** a Bootstrap offcanvas instance (despite centered geometry) so existing drawer/merchant return, deep links, focus and button callbacks remain authoritative. Only the NPC offcanvas enables Bootstrap backdrop; merchant, location and route offcanvas mechanics remain untouched. Its class `map-npc-profile-centered` is a styling hook; no changes to map movement or clicks.
- Admin Drawer button is shown only if the current host passed an actual `onOpenDrawer` callback. This avoids an inert button in a non-map Profile host. The explicit `Open NPC page` action remains Admin-only.

## Server privacy release blocker (unchanged)

This presentation change does **not** resolve the previously verified source privacy issue: production `characters` and `character_sheets` SELECT policies may make full sheet JSON readable to unrelated authenticated users for visible NPCs; the existing `NpcPanel` can fetch the full sheet before applying local reveal rules. The new global overlay selects only a limited canonical character field list without private GM notes/secret/traits; it **does not** claim that all nested `NpcPanel` requests are filtered server-side.

**Before enabling broad player exposure**, P1.3 must supply and test a player-safe server projection, separate permission-controlled full-sheet access, and no GM-private fields in unauthorized network responses. No UI-only hiding is treated as confidentiality.

## Safety & acceptance

- Separate draft PR directly off `main` (not stacked on P1.3 research). Full Next.js build and source regressions `validate_map_profile_offcanvas_handoff`, `validate_map_profile_character_interaction`, `validate_town_crafter_handoff_pipeline`, `validate_town_crafter_interaction_component`, `validate_character_interaction_panel` plus new source coverage must pass.
- Browser acceptance still required for desktop viewport, mobile scrolling/portrait, Bootstrap animation/backdrop stacking, Profile→Shop→Return to Profile, Profile→Craft, map Admin Drawer above window, town close/focus restore, inventory exact character ID, and direct-/npcs Admin behavior. Automated build is **not** a browser screenshot or authorization proof.
- No live Supabase queries/writes or destructive DB migrations, grants, RLS changes, world-map movement, combat-state edits, `main` merge or production deployments. Owner approval required before any large destructive DB changes.

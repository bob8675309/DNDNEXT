# Loading / Hydration Root-Cause Backlog

Updated: 2026-07-30
Status: **SOURCE-OWNED MITIGATIONS DEPLOYED / PERFORMANCE AUDIT REMAINS**

## Current state

The earlier loading fixes are baked into source. The retired build-time script `scripts/patch_route_loading_guards_v1.mjs` must not be restored.

Current owners:

- `pages/npcs.js` releases a usable shell after critical roster data and hydrates secondary data afterward.
- `components/NpcPanel.js` can render supplied row data while full detail loading completes.
- `components/MapPageClient.js` owns its nonblocking boot sequence.
- `pages/town/[id].js` owns the town-route loading guard.
- `components/CraftingWorkspace.js` owns per-source crafting timeouts.

These mitigations materially reduced cold-load hangs. They are guardrails, not proof that every underlying query, auth call, or hydration path is optimal.

## Remaining investigation

1. Measure repeated `getUser()` / `getSession()` calls and consider a shared auth/admin context.
2. Trace slow Supabase queries before adding indexes; verify query plans and RLS overhead with live evidence.
3. Audit dynamic imports and route-level loading components for masked module-load stalls.
4. Recheck deferred Bootstrap/offcanvas startup on a cold browser session.
5. Confirm Realtime subscriptions do not duplicate or trigger reload loops.
6. Measure initial bundles and remove duplicate reads before adding more timeout behavior.
7. Reconfirm the reported town-map fallback flash before patching it; keep any fix confined to town/city presentation.

## Safe completion criteria

- above-the-fold shells render without waiting for unrelated secondary data;
- failed or slow secondary requests produce bounded, visible fallback states;
- no route depends on a source-mutating build patch;
- query or index changes are supported by measured evidence;
- cold navigation and refresh are both browser-tested.

## Guardrail

Do not mix this work with world movement, route progression, travel, camping, weather, merchant stock, crafting rules, or tactical encounter authority. Town/city loading presentation and world-map behavior remain separate concerns.

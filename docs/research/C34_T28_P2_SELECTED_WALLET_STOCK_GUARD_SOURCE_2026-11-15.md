# C34 T28-P2 — Scoped stock and selected-wallet-owner guard (research; NOT released)

**Date:** 2026-11-15. **PR:** [#379](https://github.com/bob8675309/DNDNEXT/pull/379). **Evidence level:** source-derived pure JavaScript candidate and deterministic unit suite added to the held branch. No signed P2 browser CI accepted as of authoring; never equate P1 signed acceptance with P2.

## Why this is distinct from T28-P0 and P1

T28-P0 uses `createNonMapActorEpochCandidate()` to scope stock by authenticated actor **and** merchant and wallet by actor. T28-P1 mounted the exact-original `MerchantPanel` and `useWallet` across a deliberately persistent scratch logout and held genuine local signed stock and GP responses. Original old bytes were rendered (expected negative); a separate ticketed scratch lane rejected them. Neither test changed the product.

The original `utils/useWallet.js` also takes an optional `userId`: an authorized Admin may request a **different target user's wallet without switching their own authentication identity**. Wallet actor epoch alone therefore cannot detect a same-Admin switch between target A and B. The original merchant's fetch also may have multiple same-actor/same-merchant overlapping reloads (purchase, restock, manual fetch).

## Narrow implementation committed to held branch

- `utils/c34/t28P2CommerceGuardCandidate.mjs` wraps the original pure T28-P0 actor/merchant scope with a **selected wallet target generation** and separately monotonic same-scope read sequences. The read functions are injected; transport and RLS remain the caller's responsibility.
- `scripts/integration/c34/test_t28_p2_commerce_guard_candidate.mjs` locks the unchanged original merchant and wallet Git blobs and asserts that this new helper is not imported by the product map, NPC, town, inventory, shared merchant or wallet files. Eight deterministic async cases test late GM logout stock/GP, same-actor relogin, merchant switch without wallet invalidation, Admin selected wallet A→B, out-of-order same-merchant reads, actor-switch late error, current authenticated read rejection, and disposal.
- `.github/workflows/validate-c34-joint-source-research.yml` adds only a Node22 syntax and seven-case unit check. No DB credentials, deployment, browser, production SQL or automatic PR merge. Existing source contract, T26/T27/P1 signed runner, and release-rejection job are retained.

**Important:** This is only the **first source-only P2 increment**. It is not yet a guarded replacement of original `MerchantPanel`/`useWallet`, full authenticated merchant and wallet role/browser check, signed purchase/restock race, or actual in-app mount. The helper must NEVER be integrated alone as a security control. A caller must use authenticated synchronous Auth state and a matching selected wallet user, and RLS/RPC authorization remains authoritative.

## Next acceptance steps (pending)

1. Verify exact new commit and all existing source and signed CI, including no regressions in the original T28-P1 negative. A GitHub CI not yet observed is PENDING, not GREEN.
2. Create an isolated, source-locked **non-map mounted** candidate derived from the unchanged original merchant component and wallet hook. Guard every async read/state commit, including auth changes, merchant switches, target-user switches, revocation, component disposal, and out-of-order refresh; preserve Profile→Shop→Profile behavior and original public/GM/creator roles.
3. Exercise genuine local PG17/GoTrue/PostgREST/current Next Chromium under signed GM/outsider/editor and inspect transaction results from original `buy_from_merchant` / `wallet_set` against immutable account identity. Do not issue these transactions to hosted production.
4. Preserve original T1–T28-P1 regression and three-page official PDF, verify temporary scratch route cleanup, and record exact executable SHA/workflow outcomes before any owner-reviewed main-merge plan.

**Hold:** original `components/MerchantPanel.js`, `utils/useWallet.js`, protected `components/MapPageClient.js`, active map/town/manager routes, hosted Supabase, wallet balance, and merchant stock are unchanged by this increment. #379 remains open. Encrypted independent database+340 Storage restore, full original Forge/legacy writer cutover and production role/browser gates remain separate.

## Follow-on P2 candidate: original component-shaped isolation (source-only, NOT signed)

The second research increment additionally introduces:

- `utils/c34/useWalletT28P2Research.js`: an **unmounted** React hook retaining original `useWallet(userId)` return fields and the actual `wallet_get`/`wallet_set` call shapes; auth-event cancellation, selected `userId` ticketing and stale `set()` response rejection added. This is research adaptation, **not an exact original Git blob**, unlike the untouched actual production hook.
- `components/c34/MerchantPanelT28P2Research.jsx`: an **unmounted** complete source-derived copy of the original MerchantPanel (original business/admin controls retained), with relocated imports, guarded original `character_stock` reads and checks preventing old signed purchase responses from setting UI notice after actor/merchant changes. It does not cancel a server-accepted purchase and must NOT be interpreted as a transaction atomicity fix. No active map, town, NPC panel or inventory route imports this copy.
- `scripts/integration/c34/test_t28_p2_derived_source_contract.mjs`: offline static original blob pins, candidate source expectations, protected route non-import and no checked-in temporary P2 route. The original C34 Node source workflow includes this step, but **a static marker test is not JSX compilation, current browser acceptance or signed RPC proof**.

**New risks still open:** full merchant admin mutation operations (restock/dump/route/saved settings) have not received the same asynchronous epoch audit; role changes without an Auth event require explicit permission invalidation; React Strict Mode lifecycle/mount tests and complete GM/outsider/admin, buyer purchase/GP and wallet-set source-real tests are mandatory before any production import. The original source's default `presentation="map"` is retained in the research copy for compatibility; it is NEVER mounted on the world map. Existing original C34 T28-P1 real signed lifecycle remains the valid earlier tier.

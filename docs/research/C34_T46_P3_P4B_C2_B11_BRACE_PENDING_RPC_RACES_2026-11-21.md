# C34 T46-P3-P4B-C2-B11-BRACE — Actual signed pending merchant management RPC race research

**Accepted disposable research — NOT DEPLOYED**. Dated 2026-11-21 CST. Draft [PR #379](https://github.com/bob8675309/DNDNEXT/pull/379) on `research/c34-clean-main-privacy-forge-joint-source-20261112`.

## Exact independently verified executable

- **Tested branch executable:** `22f1fdadd72951020e47a74890091af2ba877ad5`
- **Signed full-suite run:** [#44889276130](https://github.com/bob8675309/DNDNEXT/actions/runs/44889276130), **job `136801317554`**, **SUCCESS**
- **Evidence:** entire **87,631-character decoded job log independently retrieved**. No nonzero process exit; local GoTrue/PostgREST/PostgreSQL 17 services were torn down with `Stopped supabase local development setup.`
- **Previously accepted inherited research:** B10 actual signed atomic server writers `e07296163b1f0be717d9735d66eb604e31e637e8` [#44884729300](https://github.com/bob8675309/DNDNEXT/actions/runs/44884729300); B11 actual original+guarded Town→Profile→Shop atomic add/remove/dump `483838dae20c02f860ed624681baf82c3e71b9d8` [#44887345533](https://github.com/bob8675309/DNDNEXT/actions/runs/44887345533). Both sets of regressions **also passed in this new full-suite run**. Source-only B11-BRACE checks passed for both merchant variants.

## Objective and actual test boundary

B11 originally checked signed auth/merchant around the management RPC but still had ordinary unscoped React error `setErr` and `setBusyId(null)` cleanup. Those statements could update UI after the user or merchant changed. The original merchant variant also had an unscoped stock reader and older `useWallet` behavior, unlike previously tested T28 guard.

B11-BRACE composes the existing source-pinned **research-only** B11 overlay with authenticated-event/merchant **epoch** tickets. Before and after the RPC, and in catch/finally, only a still-current actor+merchant+epoch request can complete UI state. Test-only original storefront reuses `useWalletT28P2Research`, and its original source-derived stock reader gains a latest-request/actor/merchant ticket. Guarded T28/T33 retains its existing stock/wallet guards. **Neither original game component, nor the actual wallet hook, is changed.** The stock-management SECURITY DEFINER RPC remains the sole server write authority.

Crucially, **this does not cancel a request already sent to SQL**. A genuine signed request may commit before sign-out. The test explicitly observes that old seller's valid committed data and tests **only** that its delayed HTTP reply cannot pollute the newly authenticated/selected UI. Conversely, a request intercepted *before* reaching SQL is genuinely rejected after the role changes, using the latest `public.user_profiles.role` authorization decision.

## Exact source and actor tests

**Files introduced or updated by B11-BRACE**, relative to accepted B11 docs-only commit `4cd53e63d99d4ae6df33faa4f087e39aea67f0a2`:

1. `scripts/integration/c34/candidates/t46_p3_p4b_c2b11_brace_pending_rpc_overlay.mjs` (Git blob `7f7eced1288df0be762342205219008f5fd2aeb0`), strict original+guarded source pins inherited from B11, epoch/reset/action guards, no direct stock REST DML, local-only debug inspector.
2. `scripts/integration/c34/run_t46_p3_p4b_c2b11_brace_pending_rpc_signed.mjs` (blob `4b3f3ccecb9e20e223c9d5ae3be1b1452e85ee92`), actual local Next/React component mounting for **both** variants, real GoTrue sign-in/out, `page.route` interception and genuine `route.fetch()` signed PostgREST, temporary probe page created with `wx` and removed in `finally`. Test merchants explicitly use owner-approved **moving** and **camping** state; server authorizes both. It checks distinct actor wallets (17 GP / 93 GP), exact merchant stock rows, second action's busy state while first response releases, and complete route/stock cleanup.
3. `scripts/integration/c34/test_t46_p3_p4b_c2b11_stock_ui_source.mjs` adds source-locked BRACE checks, verifying original unsafe source remains retained and generated scratch overlays have no direct INSERT/UPDATE/DELETE.
4. Existing `scripts/integration/c34/test_t46_p3_p4b_c2b_guarded_buy_signed.mjs` now calls BRACE **after all accepted B2–B11 suites**. Existing `.github/workflows/validate-c34-t46-p3-p4b-c2b-guarded-buy.yml` includes both new files as trigger paths and Node 22 syntax checks. No release workflow or hosted migration.

**Full signed PASS markers** in the exact accepted job:

| Variant | Genuinely signed browser assertion | Verified result |
| --- | --- | --- |
| Original | `PASS T46-C2B11-BRACE-ORIGINAL-AUTH-RACE` | Auth A signed manager's RPC commits to original merchant A, HTTP response held; logout/new manager B signs in, opens merchant B, launches another RPC; A's late reply **cannot clear new busy**, change B's 93GP, write an error, mix stock, or duplicate rows |
| Original | `PASS T46-C2B11-BRACE-ORIGINAL-MERCHANT-RACE` | Same B actor changes mounted merchant A→B while real A RPC reply held; after release B remains selected, no A stock/busy/error leak |
| Original | `PASS T46-C2B11-BRACE-ORIGINAL-MISSING-RACE` | Synthetic PGRST202 HTTP404 reply delayed until after merchant switch; old error suppressed and no raw INSERT/DELETE/PATCH or server stock write |
| Original | `PASS T46-C2B11-BRACE-ORIGINAL-ROLE-RACE` | Actual GM B signed request intercepted **before SQL**, `user_profiles.role` changed to player; after request forwards the B10 function returns HTTP403 / SQLSTATE `42501`, unchanged shelf and no unsafe fallback |
| Guarded | `PASS T46-C2B11-BRACE-GUARDED-AUTH-RACE` | Same authenticated logout/new user concurrent busy/GP/stock checks |
| Guarded | `PASS T46-C2B11-BRACE-GUARDED-MERCHANT-RACE` | Same mounted component merchant A→B with delayed genuine success |
| Guarded | `PASS T46-C2B11-BRACE-GUARDED-MISSING-RACE` | Same delayed missing-RPC stale error suppression, no direct stock DML |
| Guarded | `PASS T46-C2B11-BRACE-GUARDED-ROLE-RACE` | Same real DB role revocation before SQL, signed `42501` denial |
| Both | `PASS T46-C2B11-BRACE-SIGNED` | All eight accepted, original+guarded component and world-map bytes restored; buyer and management function bodies unchanged in disposable PG17 |

The original known **negative RED markers** (old wallet-after-logout, original stale absolute stock PATCH, original hidden buyer and future-tech GM permission, etc.) still PASS as intentionally captured original defects; B11 and this BRACE do not silently rewrite them. The accepted original B11's signed browser positive/negative, buyer ledger and rollback checks also all passed in this full run.

## Exact protected-source review and release boundary

Fresh live GitHub blob inspection at accepted branch HEAD found:

- `components/MerchantPanel.js` original `22e4d0810603bc0322904573cb5fe0c14bad1f88` — unchanged, raw stock writer defects remain in production source
- `components/c34/MerchantPanelT28P2Research.jsx` `32c808c78f56767a19c1fcfd4f64c961755a8cf1` — unchanged
- `components/MapPageClient.js` `61f8738da2ca3d8635b5a413bfdc18c094228a0a` — protected world map untouched
- `utils/useWallet.js` `f34b99f1d6eee66420d57bdcefdc6d3427092e25` — unchanged, original actor-after-logout negative preserved
- `main` `bb3939eeb9a38cf416996a1dca3b196b156b2915` — unchanged, no PR merges or deployed behavior.

**Not established:** mounted production merchant/profile parity, updated hostile user JWT/session replay beyond tested cases, quantity and reroll UI pending-response lifecycle across switches, useWallet original production replacement, hosted `c34_t46_manage_merchant_stock_v1` grants/function body/lock order, hosted installed function equivalence, API 40001→HTTP500 release behavior or retry/client display guarantees, full original Forge/NPC/Spell feature parity, 22/34 historical players.sheet writers and 29/31 non-map Forge source graph, independent encrypted PostgreSQL 17 restore and all 340 Storage object byte verifications. None of these are implicitly accepted by green BRACE results.

## ONE NEXT B11-C2B12 research boundary (owner release HOLD)

Test the **remaining** merchant tools that use `c34_t46_manage_stock_qty_v1` (relative delta / absolute CAS) and `reroll_merchant_inventory_v2` across deliberately held HTTP response after actor logout/login and same-mounted merchant switch. Preserve the original B8/B9 signed SQL/lock/rollback evidence and reject missing/denied RPC without raw-table fallbacks; determine whether B11-BRACE's epoch protection should be shared by all stock management actions in a future owner-reviewed cutover. In parallel, document a safely versioned **HTTP409 vs SQLSTATE40001** release candidate instead of silently changing accepted B10 tests or assuming PostgREST automatic retries. Do not install hosted SQL, merge PR, change map, use paid agents, delete originals or deploy until separate owner GO and original PR/privacy/Forge/inventory backup gates are met.

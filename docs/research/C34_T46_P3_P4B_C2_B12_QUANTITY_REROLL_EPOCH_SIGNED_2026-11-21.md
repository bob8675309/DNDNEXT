# C34 T46-P3-P4B-C2-B12 — Genuine signed merchant quantity/reroll delayed-response research

**Accepted as disposable research only (NOT deployed)**, November 21, 2026 CST. [Draft PR #379](https://github.com/bob8675309/DNDNEXT/pull/379), `research/c34-clean-main-privacy-forge-joint-source-20261112`.

## Exact verified executable and provenance

- **Accepted executable HEAD:** `334b14f6d0c85f5d9e88549ee4157a42770e1717`.
- **Full original-inherited plus B12 signed Actions:** [run #44891744852](https://github.com/bob8675309/DNDNEXT/actions/runs/44891744852), **job `136808850193` SUCCESS**. The COMPLETE **90,533-character decoded job log** was independently retrieved and inspected.
- **No test shortcuts:** actual pinned Next 16.1.6 / Supabase JS 2.84.0, Chromium, GoTrue, PostgREST, PostgreSQL17; signed managerA + managerB, separate signed buyer and public DB transactions. All B2–B11-BRACE original positive/expected-RED, source, ACL, buyer, B8 quantity, B9 reroll, B10 atomic add/remove/dump, wallet+inventory and rollback markers passed again before B12. No nonzero process exit. `Stopped supabase local development setup.` present in exact success log.
- **Static source acceptance:** both original and T28/T33 guarded merchant variants pass exact source Git blob checks and source-derived B12 delta/CAS/reroll epoch guards with direct `character_stock` browser DML absent. First source-only run [#44891564193](https://github.com/bob8675309/DNDNEXT/actions/runs/44891564193) failed **only** because a test rejected the historical `rerollThemedFallback()` **function declaration** (which is not called) as though it were the forbidden invocation; corrected to reject `await rerollThemedFallback()`, preserving original historical RED. Subsequent [#44891623043](https://github.com/bob8675309/DNDNEXT/actions/runs/44891623043) source check SUCCESS, and the signed full suite includes passing B12 static checks.

## Implemented only inside ephemeral browser overlays

`scripts/integration/c34/candidates/t46_p3_p4b_c2b12_qty_reroll_epoch_overlay.mjs` (blob `14d1b2b6f38a6bee59f46dfc5f2c0035cca76f5f`) is built on accepted B11-BRACE, which is built on B11 stock add/remove/dump and B9 quantity. It uses exact Git blob pins for both existing original merchant files, retains the moving/camping trade policy, and scopes the previously-unprotected **B8 delta increments/decrements, B8 absolute compare-and-swap SET, B9 reroll** to a fresh signed actor+selected merchant+epoch request ticket. Before every RPC and after its response, plus in catch/finally, only the still-current ticket may update client busy/error/stock state. A missing or denied reroll RPC fails closed; no browser DELETE/INSERT, and no untrusted two-arg or raw REST fallback. Three-argument `p_count` call and original 28–32 rarity/themed server selection retained; B10 independently tests exact source-default omitted `p_count` DB signature. Postcommit server operations are never falsely claimed to be aborted by React scope changes.

`scripts/integration/c34/run_t46_p3_p4b_c2b12_qty_reroll_signed.mjs` (blob `6cd8ce2f4d8a5b2598e6ec61a793b5ea69cf81bc`) runs AFTER the untouched accepted B11-BRACE suite, on a separate temporary Next route and source-restored browser fixture, with its own manager/buyer accounts and two merchants (`moving` and `camping`). Authentic requests are intercepted with `page.route`; `route.fetch()` obtains the **genuine signed PostgREST result first**, then tests delay the HTTP reply while the mounted component changes context. A separate gate holds a request **before SQL** when revoking the role. Failed RPCs and expected SQLSTATE are asserted with exact stock/wallet/inventory values; the guard forbids direct browser PATCH/DELETE/INSERT. `finally` releases all gates, closes the local browser/Next process, removes the temporary page and restores original application bytes and world-map hash.

## Exact independent signed browser PASS receipts

| Variant | Test marker | What was actually established |
| --- | --- | --- |
| Original | `PASS T46-C2B12-ORIGINAL-DELTA-AUTH-RACE` | GM A's authenticated quantity delta **commits 2→3** on merchant A; HTTP200 held across real logout/new GM B sign-in and merchant B selection; GM B separately commits merchant B delta **2→3**. A's late reply cannot clear B's pending busy, overwrite B's **93GP**, show stale errors or mix shelf rows. No raw stock PATCH |
| Original | `PASS T46-C2B12-ORIGINAL-SET-CAS-RACE` | A genuine signed buyer buys one unit (3→2) and pays **3GP** for one inventory item; original stale absolute SET returns **40001/HTTP500**, reply held until merchant switch, then rejected without stale UI error or wallet/inventory corruption |
| Original | `PASS T46-C2B12-ORIGINAL-REROLL-MERCHANT-RACE` | The existing original-source-derived seller-first reroll genuinely replaces **28–32** stock rows on a **moving** merchant. HTTP200 arrives only after shop switches to a **camping** merchant, whose shelf/error/busy remain unaltered; no raw stock REST writes |
| Original | `PASS T46-C2B12-ORIGINAL-REROLL-MISSING-RACE` | Simulated PGRST202 HTTP404 reply after merchant switch fails closed; no obsolete fallback RPC, browser DELETE/INSERT or changed shelf |
| Original | `PASS T46-C2B12-ORIGINAL-REROLL-ROLE-RACE` | Real GM request held BEFORE SQL, database `user_profiles.role` changed to player; forwarded authenticated RPC rejects **42501/HTTP403**, shelf unchanged |
| Guarded | `PASS T46-C2B12-GUARDED-DELTA-AUTH-RACE` | Same genuine two-manager delayed quantity operations and account/wallet scoping |
| Guarded | `PASS T46-C2B12-GUARDED-SET-CAS-RACE` | Same real buyer, stale CAS, 3GP/one item, no stale UI painting |
| Guarded | `PASS T46-C2B12-GUARDED-REROLL-MERCHANT-RACE` | Same genuine seller-first source selection while moving/camping |
| Guarded | `PASS T46-C2B12-GUARDED-REROLL-MISSING-RACE` | Same delayed 404 fail-closed no browser raw DELETE/INSERT |
| Guarded | `PASS T46-C2B12-GUARDED-REROLL-ROLE-RACE` | Same genuine `42501` permission recheck at SQL entry |
| Both | `PASS T46-C2B12-SIGNED` | All 10 B12 signed markers plus B2–B11-BRACE inherited passes, SQL function definition MD5 preserved, local teardown |

This is source-locked **signed test research**, not proof that current original production storefronts are safe.

## Exact changed scope vs prior held checkpoint

Compared with `00005761c131ca5f105a1bb8e18cc35c3719faaf`, the accepted executable only modifies research workflow, source-only regression, and parent signed test runner and adds the above B12 builder/runner. `components/MerchantPanel.js` Git blob `22e4d0810603bc0322904573cb5fe0c14bad1f88`, `components/c34/MerchantPanelT28P2Research.jsx` `32c808c78f56767a19c1fcfd4f64c961755a8cf1`, `utils/useWallet.js` `f34b99f1d6eee66420d57bdcefdc6d3427092e25` and protected `components/MapPageClient.js` `61f8738da2ca3d8635b5a413bfdc18c094228a0a` are unchanged in actual GitHub. `main` and production Vercel are untouched, PR remains draft/unmerged. Hosted `c34_t46_manage_merchant_stock_v1` not installed, hosted function bodies/grants not compared and **no hosted SQL or Storage mutation was performed**.

## Release conflict/automatic retries

See [C34 C2-B12 HTTP conflict/retry research](C34_T46_C2_B12_HTTP_CONFLICT_RETRY_REVIEW_2026-11-21.md). Pinned Supabase JS is **2.84.0**. Current Supabase documentation describes built-in automatic PostgREST POST retries beginning **2.102.0**, including HTTP409. Thus do NOT naively translate accepted SQLSTATE40001→HTTP500 into HTTP409, or assert that future clients will not retry non-idempotent stock add/reroll writes. This is a separate owner-reviewed and versioned release-design gate; **no SQL changed**.

## ONE NEXT bounded C2-B13 research; release HOLD

Perform a fresh, comprehensive **non-map merchant stock/bulk-reroll writer callsite inventory** and preserved original PR dependency mapping. Specifically cover original `components/MerchantPanel.js`, guarded T28/T33, `components/MerchantStorefrontView.js`, admin inventory and `pages/admin.js` future-tech global reroll, standalone inventory/character-stock tooling, any background/merchant authoring consumers, and exact source/permissions of each PostgREST/function call. Confirm B8/B9/B10/B11/B12 candidate coverage versus each original path, identify untested writers and browser capabilities (including when merchant moving/camping), and produce an **owner-reviewable versioned cutover/rollback plan** with no production patch. Do NOT silently retire original features, broaden NPC/profile RLS, change the protected world map or install SQL, merge unrelated PRs, deploy, use paid agents, or bypass the independent encrypted PG17+340 Storage object byte-verified restore gate, 22/34 legacy `players.sheet` writer work, 29/31 nonmap Forge/two separately protected map triggers, and full held PR privacy/Forge/Spell original feature tests. Hosted installed function-body/grant and production permissions inspection requires separate owner authorization.

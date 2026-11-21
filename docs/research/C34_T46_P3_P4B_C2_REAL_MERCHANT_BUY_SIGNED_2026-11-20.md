# T46-P3-P4B-C2 — Original merchant purchase through actual town Profile

**Research-only candidate, 2026-11-20 CST. Exact signed CI pending at submission. No production SQL, world map, deployment, merge or gameplay source change.**

## Source and inheritance custody

Research PR [#379](https://github.com/bob8675309/DNDNEXT/pull/379) retains the original P4B-B signed actual town and Bazaar Profile-first browser executable (Git blob `40e88676f0c50e98ed16edf0be58f84dd1598f23`). This C2 runner extends it without changing the original. Exact original source `scripts/fixtures/forge_original_merchant_buy_source_pg17.sql` has Git blob `72fd9f0f80a83adaec67caf80a762e238f1dcd8c` and `md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)')) = 1dbe8c24c4c718396d7256f6f7465354`. The unchanged MerchantPanel, MerchantStorefrontView and useWallet blobs are pinned, along with the protected MapPageClient.

## Signed local test contract

New research-only `scripts/integration/c34/test_t46_p3_p4b_c2_signed_merchant_purchase.mjs`, derived from the original P4B-B executable, stages the exact existing #345 Stage1–3 privacy SQL, original town-presence projection, Profile-first MerchantPanel, and the original buy RPC **only in disposable loopback PG17/GoTrue/PostgREST**. Local `t46_p3_p4b_c2_merchant_buy_pg17.sql` supplies reduced stock, wallet and inventory tables under RLS and an explicitly **synthetic** signed-self-only `wallet_get`, which is **not** a claim of hosted wallet-get parity.

Expected positive: a signed player opens the *real* tracked `/town/[id]` Bazaar, selects Browse Wares (Profile first), enters Shop through dialogue, clicks an original MerchantPanel Buy button; the actual original buyer POST succeeds once, wallet 72→60 GP, stock 3→2, one inventory row delivered to authenticated buyer with unchanged merchant/price/stock provenance, and updated GP displayed. A second signed zero-GP buyer receives Insufficient funds on the actual town/shop UI without ledger mutation.

Expected negatives: anon stock/buy and inventory; unrelated actor wallet; forged merchant+stock UUID; oversell quantity; no ledger changes after denied operations. Canonical Sheet/XP and protected map hashes must remain unchanged. Original local source files restore in `finally`. Legacy T28/T33 flags explicitly default OFF; ON combinations require a distinct test. The new `test_t46_p3_p4b_c2_merchant_commerce_source.mjs` enforces original source hashes and documents the direct-buyer merchant visibility gap.

## Release blockers not waived

The original SECURITY DEFINER buyer validates stock UUID, quantity, wallet and caller identity but **does not check merchant hidden, storefront_enabled, location, or state**; a direct guessed merchant/stock UUID is a separate authorization risk requiring signed negative/candidate before release. Original MerchantPanel/useWallet async stock/wallet/late-buy actor races and wallet-refresh failure remain a separate C2-B gate, preserving previous T28 research and original PR contributions.

Other outstanding: 22/34 legacy player Sheet writers, 29/31 nonmap Forge triggers and two protected world-map triggers, independent encrypted PG17 restore and all 340 Storage objects restored byte-exact, full original source/ACL/rollback and owner GO/NO-GO. C3 Creator private Story and trusted GM dice/dialogue provenance are not accepted.

**CI status at dossier creation: PENDING, not C2 GREEN.** Inspect exact source SHA/actions before any acceptance. Never widen original character column grants or execute production SQL.

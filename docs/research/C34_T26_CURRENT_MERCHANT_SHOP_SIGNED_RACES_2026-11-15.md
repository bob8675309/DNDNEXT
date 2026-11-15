# C34 T26 — Signed real merchant Profile → Shop → Profile and delayed actor/character races (SCRATCH ONLY)

**Record date:** November 15, 2026 (UTC). **Working PR:** [#379](https://github.com/bob8675309/DNDNEXT/pull/379), draft research integration based on production `main` `6637b14f807ebec79542deb7eef4b2bc3abfb5fd`.

**Exact executable PASS head:** `034bda299806fecffc3735f8d837150b2cb496ec`. **Seven distinct exact-head workflows SUCCESS**, including [C34 source/static preservation run #43686609825](https://github.com/bob8675309/DNDNEXT/actions/runs/43686609825) and [genuine local PG17/GoTrue/PostgREST + current Next 16 Chromium + original PDF run #43686609783](https://github.com/bob8675309/DNDNEXT/actions/runs/43686609783), job `132728296116`. This result is **T2/T4 bounded research evidence, not production release or a claim that the protected shared `NpcPanel` is repaired**.

## Why this task is separate from T25

T25 finished the source-locked, signed version of the ACTUAL 2,420-line current `pages/npcs.js` manager; its merchant roster selected but the actual merchant shop and full Profile navigation remained unmounted. The older shared `components/NpcPanel.js` reads the legacy wide private `characters` projection and `loadCharacterSecrets`; it also services the world map and fails Stage2 role-wide revoked column grants. Importing it or weakening Stage2 ACL to make the test green would create a production regression/security risk. Original #345's shared-profile implementation is still held.

T26 uses the unchanged exact T25 manager transformation and **replaces its temporary, disposable-only Profile import** with a small signed public Profile adapter; that adapter mounts the **unchanged ORIGINAL** current `components/MerchantPanel.js` and `components/MerchantStorefrontView.js`. The shop stock, filters, item cards and purchase handler are those real current-app components. The adapter is NOT the original production shared Profile; its new public Profile-entry button exists only in the derived temporary page so players without Sheet permission can reach the shop.

## Source files, provenance and isolation

- `components/c34/NonMapMerchantShopResearchPanel.jsx`: unmounted adapter uses T21 `readNonMapNpcProfileCandidate`; no raw character/private readers. Actor/character matching and request-generation guards; clears Profile and unmounts shop on signout/account/selection change; original Talk button text, real MerchantPanel and a scratch `Return to Profile` control.
- `scripts/integration/c34/derive_t26_current_merchant_shop.mjs`: derives T25 from exact source, changes only its scratch Profile import; adds a Profile button for authorized public selected characters and clears the overlay on actor transition. It refuses source drift across six original blob SHAs:
  - `pages/npcs.js` `7fc00b9b3ace6233d1648a3d017f8a05e072d722`;
  - `pages/_app.js` `e5f68c0abb293089d6ad09d4e3e4035612eac598`;
  - `components/NpcPanel.js` `e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db`;
  - `components/MapPageClient.js` `61f8738da2ca3d8635b5a413bfdc18c094228a0a`;
  - `components/MerchantPanel.js` `22e4d0810603bc0322904573cb5fe0c14bad1f88`;
  - `components/MerchantStorefrontView.js` `9460eb1ea15994b9b0ed2abefba660e9b4c9370c`.
- `scripts/integration/c34/test_t26_merchant_shop_source.mjs`: four offline source/inheritance/negative tests, all PASS. The original `pages/npcs.js`, shared `NpcPanel`, `pages/_app.js`, town/inventory and MapPageClient have no import of this candidate.
- `scripts/integration/c34/test_t26_current_merchant_shop_browser.mjs`: actual signed Next/Chromium runner derives and writes *only* disposable `pages/__c34_t26_probe.jsx` with fail-closed `wx`, removes that route/PDFs in `finally`, blocks any non-localhost browser request and checks page exceptions. No permanent route in Git.
- Two existing C34 workflows were extended to run T26 static and T26 full signed tests **after** all inherited source-original T1–T25 and held #345 browser/PDF tests; original suites remain intact.

## Exact signed browser and security evidence

The successful [run #43686609783](https://github.com/bob8675309/DNDNEXT/actions/runs/43686609783) records:

1. **T26-ACL-RED-GREEN:** A true signed wide legacy `characters` SELECT is rejected by original Stage2 with `42501`; the original T24 narrow nine-column roster projection is signed GREEN. The GM's merchant is found by that narrow selector. No broad `GRANT`, RLS workaround or original migration alteration.
2. **T26-STOCK:** A **new synthetic `character_stock` table solely in disposable PostgreSQL 17**, with an authenticated row policy requiring a storefront-enabled merchant. PostgREST schema refreshed, original MerchantPanel read and matched the seeded item. Anonymous read is denied/empty. This schema/table is a test fixture, NOT a live merchant-stock migration or proof of all live stock policy compatibility.
3. **T26-C01–C04:** Actual current manager-derived temporary route compiles under current `_app`, exact GM NPC focus deep link and public description are selected, original three-page Print Sheet is generated with GM marker exclusions, and selecting merchant clears previous NPC sensitive data.
4. **T26-S01:** GM clicks `Open Profile` then `Let me browse your wares.`; actual existing `MerchantPanel` renders stock in `MerchantStorefrontView`, including item/price. NPC GM secret absent.
5. **T26-S02:** `Return to Profile` restores authorized merchant Profile and fully unmounts store stock/selected item.
6. **T26-R01:** Real merchant Stage1 PostgREST response is deliberately held, user selects a different NPC, held response is released; prior merchant cannot overwrite the current selection or inject private content.
7. **T26-R02:** GM signs out with real shop open; the storefront/stock and prior selected Profile are removed under the actor transition.
8. **T26-S03:** Signed outsider with **no Sheet permission** can open authorized public merchant Profile and shop stock without GM/previous account secrets.
9. **T26-C05–C06:** GM→outsider isolation and genuine editor permission revocation with explicit Refresh continue denying privileged sheet/print. No offsite Supabase calls, uncaught page exceptions or leftover disposable Next route.

## What remains unverified / do not merge as a release

- **Production still uses unchanged shared `NpcPanel` and `CharacterInteractionPanel`**, with legacy readers serving the protected world map and town. T26's Profile adapter is a *new scratch integration surface*, not a source-semantic replacement for every original Profile feature (sheet, inventory transfer, portraits, lore reveal, GM controls, original global dialogs). No world-map or town changes allowed without owner scope review.
- The **real MerchantPanel UI is executed**, but the test uses a minimal synthetic authenticated stock table and **does not execute a purchase** or prove live `buy_from_merchant`, player wallet, movement/travel or admin restock/merchant tools.
- Delayed *selected Stage1* RPC and GM logout with open shop are proven. A deliberately delayed `character_stock` response after logout is **not** independently covered.
- Only synthetic PDF marker exclusions are proven, not generalized nested legacy sheet redaction.
- Original #345 Stage1/2/3 hosted SQL is not installed under its new NPC reader names; coordinating all active reader/consumer migrations is a hard prerequisite before enforcing role-wide column REVOKE.
- Unchanged release blockers: 22 of 34 legacy Option A writer paths unverified, original 29 of 31 non-map Forge DDL with two map triggers deliberately excluded, original Spell Engine/combat-lock PR inheritance and complete per-feature source dispositions, independent encrypted PG17 backup/restore + all **340 Storage objects restored byte-for-byte**, full mounted role/shop/Sheet/Inventory/print tests, paired SQL/frontend rollback strategy and explicit owner go/no-go.
- No main merge, hosted Supabase SQL/RLS/Storage writes, world map/route mutation, Vercel deployment, PR/branch retirement, or paid agent enablement.

## One next bounded task (T27 proposal)

**Source-by-source paired release dependency/consumer audit for original #345 secure Profile under current world-map/town/manager contracts**, classifying every legacy private reader, actual shop/stock/wallet authority and original consumer without patching the protected world map or installing hosted Stage1–3 SQL. Produce an exact-path compatibility/rollback matrix and a separate scratch authenticated negative test for delayed merchant stock response across signout if feasible. Only after that assess a scoped, owner-approved mounted non-map release.

# C34 T20 — source-original #345 Chromium + actual Next town/inventory + official PDF visual, signed joint 29/31 fixture

**2026-11-14. Research only. Status: exact-head 7/7 CI SUCCESS; production and UI release HOLD.** Draft [PR #379](https://github.com/bob8675309/DNDNEXT/pull/379), exact **tested executable SHA `427134ab659d09f2e0b0880dc4f02b28278c993c`**. [Genuine PostgreSQL 17 + GoTrue + PostgREST + Chromium + Next browser + PDF visual Actions run #43629241575](https://github.com/bob8675309/DNDNEXT/actions/runs/43629241575) SUCCESS, 0 errors; six other same-head preservation/CI workflows also SUCCESS.

## Evidence meaning: historical app tested, NOT current integrated app

T19's original held #345 stage1–3 NPC privacy SQL, immutable creator and #324/#351 nonce, source-only inventory RLS and **29/31 original non-map deferred Forge DDL** were first loaded and tested with genuine signed GoTrue identities in **one disposable PG17 database**. All inherited I1C + T1–T19 original RED/GREEN/negative cases passed again.

Only then did C34 check out the immutable held #345 Git commit **`4f5f8ff7587aff1a68f21581ad68a4752789f54a`** into a **second CI working directory** (`held345/`). No files were copied over the active #379 Next application, and no Vercel, hosted Supabase, Storage, production URL or world-map behavior was changed. The original React components and the historical Next.js Pages Router were run from that pinned historical app tree with test-only local environment variables and Chromium.

The four missing Profile/Story/CSS assets remain byte-identical and inactive under `scripts/integration/c34/preserved/held345/`: `GlobalNpcProfileOverlay.js`, `npcProfileOverlay.js`, `CreatorBackstoryPanel.js`, and `npc-profile-centered.css`. Original browser scripts were likewise separately archived **without modification**:
- `verify_c33_creator_backstory_dom.mjs`: Git blob `7b3a813d11d4b9e0fcd1ba8aef9d4e8463f58aa4`.
- `verify_c33_next_town_route.mjs`: Git blob `d19b134fdb4e4b58833fe339f918c027959eae02`.
- `verify_c33_npc_pdf_visual.mjs`: Git blob `1ee0f29a5c017906f2029eff25a9b1c1b88c5760`.

All seven original component/browser source pins are asserted against the detached #345 checkout before use. The preserved source archive copies are not imported by active pages or build tooling.

## Signed real Chromium and full Next.js results

| Original held #345 case | Result verified from run #43629241575 |
|---|---|
| **C3B00–07** | Original CreatorBackstoryPanel with signed actual creator, co-editor, inventory-only, GM, outsider, anon; creator and GM edit private Story via RLS; unauthorized UI does not mount; character switch, logout, offsite-request and browser error negatives PASS |
| **C3P00–06** | Original NpcPanel exposes approved public lore but never legacy GM secret/sheet; outsider and inventory-only Sheet/Print denied; signed co-editor sees authorized canonical Sheet and prints genuine browser **three-page official PDF**; signed GM dossier survives only for signed GM; no secret after logout |
| **C3T00–05** | **Actual original Next.js Pages Router**, genuine merchant roster read; Bazaar/market Browse Wares starts Profile, never direct Shop; Shop → Profile and Close; signed GM dossier; signout removes private dialog and Admin tools |
| **C3I00–05** | Actual Next inventory route and original global Profile overlay; outsider/inventory-only access boundary; co-editor can Sheet/Print but not GM narrative; GM merchant dossier; signed logout closes privileged overlay and Admin inventory browser |
| **T19 + T1–T18** | Earlier original signed authority, progression, nonce, privacy, Warlock, Artificer, Wizard, fighter, inventory and all source custody/negative evidence rerun before browser, no regressions |

All tested browser requests were restricted to localhost App and local GoTrue/PostgREST. Tests used only seeded synthetic NPC, merchant, and player identities. **No external offsite browser data requests** were accepted.

### Original official PDF visual QA

The unchanged source-original `scripts/browser/verify_c33_npc_pdf_visual.mjs` ran on the same historical checkout after browser success. All **three official three-page PDFs** passed source content checks using Poppler `pdftotext`: `public-standard`, `gm-standard`, `public-dense`. The GM sheet retains only its explicitly authorized synthetic GM marker, public sheets omit that marker and any GM-only Secret label. Dense features and spells render overflow disclosures instead of silent truncation. Actual `pdftoppm` rasterization yielded **five JPEG previews**: public page 2, GM page 2 and dense pages 1–3. This is automated raster/content validation, **not manual pixel-level visual approval**.

**Evidence artifact** `c34-t20-held345-synthetic-pdf-page-previews`, GitHub Actions artifact ID `14127327293`, created 2026-11-14 in [run 43629241575](https://github.com/bob8675309/DNDNEXT/actions/runs/43629241575). Contains only synthetic PDFs and JPEGs; seven-day retention. User can inspect/download it from the run's Artifacts section. No generated user-data PDF is checked into the repo.

## Failure history preserved; explicitly scoped scratch-only compatibility

1. First T20 signed attempt on `d4e60ba38198c29a28d2443f224830a94603ae2b` [run #43627229626](https://github.com/bob8675309/DNDNEXT/actions/runs/43627229626) passed T1–T19, source SHA checks and browser tooling, then failed *before Chromium* because the old #345 example Fighter starting-equipment intent omitted a Background ID required by the newer original T5 deferred Forge source authority. **Did not weaken the validator.**
2. C34-only source adapter in `t20_adapt_held345_browser_fixture.mjs` now pins the original #345 browser script and changes **only its synthetic Fighter input** within the throwaway checkout to the already T19-source-verified XPHB Soldier + Lucky + Defense choice/summary + matching background package ID. Every original browser permission/assertion, React component, SQL function and RPC is unchanged. Static positive/negative test checks exact original Git blob and forbids mutation or repeated adaptation.
3. Browser complete GREEN at `cebee4dc1a0ddfb60f87e71e01fae3e72ef52848`, [run #43628031250](https://github.com/bob8675309/DNDNEXT/actions/runs/43628031250) PASS. When extending PDF test, run #43628645933 at `af2a71069542d6b89a0f63cb6bcc037349457650` failed because original #345 Next browser used a **fixed localhost TCP port 41820 already occupied on that runner**. C3B/C3P and prior signed suite were green. No browser assertion failed; original Next server could not bind.
4. Separate C34 transport-only adapter selects an available 127.0.0.1 port in CI and replaces only the original historical town test's two hardcoded localhost port literals in its throwaway checkout. Exact original town browser source is pinned; additional positive/negative static tests reject tamper, unexpected original source or invalid port. **The actual Next routes, assertions, auth, RLS, permissions, logout, app code and world map are not modified.** Final signed C3B/C3P/C3T/C3I + PDF all PASS at SHA above.

No original #345 branch or PR was modified, merged or closed. Neither adapter belongs in production app or releases.

## Release gates NOT satisfied

**Current #379 running app is still pre-cutover.** This test ran the historical #345 application from a second checkout, not the live current main/held #379 app with its newer frontend/Forge/merchant/map differences. Original stage1–3 privacy SQL and original 29/31 deferred DDL exist **only in disposable CI**, not deployed by T20. The current `components/NpcPanel.js` pre-cutover direct character/legacy secret access must be replaced in a coordinated source-safe cutover before restoring the global overlay. Original #345 global centered CSS includes **owner-protected world-map selectors**, so no map/offcanvas styles may be imported without explicit discussion.

**Other HOLDS:** no comprehensive actual 2024 XPHB class/spell/equipment catalogs or live auth entitlement parity; 22 of 34 historical legacy account sheet writers still unverified; independent all-file preservation/consumer dispositions for 44 open and 80 known closed-but-unmerged PRs not complete; 2 protected world-map triggers excluded; no independent encrypted full PostgreSQL 17 backup **plus all 340 Storage object bytes restored and tested**; no production paired migration/Next rollout or rollback rehearsal; no owner release go/no-go. Original #345 27-check evidence on its own held head and this C34 T20 integrated research are **different proofs**.

## ONE NEXT BOUNDED TASK

Perform source/consumer-level **current-app integration design** for held #345's allowlisted `NpcPanel`, `CreatorBackstoryPanel`, `GlobalNpcProfileOverlay`, admin/creator Forge, town and inventory/print against current main/#379, listing every conflicting component and its behavior/role tests. Then stage a **small isolated non-map candidate** only after source/permission parity, maintaining browser RED/GREEN and rollback; do **NOT** wholesale copy the older held 16 runtime files, alter `MapPageClient.js`, enable centered map CSS, merge to main, touch production, or close historical PRs without explicit owner authorization. Any actual app UI port must get its own fresh genuine Next/Chromium signed test on the **current integrated app**, not be inferred from T20's historical checkout.

# C34 T22 — current Next.js Pages Router isolated secure NPC Profile UI: genuine signed Chromium PASS

**2026-11-14, RELEASE HOLD.** [Draft PR #379](https://github.com/bob8675309/DNDNEXT/pull/379), executable SHA **`90e0ba62508ba900028faf9b42e2c942af72dc06`**, exact-head **7/7 CI workflows SUCCESS**, including [genuine local PG17 + GoTrue + PostgREST + original #345 + current #379 Next.js/Chromium run #43636889132](https://github.com/bob8675309/DNDNEXT/actions/runs/43636889132). Original C34 I1C/T1–T21 RED/GREEN and T20 genuine held #345 Next town/inventory/Print/PDF tests ran and passed **before** T22 in the same disposable DB. No hosted Supabase, Storage, Vercel, `main`, map UI, PR close/merge/delete, paid agent or active page source changes.

## Objective and actual code scope

The user-directed next step was to make the **current application's first non-map research NPC Profile UI** consume the signed T21 reader and prove it in a **real current-#379 Next.js Pages Router**, not just the historical #345 checkout. The historical global overlay and shared `NpcPanel.js` remain preserved, with no premature runtime cutover. This is not an assertion that the production app now displays the new UI.

**Added:**

- `components/c34/NonMapNpcProfileResearchShell.jsx` — **NON-ORIGINAL, intentionally UNMOUNTED** React/Bootstrap candidate. Takes caller-supplied genuine client, character ID and authorized Print callback; consumes only the original P1.3 stage1/2/3 via `utils/c34/readNonMapNpcProfileCandidate.mjs`. Public name/description/revealed lore, separately gated GM dossier, editor-authorized canonical Sheet callback, original-creator/GM private Story edit through source-original RLS, and merchant research **Profile → placeholder Shop → Profile**. Invalidates async requests, clears cached privileged data on signout/account switch/character change, never falls back to legacy `characters`/secret loader and never edits the protected map.
- `scripts/integration/c34/fixtures/t22_nonmap_next_probe_page.jsx` — a Pages Router fixture held under **scripts/**, **not** a committed `pages/` route.
- `scripts/integration/c34/test_t22_current_next_browser.mjs` — a CI-only runner. Refuses non-local environment, creates six genuine local GoTrue JWT actors plus three synthetic original-authority characters, temporarily copies the fixture into **untracked** `pages/__c34_t22_probe.jsx`, starts **current #379 Next.js 16** using the existing original `pages/_app.js`, injects *locally installed* Bootstrap CSS and runs Chromium with hosted Supabase requests blocked. It terminates Next and **deletes the temporary route in a finally block**, including failures.
- `scripts/integration/c34/test_source_contract.mjs` — appended source S01/N01/N02 enforcing signed reader usage, no shared map/NPC manager/Town/Inventory/`_app` imports, no production route, localhost-only and mandatory scratch cleanup.
- `.github/workflows/validate-c34-joint-local-auth.yml` — T22 runner after T20 and before existing disposable cleanup; added `components/c34/**`, `utils/c34/**` path triggers so future research-shell/reader edits cannot silently bypass signed tests. Original acceptance tests and source SQL retained.

Source safety: Bootstrap+SCSS application style only, no Tailwind additions, no global centered map CSS import, no active page/controller integration. The underlying source-original P1.3 SQL remains **only in disposable PG17**, unchanged and Git-blob-pinned. The 29/31 original non-map DDL and the 2 owner-protected uninstalled world-map originals retain their prior disposition.

## Exact T22 browser and signed evidence

Original tests **T1–T21 all passed**; held #345 genuine Chromium/Next town/merchant/inventory and actual three-page PDF render/Poppler synthetic visual QA were also green. In **the current Next.js 16 app** (not the held #345 source tree), signed local users performed:

| Actual green checkpoint | Meaning |
|---|---|
| **T22-SEED** | Signed GM, original source-qualified Fighter creator/private Story, co-editor, inventory-only, conversion-only and outsider; separate original DML/nonce/author and canonical sheet |
| **T22-NEXT** | Current research-head Next.js Pages Router compiled scratch Profile page using **unchanged current `_app.js`**; only synthetic route temporarily generated |
| **B01** | Anonymous viewer denied private Profile, Sheet, GM Secret and private Story |
| **B02** | Authenticated outsider sees allowlisted public Profile and explicitly revealed background; adversarial legacy `profileReveal.secret` does **not** expose GM secret |
| **B03** | Non-GM `can_edit` co-editor can click **authorized Sheet/Print callback**, never read GM dossier; no official PDF generation claimed in THIS callback |
| **B04** | Inventory-only and conversion-only cannot print or view GM/private data |
| **B05** | Original creator edits private Story in a **real current-app React textarea**, authentic PostgREST RLS upsert changes only `character_backstory_secrets.secret_text`, not GM-only `characters.secret` |
| **B06** | Signed-out session synchronously removes private content; unrelated co-editor sees canonical Sheet but not original creator's Story |
| **B07** | GM separately reads dossier and creator Story, with prior NPC's GM content wiped on character switch |
| **B08** | Merchant **Profile → local placeholder Shop → Profile** behaves as a navigation shell; **not a live merchant storefront test or backend stock migration** |
| **B09** | Final logout removes privileged content; browser has zero uncaught page errors and no offsite Supabase requests |

All nine B01–B09 PASS lines are in the [exact signed job log #43636889132](https://github.com/bob8675309/DNDNEXT/actions/runs/43636889132); all seven unique exact-head workflow conclusions SUCCESS. The T22 original browser had **no mock RPCs or role claims**: authentications were genuine local GoTrue/PostgREST and permissions were enforced by original, unchanged P1.3 SQL. The test Print receipt is a nonsecret marker only; the *real* official three-page PDF and synthetic Public/GM/Dense previews remain covered by the separate already-green original **T20** evidence. Poppler emitted warnings repairing an existing synthetic PDF XRef, but prior original PDF content/page assertions still PASS; these are **not** proof that every printed character sheet is visually acceptable.

## Release boundary and unresolved work

The current real `components/NpcPanel.js`, `components/character/CharacterInteractionPanel.js`, `pages/npcs.js`, `pages/inventory.js`, `pages/town/[id].js`, `pages/_app.js` and `components/MapPageClient.js` were **not modified**. The original NPC manager still bulk-selects GM narrative and legacy secrets; the shared NpcPanel still uses raw character lore and legacy secret-loading. **Do not import or activate T22 until these server ACL/reader/UI consumers are migrated as a coherent feature**, and do not touch protected map at all without separate explicit owner permission. In the full live app, CSS and merchant storefront/Print are distinct integration responsibilities; T22 placeholder is **not** equivalent to original #345 functional source.

Outstanding: 22/34 original account legacy writers unverified under Option A canonical per-character `character_sheets`; exact source/XPHB and full Forge/Warlock/gear catalog parity; 2 protected original world-map rest/camp triggers deliberately absent from 29/31 local DDL; all historical 44 open plus 80 closed-but-unmerged PR feature dispositions; full site-role browser/Print/performance acceptance on the *eventual mounted* current app; secure stage1–3 migration/rollback and policy preflight; independently restored encrypted PostgreSQL 17 backup **plus all 340 actual Supabase Storage object bytes**; explicit owner release go/no-go. No original PR closed; no branches deleted; no production change or main merge.

**ONE NEXT BOUNDED TASK:** read-only, then scoped patch proposal for migrating **non-map `pages/npcs.js` GM manager roster + selected dossier/editor narrative** to original #345 stage2 API without replacing shared map-connected `NpcPanel.js`. Preserve original body, role/session negative tests, map/town boundaries, non-GM Sheet/creator Story separation. On the draft only, add genuine current Next browser tests for the manager under disposable SQL **before** even a non-map activation; all active UI changes remain held behind separate owner go/no-go. Do not automatically promote the research shell into live routes.

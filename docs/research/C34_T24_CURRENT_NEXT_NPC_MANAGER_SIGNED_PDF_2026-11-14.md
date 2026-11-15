# C34 T24 — current Next.js non-map NPC/merchant manager candidate: true signed Chromium/PG17/PDF PASS

**Verified 2026-11-14 (UTC run 2026-11-15). RELEASE HOLD.** Existing draft [PR #379](https://github.com/bob8675309/DNDNEXT/pull/379), exact tested **code HEAD `4a485fd8c71147fab11b4bfea28fc8d137488697`**, **7/7 distinct GitHub workflows SUCCESS**, including the [signed PG17/GoTrue/PostgREST + current-Next Chromium/PDF run #43662577887](https://github.com/bob8675309/DNDNEXT/actions/runs/43662577887). All prior T1–T23 tests, original held #345 Next/town/inventory/true PDF tests, and new T24 cases pass on the *same disposable local database fixture*. This is NOT production or mounted-site acceptance.

## Task and original boundaries

T22 proved an isolated selected Profile shell; T23 source-reviewed current `pages/npcs.js` and built unmounted public roster and selection-identity helpers. T24 now verifies **a separate unmounted non-map manager probe in the actual current Next.js 16 Pages Router**. It uses the real `pages/_app.js`, original source-exact stage1/2/3 privacy SQL on disposable PG17, genuine GoTrue JWT accounts and original `buildPrintableCharacterSheetModel` + `buildOfficialCharacterSheetPdf` (not a callback receipt).

The active `pages/npcs.js`, `pages/_app.js`, `components/MapPageClient.js`, `components/NpcPanel.js`, town route, inventory route, Supabase hosted SQL/RLS/Storage, Vercel and `main` are **unchanged**. Their protected Git blob hashes are tested at HEAD:

- `pages/npcs.js`: `7fc00b9b3ace6233d1648a3d017f8a05e072d722`
- `pages/_app.js`: `e5f68c0abb293089d6ad09d4e3e4035612eac598`
- `components/MapPageClient.js`: `61f8738da2ca3d8635b5a413bfdc18c094228a0a`

## Files added/changed in T24

- **New** `components/c34/NonMapNpcManagerResearchShell.jsx`: unmounted Bootstrap research manager, selects basic public NPC + merchant roster fields, calls only original server-authorized T21 reader for selected private Profile/GM/editor; actor AND character-bound T23 display guards; synchronous in-memory cleanup at account and selected-character changes; user-triggered permission refresh; safe public PDF action and separate GM-only PDF action. A test owner callback wipes generated PDF bytes on selection/permission/auth changes.
- **New** `scripts/integration/c34/fixtures/t24_nonmap_manager_next_probe_page.jsx`: CI-only temporary Next.js page source under scripts, original current PDF model/generator and selected-sheet authorization. **No checked-in pages route.**
- **New** `scripts/integration/c34/test_t24_current_next_manager_browser.mjs`: local env/connection guards, six genuine signed test identities and synthetic records, creates temporary `pages/__c34_t24_probe.jsx`, untracks/removes it in `finally`, validates real three-page PDF bytes with pdf-lib and `pdftotext`, role/grant/race browser tests.
- **New** `scripts/integration/c34/test_t24_source_contract.mjs`: four source/release-hold tests, pins active NPC/app/map Git hashes and ensures no active importer, localhost-only env and PDF validation.
- **Updated** existing `.github/workflows/validate-c34-joint-local-auth.yml`: run T24 static source tests at preflight and real signed T24 browser after T22 on same disposable local original SQL, without weakening/removing earlier tests.

T23's separate source helper/tests and T21/T22 reader/shell remain unchanged; all original held PRs/branches preserved.

## Signed actual browser cases, not mocks

| Check | Observed result at #43662577887 |
|---|---|
| B01 | Anonymous denied Profile, GM dossier and PDF |
| B02 | Signed outsider only public NPC Profile, no private narrative/GM dossier |
| B03 | Real non-GM coeditor prints **actual three-page current-app PDF**; no GM Secret, creator private Story, or private sheet test marker |
| B04 | Inventory-only and convert-only denied print/GM dossier; no previous account PDF bytes |
| B05 | Original permission row `can_edit` revoked in local PG17 mid-session; clicking **Refresh permissions** removes editor narrative, Print and the previously generated PDF bytes |
| B06 | Signed GM reads separate authorized dossier; **both** public PDF (no GM Secret) and explicitly GM-privileged PDF (contains original GM Secret) render as real three-page artifacts |
| B07 | GM clicks **real manager roster merchant button**; Profile-first merchant state, prior NPC GM dossier and PDF bytes wiped; actual storefront is deliberately not mounted |
| B08 | Network interception holds one genuine signed `get_npc_profile_visible_v1` request while selecting another character; late old response cannot replace current merchant |
| B09 | GM→outsider transition and final signout clear privileged material; no uncaught browser errors or hosted Supabase connections |

A prior T24 run [#43662435392](https://github.com/bob8675309/DNDNEXT/actions/runs/43662435392) also passed B01–B09 before the final roster-button selection/owner-sync enhancement. An earlier run failed on a temporary fixture path typo *before launching T24*; this was corrected before both fully-green runs and was not a data-integrity or application failure.

### Exact limitations: HOLD

- Research shell is **NOT** the actual mounted `pages/npcs.js` manager and is not a replacement for the complete original manager, including edits, sheet operations, notes, inventory, Admin actions, character focus deep-link, portrait/map hooks and existing merchant storefront.
- The current shared `NpcPanel.js` has private/raw legacy readers and also serves protected world-map consumers. **No wholesale replacement or map CSS import.** Stage2 SELECT-column REVOKE across authenticated users would break active routes if applied without coordinated migration.
- Revocation is proven **after an explicit Refresh permissions action**, not automatically before refresh. No claim of subscription-based instant role revocation.
- Original canonical sheet may contain arbitrary inherited legacy fields; T24 checks named secret/private markers in the PDF, not a universal proof of semantically safe rendering of all possible sheet JSON.
- Original 29/31 non-map trigger DDL tested locally; both remaining original map movement/rest/camping triggers excluded by owner direction.
- 22/34 original account-scoped legacy `players.sheet` writer pathways remain unverified under Option A per-character authority.
- Full original class/species/Warlock/Spell Engine/command locks/TC1 catalog and mounted-site role/inventory/merchant/Print regressions remain open, along with 44 open and 80 closed-unmerged PR source-consumer dispositions.
- Independent **encrypted** full PostgreSQL 17 backup **and all 340 Supabase Storage object bytes restored** with rollback proof remains mandatory before production-changing SQL; owner go/no-go separately required.
- No main merge, hosted SQL/Storage/Vercel edits, map changes, branch deletion, PR closing or paid agent invocation.

## NEXT ONE bounded engineering task

**T25 research-only exact-source manager cutover preparation:** compare **every active `pages/npcs.js` consumer** to held original #345 and T21/T23 secure interfaces, then build an isolated *derived current manager* scratch-route patch that removes NPC AND merchant bulk secret/narrative readers, binds selected permission to signed actor plus selected character, and handles private narrative/PDF/stale requests without touching checked-in active routes. Keep original selection timeout, inventory, notes, portrait, merchant links, `/npcs?focus=` and Admin notification contracts; run real current-app signed role tests/negative/print and genuine legacy behavior checks before proposing any mounted route. Do not deploy stage2 SQL or mount shared map panel without separately agreed owner scope.

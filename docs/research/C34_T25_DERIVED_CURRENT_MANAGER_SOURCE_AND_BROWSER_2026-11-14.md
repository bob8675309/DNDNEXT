# C34 T25 — actual current NPC manager source-locked scratch cutover (RESEARCH HOLD)

**Date:** 2026-11-14 America/Chicago (CI UTC November 15). **PR:** [#379](https://github.com/bob8675309/DNDNEXT/pull/379). **Main is NOT changed.** This report distinguishes executed source tests, in-progress signed browser work, and production release blockers.

## Source identity and implementation

- Current production `pages/npcs.js` original Git blob: `7fc00b9b3ace6233d1648a3d017f8a05e072d722`. Original held #345 version: `2e08fa07384958478f323516c4e1b342228bd436`.
- `scripts/integration/c34/derive_t25_current_npc_manager.mjs` reads the *real current page* and requires its exact Git blob. It fails closed if the source drifts; `--verify` creates no route. `--write` writes only the previously nonexistent, disposable `pages/__c34_t25_probe.jsx`; the signed runner owns automatic cleanup.
- Safe T23 public field projection replaces `loadNpcs` and `loadMerchantProfiles` direct `background/motivation/quirk/mannerism/voice` SELECT and `loadCharacterSecrets` for **every** NPC or merchant. No public roster includes GM secret.
- **Additional discovered privacy consumer:** original page preloaded `select("character_id,sheet")` from `character_sheets` on mount. Derived page removes this all-character cache; selected reads use the T21 source-authenticated safe reader and isolated original Stage1/Stage2/Stage3 RPCs.
- Selected grant now binds `user_id` and `character_id`. On account or selection change, immediately invalidate authorization-sensitive memory and request IDs; authenticated selected reader verifies the actor again before accepting private results.
- Preserve source-controlled notes, equipment, portrait/sprite selectors, NPC creation/deletion, sheet editor, location assignment, roster filters, `/npcs?focus=` deep links, profile and merchant entry points and original official Print Sheet generator. A source-preservation test checks key entry points rather than claiming that syntactic presence establishes full behavioral parity.
- Details and draft only receive selected, server-authorized lore. Ordinary public printProfile is stripped of secret/editor-only narrative; printNotes are filtered to visible notes. Editor save cannot change the GM secret. `CharacterSheetPanel`, raw JSON and Print Sheet are inaccessible without server-authorized `canPrint`; inventory-only grant retains explicit inventory navigation. Explicit **Refresh permissions** clears sheet/private state before reauthorization.
- Original `pages/npcs.js`, `pages/_app.js`, `components/MapPageClient.js`, shared map-connected `NpcPanel.js`, town, inventory, hosted SQL/RLS, Storage, Vercel and `main` remain unchanged.

## Tests and evidence classification

- `scripts/integration/c34/test_t25_current_manager_source.mjs`: six no-network/exact-blob, negative, preservation and private-guard tests. CI `C34 exact-source integration research` [run #43674953205](https://github.com/bob8675309/DNDNEXT/actions/runs/43674953205) **PASS** on its specific earlier T25 patch head. Newer commits and all tests must be re-verified at the final exact HEAD.
- `.github/workflows/validate-c34-joint-source-research.yml` invokes the derivative and all six static tests with no SQL or deployment.
- `scripts/integration/c34/test_t25_derived_current_manager_browser.mjs` is a new local-only **genuine current Next.js/Chromium/PG17/GoTrue/PostgREST** harness. It seeds synthetic GM/editor/inventory/outsider and NPC/merchant rows, authenticates through real GoTrue, navigates the actual derived manager with `/npcs?focus=npc:<uuid>`, checks role separation, current Print Sheet's actual **three-page PDF bytes and text**, switching NPC→merchant, logout, editor grant revoke+explicit Refresh, and blocks offsite Supabase. It removes its temporary route and PDF fixture regardless of test outcome. **Signed T25 result is PENDING in this initial report**; do not call it passed until a finished exact-head run verifies the step.
- `.github/workflows/validate-c34-joint-local-auth.yml` runs T25 only **after unchanged source-original T1–T24 and held #345 tests** against one disposable local PG17 fixture. The historical T24 green cases are not evidence that the new derived manager passes.

## Unresolved, without overclaiming

1. Research-only source transformation is NOT the mounted live `pages/npcs.js`. Never import it from a production route or mark it deployed based on a CI probe.
2. Current shared `NpcPanel.js` still serves world-map consumers and may use legacy raw readers. Stage2 column REVOKE would break active routes until all consumers are coordinated; **no live Stage1–3 SQL applied**.
3. The original current manager's Profile/merchant shop, NPC sheets, Admin notices, inventory, portrait and all deep-link cases still require full original source-based signed role/browser parity. Static presence and first smoke do not establish this.
4. Mid-session revocation is proven only after explicit Refresh; no claim of instant subscription-based role invalidation.
5. Public PDF safety is tested against known synthetic markers, not arbitrary legacy sheet content. Creator-private Story and every nested sheet field require an allowlist/negative test before release.
6. Original 29/31 non-map Forge trigger DDL, two protected map triggers excluded; 22/34 Option A legacy account-scoped writer paths unverified; full original #309/#312 spell engine and #317 tactical lock integration and all original 44-open/80-unmerged PR feature dispositions remain held.
7. Independent encrypted PostgreSQL restore and **all 340 storage object bytes** restored with rollback proof, paired SQL/real-app deploy, full mounted role/shop/browser acceptance and owner go/no-go are mandatory.
8. No main merge, production database operation, world-map modification, PR retirement, branch deletion, Vercel deployment or paid agent activation in T25.

## ONE next bounded engineering task

**Close T25 with actual final-head CI evidence**, repair any signed derived-current-manager failure without weakening earlier negatives, then extend the same scratch test to original manager's real merchant storefront and actor/character in-flight response race before considering any active route. Maintain strict release HOLD and source-preservation protocol.

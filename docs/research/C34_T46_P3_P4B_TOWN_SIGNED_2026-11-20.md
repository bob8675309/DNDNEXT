# C34 T46-P3-P4B-A/B — Signed town presence contract and real Bazaar Profile-first browser

**2026-11-20 America/Chicago. Research accepted for the enumerated signed local tests; production release HOLD.**

Existing draft [PR #379](https://github.com/bob8675309/DNDNEXT/pull/379), research branch `research/c34-clean-main-privacy-forge-joint-source-20261112`. `main` verified at `bb3939eeb9a38cf416996a1dca3b196b156b2915`; no source gameplay, protected MapPageClient, deployed town, Supabase host, or Vercel deployment changed.

## Exact executable receipts

| Gate | Exact signed executable commit and CI | Observed |
|---|---|---|
| P4B-A original town raw-column negative → signed projection | `3204d52d872d9cdc2ba6ab8f1e684dfe5e0c8781`, [#44798422610](https://github.com/bob8675309/DNDNEXT/actions/runs/44798422610), job `136503926460`, **SUCCESS** | Original current `pages/town/[id].js` roster and merchant `characters.select` queries fail with `42501` against source-original held #345 Stage2 column restrictions **in the disposable local source contract**. The research `c34_t46_get_town_presence_v1(bigint)` returns signed town-local roster, current merchants and home-town resident merchants without canonical Sheet, raw GM Secret, XP/event; `admin/gm/dm` source roles and public roles pass; hidden players/merchants suppressed, anonymous denied, and same-JWT demotion reflected. Do not widen raw grants |
| P4B-B actual current town and Bazaar browser | `6400dfedf75cc4df58fd5c07c059b4ab47bc73c1`, [#44800044778](https://github.com/bob8675309/DNDNEXT/actions/runs/44800044778), job `136509513903`, **SUCCESS** | Temporary overlay on exact original Next `pages/town/[id].js` displays signed outsider's **real TownSheet/Bazaar** for a disposable location; present merchant and home-town traveling resident both visible; hidden character suppressed; browser observed server `c34_t46_get_town_presence_v1` request and **no direct `characters` roster read**. Actual Bazaar **Browse Wares → held original #345 NPC Profile → Shop through Talk → Return to Profile** passed. No private GM Story in the player's view. Local P4B flag enabled; existing T28/T33 OFF |
| P4B-A initial harness RED | `2afd7ff9c125c0890f9bbb763aa4e5536f618392`, [#44797968847](https://github.com/bob8675309/DNDNEXT/actions/runs/44797968847); next initial run [#44798061478](https://github.com/bob8675309/DNDNEXT/actions/runs/44798061478) **failure** | A test-only default-off env value compared to literal `"undefined"`; then `gitBlob` received a string rather than Buffer. Corrected in `ebea9a0` and `3204d52`. Do not classify these as original app defects. Earlier RED privacy tests remain preserved |

## Original exact-source custody

- Source current `pages/town/[id].js` Git blob `c66508b798645e189bb900e63bc17b85b8662e10` — **unchanged**.
- Original `components/TownSheet.js` `5399097e48f548956807cd93476fefe03e4dee28`; existing Bazaar resident versus present lists and original source `onOpenShop(merchant, "shop")` retained.
- Original `components/NpcPanel.js` `e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db`, `CharacterSheetPanel.js` `cb3511bf25a97be3a07c6e5d93ee62bb16570327`, `MerchantPanel.js` `22e4d0810603bc0322904573cb5fe0c14bad1f88`.
- Held exact original PR #345 `NpcPanel.js` `606db96649dcdf6646afbd4d24f67a6fc54426eb` and `CreatorBackstoryPanel.js` `23b0e86aab7a80b7243365ba107c1d37a5ec5812` are only temporarily copied into local CI checkouts, not merged.
- Protected `components/MapPageClient.js` `61f8738da2ca3d8635b5a413bfdc18c094228a0a` untouched, both protected world-map Forge triggers untouched.

## Committed changes — research only

`scripts/integration/c34/candidates/t46_p3_p4b_town_presence_pg17.sql` contains the **unapplied** town-scoped `SECURITY DEFINER` projection. Authenticated `auth.uid()` is required; Supabase anonymous identities excluded by JWT `is_anonymous`; server checks hidden/GM against source-derived role; both role and policy must be revalidated before any hosted migration. It deliberately returns `roster`, `presentMerchants`, and `residentMerchants` with published Stage3 public Profile fields plus explicit town/Bazaar metadata. No Sheet or XP joins.

`scripts/integration/c34/candidates/t46_p3_p4b_b_town_overlay.mjs` is an **unmounted** pure source-derived transformation. It introduces an independent `NEXT_PUBLIC_C34_T46_P4B_TOWN_PRESENCE=1` flag **default OFF**; the original raw readers, T28/T33 guards, Bazaar, and original all-flags-off behavior remain present when absent. Under the opt-in only, it reads server-scoped presence and server GM identity; uses the same existing TownSheet; makes the Bazaar's `shop` entry **Profile-first**; and adds a focus/12-second signed revalidation candidate. It does **not** provide server-push instantaneous revocation.

Test files: `scripts/integration/c34/test_t46_p3_p4b_a_town_source_presence_signed.mjs`, `scripts/integration/c34/test_t46_p3_p4b_b_real_town_browser_signed.mjs` and their matching `.github/workflows/validate-c34-t46-p3-p4b-a-town-source-presence.yml` and `.github/workflows/validate-c34-t46-p3-p4b-b-real-town-browser.yml`. B's test only temporarily overwrites the exact original town/NpcPanel/Sheet/MerchantPanel in disposable CI, creates a temporary original #345 Creator plus signed login route, then restores byte-exact originals and removes both temporary files in `finally`. No hosted database access or changes.

## Important remaining failures and NOT-accepted scope

- The candidate's new `town` server Profile projection is **research**. Some legacy merchant background/stock/portrait and crafter metadata consumers may require a separate field-by-field scope review. The reduced PG17 fixture is not production schema compatibility proof. Source-original metadata `tags,state,home_location_id` may expose behavior and require explicit privacy sign-off; do not widen public SELECT grants to bypass authorization.
- The P4B-B real browser tested an **outsider** and the Profile-first merchant path only; P4B-A tested **server-side** same-JWT GM demotion/hidden changes. **B did not browser-test** town post-revocation cache scrubbing, `admin/gm/dm` elevated UI parity, editor/inventory-only/hidden interactions, Town T28/T33 individually, player class/features/spells, stock purchase, wallet, transfer, NPC creation/deletion, creator Story editing or trusted dice/dialogue event provenance. Do not infer those from P4A or server tests.
- T28 and T33 flags remain **default OFF** and were **both OFF in the B browser**; only the temporary P4B research flag was ON. `pages/town/[id].js` and `TownSheet` actual source unchanged in Git.
- Supabase's new documented guidance treats `auth.role()` as deprecated and `SECURITY DEFINER` exposed functions as high sensitivity. Existing original held SQL can reference `auth.role()`. Do not promote the scratch SQL without full ACL/role design review, including signed anonymous auth, EXECUTE grants, row visibility and trusted server-mediated state.
- Focus/12-second revalidation can leave an already-open private panel visible temporarily; prior PDF bytes cannot be retracted. The P4A double-check protects new Print bytes in tested cases but does not secure all exports. No current town production source uses these candidates.
- Original **22/34** account `players.sheet` writers unresolved, **29/31** nonmap Forge trigger graph plus **two separately protected map triggers**, independent encrypted PG17 restore and **all 340 Storage object bytes** verification, full inherited/source PR/consumer/permission/rollback parity and explicit owner GO/NO-GO remain required. Original held PRs must not be closed or merged incidentally.

## ONE NEXT — T46-P3-P4B-C

Signed disposable actual town browser **GM/admin/DM+player role/permission and same-JWT revocation**, including focus/12-second cache purge and signed projection after hidden-state change; test the original T28/T33 research paths separately with preserved flags, real merchant stock/buy/wallet/inventory and creator Story saving without weakening original ACL. Then review all affected source consumers, publish a safe atomic cutover/rollback proposal, and obtain explicit owner approval before any deployment or production SQL. Keep protected world map fully untouched.

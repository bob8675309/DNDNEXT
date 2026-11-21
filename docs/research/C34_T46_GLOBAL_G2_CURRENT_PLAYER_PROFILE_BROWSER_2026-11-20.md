# C34 T46-GLOBAL-G2 — Real globally mounted player Profile, signed browser (RESEARCH ONLY)

**November 20, 2026 CST. New isolated executable submitted; signed Actions result PENDING. Production release HOLD.**

## Authority and source custody
- Draft PR #379, branch research/c34-clean-main-privacy-forge-joint-source-20261112, parent 75f2acfe7338305e5db8971f1c7c1a7bb278bc38. No main change, no production SQL/Storage, no world-map alteration, no deployment, PR retirement or paid agents.
- Previous exact-SHA signed green: real current town P4B-C1 97446c710e85b056dfc88cfe844ef4a19a713d08, [#44842386219](https://github.com/bob8675309/DNDNEXT/actions/runs/44842386219); original player-character RPC G1 20876a76eed29b70cb48f882c01cd4ce6df20a67, [#44843149686](https://github.com/bob8675309/DNDNEXT/actions/runs/44843149686). Those runs do not prove G2.
- Source-original global panel SHA 8a561e51eafd9e8507db7a4d3f15fd4699d6d1b8; wrapper SHA 647615f83d931e4878cd2fd6794d54bef5f83aa1; protected world map SHA 61f8738da2ca3d8635b5a413bfdc18c094228a0a. Original held #345 Stage1/2/3 SQL unchanged and installed only in disposable PostgreSQL17.

## Actual original RED and candidate scope
- Original always-mounted PlayerCharacterProfilePanelUnified loads authorized Stage1 get_my_player_characters_v2 but ignores RPC error. On empty or unavailable result it directly SELECTs characters with background, motivation, quirk, mannerism, voice for delegated IDs, then by players.name. Held #345 Stage2 revokes those narrative columns (PostgREST 403/42501), causing original UI compatibility failure and extraneous REST requests on routes like town.
- The signed test first starts actual Next16 _app plus original global component unchanged, fault-injects only an unavailable Stage1 HTTP RPC while leaving real signed GoTrue, permission queries, and PostgREST running, and requires the original broad fallback request to fail 403/42501. That original RED is preserved, not worked around by GRANT.
- The test-only derived helper scripts/integration/c34/candidates/t46_global_g2_player_profile_overlay.mjs creates an isolated temporary source-exact global panel variant: Stage1 signed server RPC is the single authoritative character listing; missing RPC fails closed with a visible error and can be explicitly retried; zero rows never trigger direct character ID or name-based queries. Existing character selection, Creator, shared Account, account switch event hooks, profile UI and request-epoch guards remain. An added focus revalidation clears a cached profile/Sheet before server-current permission reload, skipping any in-progress Creator. Never import this helper in deployed code.
- A SECOND isolated Next/Chromium run exercises the candidate with signed EDITOR/OWNER/INVENTORY-only/CONVERT-only, outsider who shares an existing PC name and GM with no permission; RPC unavailable and retry; editor to inventory to revoked on SAME JWT with focus DOM scrub; and actual delayed 200 old-account RPC after switching to another signed user on the same mounted global component. It checks byte-identical original source restored in finally and never touches protected world map.
- This does not demonstrate instantaneous revocation across other tabs, exhaustive profile sheets or Creator parity, full Vercel deployment compatibility, all global background consumers, or hosted installation. Follow-up source-complete original-account and rollback review is required.

## New exact candidate files
- scripts/integration/c34/test_t46_global_g2_player_profile_signed_browser.mjs
- scripts/integration/c34/test_t46_global_g2_overlay_source.mjs
- scripts/integration/c34/candidates/t46_global_g2_player_profile_overlay.mjs
- .github/workflows/validate-c34-t46-global-g2-player-profile-browser.yml

Signed CI is PENDING, not accepted at authorship. Preserve any unexpected source red (HTTP, test locator, compile, workflow) as real evidence; correct only a bounded test/local overlay, and never widen private raw character SELECT or change deployed global app without release owner review.

**Remaining HARD release HOLD:** 22/34 legacy players.sheet writers, 29/31 nonmap Forge triggers + two excluded protected world-map triggers, independent encrypted PG17 restore and all 340 Storage bytes, preserved original PR contributions + all ACL/cutover/rollback + explicit owner GO/NO-GO. Separate T28/T33 flags, merchant real buy/stock/wallet/inventory, Creator private Story/GM trusted dice and dialogue also unfinished.

### First new executable status: source parse RED, research test-only correction
- Initial G2 candidate 66bf81221294a059673e997da746124e279b0516, [Actions #44849074191](https://github.com/bob8675309/DNDNEXT/actions/runs/44849074191): **FAILURE in static Node --check**, script line 203 Unexpected reserved word. Source inspection shows originalFingerprint arrow function lacked its closing brace; Node treated subsequent top-level await as non-async. Database and browser steps were not run, so NO original 42501 browser or candidate behavior was proven by that run.
- Subsequent G2 runner blob 4a77ebe87a428f21fde6a05f917541fe08d30fa9 inserts only the missing brace before PG17 assertions; all original/private/role/actor/focus/World map guards remain intact. CI result is **PENDING** until exact-source successful signed evidence. Never mark the failed run green.

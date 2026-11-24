# PR334 — Signed encounter lifecycle and wallet authorization proof (November 23, 2026)

**Research-only.** Independent audit branch: agent/forge-j168-pr334-preservation-audit-20261123. This is true signed disposable PG17/GoTrue/PostgREST evidence, NOT deployed production, complete tactical command proof, Forge acceptance, or a game release.

## Original sources and prior work examined

- Main source SHA: bb3939eeb9a38cf416996a1dca3b196b156b2915.
- Original held [#317](https://github.com/bob8675309/DNDNEXT/pull/317) head 69e741d7c7d8874c22467e2d30791e30c009ff6e, its [P1.3 activation/resume study](../P1_3_Real_Admin_Activation_Resume_Test_2026-11-01.md), [E/P lock-inversion study](../P1_3_Staging_Start_Lock_Race_2026-11-01.md), [owner TC1 decision](../TACTICAL_ENCOUNTER_OWNER_DECISIONS.md), and [original #312 preservation](../pr-integration/PR-312.md). These earlier signed/mock/PG16 results are preserved, not superseded.
- Held original Forge #334, NPC Profile/privacy #345, and live integration owner branch #379 all remain untouched. Owner November 16 application policy requires exact admin, gm, dm to share Game Master rights; player, unknown and anonymous do not. Separate character-scoped permissions do not confer GM access.
- Existing [P1.3 role and original tactical-map signed evidence](PR334_CURRENT_ROLE_SOURCE_RED_GREEN_2026-11-23.md) and [source dependency inventory](PR334_CURRENT_ROLE_CONSUMER_SOURCE_INVENTORY_2026-11-23.md) were preserved.

## Full-source fingerprints and independent candidate design

| Original main migration Git blob | Exact selected function(s) | Source-preservation method |
| --- | --- | --- |
| sql/20260727_03_live_encounter_sessions.sql — 1a985be6a3b32196cafc52d5eebaeff29a6a6c1c | Complete original schema/RLS and exact original admin_create_encounter_v1 plus admin_set_encounter_status_v1 | Runtime asserts Git blob SHA. Stub adds only missing local visual_asset_id and npc_visual_assets test schema dependencies to scratch. |
| Same original SQL file | Versioned p13_research_admin_create_encounter_v1 and p13_research_admin_set_encounter_status_v1 | Original function body extracted verbatim, with only separate versioned function name and exactly one replacement of original public.is_admin(v_uid) guard with current-actor exact-role helper. Original remains unchanged. |
| sql/20260724_01_security_hardening_roadmap.sql — d7dc873a141f25745aeb9ce29023da1f176b396d | Exact original wallet_add(uuid,numeric) SECURITY DEFINER function | Source-extracted, Git SHA verified, original REVOKE authenticated/anon and GRANT service_role preserved in disposable DB. Generic wallet browser calls remain denied. |

Original source and signed runner: [test_pr334_role_equivalence_signed_local_auth.mjs](../../scripts/integration/test_pr334_role_equivalence_signed_local_auth.mjs). All prior original helper/dossier/Story/tactical-map cases continue running before the new tests. The disposable stack pins Supabase CLI v2.120.0 intentionally; November 2026 CLI v3 is a breaking upgrade, so no unreviewed upgrade was introduced.

## Genuine signed acceptance

- [GitHub Actions run #45299484364](https://github.com/bob8675309/DNDNEXT/actions/runs/45299484364), exact tested commit a7a6ab176010b0fc8c5bef70bf8aa0f87184be32, **PASS**. PostgreSQL 17, real GoTrue JWTs and PostgREST, eight distinct signed local actors plus anonymous.
- **Original-source expected RED:** admin, gm, dm, AND noncanonical signed unknown account each created a tactical encounter via actual original admin_create_encounter_v1. All other player/scoped/anon roles rejected. Unknown also called original admin_set_encounter_status_v1 and advanced status to ready with version 2. This is a reproduced original-source permission mismatch, not proof of a live deployed vulnerability.
- **Versioned exact-guard GREEN:** admin, gm and dm each created a separate encounter; unknown, player, creator, editor, inventory and anonymous were denied. Denied status changes left draft/version 1 untouched. GM changed a candidate encounter to ready/version 2. After the same GM JWT was demoted to player in the current database role row, further status change was denied and status/version remained unchanged. DM then changed it to initiative/version 3. Scratch encounter count: 4 original plus 3 candidate, all destroyed at end of CI.
- **Generic wallet permission negative:** original wallet_add was executable by service_role but not authenticated. Real signed admin/gm/dm/unknown/player/creator/editor/inventory and anonymous could not invoke wallet_add via PostgREST. Scratch player_wallets stayed EMPTY. This does not test or grant permission to purpose-specific wallet_set, wallet_transfer, buy_from_merchant or craft/merchant commands.
- The same passing log confirms unchanged original P1.3 private helper mismatch, creator Story and dossier source negative, separate exact-role positive, earlier original tactical encounter-map admin command negative and candidate positive.

## What remains blocked

- **TC1 is not implemented by this test.** Owner policy: a canonical character may belong to at most one active encounter. Prior #317 already proved separate Start/resume and participant staging lock inversion cases in isolated source-derived PG16. This new test covers encounter creation and non-active status transitions only. It does NOT exercise active/resume, admin_start_encounter_v1, concurrent transactions, request-replay, spell/turn actions, resource spending, hidden-result projection or other original tactical RPCs.
- Existing SQL helper overloads have non-equivalent semantics; replacing public.is_admin() / public.is_admin(uid) / private.current_user_is_admin globally could change map RLS, Forge authority bypasses, public site activity, NPC dossier, wallet, and tactical ACL. No blind global replacement or loss of original regression evidence.
- Generic wallet_add intentionally remains service-only; giving GM browser access would be an unrelated authorization regression.
- Original #317/#312, #345 P1.3 Stages1–3, complete Forge trigger/nonce/Story and merchant stock/wallet integrity, 22/34 legacy account-sheet writers, full real browser and official PDF privacy regression, independent encrypted PG17 recovery and all 340 Storage object bytes remain distinct required acceptance gates.
- No production or hosted Supabase SQL even SELECT, map changes, gameplay merges, branch retirement, Vercel release or paid agents. No active Agent A/B/C research branch was written.

## One next bounded task

Read latest original C34 economy/crafting PR work and actual purpose-specific wallet and merchant source before selecting one narrow, **nonmap** signed Game Master role-equivalence transaction test. Preserve the already accepted merchant/wallet receipt proof, not repeat it. Explicitly check stock, balance, recipient and rollback under fail-closed roles, without changing installed source functions or live data.

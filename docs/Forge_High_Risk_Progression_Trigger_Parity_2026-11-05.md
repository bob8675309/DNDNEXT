# J103–J108 — Live-original progression trigger expansion (held Forge research)

**November 5, 2026 • DNDNext draft PR #324 stacked on #321 • review-only.** This document is a source/fidelity receipt prepared **before J103–J108 exact-head CI**. The test claims below are pending until the runtime log verifies them. [Previously verified J94–J102](https://github.com/bob8675309/DNDNEXT/actions/runs/42144482448) remain a 4/4 passing baseline at `6bbf895f6048661de169757b3337a5172955bb0d`. No production SQL, grants, RLS, data, deployments or `main` changes are authorized.

## Why these triggers are next

Original PostgreSQL17 production metadata was read-only queried again, including `pg_trigger`, `pg_proc`, and `pg_get_functiondef`. The Forge creation tables currently have **31 original non-internal triggers**: 19 on `character_progression`, 4 on `character_sheets`, 6 on `characters`, and 2 on `inventory_items`. Their naming, timing, and dependencies are not interchangeable. The previous disposable fixture captured important original progression authority, feat G/GI, deferred gear I/C, inventory crafting BEFORE triggers, and some character/sheet guards, **but not these three progression triggers**.

| Newly staged original trigger (all on `character_progression`) | Original event/timing | Exact original handler MD5 | Branch included in this test |
| --- | --- | --- | --- |
| `character_progression_materialize_player_forge_source_magic_v1` | AFTER INSERT, DEFERRABLE INITIALLY DEFERRED | `4c35eaab8dff7d3d15b64ed71881d4a6` | No-routed-spell success; reject unsupported `ownerType=alchemy`; real species/feat spell grants **not tested** |
| `character_progression_validate_player_forge_class_options_v1` | AFTER INSERT, DEFERRABLE INITIALLY DEFERRED | `6df5aee6f0519c9c77758d6e887ed8e4` | Non-Warlock Fighter success; reject a mismatched Eldritch Invocation group; Warlock positive path **not tested** |
| `character_progression_validate_player_forge_starting_magic_exac` | AFTER INSERT OR UPDATE, DEFERRABLE INITIALLY DEFERRED | `ba645ad0f2c17addad0b40e0602c2ac8` | Valid no-starting-magic state; actual v3 Wizard magic and mismatch negatives **not tested** |

Exact function bodies, with their source MD5 comments, are saved **unchanged** in `scripts/fixtures/forge_high_risk_original_progression_triggers_pg17.sql`. They are installed only after existing J00–J102 signed-in tests, under fail-closed project-independent safeguards, via `scripts/fixtures/forge_high_risk_progression_local_auth_pg17.sql`. Three `CREATE CONSTRAINT TRIGGER` statements match the original names and deferral flags. Neither production migrations nor application runtime imports these files.

## Intentionally reduced support

The original class-option handler declares `public.class_feature_option_catalog%ROWTYPE` and references `public.character_class_option_grant_instances`. The disposable test creates **two live-column-shaped empty tables solely to support those original function declarations**. The actual production invocation catalog, Warlock slot-count helpers, full preferred feat catalog, and real player spell availability are **not** copied. Source-magic also depends on additional spell-origin selection helpers that are deliberately **not** invoked by the bounded positive/no-spell or invalid-owner branches. Consequently, staging a verbatim handler **does not equal full functional parity**.

Full original production CHECK/constraint/crafting/permissions and full 31-trigger order are separate release gates, as are original Warlock and class spell features. Tests must never call "all 31 original triggers exercised" merely because three more were installed.

## Executable J103–J108 contract (CI pending)

- **J103:** exact original bodies compiled with MD5 checks; three original deferred trigger names present and enabled with PG17 original deferral flags.
- **J104:** a genuine signed Player JWT calls unchanged `create_player_character_v2` with the source-qualified Fighter/Soldier/Lucky + Defense Fighting Style and a package; G/GI and original deferred character-owned I/C must commit once, without synthetic Warlock grants or source spells.
- **J105:** a genuine signed Player JWT calls unchanged `create_player_character_v3` with the verified Fighter/Soldier market intent under all three newly staged triggers. Source authoritative stock price (8 gp) must determine I/S/C even when untrusted UI `priceGp` says zero; no extra class/source spell grants.
- **J106:** original signed v2 Fighter with a fabricated Warlock invocation source-owned group must fail with the **actual original class-options handler error**, and all character, reservation, sheet, CP, events, G/GI, I/C, and stock counts must remain unchanged.
- **J107:** original signed v2 Fighter with a fabricated spell `ownerType=alchemy` must fail with the **actual original source-magic handler error**, with the same atomic rollback guarantees.
- **J108:** legitimate original signed v2 and v3 same-nonce retries must remain inert across G/GI/I/C, stock and no Warlock-class grant rows.

**Possible result caveat:** If another original source validator rejects a fabricated payload *before* the targeted handler, the test should **fail the exact handler-message assertion** and be re-scoped; an arbitrary rejection must not be credited as proof that the newly staged handler was exercised.

## Other source-level findings

Main client remains `NewNpcModalV3`→`create_player_character_v3`, with cart `marketPurchases[]` passed through `sheet.startingEquipmentSelections`. The source inspection remains static and is not a browser test. `pages/inventory.js` direct/bulk pathways remain release-sensitive; PR #317 global CP/CS/G/I order is unresolved and remains separate. Prior tested combined four-policy/obsolete CHECK SQL is still under `sql/candidates/` and **not** a production migration. Full original function interactions on a production-equivalent copy and owner/GM browser acceptance remain mandatory.

## One next step after this batch

**Verify exact-head real GoTrue/PG17 J103–J108 results and remedy any fixture mistakes without rewriting original functions.** If accepted, isolate one full positive owner-specific specialty branch (Warlock class option or feat/species source magic) with its real source catalogs and source helpers, then plan controlled browser/staging acceptance. Do not deploy, merge held draft branches, or incur Vercel builds for docs-only receipts. GitHub PR comments can record final PASS or limitations without another unnecessary push.

**Production effects: none.** All Supabase introspection in this phase used SELECT, and all mutations/tests are restricted to disposable local PostgreSQL17.

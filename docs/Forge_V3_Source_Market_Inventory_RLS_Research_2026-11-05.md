# J94–J102 — Real JWT Forge v3 starting-market inventory under four-policy security candidate

**November 5, 2026 • draft research PR #324, stacked on #321 • NO PRODUCTION CHANGES.** The source original Forge creation and its deferred equipment trigger have prior authenticated acceptance through J93. New **J94–J102 are executable candidates, NOT PASS until exact-head GitHub Actions logs confirm them**.

## Starting baseline: J85–J93 succeeded

At exact research SHA `5417dde7f06025ebaa419b7b728bc302ef4d0b4f`, [Actions 42140111002](https://github.com/bob8675309/DNDNEXT/actions/runs/42140111002) returned **4/4 success** and original PostgreSQL17 and real local GoTrue/PostgREST test jobs green. J86–J87 proved the previous authenticated direct-table RLS would allow a user to assign inventory to an unrelated character once the old constraint was removed alone. J88 applied the combined four-policy + obsolete CHECK **review candidate** in disposable PG17; J89–J93 confirmed denied direct mint/update, original authorized Forge G/GI/I/C, immediate revocation of direct SELECT, preserved player-owned direct CRUD, and GM assignment.

The reviewed candidate `sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql` **is not a production migration and is not deploy-approved**. New tests below run only *after* it has been applied to the disposable database and its invariants have passed. These tests do not modify or replace the candidate.

## Verified main-branch UI→RPC payload contract (static source)

The currently deployed repository **source** (not browser-run in this audit) shows:

| Source | Relevant behavior |
| --- | --- |
| `components/NewNpcModalV3.js` | Player-mode creation submits `create_player_character_v3` with `p_payload`, `p_spell_choices` and `p_magic_selections`; its NPC branch uses `create_character_v1` |
| `components/useNpcForgeDerivedModel.js` | Copies `draft.startingEquipment` to `sheet.startingEquipmentSelections` and forwards to the creation payload |
| `components/NpcForgeEquipmentStep.js` | Writes `mode='market'`, `marketMerchantId`, and `marketPurchases[]` with each `merchantId`, `stockId`, `qty` |
| `components/NpcPanel.js` | Character inventory read/equip/transfer through `get_character_inventory_v1`, `set_character_inventory_equipment_v1`, `transfer_inventory_item_v1` RPCs |
| `pages/inventory.js` | Legacy direct item UPDATE/DELETE, bulk owner changes and RPC+fallback transfer pathways still exist; requires actual Admin/player browser acceptance |

A no-network, source-static regression is provided in `scripts/validate_forge_inventory_ui_release_contract.mjs`; it runs in existing free GitHub Actions. **This proves naming/serialization contracts only, not click-through behavior, Vercel build, live auth or UI runtime.**

## Live source-qualified cash budget

Read-only live query to `public.class_catalog` confirmed XPHB Fighter `raw_payload.startingEquipment.defaultData` with choices A, B and **C: 15,500 copper (155 gp)**. No selection content was invented; the fixture embeds this exact source JSON. Original unchanged PG17 helper function bodies included in `scripts/fixtures/forge_market_cash_original_functions_pg17.sql` and checked by live MD5:

- `private.player_forge_cash_equipment_option_v1(jsonb)` — `78231b02e56477cedd90992e42826597`
- `private.format_copper_currency_v1(bigint)` — `f7f8dce93e3d20a5c35fccee0bcf374b`

The **original** `private.materialize_player_forge_starting_equipment_v1(uuid)` body `653e1b9d7cc47dcff2cef33a674b97f4` is retained. In homebrew market mode it uses **max(source cash, 30,000 copper)** (300 gp floor); in vanilla mode it uses the actual source cash. Its market branch `FOR UPDATE` locks the original merchant stock row S, creates `owner_type='character'` inventory I with quantity and source flags, decrements/deletes stock, writes canonical character currency C, and updates the sheet summary. These operations run at the original deferred creation COMMIT boundary.

**Local fixture reductions remain:** source-original Fighter cash metadata and two exact cash helpers, but the other pre-existing equipment helpers are reduced, class/Background/inventory catalogs are not full production clones, the source trigger graph is incomplete (31 creation-adjacent original triggers identified, 24 omitted from earlier baseline), and no live RLS/UI browser execution occurs. No global deadlock-frequency or end-to-end browser claim.

## Executable real GoTrue acceptance J94–J102 (pending exact-head CI)

`scripts/fixtures/forge_v3_market_source_local_auth_extension_pg17.sql` fails closed if the database is not disposable PostgreSQL17 after J93, if the RLS candidate did not remove old CHECK or change four policies, or if original equipment source MD5 differs. It replaces the **previous test-only reduced cash/format helper stubs** with two original source bodies and source-verified Fighter cash JSON. It does not change original v2/v3/market materializer functions.

- **J94:** source exact cash/formatter helper fingerprints; source Fighter option C=15500; real signed merchant-stock fixtures.
- **J95:** valid player JWT calls original `create_player_character_v3`, with the UI-shaped 2×9gp market cart in homebrew mode; expects one character-owned inventory row `quantity=2`, S stock 3→1, C 30,000−1,800=28,200 copper, and correct canonical sheet summary/immutable nonce.
- **J96:** repeated same nonce and identical v3 intent is inert across S/I/C; a changed same-nonce creation request rejects `22023`.
- **J97:** stock row not belonging to referenced merchant rejects at original deferred materializer, with character, reservation, I, C and S unchanged.
- **J98:** 2 requested when only 1 S remains rejects without overselling or partial creation.
- **J99:** 350gp item exceeds the homebrew 300gp source floor and rolls back all writes.
- **J100:** original equipment rejects recipe-tagged merchant stock; no forged inventory.
- **J101:** vanilla ruleset uses source-qualified 155gp cash option, rejecting an unaffordable 350gp purchase.
- **J102:** original signed `buy_from_merchant` can still purchase remaining stock into **player-owned inventory**, debits wallet once, does not modify the already-created **character-owned** J95 gear.

These source-level tests are stronger than static browser source inspection and exercise original merchant S/I/C, but still do not reproduce the entire browser state machine or full source/RLS/trigger graph.

## Specific remaining release gates and next action

After exact-head CI (and repairing any test harness fixture error without altering original deployed functions), prioritize **owner/GM browser-level Forge v2/v3 creation**, package vs market selection, real source A/B/C and Background budget, page inventory assignment/equip/transfer/bulk behavior, actual 31-trigger creation graph, item crafting/merchant purchase and storage, valid/invalid currency, cross-role and revoked user access, and coordinated #317 CP/CS/G/I lock-order design. Maintain #321 NPC Profile privacy boundaries and #319 populated `players.sheet` preservation. Avoid touching world or town maps, AI runtime or app styles.

**Single next action:** examine exact-head CI J94–J102; if accepted, plan a browser/staging acceptance matrix with a controlled owner-approved test environment rather than installing a production constraint migration. Draft #324 remains stacked and unmerged. Conserve Vercel: one consolidated research push, and subsequent CI receipts in PR comments rather than docs-only pushes.

**Production effects: NONE.** Live DnDWeb was queried read-only for the original Fighter cash option and two helper MD5/source definitions. No live SQL, RLS, grants, data, production deployment or main branch changes.

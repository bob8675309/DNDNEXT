# C34 B14-P20 — original /admin self-account inventory mint: source RED and earned-item authority release gates

**2026-11-22 CST. Held research on [PR #379](https://github.com/bob8675309/DNDNEXT/pull/379), no production migration.** Source-derived risk, **not proof of a production exploit**. Distinguish actual deployed code, signed disposable PostgreSQL17+GoTrue evidence, original queued PRs, and a future release plan. Do not run any hosted SQL, edit the protected world map, activate paid agents, deploy game changes, merge main or close original PRs without explicit owner review.

## 1. Why this is more than an abstract Data API concern

The actual original `pages/admin.js` component (Git blob `1ba76a20bfa87934d7e504c056c4770ad1b3a92a`) is a real `AssignItemButton` consumer:

- `assignOwnerType` starts at `player` and `assignOwnerId` starts at an empty string.
- The item catalogue loads and `selected` defaults to a filtered catalogue item. The Assign button is rendered with `ownerType={assignOwnerId ? assignOwnerType : null}` and `ownerId={assignOwnerId || null}`.
- Exact original `components/AssignItemButton.js` (`dc09dc77c66896ed842d240c584225cde26581db`) has `if (!finalType || !finalId)`, calls `supabase.auth.getUser()` and defaults to `owner_type='player', owner_id=user.id, user_id=user.id`. It sends the catalogue item with `await supabase.from('inventory_items').insert(insertData)`, without requesting row RETURNING. **There is no server-issued loot/craft/purchase entitlement or manager check in this browser path.**
- The inspected `pages/admin.js` does not contain an in-page signed Admin/GM/DM role gate; `pages/_app.js` directly renders `<Component {...pageProps} />`. `AppRouteReloadGuard` is only a router error handler and `AdminBuildBadge` merely hides its own badge. No source root `middleware.js/.ts` was found. This does **not** prove an outside access policy or an actual hosted response.
- The adjacent separate `pages/admin/character-options.js` checks `is_admin` and returns an unauthorized view; **that is a different page**, not a guard for `pages/admin.js`.

All four relevant source files are exact-blob-identical between `main` `bb3939eeb9a38cf416996a1dca3b196b156b2915` and the held research branch: the two pages, original button and `sql/20260614_02_phase_a_non_map_security_hardening.sql`. The historical inventory INSERT RLS only checks `user_id=auth.uid()` or `private.current_user_is_admin()`; it does not prove how the item was **earned**. Genuine local signed [P19 original account-mint RED](C34_B14_P19_ORIGINAL_ASSIGNMENT_AND_FORGE_STAGE4_COMPATIBILITY_2026-11-22.md) reproduced unauthorized-by-game-rules new self-account item creation in disposable PG17 even while P16/P18 no-bypass character-owner guards were active.

**Crucial limitation:** The hosted DnDWeb instance's current `pg_policy`, installed SECURITY DEFINER/trigger bodies, table/column grants, public route access, and Vercel deployment source were **not** rechecked as part of this risk. Therefore classify **source-vulnerable + local signed behavior reproduced**, **production exploitation UNVERIFIED**. No user account or hosted item was touched. Production investigation requires specific owner permission before any live catalog query.

## 2. New executable source-only regression

`scripts/research/c34_b14_p20_original_admin_account_mint_route_source_red.mjs`, wired only to the lightweight `.github/workflows/validate-c34-c2b14-inventory-source.yml`, has four positive **expected-RED witnesses**:

1. `P20-ORIGINAL-ROUTE-BLOBS`: main-equivalent original route, app, button, RLS and adjacent Admin control Git SHA pins.
2. `P20-ADMIN-FALLBACK-SOURCE-RED`: real `/admin` selected item/blank owner `null` props → signed current-user fallback → raw insert; no invented RPC.
3. `P20-ADMIN-PAGE-ROUTE-RED`: no in-page role gate or root middleware in source; adjacent Admin page is gated, global badge isn't.
4. `P20-ACCOUNT-MINT-RLS-SOURCE-RED`: historical source RLS `user_id=self` allows writes without item provenance; P19 temporary manager-only policy does not address player account mint.

[Source-only Actions #45054115488](https://github.com/bob8675309/DNDNEXT/actions/runs/45054115488), job from branch commit `b26f4ff13d51e9522b4b3224a17402f2f48b729d`, **SUCCESS**. These are source assertions, not an original mounted Chromium exploit, hardened server behavior or approval to release. The signed P19 new manager policy RED→GREEN and original `P19-MANAGER-READ-HOLD` remain separate evidence.

## 3. Preserve all legitimate original item writers before a server-only security cutover

| Writer/reader | Original source semantics to preserve and exercise with real signed auth |
| --- | --- |
| Game-manager item assignment | Original `/admin` and `AssignItemButton` send no `user_id` for NPC/merchant, target `user_id` for player; Admin/GM/DM equal *game administration* (not infrastructure). Require **current signed server-side role**, never browser `isAdmin` boolean or old over-broad `public.is_admin(uuid)` admitting Observer |
| Player Forge creation | Original full `create_player_character_v3`, immutable complete nonce/Story and source `private.materialize_player_forge_starting_equipment_v1` with latest October market/homebrew budget and deferred nonmap triggers. Must continue materializing allowed character gear, no arbitrary raw user mint |
| Town crafting | Source `pages/town/[id].js` currently consumes account items, inserts crafted results, and has rollback INSERT; replacing raw INSERT must preserve atomicity and actual earned recipes/quantities, not just page success |
| Player inventory / equipment | Self equip and safe columns under P16, current ownership and revocation, original `#345` Stage4 SELECT/UPDATE/DELETE/INSERT and old invalid owner CHECK; do not reenable owner-column UPDATE or leak private NPC/character backpacks |
| Merchants | `character_stock` inventory versus private backpacks; purchase `buy_from_merchant`, wallet deduction, quantity, epoch and late-response constraints, not blanket stock/grant changes |
| Trade / NPC consent | `trade_requests`, `accept_trade`, P14 current consent status, P16 old June/P2/P4/P6/P8 direct bypass revocation and owner-approved controlled companion gift semantics; preserve legitimate PC→NPC gift and separate PC→PC trade |
| Source-definer/trigger callers | Historical 22 candidate definitions/8 apparent item-mutating SQL sections are **source text**, not installed live `pg_proc` proof; check function EXECUTE (including PUBLIC), all dependent grants, dynamic SQL, RLS bypass and external clients before any privileged change |

## 3A. P19 disposable signed prerequisite NOW accepted; P20 remains source-only

The prerequisite [P19 genuine signed guarded buyer #45053692275](https://github.com/bob8675309/DNDNEXT/actions/runs/45053692275), job `137304165997`, completed **SUCCESS** at unchanged executable `be28d86d02d1141d42be405629a2c7ae708b2eee`, decoded 1,388-line log. Original GM/DM no-user-id assignment RED, Admin positive, manager-only temporary-policy GM/DM GREEN, Player/Observer denied, **separate GM SELECT still hidden** under historical RLS, independent arbitrary player-account mint RED, original P19/P18/P16 scratch policy/row/function/grant restoration all passed. See [P19 signed acceptance](C34_B14_P19_ORIGINAL_ASSIGNMENT_AND_FORGE_STAGE4_COMPATIBILITY_2026-11-22.md) for exact markers and executable file blob parity.

**This P19 result authorizes no change to production.** P20 remains a **source-only original /admin entrypoint and earned-item provenance investigation**, not real mounted browser proof of player self-mint through deployed /admin nor a deployed server-side fix. The next bounded research phase can now test P20 earned-item issuance with genuine signed account, GM, Forge and Town writers in one disposable fixture, while preserving original #345 Stage4 and all existing app code.

## 4. Bounded P20 work order, no unauthorized production changes

**First** accept or diagnose the exact-head P19 local signed `GM/DM` no-return RED→temporary-policy GREEN and SELECT-HOLD, unauthorized Observer/player negatives, account mint RED and restoration of original four policies plus P18/P16 triggers. Distinct real signed tests and source CI must be green before declaring a compatible candidate.

**Then** build a **disposable-only** P20A earned-inventory issuance research matrix: source-pin original `pages/admin.js`/catalogue, Forge, Town, trade and merchant writers; authentically prove ordinary account self-mint RED both via direct PostgREST and, if feasible without altering original UI, the real mounted `/admin` selected-item/blank-target path. Prototype a server-authorized item-issuance contract with original item definition/quantity/recipe/source evidence and atomic nonce/idempotency. Separately test Admin/GM/DM manager grants and player Forge/Town legitimate starts, craft failure rollback and self equip. **Avoid blanket INSERT REVOKE** until every original writer has a tested server-compatible replacement. A client-only UI hide is not a security control. The original #345 Stage4 four-policy/owner-CHECK commit remains a separate coordinated contract and cannot simply be overwritten with P18/P19 scratch policies.

**No release without** full original source PR/no-lost-work review and signed privacy role/nonce/browser tests, 22/34 old `players.sheet` writer debt resolved, independently encrypted PostgreSQL17 restore and byte-verified restore of all 340 Storage objects, source/test/liveness parity, approved rollout/rollback and explicit owner go/no-go for any hosted SQL/client/map/deployment change. Keep [P19 handoff](C34_B14_P19_ORIGINAL_ASSIGNMENT_AND_FORGE_STAGE4_COMPATIBILITY_2026-11-22.md) and this dossier source-qualified.

# I2-H — Original Tough feat HP progression: signed v5 source RED → Option A scratch GREEN

**RESEARCH ONLY; SIGNED ORIGINAL RED and SCRATCH GREEN VERIFIED; NOT production.** November 12, 2026 (America/Chicago). Draft stack: I2-H on exact-verified I2-G #371 → I2-F #370 → prior signed I2C/D/E/B and original I1-B–O Forge/Story/nonce. Owner-selected Option A remains per-character `public.character_sheets` canonical authority and **every historical `public.players.sheet` frozen, including empty or same-character account rows**. Never infer permission to rewrite production functions, ACLs or migrate snapshots.

> **2026-11-12 SIGNED SOURCE-TEST RECEIPT — VERIFIED I2H-01 through I2H-10 PASS.** [Actions #43310669290](https://github.com/bob8675309/DNDNEXT/actions/runs/43310669290) at executable+initial-doc head `daf7a3f5da74e69f634880ce1376c444943a11e6`: unchanged I2-F full Forge/Story/nonce job **SUCCESS** `131505612572`, unchanged I2-G signed original v1 RED/GREEN job **SUCCESS** `131507223514`, and independent exact original Tough private helper invoked by signed public v5 job **SUCCESS** `131508381880`, explicitly **PASS I2H-01 through I2H-10 in log**. I2H-04 ORIGINAL source Tough +2 HP canonical succeeded but overwrote *two unrelated* account sheets; only afterward source-locked local one-statement scratch I2H-06 preserved canonical +2/HP/level/session/event and same/unrelated historical snapshots+timestamps. Prior two already-tested base-v3/class-summary mirrors were source-MD5-reversibly disabled before new original Tough RED, preventing confounded attribution. No other writer is counted. Ledger now **11/34 bounded-tested, 23 original UPDATE writers untested**. **Final documentation-inclusive head CI still requires independent recheck after these receipts.** Not signed modern Player Forge v3/real origin-feat grant/full 31 triggers; no production SQL/ACL, map/app, deployment or merge.

## Why this original writer

SELECT-only live DnDWeb PG17 `pg_get_functiondef` verified original `private.apply_tough_progression_bonus_v1(uuid,integer)` MD5 `2b8bca48b7067e2e67b66defcb7f2c10`, its exact original `private.normalize_player_choice_name_v1(text)` MD5 `dd8cdd5b47efe99b1cfff9c2bf7635dd`, denied anonymous and authenticated private EXECUTE, and an original `UPDATE public.players` immediately after the canonical Tough HP adjustment. The helper is called by the source-original authenticated public `complete_character_level_up_v5(uuid,jsonb)` chain. This is **a real signed public v5 entrypoint**, not an invented direct private RPC.

**Critical dependency isolation:** original v5 also invokes two previously tested I2-B account-sheet writers, `private.complete_character_level_up_base_v3` MD5 `e33639d549ef557976a3970ea51f5238` and `private.sync_player_forge_class_spell_summary_v1` MD5 `5b1b275a268a57591a2e35a05ce7480d`. The new scratch environment source-verifies each one and replaces **only its legacy account mirror** with a source-MD5-reversible no-op, **before the new Tough original RED**. Their canonical level-up and spell synchronization remain intact. Without this isolation, a supposed Tough RED would be confounded by those two older mirrors. Inherited original-source RED/scratch GREEN tests run separately, first, in prior CI jobs. Original v5/v4/v3 sources remain MD5-identical.

## Isolated executable research

The new workflow contains three sequential disposable GitHub Actions PostgreSQL17/GoTrue/PostgREST jobs: full unchanged I2-F original signed Forge/Story/nonce suite, then unchanged I2-G signed original v1 RED/GREEN, then **fresh I2-H**. The new job begins with the existing P1.3 original v5→v4→v3→base and sheet sync trigger test fixture. It installs exact live Tough/normalizer original sources and reduced column-only `character_option_grant_instances` table, denies direct client grants, and uses SQL-seeded XPHB Fighter 1→2 character review/XP and **synthetic Tough acquisition** markers. It then calls the actual original `public.complete_character_level_up_v5` via signed local GoTrue JWT and PostgREST.

This is not an authentic v3 Forge/Story-based Tough grant, real origin-feat materialization, complete level-up catalog/31-trigger graph, production RLS/Admin/role configuration, or browser test.

## New acceptance cases (all PASS at tested source head; final documentation-inclusive head recheck pending)

| Case | Required assertion |
|---|---|
| I2H-01 | Source original Tough and normalize MD5, signed original public v5 and private direct EXECUTE denial |
| I2H-02 | Verify source-MD5-reversible suppression of exactly two already I2B-tested account mirrors; new Tough original still byte-identical |
| I2H-03 | Signed v5 Fighter **without Tough** levels normally, bonus 0, preexisting legacy account snapshots unchanged, proving competing mirrors isolated |
| I2H-04 — **original SOURCE RED** | Signed owner levels shared Fighter with synthetic source-qualified level-1 Tough; canonical level+HP+event correct including +2 bonus; original Tough overwrites *both unrelated editable legacy accounts* |
| I2H-05 | Only AFTER RED, source-MD5 reversible Tough-only one-statement legacy mirror scratch replacement; original v5/role ACL unchanged |
| I2H-06 — **scratch GREEN** | Signed coeditor same shared character v5 level-up still grants +2, canonical HP/level/session/event intact; same-character owner legacy sheet and unrelated editor/historical account sheets **and timestamps unchanged** |
| I2H-07 | Synthetic Tough acquired at the **target level** (not earlier) grants no extra HP; account snapshots frozen |
| I2H-08 | Invalid HP selection and completed review replay fail atomically, no duplicate Tough/level event or account write |
| I2H-09 | Revoked editor and unrelated JWT cannot level character, no canonical/account changes |
| I2H-10 | Public original v5/v4/v3, private normalizer source, inherited test boundaries and frozen snapshots retained |

After the original I2H-04 RED and scratch I2H-06 GREEN passed alongside unchanged inherited tests, the source-verified 34-original-UPDATE ledger now counts **11/34 bounded tested and 23 untested**. Exactly one new function was promoted; no extrapolation to other writers or automatic production de-mirroring.

## Release gates and one next task

Original 31-trigger/modern signed Forge with real feat grants, complete production role/RLS/ACL/service paths, other direct/indirect writers, real browser consumers/profile switching, locks/multiwriter concurrency, separately verified encrypted offsite backup and isolated database+Storage restore, and explicit owner production release approval remain required. This research does **not** change the app/world/town/tactical maps, deployed DB SQL/data/grants, any hosting, Vercel, PR merges, `main`, or paid agents.

**ONE NEXT TASK:** verify documentation-inclusive final draft I2-H head and all four or more GitHub checks, preserve the verified original MD5 and prior REDs, and append final-head receipt. Then select one more small original class/level-up writer from the remaining **23**, keeping release gates closed.

# I2-G — Original signed Fighter level-up v1 legacy snapshot overwrite, Option A source-preserving test

**Status: signed original-source RED and scratch-only GREEN PASSED — RESEARCH ONLY, NOT production.** Prepared November 12, 2026 (America/Chicago). This follows original signed Option A I2-F #370 while preserving all original I1-B–O and I2-C/D/E/F source, Story/nonce, security tests and prior RED evidence.

> **2026-11-12 FINAL SOURCE/TEST RECEIPT — SIGNED ORIGINAL RED → SCRATCH GREEN VERIFIED, but NOT production release.** [Exact tested head e57713e12ffea7835998ad78ea51df13a24cc365](https://github.com/bob8675309/DNDNEXT/commit/e57713e12ffea7835998ad78ea51df13a24cc365), [Actions #43296779345](https://github.com/bob8675309/DNDNEXT/actions/runs/43296779345): inherited full I2-F original signed Forge/Story/nonce suite **SUCCESS** (job 131457075019), followed by independent I2-G reduced signed original public v1 job **SUCCESS** (131458834795), with **I2G-01 through I2G-09 PASS explicitly in logs**. Original RED I2G-03 genuinely overwrote the two unrelated editor legacy sheets while canonical level-up succeeded; scratch GREEN I2G-06 preserved all historical sheet bytes and timestamps while canonical HP, progression, session, event succeeded, and invalid/revoked/outsider/replay and v5 source guards passed. This adds exactly **one bounded tested original UPDATE writer: 10/34 covered, 24 still untested**. A first run [#43295949051](https://github.com/bob8675309/DNDNEXT/actions/runs/43295949051) failed before tests due missing SQL terminator after verbatim pg_get_functiondef; corrected **only SQL statement terminator** in the disposable source fixture, not source body or hash. Final documentation-inclusive head checks require revalidation after the ledger/receipt edits. Full modern v3/Story/31-trigger and production roles/browser/backups remain unverified.

## Why this writer

Live DnDWeb **read-only** `pg_get_functiondef` showed `public.complete_character_level_up_v1(uuid,jsonb)` at MD5 `1500703592c3cb8e1738126eac508e6a`, with an exact `UPDATE public.players` following the canonical `public.character_sheets` update. Role introspection confirms this original SECURITY DEFINER public RPC is executable by authenticated, not anon. Unlike I2-F private projection helpers, **the original source entrypoint is a genuine signed public RPC**. Selecting v1 is deliberate: this is one **legacy** writer, and does not mean it is the current v5 earned level-up path.

The original SQL function body was copied **unchanged**, including its authorization, level-up review, HP, event and account mirror logic. No production change. The copied fixture verifies original MD5 before any candidate; guard checks a disposable PG17+local Auth-only schema, and the original v5 MD5 is also pinned.

## Test assembly

Two independent, sequential disposable PG17/GoTrue/PostgREST jobs in the new CI workflow:

1. **Inherited I2-F job:** reruns prior original signed v3 Forge/Story/nonce, I1-B–O and I2-C/D/E/F suites unchanged before moving to the new fixture.
2. **I2-G job:** creates a fresh local PG17 service, installs the existing original P1.3 `p1_3_levelup_v5_local_auth_pg17.sql` with original v5→v4→v3→base-v3 plus original sheet→progression trigger, and installs the exact original public v1 function.

The P1.3 source environment deliberately reduces **only** its auxiliary class-choice eligibility for a featureless XPHB Fighter level 1→2 and uses SQL-seeded review/XP/progression. This is **not** a real signed modern Player Forge v3/Story creation flow, a source-complete class-options integration, or the complete 31-trigger production graph. Character rows, HP/XP, review sessions, permission grants and historical snapshots are locally synthetic. Level-up calls themselves are made through genuine signed GoTrue JWT and PostgREST against the unchanged public v1.

## New exact-head cases (all PASS at tested source/test SHA; recheck documentation-inclusive final head)

| Case | Required evidence |
|---|---|
| I2G-01 | Exact original v1 source fingerprint and public authenticated/anonymous EXECUTE boundaries |
| I2G-02 | Signed unrelated user denied with no canonical/account mutation |
| I2G-03 — **ORIGINAL SOURCE RED** | Genuine signed owner invokes v1 to level shared Fighter B; canonicals, HP, event/review succeed while both *unrelated* owner and editor legacy accounts are overwritten |
| I2G-04 | Only after RED, source-exact reversible scratch replacement removes **one** v1 account update without changing canonical v1 logic or the original v5 source |
| I2G-05 | Invalid HP method rolls back without writing legacy snapshot/event |
| I2G-06 — **SCRATCH GREEN** | Genuine signed coeditor levels Fighter D; canonical level/HP/event/review succeed, while a same-character owner legacy snapshot, editor's unrelated snapshot and historical unmarked snapshot remain sheet/timestamp-identical |
| I2G-07 | Completed-review replay cannot double level or create another event |
| I2G-08 | Revoked and unrelated accounts cannot level an unrelated character |
| I2G-09 | Original modern v5/base-v3 fingerprints unchanged, and snapshot freeze remains intact |

The exact source/test job log reports **I2G-01 through I2G-09 PASS** on the executable head; this is bounded local source/test evidence, not deployed behavior. The prior `#370` final exact-head I2F workflow is already verified 4/4; I2G must independently rerun its inherited signed tests. Prior original failures remain preserved.

## Scope, decision, next task

Option A means `public.character_sheets` is canonical per character and every existing `public.players.sheet` byte, even empty/same-character rows, is an archival account snapshot. No automatic mirrors should persist **after separately approved full release**, but this original source RED/scratch GREEN does **not** install that policy.

The verified original-function writer coverage now advances from **9/34 to 10/34**, leaving **24 untested**. This counts specifically one source-original public v1 writer, not a validated general earned-v5 path.

Full 31-trigger Forge, original source qualified class/feat catalogs, current production role/RLS/ACL equivalence, complete browser/Profile workflows, mixed-writer/replay/lock-order concurrency, external consumers, encrypted offsite backup plus independently restored DB and Storage objects remain production release blockers. No production Supabase SQL/data/grants, no live app/map/character/inventory changes, no Vercel, no merge, no paid agent.

**ONE NEXT TASK:** reverify the final documentation-inclusive I2-G head and its exact checks; then select one additional original source-backed class/level-up writer from the remaining 24 for an independent original RED → narrow scratch GREEN test. Explicit owner authorization is required before any production cutover or merge.

# I2-G — Original signed Fighter level-up v1 legacy snapshot overwrite, Option A source-preserving test

**Status: PENDING exact-head CI — RESEARCH ONLY, NOT production.** Prepared November 12, 2026 (America/Chicago). This follows original signed Option A I2-F #370 while preserving all original I1-B–O and I2-C/D/E/F source, Story/nonce, security tests and prior RED evidence.

## Why this writer

Live DnDWeb **read-only** `pg_get_functiondef` showed `public.complete_character_level_up_v1(uuid,jsonb)` at MD5 `1500703592c3cb8e1738126eac508e6a`, with an exact `UPDATE public.players` following the canonical `public.character_sheets` update. Role introspection confirms this original SECURITY DEFINER public RPC is executable by authenticated, not anon. Unlike I2-F private projection helpers, **the original source entrypoint is a genuine signed public RPC**. Selecting v1 is deliberate: this is one **legacy** writer, and does not mean it is the current v5 earned level-up path.

The original SQL function body was copied **unchanged**, including its authorization, level-up review, HP, event and account mirror logic. No production change. The copied fixture verifies original MD5 before any candidate; guard checks a disposable PG17+local Auth-only schema, and the original v5 MD5 is also pinned.

## Test assembly

Two independent, sequential disposable PG17/GoTrue/PostgREST jobs in the new CI workflow:

1. **Inherited I2-F job:** reruns prior original signed v3 Forge/Story/nonce, I1-B–O and I2-C/D/E/F suites unchanged before moving to the new fixture.
2. **I2-G job:** creates a fresh local PG17 service, installs the existing original P1.3 `p1_3_levelup_v5_local_auth_pg17.sql` with original v5→v4→v3→base-v3 plus original sheet→progression trigger, and installs the exact original public v1 function.

The P1.3 source environment deliberately reduces **only** its auxiliary class-choice eligibility for a featureless XPHB Fighter level 1→2 and uses SQL-seeded review/XP/progression. This is **not** a real signed modern Player Forge v3/Story creation flow, a source-complete class-options integration, or the complete 31-trigger production graph. Character rows, HP/XP, review sessions, permission grants and historical snapshots are locally synthetic. Level-up calls themselves are made through genuine signed GoTrue JWT and PostgREST against the unchanged public v1.

## Proposed new exact-head cases (all PENDING)

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

These are **assertion targets, not PASS claims** until GitHub's actual job log passes on the committed test head. The prior `#370` final exact-head I2F workflow is already verified 4/4; I2G must independently rerun its inherited signed tests. Prior original failures remain preserved.

## Scope, decision, next task

Option A means `public.character_sheets` is canonical per character and every existing `public.players.sheet` byte, even empty/same-character rows, is an archival account snapshot. No automatic mirrors should persist **after separately approved full release**, but this original source RED/scratch GREEN does **not** install that policy.

The verified coverage ledger stays **9/34 with 25 untested** until I2G's exact-head CI passes. Only then may the status advance to **10/34 with 24 untested** (specifically one source-original v1 writer, not a validated general earned-v5 path).

Full 31-trigger Forge, original source qualified class/feat catalogs, current production role/RLS/ACL equivalence, complete browser/Profile workflows, mixed-writer/replay/lock-order concurrency, external consumers, encrypted offsite backup plus independently restored DB and Storage objects remain production release blockers. No production Supabase SQL/data/grants, no live app/map/character/inventory changes, no Vercel, no merge, no paid agent.

**ONE NEXT TASK:** obtain exact-head I2G CI logs, fix only reproducible isolated fixture/test defects without weakening old source hashes or original RED, append verified receipt and update the 34-writer ledger. If GREEN, select one additional original source-backed class/level-up writer from the remaining 24. Explicit owner authorization is required before any production cutover or merge.

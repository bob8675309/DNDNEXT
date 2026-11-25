# 2026-11-24 CST — Owner-provided PG17 backup archive source recovery (STATIC; no restore)

Owner uploaded actual `DNDNext-Full-Backup.dump` to conversation. Locally inspected bytes: 16,704,002 (matches earlier #345 owner-reported archive size); SHA256 `5da4d8785b0183b5ec5f531de10239844759026d447d52858be8cbccfd45106f`; custom archive header version 1.16-0, source PostgreSQL 17.4, pg_dump 17.11. Original private Windows SHA256 manifest is not supplied; confirm exact archive hash with owner copy before independent restore. No backup data uploaded to repository. No database connection, SQL execution, decompression/restore of table data, or hosted access. The local environment did not have pg_restore/psql available.

## Recovered complete function definitions

Static extraction of each unique CREATE FUNCTION definition from the length-prefixed archive DDL, retaining raw bytes and reconstructing pg_get_functiondef-style text by changing only header formatting, CREATE OR REPLACE, attribute line breaks and outer dollar delimiter; source body bytes preserved. Four reconstructed MD5s exactly match the historical original census (immutable ledger blob 772af5e05ec494f9526445a5ad9eb05bad0f5d78). These are archive-derived source identity matches, NOT an actual pg_get_functiondef query or independent restore receipt.

| Function | Archive byte offset | Raw DDL bytes | Reconstructed MD5 | Reference result |
|---|---:|---:|---|---|
| private.apply_level_up_warlock_invocations_v1 | 176478 | 11649 | ed0655adf02e9413157efe8a8bd414f9 | exact |
| public.complete_character_level_up_v2 | 1159344 | 2947 | 28a227a1dfb9a3cc5516c5b7afb874b0 | exact |
| public.configure_character_weapon_mastery_v1 | 1282351 | 6115 | 32fa55b69478af07f8f0002b967a5704 | exact |
| public.recover_character_invocations_v1 | 1866745 | 9616 | 05f6d19a7e2f45d890c62c27cb419e7f | exact |
| private.complete_craft_plan_v1_impl | 387369 | 15609 | 43383fb3cb93c013d84d133cd235cf24 | complete archive body; no prior reference hash supplied |

Owner-facing local artifact `DNDNext-recovered-function-source.zip` (28,563 bytes, SHA256 `a28d9823bbb545c2c26639f27f3538256b333a5a8ecc27301d7f1eff7840daac`) contains only five raw DDL files, five reconstructed definitions, JSON provenance manifest and README. ZIP integrity check passed. This artifact is conversation-local, NOT stored in Git; recover it from owner upload/local package, not an invented repo path. Original archive and account/game data remain out of repository. Do not claim full archive integrity or complete restoration from the five source matches.

## Consequences / next work

- I2J Warlock historical earned-source mismatch now has exact archive-derived replacement source available; do not rerun historical-only tests. Exact original-body signed scratch integration remains unexecuted. Compare source-level semantic delta and use verified original source in a narrow signed graph after independent provenance/authorization checks.
- Existing P7 file-only workflow needs independently restored source exports and a PG17 version receipt. Do not pass reconstructed files off as restored exports or revive P4 DB CLI. The three P7 target definitions are recovered but no actual restored database, ACL/RLS/trigger graph or signed transaction has been verified. Prior T39 and WL01–07 receipts remain preserved, no duplicate count. 
- C34 B14-P20C: authentic owner archive contains full private craft completion body. The earlier missing-body search is superseded at archive-source scope. Craft cost rule remains unverified; no explicit GP/wallet/price/fee reference in this recovered function was identified in static inspection. This does not establish no cost elsewhere. Agent A owns C34; pass this receipt to that workstream without editing C34 or redoing P20C-P3. Restored schema, complete provenance and actual signed atomic transaction still HOLD.
- Independent offline full PG17 restore, user-side checksum comparison, 340 Storage object restore and encrypted second copy remain open; not a release GO. No hosted SQL even SELECT, world map, gameplay, main, PR closure, production deployment, agent changes or global writer tally change.

Previous search checkpoint `5611551c803cfe4a25fca5a4dee2f7b545837c23` exact-head docs/tactical workflows #45548014237 and #45548014267 succeeded. **ONE NEXT:** verify isolated restore and source provenance against owner manifest; then source-pinned signed tests for still-unproved exact earned Warlock/recovery/v2 paths and remaining distinct scopes, no repeat of prior established behavior. If independent restore tools unavailable, source-only comparison/graph review may advance with explicit boundaries.

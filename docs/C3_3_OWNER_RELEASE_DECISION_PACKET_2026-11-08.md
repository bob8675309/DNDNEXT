# C3.3 — Owner go/no-go packet for a data-preserving prototype cutover

**2026-11-08 · Review draft · Do not run production SQL, merge, or deploy from this document**

## Release status and exact targets

- Repo: `bob8675309/DNDNEXT`, [draft PR #345](https://github.com/bob8675309/DNDNEXT/pull/345), branch `feature/c3-3-npc-secure-profile-candidate-20261107`.
- Previous last green code+docs head: `62854da256854444d2b56fa711b2958d1c4e305e` (26/26). The new migration audit and production-target review compiler are **subsequent draft commits; verify their final exact-head CI separately**.
- Production Vercel project: `dndnext`, observed running `main` SHA `9437b9d0a2bedc3ba78110c612543f6033674a72` in a READY deployment. Confirm again at cutover.
- Supabase target: connected `DnDWeb` project `ucggczovhmauhshvhusx`, PostgreSQL 17.4, ACTIVE_HEALTHY, us-east-2.
- **User priority:** prototype with no active players, so a brief controlled downtime is acceptable. **No deleting spells, items, existing inventory, merchant stock, recipe/crafting/alchemy records or their associated assets.** Avoid deleting test characters/auth users because associated spell/stock/inventory rows cascade.
- **World-map scope:** PR #345 changes `MapPageClient.js` NPC Bootstrap offcanvas centering/backdrop, but not map movement. Obtain explicit acceptance or isolate the world-map UI modification before merging.

## Completed proofs (disposable only)

1. [Signed original Forge, privacy, inventory and item/spell preservation #42492172483](https://github.com/bob8675309/DNDNEXT/actions/runs/42492172483): source-original staged RLS and authorized role matrix, no deletion of synthetic catalog rows or existing item row.
2. [Atomic SQL commit #42493960667](https://github.com/bob8675309/DNDNEXT/actions/runs/42493960667): four original privacy/inventory candidates applied in **one committed transaction** to disposable PG17, protected synthetic data remained intact, original competing CHECK retired.
3. [Visual original three-page PDF #42452124502](https://github.com/bob8675309/DNDNEXT/actions/runs/42452124502): actual page rasterizations inspected; two bounded overflow layout fixes. Not a lossless long-narrative printout.
4. [2026-11-08 protected data baseline](C3_3_PROTOTYPE_SPELL_ITEM_PRESERVATION_2026-11-08.md): 21 tables, nine row digests; live 1,037 spells, 2,739 catalog items, 1,037 spell effects, 132 recipes, 23 inventory items, 240 merchant-stock rows.
5. [Full migration-history metadata inventory](C3_3_MIGRATION_HISTORY_RECONCILIATION_2026-11-08.md): 243 applied remote migrations, original recorded statement arrays retained; local filenames may match but **cannot be treated as equivalent migration bodies**. No `supabase/migrations/` local history exists. **Do not** run `db push` or rewrite/repair the 243 historical ledger entries.

## New review-only release artifacts

- `scripts/release/c33_compose_production_review_sql.mjs --check`: static exact-Git-blob-source audit for the four candidates. `--out /absolute/private/path.sql` writes the SQL outside the repo for independent review only. It **does not connect to Supabase**, apply changes, or provide an approved backup. Draft SQL includes 21 protected-table counts/digests, GM-secret fingerprints, and Storage metadata before/after.
- `scripts/release/test_c33_compose_production_review_sql.mjs`: checks the compiled draft has exactly one transaction, 21 protected tables and expected role/secret/RLS safeguards; **static validation is not a production-data replay**.
- `scripts/diagnostics/c33_release_preflight_readonly.sql`: safe `SELECT`-only project, migration ledger, grant and Storage metadata preflight.
- `scripts/diagnostics/c33_prototype_spell_item_preservation_readonly.sql`: the 21-table spell/item/recipe/stock/inventory row-hash inventory (run immediately before and after owner-authorized SQL).

## Protected backup / restore verification — **LOCAL CAPTURE VERIFIED; INDEPENDENT RESTORE STILL NOT COMPLETE**

**Current checkpoint (2026-11-09):** The owner has completed a **local** backup of the Supabase DnDWeb Free-plan project and Storage bucket objects. The full operator receipt, **exact Windows access paths**, archive inspection, per-bucket file counts/size totals, SHA-256 manifest location, and read-only recheck commands are in [2026-11-09 local backup capture, exact access paths and verification](BACKUP_RECOVERY_CHECKPOINT_2026-11-09.md). This supersedes this packet's original 2026-11-08 statement that no archive or Storage objects had been captured.

- Database: native PostgreSQL 17 custom archive `C:\PrivateDNDNextBackup\DNDNext-Full-Backup.dump` **16,704,002 bytes**, `pg_restore --list` parsed. Owner supplied critical `TABLE DATA` entries including `auth.users`, `storage.objects`, migration ledger, spells, items, inventory, character stock, recipes.
- Storage: all four buckets downloaded by the official Supabase CLI; live metadata totals and owner-reported file bytes reconcile: **340 files / 453,153,680 bytes**. The location-icons zero-byte placeholder is present in the inventory; the canonical `map-icons` directory is nested under `storage\map-icons\map-icons`.
- Integrity inventory: `C:\PrivateDNDNextBackup\DNDNext-SHA256-Manifest.csv`; SHA-256 calculated for each of **341** local files (including dump), **469,857,682 combined bytes**. Owner shared the aggregate PowerShell result, **not** individual hashes or raw backup bytes.
- Unverified: isolated full database restore (including managed owners/roles/grants/extensions, all protected 21 table count/digests and full 27-entry TOC), isolated Storage rehydration/checksums, independently verified byte hashes against a copied manifest, encrypted second/offline or private offsite copy. **Local capture is not a tested disaster-recovery plan.**

**Do not rely on presumed Free-plan automatic backup snapshots.** Supabase CLI `db dump` defaults may exclude managed `auth`/`storage` schemas; this owner archive used native `pg_dump`, not the source-controlled Windows script or default CLI `db dump`.

**Hard release gates:** Before applying any C3.3 production SQL, `main` merge or Vercel deployment, protect the sensitive backup in a separate encrypted location, recover both database and real Storage object bytes into a disposable environment, validate original spells/items/inventory/stock/recipe rows and related character/auth entities, and obtain explicit owner acceptance of world-map NPC Profile UI plus separate SQL/code deployment approval. Avoid exposing database credentials, GM secrets, backup binaries, private tokens or file SHA inventories in Git/CI/chat.

References: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups), [Supabase Backup and Restore with CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## Proposed short-downtime cutover (future, not performed)

1. **Owner approval checkpoint:** approve the exact draft source SHA, map NPC centering behavior (or removal), security scope, named maintenance window, backup/restore evidence, and *separately* permission to apply live SQL and to merge/deploy code.
2. **Write-pause:** stop player-facing/draft development writes and relevant background processes for the affected tables; no need for extended active-player downtime because there are no players. Avoid altering world-map simulation cron jobs unless separately discussed. No concurrent edit of protected catalogs, spells, stock, inventories or Storage objects while digest checks run.
3. **Preflight:** reread project ref, Postgres/source/RPC/grant fingerprints, 243-entry migration ledger, protected 21-table hashes and 4-bucket Storage metadata. If any mismatch or unverified backup, **abort without changes**.
4. **Apply:** via connected Supabase `apply_migration` with a reviewed unique snake_case migration name and the exact owner-approved SQL transaction; do **not** use uncontrolled `supabase db push` against a repository without the prior 243 migration files. Confirm it records a new history entry and returns no DDL errors.
5. **Verify:** check safe NPC Profile GM vs co-editor vs inventory-only vs outsider role matrix; ensure original 7 historical GM secrets are unchanged, creator-only story authorization holds, inventory DML is correctly restricted, and new `owner_type='character'` equipment can commit. Re-run protected-table hashes and Storage metadata. Fail closed on any mismatch; never relax RLS to get the old UI working.
6. **Web cutover:** only then merge and deploy the **already approved** code, verify Vercel READY source SHA, production pages `/npcs`, `/inventory`, `/town/[id]` and NPC Sheet/PDF/merchant Profile→Shop. Confirm global logout removes GM secret displays. Do not change world-map movement.
7. **Observe and release writes:** until post-cutover tests pass, keep risky data routes held. Given the prototype/no active users, prioritize correctness over zero downtime.

## Failure and rollback policy

- Before SQL COMMIT: fail closed and abort transaction; earlier C3R01–05 proves this in disposable PG17.
- After SQL COMMIT: **a pre-migration UI rollback alone is not safe**, because stage-two column privileges have changed. Keep the affected routes unavailable; prefer a reviewed compatible forward fix.
- **Do not DROP the new creator/private-story tables or relax GM-only readers as an automatic downgrade**. Back up any post-commit new private story/revelation rows, even if they belong to test NPCs. Restore database only with an explicit reconciliation of protected spell/item/stock/recipe contents to avoid overwriting newer legitimate data. Test recovery to a scratch project before any real restore.
- If an existing catalog digest differs unexpectedly or 340 Storage objects cannot be restored, **NO-GO**. The owner’s no-deletion rule overrides release speed.

## Approval status

**Current verdict: HOLD.** Source-locked disposable migration plus role/PDF/Forge tests are strong, but **verified recoverable DB backup, Storage file-byte recovery, production-schema trial of the review compiler, and owner-specific map presentation acceptance** have not all been established. Do not merge #345 or apply the live migration under an implied approval. Ask explicitly when these items are ready.

**No main merge, Supabase DDL/DML, Vercel promotion, Storage edits or map changes were performed to prepare this packet.**

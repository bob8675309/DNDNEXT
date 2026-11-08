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

## Protected backup / restore verification — **NOT COMPLETE**

**Subscription check:** DnDWeb is on the Supabase **Free** plan. Do not rely on paid-plan automatic daily backup entitlement. Supabase CLI `db dump` excludes managed `auth` and `storage` in its default output. A [Windows owner-only raw PostgreSQL 17 backup script and strict 27-table TOC check](C3_3_FREE_PLAN_MANUAL_BACKUP_2026-11-08.md) are now available on the draft branch, but have **not been run against live data**, encrypted, restored or validated for Storage file bytes.

Connected Supabase tools have no backup listing/download or object-byte export/restore action. Neither SQL digests nor a READY Vercel deployment are backups. Before any data/schema release, a project owner/operator must:

1. Inspect **Supabase Dashboard → DnDWeb → Database → Backups** to confirm an actually restorable recovery point is available for the target project, including retention and restore method. Supabase daily backup eligibility depends on the project plan; do not assume it exists.
2. Obtain a **restricted-access** logical or platform database backup preserving the actual schema and row data (including the 21 protected tables, referenced characters/auth entities, migration ledger, and new secret tables when they appear), and **verify restoration to a separate throwaway database/project**. Verify row counts and sample integrity. Never expose auth keys, GM story text, backups, or private URLs in public GitHub CI.
3. Separately preserve the actual **Storage bytes** and verify rehydration, not just metadata. As observed 2026-11-08: `location-icons` **136**, `map-icons` **18**, `npc-portraits` **185**, `town-maps` **1**: **340 total files** across 4 public buckets. The portrait bucket alone reports 448,421,335 bytes. A DB-only backup does not contain those files.
4. Preserve a known working Vercel `main` deployment and its full environment/config references; do not print environment variables or secret tokens into logs. Record the exact target production deploy SHA and a fallback build compatible with the **new** privacy RLS.
5. Save backup verification location and restore evidence in a restricted operator record, not as Git-tracked plaintext. Record operator signoff, backup capture time, restore check, exact Git SHA and latest migration version.

References: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups), [Supabase Backup and Restore with CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). This project’s subscription/backup entitlement has **not** been verified.

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

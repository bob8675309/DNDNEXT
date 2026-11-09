# C3.3 Free-plan manual database backup guide

**Originally prepared 2026-11-08 — script instructions retained; see newer actual-capture checkpoint below.**

> **LATEST ACTUAL CAPTURE (2026-11-09):** The owner has now generated a native PostgreSQL 17 custom database dump on their Windows workstation, downloaded all four Supabase Storage buckets, and produced a local SHA-256 manifest. **This was done using native `pg_dump` and official Supabase CLI, NOT the unexecuted source-controlled script below.** The reported local inventory is **341 files / 469,857,682 bytes** (one DB dump 16,704,002 bytes; 340 Storage entries 453,153,680 bytes). See [2026-11-09 local backup capture, exact access paths and verification](BACKUP_RECOVERY_CHECKPOINT_2026-11-09.md) for **exact local paths, evidence, how to open/check the files, and incomplete encryption/restore gates**. This checkpoint verifies owner-reported local capture and archive TOC, not a successfully restored backup.



The connected DnDWeb Supabase organization is on the **Free** plan. Supabase automatic daily database backups are described for paid Pro/Team/Enterprise plans; do NOT assume Free has a restorable snapshot.

Supabase CLI db dump deliberately omits managed schemas (including auth and storage) in its default mode. Those metadata tables and auth users are important: inventory ownership references auth.users. Do not rely on the default CLI dump alone as a complete source for restoring this campaign platform.

## Prepared Windows backup capture script

Source: scripts/release/c33_capture_sensitive_db_backup_windows.ps1

Uses raw PostgreSQL 17 pg_dump to produce a custom-format archive, avoiding any SQL writes. It requires explicit -CaptureSensitiveBackup; checks that the connection identifies DnDWeb, that the destination is outside the repo, and that PostgreSQL 17 client binaries are on PATH. It prompts locally for the password and does not print it. Requires PostgreSQL 17 pg_dump/pg_restore installed and a private backup drive.

Example, in Windows PowerShell from the repo root, in a single line:

    pwsh -File .\scripts\release\c33_capture_sensitive_db_backup_windows.ps1 -PgHost "db.ucggczovhmauhshvhusx.supabase.co" -PgUser "postgres" -OutputDirectory "D:\PrivateDNDNextBackup" -CaptureSensitiveBackup

The direct connection may require IPv6. Otherwise copy the project-specific Session pooler HOST and USER directly from the Supabase Dashboard Connect dialog. Do NOT share connection passwords with ChatGPT or commit a .env file.

The script verifies that pg_restore --list includes **27 required TABLE DATA entries**: auth.users, storage.buckets, storage.objects, the schema_migrations ledger, characters, character_sheets, and all 21 protected spell/item/recipe/inventory/stock/crafting tables. It writes a structural manifest and SHA-256 checksum; it does not export actual Storage file bytes, encrypt the archive, or prove the data can be restored.

## Hard release gates after archive creation

1. **Encrypt and restrict** the sensitive archive, which may contain auth accounts and GM private text. Store offline or in private encrypted storage. Never put an archive in the Git repo, an open Dropbox sharing link or CI artifacts.
2. **Restore** it to a genuinely separate throwaway PostgreSQL/Supabase database. Raw pg_dump does not include cluster-wide role definitions. The restore environment must have appropriate platform schemas, owners/roles and extensions; do not restore over the connected live project. Any missing table/data or failed grant/RLS restoration means NO-GO.
3. **Independently copy and verify Storage object bytes.** As of the read-only census: 4 public buckets, 340 files total; 136 location icons, 18 map icons, 185 NPC portraits, 1 town map. The database archive contains Storage METADATA, not image/file bytes. Validate object paths, counts and hashes after a separate restore.
4. Capture a private restore receipt with backup timestamp, archive SHA-256, full restore status, all 21 protected table hashes and Storage files. Then rerun the read-only diagnostics scripts before and after the separately authorized migration.

**Current status (2026-11-09):** The **source-controlled script described above still has NOT been run** against DnDWeb or tested on the owner's Windows workstation; however the owner successfully ran **native `pg_dump`**, created a 16,704,002-byte local archive with critical TABLE DATA entries, downloaded 340 Storage entries, and generated a 341-file SHA-256 manifest. See the [local backup receipt and access guide](BACKUP_RECOVERY_CHECKPOINT_2026-11-09.md) rather than treating the older script-status line as evidence that no backup exists. No independent restore, encryption/offsite copy, Supabase DDL/DML/Storage mutation, Vercel deployment or `main` merge is recorded.

Official references:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/reference/cli/supabase-db-dump
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

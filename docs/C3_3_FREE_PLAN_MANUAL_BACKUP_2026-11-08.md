# C3.3 Free-plan manual database backup guide

**2026-11-08 — operator instructions; not executed by ChatGPT.**

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

**Current status:** The source-controlled backup script has NOT been run against DnDWeb or tested on the user's Windows workstation. No Supabase DDL/DML, Storage modifications, Vercel deployment or main merge has occurred.

Official references:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/reference/cli/supabase-db-dump
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

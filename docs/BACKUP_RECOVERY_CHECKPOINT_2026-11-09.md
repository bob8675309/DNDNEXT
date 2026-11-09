# DNDNext — Verified local backup capture and recovery access checkpoint

**Record date:** November 9, 2026 (America/Chicago)  
**Status:** **LOCAL CAPTURE + FILE INVENTORY VERIFIED BY OPERATOR; ENCRYPTED SECOND COPY AND ISOLATED RESTORE NOT YET VERIFIED.**  
**System:** Supabase project **DnDWeb**, project ref `ucggczovhmauhshvhusx` (Free-plan project); GitHub `bob8675309/DNDNEXT`, draft [PR #345](https://github.com/bob8675309/DNDNEXT/pull/345).  
**Authority:** This is a *repository documentation record*, not a cloud backup or an authorization to apply C3.3 SQL/merge/deploy.

## Where the backup actually is — Windows workstation only

The owner performed backup operations on their Windows workstation. **The backup payload is NOT committed to GitHub, held by ChatGPT, uploaded to Dropbox, or verified in independent off-site storage.** Paths below are local to the workstation and cannot be opened from GitHub or by a new assistant without access to that machine.

| Artifact | Exact local path | What it contains |
| --- | --- | --- |
| Backup root | `C:\PrivateDNDNextBackup\` | Private workstation-only backup directory |
| PostgreSQL 17 custom archive | `C:\PrivateDNDNextBackup\DNDNext-Full-Backup.dump` | Database schema and rows, including `auth`, `storage` metadata and migration ledger, subject to connected role / dump permissions; **not actual Storage file bytes** |
| SHA-256 inventory | `C:\PrivateDNDNextBackup\DNDNext-SHA256-Manifest.csv` | Relative file paths, per-file byte lengths, SHA-256 hashes for archive and four Storage folders |
| Location icons | `C:\PrivateDNDNextBackup\storage\location-icons\` | `location-icons` bucket download |
| Map icons | `C:\PrivateDNDNextBackup\storage\map-icons\map-icons\` | **Nested** `map-icons` bucket download; do not count unrelated files in parent `storage\map-icons\` |
| NPC portraits | `C:\PrivateDNDNextBackup\storage\npc-portraits\` | `npc-portraits` bucket download |
| Town maps | `C:\PrivateDNDNextBackup\storage\town-maps\` | `town-maps` bucket download |
| CLI workspace | `C:\PrivateDNDNextBackup\storage-work\` | Standalone Supabase CLI `init`/`link` working directory; **not a backup payload** and may contain CLI config |

Open the local backup directory on that Windows computer:

```powershell
explorer.exe "C:\PrivateDNDNextBackup"
```

Check database archive and manifest existence without modifying them:

```powershell
Get-Item "C:\PrivateDNDNextBackup\DNDNext-Full-Backup.dump","C:\PrivateDNDNextBackup\DNDNext-SHA256-Manifest.csv" | Select-Object FullName,Length,LastWriteTime
```

**This file is the entry point for a future session.** Navigate to GitHub `docs/README.md` → this document; to reach the *actual backup bytes*, use the physical Windows workstation or a future verified encrypted off-site copy, not the repository.

## What was actually done

1. The owner resolved local Windows PATH / PostgreSQL CLI setup and established a working native `psql -W` connection to the Supabase **Session pooler**: host `aws-0-us-east-2.pooler.supabase.com`, port `5432`, database `postgres`, scoped user `postgres.ucggczovhmauhshvhusx`. The direct `db.<project>.supabase.co` endpoint was not necessary. Do **not** put the database password or a password-bearing URI in documentation.
2. On **November 8, 2026, 10:44:44 PM workstation local time**, the owner generated `DNDNext-Full-Backup.dump` using PostgreSQL 17 `pg_dump -W -F c` (native command, **not** the source-controlled `scripts/release/c33_capture_sensitive_db_backup_windows.ps1` or the obsolete v1–v4 recovery launchers). The Windows `Get-Item` result reported **16,704,002 bytes**. `pg_restore --list` successfully parsed its TOC.
3. The owner supplied the actual `pg_restore --list` filtered output. It included `TABLE DATA` entries for `auth.users`, `auth.schema_migrations`, `storage.objects`, `supabase_migrations.schema_migrations`, `public.spells_catalog`, `public.items_catalog`, `public.inventory_items`, `public.character_stock`, `public.recipes`, `public.npc_known_recipes`, `public.player_recipes`, plus other entries. Thus the shown entries are **data-bearing TOC entries**, not merely table definitions. The **entire 27-table required TOC has not yet been explicitly reconciled** and rows have not been restored independently.
4. The owner authenticated to Supabase CLI via browser, initialized and linked a **separate** workspace to project `ucggczovhmauhshvhusx`, and used official `supabase storage cp -r ... --remote --experimental` to **download** the four buckets to local disk. These were source-to-local transfers, not uploads/remote writes. An earlier command using `--linked` worked but emitted a deprecation warning; current CLI prefers `--remote`.
5. The owner checked local file counts and size totals for each bucket; reported exact correspondence to the read-only live `storage.objects` census. One entry in `location-icons` was a zero-byte `.emptyFolderPlaceholder`; it is included in the final 340-object operator inventory. For `map-icons`, the first parent-directory inspection showed two unrelated extra files (20 / 75,896 bytes); the correct **nested** bucket folder matched 18 / 75,760.
6. The owner ran local `Get-FileHash -Algorithm SHA256` against each counted file plus the dump and exported `DNDNext-SHA256-Manifest.csv`. The operator-provided result was **341 files, 469,857,682 bytes**. The underlying manifest/hash strings and file bytes were not transmitted to ChatGPT, so individual SHA-256 matches have **not** been independently recomputed here.
7. Connected Supabase read-only SQL verified the **live Storage metadata** bucket counts/sums below at this checkpoint. Draft PR #345 code and CI evidence remain independent from the backup; no live SQL, Storage mutation, `main` merge, Vercel deploy or world-map source edit occurred as part of capturing this backup.

## Reconciled inventory

| Entry | File / metadata count | Bytes |
| --- | ---: | ---: |
| `location-icons` | 136 (includes zero-byte placeholder) | 1,181,743 |
| `map-icons` | 18 | 75,760 |
| `npc-portraits` | 185 | 448,421,335 |
| `town-maps` | 1 | 3,474,842 |
| **Storage subtotal** | **340** | **453,153,680** |
| `DNDNext-Full-Backup.dump` | 1 | 16,704,002 |
| **Total hashed and inventoried** | **341** | **469,857,682** |

These are operator-reported file-count/byte-total reconciliations against the independently queried live **metadata** inventory. Byte counts and hashes provide a capture inventory; they do **not** by themselves prove restore usability or immutable/offsite recoverability.

## How to verify the local artifacts again — read-only

Run these **single-line** PowerShell commands on the Windows workstation (new terminal session is fine):

```powershell
Import-Csv "C:\PrivateDNDNextBackup\DNDNext-SHA256-Manifest.csv" | Measure-Object -Property Bytes -Sum | Select-Object Count,Sum
```

**Expected:** `Count 341`, `Sum 469857682`.

```powershell
pg_restore --list "C:\PrivateDNDNextBackup\DNDNext-Full-Backup.dump" | Select-String "TABLE DATA.*(users|objects|schema_migrations|spells_catalog|items_catalog|inventory_items|character_stock|recipes)"
```

To **recompute and compare actual SHA-256 values** against the private manifest (not done as part of the original count/sum result), use this single PowerShell line; a returned mismatch count of **0** verifies current local bytes against the hashes saved at capture time:

```powershell
$r="C:\PrivateDNDNextBackup"; $rows=Import-Csv "$r\DNDNext-SHA256-Manifest.csv"; $bad=@($rows | Where-Object { $p=Join-Path $r $_.Path; !(Test-Path -LiteralPath $p -PathType Leaf) -or (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne $_.SHA256 }); "SHA256 mismatches: $($bad.Count)"
```

**Keep the private SHA-256 manifest and the .dump file together in protected storage, but not in Git.** A hash comparison only proves consistency with this manifest, not equivalence to a later-changed live system.

## Remaining release-critical safeguards (not yet complete)

- **Second protected copy:** Encrypt the whole backup set (Postgres archive, four bucket folders, checksum manifest), verify the encrypted archive can be opened and its hashes checked, and keep a separate offline/off-site copy. A machine-local directory is a **single point of failure**. Never put a plaintext archive or GM-secret/auth data into GitHub, a public CI artifact, a public Dropbox share, or chat.
- **Isolated database restore:** Use a separate disposable PostgreSQL 17 / Supabase environment; restore with appropriate managed roles, grants, schemas and extensions (cluster roles are not in `pg_dump`), and verify full TOC, critical row counts/digests, owners/RLS and migration ledger. **Never run `pg_restore` against live DnDWeb** merely to test this backup.
- **Isolated Storage recovery:** Rehydrate bucket bytes into a separate test project using supported Storage API/S3 methods, then compare path inventory and hashes. Restoring `storage.objects` metadata SQL alone does **not** restore the image files.
- **Release review:** C3.3 requires explicit approval for world-map centered NPC Profile/backdrop behavior, production-compatible NPC privacy SQL, and a separately approved `main` merge/Vercel deployment. A passing CI status is **not** a restore receipt or release authorization.

**ONE NEXT BACKUP TASK:** create and validate a **private encrypted second copy** of the 341-file local backup set; then perform a distinct isolated DB+Storage recovery rehearsal. No live changes.

## Related repository references

- [C3.3 Windows backup guide](C3_3_FREE_PLAN_MANUAL_BACKUP_2026-11-08.md) — original procedure, updated to point at this actual capture receipt.
- [C3.3 owner release decision packet](C3_3_OWNER_RELEASE_DECISION_PACKET_2026-11-08.md) — release-gate inventory, not approval.
- [Current active work](ACTIVE_WORK.md) and [append-only handoff log](HANDOFF_LOG.md) — branch-local status and chronological evidence.
- [Draft PR #345](https://github.com/bob8675309/DNDNEXT/pull/345) — contains this documentation **on its feature branch**, not yet `main`.

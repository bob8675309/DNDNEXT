# DNDNext sensitive backup capture - owner-run only, Windows PowerShell.
# No live SQL writes, no schema changes, no Storage object-byte export.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$PgHost,
 [int]$PgPort=5432,
 [Parameter(Mandatory=$true)][string]$PgUser,
 [Parameter(Mandatory=$true)][string]$OutputDirectory,
 [switch]$CaptureSensitiveBackup
)
Set-StrictMode -Version Latest
$ErrorActionPreference="Stop"
$ref="ucggczovhmauhshvhusx"
if (-not $CaptureSensitiveBackup) { throw "Operator -CaptureSensitiveBackup confirmation required" }
if (($PgHost -notlike "*$ref*") -and ($PgUser -notlike "*$ref*")) {
 throw "Database host/direct project or session-pooler user must identify the DnDWeb project ref"
}
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot "../.."))
$dest=[IO.Path]::GetFullPath($OutputDirectory)
if ($dest -eq $repo -or $dest.StartsWith($repo.TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {
 throw "Archive destination must be outside the Git repo"
}
foreach($cmd in @("pg_dump","pg_restore")) {
 if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "PostgreSQL 17 client required: $cmd" }
}
$version=(& pg_dump --version) -join " "
if($version -notmatch 'PostgreSQL\)\s+17\.') { throw "Requires PostgreSQL 17 pg_dump, found $version" }
$prior=@{}
foreach($name in @("PGHOST","PGPORT","PGUSER","PGDATABASE","PGSSLMODE","PGPASSWORD")) {
 $prior[$name]=[Environment]::GetEnvironmentVariable($name,"Process")
}
$now=(Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$out=Join-Path $dest ("dndnext-sensitive-"+$now)
New-Item -ItemType Directory -Path $out -Force | Out-Null
$archive=Join-Path $out "postgres-full-custom.dump"
$manifest=Join-Path $out "backup-structure.json"
try {
 $secure=Read-Host "Enter DnDWeb DB password (not logged)" -AsSecureString
 $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 try { $env:PGPASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
 finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
 $env:PGHOST=$PgHost
 $env:PGPORT=[string]$PgPort
 $env:PGUSER=$PgUser
 $env:PGDATABASE="postgres"
 $env:PGSSLMODE="require"
 Write-Host "Capturing full logical DB backup read-only; no changes to live rows..."
 & pg_dump --no-password --format=custom --compress=9 --file $archive
 if ($LASTEXITCODE -ne 0) { throw "pg_dump failed. Archive is INVALID. Do NOT migrate." }
 if (-not (Test-Path -LiteralPath $archive) -or (Get-Item -LiteralPath $archive).Length -le 0) {
  throw "Archive missing/empty"
 }
 $toc=@(& pg_restore --list $archive)
 if ($LASTEXITCODE -ne 0) { throw "pg_restore cannot inspect archive; INVALID backup" }
 $listing=$toc -join [Environment]::NewLine
 $required=@(
  "auth users","storage buckets","storage objects","supabase_migrations schema_migrations",
  "public characters","public character_sheets",
  "private character_spell_mastery",
  "public ai_item_images","public alchemy_enhancer_effects",
  "public alchemy_reagent_families","public alchemy_recipe_options",
  "public campaign_item_pool_settings","public character_spell_slots",
  "public character_spells","public character_stock","public craft_plans",
  "public crafting_attempts","public crafting_material_effects",
  "public crafting_recipe_rules","public encounter_spell_slots",
  "public inventory_items","public items_catalog","public npc_known_recipes",
  "public player_recipes","public recipes","public spell_effects",
  "public spells_catalog"
 )
 $missing=@()
 foreach($table in $required) {
  if($listing -notmatch ("TABLE DATA\s+"+[regex]::Escape($table)+"(\s|$)")) { $missing+=$table }
 }
 if($missing.Count -gt 0) { throw ("INCOMPLETE ARCHIVE: missing "+($missing -join ", ")) }
 $report=[ordered]@{
  project_ref=$ref
  captured_utc=(Get-Date).ToUniversalTime().ToString("o")
  pg_dump_version=$version
  archive_bytes=(Get-Item -LiteralPath $archive).Length
  archive_sha256=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
  table_data_entries_required=$required.Count
  archive_toc_verified=$true
  restore_to_disposable_tested=$false
  encrypted_storage_verified=$false
  storage_object_bytes_preserved=$false
  release_approved=$false
  warning="SENSITIVE archive; NOT recoverable release signoff until private encryption, separate restore and Storage file copy"
 }
 $report | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $manifest -Encoding UTF8
 Write-Host "TOC contains required tables. Archive folder: $out"
 Write-Warning "Sensitive AUTH/GM data is inside; archive is UNENCRYPTED. Secure/encrypt now."
 Write-Warning "Backup NOT VERIFIED until an isolated restore succeeds and Storage file bytes are separately copied."
} finally {
 foreach($key in $prior.Keys) { [Environment]::SetEnvironmentVariable($key,$prior[$key],"Process") }
}

# C3.3 — First all-four-stage atomic disposable SQL commit PASS (2026-11-08 UTC)

## Verified outcome

[Draft PR #345](https://github.com/bob8675309/DNDNEXT/pull/345) code SHA `11363a2700cdb4cfa633e0af9b47f8690dcfc807` passed **25 of 25 exact-head GitHub checks**. [Atomic original-source PostgreSQL 17 run #42493960667](https://github.com/bob8675309/DNDNEXT/actions/runs/42493960667) was **SUCCESS**. Its job log contains `PASS C3ATOMIC00` (pre-stage source-shaped scratch database), `PASS C3ATOMIC02` (all four SQL candidates committed as one transaction with synthetic existing data intact) and the composer static `PASS C3ATOMIC01/02` evidence. The original signed Forge/NPC GoTrue/PostgREST suites, Next.js town/inventory and 3-page PDF workflows stayed green at this exact head.

This is **new evidence** beyond the older C3R01–05 pre-COMMIT rollback-only tests: an actual `COMMIT` containing **all four** candidate SQL bodies succeeded in a separate disposable PostgreSQL 17 instance.

## Exact code and test paths

- `scripts/release/c33_compose_disposable_joint_sql.mjs`: reads all four research candidates and validates their **exact Git blob SHA-1s** before output; strips **only** their single verified top-level `BEGIN;` and `COMMIT;` wrappers **in memory**; assembles one guarded outer transaction with original source bodies in order, scratch-only identity/source preflight, pre/post row-count/content digests for `spells_catalog`, `items_catalog`, `inventory_items`, `character_stock`, and expected privacy/RLS/CHECK postflight. No DB connections or remote API code. `--check` reports source integrity; `--out /absolute/path/outside/repo.sql` emits a local review artifact. It **refuses production** because the SQL demands disposable `private.test_admins` and pre-stage PG17 research schema.
- `scripts/release/test_c33_compose_disposable_joint_sql.mjs`: static source-fingerprint, exactly-one-transaction and four-table preservation marker tests.
- `scripts/fixtures/c33_atomic_preprivacy_inventory_pg17.sql`: reduced source-backed local fixture, including unchanged live-shape four inventory RLS policies, the original two inventory crafting triggers, both overlapping owner CHECK constraints (older `NOT VALID`), the exact original equipment materializer, two pre-existing synthetic merchant/character inventory records and an existing synthetic GM secret. **Not** an export of real data.
- `.github/workflows/validate-c3-3-atomic-disposable.yml`: starts and disposes of an isolated Supabase PG17 instance, installs original source-backed v2/v3 Forge/legacy NPC readers, creates the pre-stage inventory fixture, composes a single SQL bundle, **commits** it, verifies new RPCs/tables and old CHECK removal, and checks existing synthetic merchant stock, character inventory and GM secret remain.
- Four source candidates stay **byte-for-byte unchanged**: NPC player-safe Profile/sheet RLS stage 1, admin dossier/narrative column ACL stage 2, GM/creator private-story stage 3 and combined inventory CHECK/4-policy RLS candidate.

## Connected development stack was independently inspected READ ONLY

- GitHub `main` and **Vercel production** `dndnext` deployment both point to `9437b9d0a2bedc3ba78110c612543f6033674a72` (verified Nov 8). No production deployment from this PR.
- Supabase DnDWeb (`ucggczovhmauhshvhusx`) runs PostgreSQL 17.4. Verified live existing original helper/RPC fingerprints, five private-narrative column grant assumptions and overlapping inventory constraints; **the four new privacy/client-dependent RPCs and creator-private table are absent**. DB stages cannot be deferred until after the new client goes live.
- Live `supabase_migrations` history reports **243 migrations** (latest `20261019013551 grim_hollow_pg24_species_catalog`). Current GitHub tree has **no versioned `supabase/migrations/` files**. Do NOT silently create a lone migration and run `supabase db push` without reconciling that 243-entry history. Design a reviewed migration-history strategy using current Supabase CLI and a disposable DB.
- The live [21-table preservation manifest](C3_3_PROTOTYPE_SPELL_ITEM_PRESERVATION_2026-11-08.md) reports 1,037 spells, 2,739 item catalog entries, 1,037 spell effects, 132 recipes, 23 inventory rows and 240 merchant stock rows; preserve their row identities, contents and associated Storage assets. Metadata/digests are **not a backup**.
- No players currently use the site; its NPC/character/location data is for development. This may justify a short maintenance window but **not** destructive catalog reseeding or dropping spell/item dependencies. Historic 7 nonempty GM secrets are preserved; source compatibility and RLS privacy still matter.

## Release gates still open

1. **Actual protected backup and restoration proof:** inspect Database > Backups for project plan and recovery availability; independently create/verify encrypted logical backup of spell/item/recipe/inventory/stock and dependent auth/character references when necessary. Supabase physical/daily DB backups may be available depending on plan but do **not** preserve actual Storage object bytes. Do not put backups, credentials, GM secrets or auth users in public GitHub artifacts.
2. **Production-compatible versioned migration:** the successful research composer has a **disposable-only preflight**, and the repository lacks local migration history. Use the appropriate CLI-generated versioned file after history reconciliation; validate production-specific grant, table, function and lock/fingerprint guards plus a safe maintenance/client release order. No automatic migration on `main` while unapproved.
3. **Post-commit recovery:** rollback of a committed schema after user creates new creator-private text/published clues needs safe data retention or a pretested forward fix. The research `ROLLBACK` and atomic commit do not prove this.
4. **Original production parity:** 20/31 creation-adjacent source-original triggers examined/tested across suites, 11 not; two remaining are world-map behaviors that must not be touched absent owner instruction. Synthetic catalogs are reduced, not cloned from real spell/item records; full original catalog, merchant checkout and certain level-up flows remain gaps.
5. **Explicit approval** before merging/pushing `main`, changing live Supabase, or deploying Vercel; separate authorization for real DB migration and its compatible site release.

## Decision

**No merge now.** The best next bounded task is a verified backup/restore and migration-history reconciliation plan, followed by a production-safe migration in the **draft only** and dry-run release packet; request owner approval immediately before any live SQL/merge/deploy. Do not touch world map or any protected spell/item data. No project database, Vercel production or GitHub main mutation occurred in this rehearsal.

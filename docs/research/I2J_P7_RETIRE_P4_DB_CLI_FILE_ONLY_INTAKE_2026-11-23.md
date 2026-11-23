# I2J-P7 — Retire unsafe P4 database CLI; accept only independently exported offline source files

**2026-11-23 CST; GitHub source-only tests only.** No database, restore, production Supabase SQL, signed authentication or gameplay state accessed.

## Root issue and direct fix

P4's historical CLI could execute `psql -h 127.0.0.1` after only checking an operator string flag, PostgreSQL major version and source function MD5s. A localhost port can be a tunnel to a remote Supabase project; a read-only SQL statement still breaches the owner's **no hosted SQL even SELECT** hold. This cannot be reliably proven safe by a CLI using TCP/localhost alone. **Retired that executable P4 CLI**: running it now returns a nonzero `OFFLINE_DATABASE_CONNECTION_CLI_DISABLED_USE_P7_FILE_ONLY_INTAKE`; its `node:child_process`/psql code is gone. P4's original exported pure source-inspection utilities and 13 synthetic tests are preserved for reproducibility.

## New safe intake path (no DB client)

`scripts/audits/i2j_p7_file_only_original_source_intake.mjs` reads only a trusted existing directory OUTSIDE the Git repo holding exactly four files:
- `postgres_version_num.txt`: text value from an independently restored PG17 instance (e.g. `170005`), recorded separately by the offline restore operator, NOT queried by this program;
- `offline_v2_function.txt`: full exact UTF-8 original `pg_get_functiondef` text of `public.complete_character_level_up_v2(uuid,jsonb)`;
- `offline_weapon_mastery_function.txt`: full exact original `public.configure_character_weapon_mastery_v1(uuid,uuid[])`;
- `offline_invocation_recovery_function.txt`: full exact original `public.recover_character_invocations_v1(uuid,jsonb)`.

Operator must first **independently authenticate a complete offline PG17 backup**, restore it to an isolated environment with no tunnel/route to any live database, and export those files separately under explicit owner approval. Do not fabricate original source or self-certify a connected production replica. P7 itself imports only files/crypto/path and the data-only exact fingerprint module, never P4 or a PostgreSQL client.

Run after those four files actually exist:

`node scripts/audits/i2j_p7_file_only_original_source_intake.mjs --ack-file-only-offline-pg17 --input-dir /absolute/path/source-four-files --output-dir /absolute/path/new-candidate-dir --backup-id verified-backup-identifier --restore-receipt verified-restore-receipt`

The output directory must be new, absolute and outside repo and input. P7 pins PG17 source version, original three exact MD5s from the existing 34-writer ledger, unmodified UTF-8 and original function identifiers, then creates a restrictive 6-file P5-compatible candidate bundle. No output occurs until **all** original source fingerprints match. Synthetic tests can inject mock fingerprints only via a directly imported pure helper, never CLI. The generated manifest intentionally states `LOCAL_OPERATOR_CLAIM_ONLY_NOT_INDEPENDENTLY_AUTHENTICATED` and `signed_transaction_executed=false` and `production_release_allowed=false`. P5's separate file-only checker can then independently verify the candidate bundle's contents.

**Even a candidate source match does not establish independent backup origin, live production equivalence, restored ACL/RLS/trigger graph or genuine signed RED→GREEN.** The owner still must verify full DB and 340 Storage-object independent restore and authorize any eventual release.

## Source-only CI

`node --test scripts/audits/test_i2j_p7_file_only_original_source_intake.mjs` verifies the old CLI is now disabled, no source subprocess path remains, rejection of host/SQL flags, no in-repo or symlink evidence, strict 4-file input, PG17 version, exact original MD5, P5 bundle interoperability, and refusal to write when source is missing. These are synthetic tests, not signed/database acceptance.

**ONE NEXT TASK:** owner-approved independent full PG17 restore and offline `pg_get_functiondef` exports; only once independently authenticated original source is available can genuine disposable PG17 GoTrue/PostgREST signed role/replay/rollback RED→scratch GREEN proceed. Original writer coverage **remains 12/34**, 22 untested. No hosted SQL, world map, game deployment, original PR closures, main integration, or paid agents.

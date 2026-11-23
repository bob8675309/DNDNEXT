# I2J-P4 — authenticated offline source extraction intake (operator-only; no real restore available yet)

**2026-11-23 CST. SOURCE-KIT ONLY. No extraction against any real database has been executed in this investigation.** The I2J-P0–P3 historical source analysis and 51 tests remain an independent evidence tier, NOT the 12/34 signed-writer tally. Owner restrictions prohibit hosted production SQL including SELECT, world map/gameplay changes, main merges, PR retirement and paid agents.

## Why this was built

The required authenticated restored original function definitions for these THREE specific original UPDATE writers were not available in the inspected GitHub source, known source-bound Actions artifacts, or targeted Dropbox backup search:

- public.complete_character_level_up_v2(uuid,jsonb): original pg_get_functiondef MD5 **28a227a1dfb9a3cc5516c5b7afb874b0**; historical source delegates a separate v1 account mirror and has a subclass-only direct mirror
- public.configure_character_weapon_mastery_v1(uuid,uuid[]): **32fa55b69478af07f8f0002b967a5704**; authoritative runtime weapon choices + canonical character sheet must persist when legacy account snapshot update is eventually suppressed
- public.recover_character_invocations_v1(uuid,jsonb): **05f6d19a7e2f45d890c62c27cb419e7f**; mounted UI → recovery RPC preserving canonical grants, prerequisites, historicalOrderUnknown flag and rollback protections

To make the next step executable rather than repeat further historical source audits, scripts/audits/i2j_p4_offline_original_functions_export.mjs performs a **strictly operator-invoked, loopback-only** export from a pre-existing independently restored PostgreSQL 17 copy. It uses only fixed-function read-only pg_get_functiondef queries; **do not run it against a port-forward, cloud proxy, live Supabase, staging project, or any unverified host**. Loopback TCP alone cannot establish that the database is a genuine offline restore.

## Operator instructions — ONLY after approved offline PG17 restore exists

From a local checkout, ensure PostgreSQL 17 is independently restored and bound directly to **127.0.0.1** on a known unforwarded port (default **54322**), with verified full backup/restore receipt and already established local noninteractive psql authentication. Do not expose or commit credentials.

Example template (NOT executed here):

node scripts/audits/i2j_p4_offline_original_functions_export.mjs --ack-offline-restored-pg17 --local-port 54322 --db-user postgres --db-name postgres --backup-id verified-backup-identifier --restore-receipt offline-restore-receipt --output-dir /tmp/dndnext-i2j-evidence-new

Use a **new, nonexistent, absolute** output directory OUTSIDE the Git repository, with an existing parent. The script rejects relative or in-repo paths, arbitrary host flags and connection-string DB names. It invokes psql with literal loopback 127.0.0.1, fixed SQL queries, no shell, no interactive password prompt, clear PGHOST/PGSERVICE overrides, and PostgreSQL major-17 check before reading original definitions. It base64-decodes exact original function text without line-ending conversion; all three sources must match recorded function MD5s before writing ANY files. It outputs three source text files and per-function SHA256/MD5 provenance manifests in a private directory with restrictive modes. The v2 manifest is compatible with existing I2J-P1 offline candidate gate.

**Status semantics:** Even fully matching MD5 plus locally supplied backup identifier/receipt yields SOURCE_MATCH_CANDIDATE_ONLY, not independent attestation of backup identity, original roles, RLS, table triggers, current deployed source, real JWT/signed behavior or production GO. Original MD5 was already recorded by prior research; reproducing it proves string equality only. Missing/wrong function/MD5/postgres version aborts without writing. The script does not read or modify any gameplay state or rows, but accesses PostgreSQL catalog text on an **already-authorized, isolated restore** only if invoked by the owner/operator.

## CI proof and next gate

Run node --test scripts/audits/test_i2j_p4_offline_original_functions_export.mjs. Tests are entirely synthetic and inject mock query results and fake source fingerprints; the CLI never permits that override. They assert the three original MD5 pins, refusal without offline operator acknowledgement, loopback-only connection interface, strict path and function scope, pure exact UTF-8 base64 roundtrip, PG17 gate, refusal of mismatch/missing original, and bundle file claims which always remain candidate-only. The GitHub Actions workflow runs only this pure-Node test and **NEVER invokes the exporter CLI or psql**.

**ONE NEXT BOUNDED TASK:** Independently verify owner-authorized full offline PostgreSQL 17 backup provenance and restore from a trusted physical or cryptographically authenticated archive. When those artifacts actually exist, run the local export and the existing I2J-P1 candidate verifier; independently review original v1/v2/Weapon Mastery/Warlock function+ACL/RLS/trigger table graph, then execute genuine local signed GoTrue/PostgREST baseline RED → narrow reversible scratch GREEN tests. Retain all original failing evidence. Signed writer tally stays **12/34** until this happens. Also require complete DB + 340 Storage-object independent restore and explicit separate owner GO for deployment.

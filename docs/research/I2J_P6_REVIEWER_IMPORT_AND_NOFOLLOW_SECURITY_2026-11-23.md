# I2J-P6 — isolate inert reviewer from psql exporter and harden evidence reads

**2026-11-23 CST; SOURCE / TEST ONLY; NO DATABASE ACCESSED.** Independent research branch I2J, from prior verified exact HEAD `ff560fa7fa18d8e248baa59dab30e6fd19115958`. No original PR or agent branch changes.

## Verified structural defect in prior P5

P5 described itself as having no child-process or database imports, yet imported `ORIGINALS` from P4; P4 imported `node:child_process` and exposed a manual psql-backed CLI. Importing P4 does not launch PostgreSQL by itself, but P5's dependency graph was not purely file-only. This false security boundary is corrected: new `scripts/audits/i2j_original_function_pins.mjs` has **data only, zero imports**. P4 re-exports its existing `ORIGINALS` public interface for backward compatibility; P5 and its tests import only the inert data module. Original source fingerprints, manifest versions, file names, and tests remain unchanged.

P5 also previously called `lstatSync(path)` and subsequently `readFileSync(path)`, allowing a pathname to be swapped between checks and read. It now opens a file descriptor with `O_NOFOLLOW`, verifies `fstatSync(fd)` is a regular file and matches pre-open device/inode identity, reads only from that descriptor and verifies length. If `O_NOFOLLOW` is unsupported, the operation fails closed rather than following symlinks. It guards final-component replacement; a malicious attacker who can mutate parent directories can still affect path resolution. The tool is intended for a trusted local immutable evidence directory (prefer Linux or WSL2 with no concurrent writes), not for adversarial multi-user shared directories.

## Verification scope and limitations

CI runs the previous 79 source-only tests plus P6 import-graph/no-follow assertions. The new module itself never performs SQL, network activity, or spawns a process. The P4 executable exporter remains **UNSAFE TO RUN against unverified localhost**: a port-forward can still point at hosted Supabase. Do not run P4 on any endpoint until independent physical restore isolation and owner authorization are proven. No original PG17 backup, full grants/RLS/trigger graph, GoTrue/PostgREST signed RED/GREEN, or Storage backup restoration has been obtained. Original signed-writer tally **remains 12/34** with 22 untested and production release forbidden.

**ONE NEXT TASK:** obtain independently authenticated offline PG17 restore evidence and physically verified endpoint isolation (not self-attested localhost), then use P5 on existing exported text. Preserve all original source, negative regression evidence, and release holds; no hosted SQL even SELECT, main merge, world-map changes, gameplay deployment, production ACLs, or paid agents.

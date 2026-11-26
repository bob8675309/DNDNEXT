# I2J private Origin feat source intake — 2026-11-26 CST

Previous head `fedf33160b7fc95a1c0a8ff3c5b1bec59cc1005a`: actual [payload job 140068737964](https://github.com/bob8675309/DNDNEXT/actions/runs/45865962425/job/140068737964) 7/7 PASS, zero fails/skips. Tactical 45865962350 and docs 45865962296 also success. No repeat of accepted source/schema/payload tests.

Reopened the existing private Dropbox aggregate and review notice: 13 scoped identities, named identity arguments, recorded owner and ACL metadata, definition MD5 pins. Five unresolved Git bodies remain held. The package says PRIVATE SOURCE ONLY and no automatic upload. General approval to proceed is not explicit permission to transfer raw definitions to GitHub or Codex. No private SQL, full schema or backup uploaded. Current execution container lacks docker, podman, psql, postgres and Supabase CLI; no signed runtime result.

## New executable offline intake

`scripts/audits/i2j_origin_feat_private_intake.mjs` checks the original aggregate JSON outside the repo using exact schema/name/argument identity, unique match, complete definition MD5 from UTF-8 bytes, recorded owner and ACL metadata (null is distinct from empty), and emits hash-only receipt with SHA256 and byte length. No network, database, SQL execution, definition output or file writes. Null ACL is not proof of denial. This checks recorded export metadata, not effective privileges, installed source, provenance of the physical archive, or dependency closure. Exact text is required; no silent newline or encoding correction.

Owner-local command from I2J checkout (replace external path):
```powershell
node scripts/audits/i2j_origin_feat_private_intake.mjs "C:\\private\\DNDNext-Original-Functions.json"
```
Use the original raw file, not a connector-rendered copy; do not commit it or redirect the receipt into Git unless reviewed. Eight synthetic tests authored for receipt, exact identity/hash, ACL, missing/duplicate, invalid input and outside-repo boundary; new branch-specific CI pending. GitHub CI runs synthetic inputs only; it cannot certify private original source. The utility is intentionally not a SQL installer.

**ONE NEXT:** verify new synthetic CI, run the file-only intake against the original local export, then stage actual source and schema in an explicitly authorized isolated PG17/Auth lab, without uploading private definitions. Signed Lessons of the First Ones → Alert remains HOLD. Reuse original WL evidence, no stubs substituting real materializer/validator. No new writer count, hosted SQL, main, map, production, agent changes, PR closure or release.

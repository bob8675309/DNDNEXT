# I2J-P5 — inert three-function offline source bundle reviewer

**2026-11-23 CST. SOURCE-ONLY, NO DB OR NETWORK.** No verified independent PostgreSQL restoration has been located or run.

## Concrete trust-boundary finding

P4's manual source exporter uses loopback TCP with `psql -h 127.0.0.1`. This alone does **not** prove it is pointed at an isolated offline restore; TCP loopback ports can be forwarded to remote databases. Prior acknowledgments, embedded MD5s and self-reported restore metadata also cannot prove actual backup provenance. **Do not execute the P4 psql-connected CLI until the local physical restore and endpoint have been independently validated.** Do not query hosted Supabase even SELECT.

The new `scripts/audits/i2j_p5_inert_offline_bundle_review.mjs` is distinct from P4. It cannot connect to Postgres or run SQL: no network/client/child-process imports. It reads **only pre-existing text files** produced by a separately authorized offline process, without writing any result files.

## Reproducible local use, AFTER real restore evidence exists

`node scripts/audits/i2j_p5_inert_offline_bundle_review.mjs --bundle-dir /absolute/private/verified-existing-source-bundle`

Bundle directory must exist OUTSIDE repository, be a real non-symlink directory and contain **exactly six** P4-format files (three original function source text files and their three JSON manifests). Symlink, nonfile, missing or extra entries, bad UTF-8, malformed/extra manifest claims and wrong/inconsistent backup/restore identifiers are rejected.

All three full UTF-8 source bodies must agree with original source MD5 and corresponding SHA256 manifest:
- `public.complete_character_level_up_v2(uuid,jsonb)` — MD5 `28a227a1dfb9a3cc5516c5b7afb874b0`
- `public.configure_character_weapon_mastery_v1(uuid,uuid[])` — MD5 `32fa55b69478af07f8f0002b967a5704`
- `public.recover_character_invocations_v1(uuid,jsonb)` — MD5 `05f6d19a7e2f45d890c62c27cb419e7f`

Even all matches yield `CANDIDATE_ONLY_NOT_AUTHORIZED`, `backup_origin_independently_verified=false`, `signed_original_red_green_executed=false` and `production_release_allowed=false`. The CLI never overrides original MD5 pins or reports source bodies, backup IDs or receipt IDs. Synthetic Node unit tests use an explicit pure-function mock to exercise candidate and negative behavior; **those tests are not genuine GoTrue/PostgREST/PG17 signed transaction acceptance**.

## CI and next bounded task

Source-only CI step: `node --test scripts/audits/test_i2j_p5_inert_offline_bundle_review.mjs`. It only reads synthetic temporary evidence and immutable `ORIGINALS` manifest constants. Keep original signed-writer count at **12/34**, with 22 outstanding and 3 additional UPSERT/private writers still requiring separate investigation.

**ONE NEXT TASK:** Independently identify and authenticate a complete physical offline PG17 backup, confirm local PostgreSQL cannot reach a hosted/project database, and record a real restore audit receipt. Export original function text with an separately authorized offline procedure, review all three text manifests using P5, then run source-original signed RED vs reversible scratch GREEN while preserving canonical game progression, class-choice, Warlock normalized grants and character-sheet snapshots. Independent complete DB + 340 Storage-object restore, world-map protection, full Forge/role/browser testing and explicit owner GO remain mandatory before production use.

Protected: no production SQL, world/town map or gameplay edits, original PR closure/merge, changes to agents A/B/C branches, paid agents, deployment or main modifications.

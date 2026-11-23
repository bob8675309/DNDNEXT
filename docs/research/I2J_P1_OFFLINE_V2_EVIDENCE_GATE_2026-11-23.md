# I2J-P1 — Offline restored PG17 original v2 function evidence preflight

2026-11-23 CST. SOURCE-ONLY candidate gate; NOT a signed PG17 test or proof of live deployed code.

## Source baseline and missing evidence

The independently tested I2J-P0 workflow #45189912512 accepted 11/11 historical source checks for the two account-sheet updates reachable from original level-up v2: its delegated v1 call and its separate direct subclass-account mirror. The 34-writer ledger still marks public.complete_character_level_up_v2(uuid,jsonb) as not_option_a_tested; 12/34 source writers have bounded scratch verification, leaving 22/34. Older v3 source invoked v2, but a later checked-in v3 revision instead calls private.complete_character_level_up_base_v3. These historical files must not be mistaken for a verified current deployed call graph.

A targeted read-only repository-code search found July historical v2 SQL, but no independently authenticated full restored pg_get_functiondef body. Targeted Dropbox metadata searches for level_up_v2, pg17, and complete_craft_plan did not identify an independently restored backup artifact; lack of results does not prove no owner backup exists. We did not query hosted Supabase, even SELECT, to recover a definition.

## Inert offline evidence gate

Only after authorized isolated PostgreSQL 17 restore: export pg_get_functiondef('public.complete_character_level_up_v2(uuid,jsonb)'::regprocedure) as EXACT unmodified UTF-8 TEXT. This must be from a separately verified offline backup, not the running production DB. Use two existing local files:

node scripts/audits/i2j_offline_v2_pg17_evidence_gate.mjs /path/offline_original_v2.txt /path/offline_restore_manifest.json

Manifest required:
- manifest_version = i2j-v2-offline-pg17-evidence-v1
- source_type = independent_restored_pg17_pg_get_functiondef
- postgres_major = 17
- function_identity = public.complete_character_level_up_v2(uuid,jsonb)
- backup_id = opaque offline identifier (non-URL)
- restore_receipt = independent restore audit identifier
- function_sha256 = lowercase SHA256 of the entire exact UTF-8 function text
- function_md5 = lowercase MD5 of entire text, equal to recorded original 28a227a1dfb9a3cc5516c5b7afb874b0

The standalone CLI has NO alternate source-MD5 option. It reads only the two files, verifies hashes and a limited source shape (original identity, SECURITY DEFINER, management guard, delegated v1, subclass resolver, canonical sheet update and second editor-account fanout). Hash correctness and structure are NOT independent provenance, operational semantics, ACL/RLS, or signed testing. On structurally acceptable input output remains CANDIDATE_ONLY_NOT_AUTHORIZED with production_release_allowed=false, offline backup lineage and signed test flags false. Do not use this output alone as GO for testing or release.

## Executable test matrix

node --test scripts/audits/test_i2j_offline_v2_pg17_evidence_gate.mjs

Eleven synthetic pure-Node test cases cover positive candidate-only output; real original MD5 pin; missing inputs; incomplete or falsely labeled provenance; changed SHA/MD5; wrong function version; missing definer/end-of-body; v1 delegation; subclass/canonical guards; direct account mirror and all-editors fanout; refusal to claim signed or release acceptance. Unit tests override expected MD5 ONLY inside import-level synthetic helper calls, and still never report signed success; CLI always requires the historical pinned original MD5. These are simulated SOURCE negatives, not actual original signed RED.

## One next bounded task

Obtain independently verified offline PostgreSQL 17 source definition and schema/roles for original v2 and delegated v1, verify exact source MD5 and backup restoration lineage. Only then run genuine disposable GoTrue/PostgREST/PG17 owner/co-editor/outsider/revoked role checks: original v1 no-subclass RED, separately isolated v2 subclass mirror RED, narrow source-MD5-reversible double suppression scratch GREEN, replay and atomic rollback, preserved canonical level-up progress/events and account history. Reject unverifiable source instead of guessing the function body. Keep all 22 untested UPDATE writers, complete Forge 31-trigger graph, real browser, independent full DB + 340 Storage object restore, and separate owner GO as release blockers.

No production SQL (including SELECT), world map, gameplay, main, original PR, agents A/B/C branches, paid services, deployment, or live roles changed.

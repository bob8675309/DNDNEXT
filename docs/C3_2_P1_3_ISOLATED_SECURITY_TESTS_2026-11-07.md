# C3.2 — Source-only P1.3 command security research extraction

**Research-only source package**, not a deployed P1.3 lock/replay/security fix.

- Held source [#317](https://github.com/bob8675309/DNDNEXT/pull/317), exact old research head `69e741d7c7d8874c22467e2d30791e30c009ff6e`; new independent main baseline `537b570083b3f18faad6d3038c131bee61af273c`.
- **100** original P1.3 fixture, test, read-only-audit, validator and workflow file paths plus two *verbatim* historical source evidence documents safely placed in `docs/archive/p1_3_source_evidence_2026-11-07` to prevent old `One next action` text becoming current.
- All original source blobs are pinned by SHA in [C3.2 manifest](C3_2_P1_3_SOURCE_PROVENANCE_2026-11-07.json). The only controlled adjustments are two research file-path references in `scripts/validate_p1_3_lock_graph.mjs` and the corresponding workflow path filter. No rewrite to lock rules, original SQL, test expected outcomes or source references.
- The existing **newer main** `scripts/validate_p1_2_request_contract.mjs` and current P1.2 design remain unchanged.
- CI jobs require isolated PostgreSQL 16/17 or local Supabase GoTrue/PostgREST loopback; no user credentials or production connection. The suites describe historical original source and source-derived contenders, **not validated installed concurrency/authorization**.
- Original #317 retains 37 historical/ongoing docs and any remaining source material. No old research PR is closed or merged by this extraction. Failed and green workflow results and no installed runtime should be distinguished.
- **Pending at branch creation:** exact-head CI and source review; do not mark complete or merge until both are confirmed. Even green tests do not authorize production RLS/grants or command SQL installs.

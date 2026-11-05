# Feat grant-instance provenance gap — original Forge source, 2026-11-05

> **Held research only. No production SQL or data changed.** Scope: original live DnDWeb function bodies and read-only aggregate counts; disposable PostgreSQL 17 and genuine local Supabase GoTrue test fixture on [draft PR #324](https://github.com/bob8675309/DNDNEXT/pull/324). This document records a **detected source-ordering defect**, not a deployed fix or permission to merge.

## Confirmed facts

- Production `private.sync_character_progression_from_sheet_v1()` source (MD5 `bb1a3a2d1600ce33cd4fcadac5e0f3a9`) responds to the original character sheet `AFTER INSERT` by **inserting `public.character_progression` without specifying `created_by`**. It may run before the public v2 creation RPC reaches its explicit progression insert/upsert that fills `created_by = coalesce(existing.created_by, excluded.created_by)`.
- Original `private.materialize_player_forge_feat_instances_v1()` (MD5 `c27c4181a51cfd018bbb8244e9931550`) is an **immediate AFTER INSERT progression trigger**. It writes `new.created_by` verbatim into `public.character_option_grant_instances.granted_by` and `public.character_option_grants.granted_by`. It does not fetch a verified creator separately or wait for the later upsert.
- **Original-source disposable test reproduced this exact mismatch:** a signed-in Forge player submitted a source-valid XPHB Lucky feat. Both canonical grant tables received a row; the grant-instance `granted_by` was NULL while the progression row's `created_by` was populated with the signed-in player by the end of the RPC. A strict attribution assertion failed in early [workflow run 42040282981](https://github.com/bob8675309/DNDNEXT/actions/runs/42040282981). This is an expected *reproduced source gap*, not a passing actor-attribution assertion. Subsequent tests distinguish grant persistence from attribution.
- **Live production read-only aggregate (no names or secrets accessed):** 3 total grant-instance rows; all **3 / 3** have NULL `granted_by`; all three belong to a character whose **current** `character_progression.created_by` is non-NULL. These counts support a real provenance discrepancy; they do not by themselves prove which creation path produced each historical record. Across `character_option_grants` there were 10 aggregate records, with 3 NULL `granted_by`.
- Grant-instance/grant tables have verified original FKs, unique constraints, JSONB shape checks and five original table triggers (two direct-authority guards, three specialized feat-family hooks). The original source and grant-table shape are reproduced in `scripts/fixtures/forge_feat_materializer_original_pg17.sql`, `forge_feat_materializer_discriminators_original_pg17.sql`, and `forge_feat_materializer_local_auth_extension_pg17.sql`. **J39–J48 status must be independently verified at exact CI head**; source presence alone is not a PASS.

## Why this matters

Canonical grants can exist without durable actor attribution. That harms auditing and owner/GM provenance, particularly when tracing who assigned a feat. An apparently non-NULL progression creator **after** transaction commit does not retroactively fill immutable grant rows inserted earlier.

Do not redefine NULL provenance as acceptable just to pass a regression. A source-original test may confirm the expected baseline gap while keeping **actor attribution correctness FAILED** until a separately tested repair exists.

## Candidate repair boundaries — NOT IMPLEMENTED

Any repair must preserve verified authenticated creator provenance, current permission checks, the intentionally separate GM/NPC service principal model, creator capture semantics held in #321, exact feat/source materialization, and **P1.3 global CP/CS/G/I lock ordering**. Possible approaches for later review include (a) initializing trustworthy progression provenance before immediate grant inserts, or (b) an explicit new-creation, same-transaction finalization step that only fills missing source-grant actors from server-verified ownership. Neither should alter historical/null rows, grant permissions, or unrelated player creations without owner-reviewed migration policy.

**Next engineering gate after J39–J48:** verify actual feat instance and aggregate grant persistence, uniqueness and rollback with genuine local JWTs; then source-audit the provenance repair's transaction order and replay invariance before proposing production SQL. The five specialized grant-table triggers have been imported verbatim for the Lucky negative-dispatch case; this does **not** verify Cartomancer, Echoing Soul, Zhentarim Tactics or Boon of Energy Resistance feature effects.

**Production effects: NONE.** No live data cleanup, migrations, role grants, merges, deployments or world/town map changes.

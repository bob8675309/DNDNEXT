# P1.3 — Public v9/v8 spell entry routing (2026-11-02)

**Scope:** Read-only verified live function definitions and a new source-faithful disposable PostgreSQL 16 routing fixture. No live Supabase mutation, grant, gameplay change, user-data test, AI, or production deployment. Do not merge PR #317 as a runtime fix.

## Direct live checks

- `public.encounter_cast_spell_v9(uuid,uuid,uuid,int,uuid)` MD5 `82f14736b1761ff3a2f9316157d84a4a`: authenticated EXECUTE true; anon false. It retrieves the spell key from the caster's character-spell assignment, delegates `chill-touch|xphb` to v11, and otherwise forwards all five arguments to v8.
- `public.encounter_cast_spell_v8(uuid,uuid,uuid,int,uuid)` MD5 `02d205bd666d56c89f67040859917615`: authenticated EXECUTE true; anon false. It delegates `ray-of-frost|xphb` to v11 and otherwise forwards all arguments to v7.
- Neither v9 nor v8 independently checks the current controlling principal, target visibility, original immutable typed request intent, or unknown-spell policy. These controls must be proven at **each reachable downstream processor**, not inferred from later v13 behavior.
- A missing/unmatched assignment produces a null spell key and falls through to the older route. This is **routing evidence**, not evidence that downstream casting succeeds or that the user bypasses authorization.

## New isolated fixture

- [Exact v9/v8 router SQL](../scripts/fixtures/p1_3_legacy_v9_v8_routing_pg16.sql) copies both live router bodies into a fresh mock database.
- [Disposable PG16 CI workflow](../.github/workflows/validate-p1-3-legacy-v9-v8.yml) runs only on GitHub pull requests or main changes to the fixture/workflow.
- The six calls cover Chill Touch direct v9, Ray of Frost via v9, Ray of Frost direct v8, unknown XPHB fallback, older-edition similarly named spell fallback, and unrecognized assignment fallback. The assertion checks exact route sequence, request identity, caster forwarding and the non-default slot integer.
- **Downstream v11/v7 are intentionally test doubles**: a pass does not prove authorization, action/slot spending, current-turn checks, replay integrity, GM-assisted rejection, real signed-in user behavior, or deadlock freedom. The CI result must be verified at the exact commit before treating the six checks as passed.

## Known security boundary

The live request ledger lacks a persisted immutable original intent, and prior tested downstream v10/v11 processors returned prior cached results for changed targets/slot inputs. Direct v9/v8 authenticated availability widens the call graph that a coordinated security fix must cover. The fixture is intentionally a first routing test, **not** a demonstration of a new external exploit.

## One next task

Install original source-derived **v7→v6→v5→v4→v3→v2→v1 fallback processors and their guarded dependencies** in the disposable test environment, including an unsupported-source/unknown spell that must fail GM-assisted, mismatched assignment and changed-typed-intent replay. Then design genuine signed-in GM/PC/delegated NPC revocation, and full public legacy permission/visibility parity. Keep P1.3/P1.5 open; do not install SQL or change deployed grants until unified lock and replay contracts have independent acceptance evidence.

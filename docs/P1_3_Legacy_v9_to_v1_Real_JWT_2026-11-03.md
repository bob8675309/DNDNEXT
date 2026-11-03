# P1.3 — Genuine local GoTrue JWT baseline for public legacy Cure Wounds (2026-11-03)

**Verification:** [GitHub Actions run 41635156191](https://github.com/bob8675309/DNDNEXT/actions/runs/41635156191) **SUCCESS**, test/workflow commit `16424aabf665133ccdcf6672fc2a58359717d786`. The seven pre-existing P1.2/P1.3/registry/class-browser checks also passed at that same commit. Cases **48–55 passed** in a fully disposable local Supabase/PostgreSQL 17 stack on a GitHub Actions runner. **This research deliberately reproduces insecure behavior; it is NOT a fix or permission for production deployment.**

## Source and environment fidelity

- [Fixture](../scripts/fixtures/p1_3_legacy_real_jwt_local_pg17.sql) installs source-exact DnDWeb legacy public v9→v1 processors from [verified SQL snapshot](../scripts/fixtures/p1_3_legacy_v9_to_v1_live_source_pg16.sql), plus actual DnDWeb `public.encounter_can_control_participant_v1` (MD5 `b91d975f399efb2ed2db8519f633fae7`) and `private.encounter_enforce_spell_slot_cast_turn_v1` (MD5 `78195a807865efdbf74122a3d562a095`).
- [Node runner](../scripts/test_p1_3_legacy_real_jwt_local.mjs) verifies three distinct non-anonymous local GoTrue identities and JWT claims via `signInWithPassword`, `getUser` and `getClaims`; calls the source-exact public RPC through PostgREST using the individual clients. It does not forge `auth.uid()` or `auth.role()`.
- [Workflow](../.github/workflows/validate-p1-3-legacy-real-auth.yml) starts pinned `supabase@2.120.0`, PostgreSQL 17, GoTrue and PostgREST on the CI runner, loads only synthetic fixtures, and destroys the stack without backups. The Node runner refuses execution unless on GitHub Actions CI with local URL and `127.0.0.1:54322` database. No production URL, service-role JWT, GitHub secret, hosted staging database or user account is used.
- **Mocks still present:** local Admin membership, local-only spell/profile/ability/geometry/healing implementations, synthetic grants and a limited RLS SELECT policy. This is real signed-in authentication against original cast processors, **not** a full-production-equivalent authorization/RLS or ruleset test.

## Cases and observed behavior

| Case | Result | Meaning |
| --- | --- | --- |
| 48 | PASS | GoTrue provided distinct GM, directly assigned player and outsider identities; original control helper distinguishes them |
| 49 | PASS | Outsider's new cast denied before any persistent request or spell-slot change |
| 50 | PASS | Original GM-assisted fallback blocks unsupported XPHB and PHB source substitution; hidden-target call denied; no slot spent |
| 51 | PASS | Signed-in controller successfully casts reviewed XPHB Cure Wounds through original v9→v1: one Action, one slot, one log and requester ledger |
| 52 | **PASS / EXPECTED UNSAFE** | Different genuine player JWT obtains prior cached result while changing target, assignment and slot; cached target was marked hidden and ordinary SELECT was RLS-denied |
| 53 | PASS | Original deployed control helper ignores `can_control` alone, accepts `can_edit`, and immediately reflects editor revocation |
| 54 | **PASS / EXPECTED UNSAFE** | The original signed-in player loses direct controller permission; fresh cast on an unused actor is denied, but replay of their earlier request still discloses cached result |
| 55 | PASS | Anonymous session cannot execute public v9 and hidden target remains RLS-invisible to outsider |

**Security interpretation:** A request UUID currently functions as a reusable cached-result lookup for a spell processor, without binding original requester, exact typed intent and current controller/visibility rights at the result return. Cases 52 and 54 confirm this under real JWTs in the disposable environment. Replay does **not** spend an additional Action or spell slot, and the test establishes neither a live production exploitation event nor an installed remediation.

The original permission helper in production is not equivalent to the held delegated combat-only design on PR #312: `can_control` without `can_edit` is intentionally **not** recognized by the old helper. A future coordinated permission change must honor the owner-approved distinction without giving delegates sheet/inventory/secrets access.

## Constraints and next work

- **P1.3/P1.5 still OPEN.** Immutable request intent, requester control/revocation before cache disclosure, hidden-result policy, full public-command coverage, global E/P/L/W/X/S/C/grant lock discipline and owner-approved TC1 Option A admission guard have **not** been installed in DnDWeb.
- The new CI validates a bounded spell path; it does not prove deadlock freedom under concurrent JWT requests or full production triggers and persistence.
- No changes to live database SQL, grants, application combat code, `main`, Vercel, world/town map, AI, or existing production data.
- **Next single task:** Produce a source-complete **P1.3 coordinated immutable replay/authorization + encounter-first lock-order candidate design**, using the confirmed original spell and core-action vulnerabilities and held #312 private candidate as input; test the resulting design across multi-user and concurrent commands in disposable PG/GoTrue before requesting any production cutover.
- **Manual owner test:** None required now. Do **not** test replay vulnerabilities with live player or NPC records. Provide a separate labeled, disposable staging acceptance script if/when gameplay fixes are authorized.

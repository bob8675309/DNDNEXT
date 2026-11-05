# P1.3 — Exact public v9→v1 legacy spell authorization, replay and fallback (2026-11-02)

**Evidence:** [GitHub Actions run 41583471688](https://github.com/bob8675309/DNDNEXT/actions/runs/41583471688), source/test SHA `abd5f4dc6a37103bab012ab04df5b375ca9bd003`, workflow **SUCCESS**; all **seven** GitHub checks passed at the same SHA. Six additional executable PG16 tests (42–47), following the existing successful cases 1–41. These are disposable source-derived tests, **not** live gameplay or a repair.

## Verified source identity and test boundary

On DnDWeb, SELECT-only `pg_get_functiondef` snapshots were captured for twelve original public functions: `encounter_cast_spell_v9`, `v8`, `v7`, `v6`, `v6_pre_1v`, `v5`, `v5_pre_1v`, `v4`, `v3`, `v2`, `v1` and `v1_pre_1v`. They are copied unchanged to [legacy source SQL](../scripts/fixtures/p1_3_legacy_v9_to_v1_live_source_pg16.sql), each labeled with its live MD5. The public v1–v9 entry names are **authenticated-executable**, `anon` cannot execute them; the three `*_pre_1v` processors are not directly authenticated-executable. Earlier source-faithful v10–v13, resource, trigger, and combat fixtures run first.

The disposable PostgreSQL 16 workflow loads exact function bodies and synthetic encounter/character/slot rows. **Auth.uid, role, admin checking, control permissions, targeting, ability profiles, heal/damage and portions of trigger/schema dependencies are mocks.** There is no actual GoTrue-issued JWT, RLS equivalence, external controller or live Supabase mutation. Public v9→v8→v7→v6→v6_pre→v5→v5_pre→v4→v3→v2→v1→v1_pre is exercised where the XPHB Cure Wounds key routes to that older implementation. Dedicated legacy v9/v8 route checks also pass independently.

## Executable cases 42–47

| Case | Observed behavior | Evidence level |
| --- | --- | --- |
| 42 | Unknown XPHB spell reaches original v6_pre rejection: "remains GM-assisted"; Action and request ledger unchanged | Exact deployed processors + mock DB |
| 43 | `cure-wounds|phb` is not routed or accepted as `cure-wounds|xphb`; request ledger unchanged | Exact deployed processors + mock DB |
| 44 | Spell assignment belonging to another character fails the source-owned spellbook check; no request left | Exact deployed processors + mock DB |
| 45 | Valid level-1 `cure-wounds|xphb` heals, consumes one Action and one encounter slot, and records a single completed command; legacy routing reaches exact v1_pre | Exact deployed processors + mocked heal/targeting + scratch slot data |
| 46 | Reuse of a completed request ID while changing **target, assignment and slot 1→2** returns the original cached result without a second heal, action or log | **Unsafe typed-intent replay reproduced** in scratch PG |
| 47 | After the test-only control helper denies new actions to two actors, a previously unused caster's fresh request is denied while the first caster's completed request ID still reveals the original cached result | **Unsafe post-revocation cached replay reproduced** under mocked controller logic |

**Important nuance:** The original slotted spell turn guard rejects a fresh second spell by the *same actor in the same turn* before controller authorization. Case 47 therefore uses a **separate unused caster** with mocked denial for its fresh request, plus the completed prior caster for cached replay. This tests the respective code paths without equating a spent-slot guard with a fresh authorization check. Neither case 46 nor case 47 proves a real outsider exploit; no action/resource double spend is claimed.

## CI repair history

- Initial fixture run failed at case 45 due to an **ambiguous PL/pgSQL variable named `result`** conflicting with a ledger column; renamed the local variable.
- Subsequent run passed 42–46, but case 47 incorrectly expected an authorization error on the already-spent first caster; the original slot-turn guard rejected the fresh request earlier.
- Final fixture isolates an unused revoked actor for the fresh denial, while retaining the original cached replay; **all cases 42–47 passed** at `abd5f4dc`.

No real defect in casting behavior was inferred from these two fixture-design corrections.

## Unresolved acceptance work

1. Reuse the held PR #312 GoTrue/real JWT harness rather than duplicating its auth model. Local disposable Supabase only (or separately authorized staging), never the DnDWeb production project. A signed-in GM and two independently authorized player controllers must be tested for cross-controller cache access, revoked control, and hidden-result confidentiality.
2. Preserve the owner-approved P1.2 typed immutable request-identity contract and TC1 Option A (one canonical actor per active encounter). Research approval does not install either rule.
3. Test all cast variants, command writers, reaction/expiry triggers and resource bridges under a consistent transaction/lock plan before proposing any live migration or grants.
4. Continue explicit unsupported spell GM-assisted fallback and source-version isolation. No silent conversion to generic casts.

**Owner manual test:** None requested at this stage. **Do not reproduce on production characters or share actual credentials.** Before any player-browser acceptance, provide an isolated local/staging setup with synthetic PC/GM/NPC permissions, expected results, and rollback.

**Next single task:** Adapt the existing PR #312 genuine-GoTrue NPC delegate/replay fixture into a non-mutating preflight plus opt-in disposable **legacy v1 Cure Wounds and request replay** test, including distinct signed-in actors, revocation and hidden target/result checks. No main merge, production grant or gameplay mutation.

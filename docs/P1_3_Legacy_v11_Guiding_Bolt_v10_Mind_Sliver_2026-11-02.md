# P1.3 — Public legacy spell paths: Guiding Bolt (v11) and Mind Sliver (v10)

**Verified:** Six additional source-derived PostgreSQL 16 research cases **PASS** (36–41), [GitHub run 41566917343](https://github.com/bob8675309/DNDNEXT/actions/runs/41566917343), job [125690541240](https://github.com/bob8675309/DNDNEXT/actions/runs/41566917343/job/125690541240), tested commit `1f39532841da61010cd2f8b0103beed7cbfbc425`. All **seven** GitHub checks passed. Earlier Guiding-only [run 41566519465](https://github.com/bob8675309/DNDNEXT/actions/runs/41566519465) also passed 36–38.

**Research only:** Deployed function bodies were copied with SELECT-only Supabase inspection and executed on a disposable GitHub PostgreSQL service using mock Auth, character/encounter records, spellcasting profile, attack roll, saving-throw profile, damage and targeting. **This does not prove a live-production incident or a cross-user authorization exploit. No production SQL, grants or gameplay updates occurred.**

## Exact deployed source inventory

| Exact deployed function | `md5(pg_get_functiondef)` | Tested role |
| --- | --- | --- |
| `public.encounter_cast_spell_v13` | `03ea7bd00bcd9734ef70ebc035c54a8d` | Current public spell entry and delegation to v12 |
| `public.encounter_cast_spell_v12` | `2e8bef22f86dca97100e7299d746cef7` | Delegation to v11 for other spells |
| `public.encounter_cast_spell_v11` | `73b12d083ef540d308932f2b89a11d88` | **Encounter-locking** wrapper and slotted-turn guard |
| `private.encounter_enforce_spell_slot_cast_turn_v1` | `78195a807865efdbf74122a3d562a095` | Locks encounter E for levelled spell before delegated processor |
| `public.encounter_cast_spell_v11_pre_1v` | `c810a3015c7e17dc594a39d8aa7306f3` | Guiding Bolt S→C spending, P caster→E→P target |
| `private.encounter_apply_source_turn_end_effect_v1` | `ed2fb5929040caefb406da469a550b8f` | Original Guiding Bolt/Mind Sliver timed effect |
| `public.encounter_cast_spell_v10` | `00d51eafc5eac574f979b88b277c6bb6` | Original Mind Sliver cantrip route, caster P→E→target P |
| `public.encounter_end_turn_v1` | `2785f688af8e200f64f18b6c421f19a6` | Exact P→E end-turn writer for concurrent tests |

Fixtures: [Guiding Bolt setup](../scripts/fixtures/p1_3_spell_v11_guiding_bolt_setup_pg16.sql), [Guiding Bolt source](../scripts/fixtures/p1_3_spell_v11_guiding_bolt_source_pg16.sql), [Guiding Bolt runner](../scripts/fixtures/p1_3_spell_v11_guiding_bolt_race_pg16.sh); [Mind Sliver setup](../scripts/fixtures/p1_3_spell_v10_mind_sliver_setup_pg16.sql), [Mind Sliver source](../scripts/fixtures/p1_3_spell_v10_mind_sliver_source_pg16.sql), [Mind Sliver runner](../scripts/fixtures/p1_3_spell_v10_mind_sliver_race_pg16.sh); [PG16 workflow](../.github/workflows/validate-p1-3-real-admin-paths.yml).

## Guiding Bolt: exact public entry → v11 wrapper/processor

**Case 36 (PASS):** Valid XPHB Cleric level-1 Guiding Bolt via v13→v12→v11→v11_pre hits a synthetic hostile target. Consumes the actor Action, decrements exactly one encounter S snapshot and the character's persistent C slot, writes one spell ledger/log and adds the exact source-turn-end Guiding Bolt advantage effect. Roll and damage functions were mocked. The source `private.encounter_enforce_spell_slot_cast_turn_v1` also ran.

**Case 37 (PASS, typed-intent weakness):** Replaying the same request UUID while changing **target** and **slot level 1→2** returns the *original* Guiding Bolt result. No second spell, damage or slot spend occurred. A **new** request UUID attempting a second slotted spell in the same turn was separately rejected by the original guard (`A spell slot has already been expended...`). **Replay accepted stale intent despite the slot-turn guard**; this is not a proven cross-user exploit.

**Case 38 (PASS, real scratch deadlock):** One connection first holds E, then enters the **original** v11 cast wrapper; another concurrently enters **original End Turn**, holding acting participant P before requesting E. The v11 wrapper/processor proceeds E→P and End Turn proceeds P→E. PostgreSQL reports `deadlock detected`; one transaction aborts, and S/C, spell ledger and spell log remain transactionally consistent. These were both initially valid active-turn requests in a **forced two-session scratch interleaving**. This is stronger than a static class graph but does not prove occurrence in production or across real JWT users. External E prelock was used to force order; a globally safe remedy is not selected.

## Mind Sliver: deeper public v10 path

**Case 39 (PASS):** Exact v13→v12→v11→v11_pre→v10 XPHB Mind Sliver cast consumes one Action, records one spell log, deals synthetic psychic damage and adds `mind_sliver_save_penalty` source-turn-end effect. No spell slot is spent; the v11 guard returns without an E lock for cantrip level 0.

**Case 40 (PASS, typed-intent weakness):** Repeating the request UUID with another target and changing cantrip slot argument from `NULL` to `0` returns the previous target result without applying another cast. The original v10 duplicate branch binds command type and caster participant but **not exact target/slot/assignment/requester intent**.

**Case 41 (PASS, scoped serialization):** Concurrent Mind Sliver and End Turn on the same actor serialize when an external P prelock places v10 first. Cast/effect/log complete once, then End Turn advances, without deadlock **for this schedule**. This does not certify other target/encounter/ledger/reaction permutations.

## Grants and acceptance limits

Read-only live function grants confirm public v8, v9, v10, v11, v12 and v13 cast RPCs are executable by **authenticated** role; the direct `public.encounter_cast_spell_v11_pre_1v` is **not** executable by authenticated or anon. This does not rule out authenticated access through other public wrappers, which must each enforce replay and current control consistently.

**P1.3 and P1.5 remain OPEN.** Next prioritize executable source-derived v9/v8 and older spell branches (without changing source-qualified or GM-assisted fallback rules); genuine GoTrue signed-in PC/GM/delegated NPC revocation and hidden-result privacy; and a unified immutable typed-intent + globally coordinated E/P/L/W/X/S/C/permission lock order. TC1 Option A (one character per active encounter) is approved policy but its admission guard is unimplemented. Historical live overlap must remain untouched until GM review. PR #317 remains draft; no production SQL or runtime changes are authorized.

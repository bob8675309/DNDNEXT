# I1-L — Original EFA Artificer Magic Item Plans at first signed Forge creation

**November 10, 2026. Research-only [draft PR #360](https://github.com/bob8675309/DNDNEXT/pull/360), stacked directly on [I1-K #359](https://github.com/bob8675309/DNDNEXT/pull/359).** The owner's November 9 I0–I6 preserve-every-original-PR sequence controls. No live PostgreSQL mutation, PR merge, Vercel deployment, world-map changes, paid agent enablement, or production release.

## Source identity, read-only live authority

An original non-world-map constraint trigger, `character_progression_materialize_player_forge_artificer_plans_`, runs **AFTER INSERT, DEFERRABLE INITIALLY DEFERRED** on `public.character_progression` and calls `private.materialize_player_forge_artificer_plans_v1()`. It was **absent** from the I1-K signed co-resident local fixture. The original function reads exact `sourceChoices.artificer-plan-slot-N.fields.plan.selections` per slot and original child item fields, validates canonical EFA Artificer source, creates `character_class_option_grant_instances` records (without granting a player physical inventory item) and writes normalized `sheet.classFeatureChoices.artificer-magic-item-plans`.

Original source bodies copied unchanged from the hosted live PostgreSQL `pg_get_functiondef` in SELECT-only calls (and source hash-checked at disposable install):

| Original private function | Live source MD5 |
| --- | --- |
| `artificer_plan_count_v1(integer)` | `3b2a115e3059fcfac280d90a788bc9b9` |
| `artificer_plan_slot_level_v1(integer)` | `4797ebbbbc9888aa02771b0de6afcf30` |
| `artificer_plan_item_is_eligible_v1(uuid,uuid)` | `483bd056efd89e769cdefe97f1c80e62` |
| `validate_artificer_plan_choice_v1(uuid,integer,text,uuid,text)` | `42730b6b8cc5fb57c55799f2b4396bf7` |
| `sync_character_artificer_plan_projection_v1(uuid)` | `5ebf572db01143e9b523c7dba0d43ad5` |
| `materialize_player_forge_artificer_plans_v1()` | `67766989a466b82f170b5e00f9154e24` |

Live EFA Artificer class ID is `46ea4181-2a9c-4f4e-b886-e246b462ed44`. Its level-2 grants are **four Magic Item Plans**, acquired at level 2. The fixture seeds **only six real live EFA plan rows** (four nonrepeatable fixed level-2 plans, one level-2 repeatable common magic-item wildcard and one level-6 fixed plan to verify progression gating), preserving their actual source IDs, canonical keys, repeatability, prerequisites, and `choice_schema`. It does not invent game options.

The wildcard option is `artificer-plan:common-magic-item-that-isn-t-a-potion-a-scroll-or-cursed|EFA` (`f8897bf9-5bb5-4e4f-8280-ad2a2e941112`). Its eligible canonical XDMG specimen is **Prosthetic Limb** `8adeb0df-1434-41f3-8702-1e1e3e0b5da7` (common Wondrous Item). Its ineligible source specimen is **Potion of Comprehension** `d0f8d472-b20f-402b-8405-b65a4330d348` (canonical XDMG Potion; excluded by original wildcard choice rules). Both were selected from live item catalog via read-only SQL; neither is granted or consumed as physical inventory by the plan.

## Implementation scope

- `scripts/fixtures/i1l_artificer_original_plan_materializer_pg17.sql` runs only inside preflight-verified disposable PG17+GoTrue fixture after the exact I1-K source materializer and six previous deferred triggers. It stages six full source-identical functions, exact original constraint trigger, source-identified EFA class/levels, six plan rows and two source-identified magic item rows. Function MD5 and seven-trigger cumulative subset are checked before genuine signed creation. Roles `PUBLIC`, `anon` and `authenticated` get no direct private EXECUTE.
- `scripts/test_i1g_warlock_original_guards_joint_local_auth.mjs` appends gated `DNDNEXT_I1L_LOCAL_CONFIRM=DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY` tests **after all previous I1C–I1K cases**. Earlier original positives, negatives and their historical RED controls are unmodified. Genuine local GoTrue/PostgREST signing exercises original Forge RPC and private Story/nonce transaction.
- `.github/workflows/validate-i1l-artificer-original-local-auth.yml` runs on loopback using pinned Supabase CLI v2.120.0 with disposable PG17, GoTrue and PostgREST; prior I1-G/H/I/J/K signed workflows remain separate regressions.

## Signed acceptance criteria — do not claim PASS without exact-head CI

| Case | Evidence sought |
| --- | --- |
| **I1L-01** | Exact six original hashes, EFA class/plan canonical source, level 2 = 4 slots, level 6 = slot 5, original wildcard eligibility for XDMG Prosthetic Limb but not potion |
| **I1L-02** | Real signed EFA Artificer level-2 initial creation commits 4 distinct fixed plan grants, normalized `classFeatureChoices` projection, private Story/nonce and source gear/currency |
| **I1L-03** | Exact nonce replay leaves grants, sheet, inventory and Story intact; changed Story and foreign actor denied |
| **I1L-04** | Signed canonical wildcard with real XDMG Prosthetic Limb child and 3 fixed plans produces four normalized grants + source item metadata, without physical inventory materialization |
| **I1L-05** | Missing required fourth plan slot rolls back entire transaction |
| **I1L-06** | Duplicate nonrepeatable plan rejected by original validator |
| **I1L-07** | Level-6 plan at level 2 rejected by original min-level gate |
| **I1L-08** | Wildcard missing mandatory concrete item child rejected |
| **I1L-09** | Ineligible canonical potion child rejected by exact original item eligibility |
| **I1L-10** | Forged/unknown EFA plan key rejected |
| **I1L-11** | Non-Artificer original bypass, seven original cumulative deferred triggers, previous I1C-K Wizard/Battle Master/Warlock/Eladrin/Khoravar source state and Stage4 RLS intact |

**Important:** Magic Item Plans are normalized plan authority, not item-crafting, a merchant purchase or physical player inventory award; `materializesInventory=false` is explicitly checked. This is a source-faithful, *reduced* test catalog; the Artificer original starting-equipment helper in this research stack still uses its explicitly marked reduced fixture and is not full source-level starting-equipment production parity.

## Original-source RED discovered — NULL parent initialization defect

The first full source-identical signed run at code commit `11ca716edc11eba5ddb6b5793a02a06ca1701ee5` [failed at the Artificer projection assertion](https://github.com/bob8675309/DNDNEXT/actions/runs/42923394334/job/130203604083) after the source-hash/eligibility gate passed and **four normalized grants were committed**. The first harness error used `JSON.parse` on an empty SQL result; a subsequent *diagnostic-only* run at `72a440b59a34f49b227a165200cf2210eeb5fb2f` [proved the actual database state](https://github.com/bob8675309/DNDNEXT/actions/runs/42923831695/job/130205132742): `sheetExists=true`, `planGrantCount=4`, `classFeatureType=null`, `projectionPresent=false`. All previous I1C–I1K signed checks still passed in that run.

The unchanged original `private.sync_character_artificer_plan_projection_v1(uuid)` (MD5 `5ebf572db01143e9b523c7dba0d43ad5`) contains:

```sql
if jsonb_typeof(v_sheet->'classFeatureChoices')<>'object' then
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices}','{}'::jsonb,true);
end if;
v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices,artificer-magic-item-plans}',v_group,true);
```

When `classFeatureChoices` is absent (as on a fresh shared Forge sheet), `jsonb_typeof` returns **SQL NULL**. The PL/pgSQL `IF` does not enter for a NULL condition, and `jsonb_set` with `create_missing=true` **does not create missing intermediate parent objects**. Both facts were independently confirmed with **read-only** live PostgreSQL `SELECT` probes. This is a real **original-source creation/projection parity defect reproduced in a reduced signed local environment**, not an error to suppress by skipping the projection assertion.

A **separate disposable-only research candidate** is staged in `scripts/fixtures/i1l_artificer_projection_null_parent_candidate_pg17.sql`. The candidate is copied from the exact original live `pg_get_functiondef` but changes **one** condition to:

```sql
if coalesce(jsonb_typeof(v_sheet->'classFeatureChoices'),'')<>'object' then
```

The candidate SQL requires original source MD5 first and verifies the patched definition converts back to the exact original fingerprint if and only if that one check is reversed. The original full-source fixture and all other five original private plan functions remain unchanged. The I1-L signed harness now **first creates a genuine signed source-original RED character** (four grants, absent projection, immutable Story/nonce), then applies the candidate only to disposable PG17, then **creates fresh new characters for GREEN acceptance**. It never privilege-inserts plan grants or retroactively patches the RED character. The **source-original release gate remains RED**: green candidate evidence is a *proposed fix*, not a statement that unchanged deployed source is already correct.

**Do not run the candidate on hosted Supabase or merge it into the production SQL history without separate owner approval and expanded authorization/browser/recovery validation.**

## Verification and release hold

**At first publication (superseded by the source-original RED discovery above):** signed I1-L workflow at code-head `11ca716edc11eba5ddb6b5793a02a06ca1701ee5` and the earlier signed regressions have been triggered; their conclusions must be independently verified. If a source-exact function fails with a real error, preserve it and adjust only bounded disposable schema/fixture or test assertions where appropriate. Do **not** change the original source body or weaken the negative checks to force a passing test.

**No promotion:** Not all 31 original creation-adjacent triggers or full source catalog priority/RLS/grant graph are co-resident; all-class source-original Forge, multi-client browser acceptance, CP/CS/G/I concurrent lock ordering, real crafting/Long Rest, full encrypted second backup and isolated PostgreSQL+Storage bytes restoration, and production go/no-go are outstanding. The two original world-map travel/resting triggers are deliberately protected. Original held PRs must not be closed/merged in bulk, optional paid #325 remains last/OFF.

**Next single action:** inspect exact source/test-head CI and correct only genuine bounded fixture/test bugs without altering source hashes; preserve the code-head receipt, update the final documentation-inclusive head and recheck all signed independent suites before declaring I1-L research acceptance.

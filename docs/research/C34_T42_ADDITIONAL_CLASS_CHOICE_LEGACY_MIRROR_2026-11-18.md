# C34 T42 — Sorcerer Metamagic original additional-level class-choice account mirror (signed helper-only ACCEPTED; release HOLD)

**When:** 2026-11-18 CST / 2026-11-19 UTC.  
**PR:** [draft #379](https://github.com/bob8675309/DNDNEXT/pull/379), `research/c34-clean-main-privacy-forge-joint-source-20261112`.  
**Executable HEAD:** `1e08f7c0c87d4f498bea69b1259244e3594c14dc`. [Full inherited signed PG17/GoTrue/PostgREST/Next/Chromium workflow #44451498737](https://github.com/bob8675309/DNDNEXT/actions/runs/44451498737) **SUCCESS**, [job #135316302086](https://github.com/bob8675309/DNDNEXT/actions/runs/44451498737/job/135316302086). [Source-only #44451498940](https://github.com/bob8675309/DNDNEXT/actions/runs/44451498940) **SUCCESS, five T42 source tests plus inherited suites**.

## Reason T42 was genuinely new

Historical original [#364](https://github.com/bob8675309/DNDNEXT/pull/364) `scripts/test_i1p_earned_rest_local_auth.mjs`, original Git blob `4c9a0935cbfe7c979ff38eadd401d54a1213efb9`, tested signed `complete_character_level_up_v5` featureless **Fighter 1→2**, plus separately tested original Rest; it did **not** select Sorcerer Metamagic or Warlock Mystic Arcanum. The current source-authoritative Level Up UI `components/CharacterLevelUpChoices.js` passes `class_choice_selections` through signed `public.complete_character_level_up_v5`, which delegates through v4/v3 to the private additional class chooser.

**Original migration and custody:** `sql/20260808_18_metamagic_mystic_arcanum_progression.sql`, Git blob `ce7d4ec3f37eeb0a29b8a07cd64609ee9627642f`; original normalizer `sql/20260806_00_player_forge_source_choice_foundation.sql` blob `3df1c688ad4a23085c0cdde1a14da10bd77f4fec`; original simple class group `sql/20260808_16_simple_class_choice_delta_authority.sql` blob `2e70facd2b5905bf85a63697ed0f895feb27aad5`. Historical read-only DnDWeb November 11 `pg_get_functiondef` census recorded helper source MD5 `c847b3656b1f006f4020d2b23f73efcc`. That historical metadata was **not re-queried live today**; the new fixture pins exact checked-in original migration bodies, not an asserted same-MD5 live function copy.

## Source-verified defect and extra case

`private.apply_additional_level_class_choices_v1(uuid,integer,jsonb)` correctly authorizes source option names/counts, duplicate exclusion, and Sorcerer Metamagic permanent `classFeatureChoices` serialization (and has a distinct Warlock Mystic Arcanum `character_spells` branch). After writing target `public.character_sheets.sheet`, the original function unconditionally executes:

```sql
update public.players p
set sheet=v_sheet,updated_at=now()
where p.user_id in (
  select cp.user_id
  from public.character_permissions cp
  where cp.character_id=p_character_id
);
```

The actual original migration spells this on one line. Critically, this final mirror contains **no `cp.can_edit` predicate**. An account associated merely as a read-only character viewer may have its entirely different historical `players.sheet` replaced by the canonical target character, despite lacking permission to submit or even request progression choices.

## Exact signed evidence and honest boundary

Test entry `scripts/integration/c34/test_t42_additional_class_choices_signed_pg17.mjs` enforces `CI=true`, GitHub Actions, local loopback 127.0.0.1 ports 54321/54322, PostgreSQL 17, existing C34 guard, no protected world-map departure trigger, unique T42 confirmation marker and original migration Git blobs. It installs the source-original private group generator and helper, normalize helper, and real `public.get_character_level_class_choice_options_v1`.

**A key limitation:** C34 does not include the complete original public earned `complete_character_level_up_v5` transaction in this test. Mutation is called only through a disposable `public.t42_local_additional_choice_probe_v1`, an **explicitly NON-ORIGINAL, local-only signed SECURITY DEFINER wrapper** that enforces original `private.can_manage_character_progression_v1` and constrains testing to Sorcerer level 2. This proves the original helper's signed behavior in reduced source-shaped C34; it is **not** real original earned-v5 or real Level Up browser acceptance. It must not be promoted to an application migration.

- `PASS T42-ORIGINAL-SETUP`: exact migration sources, real signed getter, no direct authenticated private-helper execution, separate local wrapper, no earned-v5 assertion.
- `PASS T42-ORIGINAL-NEGATIVES`: genuine signed owner gets source options; outsider, `can_edit=false` viewer and anonymous actors denied; invalid, duplicate and missing choices rejected without account/canonical changes.
- `PASS T42-ORIGINAL-SIGNED-RED`: source-legitimate Quickened and Subtle Spell choices saved in target canonical Sheet, but **all three separately marked linked owner, editor and read-only viewer historical account Sheets overwritten**; unrelated canonical character unchanged.
- `PASS T42-OPTION-A-SOURCE`: separate and explicitly NON-ORIGINAL scratch candidate removes **only** the whole-account `UPDATE public.players` clause; original source SQL file, private source options validation, canonical update and permissions remain intact.
- `PASS T42-OPTION-A-GREEN`: legitimate Careful and Distant Spell choices persist on a separate Sorcerer; all three independently seeded historical account snapshots (including read-only) remain frozen. Duplicate and fabricated selections still denied; unrelated canonical Sheet retained.
- `PASS T42-OPTION-A-REVOKE`: same existing JWT loses character edit right immediately after DB permission update; distinct already-linked allowed editor can still add new valid choices; accounts remain frozen.

The first source-only run [#44451342810](https://github.com/bob8675309/DNDNEXT/actions/runs/44451342810) failed ONLY a new test mistakenly expecting held #364's historic runner file inside current C34. The source-only fixture was corrected to inspect the *existing* P1.3 featureless Fighter source in the current branch; no original PR file was copied, edited or retired. [Corrected source-only #44451498940](https://github.com/bob8675309/DNDNEXT/actions/runs/44451498940) **SUCCESS (5/5)**; full signed T1–T42 workflow **SUCCESS** at above executable SHA.

## Unchanged systems and remaining gates

The executable research commit added only two T42 JS scripts and two additive workflow steps. The unchanged original Sorcerer/Warlock migration, source chooser, private normalized options, original P1.3 and I1-P evidence, NPC/privacy, 19 deployed tactical spell adapters, inventory/merchant, separate town/world/tactical maps, Next Pages Router and Bootstrap/SCSS must all remain intact.

This does **not** fix deployed SQL, verify a current hosted `pg_proc` MD5, execute the full `complete_character_level_up_v5` path, sign real Sorcerer or Warlock Forge creation, validate Warlock Mystic Arcanum spell grants or rest cadence, prove gameplay UI, verify concurrent level-up locks, perform independent recovery or establish any actual historical user-data damage. **Global 22/34 legacy Sheet-writer release gate unchanged**. Production main, Supabase SQL/data/RLS, Vercel, protected world map, original draft PRs and paused paid automation untouched. Independent encrypted PostgreSQL restore **and all 340 Storage objects** and explicit owner release approval remain blockers.

**ONE NEXT bounded T43:** preserve all T1–T42 and held #364 evidence, stage a separate genuine local-auth `complete_character_level_up_v5` original transaction with source-owned Sorcerer 1→2 options, Warlock Mystic Arcanum at the first eligible level, concurrent/negative/rollback tests, then original linked-account RED and separately scoped Option A GREEN in a compatible scratch DB. Do not substitute the T42 wrapper for the original transaction, silently install partial production migration, or merge #379.

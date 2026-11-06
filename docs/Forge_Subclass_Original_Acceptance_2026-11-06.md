# J142–J153 — Original Forge subclass-choice BEFORE INSERT trigger

**Research-only. Not merged.** Headed to draft PR #324 stacked on privacy PR #321. This file describes source-constrained acceptance only, not game runtime or released database behavior.

## Source inventory and scope

- Live `character_progression_apply_forge_subclass_v1` is `BEFORE INSERT ON public.character_progression` and calls `private.apply_character_forge_subclass_choice_v1()`.
- Verified live SELECT-only `md5(pg_get_functiondef)` = `273be29420a7274d997642e302604cb7`. The exact returned function definition is installed only in disposable PostgreSQL 17.
- The previously reduced table lacks `level_choices`, added *only* for scratch fixture. The existing fixture already has `subclass_name`, `subclass_source`, `class_feature_catalog`, original v2/v3 creator functions and signed real GoTrue/PostgREST actors.
- The new reduced catalog contains three **source-identified** Fighter subclass feature specimens at level 3: XPHB Champion, PHB Champion, XPHB Battle Master. These are NOT the full original feature grammar, an exhaustive source catalog or a rewrite of rules.
- The original source calculates first available subclass level from catalog records; `shared_character_forge_player_v2` creator marker requires an eligible player to select at that level. Real v3 calls v2 before the trigger; test this instead of inferring v3 bypass.

## Bounded signed acceptance

- J142: original source MD5, exact trigger event/handler, reduced class catalog fixture.
- J143–J144: genuine v2 levels 1/2 without subclass accepted and no unexpected level choices.
- J145: genuine level-3 omission refused by original error; nonce/CP/CS/G/GI/I/C/stock atomic rollback.
- J146: premature XPHB Champion refused at level 2, original error/rollback.
- J147: genuine level-3 XPHB Champion selected with source, entry level 3, v2 creator, one source-owned Lucky grant/starting gear/currency.
- J148: original source behavior with an **explicit** PHB Champion on XPHB Fighter recorded (does NOT claim 2024 edition policy validates cross-edition choice).
- J149–J150: unknown subclass and invalid explicit source rejected atomically.
- J151: absent-source Champion selection observed without asserting a 2024-preferred result; source sorts/ties are an independent product decision.
- J152: same nonce source-qualified subclass replays inert; source alteration rejects 22023; no CP/CS/G/GI/I/C mutation.
- J153: genuine v3→v2 signed-in path preserves original v2 creator marker and immutable replay.

## Gates and stop conditions

Do not install SQL in live Supabase, alter original MD5/source, loosen original error assertions, disable original deferred validators, or infer true production RLS/catalog parity from this reduced test. Preserve J00–J141. **First run MUST be green at exact head before accepting this new trigger.** A passing static 15/31 original DDL audit alone is not enough. Prior `forge_trigger_acceptance_receipts.json` intentionally stays at 2 old targeted receipts until verified J142–J153 run evidence.

Vercel previews remain temporarily suppressed project-wide for zero-cost research; project production is not being deployed. The next task is CI diagnosis and fixture-only correction, then an exact-head historical JWT receipt after successful authenticated validation.

## Exact-head authenticated J142–J153 acceptance — VERIFIED

[Full source-original PG17/GoTrue GitHub Actions run 42223567299](https://github.com/bob8675309/DNDNEXT/actions/runs/42223567299) **SUCCESS** on held PR #324 SHA `29d8700ead5db3a7f2292aa6f9be8eb3b859471c`. Both original PG17 replay and genuine local GoTrue/PostgREST J00–J153 succeeded. Original `private.apply_character_forge_subclass_choice_v1()` unchanged MD5 `273be29420a7274d997642e302604cb7`, original BEFORE INSERT trigger, all J142–J153 PASS, v2 and v3 real signed-in creator evidence, negative 42501/SQL-state boundaries as applicable, source-qualified level-3 selection and atomic source-resource rollback demonstrated in reduced local fixture. Prior J00–J141 tests remain intact.

**Important finding (do not hide as green 2024 rules):** In the reduced fixture with live-source-identified PHB and XPHB Champion options, a 2024 XPHB Fighter level-3 sheet specifying `subclassName: Champion` but **omitting** `subclassSource` resulted in `PHB` at J151. Explicit XPHB selected XPHB correctly. The deployed handler orders tied candidate sources without an XPHB preference in this case. This is a **fixture-observed source-selection policy gap**, not a claim of deterministic behavior on every live catalog; preserve as a potential release blocker and separately inspect the Forge UI's source selection. No original function alteration is authorized by this research.

**Checkpoint:** 15/31 original creation-table trigger DDL staged, 16 unstaged, 0 mismatches, **three** conservative individually authenticated trigger receipts (tag guard, portrait sync, subclass selector). Other staged originals may have exercised branches in J00–J141 but lack individual complete acceptance receipts. Full production RLS/catalog/locks/browser/staging unproven. PR #324 and #325 remain draft, with no production SQL/game code, merge, model call or Vercel deployment.

## Player-interface source propagation — read-only review and free static guard

A current draft-source review of `components/NewNpcModalV3.js`, `components/NpcForgeClassChoiceContext.js`, and `utils/classes/subclassCompatibility.js` found that normal player selection *does* populate both `sheet.subclassName` and `sheet.subclassSource` (plus matching `meta` keys), because the resolver discards options without source and the Forge requires an eligible subclass option before submitting. The `playerPayload` spread preserves this source when calling `create_player_character_v3`. A **static J154 regression assertion** checks that these source-propagation touchpoints remain present.

This lowers the risk through the current UI but is **not an end-to-end browser test**, nor is it a server-enforced source requirement. Direct authenticated RPC callers, legacy/imported sheet writers, or future UI changes may still omit `subclassSource`; J151's PHB selection remains an explicitly observed, reduced-fixture risk. Do not change the original live function or rewrite 2024 edition policy without a separate reviewed design decision.

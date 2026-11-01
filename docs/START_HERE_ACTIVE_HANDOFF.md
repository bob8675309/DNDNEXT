# DNDNext — START HERE: Active Development Handoff / Recovery Protocol
_Last editorial checkpoint: 2026-10-31. This file is a **live handoff**, not a verified substitute for GitHub, Supabase or CI._

> **LATEST RESEARCH CHECKPOINT (P2 transactional candidate, 2026-10-31):** Held draft [PR #312](https://github.com/bob8675309/DNDNEXT/pull/312) now includes [a separate private, ungranted transaction-integrated v11 candidate](Spell_Recipe_P2_Transaction_Candidate_2026-10-31.md), not just the earlier wrapper. It was derived from the historical v11 SQL whose **complete 16,658-character body** was compared to the current live `v11_pre_1v` function and found identical. It moves controller, target-visibility and request-intent checks under caster/encounter/target locks; preserves the six reviewed v11 attack branches and original damage/slot/log machinery. Disposable PG16 multi-family and two-client duplicate/competing-command tests passed at exact SHA `8c1927bcc23df7d3f66ec215903360321f874d9d`; **reverify current SHA CI**. Existing public RPCs are unchanged and remain executable; this private research candidate is not installed. **No real Supabase Auth staging project was available**: only production DnDWeb is connected. Genuine two-user JWT/PostgREST/browser tests still not done.
>
> **SINGLE NEXT TASK:** Audit mixed old/new lock order and all relevant public spell RPC delegation before considering a transition plan; prepare a disposable non-production GoTrue/PostgREST acceptance harness with two ordinary users. Do not use the production project, deploy any SQL/grants, pay for staging, merge branches or change combat UI without explicit owner approval.

> **Research-branch P2 continuation (2026-10-31):** The P1 compiler research remains on held draft #309. Separate stacked **draft PR #312** (`work/spell-recipe-p2-shadow-parity-20261031`) now contains a seven-live-plus-one-held spell contract matrix and **controlled Fire Bolt shadow fixtures**. This section is branch-only research, **not on production main**; see [Spell_Recipe_P2_Shadow_Parity_2026-10-31.md](Spell_Recipe_P2_Shadow_Parity_2026-10-31.md). Verify latest head and CI. Do not infer executable recipes or cast approval from source tests.


> **For every new chat/assistant/developer:** Start here BEFORE editing code. Read the owner decision ledger and the pre-pivot audit, then verify the current exact branch, base, open PR, latest CI and live backend. Avoid asserting full understanding merely because a summary seems comprehensive. Write down any missing source or unresolved discrepancy. **Do not repeat completed work or promote unmerged research into production.**

## Current focus and fixed owner direction

**Active technical project:** DNDNext composable, source-qualified tactical spell recipe engine, designed for human controllers and future Actor AI. **Current work is research/specification and isolated tests**, not a live executable interpreter. Prior standalone Eldritch Blast beam planner/casting research remains a held draft and is a test oracle, not an approved production cast.

**Owner-approved decisions (2026-10-31), complete and binding:** [SPELL_ENGINE_DECISIONS.md](SPELL_ENGINE_DECISIONS.md). Six answers: 2024 XPHB first, other source editions consulted only when needed and kept separate; **spells first** rather than broad overhaul; unimplemented spells remain GM-assisted; future **Admin visual recipe builder**; future **opt-in AI NPC/monster autonomy** with GM/manual/AI-off controls; original source spells preserved, house-rule overrides versioned separately. **Do not ask again** without a concrete conflict.

**Strategic reason:** The project already has independently tested spell casting, targeting geometry, effects, source grants and resources. Extending another independent RPC for each of hundreds of spells is inefficient; converting all spells automatically is unsafe. Implement a bounded, typed, composable recipe plan that orchestrates **existing server-owned primitives**, proves parity incrementally, and eventually supplies the **same legal-action surface for humans and AI**.

### Order of reading — do not skip the dependencies

1. **This file + [SPELL_ENGINE_DECISIONS.md](SPELL_ENGINE_DECISIONS.md)** — what is approved, what is active, exact next step.
2. **[Spell_Engine_PrePivot_Audit_2026-10-31.md](Spell_Engine_PrePivot_Audit_2026-10-31.md)** — sources inspected, verified vs inferred, hard requirements, audit limits, archived research and risk register.
3. **[Composable_Spell_Engine_AI_Readiness_2026-10-31.md](Composable_Spell_Engine_AI_Readiness_2026-10-31.md)** and [Tactical_Spell_Mechanics_Review_2026-10-31.md](Tactical_Spell_Mechanics_Review_2026-10-31.md) — architecture, geometry/resolution/effect families and reviewed catalogue exceptions.
4. **[DNDNEXT_AI_INTEGRATION_FOUNDATION.md](DNDNEXT_AI_INTEGRATION_FOUNDATION.md)** and [DNDNext_Effects_AI_Current_Handoff_2026-10-24.md](DNDNext_Effects_AI_Current_Handoff_2026-10-24.md) — AI architecture, authority boundaries and source grant/effects history. **The latter's “current open drafts” list is historical**; re-check GitHub.
5. **[Tactical_Encounter_Combat_Roadmap_Blueprint.md](Tactical_Encounter_Combat_Roadmap_Blueprint.md)** plus each relevant [Phase 1G–1Z ledger](README.md), [Tactical_Character_Resource_Bridge_Status.md](Tactical_Character_Resource_Bridge_Status.md) and real `sql/` code. Read the exact old adapter before a parity test.
6. **[Character_Progression_and_Higher_Level_Forge.md](Character_Progression_and_Higher_Level_Forge.md)**, [Player_Forge_Choice_Routing_and_Source_Magic_Status.md](Player_Forge_Choice_Routing_and_Source_Magic_Status.md), Wizard Spell Mastery/Memorize ledgers, [Item_Character_Effects_Coverage_Audit_2026-10-24.md](Item_Character_Effects_Coverage_Audit_2026-10-24.md), [Player_Rest_Activities_Optional_Attunement_2026-10-25.md](https://github.com/bob8675309/DNDNEXT/blob/38e4441052c7b4e41058ca646464017fb01bb139/docs/Player_Rest_Activities_Optional_Attunement_2026-10-25.md) — read if touching provenance, granted spells, character stats, equipment/rest or item charges.
7. **[Consolidated_Development_Archive_2026-10-30.md](Consolidated_Development_Archive_2026-10-30.md)**, archived PR #255/#259/#299 and active PR #309 — **separate ancestry-preserved research from actual working-tree changes**.

Use `docs/README.md` and `docs/Documentation_Refresh_Manifest.md` for other subsystems. Historical handoffs may contain several competing headings saying “current”; do not let older prose override live evidence or these owner decisions.

## Last VERIFIED snapshot — must refresh in every new chat

| Item | Observed 2026-10-31 | Recheck / meaning |
| --- | --- | --- |
| Repository | `bob8675309/DNDNEXT` | Fetch GitHub head and PR metadata. |
| Production `main` | `75c387e9276739f04b56d7fa96e4041931b3d9f4` | **Observation, not pinned truth.** Don't change without explicit approval. |
| Research branch | `work/eldritch-blast-los-regression-20261030`; last pre-this-handoff verified head `2abce8b2821192678594324ff7cdbc3c06c521b9` | The commit adding this handoff supersedes that head; always fetch new SHA. |
| Draft PR | [#309](https://github.com/bob8675309/DNDNEXT/pull/309), open/unmerged, base `work/consolidated-encounter-research-20261030` | Do not mistake the PR for a main-based release request. |
| Historical archive | `work/consolidated-encounter-research-20261030`, head `c0a498a9121b317440804a40189ee885c830842d` | Multi-parent **history preservation**, not a merge of every old PR's files into the working tree. |
| Previous CI | **6/6 GitHub workflows passed** at `2abce8b...` (before these handoff changes) | Do not transfer “green” status to a later SHA without exact-head checks. |
| Live spell catalogue | **1,037** `spells_catalog` rows, **1,037** `spell_effects` rows, all `effect_index = 0` at read-only check | No executable recipe library is deployed. Data may change. |
| Experimental engine state | No live `private.resolve_effect_bundle_v1` or `encounter_cast_eldritch_blast_candidate_v1` found | Archived pure-effect and EB SQL candidates are **research**, not permissions or installed features. |
| Existing capabilities | 19 reviewed XPHB tactical UI adapters; 22 public `encounter_cast_%` function names at last audit | Counts describe different things; not 19 complete universal spell-family implementations. |

**Current canonical Next.js stack:** Pages Router, React, Bootstrap/SCSS (Tailwind removed), Supabase Postgres (authoritative), Vercel. Do not modify world-map or town/city-map behavior as an incidental consequence of tactical spell work.

## Mandatory recovery and “no false confidence” check (every successor)

1. **Verify identity:** GitHub branch + exact SHA, PR status/base, `main` and archive SHA; identify which commits are **merged to main**, only on the draft's working tree, or **ancestry-preserved** historical research. Never infer active state from a branch name or old Docs. Check CI at the *exact* head.
2. **Verify live facts read-only:** List current live relevant `pg_proc` function definitions, `EXECUTE` grants, tables, source/catalogue schemas and deployed migrations. Use only SELECT/introspection; no `CREATE`, `ALTER`, fake signed-in role, mutation, user data resets or production rollback fixtures without specific owner consent.
3. **Trace a complete vertical slice:** For any changed spell, trace **canonical source/grant → character profile/resource → legal targets/geometry → attack/save/damage/effects → action/slot transaction → command log/Realtime → UI result**. Check each function in source AND current live implementation. For AI, add **viewer/actor knowledge filter → server-issued action choices**.
4. **Check existing research before implementing:** Reuse archived #251/#253/#255 common arithmetic, #299 atomic Attack research and #304/#309 EB only where source parity permits; respect **closed/unmerged** status. Confirm prior tests and known blockers.
5. **State what you have NOT verified** in plain terms. Examples: untested browser behavior, PHB edition conflict, multiclass total level, concentration and reaction interactions, full-schema JWT parity, actor knowledge leaks or draft migration dependencies.
6. **Before each new patch:** articulate touched files, owners/consumers, regression guards, rollback method, CI expected and free-cost constraints. No runtime replacement until designed/spec'd and independently tested.
7. **After patch in the same working session:** record exact commit/head, modifications, tests and failures, DB effects (**none** if no migration), *one next task*, and new unresolved assumptions in **this** handoff or the active workstream ledger. Do not claim future background completion. Request owner approval before merges, live migrations, grants or paid services.
8. **If any essential fact is unavailable**, halt that specific write; document it as a blocker and continue bounded independent work. **Never fill a gap from confident recollection.**

### Status labels (must be used precisely)

- **Live/merged:** verified current production source + deployed schema/function with relevant functional evidence.
- **Implemented in research only:** code on draft branch or archived SHA; never imply users can use it live.
- **Tested locally/CI:** identify exact SHA and test scope (source contract vs disposable DB vs real JWT vs browser).
- **Designed/approved direction:** owner's intent is locked, but no executable implementation.
- **Unknown/unverified:** no verified evidence. Do not silently promote to done.

## Phase P1 implementation checkpoint — 2026-10-31 (research only)

**P1 structural contract introduced on draft research branch:** `utils/spellRecipes/validateSpellRecipe.mjs`, `scripts/fixtures/spell_recipe_p1_examples.mjs`, `scripts/validate_spell_recipe_schema_p1.mjs`, [Spell_Recipe_P1_Schema_2026-10-31.md](Spell_Recipe_P1_Schema_2026-10-31.md). Strict XPHB 2024 source-qualified, versioned, bounded recipe shapes for actions/slots, target geometry, attacks/saves/auto-hits, damage/healing/area, branch/repeat limits and explicit dice roll scopes. **Synthetic examples are NOT rules-complete nor deployed**. No execution, AI selection, RPC, UI, Auth, DB tables or map modifications.

**P1 compiler preflight follow-up (new research milestone):** `utils/spellRecipes/preflightSpellRecipe.mjs` and `scripts/validate_spell_recipe_preflight_p1.mjs` check lexical isolation of repeat bodies versus after-continuations, legal same-scope hit/miss joins, same-path/cross-scope roll cache misuse, at most three nested loops, worst-case operation cap, canonical SHA-256 recipe content identity, and deeply frozen **non-executable** manifests. See [Spell_Recipe_P1_Schema_2026-10-31.md](Spell_Recipe_P1_Schema_2026-10-31.md). This milestone must be retested at the exact current commit before marking it verified.

**Historical next step after P1 (now underway on draft #312):** P2 **shadow parity design** using existing server-backed Fire Bolt, Sacred Flame, Magic Missile, Acid Splash, Word of Radiance, Burning Hands, Lightning Bolt, and held Eldritch Blast reference contracts. First compare action/slot/target/roll scopes; *do not execute or migrate spells*. The older “P1 not started” items below are preserved only as historical dated entries.

## Current engineering task — SINGLE NEXT STEP

**Current single next task (updated after transaction candidate):** Audit mixed historical and candidate lock orders, the full public v1–v13 casting/delegation graph, and old request/replay compatibility. Prepare nonproduction GoTrue/PostgREST genuine signed-in acceptance if an isolated environment can be verified. The candidate is ungranted and not installed behind public entry points. No production merge, schema/grant change or deployment without explicit owner approval. The schema and preflight are *not* rules-complete; do not infer automation coverage from structural validation.

**Do not start with:** adding Scorching Ray as a one-off public RPC; refactoring 19 existing adapters; writing a universal text-to-spell compiler; silently switching to a JS-only transaction processor; generating AI prompts to choose arbitrary effects; implementing AI autonomy now; or batch converting 1,037 records.

### Working milestone / blocker register

| ID | Status at last check | Action before delivery |
| --- | --- | --- |
| P0 audit + user decisions | **Documented** | Owner answers captured in `SPELL_ENGINE_DECISIONS.md`, pre-pivot audit linked. |
| P1 schema/validator + graph preflight | **Research code committed; CI status depends on exact head** | Verify 12 synthetic shapes, malformed/unsafe inputs, isolated repeat/branch boundaries, budget and immutable identity; never mark executable. |
| P2 pure shadow parity | **Research contracts and Fire Bolt controlled reference fixtures on draft #312 only** | Next: authoritative total-level and grant-source read trace, then disposable PG/real-JWT fixtures; no production calls. |
| P3 hybrid/lifecycle | **Not started** | Explicit Scorching Ray/Ice Knife and persistent/reaction subtasks. |
| P4 server + human integration | **Not started** | Require free local Auth tests and real signed-in browser approval. |
| P5 Admin homebrew builder | **Approved goal, not built** | Only after reviewed recipe lifecycle and safe publishing. |
| Future AI tactical actions | **Approved goal, not built** | Share human legal action authority; opt-in, GM controls, AI-off. |
| Supabase production mutations | **None authorized** | Research-only; avoid paid staging. |
| Multiclass/slot/feature parity | **Not exhaustively verified** | Spell class vs character level, Pact Magic, source grants and invocations need dedicated fixtures. |
| Concentration/reactions/conditions | **Not a generalized engine** | Existing partial primitives preserved; missing interactions GM-assisted. |
| Source licensing/catalogue completeness | **Not exhaustively verified** | Review each published source and source-specific recipe, no AI-generated rules authority. |

## Essential working-state handoff text (copy into a new chat)

> You are taking over as senior DNDNext developer. First read `docs/START_HERE_ACTIVE_HANDOFF.md`, then `docs/SPELL_ENGINE_DECISIONS.md`, `docs/Spell_Engine_PrePivot_Audit_2026-10-31.md`, `docs/Composable_Spell_Engine_AI_Readiness_2026-10-31.md` and linked mechanical source ledgers. Revalidate current GitHub main/archive/draft PR #309 heads and exact SHA CI and read-only Supabase schema/functions/grants before changes. Preserve worktree-vs-archived distinction; do not declare live capability from CI-only test. Owner agreed XPHB-first, spells-first, GM-assisted fallback, future Admin recipe builder, future opt-in human/AI-shared tactical authority, and versioned house-rule overlays. Continue P2 shadow-parity on draft #312 after confirmed P1 preflight; trace total-level/source-grants before disposable real-auth tests, with no paid service, prod DB writes, deployment, merge or world/town map changes. Record exact evidence, unknowns, touched source, tests, decision impacts and the single next task in the handoff at the end of each work block.

## P2 transaction-integrated source candidate — 2026-10-31 (draft PR #312 only)

- **New source:** `sql/candidates/20261031_fire_bolt_transaction_integrated_candidate.sql`, a private, no-execution-grants copy of the live-equivalent full v11 attack resolver. The original PL/pgSQL body was byte-for-byte compared after the `declare` heading. This is NOT a migration and does not replace public functions.
- **Transactional changes:** caster `FOR UPDATE`, owned assignment `FOR SHARE`, encounter `FOR UPDATE`, target `FOR UPDATE` before request ledger. Authorization and hidden-target checks precede cached result return; exact request owner, caster, encounter, assignment, target, source spell and slot intent must match. Fire Bolt canonical class/known guard added; existing other attack family checks not expanded.
- **Tests:** `scripts/fixtures/fire_bolt_p2_transaction_candidate_pg16_checks.sql` (Fire Bolt plus Poison Spray and Guiding Bolt slots/replay) and `scripts/fixtures/fire_bolt_p2_transaction_candidate_race.sh` (two independent PG clients, identical request and competing Action). The existing old resolver and separate wrapper tests remain, including honest characterization of prior unsafe behavior.
- **Verified CI:** [candidate/PG integration](https://github.com/bob8675309/DNDNEXT/actions/runs/41265780717) and [class browser](https://github.com/bob8675309/DNDNEXT/actions/runs/41265780668) passed at `8c1927bcc23df7d3f66ec215903360321f874d9d`. Revalidate after docs commits.
- **Remaining risks:** current public v1/v11 functions are still unchanged and callable; old ledger-first lock order differs from candidate caster-first locks; mixed-version deadlocks/coverage not audited; not all six attack families were exercised end-to-end; other public spell RPCs remain unreviewed; real GoTrue-issued JWT acceptance absent; only production Supabase project accessible. No auth/DB production writes, no new GoTrue users, no public grants or live migration.
- **Single next task:** Map full public cast call/lock graph and design consistent transition/rollback that protects all public entry points; add Auth acceptance only in a verified isolated nonproduction environment. Never promote this candidate before tests and explicit owner approval.

## P2 held Fire Bolt authorization hardening candidate — 2026-10-31, research only

- **Branch/PR:** `work/spell-recipe-p2-shadow-parity-20261031` / [draft #312](https://github.com/bob8675309/DNDNEXT/pull/312), stacked onto held #309, never directly onto `main`.
- **New source:** `sql/candidates/20261031_fire_bolt_guarded_replay_candidate.sql` contains `private.encounter_fire_bolt_guarded_candidate_v1`, an **ungranted**, restricted-scope wrapper around the existing public Fire Bolt v11 resolver. Not a deployable migration or public endpoint. No modifications to production SQL, existing live v1/v11 functions, RLS, grants or user-facing combat routes.
- **New tests:** `scripts/fixtures/fire_bolt_p2_guarded_candidate_pg16_checks.sql` runs in the isolated PG16 fixture after historical v11 characterization. Checks owner cast and exact replay, foreign controller denial, changed target/assignment, invalid `known` or mismatched class-source, feat-owned grant, hidden target, revoked controller, pending result and atomic no-extra-mutation. The valid sample explicitly uses `known=true, prepared=false` for a cantrip. The baseline SQL tests still characterize pre-hardening behavior separately.
- **CI proof:** [Candidate/PG integration](https://github.com/bob8675309/DNDNEXT/actions/runs/41265072980) and [Class browser](https://github.com/bob8675309/DNDNEXT/actions/runs/41265072982) both passed on exact SHA `aab57a091fbef1c1f25fa9ffdecb3c37b16d90de`. Confirm status again for newer docs/CI commits; never claim tested if head changed.
- **Live grants checked read-only:** `authenticated` EXECUTE on public `encounter_cast_spell_v1` and `v11`; denied on public `v1_pre_1v` and `v11_pre_1v`. The existing wrapper does NOT fix direct public entry points. No live secret, signed JWT or user identity used in CI; `SET ROLE` is a mock and separate real Supabase Auth/GoTrue acceptance remains required.
- **Historical next step (P2 transaction candidate now exists):** Design the transaction-integrated, narrow and reversible fix for the **actual** public v11/V1 spell resolver path (including request-intent verification and canonical grant), with cross-spell backward compatibility/lock ordering and disposable real signed-in authentication tests. Keep it on research and require explicit owner approval for any production code deployment, merge or SQL/grant change.

## P2 Fire Bolt authority and isolated SQL source test — 2026-10-31 (PR #312 only)

**Verified live metadata:** `character_progression.character_id` is the PRIMARY KEY, one class and class_level per character, no normalized total-character-level field in `encounter_spellcasting_profile_v1`; therefore the Fire Bolt `classLevel` cantrip-tier calculation is correct for the currently represented single-class model but not generally multiclass-ready. Do not use character sheet JSON as canonical level. `character_spells` retains source_type/source_key/source_label/known/prepared distinction, with admin-write RLS and direct-authority mutation trigger.

**New research artifacts:** [Spell_Recipe_P2_Fire_Bolt_Authority_2026-10-31.md](Spell_Recipe_P2_Fire_Bolt_Authority_2026-10-31.md), `scripts/fixtures/fire_bolt_p2_disposable_pg16.sql`, `scripts/fixtures/fire_bolt_p2_disposable_pg16_checks.sql`, and isolated free PostgreSQL 16 CI stage. The fixture imports the actual historic v11 resolver SQL but mocks dependent functions/Auth, so it **cannot** prove Supabase real-JWT acceptance. Recheck exact-head workflow; source and stub issues encountered during fixture development are not production patches.

**Important release-blocking source review:** Fire Bolt's v11 cantrip branch validates source_type='class' but lacks explicit `known`, canonical class/source_key/label or `spells_catalog.classes` gate. Current v11 caches `encounter_command_requests` results and may return them on a same-caster same-ID replay **before** caller-control and target-visibility checks. The live command ledger itself is not directly readable by authenticated clients, but authenticated users can read eligible combat log details that include request IDs. Treat this as a potential result-disclosure/intent-binding concern, **not proven production exploitation**; see the full evidence/risk description in the new P2 authority document.

**One next task:** Research-only hardening candidate for replay authorization/intended target and canonical spell source-grants, with disposable PostgreSQL regression tests and eventual genuine separate GoTrue+PostgREST signed-in staging acceptance. **No live RPC change, schema/grant modification, production write, merge or deployment has been approved.**

## P2 research delivery checkpoint — 2026-10-31 (PR #312 only)

- **Repository identities at check:** production `main` `eb376a4e3a7b0a7201a0ecb8a98366c1bba4e00a`; draft #309 base research head `a24006624380570bd693a768e97a0c689f1d42b5`; P2 stacked draft PR #312. No main merge. Reverify all SHAs.
- **Source files changed on research branch:** `docs/Spell_Recipe_P2_Shadow_Parity_2026-10-31.md`; `scripts/validate_spell_recipe_p2_shadow_contracts.mjs`; `scripts/fixtures/fire_bolt_p2_shadow_cases.mjs`; `scripts/validate_spell_recipe_p2_fire_bolt_shadow.mjs`; existing free `.github/workflows/validate-eldritch-blast-candidate.yml`; and this handoff. No gameplay, map, SQL migrations, deployed functions or AI runtime changes.
- **Verified tests:** Exact research commit `5d217a903b8d5ef0bc19c007773a7e53b3aecc03` had **successful** 'Validate Eldritch Blast Rules Candidate' and 'Validate Class browser polish' workflows, including the newly wired 12-level / 10-attack deterministic Fire Bolt reference. A previous `9f4f419cf4ec` CI failure was an incorrect test file-path assertion (public EB bridge vs private candidate), corrected on `9b37caa39157`. Subsequent docs/CI commits require their own exact-head confirmation.
- **Live DB read-only:** `public.encounter_cast_spell_v11_pre_1v` Fire Bolt uses `v_profile->>'classLevel'` for damage tiers; `public.encounter_spellcasting_profile_v1` obtains `public.character_progression.class_level` and exposes `classLevel`, not a total-character-level property. Source-grant checks need further examination; role/controller/target and exception semantics must be retested with genuine Auth. No live mutations, grants, migrations or role spoofing.
- **Independent source:** 2024 D&D Beyond Basic Rules specifies cantrip scaling by *total character level* in multiclassing and Fire Bolt's possible *creature or object* targets with optional flammable-object ignition. Only a controlled scalar proxy has been tested. Multiclass execution, 2024 source-complete Fire Bolt and object/ignition automation remain **unknown/not implemented**.
- **Source behavior observed:** Source/character assignment, class-only XPHB gate, ranged attack, 120-ft/LOS, cover AC, nat 1 miss/nat 20 crit, action/command/log transaction, and GM-assisted near-hostile or active-condition cases. No damage mitigation/HP fidelity, source-label entitlement, signed-JWT/revocation/concurrency or browser test was included in P2.
- **Historical checkpoint task, now completed:** Verify canonical total-character-level provenance and class/source spell entitlement; specify a no-production-write, disposable PG + signed-JWT Fire Bolt behavioral test with controlled thresholds and security gates. Do not adjust live cantrip damage until that evidence and owner approval exist.

## Other project priorities and their relationship to this work

The original AI foundation prioritizes Character Forge completion and then a local/admin-only magic-item draft AI proof, followed by NPC dialogue and bounded Actor AI. Current agreement to **design a spell engine compatible with AI** does not authorize skipping Forge or installing an AI model. The reusable resource/authorization/result contracts should support future class features, equipment, town interactions and AI without merging those systems prematurely.

**Change discipline:** This handoff is a starting point, not an excuse to stop investigation. Every new chat should verify live state, enumerate what is still uncertain, and make small, testable improvements rather than redoing an earlier handoff.

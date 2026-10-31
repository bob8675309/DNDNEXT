# DNDNext — START HERE: Active Development Handoff / Recovery Protocol
_Last editorial checkpoint: 2026-10-31. This file is a **live handoff**, not a verified substitute for GitHub, Supabase or CI._

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

The old “P1 not started” and “create schema first” entries *below* are preserved as dated history. After running the new Node test at the actual updated commit, the next task is **P1 compiler-preflight design**: validate repeat/branch scoping, rollGroup reuse, recipe immutability/identity; no gameplay execution. Always verify exact GitHub commit and CI first.

## Current engineering task — SINGLE NEXT STEP

**Create the Phase P1 *closed, versioned spell-recipe schema and pure validator* as a research-only artifact.** Start by reading exact old function definitions for Fire Bolt, Sacred Flame, Magic Missile, Acid Splash, Word of Radiance, Burning Hands, Lightning Bolt and the held Eldritch Blast candidate. Map reuse/ownership and reject unsupported operations and unbounded graphs. Supply synthetic valid/invalid recipes and property tests; compare them to **existing** adapter contracts. Keep effects arithmetic, cast authorization, actual RNG/HP/slots and timed effects authoritative in the current server paths. No gameplay route change or production migration at this step.

**Do not start with:** adding Scorching Ray as a one-off public RPC; refactoring 19 existing adapters; writing a universal text-to-spell compiler; silently switching to a JS-only transaction processor; generating AI prompts to choose arbitrary effects; implementing AI autonomy now; or batch converting 1,037 records.

### Working milestone / blocker register

| ID | Status at last check | Action before delivery |
| --- | --- | --- |
| P0 audit + user decisions | **Documented** | Owner answers captured in `SPELL_ENGINE_DECISIONS.md`, pre-pivot audit linked. |
| P1 schema/validator | **Not started** | First substantive engineering work on the composable pivot. |
| P2 pure shadow parity | **Not started** | Follow P1; use golden fixtures from old adapters. |
| P3 hybrid/lifecycle | **Not started** | Explicit Scorching Ray/Ice Knife and persistent/reaction subtasks. |
| P4 server + human integration | **Not started** | Require free local Auth tests and real signed-in browser approval. |
| P5 Admin homebrew builder | **Approved goal, not built** | Only after reviewed recipe lifecycle and safe publishing. |
| Future AI tactical actions | **Approved goal, not built** | Share human legal action authority; opt-in, GM controls, AI-off. |
| Supabase production mutations | **None authorized** | Research-only; avoid paid staging. |
| Multiclass/slot/feature parity | **Not exhaustively verified** | Spell class vs character level, Pact Magic, source grants and invocations need dedicated fixtures. |
| Concentration/reactions/conditions | **Not a generalized engine** | Existing partial primitives preserved; missing interactions GM-assisted. |
| Source licensing/catalogue completeness | **Not exhaustively verified** | Review each published source and source-specific recipe, no AI-generated rules authority. |

## Essential working-state handoff text (copy into a new chat)

> You are taking over as senior DNDNext developer. First read `docs/START_HERE_ACTIVE_HANDOFF.md`, then `docs/SPELL_ENGINE_DECISIONS.md`, `docs/Spell_Engine_PrePivot_Audit_2026-10-31.md`, `docs/Composable_Spell_Engine_AI_Readiness_2026-10-31.md` and linked mechanical source ledgers. Revalidate current GitHub main/archive/draft PR #309 heads and exact SHA CI and read-only Supabase schema/functions/grants before changes. Preserve worktree-vs-archived distinction; do not declare live capability from CI-only test. Owner agreed XPHB-first, spells-first, GM-assisted fallback, future Admin recipe builder, future opt-in human/AI-shared tactical authority, and versioned house-rule overlays. Begin P1 closed recipe schema/validator on research branch only, with no paid service, prod DB writes, deployment, merge or world/town map changes. Record exact evidence, unknowns, touched source, tests, decision impacts and the single next task in the handoff at the end of each work block.

## Other project priorities and their relationship to this work

The original AI foundation prioritizes Character Forge completion and then a local/admin-only magic-item draft AI proof, followed by NPC dialogue and bounded Actor AI. Current agreement to **design a spell engine compatible with AI** does not authorize skipping Forge or installing an AI model. The reusable resource/authorization/result contracts should support future class features, equipment, town interactions and AI without merging those systems prematurely.

**Change discipline:** This handoff is a starting point, not an excuse to stop investigation. Every new chat should verify live state, enumerate what is still uncertain, and make small, testable improvements rather than redoing an earlier handoff.

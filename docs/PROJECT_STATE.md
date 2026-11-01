# DNDNext — Verified Project State

> **2026-11-01 P0 closeout update:** [PR #313](https://github.com/bob8675309/DNDNEXT/pull/313) merged with production main `de4cfb8c79264fa49aa12da0d1e3752f4a8ca03b`; Vercel production `dpl_8LeoXePm93rcz69rABa3B5ZoadpG` was READY from the same SHA and the post-merge handoff registry GitHub CI passed. This top-level update supersedes only the earlier P0 *status*, not the dated source/database facts below. **Active objective: [P1.1, read-only combat command inventory](ACTIVE_WORK.md).** Recheck actual deployment and PR/DB state in each new chat.

> **Point-in-time evidence:** 2026-11-01. **This file is not a live monitor.** Read [PHASED_DEVELOPMENT_CHECKLIST.md](PHASED_DEVELOPMENT_CHECKLIST.md) for the repeatable S0–S7 session gates and P0–P6 objective plan; read [ACTIVE_WORK.md](ACTIVE_WORK.md), the [system registry](SYSTEM_REGISTRY.json), the [handoff log](HANDOFF_LOG.md), and then verify the current GitHub/CI/Supabase/Vercel state. Source code, production database functions and deployed behavior outrank this snapshot. `AGENTS.md` and [SPELL_ENGINE_DECISIONS.md](SPELL_ENGINE_DECISIONS.md) remain mandatory instructions and approved product decisions.

## Snapshot identity and scope

| System | Verified checkpoint | What it proves / does not prove |
| --- | --- | --- |
| GitHub `main` | `eb376a4e3a7b0a7201a0ecb8a98366c1bba4e00a` | Source baseline, not a promise of current head. |
| Vercel production | `dpl_AxNyb2EhSRHNjz4U6Wjoz5ZHG6Ku` — READY, same Git SHA | Deployment exists; no new owner/browser acceptance was performed during audit. |
| Supabase `DnDWeb` | Project `ucggczovhmauhshvhusx`; 243 registered migrations; 253 public and 292 private functions at audit | Read-only live observation. Counts may change. No SQL writes made. |
| Research PR #309 | Open draft; `work/eldritch-blast-los-regression-20261030`, head `a24006624380570bd693a768e97a0c689f1d42b5` | Held Eldritch Blast/P1 experimental ancestry, not main. |
| Research PR #312 | Open draft stacked on #309; `work/spell-recipe-p2-shadow-parity-20261031`, head `26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254` | Isolated P2/parity and private core-action executor research, **not** deployed or merged. |

No authenticated end-to-end browser acceptance was performed during the 2026-11-01 audit. Source presence, validator existence, exact-head CI and deployment are **different** evidence types. See [SYSTEM_REGISTRY.json](SYSTEM_REGISTRY.json).

## Current production reality versus historical docs

| Capability | Verified reality | Important boundary |
| --- | --- | --- |
| NPC printable character sheet | Implemented on main: `CharacterSheetPanel` print button → `printableCharacterSheet` model → `officialCharacterSheetPdf` over three-page PDF, with validator in Vercel build runner. | Printing slot totals does not imply it reflects spent/remaining slot ledger. Do not call printing unfinished; assess any fidelity issue separately. |
| Character Forge and progression | Full character-creation flows, source-aware choices, feature/runtime components and server-owned progression materializers exist. | A saved source selection may lack its downstream tactical consumer. Preserve edition/source identity and choice lifecycle. |
| Reusable Forge dice | `RealisticDiceTray`, seeded 2.5D cube physics, Forge adapter, manual movement and 500-throw stress test source exist. | Not an approved full polyhedral rigid-body engine or sitewide sheet/combat dice adapter. Older roadmap's 'not started' is stale for the current cube subsystem. |
| Tactical Encounter Workspace | Merged via PR #301: Setup/GM, Movement/Reactions, Combat/Spells and Map Workshop on `/encounters/workspace`. | It is a composite workspace, not evidence that 100% of multiplayer/role/browser acceptance is complete. |
| Rest dialog | `Rest & Recover` action is wired and merged via #301. | Attunement and Crafting rest activities are explicitly not enabled. |
| NPC portraits | 241 live `npc_portrait_library` rows and shared picker/metadata surfaces. | Count is snapshot; role-scoped browser selection must be checked on change. |
| Alchemy | Live v10 catalogue/recipes: Force Breath is Uncommon and breath damage text is 3d6. Source `public/items/alchemy-catalog.json` also declares v10. | `scripts/seed_alchemy_catalog.mjs` opening comment still mentions v8; legacy ingredient `codexVersion` can remain v8. Do not treat that alone as a live data error. |
| Equipped damage mitigation | Live `encounter_apply_damage_internal_v1` references equipped-item mitigation helper. | Preserve the production mitigation order and single server authority. |
| Runtime class resistances | `private.character_runtime_damage_resistances_v1` exists but live shared damage function did not call it at audit. | Runtime choice configured != tactical mitigation applied. Investigate the complete resolver path before declaring absent or fixing. |
| Tactical spells | `pages/encounters/combat.js` lists 19 exact source-qualified XPHB spell adapters; production RPC family is versioned. | One-off spell adapters are not the proposed composable interpreter. |
| High-quality tactical sprites | Blender isolated export/QA pipeline exists. | Dawn v3 passed technical pipeline but final art was visually rejected. South prototype approval remains independent. |
| World and town maps | Distinct world-map travel, town interaction and tactical hex code paths. | **Do not modify world map without discussion.** Old cron captures are not live definitions; on audit `sim_tick_v1_job` was `* * * * *`. |

## Confirmed P0 combat risks — research, not production changes

1. **Replay authorization:** The live `public.encounter_use_core_action_v1` can return a cached request result before verifying current participant control; duplicate matching does not bind the original requester and typed action intent. The private #312 candidate has isolated genuine-JWT tests but must **not** be installed as a one-RPC hotfix.
2. **Lock ordering:** Live and research command families use different encounter/participant/ledger lock sequences. All affected requests, cast routes, movement, reactions, triggers and shared resource bridges need a unified transaction contract before any coordinated cutover.
3. **Cross-encounter membership:** Two active encounters existed; one canonical character appeared in both at audit. This proves overlapping membership, **not** that an exploit or double expenditure happened. The ownership/resource policy is an explicit open design decision.
4. **Research boundary:** `encounter_command_requests.request_intent` and `character_permissions.can_control` were absent from live schema; private candidate executor was not installed. No research CI pass authorizes deployment.
5. **Advisor findings:** Security advisor reported twelve anon-executable `SECURITY DEFINER` functions and one search-path warning. These are separate individual privilege-review tasks; avoid blanket revocation without call-site and authorization analysis.

## Engineering priorities (order is a planning proposal, not a merge authorization)

- **Current bounded activity (`P0`):** documentation reconciliation and owner review. Follow the detailed acceptance and carry-forward requirements in [PHASED_DEVELOPMENT_CHECKLIST.md](PHASED_DEVELOPMENT_CHECKLIST.md). See [ACTIVE_WORK.md](ACTIVE_WORK.md).
- **Next research task:** create/review one global command replay and lock-order design matrix; include exact action intent, current-authorization rechecks, revoked permission, legacy requests, concurrent actions, multi-encounter resource usage, and rollback, using free isolated tests.
- **Then:** advance source-qualified, XPHB-first P2 spell shadow parity against existing server-authoritative spell mechanisms without installing a live interpreter.
- **Separate queues:** runtime-feature tactical consumers, printer resource fidelity, realistic polyhedra, accepted sprites, alchemy presentation, low-risk stylesheet/dependency cleanup. None is approval to rewrite another subsystem.

## Protected contracts

- Next.js Pages Router, React 19 and Bootstrap/SCSS; do not add Tailwind. A historical Tailwind dependency still exists in `package.json` and was **not removed** during this docs-only pass.
- Production Supabase and its grant/RLS/RPC contracts are authoritative; no live SQL, role grants, destructive migration, gameplay mutation or AI enablement without explicit owner approval.
- Preserve Forge, NPC/merchant/profile, inventory, equipment, currency, rest, crafting and tactical combat call chains; inspect their existing tests before changing.
- No Vercel deployment, merge, preview deletion or paid service without appropriate approval. Keep experimental PR ancestry separate from production source.
- Existing historical documents remain in the repository for provenance and rollback; see [DOCUMENT_LIFECYCLE.md](DOCUMENT_LIFECYCLE.md) before considering removal.
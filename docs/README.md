# DNDNext Living Documentation Index

> **Prototype research project health:** [Free consolidated GitHub PR/CI and source-archive report](https://github.com/bob8675309/DNDNEXT/blob/docs/agent-status/docs/PROJECT_HEALTH.generated.md). It updates on owner research pushes, may capture CI while still running, and is not production/browser evidence. No scheduled ChatGPT Work; request Work only for difficult investigations.

> **Forge research status (automatically reconciled):** [Open the no-cost branch snapshot](https://github.com/bob8675309/DNDNEXT/blob/docs/agent-status/docs/research-status/research-forge-immutable-creation-replay-20261105.generated.md). It records the exact source SHA, staged trigger DDL and only independently verified JWT receipts. Consult [ACTIVE_WORK.md](ACTIVE_WORK.md), [HANDOFF_LOG.md](HANDOFF_LOG.md) and [research docs policy](Research_Docs_Maintenance_2026-11-06.md) for the authored contracts; neither CI success nor a docs snapshot constitutes a production merge.


> **2026-11-05 J117–J124 POSITIVE XPHB AASIMAR SOURCE SPELL (NEW CI PENDING):** Draft #324 previous [J109–J116 exact-head PASS](https://github.com/bob8675309/DNDNEXT/actions/runs/42148409154) at `8102ebcce73f67b25abcb040c5b3852d3d4fa641`, 4/4 workflows. New original live 5 source-magic helper bodies/MD5s, source-exact **Aasimar → Light Bearer → XPHB Light** species grant via signed `create_player_character_v3` plus Fighter/Soldier/Lucky 5gp market I/S/C and nonce. J117–J124 test positive grant, replay, mismatched canonical species, wrong trait, unauthorized Fire Bolt, missing Light with exact deferred handler messages + atomic rollback. **Source-level casting ability release gap:** Light Bearer specifies CHA, but original species materializer likely persists NULL; J118 explicitly verifies/flags, does not silently fix. Reduced spell version preference/catalog; no complete original 31 triggers/browser. [Research evidence/limits](Forge_Aasimar_Light_Bearer_Positive_Source_2026-11-05.md). **J117–J124 pending exact JWT CI.** No main/production SQL/deploy/merge, keep Vercel pushes bundled.


> **2026-11-05 J109–J116 XPHB WARLOCK POSITIVE INVOCATION (NEW CI PENDING):** Prior #324 [J103–J108 accepted](https://github.com/bob8675309/DNDNEXT/actions/runs/42146546579) at `d0cdfa544b6855aca7013b653d6b2aa2ace2c0db` (4/4 workflows). New **source-original level-1 Warlock** class row, live option catalog entries **Armor of Shadows** / **Eldritch Mind** / level-2-prerequisite **Devil's Sight**, and original slot count/slot level PG17 functions (MD5 `61c83f...` / `942dd3...`) are staged only in disposable PG17. Real JWT J109–J116 test positive original v3 one-slot Invocation class grant, Soldier/Lucky G/GI and market-backed S/I/C, same nonce and altered intent, absent slot, early prerequisite, fake key, forbidden child data, and second independent valid Invocation. **J109–J116 CI PENDING, NOT PASS.** [Evidence/limits](Forge_Warlock_Invocation_Positive_Source_2026-11-05.md). Not full class spell catalog, positive source magic, 31-trigger parity, global lock order or browser. No main/production/deployment/merge. Next: exact-head JWT CI and scope review; conserve Vercel.


> **2026-11-05 J103–J108 SOURCE-ORIGINAL PROGRESSION TRIGGER EXPANSION (CI PENDING):** Held draft #324 [J94–J102 PASS](https://github.com/bob8675309/DNDNEXT/actions/runs/42144482448) at `6bbf895f6048661de169757b3337a5172955bb0d` (4/4 workflows). Source-exact live PostgreSQL17 bodies and original DEFERRABLE timing for **three previously omitted** CP triggers are staged in **disposable PG17**: class-option/Invocation validator (MD5 `6df5aee...`), source-magic materializer (`4c35ea...`), starting-magic exactness (`ba645ad...`). Real JWT J103–J108 test validated Fighter/Soldier/Lucky v2, original v3 market S/I/C with authoritative price, misowned Invocation and unsupported magic-owner rejection/rollback, inert replay. **J103–J108 are PENDING exact-head CI, not PASS.** Only narrow branches and empty Warlock catalog skeleton are staged; actual Warlock/spell-owner positive paths, other original triggers and real browser are still release blockers. [Scope/limits](Forge_High_Risk_Progression_Trigger_Parity_2026-11-05.md). No production DB, runtime, main, merge or deployment. Next: verify exact-head JWT CI, then stage real source specialty branch and browser/staging acceptance. Conserve Vercel.


> **2026-11-05 J94–J102 SOURCE ORIGINAL V3 STARTING-MARKET UNDER INVENTORY RLS (NEW CI PENDING):** Exact-head #324 [J85–J93 passed in Actions 42140111002](https://github.com/bob8675309/DNDNEXT/actions/runs/42140111002) with 4/4 workflows at `5417dde7f06025ebaa419b7b728bc302ef4d0b4f`. The combined four-policy+old CHECK candidate blocks arbitrary character-owned I and preserves source Forge v2. New bounded tests retain unchanged `create_player_character_v3→v2` and deferred equipment source, install two exact original cash helpers (MD5 `78231b02...`, `f7f8dce...`) and **live XPHB Fighter option C 155gp**, and test genuine JWT homebrew/vanilla starting-market S/I/C, immutable replay, stock oversell, merchant mismatch, overbudget, recipe denial, and player-owned merchant purchase after hardened RLS. Static main client source contract confirms v3/cart selection serialization and character inventory RPC names; **does not prove a browser run**. [Evidence/limits](Forge_V3_Source_Market_Inventory_RLS_Research_2026-11-05.md). J94–J102 **PENDING exact-head CI**; candidate remains review-only, no live SQL/merge/release. Single next action: inspect actual source JWT CI then plan full browser and 31-trigger acceptance; batch pushes to conserve Vercel.


> **2026-11-05 J85–J93 INTEGRATED OWNER-CHECK + INVENTORY RLS RELEASE REVIEW (NEW CI PENDING):** [Original J78–J84 authenticated Forge deferred-COMMIT proof **PASSED**](https://github.com/bob8675309/DNDNEXT/actions/runs/42101294746) at executable `293986cc88d328e9d2dda8d4bcd4f8c5be3a5558`. Removing the obsolete `inventory_items_owner_type_chk` **ALONE IS UNSAFE**: live RLS allows ordinary JWT direct inventory DML by `user_id`, without validating `owner_type='character'` or current character permission. Read-only live snapshot: 23 I rows (19 npc, 4 player, 0 character), 4 permissive authenticated RLS policies, direct INSERT/UPDATE/DELETE/SELECT grants, original `private.can_access_character_v1` MD5 `97b5e6b059e6467e24c4283fe420c83e`. Held #324 adds a **review-only combined four-policy + obsolete CHECK candidate**, fail-closed, one SQL transaction, and J85–J93 genuine JWT negative/positive tests for forged items, conversion, revocation, source Forge G/GI/I/C, Admin assignment and player CRUD. [Full audit, candidate, rollback and release gates](Forge_Character_Inventory_Owner_Check_RLS_Release_Review_2026-11-05.md). **Do not call J85–J93 PASS until exact-head CI, and do not deploy, merge or alter live Supabase.** Conserve Vercel pushes. Single next action: exact-head source-authenticated J85–J93 CI/bugfix if needed; then review full 31 triggers/browser before a production migration.


> **2026-11-01 verified-project-state routing update:** [PROJECT_STATE.md](PROJECT_STATE.md) is the dated source/live/deployment reconciliation; [SYSTEM_REGISTRY.json](SYSTEM_REGISTRY.json) tracks each subsystem's actual implementation, tests, limitations and acceptance separately; [ACTIVE_WORK.md](ACTIVE_WORK.md) holds the only current next task; [HANDOFF_LOG.md](HANDOFF_LOG.md) is the append-only receipt ledger; [PHASED_DEVELOPMENT_CHECKLIST.md](PHASED_DEVELOPMENT_CHECKLIST.md) tracks recurring per-chat gates and longer-term P0–P6 milestones. Use [DOCUMENT_LIFECYCLE.md](DOCUMENT_LIFECYCLE.md) before removing any old docs. The historical PR summaries below do **not** supersede these newer records. PR #301 is merged; #250/#251/#253/#255/#257 are closed-unmerged historical research; #309 and stacked #312 are open draft research, not deployed.

> **Permanent docs are on `main`; experimental implementations are not.** The owner-approved handoff, decisions, pre-pivot audit and AI-ready spell design were promoted separately from draft research. The live D&D engine has **not** been replaced, and the held Eldritch Blast SQL/UI remains on [research PR #309](https://github.com/bob8675309/DNDNEXT/pull/309). Recheck current GitHub/DB status instead of relying on this dated checkpoint.


## ACTIVE HANDOFF — read first (2026-10-31)

**[START_HERE_ACTIVE_HANDOFF.md](START_HERE_ACTIVE_HANDOFF.md)** is the first step for every new development chat. It contains the *verification protocol*, the last **dated** GitHub/Supabase/CI snapshot, current workstream, exact next task, open risks and a copy-ready takeover instruction. **[SPELL_ENGINE_DECISIONS.md](SPELL_ENGINE_DECISIONS.md)** records the owner's six approved decisions, including XPHB-first, spells-first, safe GM-assisted fallback, Admin recipe authoring, shared human/future opt-in AI controls, and separately versioned house rules. These decisions are already answered; do not reopen them in subsequent chats without a concrete conflict.

**Historical status warning:** All dated “current/open draft” claims below must be checked against GitHub. In particular, original draft PRs #266 and #300 were superseded by **merged PR #301**; #251/#253/#255 and #257 are closed/unmerged research preserved by the archive. Draft PR #309 is not a production merge. Existing live/source authority beats the prose below. The new recipe engine is **not deployed**.

## Historical checkpoint — Encounter Workspace + Rest dialog (2026-10-28; subsequently merged through PR #301)

Historical 2026-10-28 candidate: draft PR #300 (workspace) and #266 (rest) were evaluated before **merged PR #301** delivered the combined source to `main`. The original candidate was not itself merged; the capability is deployed through #301. It excludes all unfinished experimental combat/attunement branches. GitHub Actions runs both focused validators and a Next.js production build without an intentional Vercel deployment. Browser/admin/player acceptance remains required before any promotion. Details: [Release_Candidate_Encounter_Workspace_Rest_2026-10-28.md](Release_Candidate_Encounter_Workspace_Rest_2026-10-28.md).


Updated: 2026-10-24

This directory contains the project's living handoff, roadmap, architecture, subsystem, and evidence documents. For active work, **live Supabase + current GitHub source/validators/deployment state outrank prose** if they conflict.

## Composable spell engine and future Actor AI — research design (2026-10-31)

- **[Spell_Recipe_P1_Schema_2026-10-31.md](Spell_Recipe_P1_Schema_2026-10-31.md)** — approved *research direction* for versioned spell shapes, lexical branch/repeat scoping, roll-cache safety and immutable recipe identities. Documentation is on main; P1 code is still unmerged on PR #309. Next work: P2 non-executing parity comparisons with existing spell authorities.

- **[SPELL_ENGINE_DECISIONS.md](SPELL_ENGINE_DECISIONS.md)** — six product choices confirmed by the owner; do not re-open them without a concrete conflict.
- **[START_HERE_ACTIVE_HANDOFF.md](START_HERE_ACTIVE_HANDOFF.md)** — exact recovery procedure and single next task for chat migrations.
- [Tactical_Spell_Mechanics_Review_2026-10-31.md](Tactical_Spell_Mechanics_Review_2026-10-31.md) — catalogue mechanics families and the source-bound review gate.
- [Combat_Next_Milestone_2026-10-29.md](Combat_Next_Milestone_2026-10-29.md) — **historical draft research ledger**; CI parity != deployed gameplay.
- [Consolidated_Development_Archive_2026-10-30.md](Consolidated_Development_Archive_2026-10-30.md) and [Archived_Branch_Cleanup_Safety_2026-10-30.md](Archived_Branch_Cleanup_Safety_2026-10-30.md) — why historical PRs/commits remain recoverable, not present in main working tree.


- [Spell_Engine_PrePivot_Audit_2026-10-31.md](Spell_Engine_PrePivot_Audit_2026-10-31.md) — **pre-implementation evidence, risk register and decisions**; checks archived PR topology, live catalogue, combat/Forge/rest/effects/AI authorities. Read this before implementing the new interpreter.
- [Composable_Spell_Engine_AI_Readiness_2026-10-31.md](Composable_Spell_Engine_AI_Readiness_2026-10-31.md) — staged, AI-compatible spell action/geometry/effects architecture. **Research only**, no AI or engine implementation; canonical authorized legal actions remain the contract for both humans and future bots.

## Start here — current development and handoff (reconciled 2026-10-24)

1. **[DNDNext_Effects_AI_Current_Handoff_2026-10-24.md](DNDNext_Effects_AI_Current_Handoff_2026-10-24.md)** — current system map, open PR dependency graph, effect owners and release gates. The dated live status at the top overrides old snapshot tables.
2. [DNDNext_Current_Handoff_Prompt.md](DNDNext_Current_Handoff_Prompt.md) — cross-subsystem recovery and protected boundaries. Everything beneath its current opening section is historical unless independently reverified.
3. [Documentation_Refresh_Manifest.md](Documentation_Refresh_Manifest.md) and [Current_Development_Status_and_Roadmap.md](Current_Development_Status_and_Roadmap.md) — trust hierarchy and current priorities, with old checkpoints preserved as history.
4. **Merged into `main`:** [#249](https://github.com/bob8675309/DNDNEXT/pull/249) Workspace preflight, [#252](https://github.com/bob8675309/DNDNEXT/pull/252) effects coverage and cross-chat audit, [#254](https://github.com/bob8675309/DNDNEXT/pull/254) effects/AI handoff, [#256](https://github.com/bob8675309/DNDNEXT/pull/256) PR reconciliation. Their documents are **on main**; do not call them open drafts.
5. **Historical research — closed/unmerged as checked 2026-11-01:** [#250](https://github.com/bob8675309/DNDNEXT/pull/250) Physical Specimen independently; [#251](https://github.com/bob8675309/DNDNEXT/pull/251) common effects resolver → [#253](https://github.com/bob8675309/DNDNEXT/pull/253) actual equipment-resolver parity → [#255](https://github.com/bob8675309/DNDNEXT/pull/255) genuine catalogue-source parity. Green isolated tests do not authorize gameplay deployment.
6. **New staged attunement:** [#257](https://github.com/bob8675309/DNDNEXT/pull/257) offers an admin **Standard (three)/Unlimited** cap toggle and character-item bonds while preserving existing equip slots. SQL and UI are **not deployed**; Short Rest, prerequisites, class exceptions and gameplay-consumer gates remain pending. Its detailed [status ledger](https://github.com/bob8675309/DNDNEXT/blob/feature/campaign-attunement-policy-20261024/docs/Campaign_Attunement_Policy_Status_2026-10-24.md) resides on the draft branch.
7. [Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md](Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md), [Character_Sheet_Formula_Reference.md](Character_Sheet_Formula_Reference.md), [Tactical_Encounter_Equipped_Damage_Mitigation_Status.md](Tactical_Encounter_Equipped_Damage_Mitigation_Status.md) — existing numeric and tactical authority.
8. [Unified_Character_Forge_Status.md](Unified_Character_Forge_Status.md), [Character_Progression_and_Higher_Level_Forge.md](Character_Progression_and_Higher_Level_Forge.md), [Pending_Rest_Runtime_Choices_Status.md](Pending_Rest_Runtime_Choices_Status.md) and specific runtime ledgers — creation/acquisition and rest semantics.
9. [CHATGPT_REPO_WRITE_PROCEDURE.md](CHATGPT_REPO_WRITE_PROCEDURE.md), [REPO_ACCESS_STANDING_RULE.md](REPO_ACCESS_STANDING_RULE.md) — exact-head safe GitHub/Supabase procedure.

## Reconciled main / live database checkpoint

- Last verified `main`: `0e925958b49505e010a011b1de4d6de28f30b7b7` after #249/#252/#254/#256 merges. **Always re-fetch**; this is an anchor, not a promise of current HEAD.
- DnDWeb Supabase `ucggczovhmauhshvhusx` continues using the original equipment/tactical/rest implementations. Neither the draft effects SQL nor the attunement migration was applied during this audit.
- Read-only catalogue sample: 2,739 `items_catalog` entries, 19 inventory instances and 1,037 spell-effect records (point-in-time figures).
- Existing numeric equipment resolver merges catalogue payload then item-instance overrides; tactical weapon bonuses and typed resistance/DR have specialized consumers. The current tactical order follows `20261016_08_resistance_before_flat_reduction.sql`: Resistance before flat damage reduction.
- Important: *equipped*, *attuned*, *rest-eligible* and *active magic effects* are separate states. Unlimited attunement must never loosen helmet/boots/body/weapon slot restrictions.

Older archive sections and former dated "active" queues in other files remain useful for chronology, but are not active merge/deployment instructions.

## Realistic Dice future subsystem

Read `Realistic_Dice_Roller_Architecture_Roadmap.md` before implementing or modifying the future roller.

### Why this exists

The current Character Forge Abilities tab contains a CSS-based dice-tray/result-die prototype. It preserves the correct Forge roll objects and allocation behavior, but its trajectories are presentation-only and should not become the permanent cross-site engine.

The reusable subsystem is planned to support:

- Forge generated ability totals;
- Character Sheet ability/skill/save/initiative rolls;
- damage/healing dice later;
- future tactical combat roll presentation;
- true d6, d8, d10, d12, and d20 polyhedral dice;
- a Forge-specific aggregate `resultCube` for values such as 4d6-drop-lowest totals.

### Locked dice boundary

**Rules decide the result; physics only visualizes it.**

Do not let Rapier/Three client physics decide or replace:

- attack/save/damage outcomes;
- generated ability totals;
- advantage/disadvantage choice;
- tactical pathing/occupancy;
- LOS/cover/range;
- initiative ordering;
- encounter turn/action state.

Dice rigid-body collision rules are deliberately separate from the existing discrete tactical hex rules.

### Planned implementation order

1. finish/accept the current Forge checkpoint;
2. create a dedicated Realistic Dice branch/PR from the accepted commit rather than widening #176 indefinitely;
3. build the reusable core + Forge adapter first;
4. add Character Sheet adapter only after Phase 1 acceptance;
5. add tactical adapter when tactical work resumes;
6. consider a global overlay host only after multiple real consumers justify it.

## Character Forge / progression / runtime documents

- `Character_Forge_Training_Redesign_Status.md` — player Training design/history subledger.
- `Character_Forge_Training_Browser_Implementation_2026-08-21.md` — Training browser implementation details.
- `Character_Forge_Background_Audit.md` — accepted Background audit/presentation history after merged PR #175; use for provenance, not as an active layout queue.
- `Unified_Character_Forge_Status.md` — controlling shared Forge/progression/runtime architecture.
- `Player_Forge_Choice_Routing_and_Source_Magic_Status.md` — player-facing choice placement and source-magic authority.
- `Character_Progression_Foundation.md` — normalized creation/progression model.
- `Character_Progression_and_Higher_Level_Forge.md` — direct higher-level creation vs earned progression.
- `Pending_Rest_Runtime_Choices_Status.md` — post-rest attention vs optional replacement classification.
- `Player_Forge_Starting_Magic_v3_Status.md` — starting magic.
- `Player_Forge_Starting_Equipment_Status.md` — starting equipment/wealth/currency.
- feature-specific `*_Runtime_Status.md` ledgers — runtime cadence and restoration authority.

Core cadence rule: persistent source-owned acquisitions belong to Forge/progression; proficiency-dependent choices belong to Training; spell-centric choices belong to Spells; rest decisions belong to runtime; per-use decisions belong to action UI; future campaign-event unlocks belong to quest/dialogue authority when that subsystem exists.

## Character Sheet / roll integration

Current reusable sheet flow includes `CharacterSheet5e` → `onRoll` → `CharacterSheetPanel` → profile/NPC parent → `CharacterSheetRollResult`.

This existing structured-result seam should be adapted by a future `CharacterSheetDiceOverlay`. Do not rewrite all sheet formulas solely to introduce 3D presentation.

## Tactical encounter / roll integration

- `Tactical_Encounter_Combat_Roadmap_Blueprint.md` plus current tactical phase ledgers — combat roadmap/status.
- `pages/encounters/*`, `components/encounter/*`, `utils/encounterHex.js`, and live encounter RPCs are current tactical authority.
- `TacticalAttackResultPanel.js` already consumes authoritative combat-log attack results.

Future tactical dice should consume the existing RPC/combat-log result and may use command/request identity as visual-seed input. Do **not** reuse Rapier dice collision rules for encounter movement/pathfinding.

## Species baseline

- `Forge_Post170_Species_Artwork_Status.md` — accepted Species baseline after merged PRs #171–#173.
- `Forge_Species_Family_Submenu_Status.md` — Species family/setting-row identity and persistence rules.
- `Forge_Source_Presentation_and_Species_Variants_Status.md` — structured source-presentation foundation/history.

Species is considered complete enough to freeze unless a concrete defect is reproduced. `Gift of the Aetherborn` remains visible/source-backed and its future unlock belongs to Game-Master-defined quest/NPC dialogue progression.

## Background baseline

Background is accepted after merged PR #175. Its reusable family banners/crests/icons and compact Background dossier are now baseline.

Audit omissions/parsing/routing against the source payload before changing anything that merely looks uneven. Do not silently rebalance source Backgrounds.

## Training subledger

Training remains important because PR #176 started there. Preserve the accepted direction and source ownership documented in `Character_Forge_Training_Redesign_Status.md`, including player/NPC isolation, Skills/Feats view separation, canonical tool↔Trade Skill mapping, no double-spend, and existing completion authority.

Do not regress Training while working on Class/Abilities/dice presentation.

## Character sheet / inventory / crafting

- `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md` — canonical item/inventory/equip/sheet/tactical boundaries.
- `Character_Sheet_Formula_Reference.md` — ability/save/skill/AC/initiative/passive formulas.
- `NPC_Character_Sheet_Selection_Reconciliation.md` — selection/stale-response ownership.
- `Town_Crafter_Current_Status.md` — town crafter/profile state.
- `Source_Patch_Pipeline_Audit.md` — source-bake / validator pipeline.

After the Forge is complete, the user wants to circle back to a broader crafting redesign: a unified crafting-material list whose material has craft-specific effects, plus possible expansion of individual tools into granular craft skills/recipe systems. That is deliberately separate from Realistic Dice and PR #176.

## Tactical encounter / sprites / security

- `Tactical_Encounter_Combat_Roadmap_Blueprint.md` plus latest tactical phase ledgers — combat roadmap/status.
- `Dawn_High_Quality_Prototype_Plan.md`, `Sprite_Production_Work_Map.md`, `Sprite_Production_Art_Bible.md`, `Sprite_Production_Run_Log.md` — sprite work.
- `Security_Hardening_Roadmap_Status.md` — security/database hardening.

Always inspect live grants/functions before modifying authenticated `SECURITY DEFINER` surfaces.

## Protected boundaries

Character Forge or Realistic Dice work does not authorize changes to world-map, town/city-map behavior, route/travel/weather/camp/clock logic, tactical combat execution/movement/pathing, crafting/inventory execution, merchants, or unrelated runtime systems.

`components/MapPageClient.js` remains protected unless Paul explicitly requests world-map work. World-map and town/city-map behavior must never be casually combined.
# DNDNext Current Handoff Prompt

Status: copy-ready project handoff, reconciled 2026-08-08

Use the prompt below when starting a new ChatGPT/Codex work session. It directs the new session to live state and the current subsystem documentation instead of relying on an incomplete conversation summary.

---

## Copy from here

You are taking over the `bob8675309/DNDNEXT` repository as a senior developer, technical advisor, and implementation owner.

DNDNext is a Next.js Pages Router + Supabase D&D campaign platform. Styling uses Bootstrap and SCSS. Treat current GitHub `main`, live Supabase state, migrations, source validators, and the living documents under `docs/` as the evidence base. Do not trust old conversation assumptions when source or deployed state can be inspected.

### Required first actions

Before changing anything:

1. Inspect current `main`, open PRs, recent commits, and exact CI/deployment status.
2. Inspect the live Supabase project read-only when the task depends on schema, functions, RLS, or data.
3. Read `docs/README.md` and `docs/Documentation_Refresh_Manifest.md` first.
4. For Character Forge/progression work, read in order:
   - `docs/Unified_Character_Forge_Status.md`
   - `docs/Character_Progression_Foundation.md`
   - `docs/Character_Progression_and_Higher_Level_Forge.md`
   - `docs/Character_Forge_PR_A_Deployment_Evidence.md`
5. Reconcile those documents against current source and live Supabase. The active PR #170 documents supersede older Character Forge/progression text in the platform-wide roadmap until that roadmap is fully reconciled.
6. Update the relevant documents whenever a milestone, failure, architecture decision, migration, acceptance result, or protected boundary changes.

Do not make changes first and explain later. Inspect, identify the authority boundaries, provide a concise safe patch plan, then implement after the plan is accepted or when the user has already said to proceed.

### Non-negotiable project boundaries

- Do not mix world-map behavior with town/city-map behavior.
- Do not touch the world map or `components/MapPageClient.js` unless the user explicitly requests world-map work.
- Tactical encounter state must remain isolated from routes, travel, weather, camps, world clock, and location simulation.
- Smiths handle physical gear. Enchanters handle magical A/B/C slots by item tier.
- Generic NPCs must not become crafters without an appropriate role.
- Canonical database state remains authoritative for characters, sheets, inventory, equipment, spells, progression, encounters, and guarded commands.
- Browser state may preview actions but must not bypass guarded Supabase authority.
- Realtime is a synchronization signal, not the source of truth.
- Preserve working systems and avoid broad rewrites.
- Before returning a patch, verify every helper, hook, state variable, memoized value, RPC argument, and prop is defined and passed at every use site.
- Keep unrelated changes out of the active branch.
- Never register, assign, or describe a visual asset as approved until the user has visually approved it and documented gates have passed.

### Repository and delivery workflow

- Use a bounded branch and PR for meaningful source/documentation work.
- Review the exact PR head and changed-file boundary before merge.
- Check Vercel when available, but distinguish an account build-rate-limit failure from an application compile failure.
- Conserve hosted builds by batching coherent changes.
- A successful repository `npm run build:vercel` in CI is valid build evidence, but it is not the same as a successful hosted Vercel deployment.
- Never claim a local Blender result passed until actual output/artifacts have been inspected.
- The user prefers all PowerShell commands on one line.
- Do not require the user to manually edit individual sprite frames.
- Keep progress updates brief and continue without unnecessary clarification once permission to proceed has been given.

## Current focus: Character Forge / progression PR #170

PR #170 (`agent/character-forge-resilience-presentation`) is the active implementation branch and remains **open and unmerged**. Do not restart the earlier NPC/player Forge consolidation or the explicit choice-cadence audit; those foundations are already present.

### Governing parity rule

For permanent character decisions, a character created directly at level N and a character that earns level N through XP should converge on equivalent authoritative state.

This does **not** mean every source-text choice becomes permanent Forge state.

Current cadence/placement model:

- permanent creation/attained-level choice → authoritative creation/progression state;
- proficiency-dependent choice such as Expertise → Training placement;
- permanent spellbook-dependent choice such as Wizard Signature Spells → Spells placement;
- Long/Short-Rest configurable choice → guarded runtime configuration;
- per-use choice → action/runtime UI;
- informational feature → display only.

Weapon Mastery and Wizard Spell Mastery are not one-time Forge locks.

### Current progression authority

The active level-up UI completes through `public.complete_character_level_up_v5`.

Connected persistent families include:

- General feat / Epic Boon advancement;
- persistent simple class choices;
- Bard Magical Secrets;
- Lore Magical Discoveries;
- Draconic Elemental Affinity;
- Champion Additional Fighting Style;
- Sorcerer Metamagic acquisition/replacement;
- Warlock Mystic Arcanum acquisition/replacement;
- Magic Initiate per-instance spell replacement;
- Eldritch Invocation acquisition/replacement, prerequisites, dependent choices, repeatability, and Lessons of the First Ones;
- Battle Master maneuver acquisition/replacement;
- XPHB Wizard Savant spellbook chronology;
- XPHB Wizard Signature Spells.

Authenticated v3/v4 completion is revoked. Legacy v1/v2 completion grants remain an explicit cleanup item. Do not route the UI back to them.

### Wizard state — live through migration 42

Live migrations include:

- `wizard_savant_spellbook_progression`
- `wizard_savant_forge_chronology`
- `wizard_signature_spells_authority`

#### Savant

Savant is complete across earned progression and higher-level Forge for Abjurer, Diviner, Evoker, and Illusionist.

Savant rows use `source_type='class-feature'` plus `raw_payload.wizardSpellbook=true`; they are level-1+ Wizard spellbook membership but not ordinary base Wizard rows. Cantrips are separate.

Historical acquisition chronology is 3/3/5/7/9/11/13/15/17 for nine total Savant spell rows on a level-17+ qualifying Wizard.

#### Signature Spells

Migration 42 connects the permanent Wizard-20 selection of two level-3 spells already in the **final normalized Wizard spellbook**.

- Direct Forge displays Signature on the Spells step and restricts options to the draft spellbook.
- Earned 19→20 progression applies ordinary level-20 Wizard spell acquisition first, then validates/applies Signature against the resulting spellbook.
- A level-3 Savant spell can be one of the Signature Spells.
- Signature overlays the existing `character_spells` row; it does not create duplicate membership or replace original source provenance.
- Each Signature Spell is prepared/always available and has one tracked `short_rest` free use restored by the existing Short/Long Rest authority.
- This establishes character-sheet/rest resource state only; no new tactical battle-board free-cast adapter is claimed by this migration.

Production rollback proofs cover successful overlay/rest recovery, invalid-choice rejection, full level-20 Abjurer higher-level Forge chronology with a Savant-granted Signature Spell, and authenticated Wizard 19→20 v5 completion using same-level learned Signature Spells.

The final production integrity checkpoint after those rollback proofs remained:

- 7 characters
- 7 character sheets
- 30 character-spell assignments
- 7 progression rows
- 0 open level-up sessions
- 0 synthetic proof residue
- protected world baseline 20 locations / 4 routes / 9 route points

Runtime source head `9740d66a45b215805a6c988c25874a01d1e35e55` passed all five PR GitHub Actions workflows and the repository's exact `npm run build:vercel` production build. Hosted Vercel itself was blocked by the account build-rate limit and is not claimed green for that checkpoint.

### Immediate next Wizard slice

Wizard **Spell Mastery** is the remaining Wizard-specific progression/runtime item.

Do not implement Spell Mastery as a permanent level-18 Forge or level-up choice. The selected spells can change after a Long Rest, so the feature belongs in guarded runtime Long-Rest configuration with spellbook-derived eligibility and separate free-cast/resource semantics.

Read the imported/source rule before implementing and preserve the distinction between:

- spellbook membership;
- current Spell Mastery configuration;
- preparation/availability;
- free-cast resource state;
- tactical battle-board execution.

### Other remaining PR #170 blockers

After/beside Spell Mastery:

1. complete guarded multi-source starting-magic frontend integration where still incomplete;
2. add source-backed starting equipment packages and higher-level starting wealth/equipment;
3. add character-scoped starting currency for multi-character accounts;
4. resolve Artificer wildcard Magic Item Plan choices into concrete item instances;
5. finish preferred Species / Background / Class / Feat / Subclass persistent-choice coverage and conditional-choice UI polish;
6. audit/revoke obsolete authenticated progression RPC generations when confirmed unused;
7. run final authenticated browser acceptance across representative low/high-level, martial/caster, nested-feat, subclass, and rest-configuration cases;
8. only then merge PR #170.

## After PR #170: resume Dawn quality pivot

The sprite-production pipeline is technically proven, but the primitive procedural Dawn source model is rejected as final art. Once the current Character Forge interruption is accepted, resume from:

1. `docs/Dawn_High_Quality_Prototype_Plan.md`
2. `docs/Sprite_Production_Work_Map.md`
3. `docs/Sprite_Production_Art_Bible.md`
4. `docs/Sprite_Production_Run_Log.md`
5. `tools/blender/DAWN_PROCEDURAL_MODEL.md`
6. `docs/Tactical_Encounter_Phase0_Status.md`

The next sprite milestone remains one high-quality South-facing Dawn idle/walk prototype before another full 32-cell atlas. Preserve the working isolated renderer, atlas assembly, QA, review-publishing, and unified eight-direction runtime.

## Document map for other subsystems

Always begin with `docs/README.md`.

### High-level status

- `docs/Current_Development_Status_and_Roadmap.md` — platform-wide baseline and roadmap; active Character Forge/progression text can lag PR #170, so apply `Documentation_Refresh_Manifest.md` precedence.
- `docs/Deferred_UI_Polish_Backlog.md` — deferred presentation/usability work.

### Character sheets, equipment, crafting, tactical snapshots

- `docs/Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md`
- `docs/Character_Sheet_Formula_Reference.md`
- `docs/NPC_Character_Sheet_Selection_Reconciliation.md`
- `docs/NPC_Profile_Inventory_Equipment_Reference.md`

Do not alter sheet formulas, inventory/equipment authority, crafting completion, or encounter snapshots without reading the matching handoff.

### Tactical encounter / combat

- `docs/Tactical_Encounter_Combat_Roadmap_Blueprint.md`
- `docs/Tactical_Encounter_Phase0_Status.md`
- `docs/Tactical_Encounter_Phase1_Foundation_Status.md`
- matching Phase 1 spell/action/effect ledger
- `docs/Tactical_Encounter_Milestone2_Durable_Start_Status.md`

Do not recreate existing tactical primitives. Existing tactical state remains separate from world/town simulation.

### Towns / merchants / crafters

- `docs/Town_Crafter_Current_Status.md`
- `docs/Source_Patch_Pipeline_Audit.md`

World and town systems are protected dependencies. A town/profile/crafting task does not authorize world-route or `MapPageClient` changes.

### Security / database

- `docs/Security_Hardening_Roadmap_Status.md`
- current migrations and live functions/RLS

Do not blanket-revoke authenticated `SECURITY DEFINER` functions; many are intentional guarded command boundaries. Audit each by its internal authorization contract.

### Documentation precedence

When sources disagree, use:

1. live Supabase schema/migrations/functions/protected state;
2. current repository source and validators;
3. `docs/Documentation_Refresh_Manifest.md` plus the active subsystem status/evidence documents;
4. platform-wide roadmap and phase ledgers;
5. historical exports/runbooks only as provenance.

Record discrepancies instead of silently reconciling them from memory.

## Working style

- Be concise in user-facing updates but thorough in inspection.
- Proceed when the user says “proceed”; do not repeatedly ask for permission already granted.
- Do not claim GitHub, Supabase, Blender, Vercel, or build limitations until an actual attempt supports the claim.
- Keep documentation synchronized with implementation/evidence.
- Prefer coherent patches over wasteful push churn.
- Show evidence for pass/fail decisions.
- Preserve rejected experiments in the relevant run log so they are not repeated.

Begin by verifying PR #170 and live Supabase against the four active Character Forge/progression documents. If migration 42 and its evidence are still current, continue from guarded Wizard Spell Mastery runtime Long-Rest configuration rather than reopening Savant/Signature/cadence work.

## End copy

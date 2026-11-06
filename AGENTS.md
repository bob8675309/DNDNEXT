# DNDNext — Repository Instructions for AI Coding Assistants

**Read this before making code, database, deployment or documentation changes.** This project has many historical status files. A confident summary is not evidence of the current implementation.

## Mandatory recovery

> **2026-11-01 verified-project-state routing update:** The durable [project snapshot](docs/PROJECT_STATE.md), [active task](docs/ACTIVE_WORK.md), [system registry](docs/SYSTEM_REGISTRY.json), [document lifecycle](docs/DOCUMENT_LIFECYCLE.md), and [append-only receipts](docs/HANDOFF_LOG.md), and the [phased objective checklist](docs/PHASED_DEVELOPMENT_CHECKLIST.md) now distinguish current source/deployment evidence from historical milestones. Read them after `START_HERE_ACTIVE_HANDOFF.md` and before changing a subsystem. Never treat this dated snapshot as live API state.

1. Read **[docs/START_HERE_ACTIVE_HANDOFF.md](docs/START_HERE_ACTIVE_HANDOFF.md)** first. It contains the current workstream, last dated status snapshot, what is *not* implemented, one next task, links to the relevant SQL and Docs, and the required resumption protocol.
2. Read **[docs/SPELL_ENGINE_DECISIONS.md](docs/SPELL_ENGINE_DECISIONS.md)** for six owner-approved, durable composable spell-engine decisions. Do not re-ask them without a concrete conflict.
3. Read **[docs/Spell_Engine_PrePivot_Audit_2026-10-31.md](docs/Spell_Engine_PrePivot_Audit_2026-10-31.md)** and **[docs/Composable_Spell_Engine_AI_Readiness_2026-10-31.md](docs/Composable_Spell_Engine_AI_Readiness_2026-10-31.md)** for scope, existing authorities, uncovered mechanics and future human/AI contract.
4. Inspect relevant subsystem Docs/SQL **and verify them against current GitHub PR/base/branch/CI and read-only live Supabase schema/function/grants**. Every “current” checkpoint is dated and may be stale; multiple archived PRs are preserved in Git history but **not** present in the active working tree.
5. State what you have *actually verified*, what is *only tested in research*, and what remains *unknown*. Don't start a rewrite, invent missing history, conflate a CI fixture with deployed gameplay, or redo previously finished work without a reproduced defect.

## Current approved direction

Build a **versioned, source-qualified, closed-vocabulary composable tactical spell engine**, starting with **2024 XPHB spells**, using **existing server-authoritative** geometry, attack/save, damage, effects, conditions and resource systems. Use the other editions only as needed and preserve their identity; keep unsupported spells **GM-assisted**. Plan for a future **Admin visual spell builder**, **opt-in, GM-controlled, AI-off-capable Actor AI** sharing the exact same legal actions and executor as humans, and separately versioned house-rule overlays. This is **research/spec stage**, not a deployed interpreter or live Eldritch Blast cast.

## Mandatory end-of-session documentation directive — owner requirement (2026-11-06)

**MUST, not optional:** Before declaring any **substantial DNDNext development session** complete, the developer/assistant **must update BOTH** files on the appropriate active work/research branch, preferably in the same reviewable commit as the change:

1. **`docs/ACTIVE_WORK.md`** — update its current top-level task/status to reflect what actually changed, **why** the priority/implementation decision was made, what remains unverified or blocked, dependencies, and **one precise next bounded action**. Preserve older historical checkpoints; never present an obsolete task as newly current. If the next task is unchanged, explicitly state that it was reconfirmed and why.
2. **`docs/HANDOFF_LOG.md`** — **append**, never overwrite or silently revise, a factual dated receipt covering the branch/base/exact tested SHA or pending-SHA verification, files actually changed, decision and rationale, tests with exact run IDs/conclusions, signed-in/production/browser evidence levels, unresolved failures/uncertainties, release approvals and whether live SQL/merges/deployments/paid calls occurred (write **none** when none), plus the same **single next action**.

A **substantial session** includes code/SQL/fixture/test changes; a source investigation that changes understanding, priorities, or acceptance; important architecture/product decisions; CI diagnosis with concrete outcomes; and meaningful documentation or automation work. A trivial Q&A or read-only lookup with no new decision or development state need not create a fabricated receipt.

**The generated `PROJECT_HEALTH.generated.md` and automatic branch snapshots do NOT satisfy this requirement.** They are machine-captured evidence, not the developer's explanation of **why** decisions were made. Align the two authored documents with actual GitHub evidence before stopping, run relevant documentation validators and exact-head checks, and link the receipt in the final chat response. Never claim updates or completed tests that were not executed. If GitHub writes or CI are unavailable, say so, provide the exact outstanding handoff entries and mark the session **handoff incomplete** rather than implying continuity is secured. Never use this rule as permission to merge to `main`, deploy, modify live Supabase, or pay for APIs.

## Safety and delivery

- **No** merging to `main`, live Supabase mutations/role grants, paid hosting, production rollout, destructive repository/preview actions or AI runtime enablement without express owner approval.
- Maintain Next.js **Pages Router**, Bootstrap/SCSS (**no Tailwind**) and stable Forge, NPC, inventory, equipment, rest and tactical authorities. **Do not touch the world map** without first discussing it; do not couple world/town maps to tactical hex logic.
- Prefer existing tested primitives over duplicate combat or character effect systems. Never let the browser or a language model determine authoritative combat outcomes or hidden game state.
- For each patch, inspect real dependencies and source contracts, use free disposable local/CI tests, verify exact-head status, and record **commit SHA, tests, failure/blockers, live DB effects, unverified assumptions and one next task** in the active handoff before finishing.
- If an instruction in an old status file contradicts current repository/DB evidence or the six latest owner decisions, **surface the conflict; never silently pick the older statement**.

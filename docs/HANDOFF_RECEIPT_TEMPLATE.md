# DNDNext — End-of-chat handoff receipt (copy once per session)

> **MANDATORY:** At the end of *every substantial development session*, update the active branch's `docs/ACTIVE_WORK.md` and **append** a dated factual receipt to `docs/HANDOFF_LOG.md` using this template. Include both *what* changed and *why*, exact source/check evidence, limitations, and the single next task. Generated health snapshots are not a substitute; if write access or CI fails, explicitly declare the handoff incomplete instead of inventing a receipt. No merge, deployment, database write or paid API activation is implied by this requirement.

## Identity and authority
- UTC timestamp:
- Production `main` SHA (read live):
- Work branch / exact head SHA:
- PR number / status / base / base SHA:
- Vercel deployment ID / source SHA / status:
- Supabase project / live migration checkpoint (only if relevant):
- Active owner-approved design/decisions referenced:

## Phase and session-gate status
- Active product phase and exact `P#.#` objective:
- Phase status (IN RESEARCH / BLOCKED / VERIFIED IN ISOLATION / etc.):
- S0–S7 gates completed, with evidence (never assume all were completed):
- Phase exit conditions satisfied / NOT satisfied:
- Remaining unchecked P#.# tasks and blocking dependencies:
- Owner-approved priority override, if any:

## Scope
- The ONE objective for this chat:
- Files and paths authorized:
- Protected systems excluded:
- Owner approval still required for:

## Evidence ledger
- Source inspected (exact paths, not document names alone):
- Live database reads (queries/functions/grants, no sensitive values):
- Changes made (files + behavior + commit SHA):
- Tests and exact CI run URLs (static vs executable vs signed JWT vs browser):
- Browser acceptance (who/when/what observed; otherwise UNVERIFIED):
- Production changes (explicitly 'none' if none):

## What remains
- Known regressions/security blockers:
- Assumptions NOT verified:
- Docs that were stale and how they were reconciled:
- Exact next single task (one sentence; include `P#.#` ID):
- Clear stop condition / acceptance criteria:
- Reviewer notes:
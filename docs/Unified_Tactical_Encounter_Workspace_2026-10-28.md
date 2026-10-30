# Unified Tactical Encounter Workspace — Draft 2026-10-28

## Scope
New route: `/encounters/workspace`. Navigation composes **existing** pages into one encounter-focused interface, preserving their server-authoritative Supabase RPCs, their internal commands, the separate reusable map editor, and all classic URLs. The workspace adds one encounter selector, four clearly explained sections, session status, and responsive styling. Existing pages optionally accept `workspaceSessionId` and `onWorkspaceSessionChange` props; direct navigation without props remains supported.

## Current workflow
1. **Setup & GM** — create session on a reusable map, stage actor and teams, set initiative/controller, start, pause, resume, resolve, archive.
2. **Movement & Reactions** — path, movement budget, opportunity reaction, End Turn.
3. **Combat & Spells** — weapon/unarmed/core actions, spells, targeting, saving throws and combat logs.
4. **Map Workshop** — optional board editing, separate from session/character world position.

## Important limits
This is a **navigation/consolidation checkpoint**, not yet a redesigned shared board interaction model. Existing tabs still carry their original internal layouts and some redundant classic navigation links. Only the selected section mounts at once; tab changes reload that section's authorized data. The workspace selector is kept in sync with the child selectors when selected; a child may temporarily default to the first encounter while it fetches its own session list. A shared backend state/view-model and responsive pane redesign are next, after browser validation.

No database migration, gameplay RPC change, world/town map change, or experimental atomic Attack integration. Existing draft #299 remains separate. **Do not merge or deploy without checking at least session selection, staging/initiative, move/reactions, combat, spells and map editing as admin and player.**

## Manual checks
- Open `/encounters/workspace` in a draft/staging deployment; verify all four sections load and the session selector stays aligned.
- Switch between Setup, Movement and Combat repeatedly without choosing the wrong encounter.
- Add participant, edit initiative/controller and start a disposable encounter, observing the status.
- Exercise normal authoritative Move, reaction prompt/pass, attack, spell and End Turn; verify HP/log once and refresh consistency.
- Verify non-admin role cannot see or invoke GM mutations.
- Check small screens; ensure old `/encounters/live`, `/encounters/play`, `/encounters/combat`, `/encounters` still work.

## Automation constraints
Connector access is GitHub, Supabase (read-only for this change) and Vercel deployments, *not a live browser automation session*. Source/CI validation is possible; cannot claim to have personally clicked through the live encounter app. Never run destructive commands on real stored encounters to simulate a UI click.

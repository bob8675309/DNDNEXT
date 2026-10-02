# Next Chat Handoff — 2026-10-01

Use this as the concise takeover note, then read the 2026-10-01 override at the top of `DNDNext_Current_Handoff_Prompt.md`.

## Repository state

- repository: `bob8675309/DNDNEXT`;
- current `main` at this documentation refresh: `ab8c5ce6df1fabd906890b38bcfee16deac2ca0d`;
- active PR: **#199 — Polish floating ruined-library subclass Tarot selector**;
- branch: `agent/subclass-tarot-scene-rebuild-20260922`;
- validated pre-documentation head: `89197828b6ae9945ac436da4339ef910c379eb4c`;
- PR state: **open / mergeable / unmerged**;
- all **11/11** triggered GitHub workflows passed at that head;
- Vercel deployment `3KoiKyA8wXeWPkMfVME5CFfXjToD`: **READY / success**;
- preview host: `dndnext-git-agent-subclass-tarot-9aeaa6-pauls-projects-2016aa54.vercel.app`;
- do not merge without Paul's explicit approval.

Documentation-only commits after the validated head may advance the branch SHA. Re-fetch the exact remote head before any write, validation claim, deployment check, or merge.

## Current Class / subclass presentation

The subclass selector is a floating Tarot carousel in a dark, smoky ruined gothic library. The physical runic-table/contact direction is retired.

Preserve:

- the real DNDNext subclass Tarot fronts;
- one continuous carousel for all catalogue sizes;
- one exact hero position;
- rear-card shared backs;
- drag/flick, arrows, keyboard, side-card-to-hero behavior;
- explicit-click-only subclass persistence;
- reduced-motion behavior.

## Independent Codex and Feature windows

The latest accepted Class step uses separate state:

- `classFeatureDetail` → Class Feature panel;
- `subclassCodexDetail` → Subclass Codex.

Separate routing:

- subclass inspection → `onSubclassDetail`;
- feature inspection → `onFeatureDetail`.

The two viewport-floating windows may remain open simultaneously. Codex Progression pills open the Feature panel without replacing the Codex.

Current desktop targets are approximately 520px for Feature and 720px for Codex.

## Validator checkpoint

The split-panel work exposed stale literals in older validators. They were repaired without changing runtime authority.

At `89197828b6ae9945ac436da4339ef910c379eb4c`:

- Validate Class browser polish — PASS;
- Validate PR170 browser smoke corrections — PASS;
- Validate Artificer Magic Item Plans — PASS;
- the remaining triggered Forge workflows — PASS;
- total — **11/11 PASS**;
- Vercel — **READY / success**.

## Supabase / protected boundaries

PR #199 makes no Supabase migration/data change.

Do not touch the world map unless Paul explicitly requests it. Keep world-map and town/city-map behavior separate. Class/Tarot presentation work does not authorize tactical, crafting, inventory, merchant, economy, route/travel/weather/camp/clock, or unrelated database changes.

## Immediate browser acceptance

1. Verify Subclass Codex and Class Feature panel remain open together.
2. Verify each window moves/closes independently and rules copy is readable.
3. Verify Codex Overview, Progression, Features, Lore, and Spells.
4. Test Wizard / dense catalogue and a four-option class.
5. Test slow drag, fast flick/snap, arrows, keyboard, side-card → hero/select.
6. Test desktop, medium, narrow/mobile, and reduced-motion behavior.
7. Re-run exact-head CI/Vercel after any change.
8. Merge only after Paul's explicit approval.

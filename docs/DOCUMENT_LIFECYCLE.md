# DNDNext — Documentation Lifecycle and Preservation Rules

> **2026-11-07 single-entry handoff consolidation — preservation policy:** [NEXT_CHAT_START_HERE.md](NEXT_CHAT_START_HERE.md) is the sole short new-chat navigation entry and contains the ONE owner-current next bounded task; [WORKSTREAMS_AND_PR_DEPENDENCIES.md](WORKSTREAMS_AND_PR_DEPENDENCIES.md) is a dated index, not live status. The lower original doc examples and historical task headings are retained for provenance. DO NOT delete/sweep old Phase 1I–1Z spell ledgers, smoke receipts, Common Character Effects archives, or failed #299 evidence to make the index cleaner. At each new substantial session update **authored ACTIVE_WORK** and **append-only HANDOFF_LOG**, then confirm exact PR SHA/CI; a generated Project Health snapshot can never supersede an owner task or claim all PRs are indexed.

> **Policy approved?** This is a proposed maintainership procedure in the 2026-11-01 documentation-only review branch, not an independent approval for deleting project history.

## Status vocabulary

- **Entry point/current:** `AGENTS.md`, `START_HERE_ACTIVE_HANDOFF.md`, `PROJECT_STATE.md`, `ACTIVE_WORK.md`, `SYSTEM_REGISTRY.json`, `PHASED_DEVELOPMENT_CHECKLIST.md` and the durable owner decisions. Revalidate all dated status facts before work.
- **Living subsystem contract:** implementation details and invariants that remain relevant to the active code path, even if old. Read with actual source and live database.
- **Dated checkpoint:** a historically accurate account of a specific branch/PR, tests, bug or release. Do not read its 'current' wording as current today.
- **Research-only:** experiments, source contracts or CI on unmerged branches. No inference of production functionality.
- **Superseded narrative:** old handoff/roadmap wording replaced by a later record; preserve for context but route successors to current docs.
- **Raw snapshot:** database dumps, SQL function text, old table/cron exports. Not safe to apply verbatim to live Supabase.

## Navigation examples (not exhaustive)

| Document family | Treatment | Current interpretation |
| --- | --- | --- |
| `NPC_Printable_Character_Sheet_Status.md` | Living implementation contract with corrected top status | Printed sheet implemented on production source; exact resource-ledger fidelity separately testable. |
| `Realistic_Dice_Roller_Architecture_Roadmap.md` | Architecture + historical plan with corrected top status | Reusable cube tray has been built; full polyhedral/sitewide expansion remains future work. |
| `Tactical_Encounter_Phase1*_Status.md` | Dated implemented milestone ledgers | Reviewed adapters, not the whole proposed recipe engine. |
| `Release_Candidate_Encounter_Workspace_Rest_2026-10-28.md` | Dated candidate evidence | PR #301 subsequently merged the workspace/rest base. |
| `DNDNext_Current_Handoff_Prompt.md`, `Current_Development_Status_and_Roadmap.md` | Historical multi-chat records, with newer top override | Never treat their old PR queues and SHAs as the active task. |
| `DNDNext_Effects_AI_Current_Handoff_2026-10-24.md` | Dated research/implementation ledger | Research authority must be checked against current PR ancestry. |
| `DNDNext_Alchemy*Codex_v*.xlsx`, `alchemy-brew-guide-v*.json` | Versioned rule/source evidence | Keep all versions for provenance; current sampled live v10 potions are not proof every old row was replaced. |
| `advance_all_characters_v3' function.sql`, `Cron INFO important.txt`, `PublicDBFunctions .txt`, `characters_TableInfo_2.txt` | Raw historical snapshots | Never run/redeploy without live function and trigger diff, approvals and migration plan. |
| `Sprite_Production_Run_Log.md` | Historical art QA record | Passing automatic QA was insufficient; final Dawn art remains unapproved. |
| `Spell_Recipe_P1_Schema_2026-10-31.md` | Approved research specification | Compiler work lives on drafts, not on production main. |

## No automatic deletion

No document is deleted merely for being old, having a stale SHA, repeating a status header, or referring to a closed PR. Before proposing removal: (1) verify current `main`, branch ancestry and live refs; (2) search source/CI/docs for inbound references; (3) confirm it is not an owner decision, rollback ledger, archived research proof or unique rules example; (4) migrate any still-authoritative detail to the living file; (5) show a file-by-file deletion rationale and obtain explicit owner approval. Delete in a **separate bounded PR** from functional changes.

## Document update transaction

1. Re-fetch exact `main` SHA and active PR base/head; verify related backend functions/grants and current Vercel source when relevant.
2. Update `PROJECT_STATE.md` only for independently verified changes; add source paths and exact test evidence to `SYSTEM_REGISTRY.json`. Never infer acceptance from a named validator.
3. Update `ACTIVE_WORK.md` to one engineering objective and a matching `P# / P#.#` task from `PHASED_DEVELOPMENT_CHECKLIST.md`; keep research and release gates separate.
4. Carry forward any unchecked S0–S7/P#.# gates without silently marking them complete. Append a dated, factual `HANDOFF_LOG.md` entry with failures and unknowns. Preserve original author decisions and historical ledgers.
5. Run `node scripts/validate_handoff_registry.mjs` from repository root, inspect resulting diff, then follow explicit approval rules for commit/push/merge/deploy.
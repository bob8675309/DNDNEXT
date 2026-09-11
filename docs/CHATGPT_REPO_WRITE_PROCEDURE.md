# ChatGPT Repository Write Procedure

Updated: 2026-08-30

This project is directly writable from ChatGPT through the GitHub connector and Supabase connector when those actions are available. Do not claim that repo/database writes require a separate environment unless an actual connector/tool attempt fails.

## Repository authority

- Repository: `bob8675309/DNDNEXT`
- Default/production authority: `main`
- Accepted current `main` checkpoint: `a2aecdd354346926afdf33efb1af320581563b68` (merged PR #175)
- Current open continuation branch: `agent/training-tab-redesign`
- Current open PR: **#176** — Character Forge browser-review continuation, unmerged
- Immediately before the 2026-08-30 documentation-only handoff updates, PR #176 head was `9447be566f8383e8227c6fccb37a0bde2bdbe078`; documentation commits advance it.

Always re-fetch the remote PR/branch head immediately before a write, validation claim, deployment check, or merge. Do not treat a SHA copied into prose as permanently current.

Do not merge PR #176 without explicit user approval.

## Preferred safe write path

For any change:

1. Re-fetch the current PR/branch head and confirm the target branch.
2. Inspect the current target file(s) from that exact branch before writing.
3. Keep the change bounded to the requested subsystem.
4. Use non-forced, exact-head-aware GitHub writes.
5. If the connector exposes grouped Git blob/tree/commit/ref operations, prefer one coherent commit for a coherent multi-file runtime change.
6. For isolated UTF-8 documentation edits, `GitHub.create_file` / `GitHub.update_file` are acceptable.
7. Never run sequential update/delete writes against the same path using a stale blob SHA; re-fetch/use the returned content SHA as needed.
8. Re-fetch the branch/PR after writing and verify only intended files changed.
9. Run the focused validator(s) and required regressions/protected-boundary checks.
10. Verify exact-head GitHub checks and Vercel deployment when the change triggers deployment.
11. Before merge, re-fetch the PR head again and merge only the validated expected head.

Never force-push or overwrite concurrent branch movement simply to make a patch apply.

## Branch/scope discipline

PR #176 is already a broad Character Forge browser-review branch. Do not keep widening it indefinitely.

In particular, the planned reusable **Realistic Dice Core** is documented on #176 for handoff purposes, but its actual Three/Rapier implementation should be created on a **new bounded branch/PR from the user-accepted Forge checkpoint**. See `Realistic_Dice_Roller_Architecture_Roadmap.md`.

If the requested work belongs to another subsystem, first decide whether it should be a separate branch rather than attaching it to the current Forge PR.

## Supabase boundary

Supabase is also directly accessible through its connector. Before any DB change:

1. re-check the live project/schema/migration/data baseline;
2. inspect the exact relevant function/table/policy definitions;
3. use read-only SQL for diagnosis/verification first when possible;
4. use an approved migration path for DDL/schema changes;
5. use approved SQL/data actions only for explicitly requested data changes;
6. verify the resulting live state afterward;
7. do not re-run SQL merely because a repo filename appears absent from the migration ledger if the live effect already exists.

The planned Realistic Dice Phase 1 should not require any Supabase write.

## Standing project safety rules

- Do not touch the world map unless explicitly asked.
- Do not mix world-map behavior with town/city-map behavior.
- Character Forge or dice work does not authorize tactical movement/path, crafting, inventory, merchant, or economy changes.
- Tactical encounter RPC/combat-log results remain rules-authoritative; future dice physics is presentation only.
- Do not reuse dice rigid-body collision rules as tactical-grid movement/collision authority.
- Verify every new helper, hook, state variable, prop, callback, RPC argument, physics reference, and data-contract field is defined and correctly passed.
- Preserve working systems and existing validators rather than weakening contracts to make a patch pass.
- Prefer additive database migrations; never rewrite already-deployed migration history.
- Never expose Supabase service-role credentials to browser code.
- Do not merge an open PR without explicit user approval.

## Documentation discipline

After a meaningful runtime checkpoint is accepted:

- update `DNDNext_Current_Handoff_Prompt.md`;
- update the dedicated subsystem ledger;
- update `Documentation_Refresh_Manifest.md` / `docs/README.md` if the active queue or trust map changed;
- include the exact pre-document/current checkpoint but always tell the next model to re-fetch live GitHub state.

This file exists specifically so future ChatGPT handoffs do not repeatedly forget that the repo and Supabase are writable through connectors while still requiring exact-head, bounded, reviewable changes.
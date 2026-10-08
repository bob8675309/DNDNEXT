# ChatGPT Repository Write Procedure

Updated: 2026-10-08

This project is directly writable from ChatGPT through the GitHub connector and Supabase connector when those actions are available. Do not claim that repo/database writes require a separate environment unless an actual connector/tool attempt fails.

## Repository authority

- Repository: `bob8675309/DNDNEXT`
- Default/production authority: `main`
- PR #199 is merged.
- PR #202 is merged.
- All 12 currently approved Grim Hollow expansion Tarot cards are consolidated on `main`.
- PR #203's Grim Hollow Player's Guide source-content work is merged into `main`.
- Current Tarot creation queue: Fighter — Bulwark Warrior, Living Crucible, Nightwatcher next; 24 new Grim Hollow cards remain overall.
- Consolidation production deployment for `076a9b92e3d492f2dd4867d418477997ca0b4852` is READY.

Always re-fetch the current remote head immediately before a write, validation claim, deployment check, or merge. Do not treat a SHA copied into prose as permanently current.

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

PR #199 and PR #202 are historical merged work and must not be treated as active continuation branches.

Keep future changes bounded to the requested subsystem. Grim Hollow source content is now part of current `main`; future fixes should be bounded follow-up changes rather than reviving PR #203. Tarot artwork may continue directly from current `main` when Paul explicitly requests it.

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
- update the dedicated subsystem ledger (for current Tarot/Class work: `Character_Forge_Subclass_Tarot_Table_Contact_Handoff.md`; for auth/admin activity: `Auth_Navigation_Admin_Activity_Status.md`);
- update `Documentation_Refresh_Manifest.md` / `docs/README.md` if the active queue or trust map changed;
- include the exact pre-document/current checkpoint but always tell the next model to re-fetch live GitHub state.

This file exists specifically so future ChatGPT handoffs do not repeatedly forget that the repo and Supabase are writable through connectors while still requiring exact-head, bounded, reviewable changes.
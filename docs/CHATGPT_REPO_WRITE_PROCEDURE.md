# ChatGPT Repository Write Procedure

Updated: 2026-09-21

This project is directly writable from ChatGPT through the GitHub connector and Supabase connector when those actions are available. Do not claim that repo/database writes require a separate environment unless an actual connector/tool attempt fails.

## Repository authority

- Repository: `bob8675309/DNDNEXT`
- Default/production authority: `main`
- Accepted runtime checkpoint: `320671a22b83432177dcc67e9efd035f3c3ccc5d` (merged PR #195); current `main` may be ahead due to documentation-only merges
- Current open continuation branch: `agent/subclass-carousel-drag-crisp-20260918`
- Current open PR: **#194** — Character Forge subclass Tarot carousel refinement, unmerged
- Reviewed PR #194 head at this documentation checkpoint: `f21a81435946b1ae8ec6112e5376062cfc2b62f4`
- PR #195 — auth-gated navbar + admin activity — is merged and production-deployed.

Always re-fetch the remote PR/branch head immediately before a write, validation claim, deployment check, or merge. Do not treat a SHA copied into prose as permanently current.

Do not merge PR #194 without explicit user approval.

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

PR #194 is a bounded Character Forge subclass-Tarot presentation branch. Keep it limited to the selector/carousel/stage, its validators, and directly related documentation. Do not attach unrelated auth, map, tactical, crafting, inventory, merchant, or database work to it.

The planned reusable **Realistic Dice Core** remains a separate future project and should use its own bounded branch/PR from the user-accepted Forge checkpoint. See `Realistic_Dice_Roller_Architecture_Roadmap.md`.

If the requested work belongs to another subsystem, use a separate branch rather than widening PR #194.

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
- update the dedicated subsystem ledger (for current Tarot work: `Character_Forge_Subclass_Tarot_Flexible_Ring_Status.md`; for auth/admin activity: `Auth_Navigation_Admin_Activity_Status.md`);
- update `Documentation_Refresh_Manifest.md` / `docs/README.md` if the active queue or trust map changed;
- include the exact pre-document/current checkpoint but always tell the next model to re-fetch live GitHub state.

This file exists specifically so future ChatGPT handoffs do not repeatedly forget that the repo and Supabase are writable through connectors while still requiring exact-head, bounded, reviewable changes.
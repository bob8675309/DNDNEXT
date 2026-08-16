# ChatGPT Repository Write Procedure

This project is directly writable from ChatGPT through the GitHub connector. Do not claim that repo writes require a separate environment unless an actual connector write attempt fails.

## Repository authority

- Repository: `bob8675309/DNDNEXT`
- Active continuation branch for the current Forge Species artwork work: `agent/species-art-post170`
- Active PR: #171 — open and unmerged
- Historical PR #170 is merged at `599c4de7397ba6e4bbbb0a061d551d80c3570be7`; do not use it as the active continuation PR.
- `main` remains production authority.
- Do not merge PR #171 without explicit user approval.

## Preferred safe write path

For coherent multi-file changes, use the GitHub connector in this order:

1. Re-fetch PR/head SHA immediately before writing.
2. Fetch the current head commit and base tree SHA.
3. Create every new/updated file as a Git blob with `GitHub.create_blob`.
   - For binary files, send base64 and use the **connector-returned blob SHA** as authority.
   - Do not substitute a locally calculated SHA for a GitHub-returned blob SHA.
4. Build one coherent tree with `GitHub.create_tree`, using the current head tree as `base_tree_sha`.
5. Create one commit with `GitHub.create_commit`, using the current branch head as `parent_sha`.
6. Re-fetch the branch/PR head to guard against concurrent movement.
7. Fast-forward the branch with `GitHub.update_ref(..., force=false)`.
8. Verify the compare/diff contains only the intended files.
9. Run the focused workflow and production build, then the full PR regression matrix.
10. Update handoff docs and the PR body only after the runtime/code checkpoint is green.

## Text-only exceptions

`GitHub.create_file` / `GitHub.update_file` can be used for isolated UTF-8 documentation changes when appropriate, but grouped code/art changes should prefer the blob/tree/commit/ref path above.

## Supabase boundary

Supabase is also directly accessible through its connector. Before any DB change:

1. re-check the live migration/data baseline;
2. dry-run/data-check when possible;
3. use `apply_migration` for DDL/migrations and `execute_sql` for read-only verification or approved data updates;
4. verify protected campaign/runtime/map counts afterward.

## Standing project safety rules

- Do not touch the world map unless explicitly asked.
- Do not mix world-map behavior with town/city-map behavior.
- Verify every new helper, hook, state variable, and prop is defined and correctly passed.
- Preserve working systems and existing validators rather than weakening contracts to make a patch pass.
- Do not merge PR #171 without explicit user approval.

This file exists specifically so future ChatGPT handoffs do not repeatedly forget that the repo and Supabase are writable through connectors.

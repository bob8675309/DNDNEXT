# ChatGPT Repo Write Procedure — Binary Artwork Fallback

Status: active operational addendum

This addendum supplements `docs/CHATGPT_REPO_WRITE_PROCEDURE.md`.

## Non-negotiable authority reminder

GitHub and Supabase are directly writable from ChatGPT through the installed connectors in this project. Do not tell the user that repo/database writes are unavailable unless an actual connector attempt fails and the failure is specific to the requested operation.

## Preferred GitHub write path

For normal coherent patches:

1. Re-fetch PR/branch head.
2. Create/update the required blobs/files.
3. Build a tree/commit when batching is useful.
4. Race-check the target branch.
5. Advance the working ref without force.
6. Compare the resulting diff.
7. Run focused CI plus the full PR regression matrix.
8. Reconcile handoff docs only after the code/art checkpoint is green.

For binary files, the connector-returned Git blob SHA is authoritative when raw `create_blob(..., encoding: "base64")` succeeds.

## Binary transport fallback

If the GitHub connector accepts ordinary text writes but repeatedly clamps or drops binary `create_blob` payloads, do **not** claim the repo is unwritable and do **not** weaken asset validators.

Use this fallback:

1. Keep the application resolver unchanged until the real binary files exist in the repository.
2. Add a deterministic generator/materializer script to the working branch using ordinary UTF-8 GitHub file writes.
3. Add a narrowly scoped GitHub Actions workflow with `contents: write` that:
   - checks out the exact working branch;
   - installs only the image dependency required by the generator;
   - generates the target WebPs from committed source/reference artwork;
   - verifies nontrivial file size plus `RIFF` / `WEBP` headers before committing;
   - commits only the intended generated binary assets back to the same working branch.
4. Verify the materializer commit changes exactly the expected binary paths.
5. Only after the binary commit exists, update `speciesPortraitArtworkFor(...)` / other runtime routing to use the files.
6. Add focused validators proving:
   - each dedicated binary exists;
   - each binary has nontrivial size;
   - each binary is a valid WebP container;
   - Forge-only dedicated routing is correct;
   - canonical non-Forge artwork authority remains unchanged;
   - prior completed artwork families remain intact;
   - protected map/travel/runtime boundaries remain untouched.
7. Run the focused production build and the complete PR workflow matrix.
8. Retain the deterministic generator for provenance if useful. A write-enabled materializer workflow should remain narrowly triggered; remove it or convert it to an explicit regeneration tool when no longer needed.

The Gem Dragonborn batch established this fallback successfully after raw binary transport repeatedly failed while UTF-8 repository writes continued to work.

## Branch integration safety

`merge_pull_request` merges the pull request into its base branch. It is **not** a substitute for merging or fast-forwarding an internal preparation branch.

For this project:

- do not invoke a PR merge action unless the user has explicitly approved merging PR #170;
- do not use a PR merge action merely to integrate a temporary branch;
- prefer direct file/tree/ref updates on `agent/character-forge-resilience-presentation`;
- if a temporary branch is used for preparation, replay or fast-forward its safe file/ref changes without touching `main`;
- keep `force=false` on the protected working branch ref.

During the Gem artwork pass, the assistant selected the PR-merge action twice while probing for a branch-merge operation. The PR state was immediately rechecked/reasserted and PR #170 remained open and unmerged. The safe operational response is to stop using merge actions entirely for this workflow and continue with file/ref writes only.

## Supabase boundary

Artwork/presentation work does not require SQL. Continue to perform the standing pre-change and post-change read-only database sanity checks, but do not create a migration merely for Species images or catalogue presentation.

## Merge rule

PR #170 remains open and unmerged. Do **not** merge it until the user explicitly approves the merge.

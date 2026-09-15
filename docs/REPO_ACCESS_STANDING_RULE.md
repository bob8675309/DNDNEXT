# DNDNext Repository Access — Standing Rule

Updated: 2026-09-13

This is a persistent operational rule for all future DNDNext conversations.

## Never claim project access is unavailable before checking the connected services

DNDNext normally has connected access to:

- **GitHub** for source, branches, PRs, commits, files, refs, workflows, and checks;
- **Supabase** for the live `DnDWeb` database/project;
- **Vercel** for deployments, build state/logs, and preview access;
- **Dropbox** for binary transfer, especially generated artwork.

A new chat must check/discover these connectors at startup. Do not tell Paul to manually upload, copy, deploy, or inspect something that one of these connected tools can already handle unless an actual connector call fails or the capability truly is unavailable.

## Normal source write path

For ordinary source/text changes:

`ChatGPT -> GitHub connector -> exact branch/file/commit/ref -> GitHub verification -> Vercel exact-head verification`

Use the current branch head, not a remembered SHA.

## Full-checkout / scratch-preview runner path

When work needs a checkout, shell tools, filesystem operations, binary materialization, grouped transforms, or deterministic local validators:

`ChatGPT -> GitHub connector -> bounded scratch/preview branch -> temporary GitHub Actions workflow -> checkout real target branch -> exact-head guard -> modify/test -> commit -> push real target branch -> GitHub verification -> Vercel verification`

The key point for future sessions: **the scratch/preview branch can run the workflow that pushes the verified result directly to the intended PR branch. The scratch branch itself does not need to be merged into that PR.**

Rules:

1. Create the scratch/preview branch from the exact accepted target head.
2. Put the temporary workflow only on the scratch/preview branch.
3. Have it check out the real intended branch.
4. Hard-guard the expected target SHA before mutation.
5. Keep the changed-file list explicit and bounded.
6. Run focused validators/build commands.
7. Commit/push back to the real target branch using a non-forced update.
8. Re-read the target branch/PR through GitHub.
9. Verify the Vercel deployment matching the exact new target SHA.

## Preferred binary bridge

Binary artwork is not evidence that repo access is unavailable.

Established route:

`approved local binary bytes -> final format -> SHA-256 + manifest -> ZIP -> Dropbox /DNDNext-Transfer -> temporary download URL -> GitHub Actions scratch/preview branch -> exact target checkout/head guard -> checksum/MIME/dimension/count verification -> exact diff/path guard -> bot commit -> push intended PR branch -> GitHub/CI -> Vercel preview`

This route successfully handled the 2026-09-13 normalized subclass tarot installation: 34 approved 840 × 1440 WebP concepts were materialized to PR #187's branch and then explicitly wired/validated in a second guarded runner step.

See `docs/ARTWORK_BINARY_TRANSFER_RUNBOOK.md`.

## Supabase authority

Use the connected Supabase tool for live database inspection. Repository SQL files are not a substitute for checking the deployed state.

- Project: `DnDWeb` / `ucggczovhmauhshvhusx`.
- Diagnose/read first.
- Apply schema changes only through an appropriate reviewed migration action.
- Do not rerun production SQL merely because migration naming differs between the repo and live ledger.
- Verify live state after any authorized mutation.

## Vercel authority

Use Vercel after a branch write/deployment-triggering commit:

- list deployments for DNDNext;
- match by exact Git SHA/branch metadata;
- wait for `READY`;
- inspect build logs on failure;
- use protected-preview fetch/access tools when direct HTTP access is gated.

Do not use a deployment from another commit as proof that the current commit works.

## Safety boundaries

- Do not use `main` as an experiment/transfer scratchpad.
- Do not force-move an accepted branch over unexpected concurrent work.
- Keep temporary transfer workflows out of the real PR branch.
- Do not restore/regenerate approved binary artwork merely for transport convenience.
- Do not touch the world map unless Paul explicitly asks.
- Never mix world-map behavior with town/city-map behavior.
- Do not allow a transport task to expand into unrelated runtime/database changes.

## Why this file exists

DNDNext has repeatedly lost time at chat handoff boundaries because a new session forgot connector capabilities or assumed that no real checkout/binary path existed. The paths above are established and proven. Check them first.

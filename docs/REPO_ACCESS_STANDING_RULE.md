# DNDNext Repository Access — Standing Rule

This is a persistent operational rule for all future DNDNext work.

## Never claim repository access is unavailable before checking the established path

The normal DNDNext write/validation path is:

1. Use the connected GitHub API/tools to inspect repositories, branches, PRs, commits, diffs, files, and workflow state.
2. Use GitHub file/branch/ref actions for ordinary source and documentation changes.
3. When work needs a real checkout, filesystem operations, binary materialization, builds, validators, image reconstruction, or other shell tooling, use a GitHub Actions workflow on a bounded scratch/staging branch.
4. The Actions runner may check out the repository, run normal `git`, Node, Python, build/validation commands, create binary assets, commit them, and `git push` the resulting commit back to the intended branch.
5. Re-read the resulting branch/commit/workflow state through GitHub before treating the change as accepted.
6. Only advance the real working/PR branch after the scratch/staging result is verified.

Conceptually:

`ChatGPT -> GitHub API -> branch/commit/files`

and when a full working tree is required:

`ChatGPT -> GitHub API -> GitHub Actions runner -> checkout -> modify/test/build -> git commit/push -> GitHub API verification`

## Preferred binary-artwork bridge

For generated artwork or other binary files, **do not return to giant inline base64 Git-blob transfers while the established Dropbox bridge is available**. The proven DNDNext path is:

`generated local bytes -> /DNDNext-Transfer in Dropbox -> one-shot GitHub Actions scratch branch -> exact PR-head checkout -> checksum/MIME/dimension verification -> exact diff guard -> bot commit -> push intended PR branch -> GitHub/CI/Vercel verification`

Use this sequence:

1. Prepare the approved binary files locally in their final repository format.
2. Record a SHA-256 for the complete bundle and for every file.
3. Upload one ZIP bundle to `/DNDNext-Transfer/` in the connected Dropbox account.
4. Create a bounded one-shot scratch branch from the current accepted PR head.
5. Add a temporary GitHub Actions workflow on that scratch branch only.
6. Have the workflow check out the intended PR branch and **hard-guard the exact expected head SHA before modifying anything**.
7. Download the Dropbox bundle, verify the ZIP SHA-256, verify each file SHA-256 and MIME type, and verify required dimensions/format when applicable.
8. Materialize only the approved repository paths.
9. Compare `git diff --name-only` against an explicit expected-file manifest. Abort on any extra or missing file.
10. Run focused validators/build checks when appropriate, commit with the Actions bot, and push the verified commit to the intended PR branch.
11. Re-read the new PR head, changed-file boundary, CI status, and Vercel deployment before reporting success.

This Dropbox -> GitHub Actions route successfully installed the approved Character Forge Species cinematic artwork on **2026-09-05** and is the default binary-transfer route for future DNDNext artwork work.

See `docs/ARTWORK_BINARY_TRANSFER_RUNBOOK.md` for the copy-ready operational recipe.

## Binary asset rule

Binary artwork is not evidence that repo access is unavailable. If a direct connector write is unsuitable for raw bytes, use the established Dropbox + scratch-branch + GitHub Actions materialization path. Verify exact source bytes before attaching new artwork to the working PR branch.

Do not silently substitute older reachable blobs, regenerate already-approved art, downgrade image quality to make transport easier, or claim a binary install succeeded without checksum verification.

## Safety boundaries

- Do not touch `main` or an active PR branch merely to experiment.
- Use a scratch/staging branch for risky transfer/materialization work.
- Prefer fast-forward branch movement after verification; never force-move an accepted branch unless explicitly authorized.
- Re-check the exact remote head before writing or validating.
- Keep temporary transfer workflows/ZIPs out of the real PR diff unless they are intentionally becoming permanent tooling.
- Preserve the standing DNDNext rule that world-map and town/city-map behavior are separate, and do not touch the world map unless Paul explicitly requests it.

## Why this file exists

This path has been used repeatedly on DNDNext. Future sessions must not fall back to saying "I cannot push/pull the repo" or spend another work window rediscovering binary transport without first checking the GitHub connector/API, Dropbox `/DNDNext-Transfer`, and GitHub Actions route described above.
